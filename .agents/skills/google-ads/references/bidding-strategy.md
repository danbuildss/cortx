# Bidding Strategy

Bidding is a function of how much **conversion data** the account has. Pick the strategy that matches your data, not the one that sounds advanced.

## The progression by conversion volume

| Conversions / month | Strategy | Why |
|---------------------|----------|-----|
| 0-15 | **Manual CPC** or **Maximize Conversions** (no target) | Not enough data for a target. Keep control, gather signal. |
| 15-30 | **Maximize Conversions** | Enough to let Google optimize toward conversions, not yet enough for a reliable target. |
| 30+ stable | **Target CPA (tCPA)** | Now a target is meaningful. Set tCPA near your recent actual CPA, then move it gradually. |
| Revenue values tracked | **Target ROAS (tROAS)** | Use only when you pass back real deal values, not flat lead values. |

Rule of thumb: a Smart Bidding strategy needs roughly **30 conversions in 30 days** per campaign to learn well. Below that, it's guessing.

## Setting and moving targets
- Set tCPA at or slightly above your **trailing 30-day actual CPA**. Setting it aggressively low chokes delivery - Google simply stops bidding.
- Move targets in **±10-15% steps**, then wait 1-2 weeks. Each change restarts learning. Yanking the target around guarantees instability.
- Expect a 1-2 week **learning period** after any major change (strategy switch, big budget change, target change). Don't judge or panic-edit inside it.

## The B2B trap: optimizing to the wrong conversion
Smart Bidding optimizes to whatever you call a "conversion." If that's a raw form fill, Google will happily buy you a flood of junk form fills. In B2B you must:
1. **Feed quality signals back.** Import offline conversions (SQL, opportunity, closed-won) so bidding learns toward pipeline, not form fills. This is the single highest-impact move in a B2B Google account.
2. **Value conversions differently.** A demo request is worth more than an ebook download. Assign values so tROAS/Max Conversion Value optimizes toward what matters.
3. **Until offline data flows**, keep a human in the loop and watch lead quality, not just CPL.

## Budget mechanics
- A campaign can spend up to **2x its daily budget** on a given day; Google balances over the month. Don't panic at a single-day overspend.
- Budget-constrained Smart Bidding underperforms - if a campaign is capped and converting, raising budget often lowers CPA, not raises it.
- Brand campaigns rarely need much budget. Cap them and pour the rest into proven non-brand.

## Manual CPC, when it still makes sense
Low-volume accounts, brand campaigns, or when you need hard control while gathering the first 30 conversions. There's no shame in manual early - it beats a Smart strategy starved of data.

---

> By Ivan Falco - Frontal
