import axios from 'axios'

// API configuration from environment variables
// Falls back to /api path (proxied through nginx) if not set
const API_BASE = import.meta.env.VITE_API_URL || '/api'
const API_KEY = import.meta.env.VITE_API_KEY || 'test_provisioning_key_12345'

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  }
})

export interface ApiError {
  code: string
  message: string
}

export interface ApiErrorResponse {
  error: ApiError
}

api.interceptors.response.use(
  response => response,
  error => {
    const message = error.response?.data?.error?.message || error.message
    const code = error.response?.data?.error?.code || 'UNKNOWN_ERROR'
    return Promise.reject({
      ...error,
      displayMessage: message,
      errorCode: code
    })
  }
)
