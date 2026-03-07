# GT8004 OpenClaw Plugin

OpenClaw 플러그인으로 모든 LLM 호출, 도구 실행, 메시지를 자동으로 GT8004 대시보드에 수집합니다.

코드 레벨 Hook 기반으로 동작하므로 **100% 자동 캡처**됩니다.

## 설치

```bash
git clone https://github.com/vataops/gt8004-openclaw-agent.git
openclaw plugins install -l ./gt8004-openclaw-agent
```

## 설정

OpenClaw 설정 파일(`openclaw.yaml` 또는 `~/.openclaw/config.yaml`)에 추가:

```yaml
plugins:
  entries:
    gt8004:
      enabled: true
      config:
        agentId: "your-agent-id"
        apiKey: "your-api-key"
        # endpoint: "https://api.gt8004.xyz"  # 기본값, 변경 불필요
        # debug: false
```

> GT8004 Agent ID와 API Key는 https://gt8004.xyz/register 에서 에이전트를 등록하면 발급됩니다.

## 자동 캡처 항목

플러그인이 Hook하는 OpenClaw 이벤트:

| Hook | 캡처 데이터 | GT8004 매핑 |
|------|------------|-------------|
| `after_tool_call` | 도구명, 파라미터, 결과, 실행 시간 | `toolName`, `responseMs`, `requestBody/responseBody` |
| `llm_output` | 모델, 프로바이더, 토큰 수, 비용 | `headers` (x-model, x-tokens-*) |
| `message_sent` | 채널, 메시지 내용 | `responseBody` |
| `gateway_stop` | - | 남은 로그 flush |

## 데이터 흐름

```
사용자 메시지
    |
    v
OpenClaw Gateway
    |
    +-- LLM 호출 --> [llm_output hook] --+
    |                                     |
    +-- 도구 실행 --> [after_tool_call] --+
    |                                     |
    +-- 응답 전송 --> [message_sent] -----+
                                          |
                                          v
                                   BatchTransport
                                   (메모리 버퍼, 50개 또는 5초)
                                          |
                                          | POST /v1/ingest
                                          v
                                   GT8004 Platform
                                   (요청 로그, 수익 검증, 집계)
                                          |
                                          v
                                   GT8004 Dashboard
                                   gt8004.xyz/agents/{id}
```

## GT8004 대시보드에서 확인 가능한 것

| 항목 | 설명 |
|------|------|
| Overview | 총 요청 수, 평균 응답 시간, 수익 |
| Analytics | 일별/주별 요청 추이 |
| Customers | 고객별 사용 내역, 이탈 위험 |
| Revenue | 수익 추이, ARPU, 도구별 수익 |
| Performance | p50/p95/p99 응답 시간 |
| Observability | 실시간 로그 스트림 |

## 동작 원리

이 플러그인은 OpenClaw의 Plugin Hook 시스템을 사용합니다:

1. **`before_tool_call`** - 도구 호출 시작 시간 기록
2. **`after_tool_call`** - 도구 실행 결과와 소요 시간을 GT8004 LogEntry로 변환
3. **`llm_output`** - LLM 응답의 모델명, 토큰 사용량을 GT8004 LogEntry로 변환
4. **`message_sent`** - 전송된 메시지를 GT8004 LogEntry로 기록
5. **`gateway_stop`** - 종료 시 남은 로그를 모두 flush

LogEntry는 `BatchTransport`에 의해 메모리에 버퍼링되고, 50개가 모이거나 5초 간격으로 GT8004 `/v1/ingest`로 배치 전송됩니다.

## 디버그 모드

전송 상태를 확인하려면 `debug: true`를 설정하세요:

```yaml
plugins:
  entries:
    gt8004:
      config:
        agentId: "your-agent-id"
        apiKey: "your-api-key"
        debug: true
```

로그 출력 예시:
```
[GT8004] Plugin loaded. Agent: your-agent-id, Endpoint: https://api.gt8004.xyz
[GT8004] Sent 12 logs
```

## 파일 구조

```
gt8004-openclaw-agent/
  index.ts                  # 플러그인 엔트리포인트 (Hook 등록 + BatchTransport)
  openclaw.plugin.json      # OpenClaw 플러그인 매니페스트
  package.json              # npm 패키지 정의
  README.md
```

## 관련 링크

- [GT8004 Platform](https://gt8004.xyz)
- [GT8004 SDK](https://github.com/vataops/gt8004-sdk)
- [GT8004 Documentation](https://github.com/vataops/gt8004)
- [OpenClaw Plugin Docs](https://docs.openclaw.ai/tools/skills)

## License

MIT
