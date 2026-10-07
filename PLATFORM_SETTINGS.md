# Platform Settings

Reference for the per-platform settings objects you pass when scheduling
(`postnitro schedule create` / `update` and `generate-and-schedule`). Each is a JSON
object, passed inline via its flag (or inside the `--file` body).

Which settings objects are required depends on the platforms among your
`--selected-accounts`. Discover account IDs and their platforms with `postnitro social list`.

---

## Captions — `--post-content`

A JSON object keyed by platform. At least one non-empty caption is required **unless** a
`--design-id` is attached.

```json
{
  "common":    "Shared caption / fallback used when a platform key is absent",
  "linkedin":  "LinkedIn-specific caption",
  "instagram": "Instagram-specific caption",
  "tiktok":    "TikTok-specific caption",
  "facebook":  "Facebook-specific caption",
  "threads":   "Threads-specific caption",
  "pinterest": "Pinterest Pin description (first 800 characters are published)"
}
```

Recognized keys: `common`, `linkedin`, `instagram`, `tiktok`, `facebook`, `threads`, `pinterest`.
Hashtags are extracted automatically from each non-empty caption.

---

## LinkedIn — `--linkedin-post-settings`

| Field | Type | Notes |
|-------|------|-------|
| `postType` | `"carousel" \| "document" \| "image" \| "reel"` | Required |
| `postTitle` | `string \| null` | **Required (5–90 chars) when `postType` is `"document"`** |

PostNitro carousels render as PDFs, which LinkedIn publishes best as **documents**:

```json
{ "postType": "document", "postTitle": "5 habits of great remote workers" }
```

> A `document` post scheduled (`--status SCHEDULED`) without a valid 5–90 char `postTitle` is
> rejected. `generate-and-schedule` auto-derives a title from the design name if you omit it.

---

## Instagram — `--instagram-post-settings`

| Field | Type | Notes |
|-------|------|-------|
| `postType` | `"carousel" \| "image" \| "reel"` | Required |
| `postAsStory` | `boolean` | Post to Stories instead of the feed |

```json
{ "postType": "carousel", "postAsStory": false }
```

---

## TikTok — `--tiktok-post-settings`

| Field | Type | Notes |
|-------|------|-------|
| `postType` | `"carousel" \| "reel"` | Required |
| `privacyLevel` | `"PUBLIC_TO_EVERYONE" \| "MUTUAL_FOLLOW_FRIENDS" \| "SELF_ONLY"` | Optional |
| `canComment` | `boolean` | Required |
| `canDuet` | `boolean` | Optional |
| `canStitch` | `boolean` | Optional |
| `autoAddMusic` | `boolean` | Optional |
| `postTitle` | `string \| null` | Optional |
| `isBrandedContent` | `boolean` | Required |
| `isYourBrand` | `boolean` | Required |
| `isThirdPartyBrand` | `boolean` | Required |
| `isAIGeneratedContent` | `boolean` | Required |

```json
{
  "postType": "carousel",
  "privacyLevel": "PUBLIC_TO_EVERYONE",
  "canComment": true,
  "isBrandedContent": false,
  "isYourBrand": false,
  "isThirdPartyBrand": false,
  "isAIGeneratedContent": true
}
```

---

## Threads — `--threads-post-settings`

| Field | Type | Notes |
|-------|------|-------|
| `postType` | `"carousel" \| "image" \| "reel"` | Required |

```json
{ "postType": "carousel" }
```

---

## Facebook — `--facebook-post-settings`

Facebook accounts are Pages. A design is required when `--status SCHEDULED`.

| Field | Type | Notes |
|-------|------|-------|
| `postType` | `"carousel" \| "link_carousel" \| "image" \| "reel"` | Required. `carousel` = every slide in one multi-photo post; `link_carousel` = swipeable link cards; `image` = single slide; `reel` = video (16:9 to 9:16) |
| `linkUrl` | `string` | `link_carousel` only. Absolute http(s) URL every card links to. Required when scheduled |
| `callToAction` | `string \| null` | `link_carousel` only. Button type, e.g. `LEARN_MORE`, `SHOP_NOW`, `SIGN_UP`, `WATCH_VIDEO` (full list in the platform-settings docs). Omit for no button |
| `showEndCard` | `boolean` | `link_carousel` only. Facebook's end card linking to the Page. Default `true` |
| `useSlideTitles` | `boolean` | `link_carousel` only. Each slide's title becomes its card headline. Default `false` |
| `useSlideDescriptions` | `boolean` | `link_carousel` only. Each slide's description becomes its card description. Default `false` |

A `link_carousel` needs 2–10 slides (Facebook shows up to 5 and picks which), and Facebook only accepts its card images for links on a domain the Page's business has verified. Use `carousel` otherwise.

```json
{ "postType": "link_carousel", "linkUrl": "https://example.com", "callToAction": "LEARN_MORE", "showEndCard": true }
```

---

## Pinterest — `--pinterest-post-settings`

Pinterest accounts are boards (`accountType: "board"`): each board you connect is its own account, so pick the board by its account ID in `--selected-accounts` (there is no board field). Required when a Pinterest account is selected and a design is attached; a design is required when `--status SCHEDULED`.

| Field | Type | Notes |
|-------|------|-------|
| `postType` | `"carousel" \| "image" \| "reel"` | Required. `carousel` = carousel Pin (2–5 slides; 1 slide publishes as an image Pin, more than 5 fails); `image` = single image Pin; `reel` = video Pin (also takes `--post-settings`) |
| `title` | `string` | Optional Pin title, max 100 characters |
| `link` | `string` | Optional absolute http(s) URL the Pin links to |

The `pinterest` key of `--post-content` becomes the Pin description; only its first 800 characters are published. Any design size works except ultra-wide (wider than 21:9); 2:3 is recommended.

```json
{ "postType": "carousel", "title": "5 tips for remote teams", "link": "https://example.com/guide" }
```

---

## Reel timing — `--post-settings`

Required for reel post types.

| Field | Type | Notes |
|-------|------|-------|
| `videoDuration` | `number` | Seconds |
| `audioId` | `string` | Optional audio track ID |

```json
{ "videoDuration": 30, "audioId": "audio-123" }
```

---

## Conditional rules & warnings

- **Design vs. captions:** a scheduled post must have either a `--design-id` **or** non-empty
  `--post-content`. Media post types (carousel/image/reel) with no design attached produce a
  caption-only post — the CLI emits a warning so you don't silently ship one missing its carousel.
- **LinkedIn document title:** see above (5–90 chars).
- **Future date:** `--scheduled-at` must be a future ISO-8601 datetime (trailing `Z`).
- **Extra keys are rejected** by the API with `422 Extra parameters passed in the body`.

See the [README](README.md#platform-specific-features) for runnable per-platform examples.
