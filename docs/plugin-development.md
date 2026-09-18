# Plugin Development Guide

This guide covers how to create custom plugins for BareZen Automation.

## Plugin Directory Structure

```
my-plugin/
├── plugin.yaml          # Plugin descriptor (required)
├── src/
│   └── index.ts         # Entry point (TypeScript)
├── package.json
└── dist/                # Compiled output (after build)
    └── index.js
```

## `plugin.yaml` Descriptor

```yaml
name: my-plugin          # Unique plugin name (required)
runtime: node            # Runtime: node | python | shell | typescript | docker
entry: dist/index.js     # Entry file relative to plugin dir (required)
description: My plugin   # Human-readable description

inputs:                  # Input specification
  url:
    required: true
    type: string
    description: Target URL
  limit:
    required: false
    type: number
    default: 10

outputs:                 # Output specification
  result:
    type: object
```

## TypeScript Plugin (Recommended)

Use the `@barezen/sdk` package with `definePlugin()`:

```typescript
import { definePlugin } from "@barezen/sdk";
import { z } from "zod";

export default definePlugin({
  name: "my-plugin",
  inputs: z.object({
    url: z.string().url(),
    limit: z.number().int().positive().default(10),
  }),
  async run(ctx) {
    // Access inputs
    ctx.logger.info(`Fetching ${ctx.inputs.url}`);

    // Access secrets
    const apiKey = ctx.secrets.require("API_KEY");

    // Access GitHub context
    const repo = ctx.github.repository;
    const event = ctx.github.eventName;

    // Return output data
    return { result: { items: [], count: 0 } };
  },
});
```

### Plugin Context (`ctx`)

| Property | Type | Description |
|----------|------|-------------|
| `ctx.inputs` | Validated inputs | Plugin inputs after Zod validation |
| `ctx.logger` | `PluginLogger` | Logger (outputs to stderr) |
| `ctx.secrets` | `SecretAccessor` | Secret access (`get()`, `require()`) |
| `ctx.github` | `GitHubContext` | GitHub Actions context (event, repo, sha, etc.) |

## Python Plugin

```python
#!/usr/bin/env python3
import json
import sys

# Read input from stdin
input_data = json.load(sys.stdin)
inputs = input_data.get("inputs", {})

# Your plugin logic
result = {"items": [], "count": 0}

# Write output to stdout
json.dump({"success": True, "data": result}, sys.stdout)
```

`plugin.yaml`:
```yaml
name: my-python-plugin
runtime: python
entry: main.py
inputs:
  query:
    required: true
    type: string
outputs:
  items:
    type: array
```

## Shell Plugin

```bash
#!/bin/bash
# Read input from stdin
input=$(cat)
query=$(echo "$input" | jq -r '.inputs.query')

# Your logic here
result="processed: $query"

# Output JSON to stdout
echo "{\"success\": true, \"data\": {\"result\": \"$result\"}}"
```

`plugin.yaml`:
```yaml
name: my-shell-plugin
runtime: shell
entry: script.sh
inputs:
  query:
    required: true
    type: string
outputs:
  result:
    type: string
```

## Communication Protocol

BareZen plugins communicate via JSON over stdin/stdout:

### Input (stdin)

```json
{
  "inputs": { "url": "https://example.com", "limit": 10 },
  "github": { "eventName": "push", "repository": "owner/repo", "sha": "abc123" },
  "secrets": ["API_KEY", "WEBHOOK_URL"]
}
```

### Output (stdout)

Success:
```json
{
  "success": true,
  "data": { "result": "value" }
}
```

Failure:
```json
{
  "success": false,
  "error": { "kind": "plugin-failed", "message": "Something went wrong" }
}
```

> **Important**: Only write JSON to stdout. Use stderr for logs.

## Debugging in GitHub Actions

1. Enable debug logging:
   ```yaml
   - uses: linanwanttodo/BareZen-Automation@v1
     with:
       config: automation.yml
       log-level: debug
   ```

2. Use `ctx.logger.debug()` in your plugin for verbose output.

3. Test locally with the CLI:
   ```bash
   barezen run --config automation.yml --flow my-flow --log-level debug
   ```

4. Test plugin in isolation:
   ```bash
   echo '{"inputs": {"url": "https://example.com"}}' | node dist/index.js
   ```

## Publishing Plugins

1. Build your plugin: `pnpm build`
2. Ensure `plugin.yaml` and `dist/` are included in the package
3. Publish to npm: `npm publish`
4. Reference in `automation.yml`:
   ```yaml
   plugins:
     - my-published-plugin
   ```
