# Project Structure

How the codebase is organized. It's a small TypeScript CLI built on
[commander](https://github.com/tj/commander.js), compiled with `tsc` to `dist/`.

```
src/
├── index.ts                     # CLI entry point — sets up commander, global options, registers commands
├── commands/                    # One file per command group; each exports a register*Commands(program) fn
│   ├── auth.ts                  # auth set-key | status | clear
│   ├── defaults.ts              # defaults get | set
│   ├── template.ts              # template list
│   ├── brand.ts                 # brand list | get | create | update
│   ├── preset.ts                # preset list
│   ├── carousel.ts              # carousel import-template | generate | import | status | output
│   ├── social.ts                # social list | get | disconnect
│   ├── schedule.ts              # schedule list | create | get | update | delete
│   └── generate-and-schedule.ts # one-shot generate + schedule
└── lib/
    ├── client.ts                # PostNitroClient (fetch wrapper), PostNitroApiError, pollUntilComplete, extractDesignId
    ├── config-store.ts          # API key + defaults resolution, resolveGenerationDefaults, auto-select
    ├── schedule-input.ts        # Shared schedule JSON options + body merge (used by schedule & generate-and-schedule)
    ├── schedule-warnings.ts     # Soft validation warnings + deriveDocumentTitle
    ├── json-file.ts             # readJsonFile helper
    ├── output.ts                # printResult (stdout), failWith (stderr), action() error wrapper
    └── types.ts                 # Shared request/response TypeScript interfaces
```

## Key modules

### `lib/client.ts`
`PostNitroClient` wraps `fetch` with the `embed-api-key` header and JSON parsing. Non-2xx
responses throw `PostNitroApiError` (carrying `statusCode` + body). Also holds:
- `pollUntilComplete(embedPostId)` — polls `/post/status/:id` until `COMPLETED`/`FAILED` (the `--wait` engine).
- `extractDesignId(output)` — pulls the `designId` from a completed carousel's output.

### `lib/config-store.ts`
Resolves the API key (`--api-key` → `POSTNITRO_API_KEY` → saved file) and manages per-key
defaults under `~/.postnitro-cli/`. `resolveGenerationDefaults` implements the
**flag → saved default → auto-select** precedence used by generate/import.

### `lib/output.ts`
Central JSON I/O contract: `printResult` writes pretty JSON to stdout (exit 0); `failWith`
writes a `{ success:false, error }` object to stderr and exits 1; `action()` wraps every
command handler so thrown errors become that standard JSON error instead of a stack trace.

### `lib/schedule-input.ts`
Shared by `schedule` and `generate-and-schedule`: `parseJsonOption` (validates inline JSON
flags), `addScheduleJsonOptions` (registers the `--post-content` / `--selected-accounts` /
`--*-post-settings` options), and `resolveScheduleBody` (merges `--file` with inline flags —
inline wins).

## Command pattern

Every command file exports `register<Group>Commands(program)`, called from `index.ts`. Handlers
are wrapped in `action(...)` (from `output.ts`) and end by calling `printResult(...)`. This keeps
the JSON-in/JSON-out contract uniform across the whole CLI.

## Build & distribution

- `tsc` compiles `src/` → `dist/` (`bin.postnitro` → `dist/index.js`; the shebang lives in
  `src/index.ts` and is preserved).
- `package.json` `files` ships `dist`, `README.md`, and `SKILL.md`.
- The skill/plugin lives at the repo root: `SKILL.md`, `skills/postnitro/SKILL.md`, and
  `.claude-plugin/` (`plugin.json` + `marketplace.json`).

See [PUBLISHING.md](PUBLISHING.md) for the release process.
