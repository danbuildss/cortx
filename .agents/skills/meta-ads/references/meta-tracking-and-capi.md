# Meta Ads Tracking & Conversions API - Canonical Setup Guide

The single reference for Meta Ads tracking on B2B accounts: pixel installation, conversion events, domain verification, the Conversions API (CAPI), event deduplication, Event Match Quality, third-party / off-domain tracking, UTM strategy, troubleshooting, and a pre-launch checklist. Use this when you have account access and need to configure or audit tracking before you launch or scale.

---

## Where Things Live in Meta

| What you need | Where to go |
|---|---|
| Pixel, events, data sources | **Events Manager** (Ads Manager - left menu - All Tools - Events Manager) |
| Create and run campaigns | **Ads Manager** (campaigns, ad sets, ads) |
| Domain verification, business assets | **Business Settings** (Business Suite or business.facebook.com - Settings) |
| Conversion event priority | Events Manager - Pixel - Settings - Conversions |
| CAPI configuration | Events Manager - Pixel - Settings - Conversions API |
| Test events tool | Events Manager - Pixel - Test Events |
| Lead Gen Forms | Created when you build an ad with the **Leads** objective; form settings live in the ad set / ad flow |

---

## 1. Meta Pixel Installation

### 1.1 Create the Pixel

1. Go to **Events Manager** - Data Sources - **Add new data source** - **Website** - **Connect**.
2. Choose **Meta Pixel** - name it descriptively (e.g. "{Company} - Main Website") - **Create Pixel**.
3. Note your **Pixel ID** (shown in pixel details). You will need it for the base code and any tag manager setup.

### 1.2 Installation Methods

You need the **base pixel code** on every page (or at least all pages you care about for traffic and conversions), not just the thank-you page.

| Method | Best For | Setup Steps |
|---|---|---|
| **Google Tag Manager** (recommended if you use GTM) | Most B2B sites using GTM | Events Manager - Set up - Use a partner - Google Tag Manager. In GTM: create a Custom HTML tag with the base pixel code, set it to fire on All Pages, publish the container. |
| **Manual install** | Static sites, custom builds | Events Manager - Pixel - Set up - Install code manually. Copy the base code snippet into the `<head>` of every page via a global header/footer template. |
| **CMS or partner integration** | WordPress, Webflow, Shopify | Events Manager - Set up - Use a partner - select your platform and follow the in-product steps. |

**Base pixel code structure:**
```html
<!-- Meta Pixel Code -->
<script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '{your_pixel_id}');
  fbq('track', 'PageView');
</script>
```

The base code must be on **every page** you want to track. Without it on all pages you lose remarketing data and pageview attribution.

### 1.3 Verify the Pixel is Firing

| Verification method | What to check |
|---|---|
| **Test Events tool** | Events Manager - Pixel - Test Events. Open your site in another tab. **PageView** (and any other events you set) should appear within a few seconds. |
| **Meta Pixel Helper** | Browser extension. Load your site - it should show the pixel ID and all events firing on that page. |
| **Events Manager overview** | After 24 hours, PageView volume should roughly match your site traffic. |

Until the base code is on the site and firing, do not rely on Meta for conversion optimization or remarketing.

**Verification tip:** Have two independent people verify your pixel and events are tracking properly before scaling spend (e.g. pay two freelancers $20 each). $40 is cheap insurance against burning thousands optimizing on broken tracking. Even experienced media buyers miss technical setup issues.

---

## 2. Conversion Events for B2B

The pixel base code sends PageView by default. For lead-gen and B2B you need **conversion events** so Meta can optimize and report.

### 2.1 Standard Events to Use

| Event | When to fire | Use case |
|---|---|---|
| **Lead** | Form submit, demo request, "contact us" / contact form completion, lead gen form submit | Primary top-of-funnel conversion for most B2B |
| **CompleteRegistration** | Webinar registration, account sign-up, event registration | Secondary conversion for content / events |
| **Schedule** | Meeting booked (e.g. Calendly confirmation) | High-intent booking action |
| **PageView** | Every page load (automatic with base code) | Remarketing, audience building |

**Critical rule:** Fire the event when the action **actually completes** (thank-you page load, form success callback) - not on button click. Button clicks fire even when form validation fails, inflating your conversion count.

### 2.2 Adding Events

**Via GTM (recommended):**
- One tag per event (e.g. `fbq('track', 'Lead');`).
- Trigger on the thank-you page URL or a form submission success trigger.
- Keep events separated - do not bundle multiple events in one tag.

