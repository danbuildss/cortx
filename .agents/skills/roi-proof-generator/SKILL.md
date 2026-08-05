---
name: "roi-proof-generator"
title: ROI proof generator
description: |
  Use this skill when a renewal, QBR, or expansion conversation is coming and the user needs to prove what their AI agent actually delivered — "build the renewal deck," "show ROI for this account," "the buyer is asking what they got for the money." Turns raw agent activity into a renewal-ready value receipt: tasks completed, hours returned, cost avoided, and the ROI multiple, in the customer's own numbers.

  Built on Manny Medina's billing-first ROI approach: agents are cognitively invisible to the people paying for them, so their value has to be made explicit — continuously, not just at renewal.
category: Pricing
---

Use when agent value must be proven to the people paying for it — before a renewal, at a QBR, or monthly as a standing receipt. Produces a value receipt: tasks completed, hours returned, cost avoided, ROI multiple.

## Get the right kind of metrics

Three reporting categories exist; only one closes renewals:

- **usage reporting** — tasks run, tokens consumed. Engineering metrics.
- **performance analytics** — uptime, error rate, latency. Reliability metrics.
- **ROI reporting** — time saved, cost avoided, revenue generated. Commercial metrics.

Enterprise renewals depend on the third category alone. If the input data is usage-shaped, convert it before writing anything.

## Establish the benchmark

The receipt is only credible if the "before" number came from the customer. Pull or ask for:

- what each task cost before automation (time per task, loaded hourly rate of whoever did it)
- which value units the customer already tracks and cares about — use theirs, never invent proxies
- the price paid for the agent over the period

If no benchmark was ever agreed, capture one now and flag it: value definition belongs before deployment, not after.

## Compute the receipt

For the period (monthly is the right cadence — continuous proof beats a scramble at renewal):

1. **Tasks resolved** — count of completed units, in the customer's language ("847 support tickets resolved")
2. **Hours returned** — tasks × human-equivalent time, minus any human touch remaining ("average resolution 4 minutes; human equivalent 2.8 hours per ticket; 396 hours returned to your team")
3. **Cost avoided** — hours returned × loaded rate, plus any hard costs displaced
4. **ROI multiple** — value delivered ÷ price paid for the period

Show the arithmetic. A buyer who can re-derive the number will defend it internally; a black-box multiple gets discounted.

## Deliver it

Write the receipt as one page the champion can forward: headline multiple, the three numbers above, a short trend line versus prior periods, and zero adjectives. If this account gets a receipt every month, the renewal stops being a defense — you stop defending your price and start reminding the customer what losing the product costs.

## What good looks like

A great receipt uses benchmarks the customer stated, units they already track, and arithmetic they can check — and it existed before anyone asked. A mediocre one appears the week before renewal, built on vendor-estimated hours and activity counts. The traps: shipping usage metrics as if they were value, inventing human-equivalent times without customer sign-off, and averaging across accounts when margins and value vary enormously per account — always compute per customer.

MUST separate customer-agreed benchmarks from assumptions, and label any assumption. NEVER fabricate a benchmark or a rate. NEVER lead with tasks-completed alone — activity is not value.
