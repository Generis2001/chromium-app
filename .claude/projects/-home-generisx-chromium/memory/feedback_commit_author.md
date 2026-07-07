---
name: feedback_commit_author
description: All commits in this project must be authored by wpsdocs9@gmail.com
metadata:
  type: feedback
---

All commits should be authored by wpsdocs9@gmail.com (name: generis). Never add a Co-Authored-By trailer.

**Why:** User explicitly requested this email for attribution and said no co-author.

**How to apply:** Use `--author="generis <wpsdocs9@gmail.com>"` on every `git commit` command in this repo. Do not change the global git config. Do not append any `Co-Authored-By:` line to the commit message.
