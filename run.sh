#!/bin/bash

# ============================================================
#  CodeReview — One-click startup script
#  Usage: ./run.sh
# ============================================================

ROOT="$(cd "$(dirname "$0")" && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RESET='\033[0m'

echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗${RESET}"
echo -e "${CYAN}║       CodeReview — Starting Up       ║${RESET}"
echo -e "${CYAN}╚══════════════════════════════════════╝${RESET}"
echo ""

# ── Kill any existing processes on our ports ──────────────────
echo -e "${YELLOW}► Clearing ports 5001, 5173, 8000...${RESET}"
lsof -ti:5001 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
lsof -ti:8000 | xargs kill -9 2>/dev/null
sleep 1

# ── 1. Backend (Express) ──────────────────────────────────────
echo -e "${GREEN}► Starting Backend  (http://localhost:5001)${RESET}"
osascript -e "
  tell application \"Terminal\"
    do script \"echo '=== Backend (Express) ===' && cd '$ROOT/backend_express' && node --watch index.js\"
  end tell
" 2>/dev/null || (
  # Fallback: run in background if not on macOS / Terminal unavailable
  cd "$ROOT/backend_express" && node --watch index.js &>/tmp/cr_backend.log &
  echo "  Backend running in background (logs: /tmp/cr_backend.log)"
)

sleep 2

# ── 2. Python Analyzer ────────────────────────────────────────
echo -e "${GREEN}► Starting Python Analyzer  (http://localhost:8000)${RESET}"
osascript -e "
  tell application \"Terminal\"
    do script \"echo '=== Python Analyzer ===' && cd '$ROOT/analyzer_python' && source venv/bin/activate 2>/dev/null || true && python main.py\"
  end tell
" 2>/dev/null || (
  cd "$ROOT/analyzer_python"
  source venv/bin/activate 2>/dev/null || true
  python main.py &>/tmp/cr_analyzer.log &
  echo "  Analyzer running in background (logs: /tmp/cr_analyzer.log)"
)

sleep 2

# ── 3. Frontend (Vite) ────────────────────────────────────────
echo -e "${GREEN}► Starting Frontend  (http://localhost:5173)${RESET}"
osascript -e "
  tell application \"Terminal\"
    do script \"echo '=== Frontend (Vite) ===' && cd '$ROOT/frontend' && npm run dev\"
  end tell
" 2>/dev/null || (
  cd "$ROOT/frontend" && npm run dev &>/tmp/cr_frontend.log &
  echo "  Frontend running in background (logs: /tmp/cr_frontend.log)"
)

sleep 3

# ── Done ──────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${RESET}"
echo -e "${CYAN}║  ✅  All services started!                   ║${RESET}"
echo -e "${CYAN}║                                              ║${RESET}"
echo -e "${CYAN}║  🌐  Open:  http://localhost:5173            ║${RESET}"
echo -e "${CYAN}║  🔌  API:   http://localhost:5001            ║${RESET}"
echo -e "${CYAN}║  🐍  Python: http://localhost:8000           ║${RESET}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${RESET}"
echo ""

# Auto-open browser after a short delay
sleep 2
open "http://localhost:5173" 2>/dev/null || xdg-open "http://localhost:5173" 2>/dev/null || true
