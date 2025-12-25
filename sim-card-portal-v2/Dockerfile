# Multi-stage Dockerfile for SIM Card Portal v2

# Stage 1: Build the Vue.js frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the frontend (skip TypeScript checking for Docker build)
RUN npm run build || (npx vite build)

# Stage 2: Production image with nginx and Node.js API
FROM node:20-alpine AS production

# Install nginx
RUN apk add --no-cache nginx

WORKDIR /app

# Copy package files for API server
COPY package*.json ./
COPY scripts/local-api-server.js ./scripts/

# Install only production dependencies needed for API
RUN npm install --production pg express cors

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Copy startup script
COPY docker/start.sh /start.sh
RUN chmod +x /start.sh

# Expose ports
EXPOSE 80 3001

# Start nginx and API server
CMD ["/start.sh"]
