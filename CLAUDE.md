@AGENTS.md

# Git workflow

- **Pull first.** A SessionStart hook runs `git pull --ff-only` on the current branch. If it reported a failure or the branch is not `main`, run `git switch main && git pull --ff-only` before changing anything.
- **Push to `main` after every finished piece of work.** Commit the change on `main` with a clear message and `git push origin main` — no feature branch or pull request unless asked for one. This is standing permission; there is no need to ask before each push.
- Before pushing: check `git diff` holds only the intended change, never commit secrets (`.env*`), and pull again (`git pull --rebase`) if the push is rejected.
- After pushing, check the deploy and report the result. The site runs on an Oracle Cloud VM at https://lsmd.tech (Vercel is disconnected): the "Build for Oracle" GitHub Actions run for the commit must succeed (`gh run list --workflow oracle-build.yml`), and within ~2 minutes after it the VM goes live with it (`ssh -i ~/.ssh/lsmd_oracle ubuntu@130.210.47.31 "journalctl -u lsmd-update -n 20"` shows `Live: <sha>`). Pushes that only touch docs, `deploy/`, `bot/` or `fivem/` skip the build. If it fails, fix it and push again.

# Coding guidelines

Behavioral guidelines to reduce common LLM coding mistakes. These bias toward caution over speed; for trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
