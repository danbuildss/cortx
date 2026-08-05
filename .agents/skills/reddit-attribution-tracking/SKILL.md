---
name: "reddit-attribution-tracking"
title: Reddit attribution tracking
description: "Use this skill when the user asks what Reddit activity is actually producing — \"is Reddit driving signups,\" \"attribute this pipeline to Reddit,\" \"prove the Reddit motion works.\" Wires UTMs into posted links, isolates Reddit sessions in analytics, connects them to CRM pipeline, and uses mention-spike correlation as the proxy where click-level tracking can't reach."
category: Reddit
---

Use when Reddit's contribution to traffic and pipeline needs proving. Produces a working attribution setup and an honest readout — including what can't be measured. Reddit gives no native click or conversion tracking on comments, so attribution is assembled from tagged links, analytics, and correlation.

## Tag every link

Standardize one UTM scheme and bake it into the drafting instructions so every posted link carries it:

```
?utm_source=reddit&utm_medium=comment&utm_campaign=<campaign>&utm_content=<subreddit>
```

`utm_content=<subreddit>` is what makes per-community ROI readable later. Put the rule where drafts are generated (advocate instructions or knowledge base) — retrofitting tags on live comments is impossible.

## Read it in analytics

Filter sessions by source `reddit.com`, segment by campaign to isolate tagged traffic. Watch the redirect trap: Reddit routes outbound clicks through intermediaries (`out.reddit.com`, `redd.it`) — verify the UTM parameters survive the redirect chain into the analytics tool before trusting any number.

## Connect to pipeline

On form submissions landing in the CRM, stamp a source field from the UTM and carry the subreddit through — deal-level "came from r/X" is what makes the case to leadership. For multi-touch reality (a buyer reads a comment, converts weeks later via direct visit), first-party-cookie attribution tools reconstruct the journey a last-touch UTM misses.

## Where measurement ends, correlate

Comment clicks, native Reddit analytics, and view-through conversions aren't directly trackable. Use the proxy: overlay brand-mention dates and comment-performance data (views, upvotes) on traffic spikes and signup timing. Correlation honestly labeled beats fabricated precision.

## What good looks like

A great readout shows tagged-session volume per subreddit, pipeline touched, and a correlation chart for the untrackable rest — with the measurement gaps stated plainly. The overlooked failures: UTMs stripped in redirects (silently zeroing the numbers) and judging a comment channel on last-touch only, which structurally undercounts Reddit. Success: the team can name which communities produce pipeline and defend the number.

MUST verify UTM survival through Reddit's redirect chain before reporting. MUST label correlation-based findings as such. NEVER claim view-through conversions as measured.
