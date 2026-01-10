/**
 * WebSocket Service - Connects to MQTT Bridge for real-time device updates
 */

export interface SensorData {
  temperature: number | null;
  humidity: number | null;
  light: number | null;
  batteryLevel: number | null;
  signalStrength: number | null;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
}

export interface SensorUpdateMessage {
  type: 'sensor_update';
  deviceId: string;
  timestamp: string;
  data: SensorData;
}

export interface LocationUpdateMessage {
  type: 'location_update';
  deviceId: string;
  timestamp: string;
  data: LocationData;
}

export interface ConnectionStatusMessage {
  type: 'connection_status';
  mqtt: 'connected' | 'disconnected' | 'reconnecting';
  timestamp: string;
}

export interface ConnectedMessage {
  type: 'connected';
  clientId: string;
  message: string;
}

export interface SubscribedMessage {
  type: 'subscribed';
  deviceIds: string[] | '*';
}

export type WebSocketMessage =
  | SensorUpdateMessage
  | LocationUpdateMessage
  | ConnectionStatusMessage
  | ConnectedMessage
  | SubscribedMessage;

export type MessageHandler = (message: WebSocketMessage) => void;
export type SensorHandler = (deviceId: string, data: SensorData, timestamp: string) => void;
export type LocationHandler = (deviceId: string, data: LocationData, timestamp: string) => void;
export type ConnectionHandler = (status: 'connected' | 'disconnected' | 'reconnecting') => void;

class WebSocketService {
  private socket: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private isIntentionalClose = false;
  private subscribedDevices: Set<string> = new Set();
  private subscribeAll = false;

  // Event handlers
  private onMessageHandlers: Set<MessageHandler> = new Set();
  private onSensorUpdateHandlers: Set<SensorHandler> = new Set();
  private onLocationUpdateHandlers: Set<LocationHandler> = new Set();
  private onConnectionChangeHandlers: Set<ConnectionHandler> = new Set();

  constructor() {
    // Build dynamic WebSocket URL based on current host
    if (import.meta.env.VITE_WEBSOCKET_URL) {
      this.url = import.meta.env.VITE_WEBSOCKET_URL;
      console.log('[WebSocket] Using env URL:', this.url);
    } else {
      // Use same host as the page, with ws/wss protocol
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      this.url = `${protocol}//${host}/ws`;
      console.log('[WebSocket] Using dynamic URL:', this.url);
    }
  }

  /**
   * Connect to WebSocket server
   */
  connect(url?: string): Promise<void> {
    if (url) {
      this.url = url;
    }

    console.log('[WebSocket] Connecting to:', this.url);

    return new Promise((resolve, reject) => {
      try {
        this.isIntentionalClose = false;
        this.socket = new WebSocket(this.url);
        console.log('[WebSocket] WebSocket object created');

        this.socket.onopen = () => {
          console.log('WebSocket connected to MQTT Bridge');
          this.reconnectAttempts = 0;
          this.notifyConnectionChange('connected');

          // Re-subscribe to previously subscribed devices
          this.resubscribe();
          resolve();
        };

        this.socket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.socket.onclose = (event) => {
          console.log(`WebSocket closed: ${event.code} - ${event.reason}`);
          this.notifyConnectionChange('disconnected');

          if (!this.isIntentionalClose) {
            this.attemptReconnect();
          }
        };

        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);

      // Notify generic handlers
      this.onMessageHandlers.forEach((handler) => handler(message));

      // Notify type-specific handlers
      switch (message.type) {
        case 'sensor_update':
          this.onSensorUpdateHandlers.forEach((handler) =>
            handler(message.deviceId, message.data, message.timestamp)
          );
          break;

        case 'location_update':
          this.onLocationUpdateHandlers.forEach((handler) =>
            handler(message.deviceId, message.data, message.timestamp)
          );
          break;

        case 'connection_status':
          this.notifyConnectionChange(message.mqtt);
          break;

        case 'connected':
          console.log(`Connected to MQTT Bridge as ${message.clientId}`);
          break;

        case 'subscribed':
          console.log(`Subscribed to devices: ${JSON.stringify(message.deviceIds)}`);
          break;
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  }

  /**
   * Subscribe to device updates
   */
  subscribe(deviceIds: string[] | '*'): void {
    if (deviceIds === '*') {
      this.subscribeAll = true;
      this.subscribedDevices.clear();
    } else {
      deviceIds.forEach((id) => this.subscribedDevices.add(id));
    }

    if (this.isConnected()) {
      this.send({
        type: 'subscribe',
        deviceIds,
      });
    }
  }

  /**
   * Unsubscribe from device updates
   */
  unsubscribe(deviceIds: string[] | '*'): void {
    if (deviceIds === '*') {
      this.subscribeAll = false;
      this.subscribedDevices.clear();
    } else {
      deviceIds.forEach((id) => this.subscribedDevices.delete(id));
    }

    if (this.isConnected()) {
      this.send({
        type: 'unsubscribe',
        deviceIds,
      });
    }
  }

  /**
   * Re-subscribe after reconnection
   */
  private resubscribe(): void {
    if (this.subscribeAll) {
      this.subscribe('*');
    } else if (this.subscribedDevices.size > 0) {
      this.subscribe(Array.from(this.subscribedDevices));
    }
  }

  /**
   * Send message to server
   */
  private send(message: object): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    this.notifyConnectionChange('reconnecting');

    setTimeout(() => {
      this.connect().catch((err) => {
        console.error('Reconnection failed:', err);
      });
    }, delay);
  }

  /**
   * Notify connection change handlers
   */
  private notifyConnectionChange(status: 'connected' | 'disconnected' | 'reconnecting'): void {
    this.onConnectionChangeHandlers.forEach((handler) => handler(status));
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Register message handler
   */
  onMessage(handler: MessageHandler): () => void {
    this.onMessageHandlers.add(handler);
    return () => this.onMessageHandlers.delete(handler);
  }

  /**
   * Register sensor update handler
   */
  onSensorUpdate(handler: SensorHandler): () => void {
    this.onSensorUpdateHandlers.add(handler);
    return () => this.onSensorUpdateHandlers.delete(handler);
  }

  /**
   * Register location update handler
   */
  onLocationUpdate(handler: LocationHandler): () => void {
    this.onLocationUpdateHandlers.add(handler);
    return () => this.onLocationUpdateHandlers.delete(handler);
  }

  /**
   * Register connection change handler
   */
  onConnectionChange(handler: ConnectionHandler): () => void {
    this.onConnectionChangeHandlers.add(handler);
    return () => this.onConnectionChangeHandlers.delete(handler);
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    this.isIntentionalClose = true;
    if (this.socket) {
      this.socket.close(1000, 'Client disconnecting');
      this.socket = null;
    }
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean; subscribedDevices: string[]; subscribeAll: boolean } {
    return {
      connected: this.isConnected(),
      subscribedDevices: Array.from(this.subscribedDevices),
      subscribeAll: this.subscribeAll,
    };
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
export default websocketService;
