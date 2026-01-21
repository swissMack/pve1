# MQTT Control Panel Backend - Node.js API Server
FROM node:20-alpine

WORKDIR /app

# Install Docker CLI for container management
RUN apk add --no-cache docker-cli

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy server files
COPY server.js ./

# Note: Running as root to allow Docker socket access for container management
# In production, consider using rootless Docker or proper group permissions

# Expose API port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3003/api/generator/status || exit 1

# Start the backend server
CMD ["node", "server.js"]
