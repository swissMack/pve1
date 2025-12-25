import { type Device, type SIMCard, mockDevices, mockSIMCards } from './mockData'

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export class DataService {
  private baseUrl: string
  private useApi: boolean

  constructor() {
    // Check if we're in development or if API is available
    this.baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : import.meta.env.VERCEL_URL 
        ? `https://${import.meta.env.VERCEL_URL}` 
        : 'http://localhost:5173'
    
    // Use API in production, fallback to mock data in development
    this.useApi = import.meta.env.NODE_ENV === 'production' || 
                  import.meta.env.VITE_USE_API === 'true'
    
    // Debug logging
    console.log('DataService initialized:', {
      baseUrl: this.baseUrl,
      useApi: this.useApi,
      NODE_ENV: import.meta.env.NODE_ENV,
      VITE_USE_API: import.meta.env.VITE_USE_API
    })
  }

  // Device methods
  async getDevices(): Promise<Device[]> {
    console.log('getDevices called, useApi:', this.useApi, 'baseUrl:', this.baseUrl)
    
    if (!this.useApi) {
      console.log('Using mock data (useApi = false)')
      return Promise.resolve(mockDevices)
    }

    try {
      const url = `${this.baseUrl}/api/devices`
      console.log('Fetching from URL:', url)
      
      const response = await fetch(url)
      console.log('Response status:', response.status, 'Content-Type:', response.headers.get('content-type'))
      
      const responseText = await response.text()
      console.log('Raw response (first 200 chars):', responseText.substring(0, 200))
      
      const result: ApiResponse<Device[]> = JSON.parse(responseText)
      
      if (result.success && result.data) {
        console.log('API success, got', result.data.length, 'devices')
        return result.data
      } else {
        console.warn('API call failed, falling back to mock data:', result.error)
        return mockDevices
      }
    } catch (error) {
      console.warn('API call failed, falling back to mock data:', error)
      return mockDevices
    }
  }

  async getDevice(id: string): Promise<Device | null> {
    if (!this.useApi) {
      // Find device in mock data
      return Promise.resolve(mockDevices.find(device => device.id === id) || null)
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/devices?id=${id}`)
      const result: ApiResponse<Device> = await response.json()
      return result.success && result.data ? result.data : null
    } catch (error) {
      console.error('Failed to fetch device:', error)
      // Fallback to mock data
      return mockDevices.find(device => device.id === id) || null
    }
  }

  async createDevice(device: Partial<Device>): Promise<Device | null> {
    if (!this.useApi) {
      // Simulate creation with mock data
      const newDevice: Device = {
        id: `DEV${Date.now()}`,
        name: device.name || 'New Device',
        status: device.status || 'Inactive',
        simCard: device.simCard || '',
        deviceType: device.deviceType || 'Unknown',
        location: device.location || 'Unknown',
        lastSeen: new Date().toISOString(),
        signalStrength: device.signalStrength || 0,
        dataUsage: device.dataUsage || '0 MB',
        connectionType: device.connectionType || '4G',
        test1: device.test1 || 'value1'
      }
      return Promise.resolve(newDevice)
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/devices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(device)
      })
      
      const result: ApiResponse<Device> = await response.json()
      return result.success && result.data ? result.data : null
    } catch (error) {
      console.error('Failed to create device:', error)
      return null
    }
  }

  async updateDevice(id: string, updates: Partial<Device>): Promise<boolean> {
    if (!this.useApi) {
      // Simulate update
      return Promise.resolve(true)
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/devices?id=${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      })
      
      const result: ApiResponse<any> = await response.json()
      return result.success
    } catch (error) {
      console.error('Failed to update device:', error)
      return false
    }
  }

  async deleteDevice(id: string): Promise<boolean> {
    if (!this.useApi) {
      // Simulate deletion
      return Promise.resolve(true)
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/devices?id=${id}`, {
        method: 'DELETE'
      })
      
      const result: ApiResponse<any> = await response.json()
      return result.success
    } catch (error) {
      console.error('Failed to delete device:', error)
      return false
    }
  }

  // SIM Card methods
  async getSIMCards(): Promise<SIMCard[]> {
    console.log('getSIMCards called, useApi:', this.useApi, 'baseUrl:', this.baseUrl)
    
    if (!this.useApi) {
      console.log('Using mock SIM data (useApi = false)')
      return Promise.resolve(mockSIMCards)
    }

    try {
      const url = `${this.baseUrl}/api/simcards`
      console.log('Fetching SIM cards from URL:', url)
      
      const response = await fetch(url)
      console.log('SIM Response status:', response.status, 'Content-Type:', response.headers.get('content-type'))
      
      const responseText = await response.text()
      console.log('SIM Raw response (first 200 chars):', responseText.substring(0, 200))
      
      const result: ApiResponse<SIMCard[]> = JSON.parse(responseText)
      
      if (result.success && result.data) {
        console.log('SIM API success, got', result.data.length, 'sim cards')
        return result.data
      } else {
        console.warn('API call failed, falling back to mock data:', result.error)
        return mockSIMCards
      }
    } catch (error) {
      console.warn('API call failed, falling back to mock data:', error)
      return mockSIMCards
    }
  }

  async createSIMCard(simCard: Partial<SIMCard>): Promise<SIMCard | null> {
    if (!this.useApi) {
      // Simulate creation with mock data
      const newSIMCard: SIMCard = {
        id: `SIM${Date.now()}`,
        iccid: simCard.iccid || `890123456789012${Date.now()}`,
        msisdn: simCard.msisdn || '+1234567000',
        status: simCard.status || 'Inactive',
        carrier: simCard.carrier || 'Unknown Carrier',
        plan: simCard.plan || 'Basic Plan',
        dataUsed: simCard.dataUsed || '0 MB',
        dataLimit: simCard.dataLimit || '10 MB',
        activationDate: simCard.activationDate || new Date().toISOString().split('T')[0],
        expiryDate: simCard.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }
      return Promise.resolve(newSIMCard)
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/simcards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(simCard)
      })
      
      const result: ApiResponse<SIMCard> = await response.json()
      return result.success && result.data ? result.data : null
    } catch (error) {
      console.error('Failed to create SIM card:', error)
      return null
    }
  }

  async updateSIMCard(id: string, updates: Partial<SIMCard>): Promise<boolean> {
    if (!this.useApi) {
      // Simulate update
      return Promise.resolve(true)
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/simcards?id=${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      })
      
      const result: ApiResponse<any> = await response.json()
      return result.success
    } catch (error) {
      console.error('Failed to update SIM card:', error)
      return false
    }
  }

  async deleteSIMCard(id: string): Promise<boolean> {
    if (!this.useApi) {
      // Simulate deletion
      return Promise.resolve(true)
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/simcards?id=${id}`, {
        method: 'DELETE'
      })
      
      const result: ApiResponse<any> = await response.json()
      return result.success
    } catch (error) {
      console.error('Failed to delete SIM card:', error)
      return false
    }
  }

  // Authentication methods
  async login(username: string, password: string): Promise<{ success: boolean; token?: string; user?: any; error?: string }> {
    if (!this.useApi) {
      // Use original localStorage-based auth for development
      if (username === 'admin' && password === '1234567') {
        return Promise.resolve({
          success: true,
          token: 'mock-token',
          user: { id: 'admin-001', username: 'admin', role: 'administrator' }
        })
      } else {
        return Promise.resolve({
          success: false,
          error: 'Invalid credentials'
        })
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'login', username, password })
      })
      
      return await response.json()
    } catch (error) {
      console.error('Login failed:', error)
      return {
        success: false,
        error: 'Network error during login'
      }
    }
  }

  async verifyToken(token: string): Promise<{ success: boolean; user?: any; error?: string }> {
    if (!this.useApi) {
      // Mock verification for development
      return Promise.resolve({
        success: token === 'mock-token',
        user: { id: 'admin-001', username: 'admin', role: 'administrator' }
      })
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'verify', token })
      })

      return await response.json()
    } catch (error) {
      console.error('Token verification failed:', error)
      return {
        success: false,
        error: 'Network error during verification'
      }
    }
  }

  // LLM Chat methods
  async sendLLMMessage(
    message: string,
    userContext: { username: string; role: string; email: string }
  ): Promise<{
    success: boolean
    message?: string
    actions?: Array<{
      id: string
      type: 'update' | 'create' | 'delete'
      resource: 'device' | 'simcard' | 'user'
      resourceId?: string
      changes: Record<string, unknown>
      description: string
    }>
    error?: string
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/llm/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, userContext })
      })

      return await response.json()
    } catch (error) {
      console.error('LLM chat failed:', error)
      return {
        success: false,
        error: 'Network error during LLM chat'
      }
    }
  }

  async executeLLMAction(
    actionId: string,
    approved: boolean,
    userContext: { username: string; role: string; email: string }
  ): Promise<{
    success: boolean
    message?: string
    result?: unknown
    error?: string
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/llm/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ actionId, approved, userContext })
      })

      return await response.json()
    } catch (error) {
      console.error('LLM action execution failed:', error)
      return {
        success: false,
        error: 'Network error during action execution'
      }
    }
  }

  async getPendingLLMActions(
    userId: string
  ): Promise<{
    success: boolean
    data?: Array<{
      id: string
      actionType: string
      resourceType: string
      resourceId: string
      changes: Record<string, unknown>
      description: string
      status: string
      createdAt: string
      expiresAt: string
    }>
    error?: string
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/llm/pending-actions?user_id=${userId}`)
      return await response.json()
    } catch (error) {
      console.error('Failed to fetch pending actions:', error)
      return {
        success: false,
        error: 'Network error fetching pending actions'
      }
    }
  }
}

// Export a singleton instance
export const dataService = new DataService()