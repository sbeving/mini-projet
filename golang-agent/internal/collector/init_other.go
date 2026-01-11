//go:build !linux && !windows
// +build !linux,!windows

package collector

import (
	"logchat/agent/internal/config"
	"logchat/agent/internal/sender"
)

// Initialize creates collectors based on configuration (other platforms)
func Initialize(cfg config.CollectorsConfig, snd *sender.Sender) []Collector {
	var collectors []Collector

	// File collectors - available on all platforms
	for _, fileCfg := range cfg.Files {
		if fileCfg.Enabled {
			collectors = append(collectors, NewFileCollector(fileCfg, snd))
		}
	}

	// Command collectors - available on all platforms
	for _, cmdCfg := range cfg.Command {
		if cmdCfg.Enabled {
			collectors = append(collectors, NewCommandCollector(cmdCfg, snd))
		}
	}

	return collectors
}
