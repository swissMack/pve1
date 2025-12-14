/**
 * SIM Card Portal Data Generator
 * Generates realistic IoT telemetry data and publishes to MQTT broker
 */

import mqtt from 'mqtt';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
let sensorInterval = parseInt(process.env.SENSOR_INTERVAL || '10') * 1000; // ms
let locationInterval = parseInt(process.env.LOCATION_INTERVAL || '5') * 1000; // ms
const TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX || 'simportal/devices';

// Interval timers (for dynamic updates)
let sensorTimer = null;
let locationTimer = null;

// Command topics
const COMMAND_TOPICS = [
  `${TOPIC_PREFIX}/+/commands`,
  'simportal/config/#'
];

// Load device configuration
const configPath = join(__dirname, '../../config/simportal-devices.json');
let deviceConfig;
try {
  deviceConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
  console.log(`Loaded ${deviceConfig.devices.length} devices from config`);
} catch (err) {
  console.error('Failed to load device config:', err.message);
  process.exit(1);
}

// Device state storage
const deviceStates = new Map();

// Initialize device states
function initializeDevices() {
  console.log('\nInitializing device states...');

  for (const device of deviceConfig.devices) {
    const state = {
      deviceId: device.device_id,
      name: device.name,
      type: device.type,
      hasSensors: device.has_sensors,
      hasLocation: device.has_location,
      sensorRanges: device.sensor_ranges,
      // Initialize sensor values
      temperature: randomFloat(
        device.sensor_ranges.temperature.min,
        device.sensor_ranges.temperature.max
      ),
      humidity: randomFloat(
        device.sensor_ranges.humidity.min,
        device.sensor_ranges.humidity.max
      ),
      light: randomInt(
        device.sensor_ranges.light.min,
        device.sensor_ranges.light.max
      ),
      battery: randomInt(
        device.sensor_ranges.battery.min,
        device.sensor_ranges.battery.max
      ),
      signalStrength: randomInt(50, 100),
      paused: false,  // For control panel pause/resume
    };

    // Initialize location
    if (device.has_location && device.location_mobile) {
      state.latitude = device.location_mobile.center_latitude;
      state.longitude = device.location_mobile.center_longitude;
      state.centerLat = device.location_mobile.center_latitude;
      state.centerLon = device.location_mobile.center_longitude;
      state.radiusKm = device.location_mobile.radius_km;
      state.speedMax = device.location_mobile.speed_range.max;
      state.heading = randomInt(0, 359);
      state.speed = randomFloat(0, 60);
      state.altitude = randomFloat(300, 500);
    } else if (device.location_static) {
      state.latitude = device.location_static.latitude;
      state.longitude = device.location_static.longitude;
    }

    deviceStates.set(device.device_id, state);
    console.log(`  ${device.device_id}: temp=${state.temperature.toFixed(1)}C, bat=${state.battery}%`);
  }
}

// Utility functions
function randomFloat(min, max) {
  return min + Math.random() * (max - min);
}

function randomInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function varyValue(current, min, max, drift) {
  const change = (Math.random() - 0.5) * drift;
  let newVal = current + change;
  return Math.max(min, Math.min(max, newVal));
}

// Update device sensor values
function updateSensorState(state) {
  const ranges = state.sensorRanges;

  state.temperature = varyValue(
    state.temperature,
    ranges.temperature.min,
    ranges.temperature.max,
    0.5
  );

  state.humidity = varyValue(
    state.humidity,
    ranges.humidity.min,
    ranges.humidity.max,
    2
  );

  state.light = Math.round(varyValue(
    state.light,
    ranges.light.min,
    ranges.light.max,
    50
  ));

  // Battery drains slowly
  if (state.battery > 20 && Math.random() < 0.1) {
    state.battery = Math.max(20, state.battery - 1);
  }

  state.signalStrength = randomInt(50, 100);
}

// Update device location (for mobile devices)
function updateLocationState(state) {
  if (!state.centerLat) return;

  // Vary heading occasionally
  if (Math.random() < 0.2) {
    const headingChange = randomInt(-30, 30);
    state.heading = (state.heading + headingChange + 360) % 360;
  }

  // Vary speed
  state.speed = varyValue(state.speed, 0, state.speedMax, 10);

  // Move based on heading and speed
  const headingRad = (state.heading * Math.PI) / 180;
  const kmPerSecond = state.speed / 3600;
  const latChange = kmPerSecond * 0.009 * Math.cos(headingRad);
  const lonChange = kmPerSecond * 0.009 * Math.sin(headingRad);

  const newLat = state.latitude + latChange;
  const newLon = state.longitude + lonChange;

  // Check if within radius of center
  const distLat = (newLat - state.centerLat) * 111;
  const distLon = (newLon - state.centerLon) * 85;
  const dist = Math.sqrt(distLat * distLat + distLon * distLon);

  if (dist > state.radiusKm) {
    // Bounce back toward center
    state.heading = (state.heading + 180) % 360;
  } else {
    state.latitude = newLat;
    state.longitude = newLon;
  }

  state.altitude = randomFloat(300, 500);
}

