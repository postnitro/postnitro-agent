# Changelog

All notable changes to the PostNitro CLI are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2026-10-07

Adds scheduling to Pinterest boards.

### Added
- **`--pinterest-post-settings <json>`** on `schedule create`, `schedule update`, `generate-and-schedule` and `import-and-schedule`, and as `pinterestPostSettings` in a `--file` schedule body. Fields: `postType` (required) plus optional `title` (max 100 characters) and `link` (http(s) URL). Three post types:
  - `carousel`: a carousel Pin (2–5 slides; a 1-slide design publishes as an image Pin)
  - `image`: a single image Pin
  - `reel`: a video Pin (reel timing via `--post-settings`, as on other platforms)
- **Pinterest boards in `social list`**, under `pinterest` (`accountType: "board"`). Each connected board is its own account; use its ID in `--selected-accounts` and caption it with the `pinterest` key of `--post-content`.
- **Warnings** when a Pinterest `title` exceeds 100 characters (the API rejects it) and when the Pinterest caption exceeds 800 characters (only the first 800 are published as the Pin description).

### Changed
- The no-design warning now covers Pinterest settings as well.
- `PLATFORM_SETTINGS.md`, the README and the skill document the Pinterest settings, with examples, content tips and gotchas.
- The CLI's `--version`, `package-lock.json` and the Claude plugin manifests now report the same version as `package.json`. The plugin manifests also list Facebook and Pinterest.

### Notes
- A design is required to schedule to a Pinterest board, and `pinterestPostSettings` is required whenever a Pinterest board is selected and a design is attached.
- A `carousel` Pin takes 2–5 slides; more than 5 fails at publish time. Any design size works except ultra-wide (wider than 21:9); 2:3 is recommended.
- Requires the Embed API release that accepts `pinterestPostSettings`; earlier API versions reject the field.

## [1.4.1] - 2026-09-29

Adds scheduling to Facebook Pages. First release since 1.3.0 (1.4.0 was not published).

### Added
- **`--facebook-post-settings <json>`** on `schedule create`, `schedule update`, `generate-and-schedule` and `import-and-schedule`, and as `facebookPostSettings` in a `--file` schedule body. Four post types:
  - `carousel`: every slide in one multi-photo post
  - `link_carousel`: swipeable cards (2–10 slides) that all link to `linkUrl`, with optional `callToAction` (e.g. `LEARN_MORE`, `SHOP_NOW`), `showEndCard`, `useSlideTitles` and `useSlideDescriptions`
  - `image`: a single-slide design
  - `reel`: a video, published as a Reel
- **Facebook Pages in `social list`**, under `facebook` (`accountType: "page"`). Use their IDs in `--selected-accounts`, and caption them with the `facebook` key of `--post-content`.
- **Warning** when a `SCHEDULED` `link_carousel` has no `linkUrl`, since the API rejects it.

### Changed
- The no-design warning now covers Facebook settings as well.
- `PLATFORM_SETTINGS.md`, the README and the skill document the Facebook settings, with examples. The skill's content tips and gotchas cover when to use `carousel` versus `link_carousel`.

### Notes
- A design is required to schedule to a Facebook Page.
- Facebook only accepts `link_carousel` card images for links on a domain the Page's business has verified in Meta Business Settings. Use `carousel` for designs linking elsewhere.
- Requires the Embed API release that accepts `facebookPostSettings`; earlier API versions reject the field.

## [1.3.0] - 2026-08-09

