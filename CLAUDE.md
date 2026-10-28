@AGENTS.md

# Git workflow

- **Pull first.** A SessionStart hook runs `git pull --ff-only` on the current branch. If it reported a failure or the branch is not `main`, run `git switch main && git pull --ff-only` before changing anything.
- **Push to `main` after every finished piece of work.** Commit the change on `main` with a clear message and `git push origin main` — no feature branch or pull request unless asked for one. This is standing permission; there is no need to ask before each push.
- Before pushing: check `git diff` holds only the intended change, never commit secrets (`.env*`), and pull again (`git pull --rebase`) if the push is rejected.
- After pushing, check the deploy and report the result. The site runs on an Oracle Cloud VM at https://lsmd.tech (Vercel is disconnected): the "Build for Oracle" GitHub Actions run for the commit must succeed (`gh run list --workflow oracle-build.yml`), and within ~2 minutes after it the VM goes live with it (`ssh -i ~/.ssh/lsmd_oracle ubuntu@130.210.47.31 "journalctl -u lsmd-update -n 20"` shows `Live: <sha>`). Pushes that only touch docs, `deploy/`, `bot/` or `fivem/` skip the build. If it fails, fix it and push again.
