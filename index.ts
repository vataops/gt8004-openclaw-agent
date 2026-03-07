/**
 * GT8004 Analytics Plugin for OpenClaw
 *
 * Hooks into OpenClaw's plugin lifecycle to automatically capture:
 * - LLM calls (model, tokens, cost, latency)
 * - Tool executions (name, params, result, duration)
 * - Messages sent (session tracking)
 *
 * Data is batched and sent to GT8004's /v1/ingest endpoint.
 */

// --- Inline BatchTransport (zero external dependencies) ---

interface LogEntry {
  requestId: string;
  toolName?: string;
  method: string;
  path: string;
  statusCode: number;
  responseMs: number;
  errorType?: string;
  requestBody?: string;
  responseBody?: string;
  requestBodySize?: number;
  responseBodySize?: number;
  headers?: Record<string, string>;
  protocol?: string;
  source?: string;
  timestamp: string;
}

interface LogBatch {
  agent_id: string;
  sdk_version: string;
  batch_id: string;
  entries: LogEntry[];
}

class BatchTransport {
  private buffer: LogEntry[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private consecutiveFailures = 0;
  private backoffUntil = 0;

  constructor(
    private agentId: string,
    private endpoint: string,
    private apiKey: string,
    private batchSize = 50,
    private flushIntervalMs = 5000,
    private maxRetries = 3,
    private debug = false,
  ) {
    this.startTimer();
  }

  enqueue(entry: LogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length >= this.batchSize) {
      this.flush().catch(() => {});
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    if (Date.now() < this.backoffUntil) return;

    const entries = this.buffer.splice(0, this.batchSize);
    const batch: LogBatch = {
      agent_id: this.agentId,
      sdk_version: "openclaw-plugin-0.1.0",
      batch_id: crypto.randomUUID(),
      entries,
    };

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const res = await fetch(`${this.endpoint}/v1/ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(batch),
        });

        if (res.ok || res.status === 202) {
          this.consecutiveFailures = 0;
          if (this.debug) console.log(`[GT8004] Sent ${entries.length} logs`);
          return;
        }
        lastError = new Error(`HTTP ${res.status}`);
      } catch (err) {
        lastError = err as Error;
      }

      if (attempt < this.maxRetries - 1) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }

    this.consecutiveFailures++;
    if (this.consecutiveFailures >= 5) {
      this.backoffUntil = Date.now() + 30_000;
      if (this.debug) console.warn("[GT8004] Circuit breaker: backing off 30s");
    }

    this.buffer.unshift(...entries);
    if (this.debug) console.warn(`[GT8004] Failed: ${lastError?.message}`);
  }

  async close(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.backoffUntil = 0;
    await this.flush();
  }

  private startTimer(): void {
    this.timer = setInterval(() => {
      this.flush().catch(() => {});
    }, this.flushIntervalMs);
    if (this.timer && typeof this.timer === "object" && "unref" in this.timer) {
      (this.timer as NodeJS.Timeout).unref();
    }
  }
}

// --- Helpers ---

const MAX_BODY = 16_384;

function truncate(s: unknown): string | undefined {
  if (s == null) return undefined;
  const str = typeof s === "string" ? s : JSON.stringify(s);
  return str.length > MAX_BODY ? str.slice(0, MAX_BODY) : str;
}

// --- Plugin Definition ---

interface PluginConfig {
  agentId: string;
  apiKey: string;
  endpoint?: string;
  debug?: boolean;
}

const gt8004Plugin = {
  id: "gt8004",
  name: "GT8004 Analytics",
  description:
    "Automatic request, tool call, and revenue tracking for the GT8004 BI platform",

  register(api: any) {
    const config = (api.pluginConfig ?? {}) as PluginConfig;

    if (!config.agentId || !config.apiKey) {
      api.logger?.warn?.(
        "[GT8004] Missing agentId or apiKey in plugin config. Plugin disabled.",
      );
      return;
    }

    const endpoint = config.endpoint ?? "https://api.gt8004.xyz";
    const transport = new BatchTransport(
      config.agentId,
      endpoint,
      config.apiKey,
      50,
      5000,
      3,
      config.debug ?? false,
    );

    // Track tool call start times
    const toolTimers = new Map<string, number>();

    // --- Hook: beforeToolCall ---
    api.on("before_tool_call", (event: any) => {
      const callId =
        event.toolCallId ?? event.toolName ?? crypto.randomUUID();
      toolTimers.set(callId, Date.now());
    });

    // --- Hook: afterToolCall ---
    api.on("after_tool_call", (event: any) => {
      const callId =
        event.toolCallId ?? event.toolName ?? "unknown";
      const startTime = toolTimers.get(callId);
      const responseMs = startTime ? Date.now() - startTime : 0;
      toolTimers.delete(callId);

      const resultStr = truncate(event.result);

      transport.enqueue({
        requestId: crypto.randomUUID(),
        toolName: event.toolName ?? "unknown",
        method: "POST",
        path: `/openclaw/tool/${event.toolName ?? "unknown"}`,
        statusCode: event.error ? 500 : 200,
        responseMs,
        errorType: event.error ? String(event.error) : undefined,
        requestBody: truncate(event.params ?? event.args),
        responseBody: resultStr,
        requestBodySize: event.params
          ? JSON.stringify(event.params).length
          : undefined,
        responseBodySize: resultStr?.length,
        protocol: "mcp",
        source: "openclaw",
        timestamp: new Date().toISOString(),
      });
    });

    // --- Hook: llmOutput ---
    api.on("llm_output", (event: any) => {
      const usage = event.usage;
      if (!usage) return;

      const headers: Record<string, string> = {};
      if (event.model) headers["x-model"] = String(event.model);
      if (event.provider) headers["x-provider"] = String(event.provider);
      if (usage.input) headers["x-tokens-input"] = String(usage.input);
      if (usage.output) headers["x-tokens-output"] = String(usage.output);
      if (usage.total) headers["x-tokens-total"] = String(usage.total);

      transport.enqueue({
        requestId: crypto.randomUUID(),
        toolName: event.model ?? "llm",
        method: "POST",
        path: `/openclaw/llm/${event.provider ?? "unknown"}`,
        statusCode: 200,
        responseMs: event.durationMs ?? 0,
        headers,
        protocol: "http",
        source: "openclaw",
        timestamp: new Date().toISOString(),
      });
    });

    // --- Hook: messageSent ---
    api.on("message_sent", (event: any) => {
      transport.enqueue({
        requestId: crypto.randomUUID(),
        toolName: "message",
        method: "POST",
        path: `/openclaw/message/${event.channel ?? "default"}`,
        statusCode: 200,
        responseMs: 0,
        responseBody: truncate(event.text ?? event.content),
        protocol: "http",
        source: "openclaw",
        timestamp: new Date().toISOString(),
      });
    });

    // --- Hook: gatewayStop (graceful shutdown) ---
    api.on("gateway_stop", async () => {
      await transport.close();
    });

    if (config.debug) {
      api.logger?.info?.(
        `[GT8004] Plugin loaded. Agent: ${config.agentId}, Endpoint: ${endpoint}`,
      );
    }
  },
};

export default gt8004Plugin;
