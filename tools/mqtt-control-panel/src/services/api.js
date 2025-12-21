import axios from 'axios'

const API_BASE = 'http://localhost:3001'
const API_KEY = 'test_provisioning_key_12345'

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  }
})

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
