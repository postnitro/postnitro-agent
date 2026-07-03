#!/bin/bash
#
# Basic PostNitro CLI workflow.
#
# Discovery steps run by default (read-only, safe). The steps that spend credits
# or create posts are gated behind RUN_GENERATE=1 / RUN_SCHEDULE=1 so this script
# is safe to run as-is.
#
#   Authenticate first:  postnitro auth set-key pn-...   (or export POSTNITRO_API_KEY=pn-...)
#   Then:                ./basic-usage.sh
#   To actually create:  RUN_GENERATE=1 ./basic-usage.sh
#
set -euo pipefail

echo "🎠 PostNitro CLI — basic workflow"
echo

# 1. Auth check (Hard Rule 1)
echo "🔐 Step 1: checking authentication..."
if ! postnitro auth status >/dev/null 2>&1; then
  echo "❌ Not authenticated. Run: postnitro auth set-key pn-...   (or export POSTNITRO_API_KEY=pn-...)"
  exit 1
fi
echo "✅ Authenticated"
echo

# 2. Discover resources (read-only)
echo "📋 Step 2: discovering templates / brands / presets / social accounts..."
postnitro template list --limit 3
postnitro brand list --limit 3
postnitro preset list --limit 3
postnitro social list
echo

# 3. Generate a carousel (spends credits — opt in with RUN_GENERATE=1)
if [ "${RUN_GENERATE:-0}" != "1" ]; then
  echo "⏭️  Step 3 (generate) skipped. Re-run with RUN_GENERATE=1 to actually generate."
  echo "    postnitro carousel generate --context \"5 tips for remote work\" --type text --wait"
  exit 0
fi

echo "🤖 Step 3: generating a carousel and waiting..."
OUT=$(postnitro carousel generate --context "5 tips for remote work" --type text --wait)
echo "$OUT" | jq '{embedPostId, status, designId, name}'
DID=$(echo "$OUT" | jq -r .designId)
echo "✅ designId: $DID"
echo

# 4. Schedule to LinkedIn (creates a real post — opt in with RUN_SCHEDULE=1)
if [ "${RUN_SCHEDULE:-0}" != "1" ]; then
  echo "⏭️  Step 4 (schedule) skipped. Re-run with RUN_SCHEDULE=1 to schedule designId $DID."
  exit 0
fi

LINKEDIN=$(postnitro social list | jq -r 'first(.accounts[] | select(.platform=="linkedin").id)')
WHEN=$(date -u -v+1d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "+1 day" +%Y-%m-%dT%H:%M:%SZ)
echo "📅 Step 4: scheduling to LinkedIn ($LINKEDIN) for $WHEN..."
postnitro schedule create \
  --status SCHEDULED --scheduled-at "$WHEN" \
  --design-id "$DID" \
  --selected-accounts "[\"$LINKEDIN\"]" \
  --linkedin-post-settings '{"postType":"document","postTitle":"5 tips for remote work"}' \
  --post-content '{"common":"New carousel 🚀 #remotework"}' | jq '{scheduledPostId, "status": .post.status}'
echo "✅ Done"
