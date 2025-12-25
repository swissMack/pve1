export interface Device {
  id: string
  name: string
  status: 'Active' | 'Inactive' | 'Maintenance' | 'Offline'
  simCard: string
  deviceType: string
  location: string
  lastSeen: string
  signalStrength: number
  dataUsage: string
  connectionType: '4G' | '5G' | '3G' | 'WiFi'
  test1?: 'value1' | 'value2'
  // Additional database fields
  firmwareVersion?: string | null
  hardwareVersion?: string | null
  serialNumber?: string | null
  manufacturer?: string | null
  model?: string | null
  notes?: string | null
  description?: string | null
  isActive?: boolean | null
  createdAt?: string
  updatedAt?: string
  // Location and Journey Tracking (Map Visualization)
  latitude?: number | null
  longitude?: number | null
  // Sensor Data and Environmental Metrics
  temperature?: number | null
  humidity?: number | null
  light?: number | null
  sensorSamplingInterval?: number | null  // Sampling interval in minutes
  // Device Status and Health Indicators
  healthStatus?: 'healthy' | 'warning' | 'critical' | 'unknown' | null
  batteryLevel?: number | null
  securityStatus?: 'secure' | 'vulnerable' | 'compromised' | 'unknown' | null
  // Technical Metadata and Documentation
  assetManagementUrl?: string | null
  supplierDeviceUrl?: string | null
  userManualUrl?: string | null
  specificationBase64?: string | null
}

export interface SIMCard {
  id: string
  iccid: string
  msisdn: string
  status: 'Active' | 'Inactive' | 'Suspended' | 'Terminated'
  carrier: string
  plan: string
  dataUsed: string
  dataLimit: string
  activationDate: string
  expiryDate: string
}