// Generate sensor payload
function createSensorPayload(state) {
  return {
    timestamp: new Date().toISOString(),
    deviceId: state.deviceId,
    sensors: {
      temperature: parseFloat(state.temperature.toFixed(1)),
      humidity: parseFloat(state.humidity.toFixed(1)),
      light: state.light,
      batteryLevel: state.battery,
    },
    metadata: {
      signalStrength: state.signalStrength,
    },
  };
}

// Generate location payload
function createLocationPayload(state) {
  return {
    timestamp: new Date().toISOString(),
    deviceId: state.deviceId,
    location: {
      latitude: parseFloat(state.latitude.toFixed(6)),
      longitude: parseFloat(state.longitude.toFixed(6)),
      altitude: parseFloat(state.altitude.toFixed(1)),
      speed: parseFloat(state.speed.toFixed(1)),
      heading: state.heading,
    },
    source: 'gps',
  };
}

// MQTT Client
let client;

// Subscribe to command topics
function subscribeToCommands() {
  COMMAND_TOPICS.forEach(topic => {
    client.subscribe(topic, { qos: 1 }, (err) => {
      if (err) {
        console.error(`Failed to subscribe to ${topic}:`, err.message);
      } else {
        console.log(`Subscribed to command topic: ${topic}`);
      }
    });
  });
}

// Handle incoming commands
function handleCommand(topic, payload) {
  try {
    const msg = JSON.parse(payload.toString());

    if (topic.startsWith('simportal/config/')) {
      handleConfigCommand(msg);
    } else if (topic.includes('/commands')) {
      const parts = topic.split('/');
      const deviceId = parts[2];
      handleDeviceCommand(deviceId, msg);
    }
  } catch (err) {
    console.error('Error handling command:', err.message);
  }
}

// Handle global config commands
function handleConfigCommand(msg) {
  console.log('\n[CONFIG] Received:', msg);

  if (msg.type === 'set_interval') {
    // Update intervals
    if (msg.sensor_interval) {
      sensorInterval = msg.sensor_interval * 1000;
      console.log(`  Sensor interval updated to ${msg.sensor_interval}s`);
    }
    if (msg.location_interval) {
      locationInterval = msg.location_interval * 1000;
      console.log(`  Location interval updated to ${msg.location_interval}s`);
    }

    // Restart timers with new intervals
    restartTimers();
  }
}

// Handle per-device commands
function handleDeviceCommand(deviceId, msg) {
  const state = deviceStates.get(deviceId);
  if (!state) {
    console.error(`Device ${deviceId} not found`);
    return;
  }

  console.log(`\n[COMMAND] ${deviceId}:`, msg);

  switch (msg.type) {
    case 'set_sensor':
      if (msg.field === 'temperature') {
        state.temperature = msg.value;
      } else if (msg.field === 'humidity') {
        state.humidity = msg.value;
      } else if (msg.field === 'battery') {
        state.battery = msg.value;
      } else if (msg.field === 'light') {
        state.light = msg.value;
      }
      console.log(`  Set ${msg.field} = ${msg.value}`);
      break;

    case 'set_location':
      if (state.centerLat) { // Mobile device only
        state.latitude = msg.lat;
        state.longitude = msg.lon;
        console.log(`  Set location: ${msg.lat}, ${msg.lon}`);
      }
      break;

    case 'set_heading':
      if (state.centerLat) {
        state.heading = msg.value;
        console.log(`  Set heading = ${msg.value}`);
      }
      break;

    case 'set_speed':
      if (state.centerLat) {
        state.speed = msg.value;
        console.log(`  Set speed = ${msg.value}`);
      }
      break;

    case 'pause':
      state.paused = true;
      console.log(`  Device paused`);
      publishDeviceStatus(deviceId, state);
      break;

    case 'resume':
      state.paused = false;
      console.log(`  Device resumed`);
      publishDeviceStatus(deviceId, state);
      break;

    case 'reset':
      resetDeviceState(deviceId);
      console.log(`  Device reset to initial values`);
      publishDeviceStatus(deviceId, state);
      break;

    case 'set_sensor_interval':
      // Per-device sensor sampling interval (in seconds)
      state.sensorInterval = msg.value;
      console.log(`  Set sensor interval = ${msg.value}s (${msg.value / 60} min)`);
      publishDeviceStatus(deviceId, state);
      break;
  }
}

// Publish device status (for control panel feedback)
function publishDeviceStatus(deviceId, state) {
  const topic = `${TOPIC_PREFIX}/${deviceId}/status`;
  const payload = {
    deviceId,
    paused: state.paused,
    sensorInterval: state.sensorInterval || sensorInterval / 1000, // Per-device or global interval in seconds
    timestamp: new Date().toISOString()
  };
  client.publish(topic, JSON.stringify(payload), { qos: 1 });
}

