---
title: "Setup & Customization Checklist"
description: (reference)
---

# Setup & Customization Checklist

## 1. Trigger setup

This skill runs from a **LinkedIn Engagement trigger** monitoring the
tracked influencer's profile, with a broad topic filter (the skill's Step 1
is the precise gate). Reference trigger instructions:

```
When a tracked influencer publishes a LinkedIn post about [your company],
follow the <Influencer Post — Engager Capture> skill.

The skill will:
1. Verify the post is genuinely focused on [your company] (not just a
   mention in a list)
2. Filter out your team, company pages, and non-ICP engagers
3. Run full lead scoring on ICP-fit companies not already in a later
   pipeline stage
4. Post a digest to [signals channel]
```

- [ ] One trigger per tracked influencer (or one trigger monitoring a list,
      if your platform supports it).
- [ ] The trigger fires per-engager as engagement streams in — this is why
      the skill re-scrapes the full post (Step 2) and dedups against prior
      runs. Expect multiple runs per post.

## 2. External tooling

- [ ] **Apify account** with credits — two actors are load-bearing:
  - `apimaestro/linkedin-post-comments-replies-engagements-scraper-no-cookies`
    (full engager list; the trigger's list is always a subset)
  - `harvestapi/linkedin-profile-scraper` (batch person→company resolution;
    never parse companies out of headlines)
  Verify both actors still exist and their output fields match Steps 2–3;
  Apify actors change hands and schemas occasionally.
- [ ] LinkedIn tools connected for the Step 1b post-like (skip that step if
      unavailable).
- [ ] Business search + company enrichment tools connected (free search
      first, paid enrichment only after the eyeball ICP check — this is the
      cost-control pattern).

## 3. Placeholders

- [ ] `{{COMPANY}}`, `{{INTERNAL_DOMAINS}}`, `{{TEAM_MEMBERS}}` — the team
      list must be **full names as they appear on LinkedIn**, including
      teammates whose profiles don't list your company as employer.
- [ ] `{{ICP_SEGMENTS}}` — spelled out concretely (segment names + the
      obvious exclusions). This gate is where most engagers should die.
- [ ] `{{SIGNALS_CHANNEL}}`, `{{LEAD_SCORING_SKILL}}`, `{{TIER_SCALE}}`.

## 4. Policy decisions

- [ ] **Detection + scoring only** — this skill creates no outreach. Routing
      scored leads to outreach belongs downstream; keep it that way.
- [ ] Reactors vs commenters: the skill processes both, but comment scraping
      is the reliable path; reactor coverage depends on the trigger. Decide
      if reactor-only engagers are worth scoring for you.
- [ ] Digest granularity: per-lead top-level messages + one final digest is
      the tested format. High-volume influencer posts (100+ engagers) can
      flood a channel — consider a dedicated channel per campaign.

## 5. Behavioral invariants (do not remove)

- Step 1 precise focus check — a passing mention in a listicle must stop the
  run.
- Always scrape the post directly; never trust the trigger's engager subset.
- Never extract company from a LinkedIn headline.
- Dedup at three levels: against prior runs on the same post, across
  engagers at the same company, and against later-stage pipeline accounts.
- Never downgrade a funnel stage; active-deal accounts get a "warm signal"
  flag instead of re-scoring.
- Engagement alone caps at the second-lowest tier.
