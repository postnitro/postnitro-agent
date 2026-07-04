---
name: postnitro
description: Create on-brand social media carousels and schedule them to LinkedIn, Instagram, TikTok, and Threads from a single command. Turn a topic, article, or X thread into a finished multi-slide post — or import your own slides — then publish or draft it automatically. Fully scriptable (JSON in, JSON out), so an AI agent can run the entire create-to-schedule workflow. Use this skill whenever the user wants to create a carousel, slide post, or multi-slide content, repurpose an article, blog post, or X thread into slides, or automate and schedule social media posts. Requires a PostNitro API key.
homepage: https://postnitro.ai
metadata: {"openclaw":{"emoji":"🎠","primaryEnv":"POSTNITRO_API_KEY","requires":{"bins":[],"env":["POSTNITRO_API_KEY"]}}}
---

# PostNitro — Create & Schedule Social Carousels

PostNitro creates on-brand social media carousels and schedules them across LinkedIn, Instagram, TikTok, and Threads. This skill drives it from the command line, so an agent can take a topic, article, or set of slides and produce a finished, scheduled post in one workflow. Every command is JSON in / JSON out — safe to script and chain.

## Setup

1. Install the CLI:
   ```bash
   npm install -g @postnitro/cli
   ```
2. Sign up at https://postnitro.ai and subscribe to a plan — the Embed API requires a **paid subscription** (no free tier). Then generate an API key at account settings → **Embed** → Generate API Key.
3. Authenticate (in order of precedence: `--api-key` flag → env var → saved config):
   ```bash
   postnitro auth set-key pn-xxxx        # persists to ~/.postnitro-cli/config.json
   export POSTNITRO_API_KEY="pn-xxxx"    # or use an env var
   ```
4. Save defaults so you don't repeat template/brand/preset IDs on every call (the CLI's alternative to per-call flags — no env vars needed):
   ```bash
   postnitro defaults set --template-id <id> --brand-id <id> --preset-id <id> --response-type PDF
   ```

| Env var | Required | Purpose |
|---------|----------|---------|
| `POSTNITRO_API_KEY` | Yes* | API key (*unless passed via `--api-key` or saved with `auth set-key`) |
| `POSTNITRO_API_BASE_URL` | No | Override API endpoint (default `https://embed-api.postnitro.ai`) |

> **Key rule:** `carousel generate`/`import` return an **`embedPostId`** (the async job). To *schedule* the result you need its **`designId`** (from the `--wait` output or `carousel output`). Never pass an `embedPostId` to `schedule`.

## Core Workflow

Carousel creation is asynchronous — `--wait` handles the polling and returns the finished output (including `designId`) in one call.

### 1. Generate a carousel with AI

```bash
postnitro carousel generate \
  --context "5 tips for growing your LinkedIn audience in 2026" \
  --type text \
  --instructions "Professional tone, actionable advice" \
  --wait
```

**`--type` values:**
- `text` — `--context` is the topic/text to turn into a carousel
- `article` — `--context` is an article URL to extract and convert
- `x` — `--context` is an X (Twitter) post/thread URL

Template/brand/preset come from saved defaults (or pass `--template-id/--brand-id/--preset-id`). The result JSON includes the **`designId`**.

### 2. Import your own slide content

```bash
# From a file, or inline JSON with --slides (inline overrides --file)
postnitro carousel import --file ./slides.json --wait
postnitro carousel import --slides '{"slides":[
  {"type":"starting_slide","heading":"Your Title","description":"Intro text"},
  {"type":"body_slide","heading":"Key Point","description":"Details here"},
  {"type":"ending_slide","heading":"Take Action!","cta_button":"Learn More"}
]}' --wait
```

**Slide rules:** exactly 1 `starting_slide` (first), ≥1 `body_slide`, exactly 1 `ending_slide` (last); `heading` required on every slide. For infographics, set `layoutType: "infographic"` on a body slide (replaces its image with data columns, max 3). Run `postnitro carousel import-template` for the full schema. Ready-to-use: [examples/import-default.json](examples/import-default.json), [examples/import-infographics.json](examples/import-infographics.json).

### 3. Check status / get output (only if you didn't use `--wait`)

