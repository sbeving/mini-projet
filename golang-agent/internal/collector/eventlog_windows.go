//go:build windows
// +build windows

package collector

import (
	"context"
	"fmt"
	"os"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"logchat/agent/internal/config"
	"logchat/agent/internal/sender"

	"golang.org/x/sys/windows"
)

func logVerbose(format string, args ...interface{}) {
	if os.Getenv("LOGCHAT_VERBOSE") == "1" || os.Getenv("LOGCHAT_DEBUG") == "1" {
		fmt.Printf("[eventlog] "+format+"\n", args...)
	}
}

var (
	advapi32                       = windows.NewLazySystemDLL("advapi32.dll")
	procOpenEventLogW              = advapi32.NewProc("OpenEventLogW")
	procCloseEventLog              = advapi32.NewProc("CloseEventLog")
	procReadEventLogW              = advapi32.NewProc("ReadEventLogW")
	procGetOldestEventLogRecord    = advapi32.NewProc("GetOldestEventLogRecord")
	procGetNumberOfEventLogRecords = advapi32.NewProc("GetNumberOfEventLogRecords")
)

const (
	EVENTLOG_SEQUENTIAL_READ = 0x0001
	EVENTLOG_FORWARDS_READ   = 0x0004
	EVENTLOG_BACKWARDS_READ  = 0x0008
)

// EVENTLOGRECORD structure
type EVENTLOGRECORD struct {
	Length              uint32
	Reserved            uint32
	RecordNumber        uint32
	TimeGenerated       uint32
	TimeWritten         uint32
	EventID             uint32
	EventType           uint16
	NumStrings          uint16
	EventCategory       uint16
	ReservedFlags       uint16
	ClosingRecordNumber uint32
	StringOffset        uint32
	UserSidLength       uint32
	UserSidOffset       uint32
	DataLength          uint32
	DataOffset          uint32
}

// EventLogCollector collects Windows Event Logs
type EventLogCollector struct {
	BaseCollector
	mu sync.RWMutex

	config         config.EventLogCollectorConfig
	handles        map[string]windows.Handle
	lastRecordNums map[string]uint32
}

// NewEventLogCollector creates a new Windows Event Log collector
func NewEventLogCollector(cfg config.EventLogCollectorConfig, snd *sender.Sender) *EventLogCollector {
	return &EventLogCollector{
		BaseCollector: BaseCollector{
			name:   "eventlog",
			sender: snd,
		},
		config:         cfg,
		handles:        make(map[string]windows.Handle),
		lastRecordNums: make(map[string]uint32),
	}
}

// Name returns the collector name
func (ec *EventLogCollector) Name() string {
	return ec.name
}

// Start starts the event log collector
func (ec *EventLogCollector) Start(ctx context.Context) {
	ec.mu.Lock()
	ec.running = true
	ec.mu.Unlock()

	channels := ec.config.Channels
	if len(channels) == 0 {
		channels = []string{"Application", "System", "Security"}
	}

	fmt.Printf("  [eventlog] Starting Windows Event Log collector for: %v\n", channels)

	// Open event logs
	for _, channel := range channels {
		handle, err := ec.openEventLog(channel)
		if err != nil {
			fmt.Printf("  [eventlog] Error opening %s: %v\n", channel, err)
			continue
		}
		ec.handles[channel] = handle

		// Get current record number to start from
		var oldest, total uint32
		procGetOldestEventLogRecord.Call(uintptr(handle), uintptr(unsafe.Pointer(&oldest)))
		procGetNumberOfEventLogRecords.Call(uintptr(handle), uintptr(unsafe.Pointer(&total)))
		ec.lastRecordNums[channel] = oldest + total
	}

	// Poll for new events
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			ec.Stop()
			return

		case <-ticker.C:
			for channel, handle := range ec.handles {
				ec.readEvents(channel, handle)
			}
		}
	}
}

// openEventLog opens an event log channel
func (ec *EventLogCollector) openEventLog(channel string) (windows.Handle, error) {
	channelPtr, _ := syscall.UTF16PtrFromString(channel)

	ret, _, err := procOpenEventLogW.Call(
		0,
		uintptr(unsafe.Pointer(channelPtr)),
	)

	if ret == 0 {
		return 0, fmt.Errorf("OpenEventLog failed: %v", err)
	}

	return windows.Handle(ret), nil
}

// readEvents reads events from an event log
func (ec *EventLogCollector) readEvents(channel string, handle windows.Handle) {
	buffer := make([]byte, 64*1024) // 64KB buffer
	var bytesRead, minBytes uint32

	ret, _, _ := procReadEventLogW.Call(
		uintptr(handle),
		uintptr(EVENTLOG_SEQUENTIAL_READ|EVENTLOG_FORWARDS_READ),
		0,
		uintptr(unsafe.Pointer(&buffer[0])),
		uintptr(len(buffer)),
		uintptr(unsafe.Pointer(&bytesRead)),
		uintptr(unsafe.Pointer(&minBytes)),
	)

	if ret == 0 {
		logVerbose("No new events in %s", channel)
		return
	}

	logVerbose("Read %d bytes from %s", bytesRead, channel)

	// Parse events from buffer
	offset := uint32(0)
	eventsProcessed := 0
	for offset < bytesRead {
		record := (*EVENTLOGRECORD)(unsafe.Pointer(&buffer[offset]))

		// Skip if already processed
		if record.RecordNumber <= ec.lastRecordNums[channel] {
			offset += record.Length
			continue
		}

		ec.lastRecordNums[channel] = record.RecordNumber

		// Extract event data
		ec.processEvent(channel, record, buffer[offset:offset+record.Length])
		eventsProcessed++

		offset += record.Length
	}

	if eventsProcessed > 0 {
		fmt.Printf("  [eventlog] Collected %d events from %s\n", eventsProcessed, channel)
	}
}

