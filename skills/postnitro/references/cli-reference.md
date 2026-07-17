# PostNitro CLI — Command Reference

Complete reference for `@postnitro/cli`. Every command prints JSON on stdout (exit 0) or a
`{ "success": false, "error": { "message": ... } }` object on stderr (exit 1).

## Global options

Available on every command:

| Flag | Purpose |
|------|---------|
| `--api-key <key>` | API key (overrides env/saved config) |
| `-V, --version` | Print version |
| `-h, --help` | Help for any command/subcommand |

## auth

```
postnitro auth set-key <key>   # save to ~/.postnitro-cli/config.json
postnitro auth status          # { configured, source, apiKey (masked) }
postnitro auth clear           # remove saved key
```

> **Security:** `auth set-key` stores the API key in **plaintext** at `~/.postnitro-cli/config.json`. Restrict its file permissions (`chmod 600`), avoid shared or untrusted machines, and run `auth clear` to remove it. In CI, prefer `--api-key` or the `POSTNITRO_API_KEY` env var over the saved file.

## defaults

```
postnitro defaults get
postnitro defaults set [--template-id <id>] [--brand-id <id>] [--preset-id <id>] [--response-type PDF|PNG|DESIGN]
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
                            [--template-id] [--brand-id] [--preset-id] [--response-type PDF|PNG|DESIGN]
                            [--requestor-id <id>] [--wait]
postnitro carousel import (--slides <json> | --file <path>)
                          [--template-id] [--brand-id] [--response-type] [--requestor-id] [--wait]
postnitro carousel status <embedPostId>            # progress + step logs
postnitro carousel output <embedPostId>            # file URL(s) + designId + editorUrl
```
- `--type`: `text` (topic/text), `article` (article URL), `x` (X post URL).
- `--response-type`: `PDF` (default) | `PNG` | `DESIGN`. `DESIGN` skips rendering — no file is produced, output has `designId` + `editorUrl` only.
- `--wait`: poll to completion; returns final output incl. `designId` and `editorUrl`.
- `--slides` (inline JSON) overrides `--file`; accepts a bare array or `{ "slides": [...] }`.
- AI images: add `--generate-images` (+ optional `--image-placement`/`--image-strategy`/`--image-context`) — see [AI image generation](#ai-image-generation-generateimages).

## image

Single-image posts. Mirrors `carousel`, but produces one image and `import` takes a **single slide object** (not an array).

```
postnitro image import-template                    # prints the image-slide schema + rules
postnitro image generate --context <text> [--type text|article|x] [--instructions <text>]
                         [--template-id] [--brand-id] [--preset-id] [--response-type PDF|PNG|DESIGN]
                         [--requestor-id <id>] [--wait]
postnitro image import (--slide <json> | --file <path>)
                       [--template-id] [--brand-id] [--response-type] [--requestor-id] [--wait]
postnitro image status <embedPostId>               # progress + step logs
postnitro image output <embedPostId>               # file URL(s) + designId + editorUrl
```
- `--slide` (inline JSON) overrides `--file`; a **single object** (arrays are rejected — those are CAROUSEL-only). Accepts a bare object or `{ "slides": { ... } }`.
- Allowed slide fields: `heading` (required), `sub_heading`, `description`, `cta_button`, `image`, `background_image`, plus `layoutType`/`layoutConfig` for the infographic layout. Any other field is rejected.
- Infographic layout works on IMAGE too — set `layoutType: "infographic"` + `layoutConfig` (same schema as carousel; see below). Every column and content item needs a caller-provided `id`.
- AI images: `--generate-images` (+ optional flags) works here too — see [AI image generation](#ai-image-generation-generateimages).

## AI image generation (`generateImages`)

Opt-in AI image generation, available on **every** generate/import command (carousel and image) and on `generate-and-schedule`. Images are generated and baked into the design before rendering, so they appear in the rendered file and in the editor.

| Flag | Values | Default | Notes |
|------|--------|---------|-------|
| `--generate-images` | (boolean) | off | Opt in. Also implied by any flag below. |
| `--image-context <text>` | string | — | **Required** when generating images: a short visual brief for the image prompts. |
| `--image-placement <mode>` | `auto` \| `background` \| `in-line` | `auto` | `auto` = AI decides per slide. |
| `--image-strategy <mode>` | `strategic` \| `all` | `strategic` | `strategic` ≈ 50% of slides; `all` = every eligible slide. |

- `--image-context` is required whenever image generation is enabled — the CLI fails fast if it's missing.
- The two enums are validated client-side (fails fast on a bad value).
- **Best-effort:** the post still completes if image generation fails or isn't permitted. With `--wait`, the result includes `imageGeneration` (the `GENERATE_IMAGES` job step); a `FAILED` status there (e.g. free plan, or over the org's AI-image quota) means the post completed without images. Without `--wait`, the step appears in `status` logs.
- **Credits:** AI images consume the organization's **separate AI-image quota** — the post's slide-based `credits` are unchanged. Free plans cannot generate AI images.
- Adds latency (real images are rendered); keep polling `status` until `COMPLETED`.

## social

```
postnitro social list                 # { count, accounts: [{ id, platform, handle, name, accountType, status }] }
postnitro social get <id>
postnitro social disconnect <id> --yes # destructive
```

> **Destructive:** `social disconnect` removes the linked social account from your workspace. Scheduled posts targeting it will fail to publish, and restoring access requires reconnecting and re-authenticating. Requires `--yes`.

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
- **`schedule delete` is destructive:** it permanently cancels and removes the scheduled post — this cannot be undone. Requires `--yes`.
- Requires either `--design-id` or non-empty `--post-content`.
- `--scheduled-at` must be a **future** ISO-8601 datetime (trailing `Z`).
- Inline JSON flags override the same field in `--file`.

## generate-and-schedule

```
postnitro generate-and-schedule --context <text> --status DRAFT|SCHEDULED --scheduled-at <iso>
                                [--post-type CAROUSEL|IMAGE] [ ...all generate flags... ]
                                [--generate-images --image-context <text> ...]   # optional AI images
                                [--design-id] [--file <json>]
                                [--post-content] [--selected-accounts] [--*-post-settings] [--post-settings]
```
Generates → waits → schedules in one call. `--post-type` defaults to `CAROUSEL` (use `IMAGE` for a single-image post). Also accepts the [AI image generation](#ai-image-generation-generateimages) flags. On scheduling failure the error includes the `designId` so you can retry `schedule create` without regenerating.

## import-and-schedule

```
postnitro import-and-schedule --status DRAFT|SCHEDULED --scheduled-at <iso>
                              [--post-type CAROUSEL|IMAGE]
                              (--slides <json> | --slide <json> | --slides-file <path>)
                              [--template-id] [--brand-id] [--response-type] [--requestor-id]
                              [--generate-images --image-context <text> ...]   # optional AI images
                              [--design-id] [--file <json>]
                              [--post-content] [--selected-accounts] [--*-post-settings] [--post-settings]
```
Imports your own content → waits → schedules in one call (the import-side counterpart of `generate-and-schedule`). `--post-type` defaults to `CAROUSEL` — pass `--slides` (array) for CAROUSEL or `--slide` (single object) for IMAGE; `--slides-file` reads either from a file.

> **Flag note:** here `--file` is the **schedule body** (postContent/accounts/settings), matching `generate-and-schedule` — so slide content comes from `--slides` / `--slide` / `--slides-file`, not `--file`.

Also accepts the [AI image generation](#ai-image-generation-generateimages) flags. On scheduling failure the error includes the `designId` so you can retry `schedule create` without re-importing.

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

For **carousel** import: exactly one `starting_slide` (first), ≥1 `body_slide`, exactly one `ending_slide` (last). For **image** import it's a single object with no `type` field (see the `image` section above).

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

Infographic `layoutConfig` (works on both carousel and image slides):
```json
{
  "hasHeader": true,
  "columnCount": 1,
  "displayCounterAs": "counter",  // "counter" (default) | "none"
  "columnDisplay": "grid",        // "grid" (comparative, default) or "cycle" (sequential; data in FIRST column only)
  "columnData": [
    {
      "id": "col-1",
      "header": "Column",
      "content": [
        {
          "id": "item-1",
          "icon": null,
          "title": "Item",
          "description": "<p dir=\"ltr\">HTML string</p>",
          "titleEnabled": true,
          "descriptionEnabled": true
        }
      ]
    }
  ]
}
```
Max 3 columns. Setting `layoutType: "infographic"` replaces the slide's `image`. **Every column and content item needs a caller-provided `id`** — the API does not auto-generate them. `description` is an HTML string. Omitted `layoutConfig` fields use the defaults above; if `layoutType` is `infographic` but `layoutConfig` is missing, the slide falls back to the default layout.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `POSTNITRO_API_KEY` | – | API key |
| `POSTNITRO_CONFIG_DIR` | `~/.postnitro-cli` | Config/defaults location |
