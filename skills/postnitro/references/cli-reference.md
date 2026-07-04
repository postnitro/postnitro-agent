# PostNitro CLI — Command Reference

Complete reference for `@postnitro/cli`. Every command prints JSON on stdout (exit 0) or a
`{ "success": false, "error": { "message": ... } }` object on stderr (exit 1).

## Global options

Available on every command:

| Flag | Purpose |
|------|---------|
| `--api-key <key>` | API key (overrides env/saved config) |
| `--base-url <url>` | Override API base (default `https://embed-api.postnitro.ai`) |
| `-V, --version` | Print version |
| `-h, --help` | Help for any command/subcommand |

## auth

```
postnitro auth set-key <key>   # save to ~/.postnitro-cli/config.json
postnitro auth status          # { configured, source, apiKey (masked) }
postnitro auth clear           # remove saved key
```

## defaults

```
postnitro defaults get
postnitro defaults set [--template-id <id>] [--brand-id <id>] [--preset-id <id>] [--response-type PDF|PNG]
```
Requires at least one field. Resolution order per field: explicit flag → saved default → auto-select (when exactly one candidate exists).

## template / brand / preset (discovery)

```
postnitro template list [--page <n>] [--limit <n>]
postnitro preset list   [--page <n>] [--limit <n>]
postnitro brand list    [--page <n>] [--limit <n>]
postnitro brand get <id>
postnitro brand create  (--name --handle --image [--company-detail] [--no-show-name|--no-show-handle|--no-show-image]) | --data <json> | --file <json>
postnitro brand update <id> ...same as create...
```
`--data` (inline JSON object) overrides `--file`, which overrides the individual flags.

## carousel

```
postnitro carousel import-template                 # prints the slide schema + rules
postnitro carousel generate --context <text> [--type text|article|x] [--instructions <text>]
                            [--template-id] [--brand-id] [--preset-id] [--response-type PDF|PNG]
                            [--requestor-id <id>] [--wait]
postnitro carousel import (--slides <json> | --file <path>)
                          [--template-id] [--brand-id] [--response-type] [--requestor-id] [--wait]
postnitro carousel status <embedPostId>            # progress + step logs
postnitro carousel output <embedPostId>            # file URL(s) + designId
```
- `--type`: `text` (topic/text), `article` (article URL), `x` (X post URL).
- `--wait`: poll to completion; returns final output incl. `designId`.
- `--slides` (inline JSON) overrides `--file`; accepts a bare array or `{ "slides": [...] }`.

## social

```
postnitro social list                 # { count, accounts: [{ id, platform, handle, name, accountType, status }] }
postnitro social get <id>
postnitro social disconnect <id> --yes # destructive
```

## schedule

```
postnitro schedule list --from <date> --to <date>
postnitro schedule create --status DRAFT|SCHEDULED --scheduled-at <iso>
                          [--design-id <id>] [--file <json>]
                          [--post-content <json>] [--selected-accounts <json>]
                          [--instagram-post-settings <json>] [--tiktok-post-settings <json>]
                          [--linkedin-post-settings <json>] [--threads-post-settings <json>]
                          [--post-settings <json>]
postnitro schedule get <id>
postnitro schedule update <id> ...same flags as create...   # REPLACES state
postnitro schedule delete <id> --yes
```
- Requires either `--design-id` or non-empty `--post-content`.
- `--scheduled-at` must be a **future** ISO-8601 datetime (trailing `Z`).
- Inline JSON flags override the same field in `--file`.

## generate-and-schedule

```
postnitro generate-and-schedule --context <text> --status DRAFT|SCHEDULED --scheduled-at <iso>
                                [ ...all generate flags... ]
                                [--design-id] [--file <json>]
                                [--post-content] [--selected-accounts] [--*-post-settings] [--post-settings]
```
Generates → waits → schedules in one call. On scheduling failure the error includes the `designId` so you can retry `schedule create` without regenerating.

---

## Captions — `postContent`

JSON object keyed by platform. At least one non-empty caption unless `--design-id` is set. Hashtags auto-extracted.
Keys: `common`, `linkedin`, `instagram`, `tiktok`, `facebook`, `threads`.

## Platform settings

| Flag | Shape |
|------|-------|
| `--linkedin-post-settings` | `{"postType":"carousel\|document\|image\|reel","postTitle":"..."}` — `document` needs 5–90 char `postTitle` |
| `--instagram-post-settings` | `{"postType":"carousel\|image\|reel","postAsStory":false}` |
| `--tiktok-post-settings` | `{"postType":"carousel\|reel","privacyLevel":"PUBLIC_TO_EVERYONE\|MUTUAL_FOLLOW_FRIENDS\|SELF_ONLY","canComment":true,"canDuet":true,"canStitch":true,"autoAddMusic":false,"postTitle":null,"isBrandedContent":false,"isYourBrand":false,"isThirdPartyBrand":false,"isAIGeneratedContent":true}` |
| `--threads-post-settings` | `{"postType":"carousel\|image\|reel"}` |
| `--post-settings` (reel) | `{"videoDuration":30,"audioId":"..."}` |

## Slide schema (import)

Exactly one `starting_slide` (first), ≥1 `body_slide`, exactly one `ending_slide` (last).

| Field | Notes |
|-------|-------|
| `type` | `starting_slide` \| `body_slide` \| `ending_slide` (required) |
| `heading` | required on every slide |
| `sub_heading` | optional |
| `description` | optional body text |
| `image` | optional image URL (public); ignored if `layoutType: "infographic"` |
| `background_image` | optional background URL |
| `cta_button` | optional CTA text |
| `layoutType` | `default` \| `infographic` |
| `layoutConfig` | required when `layoutType: "infographic"` |

Infographic `layoutConfig`:
```json
{
  "columnCount": 1,
  "columnDisplay": "grid",       // "grid" (comparative) or "cycle" (sequential; data in FIRST column only)
  "displayCounterAs": "none",     // "none" | "counter"
  "hasHeader": true,
  "columnData": [
    { "header": "Column", "content": [ { "title": "Item", "description": "..." } ] }
  ]
}
```
Max 3 columns. Setting `layoutType: "infographic"` replaces the slide's `image`.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `POSTNITRO_API_KEY` | – | API key |
| `POSTNITRO_API_BASE_URL` | `https://embed-api.postnitro.ai` | API endpoint override |
| `POSTNITRO_CONFIG_DIR` | `~/.postnitro-cli` | Config/defaults location |
