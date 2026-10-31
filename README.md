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

**Create and schedule on-brand social posts — carousels and single images — from the command line.** Built for AI agents and scripts: turn a topic, article, or X thread — or your own content — into a published LinkedIn, Instagram, TikTok, Threads, Facebook Page, or Pinterest post.

PostNitro creates on-brand carousels and single-image posts and schedules them to your social accounts; this CLI is a command-line interface to the [PostNitro Embed API](https://postnitro.ai). Every command prints JSON on stdout (exit 0) or stderr (exit 1) — no colors, tables, or prompts to strip.

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
- `--generate-images` — opt in to AI image generation (images are generated and baked into the design before rendering). Also implied by any of the flags below.
  - `--image-context <text>` — **required when generating images**: a short visual brief guiding the image prompts
  - `--image-placement auto|background|in-line` — where images go (default `auto`, AI decides per slide)
  - `--image-strategy strategic|all` — which slides get images (`strategic` ≈ 50%, default; `all` = every eligible slide)
  - Best-effort: a completed post may still skip images (free plan / over AI-image quota); with `--wait` the result includes an `imageGeneration` step so you can see why. AI images use the org's separate AI-image quota, not the post's slide credits.
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

Unlike `carousel import` (an array of typed slides), `image import` takes **one slide object** via `--slide` (or `--file`) with only these fields: `heading` (**required**), `sub_heading`, `description`, `cta_button`, `image`, `background_image`, plus `layoutType`/`layoutConfig` for the infographic layout (same schema as carousels — every column/item needs a caller-provided `id`). All other options — `--template-id`, `--brand-id`, `--response-type`, `--generate-images` (AI images), `--wait`, … — match the carousel commands. The output `editorUrl` opens in the image editor.

---

### Creating Video Posts

The `video` command group turns slides into a video — **each slide is a scene**, so `video import` takes the same slide array as `carousel import`:

```bash
# See the slide rules + motion settings
postnitro video import-template

# Generate with AI, animated and rendered to MP4
postnitro video generate --context "3 habits that make remote teams faster" \
  --response-type MP4 --wait

# Import your own scenes, in a bolder style, with an audio track
AUDIO=$(postnitro audio list | jq -r '.audios[0].id')
postnitro video import --file ./scenes.json \
  --response-type MP4 --motion-style bold --background-music-id "$AUDIO" --wait

# Design only — no render; finish it in the video maker
postnitro video generate --context "..." --wait

# Status / output (mirror carousel)
postnitro video status <embedPostId>
postnitro video output <embedPostId>
```

**Video-only options:**
- `--response-type MP4|DESIGN` — a video accepts **nothing else** (`PDF`/`PNG` are rejected, and `MP4` is rejected for other post types). Defaults to `DESIGN`; a saved `PDF`/`PNG` default is treated as `DESIGN` and noted in `warnings`.
- `--motion-style <name-or-id>` — how every scene moves: a built-in style's name (`clean`, `bold`, …; `none` keeps it still) or a saved style's id, from `postnitro motion styles`. Optional: a video is animated without it, by its template's own motion, else `clean`.
- `--sequence <id>` — a saved sequence's id, from `postnitro motion sequences`: its animations on every scene, over the style.
- `--background-music-id <id>` — the music: an audio **ID** from `postnitro audio list`, never a URL. Omit for no music. `--audio-id`, its older name, still works.
- `--background-music-volume <0-100>` — the music's volume (default 100). It's lowered to 30% while the voiceover speaks.
- `--voiceover` — an **AI voiceover**: the AI writes a spoken line for every scene and records it, with its words as captions. `--voice <name>` (`alloy`, `ash`, `ballad`, `coral` (default), `echo`, `fable`, `nova`, `onyx`, `sage`, `shimmer`, `verse`) and `--voice-tone <tone>` (`upbeat` (default), `calm`, `professional`, `storyteller`, or your own words, up to 80 characters) imply it; `--no-captions` hides the captions. No script is taken. Each scene lasts as long as its line. It costs the plan's **AI tokens** (the script's, and 5,000 a minute of audio), not API credits, and is best-effort: with the tokens used up the video is made without it, and the status's `VOICEOVER` step says why. On `post edit`, a narrated video is narrated again in its voice and tone; `--no-voiceover` takes it off.