**Via manual install:**
```javascript
// Add this on the thank-you page or in the form success handler
fbq('track', 'Lead');
```

**Via Meta Lead Gen Forms:**
- When using the **Leads** objective with in-platform forms, Meta tracks the lead event automatically.
- You still need the pixel on the rest of the site for remarketing and any landing-page conversions.

### 2.3 Event Priority Configuration

When multiple events fire on the same page (e.g. PageView + Lead on a thank-you page), set priority so Meta optimizes for the right one.

1. Go to Events Manager - Pixel - Settings - Conversions.
2. Set the event you optimize for (e.g. Lead) **higher** than PageView and other lower-funnel events.
3. This affects both optimization and attribution reporting.

**Priority order for most B2B accounts:**

| Priority | Event | Reason |
|---|---|---|
| 1 (highest) | Lead | Primary optimization target |
| 2 | CompleteRegistration | Secondary conversion |
| 3 | Schedule | Booking action |
| 4 | ViewContent | Interest signal |
| 5 | PageView | Baseline traffic |

---

## 3. Domain Verification

Required for reliable conversion matching, some advanced features and event configuration, and controlling how your links appear in ads. Verify **every root domain** used in ads (landing pages, lead form thank-you pages, redirect URLs).

### 3.1 Steps

1. Go to **Business Settings** - **Brand Safety** - **Domains** - **Add**.
2. Enter the domain (e.g. `yourcompany.com`).
3. Choose **one** verification method:

| Method | How | Best for |
|---|---|---|
| **DNS TXT record** | Add the TXT record at your DNS host, then click Verify in Meta | Teams with DNS access |
| **Meta tag** | Add the meta tag to the homepage `<head>`, then click Verify | Teams with CMS access |
| **HTML file upload** | Download the file, upload to the site root, then click Verify | Teams with FTP / file access |

### 3.2 Important Notes

- Verification can take a few minutes to 72 hours depending on DNS propagation.
- Verify **before** scaling spend - unverified domains cause attribution gaps.
- If you use multiple domains (e.g. main site + landing page tool), verify all of them.
- If running ads to a third-party platform (e.g. a webinar tool), add that domain to your pixel's **Traffic Permissions** (allow list). See Section 7.

---

## 4. Conversions API (CAPI)

### 4.1 Why CAPI Matters for B2B

Browser-side tracking (pixel) is increasingly unreliable due to:
- iOS App Tracking Transparency blocking pixel events
- Ad blockers preventing the pixel from loading
- Browser privacy features limiting cookies
- Third-party cookie deprecation

CAPI sends the same events from your **server** to Meta, bypassing browser-side blocks. For B2B, where every lead matters (small volumes, high deal values), losing even 10-20% of conversion data significantly hurts optimization.

**Best practice:** Run **both** pixel (browser) and CAPI (server) for the same events (redundant setup) with deduplication so Meta counts each conversion once.

### 4.2 Best Option for B2B SaaS: CRM to CAPI (with Pixel)

- **Source of truth:** Your CRM (HubSpot, Salesforce, etc.).
- **Conversion events:** CRM **lifecycle stages** (Lead, MQL, Opportunity, Customer), not only a single "Lead" from the site.
- **Sending:** Server-side via CAPI from the CRM (or from a system that has the same CRM data).
- **Redundancy:** Use both the Meta Pixel (browser) and CAPI (server) for the same conversion where possible, with deduplication so Meta counts it once.

This gives optimization on real pipeline (opportunity / customer), resilience to iOS and ad blockers, and a proper offline conversion loop: Meta lead - CRM - stage changes - CAPI back to Meta.

### 4.3 CRM vs Middleware Approaches

| Approach | When to use | Pros | Cons |
|---|---|---|---|
| **CRM native** (e.g. HubSpot to Meta integration) | Single destination, no custom logic needed, acceptable Event Match Quality (6+/10), data sharing (Email, Phone, Click ID) on for all lifecycle events | One place to manage sync, minimal maintenance, no code needed | Limited control over hashing, no custom filtering, single destination |
| **Middleware** (e.g. n8n, Zapier, Segment, custom backend) | Low EMQ despite CRM data sharing, need multi-destination (Meta + LinkedIn + Google), need custom logic (e.g. only send when deal value > X, or only paid-source contacts), compliance requirements, want one event_id for pixel + CAPI | Full control over normalize + hash per Meta spec, multi-destination, custom filtering, better compliance (hash before sending, never send plain PII) | More setup, maintenance overhead, requires technical knowledge |
| **Custom server-side** | High volume, full control needed, engineering resources available | Maximum flexibility, lowest latency | Most complex to build and maintain |

