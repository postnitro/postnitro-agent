---
name: postnitro
description: PostNitro is a CLI for AI agents to generate carousels with AI (from a topic, article, or X post) or import your own slides, apply brand kits, and schedule carousel posts to LinkedIn, Instagram, TikTok, and Threads via the PostNitro Embed API. JSON in, JSON out.
homepage: https://postnitro.ai
metadata: {"openclaw":{"emoji":"🎠","requires":{"bins":[],"env":["POSTNITRO_API_KEY"]}}}
---

## Install PostNitro CLI if it doesn't exist

```bash
npm install -g @postnitro/cli
```

npm release: https://www.npmjs.com/package/@postnitro/cli
postnitro cli github: https://github.com/postnitro/postnitro-agent
official website: https://postnitro.ai

---

| Property | Value |
|----------|-------|
| **name** | postnitro |
| **description** | AI-carousel generation and social scheduling CLI for LinkedIn, Instagram, TikTok, Threads |
| **allowed-tools** | Bash(postnitro:*) |

---

## ⚠️ Two Hard Rules (Read First)

**Rule 1 — Authenticate before anything.** All commands fail without a valid API key.

**Rule 2 — Schedule with the `designId`, NOT the `embedPostId`.** `carousel generate` and `carousel import` return an **`embedPostId`** — that's the async *job*, not the finished carousel. To schedule the result you need its **`designId`**, which appears in the `--wait` output (or in `carousel output <embedPostId>` once the job is `COMPLETED`). Passing an `embedPostId` to `schedule` will fail. Always:

```bash
DID=$(postnitro carousel generate --context "..." --type text --wait | jq -r .designId)
postnitro schedule create --design-id "$DID" ...
```

If you see `--design-id <designId>` anywhere below, it means "the `designId` from a completed generate/import" — never an `embedPostId`.

---

## ⚠️ Authentication Required

**You MUST authenticate before running any PostNitro CLI command.**

Before doing anything else, check auth status:
```bash
postnitro auth status
```

If not authenticated, provide a key one of these ways (highest precedence first):
1. `--api-key <key>` on any command
2. `export POSTNITRO_API_KEY=pn-...`
3. `postnitro auth set-key pn-...` (persists to `~/.postnitro-cli/config.json`)

Get a key from **PostNitro → Profile → Embed → Generate API Key**. Never fabricate a key — ask the user.

**Do NOT proceed with other commands until authentication is confirmed.**

---

## Core Workflow

1. **Authenticate** — verify or set up the API key (see above)
2. **Discover** — list templates, brands, presets, and social accounts; save defaults
3. **Create** — generate a carousel with AI, or import your own slides (use `--wait`)
4. **Capture the `designId`** — from the `--wait` output or `carousel output`
5. **Schedule** — attach the design to social accounts with captions and per-platform settings
6. **Manage** — list, update, or delete scheduled posts

```bash
# 1. Authenticate
postnitro auth status

# 2. Discover + save defaults
postnitro template list
postnitro brand list
postnitro preset list
postnitro social list
postnitro defaults set --template-id <id> --brand-id <id> --preset-id <id> --response-type PDF

# 3. Create (and wait for completion)
postnitro carousel generate --context "5 tips for remote work" --type text --wait

# 4. Capture the designId (from the JSON above)
# 5. Schedule
postnitro schedule create --status SCHEDULED --scheduled-at "2026-12-31T12:00:00Z" \
  --design-id <designId> --selected-accounts '["<socialAccountId>"]' \
  --linkedin-post-settings '{"postType":"document","postTitle":"5–90 char title"}' \
  --post-content '{"common":"caption #hashtag"}'

# 6. Manage
postnitro schedule list --from "2026-12-01" --to "2026-12-31"
```

---

## Essential Commands

### Authentication
```bash
postnitro auth set-key pn-xxxx     # Save API key to ~/.postnitro-cli/config.json
postnitro auth status              # Verify a key is configured
postnitro auth clear               # Remove the stored key
export POSTNITRO_API_KEY=pn-xxxx   # Or use an env var (no save)
```

### Discovery & Defaults
```bash
postnitro template list [--page <n>] [--limit <n>]   # Template IDs
postnitro brand list [--page <n>] [--limit <n>]      # Brand IDs
postnitro brand get <id>
postnitro preset list [--page <n>] [--limit <n>]     # AI preset IDs
postnitro social list                                # Social account IDs (for --selected-accounts)
postnitro social get <id>

# Save defaults so generate/import calls omit the IDs
postnitro defaults set --template-id <id> --brand-id <id> --preset-id <id> --response-type PDF
postnitro defaults get
```