```bash
postnitro carousel status <embedPostId>   # progress + step logs; poll until COMPLETED
postnitro carousel output <embedPostId>   # final file URL(s) + designId
```

Output is a PDF (single URL) or PNG (one URL per slide), in `data`.

### 4. Schedule the design to social accounts

```bash
postnitro social list   # get account IDs + platforms

postnitro schedule create \
  --status SCHEDULED \
  --scheduled-at "2026-12-31T13:00:00Z" \
  --design-id <designId> \
  --selected-accounts '["<socialAccountId>"]' \
  --linkedin-post-settings '{"postType":"document","postTitle":"5–90 char title"}' \
  --post-content '{"common":"Caption with #hashtags"}'
```

### 5. One-shot: generate + schedule

```bash
postnitro generate-and-schedule \
  --context "topic" --type text \
  --status SCHEDULED --scheduled-at "2026-12-31T13:00:00Z" \
  --selected-accounts '["<socialAccountId>"]' \
  --linkedin-post-settings '{"postType":"document","postTitle":"..."}' \
  --post-content '{"common":"..."}'
```

## Common Patterns

### Pattern 1: LinkedIn thought-leadership carousel
```bash
postnitro carousel generate \
  --context "5 mistakes startups make with their LinkedIn strategy and how to fix each one" \
  --type text --instructions "Professional but conversational. One clear takeaway per slide." --wait
```

### Pattern 2: Repurpose a blog post
```bash
postnitro carousel generate --context "https://yourblog.com/posts/social-media-strategy-2026" \
  --type article --instructions "Extract the 5 most actionable points. Keep slide text concise." --wait
```

### Pattern 3: Repurpose an X thread
```bash
postnitro carousel generate --context "https://x.com/username/status/1234567890" \
  --type x --instructions "Maintain the original voice and key points" --wait
```

### Pattern 4: Data-driven infographic carousel
Import slides with `layoutType: "infographic"` body slides — see
[examples/import-infographics.json](examples/import-infographics.json).

### Pattern 5: Generate → schedule to LinkedIn
```bash
DID=$(postnitro carousel generate --context "5 remote work habits" --type text --wait | jq -r .designId)
LINKEDIN=$(postnitro social list | jq -r 'first(.accounts[] | select(.platform=="linkedin").id)')
postnitro schedule create --status SCHEDULED --scheduled-at "2026-12-31T13:00:00Z" \
  --design-id "$DID" --selected-accounts "[\"$LINKEDIN\"]" \
  --linkedin-post-settings '{"postType":"document","postTitle":"5 remote work habits"}' \
  --post-content '{"common":"New carousel 🚀 #remotework"}'
```

### Pattern 6: Batch scheduling
```bash
DATES=("2026-02-14T09:00:00Z" "2026-02-15T09:00:00Z")
TOPICS=("Monday motivation 💪" "Tuesday tips 💡")
for i in "${!DATES[@]}"; do
  postnitro generate-and-schedule --context "${TOPICS[$i]}" --type text \
    --status SCHEDULED --scheduled-at "${DATES[$i]}" \
    --selected-accounts '["<socialAccountId>"]' \
    --linkedin-post-settings '{"postType":"document","postTitle":"Daily post"}'
done
```

## Content Strategy Tips

- **LinkedIn**: professional tone, actionable insights, 6–10 slides, clear CTA. PDF carousels post as `postType: "document"` (needs a 5–90 char `postTitle`).
- **Instagram**: visual-first, concise text, 5–8 slides, storytelling arc. `postAsStory` for stories.
- **TikTok**: trendy, punchy, 4–7 slides, hook on slide 1.
- **X / Threads**: data-driven, 3–6 slides, provocative opening.

## Common Gotchas

1. **Not authenticated** — run `postnitro auth status`; set a key before anything else.
2. **Scheduling with `embedPostId`** — use the **`designId`** from `--wait`/`carousel output`, never the `embedPostId`.
3. **`Scheduled at is in the past`** — `--scheduled-at` must be a future ISO-8601 datetime with a trailing `Z`.
4. **Invalid inline JSON** — wrap JSON flags in single quotes; the CLI validates before any network call.
5. **`Missing --brand-id ... multiple candidates`** — pass the ID or save a default with `defaults set`.
6. **LinkedIn `document` rejected** — `postType:"document"` needs a 5–90 char `postTitle`.
7. **Empty post** — a scheduled post needs either `--design-id` or non-empty `--post-content`.
8. **Destructive commands** — `social disconnect` and `schedule delete` require `--yes`.
9. **`SCHEDULED` publishes live** — use `DRAFT` when unsure; confirm time/account with the user first.
10. **Default `responseType` is PDF** — pass `--response-type PNG` for individual slide images.
11. **Credits vary** — AI generation ≈ 2 credits/slide; content import ≈ 1 credit/slide. Warn before large batches.

