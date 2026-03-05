"""
GT8004-powered OpenClaw Agent

OpenClaw MeshCore 에이전트 템플릿.
GT8004 SDK가 내장되어 모든 요청이 자동으로 추적됩니다.
"""

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from gt8004 import GT8004Logger
from gt8004.middleware.fastapi import GT8004Middleware

load_dotenv()

# --- GT8004 Logger ---
logger = GT8004Logger(
    agent_id=os.getenv("GT8004_AGENT_ID", ""),
    api_key=os.getenv("GT8004_API_KEY", ""),
    ingest_url=os.getenv("GT8004_INGEST_URL", "https://gt8004.xyz/v1/ingest"),
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.transport.start_auto_flush()
    yield
    await logger.close()


app = FastAPI(
    title=os.getenv("OPENCLAW_AGENT_NAME", "gt8004-openclaw-agent"),
    lifespan=lifespan,
)

# --- Middleware 순서 중요 ---
# x402 결제를 사용할 경우 아래 주석을 해제하세요:
# from fastapi_x402 import init_x402
# init_x402(app, pay_to="0xYourWalletAddress", network="base")

# GT8004 미들웨어는 x402 이후에 등록 (outermost로 실행되어 결제 헤더 캡처)
app.add_middleware(GT8004Middleware, logger=logger)


# --- Endpoints ---


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/chat")
async def chat(request: Request):
    """메인 에이전트 엔드포인트. 비즈니스 로직을 여기에 구현하세요."""
    body = await request.json()
    message = body.get("message", "")

    # TODO: 여기에 에이전트 로직을 구현하세요
    # 예: LLM 호출, 도구 실행, 데이터 조회 등
    response_text = f"Echo: {message}"

    return JSONResponse(content={"response": response_text})


@app.get("/")
async def root():
    return {
        "name": os.getenv("OPENCLAW_AGENT_NAME", "gt8004-openclaw-agent"),
        "description": "GT8004-powered OpenClaw Agent",
        "endpoints": ["/chat", "/health"],
    }
