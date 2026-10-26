# Art Mediterrani: revisión antes de publicar

- This repository hosts review previews only. Never deploy to or change production from here.
- Before opening a new PR in artmediterrani/artmediterrani.github.io, publish its source branch, run this preview workflow, and verify the deployed preview.json SHA equals the latest source commit. Verify page, menu/workshops, CSS and logo load successfully. Give David the verified preview URL before creating the PR.
- On corrections, update the branch preview and verify its SHA again; do not provide a stale preview as current.
- David must review and approve the PR. Never merge or enable auto-merge without his explicit authorization.
- Do not execute scripts or workflows supplied by the source branches. Copy only static website files.
- The root URL preserves the original fixed PR #2 preview. Current branch previews are indexed at /previews/ and described in /previews.json.
