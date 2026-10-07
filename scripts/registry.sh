#!/usr/bin/env bash
# Runs a local Verdaccio registry for the demos.
# Usage: scripts/registry.sh start | stop | reset
set -euo pipefail
cd "$(dirname "$0")/../registry"
PORT=4873

is_up() { curl -sf "http://localhost:$PORT/-/ping" >/dev/null; }

start() {
  if is_up; then return; fi
  nohup npx --yes verdaccio@6 --config ./config.yaml --listen "$PORT" >verdaccio.log 2>&1 &
  echo $! >verdaccio.pid
  for _ in $(seq 60); do is_up && return; sleep 1; done
  echo "Registry didn't start, see registry/verdaccio.log" >&2
  exit 1
}

stop() {
  if [[ -f verdaccio.pid ]]; then
    pkill -P "$(cat verdaccio.pid)" 2>/dev/null || true
    kill "$(cat verdaccio.pid)" 2>/dev/null || true
    rm verdaccio.pid
  fi
}

case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  reset) stop; rm -rf storage htpasswd; start ;;
  *) echo "Usage: $0 start | stop | reset" >&2; exit 1 ;;
esac
