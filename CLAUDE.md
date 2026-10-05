## Session Memory (read this first)

At the start of every session — including after a context clear — read `NOTES.md` in the repo root. It contains the project overview, current status, what's been built, and key decisions. Never ask the user to re-explain things that are already in NOTES.md.

**Keep NOTES.md updated.** When a key decision is made, something is built, or the project status changes, update NOTES.md and commit it. This is how context survives across sessions.

**Context cleared mid-session?** Run `/context-restore` to recover the last gstack snapshot, then re-read NOTES.md.

---

## Permanent principle: DATA COMPOUNDS

CORTX's accumulated reliability history is its moat — the open checker and spec can be copied, the history cannot. Every change must preserve it:

- **Append, don't overwrite.** Observations, config and state changes are new rows/events; current-state columns are caches.
- **Never hard-delete evidence** (no cascading deletes into checks, incidents or events; soft-delete and detach).
- **Every check must be reconstructable on its own**: what was checked (URL, method, input reference, limits, schema), by which code (runner/spec version), what the service said (terms, headers, receipt), what we concluded.
- **Corrections are additive** (record what changed and why; keep originals).
- **Record "couldn't check"** as an observation, not silence.
- **Keep evidence, not secrets or payloads**: hash user inputs, strip credential headers, never store signatures/keys, keep bodies to a preview + hash/shape.

Read `docs/DATA_COMPOUNDS.md` before changing the data model, the check runners, persistence or any migration that updates/deletes existing rows.

---

## gstack (REQUIRED — global install)

**Before doing ANY work, verify gstack is installed:**

```bash
test -d ~/.claude/skills/gstack/bin && echo "GSTACK_OK" || echo "GSTACK_MISSING"
```

If GSTACK_MISSING: STOP. Do not proceed. Tell the user:

> gstack is required for all AI-assisted work in this repo.
> Install it:
> ```bash
> git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
> cd ~/.claude/skills/gstack && ./setup --team
> ```
> Then restart your AI coding tool.

Do not skip skills, ignore gstack errors, or work around missing gstack.

Using gstack skills: After install, skills like /qa, /ship, /review, /investigate,
and /browse are available. Use /browse for all web browsing.
Use ~/.claude/skills/gstack/... for gstack file paths (the global path).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