**Order of preference:**
1. Try CRM native integration first, with data sharing enabled for all events.
2. If Event Match Quality stays below 6/10, or you need custom logic / multi-destination / hashing control, add middleware.
3. Use custom server-side only if middleware cannot handle your requirements.

### 4.4 When Middleware (e.g. n8n) Is Better Than CRM Native

- **Low Event Match Quality** even with CRM data sharing on - middleware lets you normalize and hash exactly per Meta's spec.
- **Multiple destinations** - one workflow: CRM to middleware to Meta CAPI + LinkedIn, Google, etc.
- **Custom event mapping or filtering** - e.g. only send when deal value > X, or only contacts from paid campaigns.
- **Same event_id for pixel + CAPI** - full control for deduplication when the pixel fires with a known event_id and you want CAPI to send the same one.
- **Compliance / data control** - hash in middleware, filter by consent, suppress segments before sending.

### 4.5 Recommended Event Hierarchy for CAPI (B2B SaaS)

Send **one CAPI event per lifecycle stage** you care about. This gives Meta the full conversion funnel for optimization.

| Event name | When to send | Why |
|---|---|---|
| `Lead` (or `initial_lead`) | Contact enters Lead stage - first form or demo request | Top-of-funnel volume signal |
| `marketingqualifiedlead` | Contact becomes MQL | Qualified intent signal |
| `opportunity` | Deal / opportunity created in CRM | Pipeline signal - strong optimization target |
| `customer` | Closed-won in CRM | Revenue signal - best for value optimization |

Set **conversion event priority** in Events Manager so the event you optimize for (e.g. Lead or Opportunity) ranks above PageView and other events.

**Key insight:** The pixel only captures the initial website conversion. CAPI lets you send **downstream CRM events** (MQL, Opportunity, Customer) back to Meta days or weeks later. This is what makes Meta optimization actually work for B2B - you can optimize toward pipeline and revenue, not just form fills.

### 4.6 Required and Recommended CAPI Parameters

| Parameter | Required | Notes |
|---|---|---|
| `event_name` | Yes | Must match your event naming exactly |
| `event_time` | Yes | Unix timestamp when the event occurred |
| `action_source` | Yes | `website` for web conversions, `crm` for offline events |
| `event_source_url` | Yes (for web) | URL where the conversion happened |
| `user_data.em` | Recommended | Email - normalized lowercase, then SHA-256 hashed |
| `user_data.ph` | Recommended | Phone - E.164 format, then SHA-256 hashed |
| `user_data.fn` | Recommended | First name - lowercase, SHA-256 hashed |
| `user_data.ln` | Recommended | Last name - lowercase, SHA-256 hashed |
| `user_data.external_id` | Recommended | Your CRM contact ID, SHA-256 hashed |
| `user_data.client_user_agent` | Recommended (web) | Browser user agent string |
| `user_data.fbc` | Recommended | Facebook click ID (from `_fbc` cookie) |
| `user_data.fbp` | Recommended | Facebook browser ID (from `_fbp` cookie) |
| `event_id` | Required for dedup | Unique ID matching the pixel event_id |

### 4.7 CAPI Best Practices (Summary)

- **Pixel + CAPI** for the same events (redundant setup).
- **Deduplication:** same `event_name` + `event_id` (or `external_id` + `fbp` as a fallback) from pixel and CAPI.
- **Parameters:** send required fields (`action_source`, `event_source_url`, `client_user_agent` for web) and recommended customer information (em, ph, fn, ln, etc.), hashed where required.
- **Real time:** send events as soon as the stage changes (or at least daily).
- **Test:** use Meta's Test Events tool and the Payload Helper to validate.
- **Post-setup:** check Event Match Quality; avoid changing pixels or campaign structure unnecessarily during the learning phase.

---

## 5. Event Deduplication

### 5.1 How It Works

Deduplication happens **in Meta's systems**, not in your CRM or middleware. You send the right identifiers and Meta merges the duplicate events.

**The mechanism:** send the **same `event_id`** and **same `event_name`** from both the pixel (browser, e.g. on the thank-you page) and CAPI (server, from the CRM or middleware when the conversion is recorded). Meta recognizes they are the same conversion and counts it once.

