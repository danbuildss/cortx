---
title: Commands
description: Commands
---

Requires the ReddGrow CLI: `npm install -g @reddgrow/cli`, then `reddgrow auth login rg_your_api_key_here`. Use `--mode agent` for clean JSON.

```bash
# 1. Rules
reddgrow reddit subreddits rules <name>

# 2. Community type — stop if subreddit_type is restricted or private
reddgrow reddit subreddits about <name>

# 3. Duplicate URL
reddgrow reddit subreddits check-url <name> "<url>"

# 4. Wiki posting norms
reddgrow reddit subreddits wiki-page <name> index
```

Related: `reddgrow reddit posts duplicates <subreddit> <post_id>` finds crossposts/duplicates of an existing post.
