/**
 * MQTT Client - Handles connection to MQTT broker and message subscription
 */

const mqtt = require('mqtt');
const fs = require('fs');
const { EventEmitter } = require('events');
const { config, getSubscriptionTopics } = require('./config');

class MqttClient extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.isConnected = false;
    this.subscribedTopics = [];
  }

  /**
   * Connect to MQTT broker
   */
  async connect() {
    return new Promise((resolve, reject) => {
      const options = {
        clientId: config.mqtt.clientId,
        reconnectPeriod: config.mqtt.reconnectPeriod,
        connectTimeout: config.mqtt.connectTimeout,
        clean: true,
      };

      // Add authentication if provided
      if (config.mqtt.username) {
        options.username = config.mqtt.username;
        options.password = config.mqtt.password;
      }

      // Add TLS configuration if enabled
      if (config.mqtt.useTls && config.mqtt.caCertPath) {
        try {
          options.ca = fs.readFileSync(config.mqtt.caCertPath);
          options.rejectUnauthorized = true;
        } catch (err) {
          console.error(`Failed to read CA certificate: ${err.message}`);
        }
      }

      console.log(`Connecting to MQTT broker: ${config.mqtt.brokerUrl}`);
      this.client = mqtt.connect(config.mqtt.brokerUrl, options);

      // Connection successful
      this.client.on('connect', () => {
        console.log('Connected to MQTT broker');
        this.isConnected = true;
        this.emit('connected');
        this.subscribeToTopics();
        resolve();
      });

      // Connection error
      this.client.on('error', (err) => {
        console.error(`MQTT connection error: ${err.message}`);
        this.emit('error', err);
        if (!this.isConnected) {
          reject(err);
        }
      });

      // Disconnection
      this.client.on('close', () => {
        console.log('Disconnected from MQTT broker');
        this.isConnected = false;
        this.emit('disconnected');
      });

      // Reconnection
      this.client.on('reconnect', () => {
        console.log('Reconnecting to MQTT broker...');
        this.emit('reconnecting');
      });

      // Message received
      this.client.on('message', (topic, message) => {
        this.handleMessage(topic, message);
      });

      // Offline
      this.client.on('offline', () => {
        console.log('MQTT client is offline');
        this.isConnected = false;
        this.emit('offline');
      });
    });
  }

  /**
   * Subscribe to device topics
   */
  subscribeToTopics() {
    const topics = getSubscriptionTopics();

    topics.forEach((topic) => {
      this.client.subscribe(topic, { qos: 1 }, (err, granted) => {
        if (err) {
          console.error(`Failed to subscribe to ${topic}: ${err.message}`);
        } else {
          console.log(`Subscribed to topic: ${topic}`);
          this.subscribedTopics.push(topic);
        }
      });
    });
  }

  /**
   * Handle incoming MQTT message
   */
  handleMessage(topic, message) {
    try {
      const payload = message.toString();
      const data = JSON.parse(payload);

      // Extract device ID and message type from topic
      // Topic format: simportal/devices/{device_id}/{type}
      const topicParts = topic.split('/');
      const deviceId = topicParts[topicParts.length - 2];
      const messageType = topicParts[topicParts.length - 1];

      // Emit message event with parsed data
      this.emit('message', {
        topic,
        deviceId,
        messageType,
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`Failed to parse MQTT message: ${err.message}`);
      console.error(`Topic: ${topic}`);
      console.error(`Raw message: ${message.toString().substring(0, 200)}`);
      this.emit('parseError', { topic, message: message.toString(), error: err });
    }
  }

  /**
   * Disconnect from broker
   */
  disconnect() {
    return new Promise((resolve) => {
      if (this.client) {
        this.client.end(true, {}, () => {
          console.log('MQTT client disconnected');
          this.isConnected = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      brokerUrl: config.mqtt.brokerUrl,
      clientId: config.mqtt.clientId,
      subscribedTopics: this.subscribedTopics,
    };
  }

  /**
   * Publish a message (for testing or commands)
   */
  publish(topic, message, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        return reject(new Error('Not connected to MQTT broker'));
      }

      const payload = typeof message === 'string' ? message : JSON.stringify(message);

      this.client.publish(topic, payload, { qos: 1, ...options }, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

// Export singleton instance
module.exports = new MqttClient();
