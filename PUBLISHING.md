# Publishing

How to release `@postnitro/cli` to npm.

## Prerequisites

- npm account with publish access to the `@postnitro` scope.
- Logged in: `npm whoami` (else `npm login`).
- Clean working tree on the default branch, changes merged.

## What ships

`package.json` `files` controls the tarball contents:

```json
"files": ["dist", "SKILL.md", "README.md"]
```

So a release includes the compiled `dist/`, the README, and the skill reference. `prepublishOnly`
runs `npm run build` automatically, so `dist/` is always freshly compiled before publish.

Verify the contents before publishing:

```bash
npm pack --dry-run
```

## Release steps

1. **Update the version** (SemVer):
   ```bash
   npm version patch   # or: minor | major
   ```
   This bumps `package.json` and creates a git tag.

2. **Update the changelog** — add an entry to [CHANGELOG.md](CHANGELOG.md) for the new version.

3. **Publish** (the package is public and scoped):
   ```bash
   npm publish --access public
   ```
   (`publishConfig.access` is already set to `public`, and `prepublishOnly` rebuilds `dist/`.)

4. **Push the tag:**
   ```bash
   git push --follow-tags
   ```

## Verify the release

```bash
npm view @postnitro/cli version
npm install -g @postnitro/cli
postnitro --version
```

## Versioning policy

Follows [Semantic Versioning](https://semver.org/):
- **patch** — bug fixes, docs, no CLI surface change.
- **minor** — new commands/flags, backward compatible.
- **major** — breaking changes to commands, flags, or output shape.

## Skill / plugin distribution

The skill installs directly from GitHub (root `SKILL.md` + `.claude-plugin/`), independent of npm:

```bash
npx skills add postnitro/postnitro-agent
```

Keep the plugin version in [.claude-plugin/plugin.json](.claude-plugin/plugin.json) in step with
the npm `package.json` version when the CLI surface changes.
