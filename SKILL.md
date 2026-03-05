---
name: gt8004-agent-template
description: GT8004 analytics가 내장된 OpenClaw 에이전트 보일러플레이트. 모든 요청과 수익이 자동으로 추적됩니다.
version: 0.1.0
metadata:
  openclaw:
    requires:
      env:
        - GT8004_AGENT_ID
        - GT8004_API_KEY
      bins:
        - python3
        - pip
    primaryEnv: GT8004_API_KEY
    tags:
      - analytics
      - monitoring
      - revenue
      - ai-agent
      - gt8004
---

## Instructions

이 skill은 GT8004 BI 플랫폼과 연동된 에이전트를 빠르게 만들기 위한 템플릿입니다.

### 언제 사용하나요

- 사용자가 "GT8004 연동", "에이전트 분석", "요청 추적", "수익 모니터링" 등을 언급할 때
- 새로운 OpenClaw 에이전트를 만들면서 analytics 기능이 필요할 때

### 사용 방법

1. 템플릿 클론:
   ```bash
   git clone https://github.com/vataops/gt8004-openclaw-agent.git
   cd gt8004-openclaw-agent/agent
   ```

2. 의존성 설치:
   ```bash
   pip install -r requirements.txt
   ```

3. 환경변수 설정:
   ```bash
   cp .env.example .env
   # .env 파일에 GT8004_AGENT_ID와 GT8004_API_KEY를 입력
   ```

4. 실행:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

### GT8004가 자동으로 추적하는 것

- 모든 HTTP 요청/응답 (method, path, status, latency)
- 요청/응답 본문 (최대 16KB)
- 클라이언트 정보 (IP, User-Agent, 지역)
- x402 USDC 결제 (on-chain 검증 포함)
- 고객별 사용 패턴

### 대시보드

`https://gt8004.xyz/agents/{your-agent-id}` 에서 실시간 확인 가능:
- 요청 수, 평균 응답 시간, 수익
- 일별 추이 차트
- 고객별 분석
- 성능 분포 (p50/p95/p99)
