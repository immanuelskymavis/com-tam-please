#!/usr/bin/env bash
# Build and publish to the gh-pages branch.
#
# GitHub Pages serves a project site from /<repo>/, so the build needs a matching
# base. The repo name comes from the git remote, NOT the local folder name — those
# differ here, and using the folder name ships a page whose asset URLs all 404.
# Uses a temporary git worktree so your working tree is never touched.
set -euo pipefail

# Handles both https://github.com/owner/repo.git and git@github.com:owner/repo.git
ORIGIN="$(git config --get remote.origin.url)"
CLEAN="${ORIGIN%.git}"
REPO="$(basename "$CLEAN")"
OWNER="$(basename "$(dirname "$CLEAN")")"
OWNER="${OWNER##*:}"
WORKTREE="$(mktemp -d)"
SHA="$(git rev-parse --short HEAD)"

echo "Building $OWNER/$REPO with base /$REPO/ …"
BASE_PATH="/$REPO/" npm run build

echo "Publishing to gh-pages …"
git worktree add -B gh-pages "$WORKTREE" >/dev/null
# Keep .git, replace everything else with the fresh build.
find "$WORKTREE" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R dist/. "$WORKTREE"/
# Stop Jekyll from filtering files it doesn't understand.
touch "$WORKTREE/.nojekyll"

(
  cd "$WORKTREE"
  git add -A
  if git diff --cached --quiet; then
    echo "No changes to deploy."
  else
    git commit -q -m "Deploy $SHA"
    git push -q -f origin gh-pages
  fi
)
git worktree remove "$WORKTREE" --force
echo "Deployed → https://$OWNER.github.io/$REPO/"
