-- Phase 2 Migration: All 14 tables (conversations through user_devices)
-- Generated for D2.1–D2.11

CREATE TABLE conversations (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('direct', 'group', 'broadcast', 'radio')),
  title TEXT,
  description TEXT,
  avatar_path TEXT,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  last_activity_at TEXT,
  archived_at TEXT,
  metadata TEXT DEFAULT '{}' NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_conversations_type ON conversations (type);
--> statement-breakpoint
CREATE INDEX idx_conversations_last_activity ON conversations (last_activity_at);
--> statement-breakpoint
CREATE INDEX idx_conversations_created_by ON conversations (created_by);
--> statement-breakpoint
CREATE TABLE conversation_participants (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' NOT NULL CHECK(role IN ('owner', 'admin', 'member')),
  last_read_message_id TEXT,
  last_read_at TEXT,
  muted_until TEXT,
  joined_at TEXT NOT NULL,
  left_at TEXT,
  UNIQUE (conversation_id, user_id)
);
--> statement-breakpoint
CREATE INDEX idx_conv_participants_conversation ON conversation_participants (conversation_id);
--> statement-breakpoint
CREATE INDEX idx_conv_participants_user ON conversation_participants (user_id);
--> statement-breakpoint
CREATE TABLE messages (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  client_message_id TEXT UNIQUE,
  content TEXT,
  content_checksum TEXT,
  content_type TEXT DEFAULT 'text' NOT NULL CHECK(content_type IN ('text', 'markdown', 'html', 'audio', 'system', 'attachment_only')),
  reply_to_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  forwarded_from_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  subject TEXT,
  status TEXT DEFAULT 'sending' NOT NULL CHECK(status IN ('draft', 'sending', 'sent', 'failed')),
  edited_at TEXT,
  deleted_at TEXT,
  metadata TEXT DEFAULT '{}' NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_messages_conversation_created ON messages (conversation_id, created_at);
--> statement-breakpoint
CREATE INDEX idx_messages_sender ON messages (sender_id);
--> statement-breakpoint
CREATE INDEX idx_messages_client_id ON messages (client_message_id);
--> statement-breakpoint
CREATE INDEX idx_messages_reply_to ON messages (reply_to_message_id);
--> statement-breakpoint
CREATE TABLE message_deliveries (
  id TEXT PRIMARY KEY NOT NULL,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK(channel IN ('websocket', 'email', 'radio', 'push', 'sms')),
  status TEXT DEFAULT 'pending' NOT NULL CHECK(status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  sent_at TEXT,
  delivered_at TEXT,
  read_at TEXT,
  failed_at TEXT,
  error TEXT,
  attempts INTEGER DEFAULT 0 NOT NULL,
  next_retry_at TEXT,
  UNIQUE (message_id, recipient_id, channel)
);
--> statement-breakpoint
CREATE INDEX idx_deliveries_message ON message_deliveries (message_id);
--> statement-breakpoint
CREATE INDEX idx_deliveries_recipient_status ON message_deliveries (recipient_id, status);
--> statement-breakpoint
CREATE INDEX idx_deliveries_next_retry ON message_deliveries (next_retry_at);
--> statement-breakpoint
CREATE TABLE message_reactions (
  id TEXT PRIMARY KEY NOT NULL,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (message_id, user_id, emoji)
);
--> statement-breakpoint
CREATE INDEX idx_reactions_message ON message_reactions (message_id);
--> statement-breakpoint
CREATE TABLE attachments (
  id TEXT PRIMARY KEY NOT NULL,
  message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  uploader_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  storage_backend TEXT DEFAULT 'local' NOT NULL CHECK(storage_backend IN ('local', 's3', 'gcs')),
  checksum TEXT NOT NULL,
  preview_path TEXT,
  status TEXT DEFAULT 'pending' NOT NULL CHECK(status IN ('pending', 'processing', 'ready', 'failed', 'expired')),
  metadata TEXT DEFAULT '{}' NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  deleted_at TEXT
);
--> statement-breakpoint
CREATE INDEX idx_attachments_message ON attachments (message_id);
--> statement-breakpoint
CREATE INDEX idx_attachments_checksum ON attachments (checksum);
--> statement-breakpoint
CREATE INDEX idx_attachments_uploader ON attachments (uploader_id);
--> statement-breakpoint
CREATE INDEX idx_attachments_status ON attachments (status);
--> statement-breakpoint
CREATE TABLE message_envelopes (
  id TEXT PRIMARY KEY NOT NULL,
  message_id TEXT NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
  envelope_type TEXT NOT NULL CHECK(envelope_type IN ('inbound', 'outbound')),
  from_address TEXT NOT NULL,
  to_addresses TEXT DEFAULT '[]' NOT NULL,
  cc_addresses TEXT DEFAULT '[]' NOT NULL,
  bcc_addresses TEXT DEFAULT '[]' NOT NULL,
  subject TEXT,
  headers TEXT DEFAULT '{}' NOT NULL,
  raw_message_path TEXT,
  transport TEXT NOT NULL CHECK(transport IN ('smtp', 'uucp', 'radio', 'hmp', 'internal')),
  external_message_id TEXT,
  status TEXT DEFAULT 'pending' NOT NULL CHECK(status IN ('pending', 'processing', 'sent', 'received', 'failed')),
  locale TEXT DEFAULT 'en' NOT NULL CHECK(locale IN ('en', 'es', 'pt-BR')),
  created_at TEXT NOT NULL,
  processed_at TEXT
);
--> statement-breakpoint
CREATE INDEX idx_envelopes_message ON message_envelopes (message_id);
--> statement-breakpoint
CREATE INDEX idx_envelopes_status ON message_envelopes (status, transport);
--> statement-breakpoint
CREATE INDEX idx_envelopes_external_id ON message_envelopes (external_message_id);
--> statement-breakpoint
CREATE TABLE radio_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  station_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  frequency_hz INTEGER NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('USB', 'LSB', 'CW', 'AM', 'FM', 'DIGITAL')),
  volume INTEGER DEFAULT 50 NOT NULL CHECK(volume BETWEEN 0 AND 100),
  bfo_hz INTEGER DEFAULT 0 NOT NULL,
  digital_voice INTEGER DEFAULT 0 NOT NULL,
  power_level INTEGER,
  is_active INTEGER DEFAULT 0 NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (station_id, profile_index)
);
--> statement-breakpoint
CREATE TABLE radio_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  station_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id TEXT REFERENCES radio_profiles(id) ON DELETE SET NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  bytes_tx INTEGER DEFAULT 0 NOT NULL,
  bytes_rx INTEGER DEFAULT 0 NOT NULL,
  metadata TEXT DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_radio_sessions_station ON radio_sessions (station_id, started_at);