// Reset device to initial random values
function resetDeviceState(deviceId) {
  const state = deviceStates.get(deviceId);
  if (!state) return;

  const ranges = state.sensorRanges;
  state.temperature = randomFloat(ranges.temperature.min, ranges.temperature.max);
  state.humidity = randomFloat(ranges.humidity.min, ranges.humidity.max);
  state.light = randomInt(ranges.light.min, ranges.light.max);
  state.battery = randomInt(ranges.battery.min, ranges.battery.max);
  state.signalStrength = randomInt(50, 100);
  state.paused = false;

  if (state.centerLat) {
    state.latitude = state.centerLat;
    state.longitude = state.centerLon;
    state.heading = randomInt(0, 359);
    state.speed = randomFloat(0, 60);
  }
}

// Restart interval timers
function restartTimers() {
  if (sensorTimer) clearInterval(sensorTimer);
  if (locationTimer) clearInterval(locationTimer);

  sensorTimer = setInterval(publishSensors, sensorInterval);
  locationTimer = setInterval(publishLocations, locationInterval);

  console.log(`  Timers restarted: sensors=${sensorInterval/1000}s, location=${locationInterval/1000}s`);
}

function connectMqtt() {
  console.log(`\nConnecting to MQTT broker: ${BROKER_URL}`);

  client = mqtt.connect(BROKER_URL, {
    clientId: `simportal-generator-${Date.now()}`,
    clean: true,
    reconnectPeriod: 5000,
  });

  client.on('connect', () => {
    console.log('Connected to MQTT broker');
    subscribeToCommands();
    startGenerating();
  });

  client.on('message', handleCommand);

  client.on('error', (err) => {
    console.error('MQTT error:', err.message);
  });

  client.on('reconnect', () => {
    console.log('Reconnecting to MQTT broker...');
  });

  client.on('close', () => {
    console.log('MQTT connection closed');
  });
}

// Publishing functions
function publishSensors() {
  const time = new Date().toLocaleTimeString();
  console.log(`\n[${time}] Publishing sensor data...`);

  for (const [deviceId, state] of deviceStates) {
    if (!state.hasSensors) continue;
    if (state.paused) {
      console.log(`  [PAUSED] ${deviceId}`);
      continue;
    }

    updateSensorState(state);
    const payload = createSensorPayload(state);
    const topic = `${TOPIC_PREFIX}/${deviceId}/sensors`;

    client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) {
        console.error(`  [ERROR] ${deviceId}: ${err.message}`);
      } else {
        console.log(`  [SENSOR] ${deviceId}: temp=${payload.sensors.temperature}C, hum=${payload.sensors.humidity}%, bat=${payload.sensors.batteryLevel}%`);
      }
    });
  }
}

function publishLocations() {
  const time = new Date().toLocaleTimeString();

  // Check if any device has mobile location
  let hasAnyMobile = false;
  for (const state of deviceStates.values()) {
    if (state.hasLocation && state.centerLat) {
      hasAnyMobile = true;
      break;
    }
  }

  if (!hasAnyMobile) return;

  console.log(`\n[${time}] Publishing location data...`);

  for (const [deviceId, state] of deviceStates) {
    if (!state.hasLocation || !state.centerLat) continue;
    if (state.paused) continue;

    updateLocationState(state);
    const payload = createLocationPayload(state);
    const topic = `${TOPIC_PREFIX}/${deviceId}/location`;

    client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) {
        console.error(`  [ERROR] ${deviceId}: ${err.message}`);
      } else {
        console.log(`  [LOCATION] ${deviceId}: lat=${payload.location.latitude}, lon=${payload.location.longitude}, speed=${payload.location.speed}km/h`);
      }
    });
  }
}

// Start generating data
function startGenerating() {
  console.log(`\nStarting data generation...`);
  console.log(`  Sensor interval: ${sensorInterval / 1000}s`);
  console.log(`  Location interval: ${locationInterval / 1000}s`);
  console.log('\nPress Ctrl+C to stop\n');

  // Initial publish
  publishSensors();
  publishLocations();

  // Set up intervals (store references for dynamic updates)
  sensorTimer = setInterval(publishSensors, sensorInterval);
  locationTimer = setInterval(publishLocations, locationInterval);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down...');
  if (client) {
    client.end(true, () => {
      console.log('MQTT disconnected');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGTERM', () => {
  console.log('\n\nShutting down...');
  if (client) {
    client.end(true, () => {
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// Main
console.log('=== SIM Card Portal Data Generator ===');
console.log(`Topic prefix: ${TOPIC_PREFIX}`);
initializeDevices();
connectMqtt();