### Creating Carousels
```bash
# See the required slide shape and rules
postnitro carousel import-template

# Generate with AI (context is a topic / article URL / X post URL depending on --type)
postnitro carousel generate --context "topic or URL" --type text|article|x [--instructions "..."] --wait

# Import your own slides (inline JSON overrides --file)
postnitro carousel import --file ./slides.json --wait
postnitro carousel import --slides '{"slides":[ ...>=3 slides... ]}' --wait
```

### Checking Status & Output
```bash
postnitro carousel status <embedPostId>   # Progress + step logs
postnitro carousel output <embedPostId>   # Final files + designId (once COMPLETED)
```

### Scheduling
```bash
postnitro schedule create \
  --status SCHEDULED \
  --scheduled-at "2026-12-31T12:00:00Z" \
  --design-id <designId> \
  --selected-accounts '["<socialAccountId>"]' \
  --linkedin-post-settings '{"postType":"document","postTitle":"5–90 char title"}' \
  --post-content '{"common":"Caption with #hashtags"}'

postnitro schedule list --from "<date>" --to "<date>"
postnitro schedule get <id>
postnitro schedule update <id> ...same flags as create...   # REPLACES state — send the full body
postnitro schedule delete <id> --yes
```

### One-shot: Generate + Schedule
```bash
postnitro generate-and-schedule \
  --context "topic" --type text \
  --status SCHEDULED --scheduled-at "2026-12-31T12:00:00Z" \
  --selected-accounts '["<socialAccountId>"]' \
  --linkedin-post-settings '{"postType":"document","postTitle":"..."}' \
  --post-content '{"common":"..."}'
```

### Brand Kits
```bash
postnitro brand create --name "PostNitro" --handle "@postnitroai" --image "https://.../logo.png"
postnitro brand create --data '{"name":"...","handle":"@...","image":"https://...","isCompanyDetail":true}'
postnitro brand update <id> ...same as create...
```

### Social Accounts
```bash
postnitro social list                    # {count, accounts:[{id, platform, handle, name, accountType, status}]}
postnitro social get <id>
postnitro social disconnect <id> --yes   # Destructive — requires --yes
```

---

## Common Patterns

### Pattern 1: Generate → schedule to LinkedIn
```bash
DID=$(postnitro carousel generate --context "5 remote work habits" --type text --wait | jq -r .designId)
LINKEDIN=$(postnitro social list | jq -r 'first(.accounts[] | select(.platform=="linkedin").id)')

postnitro schedule create \
  --status SCHEDULED --scheduled-at "2026-12-31T13:00:00Z" \
  --design-id "$DID" \
  --selected-accounts "[\"$LINKEDIN\"]" \
  --linkedin-post-settings '{"postType":"document","postTitle":"5 remote work habits"}' \
  --post-content '{"common":"New carousel 🚀 #remotework"}'
```

### Pattern 2: Import your own slides → schedule
```bash
DID=$(postnitro carousel import --file ./examples/import-slides.json --wait | jq -r .designId)
postnitro schedule create --status DRAFT --scheduled-at "2026-12-31T13:00:00Z" --design-id "$DID"
```

### Pattern 3: One-shot generate + schedule
```bash
postnitro generate-and-schedule --context "How AI agents automate content" --type text \
  --status SCHEDULED --scheduled-at "2026-12-31T12:00:00Z" \
  --selected-accounts '["<socialAccountId>"]' \
  --linkedin-post-settings '{"postType":"document","postTitle":"How AI agents automate content"}' \
  --post-content '{"common":"New drop 🚀 #ai #automation"}'
# If generation succeeds but scheduling fails, the error includes the designId —
# retry `schedule create --design-id <id>` WITHOUT regenerating (saves credits).
```

### Pattern 4: Batch scheduling
```bash
DATES=("2026-02-14T09:00:00Z" "2026-02-15T09:00:00Z" "2026-02-16T09:00:00Z")
TOPICS=("Monday motivation 💪" "Tuesday tips 💡" "Wednesday wisdom 🧠")
for i in "${!DATES[@]}"; do
  postnitro generate-and-schedule --context "${TOPICS[$i]}" --type text \
    --status SCHEDULED --scheduled-at "${DATES[$i]}" \
    --selected-accounts '["<socialAccountId>"]' \
    --linkedin-post-settings '{"postType":"document","postTitle":"Daily post"}'
done
```

