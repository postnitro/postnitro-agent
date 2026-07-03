# PostNitro CLI — Examples

Ready-to-use files and snippets for driving the CLI from scripts and AI agents.

> Authenticate first: `postnitro auth set-key pn-...` (or `export POSTNITRO_API_KEY=pn-...`).

## Files in this directory

| File | What it is |
|------|------------|
| [basic-usage.sh](basic-usage.sh) | End-to-end workflow: auth check → discover → generate → schedule. Discovery runs by default; generate/schedule are gated behind `RUN_GENERATE=1` / `RUN_SCHEDULE=1`. |
| [import-slides.json](import-slides.json) | A complete, valid slide set for `carousel import` (starting + body + infographic + ending). |
| [cli-launch-slides.json](cli-launch-slides.json) | A launch-announcement carousel — a fuller real-world slide example. |

## Run the workflow script

```bash
chmod +x examples/basic-usage.sh

# Safe: just authenticates and lists resources
./examples/basic-usage.sh

# Actually generate a carousel (spends credits)
RUN_GENERATE=1 ./examples/basic-usage.sh

# Generate AND schedule to your first LinkedIn account (creates a live post)
RUN_GENERATE=1 RUN_SCHEDULE=1 ./examples/basic-usage.sh
```

## Import from a file vs. inline

```bash
# From a file
postnitro carousel import --file examples/import-slides.json --wait

# The same JSON inline (overrides --file)
postnitro carousel import --slides "$(cat examples/import-slides.json)" --wait
```

## Capture the designId and schedule it

```bash
DID=$(postnitro carousel import --file examples/import-slides.json --wait | jq -r .designId)
LINKEDIN=$(postnitro social list | jq -r 'first(.accounts[] | select(.platform=="linkedin").id)')

postnitro schedule create \
  --status SCHEDULED --scheduled-at "2026-12-31T13:00:00Z" \
  --design-id "$DID" \
  --selected-accounts "[\"$LINKEDIN\"]" \
  --linkedin-post-settings '{"postType":"document","postTitle":"My carousel title"}' \
  --post-content '{"common":"Caption with #hashtags"}'
```

## Slide format

Run `postnitro carousel import-template` for the authoritative rules. In short: exactly one
`starting_slide` (first), one or more `body_slide`, and exactly one `ending_slide` (last).
See [import-slides.json](import-slides.json) for the shape, including an `infographic` body slide.
