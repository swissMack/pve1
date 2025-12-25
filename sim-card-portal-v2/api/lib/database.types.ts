/**
 * Database Types for Supabase
 *
 * This file defines the TypeScript types for the database schema.
 * It follows Supabase's type generation format for full type safety.
 *
 * To regenerate from Supabase:
 * npx supabase gen types typescript --project-id YOUR_PROJECT_ID > api/lib/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      device_types: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          id: string
          name: string
          address: string | null
          latitude: number | null
          longitude: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sim_cards: {
        Row: {
          id: string
          iccid: string
          msisdn: string | null
          status: 'Active' | 'Inactive' | 'Suspended' | 'Terminated'
          carrier: string | null
          plan: string | null
          data_used: string | null
          data_limit: string | null
          data_used_bytes: number | null
          data_limit_bytes: number | null
          activation_date: string | null
          expiry_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          iccid: string
          msisdn?: string | null
          status?: 'Active' | 'Inactive' | 'Suspended' | 'Terminated'
          carrier?: string | null
          plan?: string | null
          data_used?: string | null
          data_limit?: string | null
          data_used_bytes?: number | null
          data_limit_bytes?: number | null
          activation_date?: string | null
          expiry_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          iccid?: string
          msisdn?: string | null
          status?: 'Active' | 'Inactive' | 'Suspended' | 'Terminated'
          carrier?: string | null
          plan?: string | null
          data_used?: string | null
          data_limit?: string | null
          data_used_bytes?: number | null
          data_limit_bytes?: number | null
          activation_date?: string | null
          expiry_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          id: string
          name: string
          status: 'active' | 'inactive' | 'maintenance' | 'offline'
          sim_card_id: string | null
          device_type_id: string | null
          location_id: string | null
          last_seen: string | null
          signal_strength: number | null
          data_usage_mb: number | null
          connection_type: '3g' | '4g' | '5g' | 'wifi' | null
          firmware_version: string | null
          hardware_version: string | null
          serial_number: string | null
          manufacturer: string | null
          model: string | null
          notes: string | null
          description: string | null
          is_active: boolean | null
          test1: 'value1' | 'value2' | null
          latitude: number | null
          longitude: number | null
          temperature: number | null
          humidity: number | null
          light: number | null
          sensor_sampling_interval: number | null
          health_status: 'healthy' | 'warning' | 'critical' | 'unknown' | null
          battery_level: number | null
          security_status: 'secure' | 'vulnerable' | 'compromised' | 'unknown' | null
          asset_management_url: string | null
          supplier_device_url: string | null
          user_manual_url: string | null
          specification_base64: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          status?: 'active' | 'inactive' | 'maintenance' | 'offline'
          sim_card_id?: string | null
          device_type_id?: string | null
          location_id?: string | null
          last_seen?: string | null
          signal_strength?: number | null
          data_usage_mb?: number | null
          connection_type?: '3g' | '4g' | '5g' | 'wifi' | null
          firmware_version?: string | null
          hardware_version?: string | null
          serial_number?: string | null
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          description?: string | null
          is_active?: boolean | null
          test1?: 'value1' | 'value2' | null
          latitude?: number | null
          longitude?: number | null
          temperature?: number | null
          humidity?: number | null
          light?: number | null
          sensor_sampling_interval?: number | null
          health_status?: 'healthy' | 'warning' | 'critical' | 'unknown' | null
          battery_level?: number | null
          security_status?: 'secure' | 'vulnerable' | 'compromised' | 'unknown' | null
          asset_management_url?: string | null
          supplier_device_url?: string | null
          user_manual_url?: string | null
          specification_base64?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          status?: 'active' | 'inactive' | 'maintenance' | 'offline'
          sim_card_id?: string | null
          device_type_id?: string | null
          location_id?: string | null
          last_seen?: string | null
          signal_strength?: number | null
          data_usage_mb?: number | null
          connection_type?: '3g' | '4g' | '5g' | 'wifi' | null
          firmware_version?: string | null
          hardware_version?: string | null
          serial_number?: string | null
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          description?: string | null
          is_active?: boolean | null
          test1?: 'value1' | 'value2' | null
          latitude?: number | null
          longitude?: number | null
          temperature?: number | null
          humidity?: number | null
          light?: number | null
          sensor_sampling_interval?: number | null
          health_status?: 'healthy' | 'warning' | 'critical' | 'unknown' | null
          battery_level?: number | null
          security_status?: 'secure' | 'vulnerable' | 'compromised' | 'unknown' | null
          asset_management_url?: string | null
          supplier_device_url?: string | null
          user_manual_url?: string | null
          specification_base64?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'devices_sim_card_id_fkey'
            columns: ['sim_card_id']
            isOneToOne: false
            referencedRelation: 'sim_cards'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'devices_device_type_id_fkey'
            columns: ['device_type_id']
            isOneToOne: false
            referencedRelation: 'device_types'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'devices_location_id_fkey'
            columns: ['location_id']
            isOneToOne: false
            referencedRelation: 'locations'
            referencedColumns: ['id']
          }
        ]
      }
      device_location_history: {
        Row: {
          id: string
          device_id: string
          latitude: number
          longitude: number
          altitude: number | null
          accuracy: number | null
          speed: number | null
          heading: number | null
          recorded_at: string
          location_source: string | null
          battery_level: number | null
          signal_strength: number | null
          notes: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          device_id: string
          latitude: number
          longitude: number
          altitude?: number | null
          accuracy?: number | null
          speed?: number | null
          heading?: number | null
          recorded_at?: string
          location_source?: string | null
          battery_level?: number | null
          signal_strength?: number | null
          notes?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          device_id?: string
          latitude?: number
          longitude?: number
          altitude?: number | null
          accuracy?: number | null
          speed?: number | null
          heading?: number | null
          recorded_at?: string
          location_source?: string | null
          battery_level?: number | null
          signal_strength?: number | null
          notes?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'device_location_history_device_id_fkey'
            columns: ['device_id']
            isOneToOne: false
            referencedRelation: 'devices'
            referencedColumns: ['id']
          }
        ]
      }
      device_sensor_history: {
        Row: {
          id: string
          device_id: string
          temperature: number | null
          humidity: number | null
          light: number | null
          recorded_at: string
          battery_level: number | null
          signal_strength: number | null
          notes: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          device_id: string
          temperature?: number | null
          humidity?: number | null
          light?: number | null
          recorded_at?: string
          battery_level?: number | null
          signal_strength?: number | null
          notes?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          device_id?: string
          temperature?: number | null
          humidity?: number | null
          light?: number | null
          recorded_at?: string
          battery_level?: number | null
          signal_strength?: number | null
          notes?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'device_sensor_history_device_id_fkey'
            columns: ['device_id']
            isOneToOne: false
            referencedRelation: 'devices'
            referencedColumns: ['id']
          }
        ]
      }
      provisioned_sims: {
        Row: {
          sim_id: string
          iccid: string
          imsi: string
          msisdn: string
          imei: string | null
          puk1: string | null
          puk2: string | null
          pin1: string | null
          pin2: string | null
          ki: string | null
          opc: string | null
          apn: string
          rate_plan_id: string
          data_limit_bytes: number | null
          billing_account_id: string
          customer_id: string
          status: 'PROVISIONED' | 'ACTIVE' | 'INACTIVE' | 'BLOCKED'
          previous_status: string | null
          block_reason: string | null
          block_notes: string | null
          blocked_at: string | null
          blocked_by: 'SYSTEM' | 'USER' | 'API' | null
          metadata: Json
          created_at: string
          updated_at: string
          activated_at: string | null
          deactivated_at: string | null
        }
        Insert: {
          sim_id?: string
          iccid: string
          imsi: string
          msisdn: string
          imei?: string | null
          puk1?: string | null
          puk2?: string | null
          pin1?: string | null
          pin2?: string | null
          ki?: string | null
          opc?: string | null
          apn: string
          rate_plan_id: string
          data_limit_bytes?: number | null
          billing_account_id: string
          customer_id: string
          status?: 'PROVISIONED' | 'ACTIVE' | 'INACTIVE' | 'BLOCKED'
          previous_status?: string | null
          block_reason?: string | null
          block_notes?: string | null
          blocked_at?: string | null
          blocked_by?: 'SYSTEM' | 'USER' | 'API' | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          activated_at?: string | null
          deactivated_at?: string | null
        }
        Update: {
          sim_id?: string
          iccid?: string
          imsi?: string
          msisdn?: string
          imei?: string | null
          puk1?: string | null
          puk2?: string | null
          pin1?: string | null
          pin2?: string | null
          ki?: string | null
          opc?: string | null
          apn?: string
          rate_plan_id?: string
          data_limit_bytes?: number | null
          billing_account_id?: string
          customer_id?: string
          status?: 'PROVISIONED' | 'ACTIVE' | 'INACTIVE' | 'BLOCKED'
          previous_status?: string | null
          block_reason?: string | null
          block_notes?: string | null
          blocked_at?: string | null
          blocked_by?: 'SYSTEM' | 'USER' | 'API' | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          activated_at?: string | null
          deactivated_at?: string | null
        }
        Relationships: []
      }
      api_clients: {
        Row: {
          id: string
          name: string
          description: string | null
          api_key_hash: string
          api_key_prefix: string
          permissions: Json
          rate_limit_override: Json | null
          is_active: boolean
          created_at: string
          updated_at: string
          last_used_at: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          api_key_hash: string
          api_key_prefix: string
          permissions?: Json
          rate_limit_override?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          last_used_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          api_key_hash?: string
          api_key_prefix?: string
          permissions?: Json
          rate_limit_override?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          last_used_at?: string | null
        }
        Relationships: []
      }
      webhooks: {
        Row: {
          id: string
          url: string
          events: string[]
          secret_hash: string
          status: 'ACTIVE' | 'PAUSED' | 'FAILED'
          failure_count: number
          client_id: string | null
          created_at: string
          updated_at: string
          last_delivery_at: string | null
          last_success_at: string | null
          last_failure_at: string | null
        }
        Insert: {
          id?: string
          url: string
          events: string[]
          secret_hash: string
          status?: 'ACTIVE' | 'PAUSED' | 'FAILED'
          failure_count?: number
          client_id?: string | null
          created_at?: string
          updated_at?: string
          last_delivery_at?: string | null
          last_success_at?: string | null
          last_failure_at?: string | null
        }
        Update: {
          id?: string
          url?: string
          events?: string[]
          secret_hash?: string
          status?: 'ACTIVE' | 'PAUSED' | 'FAILED'
          failure_count?: number
          client_id?: string | null
          created_at?: string
          updated_at?: string
          last_delivery_at?: string | null
          last_success_at?: string | null
          last_failure_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'webhooks_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'api_clients'
            referencedColumns: ['id']
          }
        ]
      }
      webhook_deliveries: {
        Row: {
          id: number
          event_id: string
          event_type: string
          webhook_id: string
          payload: Json
          status: 'PENDING' | 'DELIVERED' | 'FAILED' | 'ABANDONED'
          attempt_count: number
          max_attempts: number
          response_code: number | null
          response_body: string | null
          response_time_ms: number | null
          next_retry_at: string | null
          created_at: string
          delivered_at: string | null
          last_attempt_at: string | null
        }
        Insert: {
          id?: number
          event_id?: string
          event_type: string
          webhook_id: string
          payload: Json
          status?: 'PENDING' | 'DELIVERED' | 'FAILED' | 'ABANDONED'
          attempt_count?: number
          max_attempts?: number
          response_code?: number | null
          response_body?: string | null
          response_time_ms?: number | null
          next_retry_at?: string | null
          created_at?: string
          delivered_at?: string | null
          last_attempt_at?: string | null
        }
        Update: {
          id?: number
          event_id?: string
          event_type?: string
          webhook_id?: string
          payload?: Json
          status?: 'PENDING' | 'DELIVERED' | 'FAILED' | 'ABANDONED'
          attempt_count?: number
          max_attempts?: number
          response_code?: number | null
          response_body?: string | null
          response_time_ms?: number | null
          next_retry_at?: string | null
          created_at?: string
          delivered_at?: string | null
          last_attempt_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'webhook_deliveries_webhook_id_fkey'
            columns: ['webhook_id']
            isOneToOne: false
            referencedRelation: 'webhooks'
            referencedColumns: ['id']
          }
        ]
      }
      usage_records: {
        Row: {
          id: number
          record_id: string
          iccid: string
          sim_id: string | null
          period_start: string
          period_end: string
          data_upload_bytes: number
          data_download_bytes: number
          total_bytes: number
          sms_count: number
          voice_seconds: number
          source: string | null
          batch_id: string | null
          status: 'PROCESSED' | 'DUPLICATE' | 'FAILED'
          processed_at: string
        }
        Insert: {
          id?: number
          record_id: string
          iccid: string
          sim_id?: string | null
          period_start: string
          period_end: string
          data_upload_bytes?: number
          data_download_bytes?: number
          total_bytes?: number
          sms_count?: number
          voice_seconds?: number
          source?: string | null
          batch_id?: string | null
          status?: 'PROCESSED' | 'DUPLICATE' | 'FAILED'
          processed_at?: string
        }
        Update: {
          id?: number
          record_id?: string
          iccid?: string
          sim_id?: string | null
          period_start?: string
          period_end?: string
          data_upload_bytes?: number
          data_download_bytes?: number
          total_bytes?: number
          sms_count?: number
          voice_seconds?: number
          source?: string | null
          batch_id?: string | null
          status?: 'PROCESSED' | 'DUPLICATE' | 'FAILED'
          processed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'usage_records_sim_id_fkey'
            columns: ['sim_id']
            isOneToOne: false
            referencedRelation: 'provisioned_sims'
            referencedColumns: ['sim_id']
          }
        ]
      }
      usage_cycles: {
        Row: {
          id: number
          sim_id: string
          iccid: string
          cycle_id: string
          cycle_start: string
          cycle_end: string
          total_upload_bytes: number
          total_download_bytes: number
          total_bytes: number
          sms_count: number
          voice_seconds: number
          is_current: boolean
          archived_at: string | null
          final_usage: Json | null
          created_at: string
          last_updated: string
        }
        Insert: {
          id?: number
          sim_id: string
          iccid: string
          cycle_id: string
          cycle_start: string
          cycle_end: string
          total_upload_bytes?: number
          total_download_bytes?: number
          total_bytes?: number
          sms_count?: number
          voice_seconds?: number
          is_current?: boolean
          archived_at?: string | null
          final_usage?: Json | null
          created_at?: string
          last_updated?: string
        }
        Update: {
          id?: number
          sim_id?: string
          iccid?: string
          cycle_id?: string
          cycle_start?: string
          cycle_end?: string
          total_upload_bytes?: number
          total_download_bytes?: number
          total_bytes?: number
          sms_count?: number
          voice_seconds?: number
          is_current?: boolean
          archived_at?: string | null
          final_usage?: Json | null
          created_at?: string
          last_updated?: string
        }
        Relationships: [
          {
            foreignKeyName: 'usage_cycles_sim_id_fkey'
            columns: ['sim_id']
            isOneToOne: false
            referencedRelation: 'provisioned_sims'
            referencedColumns: ['sim_id']
          }
        ]
      }
      sim_audit_log: {
        Row: {
          id: number
          sim_id: string
          iccid: string | null
          action: string
          previous_status: string | null
          new_status: string | null
          reason: string | null
          notes: string | null
          initiated_by: 'SYSTEM' | 'USER' | 'API' | null
          client_id: string | null
          correlation_id: string | null
          request_id: string | null
          ip_address: string | null
          changes: Json | null
          created_at: string
        }
        Insert: {
          id?: number
          sim_id: string
          iccid?: string | null
          action: string
          previous_status?: string | null
          new_status?: string | null
          reason?: string | null
          notes?: string | null
          initiated_by?: 'SYSTEM' | 'USER' | 'API' | null
          client_id?: string | null
          correlation_id?: string | null
          request_id?: string | null
          ip_address?: string | null
          changes?: Json | null
          created_at?: string
        }
        Update: {
          id?: number
          sim_id?: string
          iccid?: string | null
          action?: string
          previous_status?: string | null
          new_status?: string | null
          reason?: string | null
          notes?: string | null
          initiated_by?: 'SYSTEM' | 'USER' | 'API' | null
          client_id?: string | null
          correlation_id?: string | null
          request_id?: string | null
          ip_address?: string | null
          changes?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      api_audit_log: {
        Row: {
          id: number
          request_id: string
          client_id: string | null
          client_ip: string | null
          user_agent: string | null
          method: string
          endpoint: string
          query_params: Json | null
          request_body_hash: string | null
          status_code: number | null
          response_time_ms: number | null
          error_code: string | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: number
          request_id?: string
          client_id?: string | null
          client_ip?: string | null
          user_agent?: string | null
          method: string
          endpoint: string
          query_params?: Json | null
          request_body_hash?: string | null
          status_code?: number | null
          response_time_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          request_id?: string
          client_id?: string | null
          client_ip?: string | null
          user_agent?: string | null
          method?: string
          endpoint?: string
          query_params?: Json | null
          request_body_hash?: string | null
          status_code?: number | null
          response_time_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          created_at?: string
        }
        Relationships: []
      }
      rate_limit_buckets: {
        Row: {
          id: number
          client_id: string
          endpoint_category: string
          window_start: string
          request_count: number
        }
        Insert: {
          id?: number
          client_id: string
          endpoint_category: string
          window_start: string
          request_count?: number
        }
        Update: {
          id?: number
          client_id?: string
          endpoint_category?: string
          window_start?: string
          request_count?: number
        }
        Relationships: []
      }
    }
    Views: {
      sim_cards_formatted: {
        Row: {
          id: string | null
          iccid: string | null
          msisdn: string | null
          status: string | null
          carrier: string | null
          plan: string | null
          data_used: string | null
          data_limit: string | null
          data_used_bytes: number | null
          data_limit_bytes: number | null
          data_used_formatted: string | null
          data_limit_formatted: string | null
          usage_percentage: number | null
          activation_date: string | null
          expiry_date: string | null
          created_at: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accumulate_usage: {
        Args: {
          p_sim_id: string
          p_iccid: string
          p_upload_bytes: number
          p_download_bytes: number
          p_total_bytes: number
          p_sms_count?: number
          p_voice_seconds?: number
        }
        Returns: undefined
      }
      calculate_retry_delay: {
        Args: {
          attempt_count: number
        }
        Returns: unknown
      }
      cleanup_old_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      format_bytes: {
        Args: {
          bytes: number
        }
        Returns: string
      }
      parse_data_to_bytes: {
        Args: {
          data_str: string
        }
        Returns: number
      }
      reset_billing_cycle: {
        Args: {
          p_iccid: string
          p_new_cycle_id: string
          p_cycle_start: string
          p_cycle_end: string
          p_final_usage?: Json
        }
        Returns: {
          previous_cycle_id: string
          archived_usage: Json
          new_cycle_id: string
        }[]
      }
      update_updated_at_column: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      user_has_role: {
        Args: {
          required_role: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types for easier usage
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type Insertable<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type Updatable<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// Convenience type aliases
export type Device = Tables<'devices'>
export type SimCard = Tables<'sim_cards'>
export type DeviceType = Tables<'device_types'>
export type Location = Tables<'locations'>
export type DeviceLocationHistory = Tables<'device_location_history'>
export type DeviceSensorHistory = Tables<'device_sensor_history'>
export type ProvisionedSim = Tables<'provisioned_sims'>
export type ApiClient = Tables<'api_clients'>
export type Webhook = Tables<'webhooks'>
export type WebhookDelivery = Tables<'webhook_deliveries'>
export type UsageRecord = Tables<'usage_records'>
export type UsageCycle = Tables<'usage_cycles'>
export type SimAuditLog = Tables<'sim_audit_log'>
export type ApiAuditLog = Tables<'api_audit_log'>