export const mockDevices: Device[] = [
  {
    id: 'DEV001',
    name: 'IoT Sensor Alpha',
    status: 'Active',
    simCard: 'SIM001',
    deviceType: 'Temperature Sensor',
    location: 'Zurich Warehouse',
    lastSeen: '2024-01-15 14:30:22',
    signalStrength: 85,
    dataUsage: '2.4 MB',
    connectionType: '4G',
    test1: 'value1',
    description: 'High-precision temperature monitoring sensor for cold storage applications. Monitors ambient temperature and humidity levels with real-time alerting capabilities.',
    latitude: 47.3769,
    longitude: 8.5417,
    temperature: -2.5,
    humidity: 65,
    light: 125,
    healthStatus: 'healthy',
    batteryLevel: 85,
    securityStatus: 'secure',
    assetManagementUrl: 'https://example.com/assets/DEV001',
    supplierDeviceUrl: 'https://supplier.com/devices/iot-sensor-alpha',
    userManualUrl: 'https://docs.example.com/manuals/iot-sensor-alpha.pdf'
  },
  {
    id: 'DEV002',
    name: 'Smart Gateway Beta',
    status: 'Active',
    simCard: 'SIM002',
    deviceType: 'Gateway',
    location: 'Geneva Office',
    lastSeen: '2024-01-15 14:29:15',
    signalStrength: 92,
    dataUsage: '15.7 MB',
    connectionType: '5G',
    test1: 'value2',
    description: 'Central communication hub connecting multiple IoT devices to the network. Supports advanced routing protocols and edge computing capabilities for real-time data processing.',
    latitude: 46.2044,
    longitude: 6.1432,
    temperature: 22.5,
    humidity: 45,
    light: 450,
    healthStatus: 'healthy',
    batteryLevel: 92,
    securityStatus: 'secure',
    assetManagementUrl: 'https://example.com/assets/DEV002',
    supplierDeviceUrl: 'https://supplier.com/devices/smart-gateway-beta',
    userManualUrl: 'https://docs.example.com/manuals/smart-gateway-beta.pdf'
  },
  {
    id: 'DEV003',
    name: 'Vehicle Tracker Gamma',
    status: 'Offline',
    simCard: 'SIM003',
    deviceType: 'GPS Tracker',
    location: 'Basel Fleet Depot',
    lastSeen: '2024-01-15 12:45:33',
    signalStrength: 0,
    dataUsage: '8.3 MB',
    connectionType: '4G',
    test1: 'value1',
    description: 'Fleet vehicle tracking device with GPS positioning and route optimization. Provides real-time location data, speed monitoring, and geofencing alerts for commercial vehicle management.',
    latitude: 47.5596,
    longitude: 7.5886,
    temperature: 18.2,
    humidity: 55,
    light: 0,
    healthStatus: 'critical',
    batteryLevel: 15,
    securityStatus: 'unknown',
    assetManagementUrl: 'https://example.com/assets/DEV003',
    supplierDeviceUrl: 'https://supplier.com/devices/vehicle-tracker-gamma',
    userManualUrl: 'https://docs.example.com/manuals/vehicle-tracker-gamma.pdf'
  },
  {
    id: 'DEV004',
    name: 'Security Camera Delta',
    status: 'Active',
    simCard: 'SIM004',
    deviceType: 'IP Camera',
    location: 'Bern Entrance Gate',
    lastSeen: '2024-01-15 14:31:05',
    signalStrength: 78,
    dataUsage: '45.2 MB',
    connectionType: '4G',
    test1: 'value2',
    description: 'High-definition security camera with night vision and motion detection. Streams live video feed to security monitoring center with automatic incident recording and alert notifications.',
    latitude: 46.9480,
    longitude: 7.4474,
    temperature: 25.1,
    humidity: 40,
    light: 320,
    healthStatus: 'healthy',
    batteryLevel: 78,
    securityStatus: 'secure',
    assetManagementUrl: 'https://example.com/assets/DEV004',
    supplierDeviceUrl: 'https://supplier.com/devices/security-camera-delta',
    userManualUrl: 'https://docs.example.com/manuals/security-camera-delta.pdf'
  },
  {
    id: 'DEV005',
    name: 'Environmental Monitor Epsilon',
    status: 'Maintenance',
    simCard: 'SIM005',
    deviceType: 'Environmental Sensor',
    location: 'Lausanne Data Center',
    lastSeen: '2024-01-15 09:15:44',
    signalStrength: 65,
    dataUsage: '1.8 MB',
    connectionType: '3G',
    test1: 'value1',
    description: 'Multi-parameter environmental monitoring system for data center climate control. Tracks temperature, humidity, air quality, and power consumption with predictive maintenance alerts.',
    latitude: 46.5197,
    longitude: 6.6323,
    temperature: 20.8,
    humidity: 35,
    light: 280,
    healthStatus: 'warning',
    batteryLevel: 45,
    securityStatus: 'secure',
    assetManagementUrl: 'https://example.com/assets/DEV005',
    supplierDeviceUrl: 'https://supplier.com/devices/environmental-monitor-epsilon',
    userManualUrl: 'https://docs.example.com/manuals/environmental-monitor-epsilon.pdf'
  },
  {
    id: 'DEV006',
    name: 'Smart Meter Zeta',
    status: 'Active',
    simCard: 'SIM006',
    deviceType: 'Utility Meter',
    location: 'Lucerne Building 12',
    lastSeen: '2024-01-15 14:28:12',
    signalStrength: 88,
    dataUsage: '3.6 MB',
    connectionType: '4G',
    test1: 'value2',
    description: 'Advanced utility meter for accurate electricity consumption monitoring. Supports time-of-use billing, demand response programs, and automated meter reading with tamper detection.',
    latitude: 47.0502,
    longitude: 8.3093,
    temperature: 23.5,
    humidity: 50,
    light: 150,
    healthStatus: 'healthy',
    batteryLevel: 88,
    securityStatus: 'secure',
    assetManagementUrl: 'https://example.com/assets/DEV006',
    supplierDeviceUrl: 'https://supplier.com/devices/smart-meter-zeta',
    userManualUrl: 'https://docs.example.com/manuals/smart-meter-zeta.pdf'
  },
  {
    id: 'DEV007',
    name: 'Asset Tracker Eta',
    status: 'Inactive',
    simCard: 'SIM007',
    deviceType: 'Asset Tracker',
    location: 'St. Gallen Storage',
    lastSeen: '2024-01-14 16:22:18',
    signalStrength: 0,
    dataUsage: '0.9 MB',
    connectionType: '4G',
    test1: 'value1',
    description: 'Compact asset tracking device for inventory management and theft prevention. Provides location tracking, movement alerts, and battery status monitoring for valuable equipment.',
    latitude: 47.4245,
    longitude: 9.3767,
    temperature: 19.5,
    humidity: 60,
    light: 75,
    healthStatus: 'unknown',
    batteryLevel: 0,
    securityStatus: 'unknown',
    assetManagementUrl: 'https://example.com/assets/DEV007',
    supplierDeviceUrl: 'https://supplier.com/devices/asset-tracker-eta',
    userManualUrl: 'https://docs.example.com/manuals/asset-tracker-eta.pdf'
  },
  {
    id: 'DEV008',
    name: 'Industrial Controller Theta',
    status: 'Active',
    simCard: 'SIM008',
    deviceType: 'PLC Controller',
    location: 'Lugano Factory',
    lastSeen: '2024-01-15 14:30:45',
    signalStrength: 91,
    dataUsage: '12.4 MB',
    connectionType: '5G',
    test1: 'value2',
    description: 'Programmable logic controller for industrial automation and process control. Manages production line operations, quality control systems, and integrates with enterprise resource planning software.',
    latitude: 46.0037,
    longitude: 8.9511,
    temperature: 28.2,
    humidity: 42,
    light: 520,
    healthStatus: 'healthy',
    batteryLevel: 91,
    securityStatus: 'secure',
    assetManagementUrl: 'https://example.com/assets/DEV008',
    supplierDeviceUrl: 'https://supplier.com/devices/industrial-controller-theta',
    userManualUrl: 'https://docs.example.com/manuals/industrial-controller-theta.pdf'
  }
]

