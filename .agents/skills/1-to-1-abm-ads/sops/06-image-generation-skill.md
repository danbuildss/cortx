# Image Generation Skill (gpt-image-2)

> READ THIS BEFORE prompting gpt-image-2 for any image task. Skipping this skill is the #1 cause of wasted renders, garbled text, and rejected output. Every mistake documented in the "Mistakes" section below is common and costly - do not repeat it.

## When this skill applies

Any task where the user wants an AI-generated image: posters, infographics, ad creatives, social-post graphics, billboard mockups, restyling an existing image into a different brand, region-edits of an existing render. If the user says "Image GPT 2.0", "ChatGPT Image", "OpenAI image", "gpt-image", "generate an image", "restyle this", "rebrand this post" - this skill applies.

## The hard rules (non-negotiable)

- **RULE #0 - DO NOT DESIGN MANUALLY; PROMPT.** All design is produced by gpt-image-2 through prompting. Do NOT composite, recolor, PIL-patch, white-out, "align", "clean up", "fix", or otherwise TOUCH a render by hand. If a render comes out wrong, it is almost always because the prompt was lazy - no reference images, vague instructions, unclear direction - and NOT because gpt-image-2 "can't do it". The fix is ALWAYS a better prompt with the right reference images attached (the brand logo, the brand, the layout, the exact image being modified), never a manual edit.
  - **Logos: pass the actual logo PNG into the prompt as a reference image** ("use this exact logo, here") - gpt renders it correctly. NEVER PIL-composite a logo. (Famous logos like Samsung/TikTok/Logitech it already knows; for an obscure brand logo, attach the file and tell it to reproduce that one exactly.)
  - **The ONLY times you touch/build something manually:** (a) the user explicitly tells you to touch it, (b) it is a document-ad carousel, (c) the user explicitly says build it in HTML, (d) the user asks for a manual step. That is the LAST resort, only on explicit instruction.
  - **Anything "extra" added on your own initiative is wrong.** Don't recomposite. Don't recolor backgrounds. Don't move logos. Re-prompt gpt instead.
- **NEVER OVERWRITE OR DELETE ANY OUTPUT FILE WITHOUT EXPLICIT PERMISSION. THIS IS THE #1 RULE.** Every render and every graded/processed output costs real money and real time, and the user iterates by comparing versions side by side. Overwriting a file destroys paid-for work and breaks comparison (Preview won't even refresh a same-named file). Therefore:
  - Every output (AI render OR PIL/cv2 post-process) gets a UNIQUE, NEW filename. Always.
  - When a script writes to a fixed filename, re-running it overwrites the prior result. So before EACH run, bump the version: `..._v1.png`, `..._v2.png`, `..._v3.png`, etc. Never reuse a name across runs. A script that hard-codes one output path and gets run 3 times = 2 destroyed versions. Parameterise the version (CLI arg or incrementing suffix) so each run lands a new file.
  - This applies to iterative grading/tweaking too: grade pass 1 -> `grade_v1.png`, pass 2 -> `grade_v2.png`. Do NOT write all passes to `grade.png`.
  - NEVER delete a render/output file without an explicit, fresh "delete" instruction from the user (this inherits the project-wide CONFIRM DELETE rule).
  - If you think a file should be replaced, STOP and ask. The cost of asking is 10 seconds; the cost of overwriting is a destroyed paid render and a frustrated user.
