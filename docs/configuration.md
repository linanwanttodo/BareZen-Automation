# Configuration Reference

Complete reference for `automation.yml` — the BareZen Automation configuration file.

## Top-Level Structure

```yaml
plugins:          # List of plugin names to load (required, at least 1)
  - rss
  - telegram

flows:            # Flow definitions (required)
  daily-report:
    - plugin: rss
      inputs: { ... }
      output: news

settings:         # Global settings (optional)
  defaultTimeout: 60000
  logLevel: info
```

## `plugins`

Array of plugin names. Plugins are loaded from the plugins directory (default: `plugins/`).

```yaml
plugins:
  - rss
  - email
  - ai-summary
```

## `flows`

Map of flow name to step array. Each flow is a sequence of plugin executions.

```yaml
flows:
  daily-report:           # Flow name
    - plugin: rss         # Step 1
      inputs:
        url: https://example.com/feed.xml
      output: news        # Output key (stored in flow context)

    - plugin: text-template
      input: { vars: news }          # Bind the whole previous output to `vars`
      inputs:
        template: |
          {{#each articles}}- {{title}}
          {{/each}}
      output: digest

    - plugin: email       # Step 3
      input: { body: digest.text }   # Field path into an earlier step
      inputs:
        to: user@example.com
        subject: Daily Report
```

## Step Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `plugin` | string | Yes | Plugin name |
| `inputs` | object | No | Direct input values |
| `input` | string \| object | No | Bind a previous step's output to inputs; accepts field paths |
| `output` | string | No | Store output in flow context under this key |
| `if` | string | No | Condition expression (e.g., `true`, `false`) |
| `continueOnError` | boolean | No | Continue to next step if this one fails (default: `false`) |
| `retry` | object | No | Retry configuration |
| `timeout` | number | No | Timeout in milliseconds |

## Referencing Earlier Output

`input` addresses values stored by an earlier step's `output`:

```yaml
input: news                      # binds the whole output to a parameter named `input`
input: { body: news }            # binds the whole output to `body`
input: { body: news.digest }     # field path: a nested value
input: { body: news.items[0].title }   # list index, then field
```

Paths resolve against the previous outputs only; there is no expression
language, arithmetic, or fallback syntax. `inputs` and `input` may appear on
the same step, and `input` wins on a key collision. Because every step output
is an object, rendering a list into a string is the `text-template` plugin's
job.

## `retry` Configuration

```yaml
- plugin: fetch-api
  retry:
    attempts: 3
    delay: 1000        # Delay between retries in ms
    backoff: exponential  # exponential | linear | fixed
```

## `settings`

Global settings applied to all flows.

```yaml
settings:
  defaultTimeout: 60000    # Default timeout in ms (default: 60000)
  logLevel: info           # debug | info | warn | error (default: info)
```

## Secret References

Use `${{ secrets.NAME }}` syntax to reference GitHub Actions secrets:

```yaml
flows:
  notify:
    - plugin: telegram
      inputs:
        chatId: ${{ secrets.TELEGRAM_CHAT_ID }}
        message: "Deployment complete"
        botToken: ${{ secrets.TELEGRAM_BOT_TOKEN }}
```

Secrets are resolved recursively in strings, arrays, and objects. Resolved values are masked in logs.

## Condition Expressions

The `if` field supports simple expressions:

```yaml
- plugin: deploy
  if: true              # Always execute
  inputs: { ... }

- plugin: skip-test
  if: false             # Never execute
  inputs: { ... }
```

## Complete Example

```yaml
plugins:
  - rss
  - ai-summary
  - email
  - telegram

flows:
  daily-digest:
    - plugin: rss
      inputs:
        url: https://blog.example.com/feed.xml
        limit: 20
      output: articles

    - plugin: ai-summary
      input: articles
      inputs:
        model: gpt-4o-mini
        maxLength: 500
      output: summary

    - plugin: email
      input: summary
      inputs:
        to: team@example.com
        subject: Daily Digest
        body: ${{ steps.summary.text }}
      continueOnError: true

    - plugin: telegram
      inputs:
        chatId: ${{ secrets.TELEGRAM_CHAT_ID }}
        message: "Daily digest sent"
      if: true

  weekly-report:
    - plugin: rss
      inputs:
        url: https://blog.example.com/feed.xml
        limit: 50
      output: weekly-articles
      retry:
        attempts: 3
        delay: 2000

settings:
  defaultTimeout: 120000
  logLevel: debug
```

## Invalid Config Examples

### Empty plugins array

```yaml
plugins: []        # Error: must have at least 1 plugin
flows: {}
```

### Missing flows

```yaml
plugins:
  - rss
# Error: flows is required
```

### Invalid step (no plugin)

```yaml
plugins:
  - rss
flows:
  test:
    - inputs: { url: "https://example.com" }   # Error: plugin is required
```
