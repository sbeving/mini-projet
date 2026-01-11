//go:build linux
// +build linux

package collector

import (
	"logchat/agent/internal/config"
	"logchat/agent/internal/sender"
)

func init() {
	// Register Linux-specific collector initializer
}

// Initialize creates collectors based on configuration (Linux version)
func Initialize(cfg config.CollectorsConfig, snd *sender.Sender) []Collector {
	var collectors []Collector

	// File collectors
	for _, fileCfg := range cfg.Files {
		if fileCfg.Enabled {
			collectors = append(collectors, NewFileCollector(fileCfg, snd))
		}
	}

	// Command collectors
	for _, cmdCfg := range cfg.Command {
		if cmdCfg.Enabled {
			collectors = append(collectors, NewCommandCollector(cmdCfg, snd))
		}
	}

	// Add Linux-specific collectors
	linuxCollectors := InitializeLinux(cfg, snd)
	collectors = append(collectors, linuxCollectors...)

	return collectors
}
