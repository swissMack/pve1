/**
 * Vue Composable for Real-time Device Data
 * Provides reactive state management for WebSocket device updates
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import websocketService from '../services/websocketService';
import type { SensorData, LocationData } from '../services/websocketService';

export interface RealtimeDeviceState {
  deviceId: string;
  sensors: SensorData | null;
  location: LocationData | null;
  lastSensorUpdate: string | null;
  lastLocationUpdate: string | null;
}

export interface UseRealtimeDeviceDataOptions {
  autoConnect?: boolean;
  subscribeOnMount?: boolean;
}

/**
 * Composable for managing real-time device data
 */
export function useRealtimeDeviceData(
  deviceIds: string[] | '*' = '*',
  options: UseRealtimeDeviceDataOptions = {}
) {
  const { autoConnect = true, subscribeOnMount = true } = options;

  // Connection state
  const isConnected = ref(false);
  const connectionStatus = ref<'connected' | 'disconnected' | 'reconnecting'>('disconnected');

  // Device data state - Map of deviceId -> state
  const deviceStates = ref<Map<string, RealtimeDeviceState>>(new Map());

  // Last update timestamp
  const lastUpdate = ref<string | null>(null);

  // Unsubscribe functions
  let unsubscribeSensor: (() => void) | null = null;
  let unsubscribeLocation: (() => void) | null = null;
  let unsubscribeConnection: (() => void) | null = null;

  /**
   * Get or create device state
   */
  function getOrCreateDeviceState(deviceId: string): RealtimeDeviceState {
    if (!deviceStates.value.has(deviceId)) {
      deviceStates.value.set(deviceId, {
        deviceId,
        sensors: null,
        location: null,
        lastSensorUpdate: null,
        lastLocationUpdate: null,
      });
    }
    return deviceStates.value.get(deviceId)!;
  }

  /**
   * Handle sensor update
   */
  function handleSensorUpdate(deviceId: string, data: SensorData, timestamp: string) {
    const state = getOrCreateDeviceState(deviceId);
    state.sensors = data;
    state.lastSensorUpdate = timestamp;
    lastUpdate.value = timestamp;

    // Trigger reactivity
    deviceStates.value = new Map(deviceStates.value);
  }

  /**
   * Handle location update
   */
  function handleLocationUpdate(deviceId: string, data: LocationData, timestamp: string) {
    const state = getOrCreateDeviceState(deviceId);
    state.location = data;
    state.lastLocationUpdate = timestamp;
    lastUpdate.value = timestamp;

    // Trigger reactivity
    deviceStates.value = new Map(deviceStates.value);
  }

  /**
   * Handle connection status change
   */
  function handleConnectionChange(status: 'connected' | 'disconnected' | 'reconnecting') {
    connectionStatus.value = status;
    isConnected.value = status === 'connected';
  }

  /**
   * Connect to WebSocket server
   */
  async function connect() {
    try {
      await websocketService.connect();

      // Subscribe to updates
      unsubscribeSensor = websocketService.onSensorUpdate(handleSensorUpdate);
      unsubscribeLocation = websocketService.onLocationUpdate(handleLocationUpdate);
      unsubscribeConnection = websocketService.onConnectionChange(handleConnectionChange);

      isConnected.value = true;
      connectionStatus.value = 'connected';

      // Subscribe to devices
      if (subscribeOnMount) {
        websocketService.subscribe(deviceIds);
      }
    } catch (err) {
      console.error('Failed to connect to WebSocket:', err);
      isConnected.value = false;
      connectionStatus.value = 'disconnected';
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  function disconnect() {
    if (unsubscribeSensor) unsubscribeSensor();
    if (unsubscribeLocation) unsubscribeLocation();
    if (unsubscribeConnection) unsubscribeConnection();

    websocketService.disconnect();
    isConnected.value = false;
    connectionStatus.value = 'disconnected';
  }

  /**
   * Subscribe to specific devices
   */
  function subscribe(ids: string[] | '*') {
    websocketService.subscribe(ids);
  }

  /**
   * Unsubscribe from devices
   */
  function unsubscribe(ids: string[] | '*') {
    websocketService.unsubscribe(ids);
  }

  /**
   * Get state for a specific device
   */
  function getDeviceState(deviceId: string): RealtimeDeviceState | undefined {
    return deviceStates.value.get(deviceId);
  }

  /**
   * Get all device states as array
   */
  const allDeviceStates = computed(() => Array.from(deviceStates.value.values()));

  /**
   * Get sensor data for a specific device
   */
  function getSensorData(deviceId: string): SensorData | null {
    return deviceStates.value.get(deviceId)?.sensors ?? null;
  }

  /**
   * Get location data for a specific device
   */
  function getLocationData(deviceId: string): LocationData | null {
    return deviceStates.value.get(deviceId)?.location ?? null;
  }

  // Lifecycle hooks
  onMounted(() => {
    if (autoConnect) {
      connect();
    }
  });

  onUnmounted(() => {
    disconnect();
  });

  return {
    // State
    isConnected,
    connectionStatus,
    deviceStates,
    allDeviceStates,
    lastUpdate,

    // Methods
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    getDeviceState,
    getSensorData,
    getLocationData,
  };
}

/**
 * Composable for a single device's real-time data
 */
export function useRealtimeDevice(deviceId: string, options: UseRealtimeDeviceDataOptions = {}) {
  const {
    isConnected,
    connectionStatus,
    lastUpdate,
    connect,
    disconnect,
    getDeviceState,
    getSensorData,
    getLocationData,
  } = useRealtimeDeviceData([deviceId], options);

  // Computed for single device
  const sensorData = computed(() => getSensorData(deviceId));
  const locationData = computed(() => getLocationData(deviceId));
  const deviceState = computed(() => getDeviceState(deviceId));

  return {
    isConnected,
    connectionStatus,
    sensorData,
    locationData,
    deviceState,
    lastUpdate,
    connect,
    disconnect,
  };
}

export default useRealtimeDeviceData;
