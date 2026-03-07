# GT8004 OpenClaw Plugin

OpenClaw plugin that automatically captures all LLM calls, tool executions, and messages to the GT8004 analytics dashboard.

Uses code-level hooks for **100% automatic capture** — no manual instrumentation required.

## Installation

```bash
git clone https://github.com/vataops/gt8004-openclaw-agent.git
openclaw plugins install -l ./gt8004-openclaw-agent
```

## Configuration

Add to your OpenClaw config file (`openclaw.yaml` or `~/.openclaw/config.yaml`):

```yaml
plugins:
  entries:
    gt8004:
      enabled: true
      config:
        agentId: "your-agent-id"
        apiKey: "your-api-key"
        # endpoint: "https://ingest.gt8004.xyz"  # default, no change needed
        # debug: false
```

> Get your Agent ID and API Key by registering at https://gt8004.xyz/register

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
                                     (log storage, on-chain revenue verification, aggregation)
                                            |
                                            v
                                     GT8004 Dashboard
                                     gt8004.xyz/agents/{id}
```

## Dashboard

View your analytics at `https://gt8004.xyz/agents/{your-agent-id}`:

| Section | Description |
|---------|-------------|
| Overview | Total requests, avg response time, revenue |
| Analytics | Daily/weekly request trends |
| Customers | Per-customer usage, churn risk |
| Revenue | Revenue trends, ARPU, per-tool breakdown |
| Performance | p50/p95/p99 response time |
| Observability | Real-time log stream |

## How It Works

This plugin uses OpenClaw's Plugin Hook system:

1. **`before_tool_call`** — Records tool call start time
2. **`after_tool_call`** — Converts tool result and duration into a GT8004 LogEntry
3. **`llm_output`** — Converts LLM model name and token usage into a GT8004 LogEntry
4. **`message_sent`** — Records sent messages as GT8004 LogEntries
5. **`gateway_stop`** — Flushes all remaining logs on shutdown

LogEntries are buffered in memory by `BatchTransport` and sent in batches to GT8004 `/v1/ingest` every 50 entries or 5 seconds.

## Debug Mode

To inspect transport activity, set `debug: true`:

```yaml
plugins:
  entries:
    gt8004:
      config:
        agentId: "your-agent-id"
        apiKey: "your-api-key"
        debug: true
```

Example output:
```
[GT8004] Plugin loaded. Agent: your-agent-id, Endpoint: https://ingest.gt8004.xyz
[GT8004] Sent 12 logs
```

## File Structure

```
gt8004-openclaw-agent/
  index.ts                  # Plugin entry point (hook registration + BatchTransport)
  openclaw.plugin.json      # OpenClaw plugin manifest
  package.json              # npm package definition
  README.md
```

## Links

- [GT8004 Platform](https://gt8004.xyz)
- [GT8004 SDK](https://github.com/vataops/gt8004-sdk)
- [GT8004 Documentation](https://github.com/vataops/gt8004)
- [OpenClaw Plugin Docs](https://docs.openclaw.ai/tools/skills)

## License

MIT
