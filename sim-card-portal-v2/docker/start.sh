#!/bin/sh

# Start the Node.js API server in the background
echo "Starting API server..."
node /app/scripts/local-api-server.js &

# Wait for API to be ready
sleep 2

# Start nginx in the foreground
echo "Starting nginx..."
nginx -g "daemon off;"