Many partners and Meta's own code do this automatically.

### 5.2 When Deduplication Applies

| Scenario | Dedup needed? | How |
|---|---|---|
| Pixel fires on thank-you page AND CAPI sends when CRM records the lead | Yes | Same `event_id` + same `event_name` from both sources |
| CAPI sends "became Opportunity" (no pixel event exists for this) | No | Only one source - nothing to deduplicate |
| CAPI sends "became MQL" (no pixel event exists for this) | No | Only one source - nothing to deduplicate |

If the conversion **only** exists in the CRM (e.g. "became Opportunity" days later), you only send CAPI - there is no pixel event to dedupe with.

### 5.3 Implementation

1. When the pixel fires a conversion, generate a unique `event_id` and include it in the pixel call:
```javascript
var eventId = 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
fbq('track', 'Lead', {}, {eventID: eventId});
```
2. Pass that same `event_id` to your server / CRM (e.g. via a hidden form field, cookie, or URL parameter).
3. When CAPI sends the event, include the same `event_id`.
4. Meta merges them into one conversion.

**If you cannot pass the event_id between pixel and CAPI:** Meta can also deduplicate using `external_id` + `fbp` (Facebook browser ID) as a fallback. Less reliable, but better than nothing.

---

## 6. Event Match Quality (EMQ) Optimization

EMQ measures how well Meta can match your CAPI events to Meta users. Higher EMQ = better optimization, better attribution, lower CPAs. Check it in Events Manager and aim for 6+/10 or "Good."

### 6.1 EMQ Score Interpretation

| Score | Rating | Action |
|---|---|---|
| 8-10 | Excellent | Maintain current setup |
| 6-7 | Good | Acceptable - minor improvements possible |
| 4-5 | Fair | Improve by adding more user data parameters |
| 1-3 | Poor | Critical - Meta cannot match most events. Fix immediately. |

Low scores (e.g. 3.2-3.8) mean Meta cannot match well - improve user_data or add hashing via middleware.

### 6.2 How to Check EMQ

Events Manager - select your pixel - click on any event - **Event Match Quality** tab shows the score and which parameters are being sent.

### 6.3 Improving EMQ

