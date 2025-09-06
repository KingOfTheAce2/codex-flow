#!/bin/bash
# Basic Codex-Flow Bootstrap Script (Bash)

echo -e "\033[34m🔧 Starting basic bootstrap...\033[0m"

# Create .env if it doesn't exist
if [[ ! -f ".env" ]]; then
    if [[ -f ".env.example" ]]; then
        cp ".env.example" ".env"
        echo -e "\033[32m✅ Created .env from .env.example\033[0m"
    fi
fi

# Run config verify
if codex-flow config verify 2>/dev/null; then
    echo -e "\033[32m✅ Configuration verified\033[0m"
else
    echo -e "\033[33m⚠️  Configuration needs attention\033[0m"
fi

echo -e "\033[32m✅ Basic bootstrap completed!\033[0m"
echo -e "\033[36mAdd API keys to .env file and run 'codex-flow config verify'\033[0m"