**There is no length to set:** a video runs as long as its motion takes, and the output's `duration` gives it in seconds. Up to 2:00 renders as an MP4. A longer one still makes its design, but the MP4 fails, and the error names the design (`designId`, `editorUrl`, `duration`) to shorten in the editor. `--video-duration`, from older versions, is still accepted and ignored.

Rendering a video takes longer than a carousel — typically 15-45s with `--wait` and `MP4`, and longer for designs with GIFs. The length and audio are reused automatically when the video is scheduled as a reel.

---

### Motion Styles & Sequences

The styles and sequences `--motion-style` and `--sequence` take. They're saved in the PostNitro app's video editor (**Your styles**, **Your sequences**) or through the API; the CLI lists them:

```bash
postnitro motion styles      # built-in styles by name, and saved ones by id
postnitro motion sequences   # saved sequences, by id
```

Each entry is `{ id, name, builtIn, summary }`, plus `createdAt`/`updatedAt` for a saved one.

---

### Reading & Editing a Post

A post made through the API (generate or import) can be read back and edited **in place**, by its `embedPostId`, the one generate, import or an edit returned (they all name the same design):

```bash
# Read it, in the shape import takes, with its brand (free)
postnitro post get <embedPostId> > post.json

# Change post.json's slides, then send them back: every slide is replaced
postnitro post edit <embedPostId> --file post.json --response-type PDF --wait

# Or give the slides inline: an array (carousel, video) or one object (image)
postnitro post edit <embedPostId> --slides '{"heading":"New headline"}'

# Move it to another template or brand as well
postnitro post edit <embedPostId> --file post.json --template-id <templateId> --brand-id <brandId>

# Status / output of the edit
postnitro post status <embedPostId>
postnitro post output <embedPostId>
```

- An edit **replaces every slide**, so send back the ones to keep too. `--file` takes the slides, or `post get`'s output, whose `slides` it reads.
- The design keeps its `designId` and name, and its template's look and size and its brand unless `--template-id` or `--brand-id` gives new ones: a new template takes the slides into its look and size, and a new brand replaces the branding. A video keeps its style and audio unless `--motion-style`, `--sequence`, `--background-music-id` or the voiceover flags give new ones. Anything scheduled with it shows the edit.
- `--response-type` is `DESIGN` (the default), `PDF` or `PNG`, or `MP4`/`DESIGN` for a video. Saved defaults don't apply to an edit, its template and brand included.
- It also takes `--requestor-id`, the AI-image flags and `--wait`. It costs **1 credit per slide** sent.
- A post still being made has no design to read or edit yet: wait until it's `COMPLETED`. A slide whose title was turned off in the editor comes back without a `heading`; give it one, since import needs it.

---

### Audio Tracks

Audio for video posts and reels. **Uploading happens in the PostNitro app** — the CLI lists and deletes only:

```bash
postnitro audio list                     # ids to pass as --background-music-id
postnitro audio delete <audioId> --yes   # destructive
```

