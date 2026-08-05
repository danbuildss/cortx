---
name: "reddit-account-health"
title: Reddit account health
description: "Use this skill when a posting account needs monitoring or something went wrong — \"are any of our accounts banned,\" \"our comment disappeared,\" \"the account got suspended, now what.\" Reads moderation signals correctly (ban vs removal vs rule note), gates posting on confirmed signals, and runs the recovery path for temporary bans, permanent bans, and site-wide suspensions."
category: Reddit
---

Use for ongoing account monitoring and incident response. Produces a per-account health readout and the right next action per signal. The core discipline: classify the signal correctly before reacting — most overreactions come from treating a removal like a ban.

## Read the signals

Scan the account's inbox and modmail daily and classify every moderation message:

- **banned** — an explicit subreddit ban. Stop posting there: temporary bans auto-expire on their date; permanent bans lift only if the subreddit's moderators remove them
- **comment removed** — a removal is NOT a ban. Note it, learn the rule it broke, keep the subreddit in rotation
- **rule note** — a mod explaining a rule with no action taken. Free coaching; feed it back into the content plan

Only confirmed signals should gate posting — suspected ones get watched, not acted on.

## Membership and pre-flight

Track which communities the account has actually joined, and verify membership before every posting attempt — posting into a community the account never joined is both a failure mode and a spam signal.

## Site-wide suspension: the circuit breaker

A suspension pauses **all** automation on that account for an extended cool-off (30 days). Don't try to work around it — activity during or immediately after suspension review is what converts temporary suspensions into permanent ones. When the account recovers, automation resumes; a brief posting hold after any fresh ban signal is healthy.

## What good looks like

A healthy operation knows the standing of every account in every community it touches, and its incident log shows proportionate responses — removals answered with content fixes, bans with exclusions, suspensions with silence. The overlooked failure: conflating removal with ban and abandoning a community that just wanted a flair fixed — or the inverse, posting through a ban "to test it." Success is zero surprise bans and accounts that age well.

MUST distinguish ban / removal / rule-note before acting — never treat a removal as a ban. MUST stop all activity in a community that banned the account. NEVER post through a site-wide suspension or attempt to evade it with another account.
