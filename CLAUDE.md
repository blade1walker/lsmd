@AGENTS.md

# Git workflow

- **Pull first.** A SessionStart hook runs `git pull --ff-only` on the current branch. If it reported a failure or the branch is not `main`, run `git switch main && git pull --ff-only` before changing anything.
- **Push to `main` after every finished piece of work.** Commit the change on `main` with a clear message and `git push origin main` — no feature branch or pull request unless asked for one. This is standing permission; there is no need to ask before each push.
- Before pushing: check `git diff` holds only the intended change, never commit secrets (`.env*`), and pull again (`git pull --rebase`) if the push is rejected.
- After pushing, check that the Vercel production deployment for the commit succeeds (the commit's status checks) and report the result. If it fails, fix it and push again.
