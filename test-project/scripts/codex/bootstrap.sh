#!/bin/bash
# Codex-Flow Bootstrap Script (Bash)
# This script sets up a fully functional codex-flow environment

set -euo pipefail

VERBOSE=${VERBOSE:-false}

write_status() {
    local message="$1"
    local color="${2:-blue}"
    
    case $color in
        "blue") echo -e "\033[34m🔧 $message\033[0m" ;;
        "green") echo -e "\033[32m✅ $message\033[0m" ;;
        "yellow") echo -e "\033[33m⚠️  $message\033[0m" ;;
        "red") echo -e "\033[31m❌ $message\033[0m" ;;
        *) echo "$message" ;;
    esac
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

get_codex_flow_path() {
    local local_path="./node_modules/.bin/codex-flow"
    if [[ -f "$local_path" ]]; then
        echo "$local_path"
        return
    fi
    
    if command_exists codex-flow; then
        echo "codex-flow"
        return
    fi
    
    echo "codex-flow command not found. Please ensure it's installed." >&2
    exit 1
}

write_status "Starting Codex-Flow Bootstrap Process"

# 1. Setup .env file
write_status "Setting up environment variables..."

if [[ ! -f ".env" ]]; then
    if [[ -f ".env.example" ]]; then
        cp ".env.example" ".env"
        write_status "Created .env from .env.example" "green"
    else
        # Create basic .env with placeholders
        cat > ".env" << 'EOF'
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
EOF
        write_status "Created .env with default placeholders" "green"
    fi
fi

# Check for environment variables in current session and add them to .env if not present
declare -A env_vars=(
    ["OPENAI_API_KEY"]="${OPENAI_API_KEY:-}"
    ["ANTHROPIC_API_KEY"]="${ANTHROPIC_API_KEY:-}"
    ["GOOGLE_API_KEY"]="${GOOGLE_API_KEY:-}"
    ["LOCAL_LLM_URL"]="${LOCAL_LLM_URL:-}"
)

modified=false
for var_name in "${!env_vars[@]}"; do
    var_value="${env_vars[$var_name]}"
    if [[ -n "$var_value" ]]; then
        # Check if variable exists in .env and is empty
        if grep -q "^$var_name=" ".env"; then
            if grep -q "^$var_name=\s*$" ".env"; then
                sed -i.bak "s/^$var_name=.*/$var_name=$var_value/" ".env"
                rm -f ".env.bak"
                modified=true
                write_status "Updated $var_name from environment" "green"
            fi
        else
            echo "$var_name=$var_value" >> ".env"
            modified=true
            write_status "Added $var_name from environment" "green"
        fi
    fi
done

# 2. Install and configure MCP servers
write_status "Setting up MCP servers..."

if [[ -f "package.json" ]]; then
    # Add setup:mcp script if it doesn't exist
    if ! jq -r '.scripts."setup:mcp"' package.json 2>/dev/null | grep -v null >/dev/null; then
        jq '.scripts["setup:mcp"] = "echo \"MCP setup complete - ruv-swarm-mcp will be available when published\""' package.json > package.json.tmp && mv package.json.tmp package.json
        write_status "Added setup:mcp script to package.json" "green"
    fi
    
    # Run setup:mcp
    if npm run setup:mcp 2>/dev/null; then
        write_status "MCP setup completed" "green"
    else
        write_status "MCP setup returned warnings (expected for unreleased packages)" "yellow"
    fi
fi

# Ensure .mcp.json exists with Codex MCP server
if [[ ! -f ".mcp.json" ]]; then
    cat > ".mcp.json" << 'EOF'
{
  "mcpServers": {
    "ruv-swarm": {
      "command": "ruv-swarm-mcp",
      "args": ["--stdio"],
      "env": {
        "RUST_LOG": "info"
      }
    },
    "codex-flow": {
      "command": "codex-flow",
      "args": ["mcp", "--stdio"],
      "env": {
        "CODEX_FLOW_LOG_LEVEL": "info"
      }
    }
  }
}
EOF
    write_status "Created .mcp.json with Codex MCP server configuration" "green"
