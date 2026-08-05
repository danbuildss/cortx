## Session Memory (read this first)

At the start of every session — including after a context clear — read `NOTES.md` in the repo root. It contains the project overview, current status, what's been built, and key decisions. Never ask the user to re-explain things that are already in NOTES.md.

**Keep NOTES.md updated.** When a key decision is made, something is built, or the project status changes, update NOTES.md and commit it. This is how context survives across sessions.

**Context cleared mid-session?** Run `/context-restore` to recover the last gstack snapshot, then re-read NOTES.md.

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
