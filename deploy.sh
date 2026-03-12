#!/usr/bin/env bash
set -euo pipefail

# ─── Colours ──────────────────────────────────────────────────────────────────
BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

# ─── Find pnpm ────────────────────────────────────────────────────────────────
# pnpm may not be in PATH when running as root on the server.
# Check common install locations before falling back to npx.
find_pnpm() {
  if command -v pnpm &>/dev/null; then
    echo "pnpm"
    return
  fi
  for candidate in \
    "/root/.local/share/pnpm/pnpm" \
    "/usr/local/bin/pnpm" \
    "/usr/bin/pnpm" \
    "$(npm root -g 2>/dev/null)/../bin/pnpm"
  do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return
    fi
  done
  # Last resort: install globally (once) and use it
  echo "Installing pnpm..." >&2
  npm install -g pnpm@9.15.4 --quiet >&2
  echo "pnpm"
}

PNPM=$(find_pnpm)

echo ""
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${CYAN}${BOLD}   SnackSpot — pre-deploy unit tests${RESET}"
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# Run tests and capture output + exit code
TEST_OUTPUT=$($PNPM --filter web test 2>&1) || TEST_EXIT=$?
TEST_EXIT=${TEST_EXIT:-0}

FILES_LINE=$(echo "$TEST_OUTPUT" | grep -E "Test Files" || true)
TESTS_LINE=$(echo "$TEST_OUTPUT" | grep -E "^ *Tests " || true)

echo ""
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

if [ "$TEST_EXIT" -ne 0 ]; then
  echo -e "${RED}${BOLD}   ✖  TESTS FAILED — deploy aborted${RESET}"
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
  echo "$TEST_OUTPUT"
  echo ""
  exit 1
fi

echo -e "${GREEN}${BOLD}   ✔  ALL TESTS PASSED${RESET}"
[ -n "$FILES_LINE" ] && echo -e "   ${FILES_LINE}"
[ -n "$TESTS_LINE" ] && echo -e "   ${TESTS_LINE}"
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ─── Deploy ───────────────────────────────────────────────────────────────────
docker compose up -d --build "$@"