// processEvent processes a single event
func (ec *EventLogCollector) processEvent(channel string, record *EVENTLOGRECORD, data []byte) {
	// Convert event type to level
	level := eventTypeToLevel(record.EventType)

	// Extract message strings
	message := ec.extractMessage(record, data)

	// Convert timestamp
	ts := time.Unix(int64(record.TimeGenerated), 0)

	service := ec.config.Service
	if service == "" {
		service = channel
	}

	entry := createLogEntry(
		level,
		message,
		service,
		fmt.Sprintf("eventlog:%s", channel),
		map[string]string{
			"channel":  channel,
			"event_id": fmt.Sprintf("%d", record.EventID&0xFFFF),
			"category": fmt.Sprintf("%d", record.EventCategory),
		},
	)
	entry.Timestamp = ts

	entry.Metadata = map[string]any{
		"record_number": record.RecordNumber,
		"event_id":      record.EventID,
		"event_type":    record.EventType,
		"category":      record.EventCategory,
	}

	if err := ec.sender.Send(entry); err != nil {
		ec.mu.Lock()
		ec.errorsCount++
		ec.mu.Unlock()
		return
	}

	ec.mu.Lock()
	ec.logsCollected++
	ec.lastCollected = time.Now()
	ec.mu.Unlock()
}

// extractMessage extracts the message from the event record
func (ec *EventLogCollector) extractMessage(record *EVENTLOGRECORD, data []byte) string {
	if record.NumStrings == 0 {
		return fmt.Sprintf("Event ID: %d", record.EventID&0xFFFF)
	}

	// Strings start at StringOffset
	stringStart := record.StringOffset
	if stringStart >= uint32(len(data)) {
		return fmt.Sprintf("Event ID: %d", record.EventID&0xFFFF)
	}

	var messages []string
	offset := stringStart

	for i := uint16(0); i < record.NumStrings && offset < uint32(len(data)); i++ {
		// Find null terminator (UTF-16)
		end := offset
		for end+1 < uint32(len(data)) {
			if data[end] == 0 && data[end+1] == 0 {
				break
			}
			end += 2
		}

		if end > offset {
			// Convert UTF-16 to string
			str := utf16ToString(data[offset:end])
			if str != "" {
				messages = append(messages, str)
			}
		}

		offset = end + 2
	}

	if len(messages) == 0 {
		return fmt.Sprintf("Event ID: %d", record.EventID&0xFFFF)
	}

	return strings.Join(messages, " | ")
}

// utf16ToString converts UTF-16 bytes to string
func utf16ToString(b []byte) string {
	if len(b) < 2 {
		return ""
	}

	u16 := make([]uint16, len(b)/2)
	for i := 0; i < len(u16); i++ {
		u16[i] = uint16(b[i*2]) | uint16(b[i*2+1])<<8
	}

	return syscall.UTF16ToString(u16)
}

// eventTypeToLevel converts Windows event type to log level
func eventTypeToLevel(eventType uint16) string {
	switch eventType {
	case 0x0001: // Error
		return "ERROR"
	case 0x0002: // Warning
		return "WARN"
	case 0x0004: // Information
		return "INFO"
	case 0x0008: // Audit Success
		return "INFO"
	case 0x0010: // Audit Failure
		return "ERROR"
	default:
		return "INFO"
	}
}

// Stop stops the event log collector
func (ec *EventLogCollector) Stop() {
	ec.mu.Lock()
	ec.running = false
	for _, handle := range ec.handles {
		procCloseEventLog.Call(uintptr(handle))
	}
	ec.handles = make(map[string]windows.Handle)
	ec.mu.Unlock()
}

// Stats returns collector statistics
func (ec *EventLogCollector) Stats() map[string]any {
	ec.mu.RLock()
	defer ec.mu.RUnlock()

	return map[string]any{
		"name":           ec.name,
		"logs_collected": ec.logsCollected,
		"errors_count":   ec.errorsCount,
		"last_collected": ec.lastCollected,
		"running":        ec.running,
		"channels":       ec.config.Channels,
	}
}

// InitializeWindows adds Windows-specific collectors
func InitializeWindows(cfg config.CollectorsConfig, snd *sender.Sender) []Collector {
	var collectors []Collector

	// Add event log collector
	if cfg.EventLog != nil && cfg.EventLog.Enabled {
		collectors = append(collectors, NewEventLogCollector(*cfg.EventLog, snd))
	}

	return collectors
}
