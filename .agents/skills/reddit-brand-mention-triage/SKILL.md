---
name: "reddit-brand-mention-triage"
title: "Reddit brand-mention triage"
description: "Use this skill when the user wants to monitor or work through brand mentions on Reddit — \"anyone talking about us on Reddit,\" \"triage the mention queue,\" \"what's the sentiment on our brand this week.\" Sets up domain monitoring, then runs the triage loop: read each mention in its full thread context, classify reply / ignore / escalate, and keep the queue at zero."
category: Reddit
---

Use when Reddit brand mentions need monitoring or the mention queue needs working through. Produces a triaged queue with per-mention verdicts and a sentiment picture. Exact commands live in `references/commands.md`.

## Set up monitoring (once per brand)

Add each domain worth watching — the product, and optionally competitors — with a brand description, search keywords, and negative keywords to cut false positives. Tune negative keywords early: a noisy monitor gets ignored within a week, and an ignored monitor is worse than none.

## The triage loop

1. list new mentions — filter by domain, sentiment, or intent when the queue is long; take 20 at a time
2. for each: read the full mention **and the live Reddit thread** — the excerpt routinely misreads tone, and the thread shows whether the community already answered
3. verdict per mention: **reply** (a genuine question or fixable complaint), **ignore** (drive-by noise), or **escalate** (churn risk, security claim, thread gaining velocity). One line each: sentiment, key point, verdict
4. mark reviewed mentions handled so the queue stays clean
5. close with the stats view: mention volume and sentiment trend over the period

Replies belong to a human or an approval-gated draft — never auto-post into a live thread.

## What good looks like

Great triage catches the two mentions that matter — the churn-risk complaint and the high-intent "what should I use for X" thread — within hours, with thread context read before any verdict. Mediocre triage skims excerpts and marks everything handled. What gets overlooked: negative mentions in threads that are still gaining comments (velocity changes the verdict), and competitor-comparison threads, which are the highest-value reply targets on Reddit.

MUST read the live thread before classifying any mention. MUST keep replies human-approved. NEVER mark a mention handled without a recorded verdict.
