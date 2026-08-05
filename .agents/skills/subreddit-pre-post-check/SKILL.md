---
name: "subreddit-pre-post-check"
title: "Subreddit pre-post check"
description: "Use this skill immediately before posting anything to a subreddit — \"check if we can post this to r/X,\" \"will this get removed,\" \"is this link already on Reddit.\" Runs the four checks that prevent removals and bans: rules, community type, duplicate-URL, and wiki posting norms. Cheap insurance against the most expensive Reddit mistake."
category: Reddit
---

Use before any post or link share on Reddit. Produces a go / no-go verdict with the specific rule at issue. Exact commands live in `references/commands.md`.

## The four checks — in order, every time

1. **rules** — read the subreddit's rules in full. Rule violations get posts removed instantly, and repeat removals flag the account
2. **community type** — restricted or private means stop; only approved members can post
3. **duplicate URL** — check the link hasn't been submitted there before. Duplicate posts get accounts banned
4. **wiki** — read the community wiki's index page; many subreddits keep their real posting norms there (flair requirements, self-promo windows, karma minimums)

Then verdict: **go** (with any constraints — required flair, allowed thread type, timing window) or **no-go** (with the exact rule that blocks it and an alternative if one exists — a weekly promo thread, a comment instead of a post).

## What good looks like

A great check quotes the specific rule text that governs the post and adapts the plan to it — "self-promotion allowed only in the Saturday thread, so hold until Saturday" — rather than a generic green light. What gets overlooked: karma and account-age minimums buried in wikis, and per-flair rules that differ from the sidebar. When the verdict is borderline, the answer is no — a removed post costs more than a skipped one.

MUST run all four checks before any post; skipping any one voids the verdict. NEVER greenlight a post to a restricted or private community. NEVER re-submit a URL that already exists in that subreddit.
