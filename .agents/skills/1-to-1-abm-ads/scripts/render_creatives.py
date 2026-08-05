#!/usr/bin/env python3
"""Frontal 1:1 ABM ads - low-text "persona" layout: one headline naming the 5 plays +
the account's own buyer (blue), CTA, logos. Whole ad via gpt-image-2 (/v1/images/edits),
Frontal logo + account icon reproduced exactly. All 5 rendered in PARALLEL. Versioned."""
import os, base64, requests
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

HERE = Path(__file__).parent
load_dotenv(HERE / ".env")
KEY = os.environ["OPENAI_API_KEY"]

FRONTAL_LOGO = HERE.parent.parent / "ad-agent/ad-generator/references/brands/frontal-logo-hq.png"
SCRATCH = Path("/private/tmp/claude-501/-Users-ivan-Desktop-Master-Claude-Folder-Agency/2692b854-f6da-4b6f-a314-9b94b55a888d/scratchpad")

# key, Company, persona phrase (the blue emphasis - their buyer, from the page)
CONFIGS = [
    ("Acme SaaS", "Acme SaaS", "CDOs at 1,000+ employee enterprises"),
    ("hubspot",   "HubSpot",   "RevOps leaders at funded B2B startups"),
    ("lovable",   "Lovable",   "Heads of Product at high-growth startups"),
    ("zendesk",   "Zendesk",   "CX leaders at scaling SaaS companies"),
    ("ramp",      "Ramp",      "CFOs at fast-growing startups"),
]

PROMPT_TMPL = """Create a premium, editorial 1:1 square LinkedIn ad for the B2B GTM agency Frontal. A personalized account-based ad addressed to ONE company: {COMPANY}. The defining quality of this ad is CLEAR VISUAL HIERARCHY: the text is split into distinct size tiers with real contrast between them and generous whitespace separating each tier, so the eye lands on the hero first, then steps down through the supporting lines. It must NOT read as one uniform block of text.

CANVAS: flat solid warm cream background #FEFAF4 (almost white with a faint warm peach tint - NOT pure white, NOT beige, NOT grey). Draw ONE thin 2px hairline rectangular frame in Frontal blue #0B7BFA inset about 45px from all four edges. No gradients, glow, texture, or shadows. Everything left-aligned with comfortable left margin. Heavy, deliberate whitespace between every tier.

TWO REFERENCE IMAGES are attached - REPRODUCE EXACTLY, do NOT redraw, recolor, or restyle:
- Image 1 is the Frontal logo ("COLD IQ" widely-spaced uppercase, "COLD" charcoal, "IQ" blue, beside a faceted blue brain mark).
- Image 2 is the {COMPANY} brand icon mark. Reproduce it EXACTLY, keeping its original colors.

LAYOUT, top to bottom, with FIVE clearly distinct size tiers (the size jumps between tiers ARE the hierarchy - make them obvious, not subtle):

1) TOP-LEFT LOGO LOCKUP (small): Image 2 (the {COMPANY} icon) about 46px tall, and immediately to its right the single word "{COMPANY}" as a bold sans-serif wordmark, warm charcoal #2B2825, about 32px tall, vertically centered with the icon.

2) EYEBROW (TIER 4 - small and quiet): below the lockup with clear space, the text "Hey {COMPANY}," in clean sans-serif (Inter/Geist), regular weight, about 26px, cool charcoal #52525A. A soft personalized lead-in - deliberately the SECOND-smallest text on the ad.

3) HERO HEADLINE (TIER 1 - by far the LARGEST and boldest element, the focal point): on its own, with whitespace above and below, an elegant high-contrast SERIF (Playfair Display style, like a luxury magazine), warm charcoal #2B2825, about 74px, semibold, set across two lines maximum. Verbatim: "We built 5 plays for your GTM". This line must visually dominate - clearly more than twice the height of the eyebrow.

4) CONNECTOR (TIER 3 - medium, subordinate): below the hero with space, "to book more meetings with" in clean sans-serif (Inter/Geist), regular weight, about 30px, cool charcoal #52525A. Quiet bridge into the persona.

5) PERSONA (TIER 2 - the second focal point, the ONLY blue text besides the logo): directly below the connector, the phrase "{PERSONA}." in BOLD SERIF (same Playfair family as the hero), Frontal blue #0B7BFA, about 46px, across up to two lines. Large enough to be a clear second anchor, but smaller than the hero.

6) CTA BUTTON (small): below the persona with clear space, left-aligned, hugging its text width: a solid warm charcoal #2C2926 rounded-rectangle (corner radius about 10px, NOT a full pill), medium padding, white bold sans-serif text about 18px reading "See the full playbook" followed by a right-arrow glyph. No shadow.

7) FOOTER bottom-LEFT: Image 1 (the Frontal logo) reproduced exactly, about 120px wide. Bottom-right stays EMPTY.

STYLE: The Economist meets a premium SaaS brand - warm, confident, spacious, editorial. Charcoal text is WARM (#2B2825), never cold black. Frontal blue (#0B7BFA) appears ONLY on the persona line, the "IQ" in the logo, and the hairline frame. The reading order the design must create: HERO serif first (biggest) -> blue PERSONA second -> eyebrow and connector are visibly smaller supporting text. If any two tiers look the same size, the hierarchy has failed.

DO NOT merge the tiers into one continuous sentence at one size. DO NOT add any other text, label, list, bullet, badge, pill, number, caption, watermark, signature, decorative icon, person, photo, chart, or UI element. DO NOT use a white, beige, navy, yellow, or green background, and no gradients. DO NOT restyle either attached logo - reproduce both exactly. The hero and persona MUST be the elegant serif; the eyebrow and connector MUST be sans-serif."""


def render_one(key, company, persona):
    icon = SCRATCH / f"{key}.png"
    assert icon.exists() and FRONTAL_LOGO.exists(), f"missing reference for {key}"
    out_dir = HERE / "output" / f"frontal-abm-{key}"
    out_dir.mkdir(parents=True, exist_ok=True)
    n = 1
    while (out_dir / f"v{n}.png").exists():
        n += 1
    out_path = out_dir / f"v{n}.png"

    prompt = PROMPT_TMPL.format(COMPANY=company, PERSONA=persona)
    files = [
        ("image[]", ("frontal-logo.png", open(FRONTAL_LOGO, "rb"), "image/png")),
        ("image[]", (f"{key}-icon.png", open(icon, "rb"), "image/png")),
    ]
    data = {"model": "gpt-image-2", "prompt": prompt,
            "size": "1024x1024", "quality": "high", "n": "1"}

    print(f"[{company}] rendering -> {out_path} ...", flush=True)
    r = requests.post("https://api.openai.com/v1/images/edits",
                      headers={"Authorization": f"Bearer {KEY}"},
                      files=files, data=data, timeout=1200)
    if r.status_code != 200:
        return f"[{company}] ERROR {r.status_code}: {r.text[:500]}"
    out_path.write_bytes(base64.b64decode(r.json()["data"][0]["b64_json"]))
    return f"[{company}] SAVED {out_path}"


with ThreadPoolExecutor(max_workers=len(CONFIGS)) as pool:
    futures = [pool.submit(render_one, *cfg) for cfg in CONFIGS]
    for f in as_completed(futures):
        print(f.result(), flush=True)

print("DONE")
