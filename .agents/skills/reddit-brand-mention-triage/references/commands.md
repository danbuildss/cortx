---
title: Commands
description: Commands
---

Requires the ReddGrow CLI: `npm install -g @reddgrow/cli`, then `reddgrow auth login rg_your_api_key_here`. Use `--mode agent` for clean JSON. Alias: `bm` → `brand-monitor`.

## Domains

```bash
reddgrow brand-monitor domains add --domain <s> [--label <s>] [--primary] [--brand-description <s>] [--search-keywords <s...>] [--negative-keywords <s...>]
reddgrow brand-monitor domains list | get <id> | update <id> | remove <id>
```

## Mentions

```bash
reddgrow brand-monitor mentions list [--domain <id>] [--subreddit <name>] [--sentiment positive|neutral|negative|mixed] [--status new|read|handled|ignored] [--intent <csv>] [--red-flags <csv>] [--from <ISO>] [--to <ISO>] [--limit N]
reddgrow brand-monitor mentions get <id>
reddgrow brand-monitor mentions update <id> [--status <s>] [--sentiment <s>]
```

## Thread context + stats

```bash
reddgrow reddit posts comments <subreddit> <post_id> [--limit N]
reddgrow brand-monitor stats [--domain <id>] [--days N]
```

## /reddgrow-monitor slash command

`reddgrow commands install` ships `/reddgrow-monitor [domain-id]`: lists new mentions, reads each with its thread, summarizes sentiment + suggested action, marks them handled, and reports totals with anything flagged for escalation.
