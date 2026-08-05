# Search Terms and Negatives

The search terms report is the **#1 optimization lever** in a Google Ads account. It shows what people actually typed, versus the keywords you bid on. In B2B, the gap between those two is where most budget leaks.

## The weekly ritual (non-negotiable)
Run `search_terms_report.py` every week. For each campaign:

1. **Find waste.** Filter for terms with spend and no conversions (`--no-conversions --min-clicks 3`). Add the irrelevant ones as negatives.
2. **Find winners.** Terms converting well that aren't yet keywords -> add them as Exact or Phrase keywords in the right ad group.
3. **Find intent drift.** Broad/phrase matching pulling in adjacent-but-wrong meaning -> tighten match type or add negatives.

Skipping a week in B2B can mean hundreds of dollars on "salary", "free", and job-seeker traffic.

## What to negative out
- **Universal junk**: free, cheap, jobs, salary, hiring, career, intern, student, course, tutorial, training, certification, pdf, reddit, wiki, crack, torrent.
- **Research-not-buying**: "what is", "how to" (unless you intentionally run problem-aware), "examples", "meaning", "definition".
- **Wrong product**: words you share with an unrelated category. Watch your own report - these are specific to you.
- **Brand-as-negative**: add your brand terms as negatives in non-brand campaigns so brand traffic routes to the brand campaign only.

## Negative match types matter
- **Negative broad** "free" blocks any query containing "free" in any order - the default workhorse.
- **Negative phrase** blocks the phrase in order.
- **Negative exact** blocks only that exact query - use when a term is valid in one context but not another.
Careful: negative broad with multiple words requires **all** words present (any order), not any one of them. "free trial" as negative broad won't block "free" alone.

## Shared lists
Build a **shared negative keyword list** for universal junk and apply it to all non-brand Search campaigns. Maintain it in one place. Keep campaign-specific negatives local.

## Don't over-negative
Every negative you add narrows reach. In low-volume B2B that compounds fast. Negative the clearly-wrong, not the merely-uncertain. If a term might convert, let it run a little longer before cutting.

---

> By Ivan Falco - Frontal