--> statement-breakpoint
CREATE TABLE frequencies (
  id TEXT PRIMARY KEY NOT NULL,
  alias TEXT NOT NULL UNIQUE,
  frequency_hz INTEGER NOT NULL,
  mode TEXT DEFAULT 'USB' NOT NULL CHECK(mode IN ('USB', 'LSB', 'CW', 'AM', 'FM', 'DIGITAL')),
  description TEXT,
  is_gateway INTEGER DEFAULT 0 NOT NULL,
  region TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_frequencies_alias ON frequencies (alias);
--> statement-breakpoint
CREATE TABLE connection_schedules (
  id TEXT PRIMARY KEY NOT NULL,
  target_callsign TEXT NOT NULL,
  frequency_id TEXT REFERENCES frequencies(id) ON DELETE SET NULL,
  scheduled_at TEXT NOT NULL,
  recurrence TEXT,
  status TEXT DEFAULT 'pending' NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  last_run_at TEXT,
  next_run_at TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_schedules_next_run ON connection_schedules (next_run_at);
--> statement-breakpoint
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT DEFAULT '{}' NOT NULL,
  locale TEXT DEFAULT 'en' NOT NULL CHECK(locale IN ('en', 'es', 'pt-BR')),
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_audit_actor ON audit_logs (actor_id, created_at);
--> statement-breakpoint
CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id, created_at);
--> statement-breakpoint
CREATE INDEX idx_audit_action ON audit_logs (action, created_at);
--> statement-breakpoint
CREATE TABLE jobs (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  priority INTEGER DEFAULT 5 NOT NULL CHECK(priority BETWEEN 1 AND 10),
  status TEXT DEFAULT 'queued' NOT NULL CHECK(status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  max_attempts INTEGER DEFAULT 3 NOT NULL,
  attempts INTEGER DEFAULT 0 NOT NULL,
  scheduled_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  failed_at TEXT,
  error TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_jobs_status_priority ON jobs (status, priority, created_at);
--> statement-breakpoint
CREATE INDEX idx_jobs_scheduled ON jobs (scheduled_at);
--> statement-breakpoint
CREATE TABLE user_devices (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK(device_type IN ('mobile', 'desktop', 'station', 'browser')),
  push_token TEXT,
  platform TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_user_devices_user_id ON user_devices (user_id);