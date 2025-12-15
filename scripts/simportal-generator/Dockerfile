# SIM Card Portal Data Generator
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY index.js ./

# Default environment variables
ENV MQTT_BROKER_URL=mqtt://emqx:1883
ENV SENSOR_INTERVAL=10
ENV LOCATION_INTERVAL=5
ENV MQTT_TOPIC_PREFIX=simportal/devices
ENV CONFIG_PATH=/app/config/simportal-devices.json

CMD ["node", "index.js"]
