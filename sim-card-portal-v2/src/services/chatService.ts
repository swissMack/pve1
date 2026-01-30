/**
 * Sprint 6: Chat Service
 * Frontend service for Bob Support Chat API
 */

import type { ChatConversation, ChatMessage } from '../types/nlq'

const API_BASE_URL = window.location.origin

function getUserHeaders(): Record<string, string> {
  const storedUser = localStorage.getItem('sim-portal-user')
  const user = storedUser ? JSON.parse(storedUser) : null
  return {
    'Content-Type': 'application/json',
    'X-User-Id': user?.username || 'anonymous',
    'X-Tenant-Id': 'default'
  }
}

function getUserContext(): { name: string; role: string } | null {
  const storedUser = localStorage.getItem('sim-portal-user')
  if (!storedUser) return null
  const user = JSON.parse(storedUser)
  return { name: user.name, role: user.role }
}

export async function listConversations(): Promise<ChatConversation[]> {
  const user = getUserHeaders()
  const response = await fetch(
    `${API_BASE_URL}/api/chat/conversations?userId=${encodeURIComponent(user['X-User-Id'])}`,
    { headers: user }
  )
  const result = await response.json()
  return result.success ? result.data : []
}

export async function createConversation(title?: string): Promise<ChatConversation | null> {
  const user = getUserHeaders()
  const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
    method: 'POST',
    headers: user,
    body: JSON.stringify({
      title: title || 'New Conversation',
      userId: user['X-User-Id']
    })
  })
  const result = await response.json()
  return result.success ? result.data : null
}

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/chat/conversations/${conversationId}/messages`,
    { headers: getUserHeaders() }
  )
  const result = await response.json()
  return result.success ? result.data : []
}

export async function sendMessage(conversationId: string, content: string): Promise<ChatMessage | null> {
  const response = await fetch(
    `${API_BASE_URL}/api/chat/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: getUserHeaders(),
      body: JSON.stringify({ content, userContext: getUserContext() })
    }
  )
  const result = await response.json()
  return result.success ? result.data : null
}

export async function deleteConversation(conversationId: string): Promise<boolean> {
  const response = await fetch(
    `${API_BASE_URL}/api/chat/conversations/${conversationId}`,
    { method: 'DELETE', headers: getUserHeaders() }
  )
  const result = await response.json()
  return result.success
}
