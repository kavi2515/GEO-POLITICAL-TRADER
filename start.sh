#!/usr/bin/env bash
# Starts both the FastAPI backend and React frontend.
# Run from the project root: ./start.sh

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=============================="
echo "  GeoTrader — starting up"
echo "=============================="

# ---------- Backend ----------
echo ""
echo "[Backend] Installing Python dependencies..."
cd "$ROOT/backend"
pip install -r requirements.txt --quiet

echo "[Backend] Starting FastAPI on http://localhost:8000 ..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "[Backend] PID: $BACKEND_PID"

# ---------- Frontend ----------
echo ""
echo "[Frontend] Installing Node dependencies..."
cd "$ROOT/frontend"
npm install --silent

echo "[Frontend] Starting Vite dev server on http://localhost:5173 ..."
npm run dev &
FRONTEND_PID=$!
echo "[Frontend] PID: $FRONTEND_PID"

echo ""
echo "=============================="
echo "  Open http://localhost:5173"
echo "=============================="

# Wait for both
wait $BACKEND_PID $FRONTEND_PID