`audio list` returns `{ id, name, url, duration, artistName, source, createdAt }` per track. Use `id` for `--background-music-id` (and for a reel's `postSettings.backgroundMusicId`); `url` is only for previewing. A track's `duration` is its own — a longer track is cut off at the video's length.

`audio delete` removes the record **and** the stored file, and is refused while a scheduled post still references the track. Videos already rendered to MP4 keep their audio, since it's baked into the file.

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
- `--post-content <json>` — captions object keyed by platform (`common`, `linkedin`, `instagram`, `tiktok`, `facebook`, `threads`, `pinterest`)
- `--selected-accounts <json>` — array of social-account IDs
- `--instagram-post-settings` / `--tiktok-post-settings` / `--linkedin-post-settings` / `--threads-post-settings` / `--facebook-post-settings` / `--pinterest-post-settings` — per-platform settings (JSON)
- `--post-settings <json>` — a reel's music (`backgroundMusicId`, or `audioId`, its older name)
- `--file <path>` — a JSON file with any of the above (inline flags override it)

A post must have **either** a `--design-id` **or** non-empty `--post-content`. Hashtags are auto-extracted from captions.

`--post-settings` carries a reel's audio (`{"backgroundMusicId":"..."}`) and is **optional** — when omitted, the reel takes the audio the attached design was made with, if any. A reel runs as long as its design, so there's no length to set (a `videoDuration` sent is ignored).

`schedule list` takes an optional `--accounts <id,id>` filter. It filters **posts**, not the accounts inside them: a post targeting LinkedIn and Instagram is returned when you filter by either, and it still reports both. Unknown IDs match nothing rather than erroring.

**Manage schedules**
```bash
postnitro schedule list --from "2026-01-01" --to "2026-12-31"
postnitro schedule list --from "2026-01-01" --to "2026-12-31" --accounts "<id>,<id>"  # only posts hitting these accounts
postnitro schedule get <id>
postnitro schedule update <id> ...same flags as create...   # REPLACES state — send the full intended body
postnitro schedule delete <id> --yes
```

---

### One-shot: Create + Schedule

Two commands create and schedule in a single call: `generate-and-schedule` (AI-generated) and `import-and-schedule` (your own content). Both accept `--post-type CAROUSEL|IMAGE|VIDEO` (a video also takes `--motion-style`/`--sequence`/`--background-music-id`/`--voiceover`), the AI-image flags (`--generate-images` …), and all the scheduling options.

```bash
# AI-generated
postnitro generate-and-schedule \
  --context "How AI agents automate content" \
  --type text \
  --status SCHEDULED \
  --scheduled-at "2026-12-31T12:00:00Z" \
  --selected-accounts '["<socialAccountId>"]' \
  --linkedin-post-settings '{"postType":"document","postTitle":"How AI agents automate content"}' \
  --post-content '{"common":"New drop 🚀 #ai #automation"}'

# Your own content — --slides (carousel array) or --slide (single image); --slides-file for a file.
# Note: --file here is the SCHEDULE body, so slide content comes from --slides / --slides-file.
postnitro import-and-schedule \
  --slides '{"slides":[{"type":"starting_slide","heading":"..."}, ...]}' \
  --status SCHEDULED \
  --scheduled-at "2026-12-31T12:00:00Z" \
  --selected-accounts '["<socialAccountId>"]' \
  --post-content '{"common":"..."}'
```

Creates the design, waits for it, then schedules it — in one command. If creation succeeds but scheduling fails, the error includes the `designId` so you can retry scheduling **without re-creating** (and re-spending credits).

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

### Facebook
```bash
postnitro schedule create \
  --status SCHEDULED --scheduled-at "2026-12-31T12:00:00Z" \
  --design-id <designId> \
  --selected-accounts '["facebook-page-account-id"]' \
  --facebook-post-settings '{"postType":"carousel"}' \
  --post-content '{"facebook":"Caption"}'
```

`carousel` posts every slide as one multi-photo post. For swipeable link cards use `{"postType":"link_carousel","linkUrl":"https://example.com","callToAction":"LEARN_MORE"}` — see [PLATFORM_SETTINGS.md](PLATFORM_SETTINGS.md#facebook----facebook-post-settings).

### Pinterest
```bash
postnitro schedule create \
  --status SCHEDULED --scheduled-at "2026-12-31T12:00:00Z" \
  --design-id <designId> \
  --selected-accounts '["pinterest-board-account-id"]' \
  --pinterest-post-settings '{"postType":"carousel","title":"Pin title","link":"https://example.com"}' \
  --post-content '{"pinterest":"Pin description"}'
```

Pinterest accounts are boards — each connected board is its own account. `carousel` publishes a carousel Pin (2–5 slides), `image` a single image Pin, `reel` a video Pin. `title` (max 100 chars) and `link` are optional; only the first 800 characters of the caption are published. 2:3 designs work best — see [PLATFORM_SETTINGS.md](PLATFORM_SETTINGS.md#pinterest----pinterest-post-settings).

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
- **[PLATFORM_SETTINGS.md](PLATFORM_SETTINGS.md)** — LinkedIn/Instagram/TikTok/Threads/Facebook/Pinterest settings schemas
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
| `/post/initiate/generate` | POST | Start AI generation of a post (carousel, image or video) |
| `/post/initiate/import` | POST | Start an import from your own content (carousel or video slides, or a single image) |
| `/post/:designId` | GET | Read a design made through the API, in import's shape |
| `/post/edit` | POST | Edit a design made through the API: its slides replaced, in place |
| `/post/status/:id` | GET | Check generation status + step logs |
| `/post/output/:id` | GET | Get final output + `designId` |
| `/template` | GET | List templates |
| `/brand` | GET / POST | List / create brands |
| `/brand/:id` | GET / PUT | Get / update a brand |
| `/ai-preset` | GET | List AI presets |
| `/audio` | GET | List audio tracks |
| `/audio/:id` | DELETE | Delete an audio track |
| `/motion-style` | GET | List motion styles |
| `/motion-sequence` | GET | List motion sequences |
| `/social-account` | GET | List connected social accounts |
| `/social-account/:id` | GET / DELETE | Get / disconnect a social account |
| `/schedule` | GET / POST | List / create scheduled posts |
| `/schedule/:id` | GET / PUT / DELETE | Get / update / delete a scheduled post |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTNITRO_API_KEY` | No* | - | Your PostNitro Embed API key |
| `POSTNITRO_CONFIG_DIR` | No | `~/.postnitro-cli` | Where config/defaults are stored |
| `POSTNITRO_API_URL` | No | `https://embed-api.postnitro.ai` | The Embed API to call, e.g. a staging one |

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
│   ├── carousel.ts             # carousel generate / import / status / output
│   ├── image.ts                # image generate / import / status / output
│   ├── social.ts               # Social account management
│   ├── schedule.ts             # Scheduling CRUD
│   ├── generate-and-schedule.ts# One-shot AI generate + schedule
│   └── import-and-schedule.ts  # One-shot import + schedule
└── lib/
    ├── client.ts               # PostNitro API client
    ├── config-store.ts         # Key + defaults resolution
    ├── generation.ts           # Shared create-flow helpers (client, defaults, output, AI-image opts)
    ├── slide-input.ts          # Shared slide/​image-slide JSON parsing
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

# Create (carousel or image; add --generate-images --image-context "..." for AI images)
postnitro carousel generate --context "topic" --type text --wait      # AI generate carousel
postnitro carousel import --file ./slides.json --wait                 # Import carousel (slides array)
postnitro image generate --context "topic" --wait                     # AI generate single image
postnitro image import --slide '{"heading":"..."}' --wait             # Import single image (one object)
postnitro video generate --context "topic" --response-type MP4 --wait # AI generate video (animated)
postnitro video import --file ./scenes.json --motion-style bold --wait # Import video (slides = scenes)
postnitro motion styles                                               # Style ids for --motion-style (also: motion sequences)
postnitro post get <embedPostId>                                       # Read an API-made post
postnitro post edit <embedPostId> --file ./post.json --wait          # Replace its slides, in place
postnitro audio list                                                  # Audio ids for --background-music-id
postnitro audio delete <audioId> --yes                                # Delete a track
postnitro carousel status <embedPostId>                               # Check progress (also: image/video status)
postnitro carousel output <embedPostId>                               # Get output + designId (also: image/video output)

# Schedule
postnitro schedule create --status SCHEDULED --scheduled-at "<iso>" --design-id <id> \
  --selected-accounts '["<id>"]' --linkedin-post-settings '{"postType":"document","postTitle":"..."}' \
  --post-content '{"common":"caption"}'
postnitro schedule list --from "<date>" --to "<date>"                 # List (add --accounts "<id>,<id>" to filter)
postnitro schedule get <id>                                           # Get one
postnitro schedule delete <id> --yes                                  # Delete

# One-shot: create + schedule (both take --post-type + AI-image flags)
postnitro generate-and-schedule --context "topic" --status SCHEDULED --scheduled-at "<iso>" ...
postnitro import-and-schedule --slides '{"slides":[...]}' --status SCHEDULED --scheduled-at "<iso>" ...   # or --slide for image

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
