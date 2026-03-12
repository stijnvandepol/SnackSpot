#!/usr/bin/env bash
set -euo pipefail

# ─── Colours ──────────────────────────────────────────────────────────────────
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

# Run vitest and capture both output and exit code
TEST_OUTPUT=$(pnpm --filter web test 2>&1) || TEST_EXIT=$?
TEST_EXIT=${TEST_EXIT:-0}

# Parse summary from vitest output  (line: "Tests  108 passed (108)")
SUMMARY=$(echo "$TEST_OUTPUT" | grep -E "^ *(✓|×|Tests)" | tail -4 || true)
FILES_LINE=$(echo "$TEST_OUTPUT" | grep -E "Test Files" || true)
TESTS_LINE=$(echo "$TEST_OUTPUT" | grep -E "^ *Tests " || true)

echo ""
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

if [ "$TEST_EXIT" -ne 0 ]; then
  echo -e "${RED}${BOLD}   ✖  TESTS FAILED — deploy aborted${RESET}"
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
  # Show full output so the user can see what failed
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
