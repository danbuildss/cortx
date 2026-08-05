---
name: move-gtm-diagnostic
title: MOVE GTM diagnostic
description: |
  Use this skill when a company wants to audit its go-to-market foundation before scaling or automating - it runs Sangram Vajre's WSJ-bestselling MOVE framework, the 4-question GTM diagnostic (Market, Operations, Velocity, Expansion), to find where GTM is misaligned, identify which of the three fit stages the company is actually in (Problem-Market / Product-Market / Platform-Market), and return a prioritised list of what to fix first. Trigger phrases: "GTM audit", "GTM diagnostic", "GTM health check", "MOVE assessment", "are we ready to scale", "why isn't our GTM working" - and before standing up any new outbound, inbound, or deal-process engine. This is a diagnosis, not a build - run it first.
category: RevOps
tags: [Sales, Marketing, RevOps]
---

# MOVE GTM diagnostic

A structured assessment that runs a company through Sangram Vajre's MOVE framework and returns a diagnosis: which fit stage they are truly in, where their GTM is misaligned, and what to fix before they scale or automate. Think of it as a GTM MRI — it exposes weakness across Market, Operations, Velocity and Expansion so you don't scale a broken motion.

**Run this before building anything.** The most common GTM failure is scaling — or automating — a motion that was never sound. This skill is the "diagnose before you build" step. Its output is the strategy layer other engines are built on.

## When to run it

- Before standing up any GTM engine (outbound, inbound, deal process).
- When a company believes it has a "marketing problem" or a "sales problem" — it usually has a GTM problem.
- When growth has stalled at a revenue threshold (the "valley of death" between stages).
- When teams are misaligned on who the customer is, what the motion is, or when to scale.

## The core principle

Companies fail not for lack of a good product, but because of a broken GTM process — and because they try to scale before they know which stage they are actually in. **You cannot scale Problem-Market Fit.** The diagnostic's first job is to locate the true stage; everything else follows from that.

## Step 1 — Establish the fit stage (the 3 P's)

Before the four questions, locate the company on the maturity curve. Gather signals (ARR, team structure, motion, retention) and place them in exactly one stage. Be honest — companies routinely over-place themselves.

| Stage | Fit | Focus | Motion | Growth |
|---|---|---|---|---|
| **1. Ideation** | Problem-Market Fit | Lead-focused | Sales-led | Inefficient (searching) |
| **2. Transition** | Product-Market Fit | Account-focused | Sales + Marketing aligned | Efficient |
| **3. Execution** | Platform-Market Fit | Customer-focused | Integrated revenue team (Mktg + Sales + CS) | Efficient at scale |

Signals to classify on:
- **Revenue band and trajectory** — where are they against the ~$10M and ~$50M "valleys of death"?
- **Team structure** — is CS in the GTM conversation, or just sales and marketing?
- **What they optimise** — leads and cost-per-lead (Ideation) → pipeline coverage, CAC, gross retention by segment (Transition) → NRR and integrated revenue (Execution)?
- **Repeatability** — can they name the ICP and win reliably in it, or are they still discovering it?

Output a one-line stage verdict with the evidence: *"You present as Transition but you're operating in Ideation — the ICP still isn't repeatable."* Stage mismatch is the single most valuable finding this skill produces.

## Step 2 — Run the four MOVE questions

Ask each question, gather evidence, and score alignment. These are the four questions every company must answer at every stage — the answers change as the company moves, the questions don't.

### M — Market · "Who should we market to?"
The foundation. Everything downstream breaks if this is wrong or vague.
- Is the ICP defined, narrow, and evidence-based (not aspirational)?
- Do the best current customers actually match the stated ICP?
- Is the market a real segment, or "everyone who could buy"?
- **Red flags:** ICP unchanged since the last raise; sales and marketing target different lists; TAM slide substituting for a real segment.

### O — Operations · "What do we need to operate effectively?"
RevOps is the nervous system. Siloed data means you cannot scale.
- Is there a single source of truth, or siloed systems that don't talk?
- Are marketing, sales and CS sharing one revenue number — or optimising separate metrics?
- Can the company measure the motion end to end, or only in fragments?
- **Red flags:** marketing measured on MQLs while sales is measured on bookings; no shared pipeline definition; the motion lives in one person's head.

### V — Velocity · "When can we scale our business?"
Velocity is about retention and upsell (NRR), not just new logos — and about *timing*. Scaling before the motion is repeatable burns cash.
- Is the current motion repeatable and predictable, or still being discovered?
- Is NRR strong enough that adding fuel compounds rather than leaks?
- Are they trying to scale a stage they haven't actually reached?
- **Red flags:** pouring spend into an unrepeatable motion; treating velocity as new-business only and ignoring retention; scaling headcount ahead of a proven playbook.

### E — Expansion · "Where can we grow the most?"
Where sustainable growth comes from next — new segments, products, geographies (the path to Platform-Market Fit).
- Is there a deliberate expansion path, or is growth assumed to come from more of the same?
- Does the current customer base support land-and-expand?
- Is expansion premature (before the core motion is sound) or overdue (leaving obvious growth on the table)?
- **Red flags:** chasing new markets before the first is won; no expansion motion at all in a mature base; expansion strategy that's really just "sell harder."

## Step 3 — Diagnose the four motions

Cross-check MOVE against the four motions. A company must be able to do all four; the diagnostic pinpoints which one breaks:

1. **Make but can't sell** — product exists, no repeatable acquisition (Market/Operations weak).
2. **Sell but can't deliver** — closing deals it can't fulfil (Operations/onboarding weak).
3. **Deliver but can't renew** — churns what it wins (Velocity/retention weak).
4. **Renew but can't expand** — retains but doesn't grow accounts (Expansion weak).

Name the specific broken motion. It is more actionable than a letter grade.

## Step 4 — Output the diagnosis

Return a tight, board-ready diagnosis in this shape:

```
GTM DIAGNOSIS

Fit stage:        [true stage] — [one line, with evidence + any mismatch]
Broken motion:    [which of the four] — [why]

MOVE scorecard:
  Market      [Aligned / At risk / Broken] — [one line]
  Operations  [Aligned / At risk / Broken] — [one line]
  Velocity    [Aligned / At risk / Broken] — [one line]
  Expansion   [Aligned / At risk / Broken] — [one line]

Fix first:        [the single highest-leverage fix, tied to the current stage]
Then:             [2–3 sequenced next moves]
Do NOT scale yet if: [the disqualifying condition, if any]
```

## Rules of the diagnostic

- **Locate the stage before scoring.** A "weak" Expansion score is meaningless — and misleading — for an Ideation-stage company; expansion isn't its job yet. Score every question *relative to the stage the company is actually in.*
- **Prescribe in sequence, not in parallel.** MOVE is cyclical — a wheel whose spokes are the four questions — but the fixes are ordered. Fix Market before Operations before Velocity before Expansion. A company cannot out-operate a broken Market answer.
- **Be willing to say "don't scale."** The most valuable output is often "you're not ready" — naming the valley of death before the company drives into it.
- **Keep it to one slide.** If the diagnosis can't be explained on a single slide, it's too complex for the field to execute. Compress.
- **Diagnose, don't build.** This skill stops at the diagnosis and the sequenced fix. Handing off to the build (the outbound / inbound / deal-process engines) is the next step, not this one.

## Why this runs first

Every downstream GTM engine assumes the Market answer is right, the Operations layer is sound, and the company is at the stage it thinks it is. When those assumptions are wrong, automation scales the error. This diagnostic is the check that makes everything built after it worth building.

---

MOVE framework © Sangram Vajre & Bryan Brown.
