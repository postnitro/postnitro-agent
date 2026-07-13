## Install as a skill

```bash
npx skills add postnitro/postnitro-agent
```

This installs the PostNitro skill for your AI coding agent. For **Claude Code** specifically, you can instead add it as a plugin:

```bash
# in Claude Code
/plugin marketplace add postnitro/postnitro-agent
/plugin install postnitro@postnitro-agent
```

The skill is defined in [`SKILL.md`](SKILL.md) at the repo root (with a copy under [`skills/postnitro/`](skills/postnitro/SKILL.md)); the Claude Code plugin manifests live in [`.claude-plugin/`](.claude-plugin/).

---

# PostNitro CLI

**Create and schedule on-brand social carousels from the command line.** Built for AI agents and scripts: turn a topic, article, or X thread — or your own slides — into a published LinkedIn, Instagram, TikTok, or Threads post.

PostNitro creates on-brand carousels and schedules them to your social accounts; this CLI is a command-line interface to the [PostNitro Embed API](https://postnitro.ai). Every command prints JSON on stdout (exit 0) or stderr (exit 1) — no colors, tables, or prompts to strip.

---

## Installation

### From npm (recommended)

```bash
npm install -g @postnitro/cli
postnitro --help
```

### Local development

```bash
npm install
npm run build
node dist/index.js --help
# or run from source without building (note the `--` before CLI args):
npm run dev -- --help
```

---

## Authentication

Get an API key from **PostNitro → Profile → Embed → Generate API Key**. Provide it in any of these ways (in order of precedence):

1. `--api-key <key>` flag on any command
2. `POSTNITRO_API_KEY` environment variable
3. Saved config: `postnitro auth set-key <key>` (stored in `~/.postnitro-cli/config.json`)

```bash
# Save a key (persists to ~/.postnitro-cli/config.json)
postnitro auth set-key pn-xxxxxxxxxxxx

# Check current auth status
postnitro auth status

# Remove the stored key
postnitro auth clear
```

**Optional:** custom API endpoint

```bash
export POSTNITRO_API_BASE_URL=https://your-custom-api.com
```

---

## Commands

### Discovery & Settings

**List templates, brands, and AI presets**
```bash
postnitro template list [--page <n>] [--limit <n>]
postnitro brand list [--page <n>] [--limit <n>]
postnitro brand get <id>
postnitro preset list [--page <n>] [--limit <n>]
```

Use these to discover the IDs you'll pass to `generate` / `import` / `schedule`.

**List connected social accounts**
```bash
postnitro social list
postnitro social get <id>
```

Returns social-account IDs (needed for `--selected-accounts` when scheduling), platforms, handles, and token status.

**Save workspace defaults**
```bash
postnitro defaults set --template-id <id> --brand-id <id> --preset-id <id> --response-type PDF
postnitro defaults get
```

Resolution order for each field: **explicit flag → saved default → auto-select** (auto-selects when your workspace has exactly one candidate). Saves you from repeating IDs on every call.

---

### Creating Carousels

**See the required slide shape**
```bash
postnitro carousel import-template
```

**Generate with AI**
```bash
# From a topic
postnitro carousel generate --context "5 tips for remote work" --type text --wait

# From an article URL
postnitro carousel generate --context "https://example.com/post" --type article --wait

# From an X (Twitter) post URL
postnitro carousel generate --context "https://x.com/user/status/123" --type x --wait
```

**Import your own slides**
```bash
# From a file
postnitro carousel import --file ./slides.json --wait

# Inline JSON (overrides --file)
postnitro carousel import --slides '{"slides":[{"type":"starting_slide","heading":"..."}, ...]}' --wait
```

The slides value can be a bare array or `{ "slides": [...] }`. Complete examples:
[examples/import-slides.json](examples/import-slides.json), [examples/cli-launch-slides.json](examples/cli-launch-slides.json).

**Options (generate / import):**
- `--context <text>` — topic, article URL, or X URL (generate only, **required**)
- `--type text|article|x` — how `--context` is interpreted (generate only, default `text`)
- `--instructions <text>` — extra guidance for the AI (generate only)
- `--slides <json>` / `--file <path>` — slide content (import only)
- `--template-id <id>` / `--brand-id <id>` / `--preset-id <id>` — override saved defaults (`--preset-id` is generate only)
- `--response-type PDF|PNG|DESIGN` — output format (default `PDF`). `DESIGN` skips rendering and only creates the editable design (no file), returning just `designId` + `editorUrl` — faster when you only need to schedule or edit.
- `--requestor-id <id>` — optional custom tracking ID
- `--wait` — poll until completion and return the final output in one call

---

### Creating Single-Image Posts

For a single image (not a multi-slide carousel), use the `image` command group — it mirrors `carousel` but produces one image:

```bash
# See the required slide shape
postnitro image import-template

# Generate with AI
postnitro image generate --context "Announce our new scheduling feature" --wait

# Import your own content — a SINGLE slide object (not an array)
postnitro image import --slide '{"heading":"Welcome!","sub_heading":"Subtitle","cta_button":"Learn more"}' --wait

# Status / output (mirror carousel)
postnitro image status <embedPostId>
postnitro image output <embedPostId>
```

Unlike `carousel import` (an array of typed slides), `image import` takes **one slide object** via `--slide` (or `--file`) with only these fields: `heading` (**required**), `sub_heading`, `description`, `cta_button`, `image`, `background_image`, plus `layoutType`/`layoutConfig` for the infographic layout (same schema as carousels — every column/item needs a caller-provided `id`). All other options (`--template-id`, `--brand-id`, `--response-type`, `--wait`, …) match the carousel commands. The output `editorUrl` opens in the image editor.

---

### Checking Status & Output

Generation is **asynchronous**. `--wait` handles polling for you; otherwise track it manually:

```bash
postnitro carousel status <embedPostId>   # generation progress + step logs
postnitro carousel output <embedPostId>   # final files + designId + editorUrl (once COMPLETED)
```

> **`embedPostId` vs `designId`:** `generate`/`import` return an **`embedPostId`** (the job). To *schedule* the finished carousel you need its **`designId`** (from `carousel output` or the `--wait` result) — not the `embedPostId`.

---

### Scheduling

**Create a scheduled post or draft**
```bash
postnitro schedule create \
  --status SCHEDULED \
  --scheduled-at "2026-12-31T12:00:00Z" \
  --design-id <designId> \
  --selected-accounts '["<socialAccountId>"]' \
  --linkedin-post-settings '{"postType":"document","postTitle":"5–90 char title"}' \
  --post-content '{"common":"Caption with #hashtags"}'
```

**Options:**
- `--status DRAFT|SCHEDULED` — **required** (`SCHEDULED` publishes at the given time; `DRAFT` saves without publishing)
- `--scheduled-at <iso>` — **required** future ISO-8601 datetime (use a trailing `Z`)
- `--design-id <id>` — the carousel design to attach (from `carousel output`)
- `--post-content <json>` — captions object keyed by platform (`common`, `linkedin`, `instagram`, `tiktok`, `facebook`, `threads`)
- `--selected-accounts <json>` — array of social-account IDs
- `--instagram-post-settings` / `--tiktok-post-settings` / `--linkedin-post-settings` / `--threads-post-settings` — per-platform settings (JSON)
- `--post-settings <json>` — reel settings (`videoDuration`, `audioId`)
- `--file <path>` — a JSON file with any of the above (inline flags override it)

A post must have **either** a `--design-id` **or** non-empty `--post-content`. Hashtags are auto-extracted from captions.

**Manage schedules**
```bash
postnitro schedule list --from "2026-01-01" --to "2026-12-31"
postnitro schedule get <id>
postnitro schedule update <id> ...same flags as create...   # REPLACES state — send the full intended body
postnitro schedule delete <id> --yes
```

---

### One-shot: Generate + Schedule

```bash
postnitro generate-and-schedule \
  --context "How AI agents automate content" \
  --type text \
  --status SCHEDULED \
  --scheduled-at "2026-12-31T12:00:00Z" \
  --selected-accounts '["<socialAccountId>"]' \
  --linkedin-post-settings '{"postType":"document","postTitle":"How AI agents automate content"}' \
  --post-content '{"common":"New drop 🚀 #ai #automation"}'
```

Generates a carousel, waits for it, then schedules the resulting design — in one command. If generation succeeds but scheduling fails, the error includes the `designId` so you can retry scheduling **without regenerating** (and re-spending credits).

---

### Brand Kits

```bash
# Individual flags
postnitro brand create --name "PostNitro" --handle "@postnitroai" --image "https://.../logo.png" [--company-detail]

# Full object inline (overrides --file and the individual flags)
postnitro brand create --data '{"name":"PostNitro","handle":"@postnitroai","image":"https://.../logo.png","isCompanyDetail":true}'

# Update (all fields required by the API — fetch current values with `brand get` first)
postnitro brand update <id> ...same as create...
```

Toggle what's rendered on slides with `--no-show-name`, `--no-show-handle`, `--no-show-image`.

---

## Platform-Specific Features

Set per-platform behavior via the `--*-post-settings` flags when scheduling. Settings are conditionally required based on the platforms among your `--selected-accounts`.

### LinkedIn
```bash
# PDF carousels are normally posted as documents (postTitle required, 5–90 chars)
postnitro schedule create \
  --status SCHEDULED --scheduled-at "2026-12-31T12:00:00Z" \
  --design-id <designId> \
  --selected-accounts '["linkedin-account-id"]' \
  --linkedin-post-settings '{"postType":"document","postTitle":"My carousel title"}' \
  --post-content '{"common":"LinkedIn caption #build"}'
```
`postType`: `carousel | document | image | reel`.

### Instagram
```bash
postnitro schedule create \
  --status SCHEDULED --scheduled-at "2026-12-31T12:00:00Z" \
  --design-id <designId> \
  --selected-accounts '["instagram-account-id"]' \
  --instagram-post-settings '{"postType":"carousel","postAsStory":false}' \
  --post-content '{"instagram":"Caption #hashtag"}'
```

### TikTok
```bash
postnitro schedule create \
  --status SCHEDULED --scheduled-at "2026-12-31T12:00:00Z" \
  --design-id <designId> \
  --selected-accounts '["tiktok-account-id"]' \
  --tiktok-post-settings '{"postType":"carousel","privacyLevel":"PUBLIC_TO_EVERYONE","canComment":true,"isBrandedContent":false,"isYourBrand":false,"isThirdPartyBrand":false,"isAIGeneratedContent":true}' \
  --post-content '{"tiktok":"Caption #fyp"}'
```

### Threads
```bash
postnitro schedule create \
  --status SCHEDULED --scheduled-at "2026-12-31T12:00:00Z" \
  --design-id <designId> \
  --selected-accounts '["threads-account-id"]' \
  --threads-post-settings '{"postType":"carousel"}' \
  --post-content '{"threads":"Caption"}'
```

---

## Features for AI Agents

### Discovery workflow
The CLI enables dynamic discovery so agents don't need hardcoded IDs:

1. **List resources** — `template list`, `brand list`, `preset list`, `social list`
2. **Save defaults** — `defaults set` so later calls omit the IDs
3. **Create** — `carousel generate` or `carousel import` (use `--wait`)
4. **Capture the `designId`** — from the `--wait` result or `carousel output`
5. **Schedule** — `schedule create --design-id ...` to the discovered social accounts

### JSON mode
Pass complex bodies inline as JSON (agent-friendly) or from a file — inline wins:

```bash
postnitro carousel import --slides '{"slides":[ ... ]}'
postnitro schedule create --post-content '{"common":"..."}' --selected-accounts '["id"]' ...
postnitro brand create --data '{"name":"...","handle":"@...","image":"https://..."}'
# or, from a file:
postnitro schedule create --file ./post.json
```

### All output is JSON
Every command outputs JSON for easy parsing:

```bash
DID=$(postnitro carousel import --file ./slides.json --wait | jq -r .designId)
LINKEDIN=$(postnitro social list | jq -r 'first(.accounts[] | select(.platform=="linkedin").id)')
```

### Async with `--wait`
`--wait` on `generate`/`import` polls until completion and returns the final output (including `designId`) in a single call — ideal for one-shot agent tool calls.

---

## Common Workflows

### Generate → schedule to LinkedIn
```bash
#!/bin/bash
DID=$(postnitro carousel generate --context "5 remote work habits" --type text --wait | jq -r .designId)
LINKEDIN=$(postnitro social list | jq -r 'first(.accounts[] | select(.platform=="linkedin").id)')

postnitro schedule create \
  --status SCHEDULED \
  --scheduled-at "2026-12-31T13:00:00Z" \
  --design-id "$DID" \
  --selected-accounts "[\"$LINKEDIN\"]" \
  --linkedin-post-settings '{"postType":"document","postTitle":"5 remote work habits"}' \
  --post-content '{"common":"New carousel 🚀 #remotework"}'
```

### Import your own slides, then schedule
```bash
#!/bin/bash
DID=$(postnitro carousel import --file ./examples/import-slides.json --wait | jq -r .designId)
postnitro schedule create --status DRAFT --scheduled-at "2026-12-31T13:00:00Z" --design-id "$DID"
```

### Batch scheduling
```bash
#!/bin/bash
DATES=("2026-02-14T09:00:00Z" "2026-02-15T09:00:00Z" "2026-02-16T09:00:00Z")
TOPICS=("Monday motivation 💪" "Tuesday tips 💡" "Wednesday wisdom 🧠")

for i in "${!DATES[@]}"; do
  postnitro generate-and-schedule \
    --context "${TOPICS[$i]}" --type text \
    --status SCHEDULED --scheduled-at "${DATES[$i]}" \
    --selected-accounts '["<socialAccountId>"]' \
    --linkedin-post-settings '{"postType":"document","postTitle":"Daily post"}'
done
```

---

## Documentation

**For AI agents:**
- **[SKILL.md](SKILL.md)** — skill reference with patterns and the key gotchas

**Deep-dive guides:**
- **[QUICK_START.md](QUICK_START.md)** — zero to a scheduled carousel in minutes
- **[HOW_TO_RUN.md](HOW_TO_RUN.md)** — install & run methods (npm, npx, skill, local dev)
- **[PLATFORM_SETTINGS.md](PLATFORM_SETTINGS.md)** — LinkedIn/Instagram/TikTok/Threads settings schemas
- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** — code architecture
- **[FEATURES.md](FEATURES.md)** — full feature list
- **[PUBLISHING.md](PUBLISHING.md)** — npm release guide

**Examples:**
- **[examples/EXAMPLES.md](examples/EXAMPLES.md)** — runnable recipes and file index
- **[examples/basic-usage.sh](examples/basic-usage.sh)** — end-to-end workflow script
- **[examples/](examples/)** — ready-to-use slide JSON files

**Changes:**
- **[CHANGELOG.md](CHANGELOG.md)** — release notes

Run `postnitro <command> --help` or `postnitro <command> <subcommand> --help` for full flag details.

---

## API Endpoints

The CLI interacts with these PostNitro Embed API endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/post/initiate/generate` | POST | Start an AI carousel generation |
| `/post/initiate/import` | POST | Start an import from your own slides |
| `/post/status/:id` | GET | Check generation status + step logs |
| `/post/output/:id` | GET | Get final output + `designId` |
| `/template` | GET | List templates |
| `/brand` | GET / POST | List / create brands |
| `/brand/:id` | GET / PUT | Get / update a brand |
| `/ai-preset` | GET | List AI presets |
| `/social-account` | GET | List connected social accounts |
| `/social-account/:id` | GET / DELETE | Get / disconnect a social account |
| `/schedule` | GET / POST | List / create scheduled posts |
| `/schedule/:id` | GET / PUT / DELETE | Get / update / delete a scheduled post |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTNITRO_API_KEY` | No* | - | Your PostNitro Embed API key |
| `POSTNITRO_API_BASE_URL` | No | `https://embed-api.postnitro.ai` | Custom API endpoint (also `--base-url`) |
| `POSTNITRO_CONFIG_DIR` | No | `~/.postnitro-cli` | Where config/defaults are stored |

*Either `--api-key`, `POSTNITRO_API_KEY`, or a saved key (`auth set-key`) is required.

---

## Error Handling

Failures print JSON to **stderr** and exit non-zero:

```json
{ "success": false, "error": { "message": "PostNitro API error (422): ...", "statusCode": 422 } }
```

- **Exit code 0**: success
- **Exit code 1**: error

**Common errors:**

| Error | Solution |
|-------|----------|
| `No API key found` | Pass `--api-key`, set `POSTNITRO_API_KEY`, or run `auth set-key` |
| `Missing --brand-id ... multiple candidates` | Pass the ID or save one via `defaults set` |
| `Scheduled at is in the past` | Use a **future** ISO-8601 datetime with trailing `Z` |
| `--<flag> must be valid JSON` | Fix the inline JSON string |
| `Slides must be an array with at least 3 entries` | Provide starting + body + ending slides |
| `Refusing to delete ... without --yes` | Add `--yes` to confirm destructive actions |

---

## Development

### Project structure

```
src/
├── index.ts                    # CLI entry point (commander)
├── commands/
│   ├── auth.ts                 # API key management
│   ├── defaults.ts             # Saved template/brand/preset defaults
│   ├── template.ts             # Template listing
│   ├── brand.ts                # Brand kit CRUD
│   ├── preset.ts               # AI preset listing
│   ├── carousel.ts             # generate / import / status / output
│   ├── social.ts               # Social account management
│   ├── schedule.ts             # Scheduling CRUD
│   └── generate-and-schedule.ts# One-shot generate + schedule
└── lib/
    ├── client.ts               # PostNitro API client
    ├── config-store.ts         # Key + defaults resolution
    ├── schedule-input.ts       # Shared schedule JSON option parsing
    ├── schedule-warnings.ts    # Soft validation warnings
    ├── json-file.ts            # JSON file reader
    ├── output.ts               # JSON stdout/stderr + error wrapper
    └── types.ts                # Shared types
```

### Scripts

```bash
npm run dev       # Run from source with tsx (use: npm run dev -- <args>)
npm run build     # Compile TypeScript to dist/
npm run start     # Run the built CLI (node dist/index.js)
```

The build is a plain `tsc` compile; `bin.postnitro` points to `dist/index.js`, and `prepublishOnly` rebuilds before publish.

---

## Quick Reference

```bash
# Authentication
postnitro auth set-key <key>                                          # Save API key
postnitro auth status                                                 # Check auth
postnitro auth clear                                                  # Remove key
export POSTNITRO_API_KEY=your_key                                     # Or use env var

# Discovery
postnitro template list                                               # List templates
postnitro brand list                                                  # List brands
postnitro preset list                                                 # List AI presets
postnitro social list                                                 # List social accounts
postnitro defaults set --template-id <id> --brand-id <id> --preset-id <id>

# Create
postnitro carousel generate --context "topic" --type text --wait      # AI generate
postnitro carousel import --file ./slides.json --wait                 # Import from file
postnitro carousel import --slides '{"slides":[...]}' --wait          # Import inline
postnitro carousel status <embedPostId>                               # Check progress
postnitro carousel output <embedPostId>                               # Get output + designId

# Schedule
postnitro schedule create --status SCHEDULED --scheduled-at "<iso>" --design-id <id> \
  --selected-accounts '["<id>"]' --linkedin-post-settings '{"postType":"document","postTitle":"..."}' \
  --post-content '{"common":"caption"}'
postnitro schedule list --from "<date>" --to "<date>"                 # List
postnitro schedule get <id>                                           # Get one
postnitro schedule delete <id> --yes                                  # Delete

# One-shot
postnitro generate-and-schedule --context "topic" --status SCHEDULED --scheduled-at "<iso>" ...

# Help
postnitro --help
postnitro schedule create --help
```

---

## License

MIT

---

## Links

- **Website:** [postnitro.ai](https://postnitro.ai)
- **GitHub:** [postnitro/postnitro-agent](https://github.com/postnitro/postnitro-agent)
