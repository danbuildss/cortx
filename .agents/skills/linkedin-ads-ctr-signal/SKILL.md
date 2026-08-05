---
name: "linkedin-ads-ctr-signal"
title: LinkedIn Ads CTR signal
description: "Use this skill to turn LinkedIn Ads engagement into prioritized, pre-drafted outbound. Runs daily to pull LinkedIn Ads analytics, find the companies clicking your ads above a CTR threshold, suppress customers/open-deals/recently-touched accounts, and draft outreach informed by whichever ad themes are landing right now — all saved as drafts for human review, never sent automatically."
category: Signals
---

Run this daily to turn LinkedIn Ads engagement into prioritized, pre-drafted outbound. The premise: if a company is clicking your ads at an unusually high rate, they're paying attention right now — reach them while the intent is warm. The skill pulls LinkedIn Ads analytics, finds the high-CTR companies, suppresses anyone you shouldn't touch, and drafts outreach informed by whichever ad themes are actually landing — all saved as drafts for human review, never sent automatically.

## When to use it

- You run LinkedIn Ads and want ad engagement to feed outbound instead of sitting in a dashboard.
- You want a daily, low-effort signal that surfaces "who's warming up" without a rep watching analytics.
- You want outreach angles grounded in the messaging your audience is currently responding to.

Skip it if you don't run LinkedIn Ads, or if your motion is purely inbound.

## Step 1 — Find the active ad accounts

Pull the LinkedIn ad accounts connected to your org and note the account ID(s). Every analytics query below is scoped to these.

## Step 2 — Company-level analytics (the engagement signal)

Query LinkedIn Ads analytics for the last 7 days, pivoted by **company**, returning impressions and clicks, aggregated across the period, filtered to the active ad accounts. This returns engagement by the LinkedIn company of the member who interacted — the raw intent signal.

## Step 3 — Creative-level analytics (ad-theme intelligence)

In parallel, run a second query at the individual-ad (**creative**) level for the same 7 days — impressions, clicks, and each row's creative reference. Compute CTR per creative and rank by clicks. For the **top 5 creatives**, fetch the full creative details (post reference, headline, intro text, copy) and build a ranked list: clicks and CTR, headline and intro, and the inferred content theme/angle. If a creative resolves only to a post reference, infer the theme from the campaign name instead — an acceptable fallback. This ranked summary is the **ad-theme context** passed to every company handled in Step 6.

## Step 4 — Calculate CTR and filter

For each company from Step 2: `CTR = clicks ÷ impressions × 100`. Keep only companies with **CTR ≥ 2% and impressions > 0**. Everything else drops.

## Step 5 — Suppression check

For each qualifying company, look it up in your workspace by name or LinkedIn reference and check its memory for a `Last CTR signal processed: YYYY-MM-DD` note. Skip if it was processed in the last **30 days**. Also stop immediately for any company that is:

- tagged "suppress alerts"
- a current customer (funnel stage Customer, or CRM lifecycle stage customer)
- already in an open deal (open deal count > 0)

**Suppression timestamp rule:** for every company you skip — for *any* reason — immediately write `Last CTR signal processed: [today]` to its memory. This audit trail is what stops the daily run from re-processing the same accounts tomorrow.

## Step 6 — Delegate one company at a time

For each company that clears suppression, hand a sub-agent everything it needs: company name, LinkedIn company reference, last-7-day impressions and clicks, CTR, and the ad-theme context from Step 3.

The sub-agent researches the company and drafts outreach end to end, using the top-performing ad themes to inform the *angle* — the topics and pain points resonating with this audience right now. **It must never reference ads, clicks, tracking, or targeting in the outreach itself.** That's background intel that shapes the message, not something the recipient should ever see. After it finishes, it writes the CTR-processed timestamp to the company's memory.

**All outreach is saved as drafts. Nothing sends automatically — every message goes through manual review.**

## What good looks like

A great run ends with a short list of genuinely warm accounts — real companies clicking your ads above threshold, none of them existing customers or open deals, none re-surfaced from the last 30 days — each with a review-ready draft whose angle quietly mirrors the ad themes currently working, without ever tipping off the recipient that they were tracked. The suppression ledger is updated for every account touched or skipped, so tomorrow's run starts clean.

Mediocre looks like: alerting on one-click flukes because impressions weren't checked, drafting to customers or live deals, re-drafting the same accounts every day because timestamps weren't written, or outreach that leans on ad data so heavily it reads as creepy surveillance instead of a relevant, timely message.
