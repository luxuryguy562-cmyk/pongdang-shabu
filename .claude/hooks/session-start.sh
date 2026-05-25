#!/usr/bin/env bash
# 매 세션 시작 시 자동 실행 — CTO에게 현재 환경 도구 목록 박음
# 헌법 1-7-B "없다" 단정 금지 + 1-10 CTO 자동 추론 의무 자동화
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" 2>/dev/null || true

echo "═══════════════════════════════════════════════"
echo "🔧 CTO 환경 자가 점검 (헌법 1-7 / 1-10 자동화)"
echo "═══════════════════════════════════════════════"

# 1. MCP 도구 (외부 서버 연결)
echo ""
echo "📡 MCP 도구 (.mcp.json):"
if [ -f .mcp.json ]; then
  jq -r '.mcpServers | keys[] | "  ✅ \(.)"' .mcp.json 2>/dev/null || echo "  (jq 파싱 실패)"
else
  echo "  (없음)"
fi
echo "  ✅ github (빌트인)"

# 2. 로컬 명령어
echo ""
echo "💻 로컬 명령어:"
for cmd in playwright node python3 curl jq git sed grep awk find; do
  loc=$(which $cmd 2>/dev/null)
  if [ -n "$loc" ]; then
    case $cmd in
      playwright) ver=$($cmd --version 2>/dev/null | head -1);;
      node) ver=$($cmd --version 2>/dev/null);;
      python3) ver=$($cmd --version 2>/dev/null | awk '{print $2}');;
      *) ver="";;
    esac
    echo "  ✅ $cmd $ver"
  fi
done

# 3. Node 라이브러리 (검증·테스트 관련 핵심)
echo ""
echo "📦 Node 라이브러리 (검증·테스트 핵심):"
for lib in playwright eslint prettier http-server serve nodemon ts-node typescript chromedriver; do
  if [ -d /opt/node22/lib/node_modules/$lib ]; then
    echo "  ✅ $lib"
  fi
done

# 4. 외부 호스트 접근 (네트워크 정책)
echo ""
echo "🌐 외부 호스트 (네트워크 정책):"
for host in github.com api.github.com cdn.jsdelivr.net pongdang-shabu.pages.dev; do
  code=$(curl -sI -o /dev/null -w "%{http_code}" --max-time 3 https://$host 2>/dev/null)
  if [ "$code" = "200" ] || [ "$code" = "301" ] || [ "$code" = "302" ]; then
    echo "  ✅ $host"
  else
    echo "  ❌ $host (차단 — Mock CDN 또는 MCP 우회 필요)"
  fi
done

echo ""
echo "═══════════════════════════════════════════════"
echo "📋 CTO 의무 (헌법 1-7-B): \"없다\" 단정 전 위 도구 목록 확인 후 시도"
echo "═══════════════════════════════════════════════"
