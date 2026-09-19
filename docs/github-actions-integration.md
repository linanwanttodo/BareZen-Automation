# GitHub Actions Integration

Complete reference for integrating BareZen Automation with GitHub Actions.

## Composite Action Usage

### Basic Usage

```yaml
jobs:
  automation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: linanwanttodo/BareZen-Automation@v1
        with:
          config: automation.yml
```

### All Inputs

| Input | Required | Default | Description |
| ------- | -------- | ------- | ----------- |
| `config` | Yes | `automation.yml` | Path to config file |
| `flow` | No | `""` | Execute only this flow (empty = all) |
| `plugins` | No | `plugins` | Plugin directory path |
| `log-level` | No | `info` | Log level: `debug` \| `info` \| `warn` \| `error` |
| `python-version` | No | `""` | Python version to set up (empty = skip) |

### Full Example

```yaml
jobs:
  automation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: linanwanttodo/BareZen-Automation@v1
        with:
          config: automation.yml
          flow: daily-report
          plugins: plugins
          log-level: debug
          python-version: "3.12"
```

## Event Triggers

### Schedule (Cron)

```yaml
on:
  schedule:
    - cron: '0 */6 * * *'    # Every 6 hours
    - cron: '0 9 * * 1'      # Every Monday at 9 AM

jobs:
  automation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: linanwanttodo/BareZen-Automation@v1
        with:
          config: automation.yml
```

### Push

```yaml
on:
  push:
    branches: [main, develop]
    paths:
      - 'src/**'
      - 'automation.yml'

jobs:
  automation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: linanwanttodo/BareZen-Automation@v1
        with:
          config: automation.yml
          flow: on-push
```

### Pull Request

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: linanwanttodo/BareZen-Automation@v1
        with:
          config: automation.yml
          flow: pr-review
```

### Issues

```yaml
on:
  issues:
    types: [opened, labeled]

jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: linanwanttodo/BareZen-Automation@v1
        with:
          config: automation.yml
          flow: issue-triage
```

### Issue Comment

```yaml
on:
  issue_comment:
    types: [created]

jobs:
  respond:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: linanwanttodo/BareZen-Automation@v1
        with:
          config: automation.yml
          flow: comment-response
```

### Release

```yaml
on:
  release:
    types: [published]

jobs:
  announce:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: linanwanttodo/BareZen-Automation@v1
        with:
          config: automation.yml
          flow: release-announce
```

### Workflow Dispatch (Manual)

```yaml
on:
  workflow_dispatch:
    inputs:
      flow:
        description: 'Flow to execute'
        required: false
        default: ''

jobs:
  manual:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: linanwanttodo/BareZen-Automation@v1
        with:
          config: automation.yml
          flow: ${{ github.event.inputs.flow }}
```

### Repository Dispatch (External)

```yaml
on:
  repository_dispatch:
    types: [automation-trigger]

jobs:
  triggered:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: linanwanttodo/BareZen-Automation@v1
        with:
          config: automation.yml
          flow: ${{ github.event.client_payload.flow }}
```

## Secrets

`${{ secrets.XXX }}` inside `automation.yml` is resolved by BareZen from the
process environment — GitHub's expression engine only runs in workflow files, so
nothing here is interpolated by Actions. The consequence: every name a config
references must be passed into the step via `env:` (see
`examples/github-action-demo.yml`), for **all** flows in the file, because
resolution happens before the first step runs. `GITHUB_TOKEN` is injected
automatically by the action.

```yaml
# In your automation.yml
flows:
  notify:
    - plugin: telegram
      inputs:
        chatId: ${{ secrets.TELEGRAM_CHAT_ID }}   # or set TELEGRAM_CHAT_ID in env
        message: "Build complete"
```

The Telegram token itself is not an input: the plugin reads `TELEGRAM_BOT_TOKEN`
from the environment, so it never lands in a config file or a log.

### Required Secrets

Add these in your repository settings (Settings → Secrets and variables → Actions). Each plugin reads its **own** variable name, so one flow can notify several channels at once.

| Variable | Used by | Kind |
| -------- | ------- | ---- |
| `GITHUB_TOKEN` | GitHub plugins and `ai-github-models` (auto-provided by `github.token`) | Secret |
| `TELEGRAM_BOT_TOKEN` | Telegram plugin | Secret |
| `TELEGRAM_CHAT_ID` | Telegram plugin, unless `chatId` is passed inline | Variable |
| `DISCORD_WEBHOOK_URL` | Discord plugin | Secret |
| `SLACK_WEBHOOK_URL` | Slack plugin | Secret |
| `WECOM_WEBHOOK_URL` | WeCom plugin | Secret |
| `FEISHU_WEBHOOK_URL` | Feishu plugin | Secret |
| `GENERIC_WEBHOOK_URL` | webhook plugin, unless `url` is passed inline | Secret |
| `GENERIC_WEBHOOK_SECRET` | webhook plugin, sent as `Authorization: Bearer` | Secret |
| `SMTP_USER` / `SMTP_PASS` | Email plugin | Secret |
| `SMTP_HOST` | Email plugin, unless `smtpHost` is passed inline | Variable |
| `OPENAI_API_KEY` | the OpenAI-compatible ai-* plugins only | Secret |
| `BAREZEN_HTTP_TIMEOUT` | per-request outbound ceiling in ms (default 30000) | Variable |

`ai-github-models` reaches an LLM with the workflow's own `GITHUB_TOKEN`, so a
digest pipeline can include an AI step without storing any third-party key.

## Accessing GitHub Context in Plugins

Plugins receive the full GitHub context:

```typescript
export default definePlugin({
  name: "my-plugin",
  inputs: z.object({}),
  async run(ctx) {
    const { eventName, repository, sha, actor, payload } = ctx.github;

    if (eventName === "push") {
      // payload.type === "push"
      const commits = payload.commits;
      ctx.logger.info(`Processing ${commits.length} commits`);
    }

    if (eventName === "pull_request") {
      // payload.type === "pull_request"
      const prNumber = payload.number;
      ctx.logger.info(`Processing PR #${prNumber}`);
    }

    return { result: {} };
  },
});
```

## Self-Testing Workflow

For the BareZen framework repository itself:

```yaml
name: Test Action
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./                      # Use local action
        with:
          config: examples/automation.yml
          log-level: debug
```
