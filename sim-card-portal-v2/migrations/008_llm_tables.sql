-- LLM Support Tables
-- Migration: 008_llm_tables.sql

-- Pending actions awaiting user approval
CREATE TABLE IF NOT EXISTS "sim-card-portal-v2".pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(100) NOT NULL,
  user_role VARCHAR(50) NOT NULL,
  action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('create', 'update', 'delete')),
  resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('device', 'simcard', 'user')),
  resource_id VARCHAR(100),
  changes JSONB NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '15 minutes',
  executed_at TIMESTAMPTZ,
  execution_result JSONB
);

-- Indexes for pending actions
CREATE INDEX IF NOT EXISTS idx_pending_actions_user ON "sim-card-portal-v2".pending_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_actions_status ON "sim-card-portal-v2".pending_actions(status);
CREATE INDEX IF NOT EXISTS idx_pending_actions_expires ON "sim-card-portal-v2".pending_actions(expires_at) WHERE status = 'pending';

-- Audit log for all LLM interactions
CREATE TABLE IF NOT EXISTS "sim-card-portal-v2".llm_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(100) NOT NULL,
  user_role VARCHAR(50) NOT NULL,
  action_type VARCHAR(50) NOT NULL,  -- 'chat', 'action_proposed', 'action_approved', 'action_rejected', 'action_executed'
  request_message TEXT,
  response_message TEXT,
  actions_proposed JSONB,
  tokens_used INTEGER,
  error_message TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit log
CREATE INDEX IF NOT EXISTS idx_llm_audit_user ON "sim-card-portal-v2".llm_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_audit_created ON "sim-card-portal-v2".llm_audit_log(created_at DESC);

-- Function to auto-expire pending actions
CREATE OR REPLACE FUNCTION "sim-card-portal-v2".expire_pending_actions()
RETURNS void AS $$
BEGIN
  UPDATE "sim-card-portal-v2".pending_actions
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
