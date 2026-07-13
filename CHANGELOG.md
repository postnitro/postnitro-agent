# Changelog

All notable changes to the PostNitro CLI are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
