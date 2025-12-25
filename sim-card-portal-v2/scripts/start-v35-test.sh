#!/bin/bash
# Start V3.5Supabase branch on separate ports for independent testing
# API: 3002, Frontend: 5175

export API_PORT=3004
export VITE_PORT=5175

echo "======================================"
echo "Starting V3.5Supabase Test Environment"
echo "======================================"
echo "API Server:  http://localhost:$API_PORT"
echo "Frontend:    http://localhost:$VITE_PORT"
echo "======================================"
echo ""

# Check if ports are available
if lsof -i :$API_PORT > /dev/null 2>&1; then
    echo "⚠️  Warning: Port $API_PORT is already in use"
    exit 1
fi

if lsof -i :$VITE_PORT > /dev/null 2>&1; then
    echo "⚠️  Warning: Port $VITE_PORT is already in use"
    exit 1
fi

# Start API server in background
echo "Starting API server on port $API_PORT..."
node scripts/local-api-server.js &
API_PID=$!

# Wait for API to start
sleep 2

# Start Vite dev server
echo "Starting Vite dev server on port $VITE_PORT..."
npx vite --port $VITE_PORT &
VITE_PID=$!

echo ""
echo "Services started:"
echo "  API PID: $API_PID"
echo "  Vite PID: $VITE_PID"
echo ""
echo "Press Ctrl+C to stop all services"

# Trap Ctrl+C to kill both processes
trap "echo 'Stopping services...'; kill $API_PID $VITE_PID 2>/dev/null; exit" SIGINT SIGTERM

# Wait for both processes
wait
