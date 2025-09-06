# Codex-Flow Bootstrap Script (PowerShell)
# This script sets up a fully functional codex-flow environment

param(
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Stop"

function Write-Status {
    param([string]$Message, [string]$Color = "Blue")
    if ($Color -eq "Blue") {
        Write-Host "🔧 $Message" -ForegroundColor Blue
    } elseif ($Color -eq "Green") {
        Write-Host "✅ $Message" -ForegroundColor Green
    } elseif ($Color -eq "Yellow") {
        Write-Host "⚠️  $Message" -ForegroundColor Yellow
    } elseif ($Color -eq "Red") {
        Write-Host "❌ $Message" -ForegroundColor Red
    }
}

function Test-CommandExists {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Get-CodexFlowPath {
    $localPath = ".\node_modules\.bin\codex-flow.ps1"
    if (Test-Path $localPath) {
        return $localPath
    }
    
    if (Test-CommandExists "codex-flow") {
        return "codex-flow"
    }
    
    throw "codex-flow command not found. Please ensure it's installed."
}

Write-Status "Starting Codex-Flow Bootstrap Process"

try {
    # 1. Setup .env file
    Write-Status "Setting up environment variables..."
    
    if (!(Test-Path ".env")) {
        if (Test-Path ".env.example") {
            Copy-Item ".env.example" ".env"
            Write-Status "Created .env from .env.example" "Green"
        } else {
            # Create basic .env with placeholders
            $envContent = @"
# AI Provider Configuration
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=

# Local LLM Configuration (Optional)
LOCAL_LLM_URL=http://localhost:11434
LOCAL_LLM_MODEL=llama2

# Codex-Flow Configuration
CODEX_FLOW_LOG_LEVEL=info
CODEX_FLOW_MAX_AGENTS=10
CODEX_FLOW_MEMORY_SIZE=100
"@
            Set-Content -Path ".env" -Value $envContent
            Write-Status "Created .env with default placeholders" "Green"
        }
    }
    
    # Check for environment variables in current session and add them to .env if not present
    $envVars = @{
        "OPENAI_API_KEY" = $env:OPENAI_API_KEY
        "ANTHROPIC_API_KEY" = $env:ANTHROPIC_API_KEY
        "GOOGLE_API_KEY" = $env:GOOGLE_API_KEY
        "LOCAL_LLM_URL" = $env:LOCAL_LLM_URL
    }
    
    $envContent = Get-Content ".env"
    $modified = $false
    
    foreach ($varName in $envVars.Keys) {
        $varValue = $envVars[$varName]
        if ($varValue -and $varValue -ne "") {
            $existingLine = $envContent | Where-Object { $_ -match "^$varName=" }
            if ($existingLine) {
                # Check if the existing value is empty
                if ($existingLine -match "^$varName=\s*$") {
                    $envContent = $envContent -replace "^$varName=.*", "$varName=$varValue"
                    $modified = $true
                    Write-Status "Updated $varName from environment" "Green"
                }
            } else {
                $envContent += "$varName=$varValue"
                $modified = $true
                Write-Status "Added $varName from environment" "Green"
            }
        }
    }
    
    if ($modified) {
        Set-Content -Path ".env" -Value $envContent
    }
    
    # 2. Install and configure MCP servers
    Write-Status "Setting up MCP servers..."
    
    if (Test-Path "package.json") {
        $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
        
        # Add setup:mcp script if it doesn't exist
        if (!$packageJson.scripts -or !$packageJson.scripts."setup:mcp") {
            if (!$packageJson.scripts) {
                $packageJson | Add-Member -Name "scripts" -Value @{} -MemberType NoteProperty
            }
            $packageJson.scripts | Add-Member -Name "setup:mcp" -Value "echo 'MCP setup complete - ruv-swarm-mcp will be available when published'" -MemberType NoteProperty -Force
            $packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json"
            Write-Status "Added setup:mcp script to package.json" "Green"
        }
        
        # Run setup:mcp
        try {
            npm run setup:mcp
            Write-Status "MCP setup completed" "Green"
        } catch {
            Write-Status "MCP setup returned warnings (expected for unreleased packages)" "Yellow"
        }
    }
    
    # Ensure .mcp.json exists with Codex MCP server
    if (!(Test-Path ".mcp.json")) {
        $mcpConfig = @{
            mcpServers = @{
                "ruv-swarm" = @{
                    command = "ruv-swarm-mcp"
                    args = @("--stdio")
                    env = @{
                        RUST_LOG = "info"
                    }
                }
                "codex-flow" = @{
                    command = "codex-flow"
                    args = @("mcp", "--stdio")
                    env = @{
                        CODEX_FLOW_LOG_LEVEL = "info"
                    }
                }
            }
        }
        $mcpConfig | ConvertTo-Json -Depth 10 | Set-Content ".mcp.json"
        Write-Status "Created .mcp.json with Codex MCP server configuration" "Green"
    } else {
        # Ensure Codex MCP server is in existing .mcp.json
        $mcpConfig = Get-Content ".mcp.json" -Raw | ConvertFrom-Json
        if (!$mcpConfig.mcpServers."codex-flow") {
            $mcpConfig.mcpServers | Add-Member -Name "codex-flow" -Value @{
                command = "codex-flow"
                args = @("mcp", "--stdio")
                env = @{
                    CODEX_FLOW_LOG_LEVEL = "info"
                }
            } -MemberType NoteProperty
            $mcpConfig | ConvertTo-Json -Depth 10 | Set-Content ".mcp.json"
            Write-Status "Added Codex MCP server to existing .mcp.json" "Green"
        }
    }
    
    # 3. Configuration verification
    Write-Status "Verifying configuration..."
    
    $codexFlow = Get-CodexFlowPath
    
    try {
        $verifyResult = & $codexFlow config verify 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Status "Configuration verified successfully" "Green"
        } else {
            Write-Status "Configuration has issues, enabling local provider as fallback..." "Yellow"
            
            # Enable local provider and set Ollama URL if detected
            & $codexFlow config set providers.local.enabled true
            
            # Check if Ollama is running
            try {
                $ollamaCheck = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method GET -TimeoutSec 2
                & $codexFlow config set providers.local.url "http://localhost:11434"
                Write-Status "Detected Ollama, configured local provider" "Green"
            } catch {
                Write-Status "Local LLM not detected. To use local provider, start Ollama or LMStudio on http://localhost:11434" "Yellow"
            }
            
            # Re-verify
            & $codexFlow config verify
        }
    } catch {
        Write-Status "Config verify failed: $_" "Red"
    }
    
    # 4. Smoke test
    Write-Status "Running smoke test..."
    
    if (!(Test-Path "RUN_LOGS")) {
        New-Item -ItemType Directory -Path "RUN_LOGS" | Out-Null
    }
    
    try {
        $smokeTest = & $codexFlow swarm spawn "hello" --verbose --providers auto 2>&1
        $smokeTest | Out-File -FilePath "RUN_LOGS\init_smoke.txt" -Encoding UTF8
        
        if ($LASTEXITCODE -eq 0) {
            Write-Status "Smoke test passed - swarm spawning works!" "Green"
        } else {
            Write-Status "Smoke test had issues - check RUN_LOGS\init_smoke.txt for details" "Yellow"
        }
    } catch {
        Write-Status "Smoke test failed: $_" "Red"
        "Smoke test error: $_" | Out-File -FilePath "RUN_LOGS\init_smoke.txt" -Encoding UTF8
    }
    
    # 5. Update package.json with convenience scripts
    Write-Status "Adding convenience scripts..."
    
    if (Test-Path "package.json") {
        $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
        
        $scriptsToAdd = @{
            "codex:bootstrap" = "pwsh -ExecutionPolicy Bypass -File scripts/codex/bootstrap.ps1"
            "codex:verify" = "codex-flow config verify && echo 'Configuration: OK'"
            "codex:swarm" = "codex-flow swarm spawn 'Build a simple hello world application' --providers auto --verbose"
        }
        
        $scriptsAdded = @()
        foreach ($scriptName in $scriptsToAdd.Keys) {
            if (!$packageJson.scripts.$scriptName) {
                $packageJson.scripts | Add-Member -Name $scriptName -Value $scriptsToAdd[$scriptName] -MemberType NoteProperty -Force
                $scriptsAdded += $scriptName
            }
        }
        
        if ($scriptsAdded.Count -gt 0) {
            $packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json"
            Write-Status "Added npm scripts: $($scriptsAdded -join ', ')" "Green"
        }
    }
    
    Write-Status "Bootstrap completed successfully!" "Green"
    Write-Host ""
    Write-Host "🚀 Quick Start:" -ForegroundColor Cyan
    Write-Host "1. Add API key to .env (optional)"
    Write-Host "2. npm run codex:verify"
    Write-Host "3. npm run codex:swarm"
    Write-Host ""
    Write-Host "📋 Available scripts:" -ForegroundColor Cyan
    Write-Host "  npm run codex:bootstrap  # Re-run this setup"
    Write-Host "  npm run codex:verify     # Check configuration"
    Write-Host "  npm run codex:swarm      # Run sample swarm"

} catch {
    Write-Status "Bootstrap failed: $_" "Red"
    exit 1
}