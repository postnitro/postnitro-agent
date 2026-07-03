# Changelog

All notable changes to the PostNitro CLI are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
