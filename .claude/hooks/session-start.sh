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

# Auto-install curated GTM skills if missing
if [ ! -d "$CLAUDE_PROJECT_DIR/.agents/skills/gtm-planning" ]; then
  cd "$CLAUDE_PROJECT_DIR"
  npx skills add swan-gtm/gtm-skills \
    --skill gtm-planning \
    --skill gtm-plays-11 \
    --skill gtm-philosophy \
    --skill positioning-and-story \
    --skill category-of-one-positioning \
    --skill icp-builder \
    --skill tam-builder \
    --skill buying-signals-6 \
    --skill research \
    --skill data-enrichment \
    --skill signal-interpreter \
    --skill cold-email-strategist \
    --skill cold-email-first-touch \
    --skill cold-email-4-sequence \
    --skill b2b-cold-email-copywriting \
    --skill cold-email-preflight \
    --skill atl-btl-messaging \
    --skill cold-call-scripts \
    --skill reach-out \
    --skill handle-reply \
    --skill personalization-hooks \
    --skill outbound-strategy \
    --skill pipeline-review \
    --skill founder-led-sales \
    --skill objection-mining \
    --skill multi-thread-deals 2>&1
fi
