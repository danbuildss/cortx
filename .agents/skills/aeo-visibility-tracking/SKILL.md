---
name: "aeo-visibility-tracking"
title: AEO visibility tracking
description: "Use this skill when the user wants to measure or improve how their brand shows up in AI-generated answers — \"do we appear in ChatGPT answers,\" \"track our AEO score,\" \"which sources do AI engines cite for our category.\" Seeds the prompts buyers actually ask, tracks brand visibility per engine and country over time, and mines the citation sources to show where content effort moves the score."
category: AEO
---

Use when AI-search visibility needs measuring: which engines mention the brand, for which buyer questions, citing which sources. Produces a visibility baseline, a trend line, and a ranked list of the sources worth influencing. Exact commands live in `references/commands.md`.

## Set the baseline

1. define the brand (and competitor brands — ranking against them is the readout that lands) and its topics
2. seed prompts with the questions buyers actually ask an AI engine — "best X for Y," "X vs Z," "how do I solve W" — in the buyer's words, not the category's marketing language. Batch-create per topic, spread across target engines and countries
3. read the visibility timeline and brand ranking for the baseline: who gets mentioned, for what, where

## Read the results

- **visibility explain** shows why a score moved — which prompts and engines drove it
- **citations and sources** are the actionable half: which domains, URLs, and domain types the engines actually cite for these prompts. This is the target list — if engines cite three Reddit threads and two comparison posts for the category, that's where content effort goes
- **sentiment explain** shows how the brand is characterized when it does appear — visible-but-mispositioned needs different work than invisible

Report per topic: visibility vs competitors, trend, top cited sources, and one concrete content action per gap.

## What good looks like

A great AEO readout names the prompts that matter commercially, ranks the brand against named competitors per engine, and ends with a short cited-source hit-list — "these 5 URLs drive the category answers; here's where the brand can plausibly earn a mention." Mediocre tracking reports one aggregate score with no explain and no source mining. What gets overlooked: country and engine splits (visibility in one engine says nothing about another) and prompt drift — refresh seeded prompts as the buyer language evolves.

MUST seed prompts in buyer language, not brand language. NEVER report a score without its explain and its cited sources — an unexplained number invites wrong conclusions.