- Use API model `gpt-image-2` (never `gpt-image-1` - that is older). Released 2026-04-21.
- API key in `scripts/.env`.
- Endpoints - use the right one based on WHO the reference image belongs to:
  - `/v1/images/edits` is correct when the reference image is from THE SAME BRAND you are designing for (the brand's own past ads, brand book pages, style swatches), OR when you are iterating on a prior render of THIS deliverable. The model anchors style + structure to the reference, which is what you want when the reference IS the brand.
  - `/v1/images/generations` is correct when the only reference you have is from a DIFFERENT brand being used purely as a LAYOUT/COMPOSITION inspiration. Describe the layout in words from the inspiration; do NOT attach the foreign-brand image to the request. (See "When to use reference images smartly" below - passing another brand's image causes palette/typography/element bleed that negation prompts cannot reliably block.)
- The `image[]` multipart field supports MULTIPLE reference images. The model anchors most strongly to the first one - put your layout reference first.
- **LOGOS/WORDMARKS: gpt-image-2 CAN render the exact brand logo correctly - IF you pass the real logo PNG as a reference image (`image[]`) and prompt it precisely** ("place the attached Sociallyin logo, reproduced exactly, in the top-left at the headline's left margin"). The model copies a wordmark faithfully when it has the actual file to look at. Do NOT lazily default to "gpt can't do logos, I'll PIL-composite it" or claim the model garbles wordmarks - that failure only happens when you give NO logo reference and a vague prompt. The fix for a bad logo is almost always: add the real logo as a reference + describe exactly where it goes, NOT a separate PIL paste. (PIL compositing the logo is a fallback for when you specifically want pixel-exact placement/control, not the default.) **General principle behind this: gpt-image-2 can do almost anything asked of it - bad output is usually lazy prompting (no references, vague instructions), not a model limit. Always attach the relevant references (logo, brand, layout, the exact image being modified) and explain precisely what you want and where.**
- The `mask` parameter (PNG, alpha=0 = redraw region, alpha=255 = preserve pixel-perfect) is the API's NATIVE way to regenerate just one part of an image while leaving everything else exactly as-is. Use it for any "change just this part" task. Do not composite with PIL when the API handles it natively.
- **Resolution: gpt-image-2 supports up to 4K. Iterate cheap, then upscale once locked.**
  - **Iteration default:** `1024x1024` square (or `1024x1536` / `1536x1024` if portrait/landscape needed). Fast, cheap, fine for concepting and review.
  - **Locked concept, high-res final:** ASK the user first. Then bump to `2048x2048` (safe stable 2K) or `2880x2880` (max square, hits the 8,294,400-pixel total cap).
  - **Landscape 4K UHD:** `3840x2160`. **Portrait 4K:** `2160x3840`.
  - **Custom sizes:** both edges multiples of 16, max single edge 3840 px, total pixels 655,360-8,294,400, aspect ratio under 3:1.
  - Native sweet spot is 2K (2048x2048). Above 2560x1440 is documented experimental but works.
  - **Do not auto-bump to 4K on first render.** It costs ~8x and takes ~3x longer. Burn cheap iterations first, quality-up after approval.
  - Old `1024x1024` cap was for gpt-image-1. Do not anchor to that for gpt-image-2 max capability.
  - Quality always `high`.
  - Bump request timeout to 1500-1800s for 2880x2880 multi-reference edits.
- Timeout `1500s` (not the default 600s) for multi-reference edits with masks. They take longer.
- All work output goes to `scripts/output/<task-folder>/v{N}.png`. Never overwrite a previous version.

## The workflow - always follow in order

### Step 0 - Find out which path you are on

Before touching the API, ask the user:

> 1. Are you (a) restyling/repurposing an existing post into your brand, or (b) creating something original from a description?
> 2. Share 1-3 reference images so I can lock the style.

**Path A - Restyling/repurposing**: user provides a post they want to mimic structurally + their own brand reference. (Example: restyling a reference post's Venn diagram into a target brand.)

**Path B - Original from description**: user describes what they want. Brand reference image(s) optional but strongly recommended.

Both paths use the same methodology below. The difference is what plays which reference role.

### Step 1 - Brand extraction (mandatory if user wants their brand applied)

If a brand spec already exists for this user/client, USE that file. Do not re-extract. Check:
- `your client folder/{client}/brandbook/`
- `your client folder/{client}/{client}-brand-spec.md`
- `your brand-assets folder/{CLIENT}_BRAND_SPEC.md`

If no spec exists, follow [BRAND_EXTRACTION_PROMPT.md](BRAND_EXTRACTION_PROMPT.md) to extract one from the reference image(s). Save the extracted spec to disk under the most appropriate of the paths above. Show the user the extracted spec for confirmation before rendering.

### Step 2 - Decide which reference image plays which role

Critical thinking matters here. Each reference image is a different signal to the model:

- **Layout reference** - structural template. Positions, geometry, composition. Goes FIRST in `image[]`.
- **Brand reference** - visual style. Colors, fonts, footer pattern, textures. Goes second.
- **Element reference** - a single piece to copy faithfully (a wordmark, a button shape, an icon).

If the user gave you three references and one shows a flowchart while they're asking for a flowchart-style infographic - that's your layout anchor. Match each reference to a role deliberately, and tell the user which is doing what before you render.

### Step 3 - Write a pixel-precise prompt

The prompt must be specific enough that a sighted designer could reproduce the image WITHOUT seeing the reference. Then ALSO attach the reference and refer to it explicitly in the prompt. Three signals to the model: detailed text + visual reference + verbal description of what is in the reference.

For every text element in the output, specify:
- The EXACT words in quotes
- The position
- The role (title / headline / body paragraph / tag label / caption / button text)
- The font weight and color
- A boundary clause saying what is NOT in this element

**Anti-pattern** the model will misinterpret:
> "Add a Problem tag with a description below"

The model will fill the description with hallucinated problem-content. Specify:
> "Add a small rounded pill in the top-left containing ONLY the single word 'Problem' (this is a category label tag - the pill contains no other text, no description, no body copy). Below the pill draw a separate text block with the verbatim sentence: 'Founders run out of cash before they know it.' Nothing else in this block."

For every shape: dimensions, fill, outline, radius. For every color: hex code. Never write "modern sans-serif" without naming a specific family (Inter, SF Pro, Helvetica). Never write "some bullets" without listing the bullets verbatim. The model will not interpret your intent - it will pattern-match from training data and add things you do not want.

### Step 4 - Run with the right tool

Decision tree:

- **Restyle whole image + replace brand** -> `/v1/images/edits`, layout-ref first + brand-ref second via `image[]`, no mask.
- **Change only a specific region** (footer, billboard, headline, a single card) -> `/v1/images/edits`, primary image + `mask` parameter, optionally a style reference via `image[]`.
- **Delete an element** -> `/v1/images/edits` with a mask covering the element + a prompt that explicitly tells the model NOTHING should be drawn there. "Remove via prompt" alone is unreliable.
- **Pure original from description, no reference** -> `/v1/images/generations`. Rare.

If the safety filter blocks (HTTP 400 `moderation_blocked`):
- Cause: real human face in an input image + a named person in the prompt = filter trips.
- Fix: PIL-mask the face area (`ImageDraw.ellipse` over the avatar, or crop the band). Keep the rest of the reference image visible so the model still gets the layout/style signal. Retry.
- Do NOT drop the reference image entirely. Layout fidelity collapses to pure text-to-image quality. (Documented mistake #1 below.)

### Step 5 - Verify the output BEFORE reporting success

Open the output via `Read` and look at it. Check:
- Every word in the image is legible and spelled correctly.
- Every hex code from the brand spec is visibly present.
- Every prompt element is in the image at the right position.
- No surprise watermarks, signatures, hallucinated logos, or model-added decorative junk.
- If a mask was used: no hard seam at the mask boundary, gradient flows naturally.

If anything fails, identify WHAT is wrong before re-rendering. Do not blindly retry. Do not claim success without verification.

### Step 6 - Iterate by using v_N as the new reference

When most of the output is great but one area needs a fix:
- Pass `v_N.png` as the primary `image[]` reference (it is face-free since we never had the model draw a face - so it passes the safety filter freely).
- Build a `mask` PNG that marks just the area to redraw.
- Prompt: "reproduce the first reference pixel-perfect EXCEPT in the masked region, where you should draw [X]."

This is how you refine without losing the parts that already work. Cheaper than re-rendering from scratch.

## Common mistakes (do NOT repeat any of these)

Each of these wastes a render, time, or trust. They are documented so the next session avoids them.

1. **Dropped reference images when the safety filter fired.** Switched to pure text-to-image. Layout collapsed - Venn proportions, bullet placement, step-card spacing all drifted from the source. Correct move: PIL-mask the face in the input image, keep the reference. Reference images are load-bearing for fidelity, not optional.
2. **Composited a footer with PIL when the API's `mask` parameter does it natively.** Result had a visible horizontal seam between the prior version's gradient and the pasted strip - because one pixel color was sampled for fill instead of continuing the gradient. Correct move: use the `mask` parameter from the start for any single-region edit. The model blends the gradient seamlessly because it understands the surrounding context.
3. **Painted a blank avatar circle in a poorly-aligned position via PIL.** Coordinates were calculated against the original image then applied to a resized image without proper scaling. Correct move: have the model draw the blank slot via prompt, not draw it ourselves.
4. **Asked the model to redraw small text it cannot render reliably.** Footer-scale wordmarks (a ~28px wordmark) came back as garbled letterforms in single-pass generations. Correct move: **pass the actual brand logo PNG as `image[]` and tell the model exactly where to place it, and gpt-image-2 reproduces it correctly.** The garbling only happens with NO logo reference + a vague prompt. Defaulting to "gpt can't do logos so I'll PIL-paste it" is lazy prompting. The model can do almost anything - give it the references and be precise. (Composite in Figma at vector quality only as a last resort when you need pixel-exact placement.)
5. **Claimed sharpness without checking.** Reported that a wordmark rendered sharp and correct when it was still garbled. Correct move: view the actual file via `Read` before reporting success. Always.
6. **Talked when the right move was to ship.** Multiple back-and-forth turns explaining what was about to happen when a clean execution would have been one render and one short report. Correct move: do the work, verify the output, then explain in <100 words.
7. **Did not use the `mask` parameter on iterative edits.** Tried prompt-only "redraw the footer" instructions. The edit endpoint mostly ignored them - the input image was treated as the anchor and small textual changes were silently dropped. Correct move: when you say "redraw this region" you MUST use a mask. Prompt-only region edits do not work reliably.
8. **Tried to delete the CTA strip through prompt instead of masking it.** Asking the model "do not include the X strip" through prompt is unreliable - the model often preserves it from the input anyway. Correct move: mask the strip area and prompt "leave only the background gradient here."
9. **Hit a `Read timed out` because default timeout was too short.** 600s is not enough for 2+ reference image edits with masks. Correct move: bump to 1500s for any complex edit.
10. **Did not save the brand spec.** Re-extracted the brand on every render attempt instead of saving it to disk once and referencing it. Correct move: first time you extract a brand, save it. From that point on, read the saved file - do not re-extract.
11. **Did not anticipate that gpt-image-2 cannot render dense small-text infographics cleanly.** The model has hard limits on small-text sharpness regardless of prompt. Correct move: set expectations upfront. If the design has lots of small text, either accept softness, reduce text density, OR render the design without text and composite text in Figma at vector quality.
12. **Made the user re-explain the simple fix multiple times.** "Just take the footer from Image 2 and put it on the current version." Correct first answer: use the `mask` parameter, region-edit the footer, pass the current version as the primary image and image 2 as the style reference. One render. Done.
13. **Sent a one-line "reproduce this image, only change X" prompt to `/v1/images/edits`.** Result: the model dropped the top pill entirely, kept the WRONG label text, removed the character's eyebrows, removed the sweat drops, AND added a NEW white UI bar at the bottom of the magenta rectangle. Edit endpoint without a mask does NOT respect "just upscale" or "only change X" - it re-imagines anything not explicitly anchored in the prompt. Correct move: even when iterating via `/v1/images/edits` with the approved version as reference, write a FULL pixel-precise prompt that describes every element of the reference verbatim (canvas + pill text verbatim + headline text verbatim with font weights + character face features one by one + every secondary object with name/color/pose), THEN list the surgical edits at the END, THEN add explicit "DO NOT" guardrails for every element the model dropped in prior rounds. See `render_readyset_carrying_v5_precise.py` and `render_readyset_carrying_v5_B.py` for working examples.
14. **Passed a different brand's screenshot as `image[]` to anchor LAYOUT for our brand's deliverable.** The brief said "use this image as layout inspiration only, NOT its branding" - it was attached via `image[]` with strong "DO NOT use cream/brown/financial labels" negation guardrails in the prompt. Negation lost. The model bled the reference brand's palette/font feel/card vibe into the output even with explicit hex codes for the new palette. Negation prompts cannot reliably block a foreign brand's reference signal when that reference is on the request. Correct move: when the only reference you have is from ANOTHER brand and you only want its LAYOUT, do NOT attach it. Describe the layout in words yourself (sit and look at the image, write what you see), then use `/v1/images/generations` with pure text prompt. Save reference-attaching for OWN-BRAND references where style bleed is the goal. (See "When to use reference images smartly" below.)
15. **Over-aggressive mask wiped out the actual content to preserve.** Tried to clear a "bottom strip" for logo compositing with a mask covering Y=844-1024. That strip contained the bottom of every secondary card in the illustration. Result: only the tall magenta dominant block survived; all 5 chiller blocks were deleted. Correct move: before drawing a mask, READ the source image and identify which pixel coordinates contain content you must preserve. The mask should only cover region that is truly empty in the source OR region whose content you want to fully replace. For "clear a strip for logo" tasks where blocks already extend into that strip, the fix is NOT a mask - it's re-render with the strip explicitly reserved as empty in the prompt's structural spec from the start.

## When to use reference images smartly

Reference images are a STYLE / BRAND signal to the model, not a layout hack. They work best when used carefully. The rule of thumb (from mistake #14):

**DEFAULT: describe in words. Reference images are the exception, not the default.**

Most design intent (layout, composition, copy placement, geometry, colors via hex codes, fonts via family name) can be conveyed in a pixel-precise text prompt. Only reach for `image[]` when there is something the model genuinely cannot understand from words alone.

**When TO attach reference images:**
- The thing you need to convey is hard to articulate in words. Examples: a specific illustration system's "feel", a brand's signature line-weight, a particular color rhythm, a brand book's typography pairing, a unique illustration character cast.
- The reference is from the SAME BRAND you are designing for. You want the model to absorb the brand's existing style and apply it to a new layout.
- You are iterating on a prior render of this same deliverable (v_N as reference for v_N+1, optionally with a mask for region edits).

**When NOT to attach reference images:**
- You only have a layout/structural inspiration from a DIFFERENT brand. The model will absorb that other brand's palette, font feel, and elements regardless of how strong your "DO NOT use their colors" negation prompt is. Negation lost in mistake #14 even with explicit replacement hex codes in the prompt.
- The thing you want to convey can be fully captured in words. Coordinates, copy verbatim, colors via hex codes, fonts by family + weight, dimensions, positions - all describe well in text.
- The reference image's branding (palette, typography, distinctive visual elements) would actively conflict with the target brand.

**The correct pattern for "we want this layout but in OUR brand":**
1. Sit with the inspiration image yourself. Look at it. Identify the structural elements: how zones are stacked, how shapes are sized relative to each other, what the depth-layering reads as, where the focal point sits.
2. Translate that structure into words in the prompt (pixel-precise spec, 4-zone layout, dimensions, positions).
3. Attach OWN-BRAND reference images (the brand's prior ads, brand book swatches, a style page) as `image[]` to anchor brand style - NOT the foreign inspiration.
4. Fire via `/v1/images/edits` (if own-brand refs are attached) or `/v1/images/generations` (if no refs).

**The wrong pattern:**
Attach the foreign-brand inspiration as `image[]` and try to override its branding via negation prompts ("DO NOT use cream, DO NOT use financial labels, DO NOT use their fonts"). The model has been trained to anchor heavily to attached images; negation is a much weaker signal than the image itself. Bleed is the default outcome, no matter how detailed your DO NOTs.

Practical heuristic: if you can describe what you want the layout to do in 5 clear sentences, you don't need the reference image attached. Describe it.

## The pixel-precise edit prompt pattern (mandatory for /v1/images/edits without mask)

When iterating on an approved image via `/v1/images/edits` (whole-image reproduce + surgical edits, no mask), use this exact structure. Skipping any of the three sections causes the drift documented in mistake #13.

```
Reproduce the attached reference image at <SIZE> resolution. Preserve EVERY element of the
reference exactly as described below, except for the <N> surgical edits at the END.

EXACT DESCRIPTION OF THE REFERENCE IMAGE - preserve all of this verbatim:

CANVAS: <bg color hex>, <style descriptor>, <aspect ratio>.

<ZONE 1 NAME>: <position> <object/text>. <Text verbatim in quotes if any>. <Font + weight + color hex>.

<ZONE 2 NAME>: <position> <object/text>. <verbatim>. <styling>.

<MAIN SUBJECT>: <position, pose, body description>.
- <Feature 1>: <every visible detail - eyes/brows/mouth/sweat/etc>.
- <Feature 2>: <every visible detail>.
- <Label>: <verbatim text + font + color + position>.

<SECONDARY OBJECTS>: list EACH one by name with its color, pose, label.
1. <NAME> - <color> <shape> <pose> <label>.
2. <NAME> - <color> <shape> <pose> <label>.
...

<EMPTY ZONES>: state explicitly which zones are empty and what they reserve for (e.g.,
"bottom-left corner is empty off-white background - no characters, no objects").

==================
THE <N> SURGICAL EDITS - ONLY these changes, nothing else:
==================

EDIT 1: <surgical change with target element + new value + same-as-before properties>.
EDIT 2: <...>

DO NOT change anything else. Do NOT <every element the model dropped or modified in prior
rounds, listed explicitly>. Do NOT add a <thing the model invented last time>. Do NOT add
any logo or wordmark in <reserved zone> (stays empty for separate compositing). Do NOT add
additional text, captions, footers, watermarks, signatures.
```

Guardrail principles:
- Every element you've seen the model drop in a prior round of THIS image must be re-listed as a "DO NOT remove" or "DO NOT add" line.
- Verbatim text must be in quotes. Don't paraphrase.
- Position language must be unambiguous ("centered on the magenta body", "top of the rectangle", not "above").
- The model treats empty zones as "fair game to fill" unless you explicitly reserve them.
- Logo/wordmark zones reserved for PIL compositing must be marked "stays empty for separate compositing" in the DO NOT block.

Iteration cadence that works: minimal one-line -> drift observed -> pixel-precise -> new drift observed -> pixel-precise WITH guardrails listing the new drift items as DO NOTs. Each round bakes the previous round's failures into the next prompt.

## Critical thinking notes (use judgment - these are not rigid rules)

- **The model anchors heavily to the FIRST reference.** Whatever you put first dominates the structure. Choose deliberately - layout-ref always first.
- **Iterative refinement is cheaper than re-rolling from scratch.** If v_N is 80% right, mask and fix the 20%. Do not re-render from a different prompt unless v_N is fundamentally broken.
- **The model does not understand "remove" through prompt alone.** It understands "mask + paint nothing here." If you need to delete an element, mask it and instruct the area be background only.
- **Set the user's expectation that 2-3 iterations is normal.** Do not promise a pixel-perfect first render. Promise a process: layout -> brand application -> footer polish -> done.
- **When in doubt, ask before rendering.** A 30-second clarification beats a 3-minute render that misses the brief.
- **Accept text softness as a hard model limit when the design has lots of small text.** Communicate this to the user upfront rather than letting them be disappointed after the render. Then offer the post-render compositing path as an option.
- **Multi-reference is often the right move for typography fidelity.** If a brand has a specific wordmark, include a reference where that wordmark renders clearly. The model copies it visually.
- **Brand specs decay.** If the spec was saved months ago, verify the live brand is still the same before treating the spec as gospel.

## The hybrid technique: AI background + PIL composite (product/dashboard ads)

> NOT A DEFAULT. See RULE #0. Only use PIL compositing when the user explicitly asks for it, it's a document ad, or it's an explicit HTML build. Default to prompting gpt-image-2 for the WHOLE thing (logos included, passed as references). Reaching for PIL on your own initiative is the mistake to avoid.

This is the highest-quality way to build an ad that features a REAL product UI
(dashboard, app screenshot) + a headline.
The core idea: **never ask gpt-image-2 to draw the dashboard OR the headline text.**
It softens dense UI and garbles exact words. Split the job by what each tool is best at.

**Division of labour:**
1. **gpt-image-2 renders ONLY the background atmosphere** - a premium gradient. No
   text, no UI, no logos, no objects. This is the one thing AI does better than
   math: an organic, premium glow that a flat PIL gradient can't match (a flat
   math gradient is exactly the "generic / cheap" look clients reject).
2. **PIL composites everything sharp on top:** the real screenshot (rounded
   corners + lift shadow + ambient glow + hairline edge, bled off an edge),
   the brand wordmark (a logo PNG, never AI-drawn), and the headline/subhead as
   real-font text. Draw arrows/chevrons as vectors - fonts lack the arrow glyph (renders as tofu).

**The background prompt pattern** (worked for a restrained deep-navy fintech glow):
> "A premium dark abstract background for a fintech ad. 4:5 portrait. Base colour
> near-black #151515. A rich, deep NAVY-to-black RADIAL gradient glow emanating
> softly from the upper-centre, fading to near-black at the edges. Over it, a very
> faint concentric orbital texture: subtle thin rings / soft radial light streaks,
> extremely low contrast, premium and atmospheric. The navy must stay DEEP and
> restrained (#0B1B2E to #151515), never a bright cyan wash. No text, no logos, no
> UI, no charts, no objects, no people. Cinematic, high-end SaaS."
Keys: name the base hex, the glow direction + depth, a faint texture, a RESTRAINED
palette ceiling, and a hard negatives list. Generate 2 (centre-glow + corner-glow)
for layout flexibility. (`/v1/images/generations`, gpt-image-2, `n` must be an
integer in JSON, size e.g. `1024x1280`.)

**The design principles that made it look professional** (the model does not apply
these by default, you must):
- **One hero element.** The headline is the hero (large, bold). Everything else is
  supporting. Don't let the product screenshot dominate or compete.
- **Follow the client's PROVEN/original layout, don't invent.** Pull their existing
  winning creative, replicate its structure (wordmark TL -> headline -> subhead ->
  visual), and swap in the new branding elements. "Make 6 different layouts" usually
  reads as "same thing, headline moved" and fails - replicate one good layout well.
- **The product screenshot must be proportionate, big enough, and STYLED.** Not a
  small centred clip-art card with even margins. Size it to fill its zone with no
  dead gap; bleed it off an edge (bottom/right) so it reads as a real app window;
  round only the visible corners; add a lift shadow + ambient brand-colour glow +
  hairline light edge. Crop to the hero region (the chart) - never dump a dense
  data table.
- **Restrained accent colour.** Brand accent only on ONE emphasis
  phrase in the headline + the CTA. Spraying it everywhere kills the signal.
- **Emphasis = weight, not italic.** Bold the emphasis; italic reads spammy (brand-
  specific, but "match the brand's real ads" is general).
- **Generous, even margins. No dead space.** If there's a navy gap, the visual is too
  small - enlarge it.
- **Verify by viewing the file, then iterate sizing/styling.** 2-3 rounds is normal.

**Reference scripts:** `agicap_hybrid_bg.py` (background generation) and
`agicap_square.py` (the styled PIL composite with `paste_styled_bleed`, mixed-colour
headline wrapping, logo paste, vector CTA arrow).

## Photoreal "iPhone look" for photos of REAL people (identity-safe) - hard-won learnings

This is the recipe that finally worked for "make this group photo of real people look like a natural iPhone snapshot" without wrecking their faces. Reuse it.

### The #1 lesson: NEVER AI-repaint a real person's face
- **gpt-image-2 (the `edits` endpoint) ALWAYS changes a real person's identity when it repaints their face - even with a tight mask, even with "keep the exact same face, identity locked, do not change features" in the prompt.** There is NO prompt that prevents this. It has been proven repeatedly (whole-image re-render and masked-to-faces re-render both changed the faces). The user's faces are sacred - a changed face is an instant failure.
- Therefore: once you have a base image with the right faces, **do every realism/look adjustment with pure pixel post-processing (PIL / numpy / cv2), never another generative pass over the face.** Pixel ops are mathematically identity-preserving. AI re-renders are not.
- AI generation is for CREATING the scene/composition/likeness. Once the likeness is approved, switch to pixel post for grade + realism. Do not go back to the model to "refine skin / add texture / soften" - it will re-roll the face.

### What "more realism / iPhone feel" actually means (and doesn't)
- It is NOT "richer, more saturated, sharper, more texture, more wrinkles, hyper-real." Users asking for realism usually mean the OPPOSITE: **less is more.** Match a real phone photo's restraint.
- Get a REAL phone photo of the same subject as a look reference and replicate ITS colour science: muted / slightly desaturated, neutral-to-slightly-cool white balance (NOT warm golden), flat low contrast, soft even light. A warm "epic golden-hour" grade is the #1 thing that reads as fake/AI.
- "Softer, thinner, more precise lines" (wrinkles, hair strokes, edges) is NOT blur. Blurring the detail layer or strong negative-clarity both read as "you just blurred it" and get rejected.

### The grade recipe (pure pixel - `post_regrade_match.py`)
Match a target real-photo look on the actual pixels (identity untouched):
1. **White balance**: neutralise the golden cast toward neutral, do NOT tint cool/blue (cool tint kills real-life skin). e.g. R*0.965, G*1.0, B*1.025.
2. **Kill the sun on a cloudy day**: build a mask of pixels that are BOTH bright AND warm (`lum` high AND `R-B` high), feather it, then neutralise warmth there (pull R/B toward their mean) and gently pull the hot highlights down to an overcast level. This removes sun glow in the sky AND sun highlights on faces/arms - the user will notice an inconsistent sun on a cloudy day.
3. **Saturation**: keep natural, only a touch restrained (~ -5%, `hsv[...,1]*=0.95`). Do NOT crush to grey - that reads dead, not real.
4. **Contrast**: flatten slightly (`(x-0.5)*0.91+0.5`) + tiny shadow lift (`+0.03*(1-x)`). No colour tint in shadows.

### The "natural soft, iPhone" finish (pure pixel - `post_natural_soft.py`) - the move that landed
To soften harsh AI strokes WITHOUT it reading as blur, the secret is **faint film grain**:
1. **Tiny bilateral, lightly blended** (~18-28%): `cv2.bilateralFilter(img,5,14,14)` blended at 0.18-0.28 - eases only the harshest over-sharpened micro-transitions.
2. **Gentle negative clarity** (amount 0.10-0.16, sigma ~6): `img - amt*(img - GaussianBlur(img,6))` - eases the "carved" mid-frequency line contrast a touch.
3. **Faint fine film grain** (zero-mean, sigma ~2.2-2.6): THIS is what converts the perception from "blurred" to "real phone photo." Softening alone always reads as blur; softening + grain reads as natural. No grain = rejected as blur.
- Keep it SUBTLE and offer 2 dial strengths. "Almost there, just slightly softer, don't overdo it" is the usual target. Zero brightness/colour shift (grain is zero-mean; ops are luminance-neutral).

### Process rules that keep the session on track
- **Always work from the user's stated BASE image, never from your own previous output.** When the user says "this image," persist it (e.g. `refs/trio/BASE_imageNN.png`) and branch every attempt from it. Iterating on your own altered output compounds errors.
- **Every output gets a unique versioned filename** (see the #1 hard rule at the top). Never overwrite - each render/grade costs money and the user compares versions side by side.
- **`open` the file after saving** (macOS `open path.png`) so the user sees it, and `Read` it yourself to verify before claiming success.
- Render the cheap iterations (1024x1280) for look approval; only the FINAL detail genuinely needs the source resolution. True higher-res of a real face only comes from an AI re-render - which changes the face - so the honest max resolution is the approved base's native size (upscale with Lanczos for nominal "hi-res", but say so).

## Quick-reference: API parameter cheatsheet

```
POST https://api.openai.com/v1/images/edits
Authorization: Bearer <key>
Content-Type: multipart/form-data

Fields:
  model:    "gpt-image-2"               (always - never gpt-image-1)
  prompt:   <pixel-precise prompt>      (see Step 3)
  size:     "1024x1536"                 (portrait) | "1536x1024" (landscape) | "1024x1024"
  quality:  "high"                      (always)
  n:        "1"                         (single output)
  image[]:  <layout-ref.png>            (first - anchors structure)
  image[]:  <brand-ref.png>             (second - anchors style)
  mask:     <mask.png>                  (optional - alpha=0 = redraw region)
```

For generations (no reference):
```
POST https://api.openai.com/v1/images/generations
Body: same fields except no image[], no mask.
```

## Files referenced by this skill

- [BRAND_EXTRACTION_PROMPT.md](BRAND_EXTRACTION_PROMPT.md) - how to extract a brand spec from a reference image
- Worked example (footer-swap): `render_pipeline_multiplies_ivan_brand_v[1-5].py` (mistakes), `composite_footer_v[6-7].py` (more mistakes), `render_footer_swap_v8.py` (the correct approach using `mask`)
- Worked example (pixel-precise edit pattern): `render_readyset_carrying_v4_edit_upscale.py` (the lazy one-line prompt that drifted), `render_readyset_carrying_v5_precise.py` + `render_readyset_carrying_v5_B.py` (the working pixel-precise + guardrails approach)
- Worked example (PIL logo composite after render): `composite_readyset_logo_v5.py` - composite the brand wordmark via PIL after the AI render only when you need pixel-exact placement
- Brand spec storage: `your client folder/{client}/brandbook/` or `your brand-assets folder/{CLIENT}_BRAND_SPEC.md`

---

> By Ivan Falco - Frontal