### Pattern 5: Error handling & retry
```bash
for attempt in 1 2 3; do
  if OUT=$(postnitro carousel generate --context "topic" --type text --wait 2>err.json); then
    echo "$OUT" | jq -r .designId; break
  else
    echo "Attempt $attempt failed: $(jq -r .error.message err.json)"
    [ "$attempt" -lt 3 ] && sleep $((2 ** attempt)) || exit 1
  fi
done
```

---

## Technical Concepts

### embedPostId vs designId
`generate`/`import` create an async job → **`embedPostId`**. The finished carousel has a **`designId`** (in the `--wait` output or `carousel output`). **Schedule with the `designId`.** (See Hard Rule 2.)

### Async & `--wait`
Generation runs in the background. `--wait` polls to completion and returns the final output — including `designId` — in one call. Without it, poll `carousel status <embedPostId>` until `COMPLETED`, then `carousel output <embedPostId>`.

### JSON everywhere + exit codes
Success → JSON on **stdout**, exit `0`. Failure → `{ "success": false, "error": { "message": ... } }` on **stderr**, exit `1`. Parse stdout; on failure read `.error.message`.

### Inline JSON vs `--file`
`carousel import` (`--slides`), `brand create/update` (`--data`), and `schedule`/`generate-and-schedule` (`--post-content`, `--selected-accounts`, `--*-post-settings`) accept JSON inline. Where a command also takes `--file`, the **inline flag wins**. Use single quotes around JSON in the shell.

### postContent (captions)
`--post-content` is a JSON object keyed by platform. Recognized keys: `common`, `linkedin`, `instagram`, `tiktok`, `facebook`, `threads`. At least one non-empty caption is required unless a `--design-id` is set. Hashtags are auto-extracted.

### Platform settings shapes
- LinkedIn: `{"postType":"carousel|document|image|reel","postTitle":"..."}` — `document` needs a 5–90 char `postTitle` (PDF carousels usually post as `document`)
- Instagram: `{"postType":"carousel|image|reel","postAsStory":false}`
- TikTok: `{"postType":"carousel|reel","privacyLevel":"PUBLIC_TO_EVERYONE|MUTUAL_FOLLOW_FRIENDS|SELF_ONLY","canComment":true,"isBrandedContent":false,"isYourBrand":false,"isThirdPartyBrand":false,"isAIGeneratedContent":true}`
- Threads: `{"postType":"carousel|image|reel"}`
- Reel timing: `--post-settings '{"videoDuration":30,"audioId":"..."}'`

### Defaults resolution
Each of templateId/brandId/presetId/responseType resolves as: **explicit flag → saved default (`defaults set`) → auto-select** (when exactly one candidate exists). Otherwise the command errors and lists the available IDs.

### Slide format (import)
Exactly one `starting_slide` (first), ≥1 `body_slide`, exactly one `ending_slide` (last). Fields: `type` (required), `heading` (required), `sub_heading`, `description`, `image`, `background_image`, `cta_button`, `layoutType` (`default`|`infographic`), `layoutConfig` (infographic only; max 3 columns). Run `postnitro carousel import-template` for the full rules.

### DRAFT vs SCHEDULED
`--status DRAFT` saves without publishing. `--status SCHEDULED` creates a **live** post that will publish at `--scheduled-at`. `scheduledAt` must be a **future** ISO-8601 datetime (trailing `Z`). Confirm time and account with the user before using `SCHEDULED`.

---

## Platform-Specific Examples

### LinkedIn (PDF carousels post as documents)
```bash
postnitro schedule create --status SCHEDULED --scheduled-at "2026-12-31T12:00:00Z" \
  --design-id <designId> --selected-accounts '["linkedin-account-id"]' \
  --linkedin-post-settings '{"postType":"document","postTitle":"My carousel title"}' \
  --post-content '{"common":"LinkedIn caption #build"}'
```

### Instagram
```bash
postnitro schedule create --status SCHEDULED --scheduled-at "2026-12-31T12:00:00Z" \
  --design-id <designId> --selected-accounts '["instagram-account-id"]' \
  --instagram-post-settings '{"postType":"carousel","postAsStory":false}' \
  --post-content '{"instagram":"Caption #hashtag"}'
```

### TikTok
```bash
postnitro schedule create --status SCHEDULED --scheduled-at "2026-12-31T12:00:00Z" \
  --design-id <designId> --selected-accounts '["tiktok-account-id"]' \
  --tiktok-post-settings '{"postType":"carousel","privacyLevel":"PUBLIC_TO_EVERYONE","canComment":true,"isBrandedContent":false,"isYourBrand":false,"isThirdPartyBrand":false,"isAIGeneratedContent":true}' \
  --post-content '{"tiktok":"Caption #fyp"}'
```

