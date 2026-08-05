# Account Structure

Structure exists to control budget, read performance cleanly, and feed the algorithm tight signals. Over-engineering it is as bad as ignoring it.

## Separate by intent first
At minimum, split campaigns so you can budget and read them independently:

- **Brand** - own campaign, own budget. Cheap, high CVR. Never let it share a budget with non-brand or it eats the cheap clicks and hides the truth.
- **Non-brand (high intent)** - your core. One campaign, themed ad groups by solution.
- **Competitor** - own campaign. Different CPC and CVR profile, needs its own budget and messaging.
- **Remarketing (Display/Demand Gen)** - own campaign, separate from Search entirely.

Why separate budgets: a shared budget lets the cheapest, highest-CVR campaign (usually brand) starve the campaigns you actually need data on. You end up "profitable" on paper and blind on everything that matters.

## Ad group structure: themed, not SKAG
Single-keyword ad groups (SKAGs) are mostly dead. Broad/phrase match plus Smart Bidding made tight 1:1 keyword-to-ad-group structures pointless and starve each group of data. Instead:

- **Themed ad groups**: 5-15 closely related keywords that share one search intent and can honestly be answered by one set of ads.
- One ad group = one promise. If two keywords need different landing pages or different value props, split them.
- 2-3 Responsive Search Ads per ad group. Let Google rotate, then read asset performance.

## Naming convention
Consistency makes reporting and filtering possible at scale.

Campaign: `[Type] - [Intent] - [Region]`
- `Search - Brand - US`
- `Search - NonBrand - Global`
- `Search - Competitor - EMEA`
- `PMax - Retargeting - US`

Ad group: `[Theme]`
- `Cold Email Software`
- `Sales Engagement Platform`

## Geo, language, network settings (the defaults Google sets against you)
- **Network**: turn OFF "Search Partners" and "Display Network" on Search campaigns until proven. They're on by default and usually serve junk.
- **Location**: set "Presence" (people *in* your target locations), not the default "Presence or interest", which serves people merely *interested in* the location.
- **Language**: match your market. This targets the user's Google UI language, not the query language - account for that.

## How many campaigns is too many
If a campaign can't get roughly 15-30 conversions per month, Smart Bidding can't learn and the structure is too fragmented. Consolidate. In low-volume B2B, fewer, better-fed campaigns win. Add structure only when a campaign has enough volume to split without starving the halves.

---

> By Ivan Falco - Frontal
