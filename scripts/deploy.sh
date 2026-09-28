#!/usr/bin/env bash
# Build and publish to the gh-pages branch.
#
# GitHub Pages serves this repo from /<repo>/, so the build needs a matching base.
# Uses a temporary git worktree so your working tree is never touched.
set -euo pipefail

REPO="$(basename "$(git rev-parse --show-toplevel)")"
WORKTREE="$(mktemp -d)"

echo "Building with base /$REPO/ …"
BASE_PATH="/$REPO/" npm run build

echo "Publishing to gh-pages …"
git worktree add -B gh-pages "$WORKTREE" >/dev/null
# Keep .git, replace everything else with the fresh build.
find "$WORKTREE" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R dist/. "$WORKTREE"/
# Stop Jekyll from filtering files it doesn't understand.
touch "$WORKTREE/.nojekyll"

cd "$WORKTREE"
git add -A
git commit -q -m "Deploy $(git -C "$OLDPWD" rev-parse --short HEAD)" || { echo "No changes to deploy."; cd - >/dev/null; git worktree remove "$WORKTREE" --force; exit 0; }
git push -q -f origin gh-pages
cd - >/dev/null
git worktree remove "$WORKTREE" --force
echo "Deployed. https://$(git config --get remote.origin.url | sed -E 's#.*github.com[:/]([^/]+)/.*#\1#').github.io/$REPO/"
