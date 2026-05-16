<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Autopilot push policy (approved 2026-05-16 by Hamid)

Pushing the working autopilot branch to GitHub is pre-approved when ALL of these hold:

1. Not pushing to `main`.
2. No force push (`--force`, `--force-with-lease`).
3. No history rewrite (`rebase -i`, `reset --hard` on shared branches, `filter-branch`, `filter-repo`).
4. No branch deletion (`push --delete`, `branch -D` on remote).
5. Not merging into `develop`/`main`.
6. No production deploy.
7. Branch name is clearly safe: `autopilot/night-audgen-YYYY-MM-DD`, `chore/*`, `fix/*`, `feat/*`.
8. `git status` was run before pushing.
9. `git diff` (and `git log -p` for unpushed commits) was inspected before committing.
10. No secrets, `.env` files, API keys, tokens, cookies, or credentials in the diff.
11. Commits are small and clear (Conventional Commits).
12. Only the working branch is pushed.

Approved pattern:

```
git status
git diff --stat
git push -u origin <CURRENT_BRANCH>    # first push
git push                                # subsequent pushes
```

If push fails (credentials, SSH auth, token, remote permissions):
- Log the exact non-secret error to `NIGHT_REPORT.md`.
- Stop retrying.
- Continue safe local work.
- Only escalate to Hamid if all useful work is blocked.

Still requires Hamid approval:
- Merging a PR.
- Production deploy.
- Force push, history rewrite, branch deletion.
- Database-destructive commands.

Opening a PR (without merging) is allowed if tooling supports it.