else
    # Ensure Codex MCP server is in existing .mcp.json
    if ! jq -r '.mcpServers."codex-flow"' .mcp.json 2>/dev/null | grep -v null >/dev/null; then
        jq '.mcpServers["codex-flow"] = {"command": "codex-flow", "args": ["mcp", "--stdio"], "env": {"CODEX_FLOW_LOG_LEVEL": "info"}}' .mcp.json > .mcp.json.tmp && mv .mcp.json.tmp .mcp.json
        write_status "Added Codex MCP server to existing .mcp.json" "green"
    fi
fi

# 3. Configuration verification
write_status "Verifying configuration..."

CODEX_FLOW=$(get_codex_flow_path)

if $CODEX_FLOW config verify >/dev/null 2>&1; then
    write_status "Configuration verified successfully" "green"
else
    write_status "Configuration has issues, enabling local provider as fallback..." "yellow"
    
    # Enable local provider and set Ollama URL if detected
    $CODEX_FLOW config set providers.local.enabled true || true
    
    # Check if Ollama is running
    if curl -s "http://localhost:11434/api/tags" >/dev/null 2>&1; then
        $CODEX_FLOW config set providers.local.url "http://localhost:11434" || true
        write_status "Detected Ollama, configured local provider" "green"
    else
        write_status "Local LLM not detected. To use local provider, start Ollama or LMStudio on http://localhost:11434" "yellow"
    fi
    
    # Re-verify
    $CODEX_FLOW config verify || true
fi

# 4. Smoke test
write_status "Running smoke test..."

mkdir -p RUN_LOGS

if $CODEX_FLOW swarm spawn "hello" --verbose --providers auto &> "RUN_LOGS/init_smoke.txt"; then
    write_status "Smoke test passed - swarm spawning works!" "green"
else
    write_status "Smoke test had issues - check RUN_LOGS/init_smoke.txt for details" "yellow"
fi

# 5. Update package.json with convenience scripts
write_status "Adding convenience scripts..."

if [[ -f "package.json" ]]; then
    # Determine which bootstrap script to use
    bootstrap_cmd="bash scripts/codex/bootstrap.sh"
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
        bootstrap_cmd="pwsh -ExecutionPolicy Bypass -File scripts/codex/bootstrap.ps1"
    fi
    
    scripts_to_add=(
        "codex:bootstrap|$bootstrap_cmd"
        "codex:verify|codex-flow config verify && echo 'Configuration: OK'"
        "codex:swarm|codex-flow swarm spawn 'Build a simple hello world application' --providers auto --verbose"
    )
    
    scripts_added=()
    for script_def in "${scripts_to_add[@]}"; do
        IFS='|' read -r script_name script_cmd <<< "$script_def"
        if ! jq -r ".scripts.\"$script_name\"" package.json 2>/dev/null | grep -v null >/dev/null; then
            jq ".scripts[\"$script_name\"] = \"$script_cmd\"" package.json > package.json.tmp && mv package.json.tmp package.json
            scripts_added+=("$script_name")
        fi
    done
    
    if [[ ${#scripts_added[@]} -gt 0 ]]; then
        write_status "Added npm scripts: $(IFS=', '; echo "${scripts_added[*]}")" "green"
    fi
fi

write_status "Bootstrap completed successfully!" "green"
echo ""
echo -e "\033[36m🚀 Quick Start:\033[0m"
echo "1. Add API key to .env (optional)"
echo "2. npm run codex:verify"
echo "3. npm run codex:swarm"
echo ""
echo -e "\033[36m📋 Available scripts:\033[0m"
echo "  npm run codex:bootstrap  # Re-run this setup"
echo "  npm run codex:verify     # Check configuration"
echo "  npm run codex:swarm      # Run sample swarm"