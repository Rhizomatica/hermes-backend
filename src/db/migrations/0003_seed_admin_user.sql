-- Seed: admin user for initial login
-- Callsign: root / Password: amazonia
INSERT OR IGNORE INTO users (id, callsign, display_name, email, password_hash, role, status, avatar_path, metadata, locale, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'root',
  'Root Admin',
  NULL,
  '$2b$12$MJ58yJFchL9d/PKfJYscseziwpIVpUDrVbnL26SzSfXfS7LmBvh/C',
  'admin',
  'active',
  NULL,
  '{}',
  'en',
  '2025-01-01T00:00:00.000Z',
  '2025-01-01T00:00:00.000Z'
);