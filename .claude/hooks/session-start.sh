#!/bin/bash
set -euo pipefail

# Run in background so it doesn't delay session start
echo '{"async": true, "asyncTimeout": 300000}'

# Only run in remote/cloud environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Auto-install gstack if missing
if [ ! -d "$HOME/.claude/skills/gstack/bin" ]; then
  git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git "$HOME/.claude/skills/gstack" 2>&1
  cd "$HOME/.claude/skills/gstack" && ./setup --team 2>&1
fi
