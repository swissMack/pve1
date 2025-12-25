/**
 * MQTT Bridge Service - Main Entry Point
 *
 * Connects to an MQTT broker, receives device telemetry,
 * persists to database, and broadcasts to frontend via WebSocket.
 */

const { config, validateConfig, logConfig } = require('./config');
const mqttClient = require('./mqttClient');
const dbService = require('./dbService');
const wsServer = require('./websocketServer');
const { processMessage } = require('./messageParser');

// Statistics tracking
const stats = {
  messagesReceived: 0,
  messagesPersisted: 0,
  messagesInvalid: 0,
  startTime: null,
};

/**
 * Handle incoming MQTT message
 */
async function handleMessage({ topic, deviceId, messageType, data }) {
  stats.messagesReceived++;

  console.log(`Received ${messageType} message from device ${deviceId}`);

  // Validate and parse message
  const result = processMessage(messageType, data, deviceId);

  if (!result.valid) {
    stats.messagesInvalid++;
    console.warn(`Invalid ${messageType} message from ${deviceId}:`, result.errors);
    return;
  }

  const parsedData = result.parsed;

  try {
    // Persist to database based on message type
    if (messageType === 'sensors') {
      await dbService.insertSensorData(parsedData);
      await dbService.updateDeviceStatus(deviceId, parsedData);

      // Broadcast to WebSocket clients
      wsServer.broadcastSensorUpdate(deviceId, parsedData);
    } else if (messageType === 'location') {
      await dbService.insertLocationData(parsedData);
      await dbService.updateDeviceLocation(deviceId, parsedData);

      // Broadcast to WebSocket clients
      wsServer.broadcastLocationUpdate(deviceId, parsedData);
    }

    stats.messagesPersisted++;
  } catch (err) {
    console.error(`Failed to process message: ${err.message}`);
  }
}

/**
 * Handle MQTT connection status changes
 */
function handleMqttStatus(status) {
  wsServer.broadcastConnectionStatus(status);
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal) {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);

  try {
    // Disconnect from MQTT broker
    await mqttClient.disconnect();

    // Stop WebSocket server
    await wsServer.stop();

    // Close database connections
    await dbService.disconnect();

    console.log('Shutdown complete');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
}

/**
 * Print service statistics
 */
function printStats() {
  const uptime = stats.startTime ? Math.floor((Date.now() - stats.startTime) / 1000) : 0;
  console.log('\n=== MQTT Bridge Statistics ===');
  console.log(`Uptime: ${uptime} seconds`);
  console.log(`Messages Received: ${stats.messagesReceived}`);
  console.log(`Messages Persisted: ${stats.messagesPersisted}`);
  console.log(`Invalid Messages: ${stats.messagesInvalid}`);
  console.log(`WebSocket Clients: ${wsServer.getStats().totalConnections}`);
  console.log('==============================\n');
}

/**
 * Main startup function
 */
async function main() {
  console.log('\n========================================');
  console.log('  MQTT Bridge Service for SIM Card Portal');
  console.log('========================================\n');

  try {
    // Validate configuration
    validateConfig();
    logConfig();

    // Connect to database
    console.log('\nConnecting to database...');
    await dbService.connect();

    // Start WebSocket server
    console.log('\nStarting WebSocket server...');
    await wsServer.start();

    // Connect to MQTT broker
    console.log('\nConnecting to MQTT broker...');
    await mqttClient.connect();

    // Setup event handlers
    mqttClient.on('message', handleMessage);
    mqttClient.on('connected', () => handleMqttStatus('connected'));
    mqttClient.on('disconnected', () => handleMqttStatus('disconnected'));
    mqttClient.on('reconnecting', () => handleMqttStatus('reconnecting'));

    // Record start time
    stats.startTime = Date.now();

    console.log('\n========================================');
    console.log('  MQTT Bridge Service is running!');
    console.log('========================================\n');

    // Print stats periodically
    setInterval(printStats, 60000); // Every minute

    // Setup graceful shutdown
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    console.error('Failed to start MQTT Bridge Service:', err);
    process.exit(1);
  }
}

// Start the service
main();
