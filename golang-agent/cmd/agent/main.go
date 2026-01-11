package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"logchat/agent/internal/buffer"
	"logchat/agent/internal/collector"
	"logchat/agent/internal/config"
	"logchat/agent/internal/sender"
)

var (
	Version   = "1.0.0"
	BuildTime = "unknown"
	GitCommit = "unknown"
)

func main() {
	// Command line flags
	configPath := flag.String("config", "", "Path to config file (default: auto-detect)")
	showVersion := flag.Bool("version", false, "Show version information")
	generateConfig := flag.Bool("generate-config", false, "Generate a sample config file")
	validate := flag.Bool("validate", false, "Validate config file and exit")
	flag.Parse()

	// Show version
	if *showVersion {
		printVersion()
		os.Exit(0)
	}

	// Generate sample config
	if *generateConfig {
		if err := config.GenerateSampleConfig(); err != nil {
			fmt.Fprintf(os.Stderr, "Error generating config: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("Sample config generated: logchat-agent.yaml")
		os.Exit(0)
	}

	// Print banner
	printBanner()

	// Load configuration
	cfg, err := config.Load(*configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading config: %v\n", err)
		os.Exit(1)
	}

	// Validate only mode
	if *validate {
		fmt.Println("✓ Configuration is valid")
		os.Exit(0)
	}

	// Create context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize components
	fmt.Println("🚀 Starting LogChat Agent...")
	fmt.Printf("   Platform: %s/%s\n", runtime.GOOS, runtime.GOARCH)
	fmt.Printf("   Server: %s\n", cfg.Server.URL)
	fmt.Printf("   Hostname: %s\n", cfg.Agent.Hostname)

	// Initialize buffer
	buf, err := buffer.New(cfg.Buffer)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error initializing buffer: %v\n", err)
		os.Exit(1)
	}
	defer buf.Close()

	// Initialize sender
	snd, err := sender.New(cfg.Server, cfg.Agent, buf)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error initializing sender: %v\n", err)
		os.Exit(1)
	}

	// Start sender
	go snd.Start(ctx)

	// Initialize collectors
	collectors := collector.Initialize(cfg.Collectors, snd)
	fmt.Printf("   Collectors: %d active\n", len(collectors))

	// Start collectors
	for _, c := range collectors {
		go c.Start(ctx)
	}

	fmt.Println("✓ Agent is running. Press Ctrl+C to stop.")

	// Wait for shutdown signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	<-sigChan
	fmt.Println("\n🛑 Shutting down gracefully...")

	// Cancel context to stop all goroutines
	cancel()

	// Give components time to cleanup
	time.Sleep(2 * time.Second)

	fmt.Println("✓ Agent stopped.")
}

func printBanner() {
	banner := `
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║     ██╗      ██████╗  ██████╗  ██████╗██╗  ██╗ █████╗ ████████╗   ║
║     ██║     ██╔═══██╗██╔════╝ ██╔════╝██║  ██║██╔══██╗╚══██╔══╝   ║
║     ██║     ██║   ██║██║  ███╗██║     ███████║███████║   ██║      ║
║     ██║     ██║   ██║██║   ██║██║     ██╔══██║██╔══██║   ██║      ║
║     ███████╗╚██████╔╝╚██████╔╝╚██████╗██║  ██║██║  ██║   ██║      ║
║     ╚══════╝ ╚═════╝  ╚═════╝  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝      ║
║                                                              ║
║                    Log Collection Agent                      ║
╚══════════════════════════════════════════════════════════════╝
`
	fmt.Println(banner)
}

func printVersion() {
	fmt.Printf("LogChat Agent v%s\n", Version)
	fmt.Printf("  Build Time: %s\n", BuildTime)
	fmt.Printf("  Git Commit: %s\n", GitCommit)
	fmt.Printf("  Go Version: %s\n", runtime.Version())
	fmt.Printf("  OS/Arch:    %s/%s\n", runtime.GOOS, runtime.GOARCH)
}
