#!/usr/bin/env bash
# scripts/stamp-release.sh
#
# Injects the current git commit SHA into every HTML file that contains
# <meta name="gb-release-sha" content="..."> before a deploy.
#
# Usage:
#   bash scripts/stamp-release.sh
#   bash scripts/stamp-release.sh --sha abc1234   # force a specific SHA
#
# Run this BEFORE `git push` or as the first step of your CI deploy job.
# Commit the stamped files, or let CI stamp them in the build artifact
# without committing (recommended for clean git history).
#
# GitHub Actions example:
#   - name: Stamp release SHA
#     run: bash scripts/stamp-release.sh
#   - name: Deploy
#     run: firebase deploy --only hosting

set -euo pipefail

# ── Resolve SHA ────────────────────────────────────────────────────────────
SHA=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --sha) SHA="$2"; shift 2 ;;
    *)     echo "Unknown argument: $1"; exit 1 ;;
  esac
done

if [[ -z "$SHA" ]]; then
  SHA=$(git rev-parse --short=8 HEAD 2>/dev/null || echo "dev")
fi

echo "Stamping release SHA: $SHA"

# ── Files to stamp ─────────────────────────────────────────────────────────
HTML_FILES=(
  "index.html"
  "public/academy/index.html"
  "public/academy/certificate.html"
)

for f in "${HTML_FILES[@]}"; do
  if [[ -f "$f" ]]; then
    # Replace any content="..." value in the gb-release-sha meta tag
    sed -i.bak \
      's|<meta name="gb-release-sha" content="[^"]*"/>|<meta name="gb-release-sha" content="'"$SHA"'"/>|g' \
      "$f"
    rm -f "${f}.bak"
    echo "  ✓ $f"
  fi
done

echo "Done. All HTML stamped with SHA $SHA."
