# GT8004 OpenClaw Agent

GT8004 analytics가 내장된 OpenClaw 에이전트 보일러플레이트.

이 템플릿으로 에이전트를 만들면, 모든 요청/수익 데이터가 자동으로 GT8004 대시보드에 수집됩니다.

## 빠른 시작

### 1. 클론 및 설치

```bash
git clone https://github.com/vataops/gt8004-openclaw-agent.git
cd gt8004-openclaw-agent/agent
pip install -r requirements.txt
```

### 2. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 편집하세요:

```bash
GT8004_AGENT_ID=your-agent-id    # GT8004 대시보드에서 발급
GT8004_API_KEY=your-api-key      # GT8004 대시보드에서 발급
OPENCLAW_AGENT_NAME=my-agent
```

> GT8004 agent ID와 API key는 https://gt8004.xyz/register 에서 에이전트를 등록하면 발급됩니다.

### 3. 실행

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. 테스트

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "hello"}'
```

대시보드에서 확인: `https://gt8004.xyz/agents/{your-agent-id}`

## 데이터 흐름

```
OpenClaw / MeshCore 사용자
        |
        | HTTP Request
        v
+---------------------+
|   FastAPI Server    |
|   (agent/main.py)   |
+----------+----------+
           |
           | GT8004Middleware (자동 캡처)
           | - method, path, status
           | - latency (ms)
           | - request/response body
           | - x402 결제 정보
           | - 클라이언트 IP, User-Agent
           v
+---------------------+
|   GT8004 Logger     |
|   - 메모리 버퍼     |
|   - 배치 전송 (50개 또는 5초) |
+----------+----------+
           |
           | POST /v1/ingest
           v
+---------------------+
|   GT8004 Platform   |
|   - 요청 로그 저장   |
|   - 수익 on-chain 검증 |
|   - 실시간 집계      |
+----------+----------+
           |
           v
+---------------------+
|   GT8004 Dashboard  |
|   gt8004.xyz        |
+---------------------+
```

## x402 결제 연동

에이전트에 USDC 과금을 추가하려면:

### 1. 의존성 추가

`requirements.txt`에서 `fastapi-x402` 주석을 해제하세요.

### 2. 미들웨어 활성화

`main.py`에서 x402 관련 주석을 해제하세요:

```python
from fastapi_x402 import init_x402

# x402 먼저 등록
init_x402(app, pay_to="0xYourWalletAddress", network="base")

# GT8004는 x402 이후에 등록 (결제 헤더를 캡처하기 위해)
app.add_middleware(GT8004Middleware, logger=logger)
```

> 미들웨어 순서가 중요합니다. GT8004가 x402 이후에 등록되어야 `X-PAYMENT-RESPONSE` 헤더를 읽을 수 있습니다.

### 3. 자동 수익 추적

x402를 통한 USDC 결제는 GT8004가 자동으로:
- 트랜잭션 해시 추출
- On-chain USDC Transfer 이벤트 검증
- 검증된 수익만 대시보드에 표시

지원 네트워크: Ethereum Mainnet, Base Mainnet, Base Sepolia, Ethereum Sepolia

## MeshCore 마켓플레이스 등록

에이전트를 MeshCore에 등록하여 수익화할 수 있습니다:

```bash
meshcore register \
  --name "my-agent" \
  --description "My GT8004-powered agent" \
  --endpoint "https://your-domain.com/chat"
```

MeshCore를 통한 모든 호출도 GT8004 미들웨어가 자동으로 캡처합니다.

## Docker 배포

```bash
docker build -t my-openclaw-agent .
docker run -p 8000:8000 --env-file agent/.env my-openclaw-agent
```

## 커스터마이징

### 엔드포인트 추가

`main.py`에 새 엔드포인트를 추가하면 자동으로 추적됩니다:

```python
@app.post("/search")
async def search(request: Request):
    body = await request.json()
    query = body.get("query", "")
    results = do_search(query)  # 비즈니스 로직
    return {"results": results}
```

### 고객 ID 커스터마이징

기본적으로 클라이언트 IP로 고객을 식별합니다. API 키 등으로 변경하려면:

```python
app.add_middleware(
    GT8004Middleware,
    logger=logger,
    extract_customer_id=lambda req: req.headers.get("x-api-key")
)
```

### 민감한 데이터 마스킹

```python
def mask_body(body: str) -> str:
    return body.replace('"password":', '"password":"***"')

app.add_middleware(
    GT8004Middleware,
    logger=logger,
    sanitize_fn=mask_body
)
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

## 관련 링크

- [GT8004 Platform](https://gt8004.xyz)
- [GT8004 Python SDK](https://github.com/vataops/gt8004-sdk)
- [GT8004 Documentation](https://github.com/vataops/gt8004)
- [OpenClaw](https://openclaw.ai)
- [MeshCore Marketplace](https://github.com/openclaw/openclaw/discussions/30008)

## License

MIT
