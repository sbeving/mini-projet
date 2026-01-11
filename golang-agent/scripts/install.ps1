<# 
.SYNOPSIS
    LogChat Agent Installation Script for Windows

.DESCRIPTION
    Installs the LogChat Agent as a Windows service

.EXAMPLE
    # Run as Administrator
    .\install.ps1
    
    # Or from web:
    iex (irm 'https://raw.githubusercontent.com/logchat/agent/main/scripts/install.ps1')
#>

param(
    [string]$Version = "latest",
    [string]$InstallDir = "$env:ProgramFiles\LogChat",
    [string]$ConfigDir = "$env:ProgramData\LogChat",
    [switch]$NoService,
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

# Configuration
$ServiceName = "LogChatAgent"
$DisplayName = "LogChat Log Collection Agent"
$BinaryName = "logchat-agent.exe"
$Repo = "logchat/agent"

# Colors
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Info { Write-ColorOutput Cyan $args }
function Write-Success { Write-ColorOutput Green $args }
function Write-Warning { Write-ColorOutput Yellow $args }
function Write-Error { Write-ColorOutput Red $args }

# Check if running as Administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Detect architecture
function Get-Architecture {
    if ([Environment]::Is64BitOperatingSystem) {
        return "amd64"
    } else {
        return "386"
    }
}

# Download agent
function Install-Agent {
    Write-Info "Downloading LogChat Agent..."
    
    $arch = Get-Architecture
    $platform = "windows-$arch"
    
    # Create directories
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
    
    # Get latest version if not specified
    if ($Version -eq "latest") {
        try {
            $release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest"
            $Version = $release.tag_name
        } catch {
            $Version = "v1.0.0"
        }
    }
    
    Write-Info "Installing version: $Version"
    
    $downloadUrl = "https://github.com/$Repo/releases/download/$Version/logchat-agent-$platform.zip"
    $zipPath = "$env:TEMP\logchat-agent.zip"
    
    try {
        # Download
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing
        
        # Extract
        Expand-Archive -Path $zipPath -DestinationPath $env:TEMP\logchat -Force
        
        # Move binary
        Move-Item -Path "$env:TEMP\logchat\logchat-agent-$platform.exe" -Destination "$InstallDir\$BinaryName" -Force
        
        # Cleanup
        Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue
        Remove-Item -Path "$env:TEMP\logchat" -Recurse -Force -ErrorAction SilentlyContinue
        
    } catch {
        Write-Warning "Could not download from GitHub. Building from source..."
        Build-FromSource
    }
    
    Write-Success "Binary installed to $InstallDir\$BinaryName"
}

# Build from source
function Build-FromSource {
    # Check if Go is installed
    $goPath = Get-Command go -ErrorAction SilentlyContinue
    if (-not $goPath) {
        Write-Error "Go is not installed. Please install Go 1.21+ and try again."
        exit 1
    }
    
    Write-Info "Building from source..."
    
    $tempDir = "$env:TEMP\logchat-build"
    New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
    
    Push-Location $tempDir
    try {
        git clone --depth 1 "https://github.com/$Repo.git" .
        go build -ldflags="-s -w" -o "$InstallDir\$BinaryName" ./cmd/agent
    } finally {
        Pop-Location
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    Write-Success "Built and installed from source"
}

# Create configuration
function New-Configuration {
    Write-Info "Creating configuration..."
    
    $configPath = "$ConfigDir\agent.yaml"
    
    if (-not (Test-Path $configPath)) {
        # Generate sample config
        Push-Location $InstallDir
        & ".\$BinaryName" --generate-config
        Move-Item -Path "logchat-agent.yaml" -Destination $configPath -Force
        Pop-Location
        
        Write-Success "Configuration created at $configPath"
    } else {
        Write-Warning "Configuration already exists at $configPath"
    }
}

# Install Windows service
function Install-Service {
    Write-Info "Installing Windows service..."
    
    # Stop existing service if running
    $existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($existingService) {
        if ($existingService.Status -eq "Running") {
            Stop-Service -Name $ServiceName
        }
        sc.exe delete $ServiceName | Out-Null
        Start-Sleep -Seconds 2
    }
    
    # Create service
    $binPath = "`"$InstallDir\$BinaryName`" -config `"$ConfigDir\agent.yaml`""
    
    New-Service -Name $ServiceName `
                -DisplayName $DisplayName `
                -Description "Collects and forwards logs to LogChat server" `
                -BinaryPathName $binPath `
                -StartupType Automatic
    
    # Set recovery options
    sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/10000/restart/60000 | Out-Null
    
    Write-Success "Windows service installed"
    Write-Info "To start the service: Start-Service $ServiceName"
    Write-Info "To enable auto-start: Set-Service $ServiceName -StartupType Automatic"
}

# Uninstall agent
function Uninstall-Agent {
    Write-Info "Uninstalling LogChat Agent..."
    
    # Stop and remove service
    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($service) {
        if ($service.Status -eq "Running") {
            Stop-Service -Name $ServiceName
        }
        sc.exe delete $ServiceName | Out-Null
        Write-Success "Service removed"
    }
    
    # Remove files
    if (Test-Path $InstallDir) {
        Remove-Item -Path $InstallDir -Recurse -Force
        Write-Success "Removed $InstallDir"
    }
    
    Write-Warning "Configuration at $ConfigDir has been preserved"
    Write-Success "Uninstallation complete"
}

# Print completion
function Show-Completion {
    Write-Host ""
    Write-Success "╔════════════════════════════════════════════════════════════╗"
    Write-Success "║                                                            ║"
    Write-Success "║       LogChat Agent Installation Complete! 🎉             ║"
    Write-Success "║                                                            ║"
    Write-Success "╚════════════════════════════════════════════════════════════╝"
    Write-Host ""
    Write-Info "Next steps:"
    Write-Host ""
    Write-Host "1. Edit the configuration file:"
    Write-Warning "   notepad $ConfigDir\agent.yaml"
    Write-Host ""
    Write-Host "2. Set your LogChat server URL and API key"
    Write-Host ""
    Write-Host "3. Start the service:"
    Write-Warning "   Start-Service $ServiceName"
    Write-Host ""
    Write-Host "4. Check status:"
    Write-Warning "   Get-Service $ServiceName"
    Write-Warning "   Get-EventLog -LogName Application -Source $ServiceName -Newest 10"
    Write-Host ""
    Write-Host "For help:"
    Write-Warning "   & `"$InstallDir\$BinaryName`" --help"
    Write-Host ""
}

# Main
function Main {
    Write-Host ""
    Write-Success "╔════════════════════════════════════════════════════════════╗"
    Write-Success "║                                                            ║"
    Write-Success "║           LogChat Agent Installer for Windows              ║"
    Write-Success "║                                                            ║"
    Write-Success "╚════════════════════════════════════════════════════════════╝"
    Write-Host ""
    
    # Check admin rights
    if (-not (Test-Administrator)) {
        Write-Error "This script must be run as Administrator"
        Write-Info "Right-click PowerShell and select 'Run as Administrator'"
        exit 1
    }
    
    if ($Uninstall) {
        Uninstall-Agent
        return
    }
    
    Install-Agent
    New-Configuration
    
    if (-not $NoService) {
        Install-Service
    }
    
    Show-Completion
}

# Run
Main