export const mockSIMCards: SIMCard[] = [
  {
    id: 'SIM001',
    iccid: '8901234567890123456',
    msisdn: '+1234567890',
    status: 'Active',
    carrier: 'Global Wireless',
    plan: 'IoT Basic 10MB',
    dataUsed: '2.4 MB',
    dataLimit: '10 MB',
    activationDate: '2023-12-01',
    expiryDate: '2024-12-01'
  },
  {
    id: 'SIM002',
    iccid: '8901234567890123457',
    msisdn: '+1234567891',
    status: 'Active',
    carrier: 'TechConnect',
    plan: 'Enterprise 100MB',
    dataUsed: '15.7 MB',
    dataLimit: '100 MB',
    activationDate: '2023-11-15',
    expiryDate: '2024-11-15'
  },
  {
    id: 'SIM003',
    iccid: '8901234567890123458',
    msisdn: '+1234567892',
    status: 'Active',
    carrier: 'MobileNet',
    plan: 'Fleet Tracker 50MB',
    dataUsed: '8.3 MB',
    dataLimit: '50 MB',
    activationDate: '2023-10-20',
    expiryDate: '2024-10-20'
  },
  {
    id: 'SIM004',
    iccid: '8901234567890123459',
    msisdn: '+1234567893',
    status: 'Active',
    carrier: 'SecureLink',
    plan: 'Security Pro 200MB',
    dataUsed: '45.2 MB',
    dataLimit: '200 MB',
    activationDate: '2023-09-10',
    expiryDate: '2024-09-10'
  },
  {
    id: 'SIM005',
    iccid: '8901234567890123460',
    msisdn: '+1234567894',
    status: 'Suspended',
    carrier: 'DataFlow',
    plan: 'Environmental 25MB',
    dataUsed: '1.8 MB',
    dataLimit: '25 MB',
    activationDate: '2023-08-05',
    expiryDate: '2024-08-05'
  },
  {
    id: 'SIM006',
    iccid: '8901234567890123461',
    msisdn: '+1234567895',
    status: 'Active',
    carrier: 'UtilityConnect',
    plan: 'Smart Meter 15MB',
    dataUsed: '3.6 MB',
    dataLimit: '15 MB',
    activationDate: '2023-07-12',
    expiryDate: '2024-07-12'
  },
  {
    id: 'SIM007',
    iccid: '8901234567890123462',
    msisdn: '+1234567896',
    status: 'Inactive',
    carrier: 'AssetTrack',
    plan: 'Asset Basic 5MB',
    dataUsed: '0.9 MB',
    dataLimit: '5 MB',
    activationDate: '2023-06-18',
    expiryDate: '2024-06-18'
  },
  {
    id: 'SIM008',
    iccid: '8901234567890123463',
    msisdn: '+1234567897',
    status: 'Active',
    carrier: 'IndustrialNet',
    plan: 'Industrial Pro 500MB',
    dataUsed: '12.4 MB',
    dataLimit: '500 MB',
    activationDate: '2023-05-25',
    expiryDate: '2024-05-25'
  },
  {
    id: 'SIM009',
    iccid: '8901234567890123464',
    msisdn: '+1234567898',
    status: 'Terminated',
    carrier: 'Legacy Wireless',
    plan: 'Standard 20MB',
    dataUsed: '0 MB',
    dataLimit: '20 MB',
    activationDate: '2023-01-10',
    expiryDate: '2024-01-10'
  },
  {
    id: 'SIM010',
    iccid: '8901234567890123465',
    msisdn: '+1234567899',
    status: 'Active',
    carrier: 'NextGen Mobile',
    plan: 'Premium 1GB',
    dataUsed: '234.5 MB',
    dataLimit: '1024 MB',
    activationDate: '2023-04-03',
    expiryDate: '2024-04-03'
  }
]