Send **user_data** with every CAPI event: at least **email** and **phone** (normalized, then hashed per Meta's rules). Optionally add first name, last name, city, state, zip, country, and `external_id` (your CRM ID, hashed).

| Action | Impact | Difficulty |
|---|---|---|
| Add hashed email (`em`) | High - email is the strongest identifier | Low |
| Add hashed phone (`ph`) | High - second strongest identifier | Low |
| Add `fbc` (Facebook click ID) | High - direct click attribution | Medium (requires cookie capture) |
| Add `fbp` (Facebook browser ID) | Medium - browser-level matching | Medium (requires cookie capture) |
| Add first name + last name (hashed) | Medium - improves matching confidence | Low |
| Add country, state, zip (hashed) | Low-Medium - geographic confirmation | Low |
| Add `external_id` (hashed CRM ID) | Medium - persistent identity | Low |

**By integration type:**
- **CRM native (e.g. HubSpot):** use "Data sharing" and select Email, Phone, Click ID (and any other recommended fields) for **all** lifecycle events.
- **Middleware (e.g. n8n):** use normalize + hash (a Crypto node, or a Code node with `crypto.createHash('sha256').update(str).digest('hex')`) so every event includes hashed `em`, `ph`, etc. Meta expects **hex** (lowercase).

### 6.4 Hashing Rules

Meta requires specific normalization before hashing:

| Parameter | Normalize how | Then |
|---|---|---|
| Email | Lowercase, trim whitespace | SHA-256 hash |
| Phone | E.164 format (e.g. +14155551234) | SHA-256 hash |
| First name | Lowercase, trim | SHA-256 hash |
| Last name | Lowercase, trim | SHA-256 hash |
| City | Lowercase, no punctuation, trim | SHA-256 hash |
| State | Two-letter code, lowercase | SHA-256 hash |
| Country | Two-letter ISO code, lowercase | SHA-256 hash |
| Zip | Lowercase (for alphanumeric codes), trim | SHA-256 hash |
| External ID | Trim | SHA-256 hash |

**Output format:** hexadecimal, lowercase. Example using Node.js:
```javascript
const crypto = require('crypto');
const hashedEmail = crypto.createHash('sha256')
  .update('user@example.com')
  .digest('hex');
```

---

## 7. Third-Party / Off-Domain Conversion Tracking (Webinars & Events)

### 7.1 The Problem

When a conversion (e.g. webinar signup, event registration) happens on a **third-party platform** (Luma, Hopin, Zoom, etc.) instead of on your website, your pixel never sees the signup. The user flow is:

1. User lands on your site (with UTM parameters from the Meta ad).
2. User clicks "Register" or "Sign up".
3. User goes to the third-party platform to complete the action.
4. Conversion happens off your domain - the pixel does not fire.

### 7.2 Two Solutions

| Solution | When to use | Setup |
|---|---|---|
| **Pixel in the platform** | Platform supports a Meta pixel (e.g. Luma Plus, event platforms with paid plans). You have or will get the required plan. | Add your pixel ID in the platform settings. The platform sends the conversion event (e.g. `CompleteRegistration`) directly. Add the platform domain to your pixel's **Traffic Permissions** (allow list). |
| **Thank-you page redirect** | Platform does not support a pixel, or you do not have the required plan. Platform can redirect after registration to a URL you control. | Set the post-registration redirect to a thank-you page on your domain. Fire `Lead` or `CompleteRegistration` on that page. Optimize for that event. |

**Recommendation:** Pixel in the platform is best when available (real conversion, one setup). Thank-you page redirect is the fallback when the platform cannot fire the pixel but can redirect.

### 7.3 UTM Passthrough for Third-Party Links

The third-party platform will **not** automatically see the UTM from the page the user was on when they clicked "Sign up." You must pass UTMs through the signup link.

**How:** build the signup link dynamically - read the current URL query string (e.g. `window.location.search`) and append it to the platform's registration URL.

```javascript
// Append current UTMs to third-party signup link
document.querySelectorAll('a[href*="platform.com/event"]').forEach(function(link) {
  var utmParams = window.location.search;
  if (utmParams) {
    var separator = link.href.includes('?') ? '&' : '?';
    link.href = link.href + separator + utmParams.substring(1);
  }
});
```

**Example result:**
- Original link: `https://platform.com/event/xyz`
- With UTMs: `https://platform.com/event/xyz?utm_source=meta&utm_medium=paid-social&utm_campaign=webinar-q1`

This keeps attribution and platform-side reporting correct.

### 7.4 Traffic Permissions (Allow List)

When using a pixel on a third-party domain, you must allow that domain in your pixel settings:

1. Events Manager - Pixel - Settings - **Traffic Permissions**.
2. Add the platform domain (e.g. `lu.ma`, `luma.com`, `hopin.com`, `zoom.us`).
3. Without this, Meta will ignore events from the third-party domain.

### 7.5 Example: Luma

- **Pixel:** Luma Plus - Calendar - Settings - Options - Meta Tracking Pixel. Luma sends PageView, CompleteRegistration (free events), and Purchase (paid events). Add **luma.com** (and **lu.ma** if used) to your Meta pixel Traffic Permissions.
- **UTM:** pass the UTMs from the webinar landing page into the Luma registration URL when the user clicks signup (e.g. via JS appending the current URL params to the Luma link).

### 7.6 Quick Message Template

Use when asking someone (e.g. the event host) to enable pixel + UTM pass-through on their side:

Hi [Name],

Quick ask for [webinar/event name] so we can track signups properly in Meta:

1. **Meta pixel in [platform]** - If you are on [platform plan that includes pixel, e.g. Luma Plus], can you add our Meta pixel in [platform]? ([Where to find it, e.g. Calendar - Settings - Options].) That way we get real "registration" events and can optimize for signups. We will allow [platform domain] in our Meta pixel settings on our side.

2. **UTM on the signup link** - When someone clicks "Sign up" on the [webinar/event] page, we need the same UTM params (from the page they are on) to be passed through to the [platform] registration URL. That keeps attribution correct. If your team can update the signup button/link to append the current URL's UTM parameters to the [platform] link, we are set.

Thanks,
[Your name]

---

## 8. UTM Parameter Strategy for Meta

### 8.1 Recommended UTM Structure

| Parameter | Value | Example |
|---|---|---|
| `utm_source` | `meta` or `facebook` | `meta` |
| `utm_medium` | `paid-social` | `paid-social` |
| `utm_campaign` | Campaign name (match naming convention) | `us-saas-remarketing-90d` |
| `utm_content` | Ad name or creative identifier | `testimonial-video-cfo-v2` |
| `utm_term` | Audience or ad set identifier | `lookalike-crm-customers-1pct` |

### 8.2 Setting UTMs in Meta

| Method | How | Notes |
|---|---|---|
| **URL parameters at ad level** | Add UTMs directly to the destination URL in the ad | Simple, full control, but manual per ad |
| **URL parameters template** | Use dynamic parameters: `{{campaign.name}}`, `{{adset.name}}`, `{{ad.name}}` | Auto-populates from naming convention |
| **url_tags at ad set level** | Set via the API at creation time | Cannot be updated after creation - set correctly the first time |

**Dynamic parameter template example:**
```
?utm_source=meta&utm_medium=paid-social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}
```

**Important:** if using `url_tags` via the API, these are set at creation time only and **cannot be updated**. Double-check before creating the ad set.

---

## 9. Troubleshooting Common Issues

### 9.1 Pixel Not Firing

| Symptom | Likely cause | Fix |
|---|---|---|
| No events in Events Manager | Pixel code not installed or not on the right pages | Verify with Meta Pixel Helper. Check the base code is in `<head>`. |
| PageView fires but conversion events do not | Event code not on thank-you page or trigger not working | Check the conversion code is on the correct page. Test the form submission flow. |
| Events appear in Pixel Helper but not in Events Manager | Pixel blocked by ad blocker or privacy tool | Test in incognito with extensions disabled. Check that CAPI is set up as a fallback. |
| Pixel fires on some pages but not others | Inconsistent installation (e.g. missing on certain templates) | Audit all page templates. Use GTM to fire on All Pages consistently. |

### 9.2 CAPI Issues

| Symptom | Likely cause | Fix |
|---|---|---|
| CAPI events not appearing | Access token expired or invalid | Generate a new access token in Events Manager. Check token permissions. |
| Duplicate conversions (inflated counts) | Missing or mismatched `event_id` for deduplication | Ensure pixel and CAPI send the same `event_id` for the same conversion. |
| Low Event Match Quality (below 4) | Missing or improperly hashed user data | Check hashing rules. Add email, phone, and click IDs. Verify normalization. |
| Events appear as "Unmatched" | User data does not match any Meta profile | Improve data quality. Add more parameters (email + phone + name). |
| CAPI events delayed | CRM workflow triggers are slow or batched | Configure real-time triggers. Send events as soon as the stage changes, not in daily batches. |

### 9.3 Domain Verification Issues

| Symptom | Likely cause | Fix |
|---|---|---|
| Verification stuck on "Pending" | DNS propagation not complete | Wait up to 72 hours. Use a DNS checker to confirm the TXT record is live. |
| Verification fails | Wrong TXT record value or wrong DNS host | Copy the exact value from Meta. Add it at the root domain level, not a subdomain. |
| Events not attributed to verified domain | Domain mismatch between ad URL and verified domain | Ensure the landing page domain matches the verified domain exactly. |

### 9.4 Third-Party Tracking Issues

| Symptom | Likely cause | Fix |
|---|---|---|
| No conversions from webinar/event signups | Pixel not installed in platform or domain not in allow list | Add the pixel to platform settings. Add the platform domain to Traffic Permissions. |
| UTMs lost after redirect to third-party | Signup link does not pass through URL parameters | Implement dynamic UTM appending via JavaScript on the link click. |
| Thank-you page redirect not working | Platform does not support post-registration redirects | Switch to the pixel-in-platform method, or track manually via CAPI based on registration webhooks. |

---

## 10. Pre-Launch Tracking Checklist

Use this before scaling any Meta campaign:

| Check | Status |
|---|---|
| Pixel created and installed on all relevant pages | |
| Pixel firing verified (Events Manager or Pixel Helper) | |
| At least one conversion event firing on actual completion (not click) | |
| Event priority set correctly in Events Manager | |
| Domain(s) verified in Business Settings | |
| CAPI configured (if using) with deduplication | |
| Event Match Quality checked (target 6+/10) | |
| Third-party domains added to Traffic Permissions (if applicable) | |
| UTM parameters set correctly on all ad URLs | |
| Test conversion submitted and visible in Events Manager | |
| Test conversion visible in CRM (if CAPI is configured) | |
| Remarketing audiences building (30-day, 90-day website visitors) | |
| Employee/competitor exclusion audiences created | |

---

> By Ivan Falco - Frontal
