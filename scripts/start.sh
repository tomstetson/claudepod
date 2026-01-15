#!/bin/bash
# ClaudePod startup script with auto-restart

cd "$(dirname "$0")/.."

MAX_RESTARTS=5
RESTART_DELAY=3
restart_count=0

cleanup() {
  echo "Shutting down ClaudePod..."
  kill $SERVER_PID 2>/dev/null
  exit 0
}

trap cleanup SIGINT SIGTERM

while true; do
  echo "Starting ClaudePod server..."
  node server.js &
  SERVER_PID=$!

  wait $SERVER_PID
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    echo "Server stopped gracefully"
    break
  fi

  restart_count=$((restart_count + 1))

  if [ $restart_count -ge $MAX_RESTARTS ]; then
    echo "Max restarts ($MAX_RESTARTS) reached. Exiting."
    exit 1
  fi

  echo "Server crashed with code $EXIT_CODE. Restarting in ${RESTART_DELAY}s... (attempt $restart_count/$MAX_RESTARTS)"
  sleep $RESTART_DELAY
done
