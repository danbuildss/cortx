---
title: Commands
description: Commands
---

Requires the ReddGrow CLI: `npm install -g @reddgrow/cli`, then `reddgrow auth login rg_your_api_key_here`. Use `--mode agent` for clean JSON. These are read-only live-Reddit commands (`reddgrow reddit …`), distinct from the org's tracked-subreddit CRUD (`reddgrow subreddits …`).

```bash
# Discovery
reddgrow reddit subreddits search "<query>"

# Vetting a community
reddgrow reddit subreddits about <name>          # size, subreddit_type (restricted/private → stop)
reddgrow reddit subreddits rules <name>
reddgrow reddit subreddits wiki <name>
reddgrow reddit subreddits wiki-page <name> <page>
reddgrow reddit subreddits posts <name> [--sort hot|new|top|rising|controversial] [--time hour|day|week|month|year|all] [--limit N]
reddgrow reddit subreddits comments <name> [--limit N]
reddgrow reddit subreddits traffic <name>

# Content research
reddgrow reddit posts search "<query>" [--limit N]
reddgrow reddit posts comments <subreddit> <post_id> [--limit N]
reddgrow reddit users profile <username>
reddgrow reddit users posts <username> [--limit N]

# Add a winner to campaign tracking
reddgrow subreddits quick-add <name> --campaign <campaign-id>
```
