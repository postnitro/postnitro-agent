# PostNitro CLI — Skill Examples

Ready-to-use files for the `postnitro` skill. Authenticate first
(`postnitro auth set-key pn-...` or `export POSTNITRO_API_KEY=pn-...`).

## Files

| File | What it is | Use with |
|------|------------|----------|
| [import-default.json](import-default.json) | Basic 4-slide import (starting / body / body / ending) | `carousel import` |
| [import-infographics.json](import-infographics.json) | Import with `grid` and `cycle` infographic body slides | `carousel import` |
| [schedule-post.json](schedule-post.json) | A full `schedule` body (designId + accounts + caption + LinkedIn settings) | `schedule create --file` |

## Import a carousel

```bash
# From a file
postnitro carousel import --file examples/import-default.json --wait

# With infographic slides
postnitro carousel import --file examples/import-infographics.json --wait

# Same JSON inline (overrides --file)
postnitro carousel import --slides "$(cat examples/import-default.json)" --wait
```

## Generate with AI (no JSON file needed — flags only)

```bash
postnitro carousel generate --context "5 LinkedIn growth tips" --type text --wait
postnitro carousel generate --context "https://yourblog.com/post" --type article --wait
postnitro carousel generate --context "https://x.com/user/status/123" --type x --wait
```

## Schedule a finished design

Edit `schedule-post.json` (set a real `designId` from the import/generate output and a real
`socialAccountId` from `postnitro social list`), then:

```bash
postnitro schedule create --file examples/schedule-post.json
```

Inline flags override any field in the file, e.g. change the time without editing the file:

```bash
postnitro schedule create --file examples/schedule-post.json --scheduled-at "2027-01-15T09:00:00Z"
```

## End-to-end (capture designId → schedule)

```bash
DID=$(postnitro carousel import --file examples/import-infographics.json --wait | jq -r .designId)
LINKEDIN=$(postnitro social list | jq -r 'first(.accounts[] | select(.platform=="linkedin").id)')
postnitro schedule create --status SCHEDULED --scheduled-at "2026-12-31T13:00:00Z" \
  --design-id "$DID" --selected-accounts "[\"$LINKEDIN\"]" \
  --linkedin-post-settings '{"postType":"document","postTitle":"Remote Work, Done Right"}' \
  --post-content '{"common":"New carousel 🚀 #remotework"}'
```

See [../references/cli-reference.md](../references/cli-reference.md) for the full command and schema reference.
