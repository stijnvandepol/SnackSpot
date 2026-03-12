#!/usr/bin/env bash
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

echo ""
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${CYAN}${BOLD}   SnackSpot — pre-deploy unit tests${RESET}"
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# Build the test stage and capture output.
# --progress=plain shows the RUN output (vitest results) inline.
# --no-cache-filter test ensures tests always re-run even when source is cached.
TEST_OUTPUT=$(docker build \
  --target test \
  --progress=plain \
  --no-cache-filter test \
  -f apps/web/Dockerfile \
  . 2>&1) || TEST_EXIT=$?
TEST_EXIT=${TEST_EXIT:-0}

FILES_LINE=$(echo "$TEST_OUTPUT" | grep -E "Test Files" | tail -1 || true)
TESTS_LINE=$(echo "$TEST_OUTPUT" | grep -E "^ *Tests " | tail -1 || true)

echo ""
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

if [ "$TEST_EXIT" -ne 0 ]; then
  echo -e "${RED}${BOLD}   ✖  TESTS FAILED — deploy aborted${RESET}"
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
  echo "$TEST_OUTPUT" | grep -A 30 "FAIL\|Error\|Tests" | tail -40
  echo ""
  exit 1
fi

echo -e "${GREEN}${BOLD}   ✔  ALL TESTS PASSED${RESET}"
[ -n "$FILES_LINE" ] && echo -e "   ${FILES_LINE}"
[ -n "$TESTS_LINE" ] && echo -e "   ${TESTS_LINE}"
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

docker compose up -d --build "$@"
