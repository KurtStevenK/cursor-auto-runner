# Agent guide — shipping changes and releases

`master` is **protected**: no direct pushes. All changes land via **pull request**. Deployments and releases are **fully automated in GitHub Actions** after merge or tag push.

## Day-to-day code changes

1. Create a branch from `master`.
2. Implement changes; update `CHANGELOG.md` under **Unreleased** when user-facing.
3. Open a PR to `master`.
4. Wait for the **CI** workflow (`quality` job) to pass.
5. Merge the PR (squash or merge commit — either is fine).

**Optional (recommended after the first CI run on a PR):** in GitHub **Settings → Branches → master → Edit**, enable **Require status checks** and select the **`quality`** check from the **CI** workflow so merges cannot skip tests.

**What runs on merge to `master` (path-filtered):**

| Workflow | Trigger paths | Result |
|----------|---------------|--------|
| [CI](.github/workflows/ci.yml) | all pushes to `master` | Windows test suite |
| [Deploy landing page](.github/workflows/pages.yml) | `landing/**` | GitHub Pages |
| [Deploy Firebase landing](.github/workflows/firebase-landing.yml) | `firebase-landing/**`, `firebase.json`, etc. | Firebase Hosting |
| [CodeQL](.github/workflows/codeql-analysis.yml) | `master` | Security scan |

Agents must **not** push to `origin master`. Use `gh pr create` and merge, or ask the user to merge.

## Releasing installers (v* tags)

Releases are **not** tied to pushing `master`; they run on **tag push** `v*` ([Build releases](.github/workflows/build.yml)).

1. Ensure `master` contains the release commit (via merged PR).
2. Set `package.json` `version` to the release (no leading `v`).
3. Move `CHANGELOG.md` items from **Unreleased** to `## [X.Y.Z] - date`.
4. Commit those version/changelog updates on a branch → PR → merge to `master`.
5. From the merged `master` tip:

   ```bash
   git fetch origin master
   git checkout master
   git pull origin master
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

   Pushing the **tag** is allowed while `master` is protected. Do **not** `git push origin master`.

6. Watch [Build releases](https://github.com/KurtStevenK/cursor-auto-runner/actions/workflows/build.yml). Success means: GitHub Release assets, Homebrew tap, APT `gh-pages`, optional Firebase mirror, Chocolatey (if moderation allows).

### If a release workflow fails

- Re-run the failed job on the tag in the Actions UI, or push an empty commit via PR and a new patch tag — do not force-push tags.
- Secrets inventory: [SECURITY.md](SECURITY.md). Hosting deploy needs `FIREBASE_TOKEN` or Hosting-capable service account (see [packaging/linux/firebase/README.md](packaging/linux/firebase/README.md)).

## Manual workflow_dispatch

- **Build releases** — only for emergencies; normal path is tag push.
- **Deploy Firebase landing** / **Deploy landing page** — redeploy without code changes.
- **chocolatey-push** — after Chocolatey moderation approves a version.

## Checklist for agents (short)

- [ ] Branch + PR, never push `master`
- [ ] CI green on PR
- [ ] Changelog + version bump in PR when releasing
- [ ] Tag `vX.Y.Z` on merged `master`, push **tag only**
- [ ] Confirm Actions: CI, then Build releases, then path-based deploys if relevant
