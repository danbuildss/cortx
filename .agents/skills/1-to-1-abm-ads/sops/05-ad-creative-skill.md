# 1:1 ABM Ad Creative Skill

> READ THIS BEFORE designing any 1:1 ABM ad creative. This skill is the distilled record of producing a full 1:1 ABM creative set. Every mistake below is common and costly - do not repeat them.

## What this skill is

How to design a **single-image 1:1 ABM ad creative** (a mockup, rendered by gpt-image-2) that is addressed to ONE named target account and drives to a personalized asset built for them (a landing page, audit, playbook, microsite).

This is the **creative/copy + design** layer. It is NOT:
- The LinkedIn API build (one ad set per company, conversions, UTMs) -> that is `03-build-and-launch-sop.md`.
- General image-gen mechanics (endpoints, resolution, masks, the no-overwrite rule) -> that is `06-image-generation-skill.md`. **Read that first; this skill assumes it.**

## The one rule that matters most: NEVER FABRICATE

A 1:1 ABM ad's entire job is to prove *we did real, specific work for this exact account*. The moment one word is invented, the whole premise collapses - and the prospect catches it instantly because it's THEIR company.

**Every single word on the ad must trace to a real source:** the landing page it links to, something the client gave you, or the account's own public buyer definition. If you cannot point to where a claim comes from, it does not go on the ad.

This is the project's Unknowns Gate applied to creative. Before rendering, run this check on every line:

- Is this a claim about the **target's internals** (how they're built, what they use, what they're doing)? -> You almost never know this. Cut it unless it's on the page or the client said it. *(Common mistake: asserting "your pipeline is built by hand" with no basis - you cannot know the target's internal operations.)*
- Is this a **play / mechanic / capability**? -> It must be one of the actual plays on the linked page, described the way the page describes it. *(Common mistake: inventing a "leaves a competitor / churn detection" play that never existed.)*
- Is this a **status** ("live", "running", "active")? -> Only if it's true and verified. *(Common mistake: claiming "5 plays are live" when they weren't.)*
- Is this a **number** (team size, count, %, range)? -> Copy the page's exact figure. Do not round, approximate, or invent. *(Common mistake: writing "30-person" / "20-person" when the page said 10-200 and 15-50.)*
- Is this a **named segment / buyer**? -> Use the page's own wording for who the plays target.

If a line can't pass, either pull the real version from the page or remove the line. Never "make it sound good" by filling the gap.

## Plain language, no jargon

The reader is a busy exec, not an insider. Every term must be instantly understandable to someone who has never heard your internal vocabulary.

- **Banned: invented or internal labels** like "New Money Old Stack", "Vibe-Coding Signal", play codenames, framework names. *(Common mistake: shipping vague internal labels the reader has never heard - they read as nonsense.)*
- If you must reference a play, describe the *plain situation* it triggers on ("the moment a company posts its first RevOps hire"), not its internal name.
- Translate every acronym the audience wouldn't use day-one.

## Copy structure (the approved pattern)

The winning direction after many iterations is **low-text, one idea, the personalization as the hook**:

```
Hey {Company},                          <- eyebrow (personalized lead-in)
We built 5 plays for your GTM            <- HERO (what we did, specific & concrete)
to book more meetings with               <- connector
{the account's own buyer}.               <- the standout, in brand accent color
[See the full playbook ->]               <- CTA, verb-first, matches what they'll see
```

Principles behind it:
- **The hook is the personalization, not a clever line.** The ad must telegraph "we built something specifically for you" - the company name, the count of real plays, their own buyer. That specificity IS the creative.
- **One idea per ad.** Resist stacking signals, examples, sub-heads. Every dense version tends to get rejected.
- **The blue/accent phrase = the single most specific, account-true thing** (their buyer, or the one play that matters most). It's the only accent text besides the logo.
- **CTA is verb-first and honest about the destination.** "See the full playbook", "See your 5 GTM plays". Confirm with the user whether to mirror the landing page's own button label exactly (e.g. the page said "Book a GTM teardown") - CTA wording is a recurring open question, so ASK, don't assume.

## Visual hierarchy (the lesson from the final pass)

A wall of text at one size has NO hierarchy and gets rejected. Build **distinct size tiers with obvious jumps and whitespace between them**, so the eye lands on the hero, drops to the accent line, and the supporting text recedes.

The five-tier layout that worked (1024x1024 reference sizes):

| Tier | Element | Style | ~Size |
|---|---|---|---|
| top | Account logo + wordmark lockup | sans, charcoal | icon ~46px |
| 4 (small) | Eyebrow "Hey {Company}," | sans, cool grey #52525A | ~26px |
| **1 (hero)** | "We built 5 plays for your GTM" | **serif, warm charcoal, semibold** | **~74px** |
| 3 (medium) | "to book more meetings with" | sans, cool grey | ~30px |
| **2 (accent)** | the buyer/persona line | **serif bold, brand accent** | ~46px |
| small | CTA pill | sans bold white on charcoal | ~18px |
| footer | Your agency logo, bottom-left | reproduced exactly | ~120px wide |

