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

Secrets are automatically available via `${{ secrets.XXX }}` in `automation.yml`. The `GITHUB_TOKEN` is injected automatically.

```yaml
# In your automation.yml
flows:
  notify:
    - plugin: telegram
      inputs:
        chatId: ${{ secrets.TELEGRAM_CHAT_ID }}
        message: "Build complete"
        botToken: ${{ secrets.TELEGRAM_BOT_TOKEN }}
```

### Required Secrets

Add these in your repository settings (Settings → Secrets and variables → Actions):

| Secret | Used by |
| ------ | ------- |
| `OPENAI_API_KEY` | AI plugins (ai-summary, ai-translate, etc.) |
| `TELEGRAM_CHAT_ID` | Telegram plugin |
| `TELEGRAM_BOT_TOKEN` | Telegram plugin |
| `WEBHOOK_URL` | Discord, Slack, WeCom, Feishu plugins |
| `SMTP_USER` / `SMTP_PASS` / `SMTP_HOST` | Email plugin |
| `GITHUB_TOKEN` | GitHub plugins (auto-provided by `github.token`) |

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
