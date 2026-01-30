-- ============================================================================
-- SPRINT 4: ALERTS & GEOFENCING
-- Tables: status_inference_rules, asset_status_history, responsibility_transfers,
--         alert_rules, alerts, alert_history, notifications, notification_preferences
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE alert_trigger_type AS ENUM ('zone_enter', 'zone_exit', 'arrival_overdue', 'low_battery', 'no_report');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE alert_severity AS ENUM ('critical', 'high', 'medium', 'low', 'info');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE alert_status_type AS ENUM ('new', 'acknowledged', 'assigned', 'in_progress', 'pending', 'resolved', 'snoozed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM ('email', 'in_app');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('alert_created', 'alert_escalated', 'alert_assigned', 'alert_resolved', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE status_change_source AS ENUM ('auto', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- STATUS INFERENCE RULES
-- Configurable zone_type -> asset_status mapping per tenant
-- ============================================================================

CREATE TABLE IF NOT EXISTS status_inference_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  zone_type zone_type NOT NULL,
  inferred_status asset_status NOT NULL,
  no_zone_status asset_status DEFAULT 'unknown',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_inference_tenant_zone UNIQUE(tenant_id, zone_type)
);

CREATE INDEX IF NOT EXISTS idx_inference_rules_tenant ON status_inference_rules(tenant_id);

-- ============================================================================
-- ASSET STATUS HISTORY
-- Tracks all status changes (auto from geozone + manual overrides)
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  previous_status asset_status,
  new_status asset_status NOT NULL,
  source status_change_source NOT NULL DEFAULT 'auto',
  geozone_event_id UUID REFERENCES geozone_events(id),
  changed_by_user_id UUID REFERENCES users(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_history_asset ON asset_status_history(asset_id, created_at DESC);

-- ============================================================================
-- RESPONSIBILITY TRANSFERS
-- Custody chain log tracking entity-to-entity transfers
-- ============================================================================

CREATE TABLE IF NOT EXISTS responsibility_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  tenant_id UUID,
  from_entity_type VARCHAR(50),
  from_entity_name VARCHAR(255),
  from_geozone_id UUID REFERENCES geozones(id),
  to_entity_type VARCHAR(50),
  to_entity_name VARCHAR(255),
  to_geozone_id UUID REFERENCES geozones(id),
  custody_duration_seconds INTEGER,
  transferred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfers_asset ON responsibility_transfers(asset_id, transferred_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_tenant ON responsibility_transfers(tenant_id);

-- ============================================================================
-- ALERT RULES
-- Configurable alert rule definitions
-- ============================================================================

CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_type alert_trigger_type NOT NULL,
  severity alert_severity NOT NULL DEFAULT 'medium',
  conditions JSONB DEFAULT '{}'::jsonb,
  actions JSONB DEFAULT '{"email": true, "in_app": true}'::jsonb,
  recipients JSONB DEFAULT '[]'::jsonb,
  is_enabled BOOLEAN DEFAULT true,
  cooldown_minutes INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant ON alert_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_trigger ON alert_rules(trigger_type);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(is_enabled) WHERE deleted_at IS NULL;

-- ============================================================================
-- ALERTS
-- Generated alert instances
-- ============================================================================

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  alert_rule_id UUID REFERENCES alert_rules(id),
  asset_id UUID REFERENCES assets(id),
  geozone_id UUID REFERENCES geozones(id),
  geozone_event_id UUID REFERENCES geozone_events(id),
  alert_type alert_trigger_type NOT NULL,
  severity alert_severity NOT NULL DEFAULT 'medium',
  status alert_status_type NOT NULL DEFAULT 'new',
  title VARCHAR(500) NOT NULL,
  description TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  assigned_to UUID REFERENCES users(id),
  snoozed_until TIMESTAMPTZ,
  sla_deadline TIMESTAMPTZ,
  dedup_key VARCHAR(255),
  escalation_level INTEGER DEFAULT 0,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_tenant ON alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_asset ON alerts(asset_id);
CREATE INDEX IF NOT EXISTS idx_alerts_geozone ON alerts(geozone_id);
CREATE INDEX IF NOT EXISTS idx_alerts_rule ON alerts(alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_alerts_dedup ON alerts(dedup_key) WHERE status NOT IN ('resolved');
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_assigned ON alerts(assigned_to);

-- ============================================================================
-- ALERT HISTORY
-- Status transition audit log
-- ============================================================================

CREATE TABLE IF NOT EXISTS alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES alerts(id),
  from_status alert_status_type,
  to_status alert_status_type NOT NULL,
  changed_by UUID REFERENCES users(id),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_history_alert ON alert_history(alert_id, created_at DESC);

-- ============================================================================
-- NOTIFICATIONS
-- Mock email + in-app notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id UUID REFERENCES users(id),
  alert_id UUID REFERENCES alerts(id),
  notification_type notification_type NOT NULL DEFAULT 'alert_created',
  channel notification_channel NOT NULL DEFAULT 'in_app',
  title VARCHAR(500) NOT NULL,
  body TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_alert ON notifications(alert_id);

-- ============================================================================
-- NOTIFICATION PREFERENCES
-- Per-user notification settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id UUID REFERENCES users(id),
  alert_type alert_trigger_type NOT NULL,
  channel notification_channel NOT NULL DEFAULT 'in_app',
  is_enabled BOOLEAN DEFAULT true,
  digest_frequency VARCHAR(20) DEFAULT 'immediate',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_notification_pref UNIQUE(tenant_id, user_id, alert_type, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);
