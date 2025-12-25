/**
 * Configuration loader for MQTT Bridge Service
 * Loads settings from environment variables with sensible defaults
 */

const config = {
  // MQTT Broker Configuration
  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    username: process.env.MQTT_USERNAME || '',
    password: process.env.MQTT_PASSWORD || '',
    clientId: process.env.MQTT_CLIENT_ID || `simcard-portal-bridge-${Date.now()}`,
    useTls: process.env.MQTT_USE_TLS === 'true',
    caCertPath: process.env.MQTT_CA_CERT_PATH || '',
    topicPrefix: process.env.MQTT_TOPIC_PREFIX || 'simportal/devices',

    // Reconnection settings
    reconnectPeriod: parseInt(process.env.MQTT_RECONNECT_PERIOD || '5000', 10),
    connectTimeout: parseInt(process.env.MQTT_CONNECT_TIMEOUT || '30000', 10),
  },

  // WebSocket Server Configuration
  websocket: {
    port: parseInt(process.env.WEBSOCKET_PORT || '3002', 10),
    path: process.env.WEBSOCKET_PATH || '/ws',

    // Heartbeat settings
    heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000', 10),
  },

  // Database Configuration (PostgreSQL / Supabase)
  database: {
    // Prefer DATABASE_URL for Supabase compatibility
    connectionString: process.env.DATABASE_URL || null,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'simportal',
    password: process.env.DB_PASSWORD, // No default - must be set via env
    database: process.env.DB_NAME || 'simcardportal',

    // Connection pool settings
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
  },

  // Service Configuration
  service: {
    name: 'mqtt-bridge',
    healthCheckPort: parseInt(process.env.HEALTH_CHECK_PORT || '3002', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
  },
};

/**
 * Validate required configuration
 */
function validateConfig() {
  const errors = [];

  if (!config.mqtt.brokerUrl) {
    errors.push('MQTT_BROKER_URL is required');
  }

  if (config.mqtt.useTls && !config.mqtt.caCertPath) {
    console.warn('Warning: MQTT_USE_TLS is enabled but MQTT_CA_CERT_PATH is not set');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }

  return true;
}

/**
 * Get MQTT topics to subscribe to
 */
function getSubscriptionTopics() {
  const prefix = config.mqtt.topicPrefix;
  return [
    `${prefix}/+/sensors`,   // All device sensor data
    `${prefix}/+/location`,  // All device location data
  ];
}

/**
 * Log configuration (masking sensitive values)
 */
function logConfig() {
  console.log('=== MQTT Bridge Configuration ===');
  console.log(`MQTT Broker: ${config.mqtt.brokerUrl}`);
  console.log(`MQTT Client ID: ${config.mqtt.clientId}`);
  console.log(`MQTT TLS: ${config.mqtt.useTls}`);
  console.log(`MQTT Topics: ${getSubscriptionTopics().join(', ')}`);
  console.log(`WebSocket Port: ${config.websocket.port}`);

  // Supabase configuration
  const supabaseConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log(`Supabase Configured: ${supabaseConfigured}`);
  if (supabaseConfigured) {
    console.log(`Supabase URL: ${process.env.SUPABASE_URL}`);
  } else {
    console.log(`Database Host: ${config.database.host}:${config.database.port}`);
    console.log(`Database Name: ${config.database.database}`);
  }
  console.log('================================');
}

module.exports = {
  config,
  validateConfig,
  getSubscriptionTopics,
  logConfig,
};
