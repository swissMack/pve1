/**
 * WebSocket Server - Broadcasts real-time updates to connected frontend clients
 */

const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');
const { config } = require('./config');

class WebSocketBroadcaster {
  constructor() {
    this.server = null;
    this.wss = null;
    this.clients = new Map(); // Map of client -> subscribed device IDs
    this.heartbeatInterval = null;
  }

  /**
   * Start WebSocket server
   */
  start() {
    return new Promise((resolve) => {
      // Create HTTP server for WebSocket and health check
      this.server = http.createServer((req, res) => {
        if (req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'healthy',
            service: 'mqtt-bridge',
            connections: this.clients.size,
            timestamp: new Date().toISOString(),
          }));
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      // Create WebSocket server
      this.wss = new WebSocketServer({
        server: this.server,
        path: config.websocket.path,
      });

      // Handle new connections
      this.wss.on('connection', (ws, req) => {
        this.handleConnection(ws, req);
      });

      // Start HTTP server
      this.server.listen(config.websocket.port, () => {
        console.log(`WebSocket server started on port ${config.websocket.port}`);
        console.log(`WebSocket path: ${config.websocket.path}`);
        console.log(`Health check: http://localhost:${config.websocket.port}/health`);
        resolve();
      });

      // Start heartbeat
      this.startHeartbeat();
    });
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`New WebSocket connection: ${clientId}`);

    // Initialize client subscription state
    this.clients.set(ws, {
      id: clientId,
      subscribedDevices: new Set(),
      subscribeAll: false,
      connectedAt: new Date().toISOString(),
    });

    // Send welcome message
    this.sendToClient(ws, {
      type: 'connected',
      clientId,
      message: 'Connected to MQTT Bridge WebSocket server',
    });

    // Handle incoming messages
    ws.on('message', (data) => {
      this.handleClientMessage(ws, data);
    });

    // Handle client disconnect
    ws.on('close', () => {
      console.log(`WebSocket client disconnected: ${clientId}`);
      this.clients.delete(ws);
    });

    // Handle errors
    ws.on('error', (err) => {
      console.error(`WebSocket error for ${clientId}: ${err.message}`);
    });

    // Setup pong response for heartbeat
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
  }

  /**
   * Handle incoming message from client
   */
  handleClientMessage(ws, data) {
    try {
      const message = JSON.parse(data.toString());
      const clientInfo = this.clients.get(ws);

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(ws, clientInfo, message);
          break;

        case 'unsubscribe':
          this.handleUnsubscribe(ws, clientInfo, message);
          break;

        case 'ping':
          this.sendToClient(ws, { type: 'pong', timestamp: new Date().toISOString() });
          break;

        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (err) {
      console.error(`Failed to parse client message: ${err.message}`);
    }
  }

  /**
   * Handle subscription request
   */
  handleSubscribe(ws, clientInfo, message) {
    const { deviceIds } = message;

    if (deviceIds === '*' || (Array.isArray(deviceIds) && deviceIds.includes('*'))) {
      // Subscribe to all devices
      clientInfo.subscribeAll = true;
      console.log(`Client ${clientInfo.id} subscribed to all devices`);
    } else if (Array.isArray(deviceIds)) {
      // Subscribe to specific devices
      deviceIds.forEach((id) => clientInfo.subscribedDevices.add(id));
      console.log(`Client ${clientInfo.id} subscribed to devices: ${deviceIds.join(', ')}`);
    }

    this.sendToClient(ws, {
      type: 'subscribed',
      deviceIds: clientInfo.subscribeAll ? '*' : Array.from(clientInfo.subscribedDevices),
    });
  }

  /**
   * Handle unsubscription request
   */
  handleUnsubscribe(ws, clientInfo, message) {
    const { deviceIds } = message;

    if (deviceIds === '*') {
      // Unsubscribe from all
      clientInfo.subscribeAll = false;
      clientInfo.subscribedDevices.clear();
    } else if (Array.isArray(deviceIds)) {
      // Unsubscribe from specific devices
      deviceIds.forEach((id) => clientInfo.subscribedDevices.delete(id));
      clientInfo.subscribeAll = false;
    }

    this.sendToClient(ws, {
      type: 'unsubscribed',
      deviceIds,
    });
  }

  /**
   * Broadcast sensor update to subscribed clients
   */
  broadcastSensorUpdate(deviceId, data) {
    const message = {
      type: 'sensor_update',
      deviceId,
      timestamp: new Date().toISOString(),
      data: {
        temperature: data.temperature,
        humidity: data.humidity,
        light: data.light,
        batteryLevel: data.batteryLevel,
        signalStrength: data.signalStrength,
      },
    };

    this.broadcastToSubscribers(deviceId, message);
  }

  /**
   * Broadcast location update to subscribed clients
   */
  broadcastLocationUpdate(deviceId, data) {
    const message = {
      type: 'location_update',
      deviceId,
      timestamp: new Date().toISOString(),
      data: {
        latitude: data.latitude,
        longitude: data.longitude,
        altitude: data.altitude,
        speed: data.speed,
        heading: data.heading,
        accuracy: data.accuracy,
      },
    };

    this.broadcastToSubscribers(deviceId, message);
  }

  /**
   * Broadcast connection status update
   */
  broadcastConnectionStatus(mqttStatus) {
    const message = {
      type: 'connection_status',
      mqtt: mqttStatus,
      timestamp: new Date().toISOString(),
    };

    this.broadcastToAll(message);
  }

  /**
   * Broadcast message to clients subscribed to a specific device
   */
  broadcastToSubscribers(deviceId, message) {
    let sentCount = 0;

    this.clients.forEach((clientInfo, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (clientInfo.subscribeAll || clientInfo.subscribedDevices.has(deviceId)) {
          this.sendToClient(ws, message);
          sentCount++;
        }
      }
    });

    if (sentCount > 0) {
      console.log(`Broadcast ${message.type} for ${deviceId} to ${sentCount} clients`);
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcastToAll(message) {
    this.clients.forEach((clientInfo, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendToClient(ws, message);
      }
    });
  }

  /**
   * Send message to specific client
   */
  sendToClient(ws, message) {
    try {
      ws.send(JSON.stringify(message));
    } catch (err) {
      console.error(`Failed to send message to client: ${err.message}`);
    }
  }

  /**
   * Start heartbeat to detect dead connections
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          console.log('Terminating inactive WebSocket client');
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, config.websocket.heartbeatInterval);
  }

  /**
   * Get current connection stats
   */
  getStats() {
    return {
      totalConnections: this.clients.size,
      clients: Array.from(this.clients.values()).map((c) => ({
        id: c.id,
        subscribedDevices: c.subscribeAll ? '*' : Array.from(c.subscribedDevices),
        connectedAt: c.connectedAt,
      })),
    };
  }

  /**
   * Stop WebSocket server
   */
  stop() {
    return new Promise((resolve) => {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }

      // Close all client connections
      this.wss.clients.forEach((ws) => {
        ws.close(1001, 'Server shutting down');
      });

      this.wss.close(() => {
        this.server.close(() => {
          console.log('WebSocket server stopped');
          resolve();
        });
      });
    });
  }
}

// Export singleton instance
module.exports = new WebSocketBroadcaster();
