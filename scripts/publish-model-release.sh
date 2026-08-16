#!/bin/sh
# Publish the trained model as a GitHub Release asset and print the MODEL_URL to
# paste into Render. Run AFTER the repo is on GitHub and `gh auth login` is done.
#
#   sh scripts/publish-model-release.sh            # tag model-v2.1.0
#   sh scripts/publish-model-release.sh model-v3   # custom tag
set -e

MODEL="ml/artifacts/model_v2.1.0-real-appcompat.joblib"
TAG="${1:-model-v2.1.0}"

[ -f "$MODEL" ] || { echo "ERROR: model not found at $MODEL"; exit 1; }
command -v gh >/dev/null 2>&1 || { echo "ERROR: gh CLI not found. Install it and run 'gh auth login'."; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "ERROR: not logged in. Run 'gh auth login'."; exit 1; }

echo "Publishing $MODEL as release '$TAG' ..."
gh release view "$TAG" >/dev/null 2>&1 || \
  gh release create "$TAG" --title "MedScope model $TAG" --notes "Serving model artifact (real Yale ED, app-compatible)."
gh release upload "$TAG" "$MODEL" --clobber

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
ASSET=$(basename "$MODEL")
echo ""
echo "Done. Set this on Render (Environment → MODEL_URL):"
echo "  MODEL_URL=https://github.com/$REPO/releases/download/$TAG/$ASSET"
