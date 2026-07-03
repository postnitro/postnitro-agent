# Quick Start

Get from zero to a scheduled carousel in a few minutes.

## 1. Install

```bash
npm install -g @postnitro/cli
postnitro --help
```

(See [HOW_TO_RUN.md](HOW_TO_RUN.md) for npx and local-dev options.)

## 2. Authenticate

Get a key from **PostNitro → Profile → Embed → Generate API Key**, then:

```bash
postnitro auth set-key pn-xxxxxxxxxxxx
postnitro auth status
```

## 3. Discover your workspace + save defaults

```bash
postnitro template list
postnitro brand list
postnitro preset list
postnitro social list      # note the account id(s) you'll post to

postnitro defaults set --template-id <id> --brand-id <id> --preset-id <id> --response-type PDF
```

With defaults saved, `generate`/`import` no longer need those IDs.

## 4. Create a carousel

```bash
# AI generation from a topic (waits for completion)
postnitro carousel generate --context "5 tips for remote work" --type text --wait
```

The JSON result includes a **`designId`** — that's what you schedule with (not the `embedPostId`).

## 5. Schedule it

```bash
DID=<designId from step 4>
LINKEDIN=$(postnitro social list | jq -r 'first(.accounts[] | select(.platform=="linkedin").id)')

postnitro schedule create \
  --status SCHEDULED \
  --scheduled-at "2026-12-31T13:00:00Z" \
  --design-id "$DID" \
  --selected-accounts "[\"$LINKEDIN\"]" \
  --linkedin-post-settings '{"postType":"document","postTitle":"5 tips for remote work"}' \
  --post-content '{"common":"New carousel 🚀 #remotework"}'
```

## Or do steps 4–5 in one command

```bash
postnitro generate-and-schedule \
  --context "5 tips for remote work" --type text \
  --status SCHEDULED --scheduled-at "2026-12-31T13:00:00Z" \
  --selected-accounts "[\"$LINKEDIN\"]" \
  --linkedin-post-settings '{"postType":"document","postTitle":"5 tips for remote work"}' \
  --post-content '{"common":"New carousel 🚀 #remotework"}'
```

## Next steps

- Full command reference: [README.md](README.md)
- Per-platform settings: [PLATFORM_SETTINGS.md](PLATFORM_SETTINGS.md)
- Runnable examples: [examples/EXAMPLES.md](examples/EXAMPLES.md)
- AI-agent skill reference: [SKILL.md](SKILL.md)