Rule of thumb: **if any two tiers look the same size, the hierarchy has failed.** Tell the model explicitly that the size jumps ARE the hierarchy, and that it must NOT merge the tiers into one continuous sentence at one size.

## Example design language (locked brand spec)

This is an illustrative brand-language example. For your own client, pull the equivalent values from their `BRAND_SPEC.md` - never reuse another brand's hexes.

- Background: flat warm cream **#FEFAF4** (faint peach tint - not pure white, not beige, not grey).
- Text: warm charcoal **#2B2825** (never cold black); secondary cool charcoal **#52525A**.
- Accent: brand blue **#0B7BFA** - used ONLY on the hero's accent phrase, the logo mark, and a thin 2px hairline frame inset ~45px from the edges.
- Headline + accent phrase: high-contrast serif (Playfair Display style). Eyebrow, connector, CTA, body: sans (Inter/Geist).
- CTA: solid charcoal #2C2926 rounded-rectangle (~10px radius, NOT a full pill), white bold text + right-arrow. No shadow.
- Mood: The Economist meets a premium SaaS brand - warm, confident, spacious, minimal.
- For other clients, pull the equivalent values from their `BRAND_SPEC.md` - never reuse this example's hexes for a different brand.

## Logos - get the real ones, pass them as references

Per IMAGE_GEN_SKILL RULE #0: **gpt-image-2 reproduces brand logos correctly when you attach the real PNG** as an `image[]` reference and tell it to reproduce exactly, keeping original colors. Never PIL-composite, never let it draw a fake.

Sourcing order (what works reliably):
1. **The personalized landing page itself** often hosts the account logos (e.g. `/{path}/logos/{company}.{png|svg}`). Check there first - it's the most reliable.
2. Rasterize any SVG to PNG with `rsvg-convert -w 512 in.svg -o out.png`.
3. clearbit / worldvectorlogo frequently 403 or return HTTP 000 - don't rely on them.
4. All downloads/curl need `dangerouslyDisableSandbox=true` (the sandbox blocks network -> HTTP 000).

Attach two references per render: **Image 1 = your agency logo, Image 2 = the account icon.** Tell the model which is which and exactly where each goes.

## Rendering recipe

- Model `gpt-image-2`, endpoint `/v1/images/edits` (references are your own brand + the account, so edits is correct), `size 1024x1024`, `quality high`, `n 1` for iteration.
- **Render all accounts in PARALLEL** with `ThreadPoolExecutor(max_workers=len(configs))` - drops a 5-ad set from ~6-7 min sequential to ~90s. Each writes to its own folder so there's no collision.
- Run with **`python3 -u`** for unbuffered, live progress (otherwise logs look frozen and the user thinks it hung).
- **Version-bump every output** (`v1`, `v2`, ...) - never overwrite a render; each costs money and the user compares versions side by side.
- Output to `scripts/output/{client}-abm-{account}/v{N}.png`.
- The working, parameterized script for this is `../scripts/render_creatives.py` - copy it as the starting point for a new ABM set (swap the CONFIGS tuples and the prompt's brand values).
- **Iterate at 1024, then ASK before upscaling** to LinkedIn upload size (2048x2048). Never auto-4K.

## Pre-flight checklist (run before every ABM render)

1. **Read the actual landing page(s)** the ad links to. Pull the real plays, the page's exact numbers, and the page's own buyer wording. (WebFetch returns a markdown summary - use it.)
2. **Read the brand spec** for colors/fonts/logo. Print the hexes; don't work from memory.
3. **Source every logo** (agency + each account) and verify each file opens / looks right.
4. **Draft the copy and audit every line through the NEVER-FABRICATE check above.** Trace each word to a source.
5. **Confirm the two recurring open questions with the user:** exact CTA wording, and the exact buyer/persona phrasing per account.
6. **Plan the hierarchy** (which line is the hero, which is the accent) before writing the prompt.
7. Render parallel at 1024, view EVERY output, then open the set for the user.
8. On approval: upscale the locked set; only then hand to the LinkedIn build SOP.

## The mistakes catalog (do not repeat)

- Asserting anything about the target's internal operations. You don't know it.
- Inventing a play, mechanic, or capability not on the linked page.
- Claiming "live"/"running" status that isn't verified.
- Approximating or inventing numbers instead of copying the page's exact figures.
- Internal jargon or invented labels the reader won't understand.
- Dense, multi-idea, wall-of-text layouts.
- One uniform text size with no tiers.
- PIL-compositing logos instead of passing real PNGs as references.
- Sequential rendering + buffered logs (slow, looks frozen).
- Copy-pasting a reference example's exact words/structure instead of adapting to this brand.

---

> By Ivan Falco - Frontal
