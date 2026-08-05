---
name: "aeo-score-audit"
title: AEO score audit
description: "Use this skill when an AI-visibility score needs to be trusted, explained, or challenged — \"why did our AEO score drop,\" \"prove this visibility number to the client,\" \"this scan result looks wrong.\" Traces any aggregate visibility or sentiment score down to the individual scans behind it, and from there to the raw AI answer text — an audit trail from headline number to evidence."
category: AEO
---

Use when a visibility score moves unexpectedly, a client wants receipts, or a scan result looks off. Produces an audit trail: aggregate → contributing scans → raw AI answers. Never explain a score movement from the aggregate alone — decompose first.

## The three-step drill

1. **aggregate** — pull the top-level number: visibility percentage, mention count, total scans, average sentiment for the period
2. **decompose** — explain the score into its component scan results: which scans registered a brand mention and which didn't. Score drops usually localize here — one engine, one country, or one topic did the damage, not "the brand"
3. **inspect** — for any surprising scan, pull the full record: the raw AI answer text, every extracted field, every citation found. This is where "we lost visibility" becomes "engine X stopped citing the comparison page for prompt Y"

## Check the methodology version

Every result carries an analysis version. Before reading a long-term trend, confirm the version is consistent across the window — a methodology change explains a score shift that has nothing to do with the brand's actual standing. Version-boundary comparisons are the classic false alarm.

## What the audit is for

- **discrepancy resolution** — why a scan hit or missed, settled with the raw answer, not a guess
- **competitor verification** — confirm how rivals actually appeared in the same answers before repeating a claim
- **client reporting** — an auditable derivation of every headline number; scores that can't show receipts don't survive a procurement review

## What good looks like

A great audit answers "why did the number move" with named prompts, engines, and cited (or newly missing) sources, checks the analysis version before crying trend, and quotes the raw answer for every contested scan. The overlooked failure: averaging over the split that matters — per-engine and per-country movements cancel out in the aggregate and hide the real story. Success: every reported score can be defended down to the sentence an AI engine actually wrote.

MUST verify analysis-version consistency before interpreting any trend. MUST inspect raw answers before disputing or explaining an individual scan. NEVER report a score movement without naming which scans drove it.