## Credits & Pricing

The Embed API requires a **paid subscription** — there is no free tier, and free accounts cannot call the API. See **https://postnitro.ai/plans** for current plans and credit allowances.

Approximate usage cost (observed):
- Content import: ~1 credit per slide
- AI generation: ~2 credits per slide

## Supporting Resources

**In this skill:**
- [references/cli-reference.md](references/cli-reference.md) — complete command, platform-settings, and slide-schema reference
- [examples/EXAMPLES.md](examples/EXAMPLES.md) — ready-to-use import & schedule JSON (`import-default.json`, `import-infographics.json`, `schedule-post.json`)

**Full project docs (GitHub):**
- [README](https://github.com/postnitro/postnitro-agent#readme) — full command reference
- [QUICK_START.md](https://github.com/postnitro/postnitro-agent/blob/main/QUICK_START.md) — zero to a scheduled carousel in minutes
- [HOW_TO_RUN.md](https://github.com/postnitro/postnitro-agent/blob/main/HOW_TO_RUN.md) — install & run methods
- [PLATFORM_SETTINGS.md](https://github.com/postnitro/postnitro-agent/blob/main/PLATFORM_SETTINGS.md) — platform settings schemas
- [FEATURES.md](https://github.com/postnitro/postnitro-agent/blob/main/FEATURES.md) — full feature list
- Per-command help: `postnitro <command> <subcommand> --help`

## Quick Reference

```bash
# Auth (do this first)
postnitro auth set-key pn-xxxx | postnitro auth status | export POSTNITRO_API_KEY=pn-xxxx

# Discover + defaults
postnitro template list | brand list | preset list | social list
postnitro defaults set --template-id <id> --brand-id <id> --preset-id <id> --response-type PDF

# Create (async — use --wait; result has designId)
postnitro carousel generate --context "topic|url" --type text|article|x [--instructions "..."] --wait
postnitro carousel import (--slides '{"slides":[...]}' | --file ./slides.json) --wait
postnitro carousel status <embedPostId>        # if not using --wait
postnitro carousel output <embedPostId>        # file URLs + designId

# Schedule (date REQUIRED + future; use designId, not embedPostId)
postnitro schedule create --status SCHEDULED|DRAFT --scheduled-at "<iso>" --design-id <id> \
  --selected-accounts '["<id>"]' --linkedin-post-settings '{"postType":"document","postTitle":"..."}' \
  --post-content '{"common":"caption"}'
postnitro schedule list --from "<date>" --to "<date>" | get <id> | delete <id> --yes

# One-shot
postnitro generate-and-schedule --context "topic" --status SCHEDULED --scheduled-at "<iso>" ...
```

## Tips for the Agent

- Always confirm authentication (`postnitro auth status`) before running any other command. Never fabricate an API key — ask the user.
- Prefer `--wait` so one call returns the finished output and `designId`.
- Discover IDs with the `list` commands; save workspace defaults with `defaults set` so later calls stay short.
- **Schedule with the `designId`, not the `embedPostId`.**
- For `--type article`/`x`, `--context` must be a URL. For plain text, use `--type text`.
- Default `responseType` is PDF — pass `--response-type PNG` when the user wants individual slide images.
- `--scheduled-at` must be a **future** ISO-8601 datetime (trailing `Z`).
- `status: SCHEDULED` creates a **live** post that will publish — confirm the time and account with the user, or use `DRAFT` when unsure.
- Parse stdout as JSON; on failure read `.error.message` from stderr and fix the inputs.
- Warn about credit costs before large batches (AI generation is ~2× the cost of import).
- If the user doesn't specify a platform, suggest LinkedIn (most common carousel use case) and remember PDF carousels post there as `document`.
