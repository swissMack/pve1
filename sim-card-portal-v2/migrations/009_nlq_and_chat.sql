-- Sprint 6: NLQ Dashboard + Bob Support Chat
-- Migration: 009_nlq_and_chat.sql

-- ============================================================================
-- Chat Conversations
-- ============================================================================
CREATE TABLE IF NOT EXISTS "sim-card-portal-v2".chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
  user_id VARCHAR(100) NOT NULL,
  title VARCHAR(255) DEFAULT 'New Conversation',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user
  ON "sim-card-portal-v2".chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_tenant
  ON "sim-card-portal-v2".chat_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_active
  ON "sim-card-portal-v2".chat_conversations(user_id, is_active)
  WHERE is_active = true;

-- ============================================================================
-- Chat Messages
-- ============================================================================
CREATE TABLE IF NOT EXISTS "sim-card-portal-v2".chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES "sim-card-portal-v2".chat_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
  ON "sim-card-portal-v2".chat_messages(conversation_id, created_at);

-- ============================================================================
-- NLQ Query Audit Log
-- ============================================================================
CREATE TABLE IF NOT EXISTS "sim-card-portal-v2".nlq_query_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
  user_id VARCHAR(100) NOT NULL,
  query_text TEXT NOT NULL,
  parsed_intent JSONB,
  generated_sql TEXT,
  result_count INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'error', 'rejected')),
  error_message TEXT,
  execution_time_ms INTEGER,
  model_used VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nlq_query_log_user
  ON "sim-card-portal-v2".nlq_query_log(user_id);
CREATE INDEX IF NOT EXISTS idx_nlq_query_log_tenant
  ON "sim-card-portal-v2".nlq_query_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nlq_query_log_created
  ON "sim-card-portal-v2".nlq_query_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nlq_query_log_status
  ON "sim-card-portal-v2".nlq_query_log(status);