Adds video posts (the Embed API's `VIDEO` post type and `MP4` output), the audio commands that resolve an `audioId`, and an account filter on `schedule list`.

### Added
- **Video posts** — `postnitro video generate` / `video import` / `video status` / `video output` / `video import-template`. Slides are **scenes**, so `video import` takes the same slide array as `carousel import`. New flags `--video-duration <seconds>` (the whole video's length: at least 5, under 60 — required when rendering) and `--audio-id <id>` (an audio ID, never a URL).
- **`MP4` response type**, video-only. A video accepts only `MP4` or `DESIGN`; `PDF`/`PNG` are rejected for a video and `MP4` is rejected for the other post types. Video commands default to `DESIGN`, and a saved `PDF`/`PNG` default is treated as `DESIGN` with a note in `warnings` rather than failing the call. `MP4` cannot be stored via `defaults set`, since it would break carousel and image calls.
- **Audio commands** — `postnitro audio list` (the IDs used by `--audio-id` and a reel's `postSettings.audioId`) and `postnitro audio delete <id> --yes`. Uploading is done in the PostNitro app; the CLI lists and deletes only. Deletion is refused while a scheduled post still references the track.
- **`--post-type VIDEO`** on `generate-and-schedule` and `import-and-schedule`, with `--video-duration`/`--audio-id`.
- **`schedule list --accounts <id,id>`** — filter scheduled posts by social account. It filters *posts*, not the accounts within them: a post targeting two platforms is returned when you filter by either, and it still reports every account it targets. Unknown IDs match nothing rather than erroring.

### Changed
- A reel's `--post-settings` is now optional: when omitted, the API fills the duration and audio from the settings the attached design was generated with, falling back to 30 seconds with no audio.

## [1.2.0] - 2026-07-16

Adds opt-in AI image generation (the Embed API's `generateImages` feature) and fixes the API base URL to the hosted endpoint.

### Added
- **AI image generation** (opt-in) on all generate/import commands and both one-shot commands: `--generate-images`, `--image-context <text>` (**required** when generating images), `--image-placement auto|background|in-line`, `--image-strategy strategic|all`. Best-effort — `--wait` results surface the `GENERATE_IMAGES` job step as `imageGeneration` (a COMPLETED post can still have a skipped/failed image step, e.g. free plan / over AI-image quota). AI images bill against the org's separate AI-image quota, not the post's slide credits.
- `import-and-schedule` — one-shot import + schedule, the counterpart to `generate-and-schedule`. Takes `--slides` (carousel array) / `--slide` (single image) / `--slides-file`, plus `--post-type CAROUSEL|IMAGE`, the schedule options, and the AI-image flags. `--file` is the schedule body (as in `generate-and-schedule`). On scheduling failure it returns the `designId` so you can retry without re-importing.

### Removed
- The `--base-url` global flag and `POSTNITRO_API_BASE_URL` environment variable. The API base URL is now a fixed constant (`https://embed-api.postnitro.ai`) — PostNitro is hosted, not self-hosted, so the endpoint is always the same.

## [1.1.0] - 2026-07-13

Tracks the Embed API changes (IMAGE posts, `DESIGN` response type, `editorUrl`, infographic layout on images).

### Added
- `image generate | import | status | output | import-template` — single-image posts, mirroring the `carousel` commands. `image import` takes a **single slide object** (via `--slide`/`--file`), not an array, and supports the infographic layout (`layoutType`/`layoutConfig`).
- `DESIGN` as a `--response-type` value — creates the editable design without rendering a PDF/PNG (returns `designId` + `editorUrl` only). Accepted anywhere `--response-type` is (generate/import, `image`, `generate-and-schedule`, `defaults set`).
- `editorUrl` (deep link to open the design in the editor) surfaced in all generate/import/output results.
- `--post-type CAROUSEL|IMAGE` on `generate-and-schedule`.

### Changed
- `--response-type` values are now validated/normalized (case-insensitive) to `PDF`/`PNG`/`DESIGN`; invalid values fail fast with a clear error.
- The CLI still defaults `--response-type` to `PDF` and always sends it explicitly, so it is unaffected by the API's new `DESIGN` default for omitted values.
- `carousel output` now reports `aspectRatio`/`editorUrl` and omits `data`/`mimeType`/`outputType` for `DESIGN` responses.

## [1.0.1] - 2026-07-06

Aligns the npm version with the ClawHub skill (1.0.0) as a patch. No CLI code changes — `dist/` is unchanged from 0.1.0; this release is docs, skill packaging, and metadata.

### Added
- Deep-dive docs: `QUICK_START`, `HOW_TO_RUN`, `PLATFORM_SETTINGS`, `PROJECT_STRUCTURE`, `FEATURES`, `PUBLISHING`.
- Self-contained skill folder `skills/postnitro/` with `examples/` and `references/cli-reference.md`.

### Changed
- Repackaged as a Claude Code skill/plugin; rewrote skill + README messaging to be outcome-led and consistent across all surfaces.
- Renamed the repository to `postnitro-agent`; updated `repository`/`homepage` metadata.
- Corrected pricing docs: the Embed API requires a paid subscription (no free tier).

### Security
- Added credential-storage, destructive-command (`social disconnect` / `schedule delete`), and scope ("when not to use") warnings per the ClawHub security audit; documented that the skill runs no background processes or persistence.

## [0.1.0] - 2026-07-03

### Added
- Initial release of the PostNitro CLI (`@postnitro/cli`).
- `auth set-key | status | clear` — API key management (`~/.postnitro-cli/config.json`).
- `defaults get | set` — save default template/brand/preset/response-type.
- `template list`, `brand list | get | create | update`, `preset list` — resource discovery and brand kits.
- `carousel import-template | generate | import | status | output` — AI generation (topic/article/X), custom-slide import, async status polling, and output retrieval.
- `social list | get | disconnect` — connected social-account management.
- `schedule list | create | get | update | delete` — scheduled posts and drafts for LinkedIn, Instagram, TikTok, and Threads.
- `generate-and-schedule` — one-shot generate-then-schedule.
- `--wait` on generate/import to poll to completion and return the final output (including `designId`) in one call.
- Inline JSON options that override `--file`: `--slides` (import), `--data` (brand), and `--post-content` / `--selected-accounts` / `--*-post-settings` / `--post-settings` (schedule + generate-and-schedule).
- JSON output on stdout (exit 0) and JSON errors on stderr (exit 1) for safe agent/script parsing.
- Claude Code skill + plugin: root `SKILL.md`, `skills/postnitro/SKILL.md`, and `.claude-plugin/` manifests.
- Example slide files under `examples/` and a runnable `examples/basic-usage.sh`.
