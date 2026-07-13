# Features

What the PostNitro CLI can do.

## Carousel creation
- **AI generation** from a topic (`--type text`), an article URL (`--type article`), or an X post URL (`--type x`), with optional `--instructions`.
- **Import your own slides** from a file (`--file`) or inline JSON (`--slides`) — a bare array or `{ "slides": [...] }`.
- **`carousel import-template`** prints the authoritative slide schema and rules.
- **Infographic slides** with multi-column `layoutConfig` (up to 3 columns).
- **PDF, PNG, or DESIGN** output (`--response-type`). `DESIGN` skips rendering and just creates the editable design (returns `designId` + `editorUrl`, no file).

## Single-image posts
- **`image generate` / `image import`** create a single-image post (mirrors the `carousel` commands). Import takes **one slide object** (not an array) via `--slide`/`--file`.
- **`image import-template`** prints the authoritative image-slide schema.

## Async handling
- **`--wait`** polls generation/import to completion and returns the final output — including the `designId` and `editorUrl` — in a single call.
- Manual tracking via **`carousel`/`image status <embedPostId>`** (step logs) and **`carousel`/`image output <embedPostId>`**.

## Brand kits
- **List / get / create / update** brand kits (logo, name, handle stamped on carousels).
- Create from individual flags (`--name/--handle/--image`), inline JSON (`--data`), or a file (`--file`).
- Toggle rendered elements with `--no-show-name`, `--no-show-handle`, `--no-show-image`.

## Scheduling
- **Create scheduled posts or drafts** (`--status SCHEDULED|DRAFT`) for **LinkedIn, Instagram, TikTok, and Threads**.
- Per-platform settings via JSON flags (see [PLATFORM_SETTINGS.md](PLATFORM_SETTINGS.md)).
- Platform-keyed captions (`--post-content`) with automatic hashtag extraction.
- **List / get / update / delete** scheduled posts.
- **`generate-and-schedule`** — generate a carousel and schedule it in one command; on scheduling failure it returns the `designId` so you can retry without regenerating.

## Discovery & defaults
- **List** templates, brands, presets, and social accounts.
- **Save defaults** (template/brand/preset/response-type) so create calls omit the IDs.
- **Auto-select** when a workspace has exactly one candidate.

## Built for AI agents & scripts
- **JSON everywhere:** success → JSON on stdout (exit 0); failure → JSON on stderr (exit 1).
- **No interactive prompts** — destructive actions require an explicit `--yes`.
- **Inline JSON** options that override `--file`, so agents don't need temp files.
- **Local validation** of inline JSON and required fields before any network call.
- **Distributable as a skill/plugin** — see [SKILL.md](SKILL.md).

## Configuration
- API key via `--api-key`, `POSTNITRO_API_KEY`, or saved config (`postnitro auth set-key`).
- Custom endpoint via `--base-url` / `POSTNITRO_API_BASE_URL`.
- Config location override via `POSTNITRO_CONFIG_DIR`.
