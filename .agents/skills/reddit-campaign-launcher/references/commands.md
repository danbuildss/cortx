---
title: Commands
description: Commands
---

Requires the ReddGrow CLI: `npm install -g @reddgrow/cli`, then `reddgrow auth login rg_your_api_key_here` (key from `app.reddgrow.ai/settings/api`). Use `--mode agent` for clean JSON. Verify with `reddgrow auth whoami`.

## Campaigns

```bash
reddgrow campaigns list [--limit N] [--offset N]
reddgrow campaigns get <id>
reddgrow campaigns create --name <s> --url <s> [--mention-as <s>] [--description <s>] [--use-cases <s...>] [--talking-points <s...>]
reddgrow campaigns update <id> [same flags]
reddgrow campaigns delete <id>
```

## Tracked subreddits

```bash
reddgrow subreddits quick-add <name> [--campaign <id>]   # accepts r/foo or foo
reddgrow subreddits list | get <id> | toggle <id> [--active|--no-active] | delete <id>
reddgrow subreddits create --name <s> [--tier N] [--category <s>] [--campaign <id>] [--keywords <s...>]
```

## Advocates

```bash
reddgrow advocates create --name <s> --role user|employee --tone <s> [--campaign-id <id>] [--daily-drafts N] [--employee-position <s>] [--custom-instructions <s>]
reddgrow advocates list | get <id> | update <id> | delete <id>
```

## Drafts

```bash
reddgrow drafts list [--status pending|approved|posted|skipped] [--type promotional|warmup|moderator|brand_monitor|aeo_citation|reply] [--campaign <id>] [--advocate <id>] [--sort-by relevance_score]
reddgrow drafts get <id>
reddgrow drafts approve <id>
reddgrow drafts skip <id>
reddgrow stats dashboard    # draft pipeline counts by status
reddgrow stats posting [--timezone <tz>]
```

All create/update commands accept `--json '{...}'` or `--json-file path.json` (merges over flags).

## /reddgrow-campaign slash command

`reddgrow commands install` ships `/reddgrow-campaign <product-name> <url>`: creates the campaign, searches subreddits and asks the user which of the top 5 to add, quick-adds them, creates a default advocate (3 drafts/day), and reports pending drafts.
