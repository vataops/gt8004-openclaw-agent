# GT8004 OpenClaw Plugin

OpenClaw plugin that automatically captures all LLM calls, tool executions, and messages to the GT8004 analytics dashboard.

Uses code-level hooks for **100% automatic capture** — no manual instrumentation required.

## Quick Start

### Step 1: Register your agent

Go to **https://gt8004.xyz/register/openclaw** and register your agent.

You'll receive:
- **Agent ID** (e.g. `openclaw-a1b2c3d4`)
- **API Key** (e.g. `sk_...`)

Save these — you'll need them in Step 3.

### Step 2: Install the plugin

```bash
git clone https://github.com/vataops/gt8004-openclaw-agent.git
openclaw plugins install -l ./gt8004-openclaw-agent
```

### Step 3: Configure

Add to your OpenClaw config file (`~/.openclaw/config.yaml`):

```json5
{
  "plugins": {
    "entries": {
      "gt8004": {
        "enabled": true,
        "config": {
          "agentId": "openclaw-a1b2c3d4",   // from Step 1
          "apiKey": "sk_..."                // from Step 1
        }
      }
    }
  }
}
```

### Step 4: Restart OpenClaw

```bash
openclaw gateway restart
```

You should see:
```
[GT8004] Plugin loaded. Agent: openclaw-a1b2c3d4, Endpoint: https://ingest.gt8004.xyz
```

### Step 5: View your dashboard

Go to `https://gt8004.xyz/agents/openclaw-a1b2c3d4` to see your analytics.

## What Gets Captured

The plugin hooks into the following OpenClaw lifecycle events:

| Hook | Captured Data | GT8004 Mapping |
|------|--------------|----------------|
| `after_tool_call` | Tool name, params, result, duration | `toolName`, `responseMs`, `requestBody/responseBody` |
| `llm_output` | Model, provider, token count, cost | `headers` (x-model, x-tokens-*) |
| `message_sent` | Channel, message content | `responseBody` |
| `gateway_stop` | — | Flush remaining logs |

## Data Flow

```
User Message
    |
    v
OpenClaw Gateway
    |
    +-- LLM Call -----> [llm_output hook] --+
    |                                       |
    +-- Tool Exec ----> [after_tool_call] --+
    |                                       |
    +-- Send Reply ---> [message_sent] -----+
                                            |
                                            v
                                     BatchTransport
                                     (in-memory buffer, 50 entries or 5s)
                                            |
                                            | POST /v1/ingest
                                            v
                                     GT8004 Platform
                                            |
                                            v
                                     GT8004 Dashboard
                                     gt8004.xyz/agents/{id}
```

## Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `agentId` | string | **Yes** | — | Agent ID from registration |
| `apiKey` | string | **Yes** | — | API Key from registration |
| `endpoint` | string | No | `https://ingest.gt8004.xyz` | Ingest API endpoint |
| `debug` | boolean | No | `false` | Enable debug logging |

## Debug Mode

To inspect transport activity:

```yaml
plugins:
  entries:
    gt8004:
      config:
        agentId: "openclaw-a1b2c3d4"
        apiKey: "sk_..."
        debug: true
```

Output:
```
[GT8004] Plugin loaded. Agent: openclaw-a1b2c3d4, Endpoint: https://ingest.gt8004.xyz
[GT8004] Sent 12 logs
```

## Troubleshooting

### `must have required property 'agentId'`

You need to register first at https://gt8004.xyz/register/openclaw and add the credentials to your config file. See Step 1 & 3.

### `plugins.allow is empty` warning

This is just a warning, not an error. The plugin loads normally without `plugins.allow`. You can safely ignore it.

### Logs not appearing on dashboard

1. Verify `agentId` and `apiKey` are correct
2. Set `debug: true` to see transport activity
3. Check network connectivity to `ingest.gt8004.xyz`
4. Restart OpenClaw after config changes

## Links

- [GT8004 Platform](https://gt8004.xyz)
- [GT8004 SDK](https://github.com/vataops/gt8004-sdk)
- [OpenClaw Plugin Docs](https://docs.openclaw.ai/tools/skills)

## License

MIT
