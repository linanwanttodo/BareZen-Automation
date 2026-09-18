# BareZen Automation

> Plugin-Driven Automation Runtime for GitHub Actions — define your automation flows in YAML, run plugins in any language.

## Why BareZen?

GitHub Actions is powerful, but writing complex automation logic in workflow YAML quickly becomes unwieldy. BareZen decouples **what to do** (declarative YAML config) from **how to do it** (reusable plugins), giving you:

- **YAML-driven flows** — define multi-step automation pipelines in a single `automation.yml`
- **Multi-language plugins** — write plugins in TypeScript, Python, Shell, Node, or Docker
- **Secret resolution** — `${{ secrets.XXX }}` references resolved automatically with log masking
- **23 built-in plugins** — RSS, email, Telegram, Discord, Slack, WeCom, Feishu, GitHub ops, AI, and more
- **TypeScript SDK** — `definePlugin()` with Zod input validation and automatic JSON I/O
- **Composite Action** — drop-in `uses: linanwanttodo/BareZen-Automation@v1` for any repository

## Quick Start

### 1. In your repository

Create `.github/workflows/automation.yml`:

```yaml
name: BareZen Automation
on:
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch:

jobs:
  automation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: linanwanttodo/BareZen-Automation@v1
        with:
          config: automation.yml
          python-version: "3.12"
```

### 2. Create `automation.yml` in your repo root

```yaml
plugins:
  - rss
  - telegram

flows:
  news-scan:
    - plugin: rss
      inputs:
        url: https://hnrss.org/frontpage
        limit: 10
      output: frontpage

    - plugin: telegram
      inputs:
        chatId: ${{ secrets.TELEGRAM_CHAT_ID }}
        message: "scan finished"
```

Steps run in order, and a step reads an earlier one's output with `input:`:

```yaml
    - plugin: text-template
      input: { vars: frontpage }        # whole output object bound to `vars`
      inputs:
        template: "{{#each articles}}- {{title}}\n{{/each}}"
      output: digest

    - plugin: telegram
      input: { message: digest.text }   # field path into an earlier step
```

`text-template` exists because every step output is an object and most sinks
want a string. See [Configuration](docs/configuration.md#referencing-earlier-output)
for the reference syntax and its limits.

### 3. Add secrets

`${{ secrets.X }}` written in `automation.yml` is resolved by BareZen from the
process environment, not by GitHub (Actions expressions only run in workflow
files). So pass each secret into the step via `env:`, as shown above — for
every flow in the file, since references are resolved before the first step
runs.

## Running locally

Nothing is published to npm; the runtime is committed as a bundle:

```bash
node dist/index.js run --config examples/automation.yml --plugins plugins
```

## Project Structure

```
barezen-automation/
├── action.yml                    # Composite Action entry
├── dist/index.js                 # Committed runtime bundle (what the action runs)
├── packages/
│   ├── core/                     # Runtime engine, config, plugin loader
│   ├── sdk/                      # TypeScript plugin SDK
│   └── cli/                      # Command-line interface
├── plugins/                      # 23 built-in plugins
│   └── rss/
│       ├── plugin.yaml           # Manifest: runtime, entry, inputs, outputs
│       ├── src/index.ts          # Source
│       └── dist/index.js         # Committed self-contained bundle
├── scripts/bundle.mjs            # Builds dist/ from source
└── examples/                     # Usage examples
```

## Documentation

- [Plugin Development Guide](docs/plugin-development.md) — how to write custom plugins
- [Configuration Reference](docs/configuration.md) — `automation.yml` schema and fields
- [GitHub Actions Integration](docs/github-actions-integration.md) — event triggers and action inputs

## Built-in Plugins

| Category | Plugins |
|----------|---------|
| Content | `rss`, `atom`, `crawler`, `webhook` |
| Notification | `email`, `telegram`, `discord`, `slack`, `wecom`, `feishu` |
| GitHub | `github-sync`, `github-star`, `github-release`, `github-issue`, `github-pr`, `github-label` |
| AI | `ai-summary`, `ai-translate`, `ai-review`, `ai-classify`, `ai-chat` |
| Utility | `retry`, `text-template` |

## Development

```bash
pnpm install
pnpm test          # run all tests
pnpm typecheck     # type-check all packages
pnpm build:bundle  # regenerate dist/ from source
```

`dist/` is committed, because the action runs it directly on a runner that
installs nothing. After changing anything under `packages/` or `plugins/`, run
`pnpm build:bundle` and commit the result — CI fails if the committed bundles
are stale.

## License

MIT