### Threads
```bash
postnitro schedule create --status SCHEDULED --scheduled-at "2026-12-31T12:00:00Z" \
  --design-id <designId> --selected-accounts '["threads-account-id"]' \
  --threads-post-settings '{"postType":"carousel"}' \
  --post-content '{"threads":"Caption"}'
```

---

## Supporting Resources

- **[README](https://github.com/postnitro/postnitro-agent#readme)** — full command reference
- **[QUICK_START.md](https://github.com/postnitro/postnitro-agent/blob/main/QUICK_START.md)** — zero to a scheduled carousel in minutes
- **[HOW_TO_RUN.md](https://github.com/postnitro/postnitro-agent/blob/main/HOW_TO_RUN.md)** — install & run methods
- **[PLATFORM_SETTINGS.md](https://github.com/postnitro/postnitro-agent/blob/main/PLATFORM_SETTINGS.md)** — LinkedIn/Instagram/TikTok/Threads settings schemas
- **[FEATURES.md](https://github.com/postnitro/postnitro-agent/blob/main/FEATURES.md)** — full feature list
- **[PROJECT_STRUCTURE.md](https://github.com/postnitro/postnitro-agent/blob/main/PROJECT_STRUCTURE.md)** — code architecture
- **[PUBLISHING.md](https://github.com/postnitro/postnitro-agent/blob/main/PUBLISHING.md)** — npm release guide
- **[examples/EXAMPLES.md](https://github.com/postnitro/postnitro-agent/blob/main/examples/EXAMPLES.md)** + **[examples/](https://github.com/postnitro/postnitro-agent/tree/main/examples)** — ready-to-use slide JSON and a runnable workflow script
- Per-command help: `postnitro <command> <subcommand> --help`

---

## Common Gotchas

1. **Not authenticated** — run `postnitro auth status`; set a key before anything else.
2. **Scheduling with `embedPostId`** — ⚠️ use the **`designId`** from `--wait`/`carousel output` (Hard Rule 2).
3. **`Scheduled at is in the past`** — `--scheduled-at` must be a future ISO-8601 datetime with a trailing `Z`.
4. **`--<flag> must be valid JSON`** — wrap JSON in single quotes; check for stray commas/quotes.
5. **`Missing --brand-id ... multiple candidates`** — pass the ID or save a default with `defaults set`.
6. **LinkedIn `document` rejected** — `postType:"document"` needs a 5–90 char `postTitle`.
7. **Empty post** — a scheduled post needs either `--design-id` or non-empty `--post-content`.
8. **Destructive commands** — `social disconnect` and `schedule delete` require `--yes`.
9. **`SCHEDULED` publishes live** — use `DRAFT` when unsure; confirm time/account first.
10. **`npm run dev`** — put `--` before CLI args (`npm run dev -- carousel generate ...`).

---

## Quick Reference

```bash
# ⚠️ AUTHENTICATE FIRST
postnitro auth status                                              # Check auth
postnitro auth set-key pn-xxxx                                     # Save key
export POSTNITRO_API_KEY=pn-xxxx                                   # Or env var

# Discovery
postnitro template list                                           # Template IDs
postnitro brand list                                              # Brand IDs
postnitro preset list                                             # AI preset IDs
postnitro social list                                             # Social account IDs
postnitro defaults set --template-id <id> --brand-id <id> --preset-id <id>

# Create
postnitro carousel generate --context "topic" --type text --wait  # AI generate
postnitro carousel import --file ./slides.json --wait             # Import from file
postnitro carousel import --slides '{"slides":[...]}' --wait      # Import inline
postnitro carousel status <embedPostId>                           # Progress
postnitro carousel output <embedPostId>                           # Output + designId

# Schedule (date REQUIRED, must be future; use designId not embedPostId)
postnitro schedule create --status SCHEDULED --scheduled-at "<iso>" --design-id <id> \
  --selected-accounts '["<id>"]' --linkedin-post-settings '{"postType":"document","postTitle":"..."}' \
  --post-content '{"common":"caption"}'
postnitro schedule list --from "<date>" --to "<date>"             # List
postnitro schedule get <id>                                       # Get one
postnitro schedule delete <id> --yes                              # Delete

# One-shot
postnitro generate-and-schedule --context "topic" --status SCHEDULED --scheduled-at "<iso>" ...

# Help
postnitro --help
postnitro schedule create --help
```
