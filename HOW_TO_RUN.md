# How to Run

Ways to install and run the PostNitro CLI, from quickest to full local development.

## 1. Global install (recommended)

```bash
npm install -g @postnitro/cli
postnitro --help
```

Exposes the `postnitro` command everywhere.

## 2. One-off with npx (no install)

```bash
npx @postnitro/cli --help
npx @postnitro/cli carousel generate --context "topic" --type text --wait
```

## 3. As an AI-agent skill / Claude Code plugin

```bash
# Any compatible agent
npx skills add postnitro/postnitro-agent

# Claude Code
/plugin marketplace add postnitro/postnitro-agent
/plugin install postnitro@postnitro-agent
```

See [SKILL.md](SKILL.md) for what the skill teaches the agent.

## 4. Local development (from source)

```bash
git clone https://github.com/postnitro/postnitro-agent.git
cd postnitro-agent
npm install

# Run from source without building (note the `--` before CLI args):
npm run dev -- --help
npm run dev -- carousel generate --context "topic" --type text --wait

# Or build and run the compiled output:
npm run build
node dist/index.js --help
```

### Scripts

| Script | Does |
|--------|------|
| `npm run dev -- <args>` | Run from `src/` via `tsx` (no build) |
| `npm run build` | Compile TypeScript to `dist/` (`tsc`) |
| `npm run start` | Run the built CLI (`node dist/index.js`) |

> **`npm run dev` gotcha:** always put `--` before CLI arguments so npm forwards the flags
> instead of consuming them (`npm run dev -- schedule create --status DRAFT ...`).

## Authentication

Any run method needs an API key (**PostNitro → Profile → Embed → Generate API Key**), provided
in order of precedence:

1. `--api-key <key>` flag
2. `POSTNITRO_API_KEY` environment variable
3. Saved config via `postnitro auth set-key <key>` (`~/.postnitro-cli/config.json`)

## Requirements

- Node.js >= 18 (uses the built-in `fetch`).
- `jq` is optional but handy for parsing JSON output in shell scripts.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `POSTNITRO_API_KEY` | – | API key |
| `POSTNITRO_CONFIG_DIR` | `~/.postnitro-cli` | Where config/defaults are stored |
