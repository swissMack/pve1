/**
 * Message Parser - Validates and parses incoming MQTT messages
 */

/**
 * Validate sensor data message
 * Expected format:
 * {
 *   timestamp: "2024-01-15T14:30:22.000Z",
 *   deviceId: "DEV001",
 *   sensors: {
 *     temperature: 22.5,
 *     humidity: 65.0,
 *     light: 450,
 *     batteryLevel: 85
 *   },
 *   metadata: { signalStrength: 78 }
 * }
 */
function validateSensorMessage(data) {
  const errors = [];

  // Required fields
  if (!data.deviceId || typeof data.deviceId !== 'string') {
    errors.push('deviceId is required and must be a string');
  }

  if (!data.sensors || typeof data.sensors !== 'object') {
    errors.push('sensors object is required');
  }

  // Validate sensor values if present
  if (data.sensors) {
    if (data.sensors.temperature !== undefined) {
      if (typeof data.sensors.temperature !== 'number' || data.sensors.temperature < -50 || data.sensors.temperature > 100) {
        errors.push('temperature must be a number between -50 and 100');
      }
    }

    if (data.sensors.humidity !== undefined) {
      if (typeof data.sensors.humidity !== 'number' || data.sensors.humidity < 0 || data.sensors.humidity > 100) {
        errors.push('humidity must be a number between 0 and 100');
      }
    }

    if (data.sensors.light !== undefined) {
      if (typeof data.sensors.light !== 'number' || data.sensors.light < 0 || data.sensors.light > 200000) {
        errors.push('light must be a number between 0 and 200000');
      }
    }

    if (data.sensors.batteryLevel !== undefined) {
      if (typeof data.sensors.batteryLevel !== 'number' || data.sensors.batteryLevel < 0 || data.sensors.batteryLevel > 100) {
        errors.push('batteryLevel must be a number between 0 and 100');
      }
    }
  }

  // Validate metadata if present
  if (data.metadata && data.metadata.signalStrength !== undefined) {
    if (typeof data.metadata.signalStrength !== 'number' || data.metadata.signalStrength < 0 || data.metadata.signalStrength > 100) {
      errors.push('signalStrength must be a number between 0 and 100');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate location data message
 * Expected format:
 * {
 *   timestamp: "2024-01-15T14:30:22.000Z",
 *   deviceId: "DEV003",
 *   location: {
 *     latitude: 47.3769,
 *     longitude: 8.5417,
 *     altitude: 408.5,
 *     accuracy: 5.2,
 *     speed: 45.5,
 *     heading: 180.0
 *   },
 *   source: "gps",
 *   metadata: { batteryLevel: 72, signalStrength: 88 }
 * }
 */
function validateLocationMessage(data) {
  const errors = [];

  // Required fields
  if (!data.deviceId || typeof data.deviceId !== 'string') {
    errors.push('deviceId is required and must be a string');
  }

  if (!data.location || typeof data.location !== 'object') {
    errors.push('location object is required');
  }

  // Validate location fields
  if (data.location) {
    if (data.location.latitude === undefined || typeof data.location.latitude !== 'number') {
      errors.push('latitude is required and must be a number');
    } else if (data.location.latitude < -90 || data.location.latitude > 90) {
      errors.push('latitude must be between -90 and 90');
    }

    if (data.location.longitude === undefined || typeof data.location.longitude !== 'number') {
      errors.push('longitude is required and must be a number');
    } else if (data.location.longitude < -180 || data.location.longitude > 180) {
      errors.push('longitude must be between -180 and 180');
    }

    if (data.location.altitude !== undefined && typeof data.location.altitude !== 'number') {
      errors.push('altitude must be a number');
    }

    if (data.location.accuracy !== undefined) {
      if (typeof data.location.accuracy !== 'number' || data.location.accuracy < 0) {
        errors.push('accuracy must be a non-negative number');
      }
    }

    if (data.location.speed !== undefined) {
      if (typeof data.location.speed !== 'number' || data.location.speed < 0) {
        errors.push('speed must be a non-negative number');
      }
    }

    if (data.location.heading !== undefined) {
      if (typeof data.location.heading !== 'number' || data.location.heading < 0 || data.location.heading > 360) {
        errors.push('heading must be a number between 0 and 360');
      }
    }
  }

  // Validate source if present
  if (data.source !== undefined) {
    const validSources = ['gps', 'cell_tower', 'wifi', 'manual'];
    if (!validSources.includes(data.source)) {
      errors.push(`source must be one of: ${validSources.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Parse sensor message into database format
 */
function parseSensorMessage(data, deviceId) {
  const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();

  return {
    deviceId: data.deviceId || deviceId,
    temperature: data.sensors?.temperature ?? null,
    humidity: data.sensors?.humidity ?? null,
    light: data.sensors?.light ?? null,
    batteryLevel: data.sensors?.batteryLevel ?? data.metadata?.batteryLevel ?? null,
    signalStrength: data.metadata?.signalStrength ?? null,
    recordedAt: timestamp,
    metadata: data.metadata || {},
  };
}

/**
 * Parse location message into database format
 */
function parseLocationMessage(data, deviceId) {
  const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();

  return {
    deviceId: data.deviceId || deviceId,
    latitude: data.location.latitude,
    longitude: data.location.longitude,
    altitude: data.location.altitude ?? null,
    accuracy: data.location.accuracy ?? null,
    speed: data.location.speed ?? null,
    heading: data.location.heading ?? null,
    locationSource: data.source || 'mqtt',
    batteryLevel: data.metadata?.batteryLevel ?? null,
    signalStrength: data.metadata?.signalStrength ?? null,
    recordedAt: timestamp,
    metadata: data.metadata || {},
  };
}

/**
 * Process incoming message based on type
 */
function processMessage(messageType, data, deviceId) {
  let validation;
  let parsed;

  switch (messageType) {
    case 'sensors':
      validation = validateSensorMessage(data);
      if (validation.valid) {
        parsed = parseSensorMessage(data, deviceId);
      }
      break;

    case 'location':
      validation = validateLocationMessage(data);
      if (validation.valid) {
        parsed = parseLocationMessage(data, deviceId);
      }
      break;

    default:
      return {
        valid: false,
        errors: [`Unknown message type: ${messageType}`],
        parsed: null,
        messageType,
      };
  }

  return {
    valid: validation.valid,
    errors: validation.errors,
    parsed,
    messageType,
  };
}

module.exports = {
  validateSensorMessage,
  validateLocationMessage,
  parseSensorMessage,
  parseLocationMessage,
  processMessage,
};
