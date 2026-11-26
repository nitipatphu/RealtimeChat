CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE users (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  system_role     TEXT NOT NULL DEFAULT 'member' CHECK (system_role IN ('administrator', 'staff', 'member')),
  account_status  TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended')),
  suspend_reason  TEXT,
  avatar          TEXT,
  title           TEXT NOT NULL DEFAULT '',
  bio             TEXT NOT NULL DEFAULT '',
  banner_color    TEXT,
  presence        TEXT NOT NULL DEFAULT 'online' CHECK (presence IN ('online', 'busy', 'sleep', 'offline')),
  settings        JSONB NOT NULL DEFAULT '{}',
  custom_theme    JSONB,
  reset_code      TEXT,
  reset_expires   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at   TIMESTAMPTZ
);

CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

CREATE TABLE sessions (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE user_blocks (
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, blocked_user_id),
  CHECK (user_id <> blocked_user_id)
);

CREATE TABLE muted_rooms (
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_key  TEXT NOT NULL,
  PRIMARY KEY (user_id, room_key)
);

CREATE TABLE read_markers (
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_key      TEXT NOT NULL,
  last_read_at  TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, room_key)
);

CREATE TABLE tier_settings (
  tier           TEXT PRIMARY KEY,
  name           TEXT NOT NULL DEFAULT '',
  icon           TEXT NOT NULL DEFAULT '',
  color          TEXT NOT NULL DEFAULT '#6366f1',
  rank           INTEGER NOT NULL DEFAULT 1,
  file_mb        INTEGER NOT NULL CHECK (file_mb BETWEEN 1 AND 1000),
  preset_themes  TEXT[] NOT NULL DEFAULT '{}',
  custom_theme   BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE user_vip (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tier        TEXT NOT NULL REFERENCES tier_settings(tier),
  since       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  granted_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  source      TEXT NOT NULL CHECK (source IN ('admin', 'code')),
  warned_for  TIMESTAMPTZ
);

CREATE INDEX user_vip_expires_idx ON user_vip (expires_at);

CREATE TABLE vip_codes (
  code        TEXT PRIMARY KEY,
  tier        TEXT NOT NULL REFERENCES tier_settings(tier),
  days        INTEGER NOT NULL CHECK (days BETWEEN 1 AND 3650),
  max_uses    INTEGER NOT NULL DEFAULT 1 CHECK (max_uses BETWEEN 1 AND 1000),
  note        TEXT NOT NULL DEFAULT '',
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vip_code_uses (
  code     TEXT NOT NULL REFERENCES vip_codes(code) ON DELETE CASCADE,
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  used_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (code, user_id)
);

CREATE TABLE clips (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '',
  text        TEXT NOT NULL CHECK (length(text) <= 5000),
  pinned      BOOLEAN NOT NULL DEFAULT false,
  source      TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX clips_user_idx ON clips (user_id, pinned DESC, updated_at DESC);

CREATE TABLE groups (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  visibility   TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
  color        TEXT,
  icon         TEXT,
  owner_id     TEXT NOT NULL REFERENCES users(id),
  invite_code  TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE group_members (
  group_id       TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname       TEXT,
  timeout_until  TIMESTAMPTZ,
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX group_members_user_idx ON group_members (user_id);

CREATE TABLE group_roles (
  id           TEXT PRIMARY KEY,
  group_id     TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  color        TEXT NOT NULL DEFAULT '#64748b',
  permissions  TEXT[] NOT NULL DEFAULT '{}',
  hoist        BOOLEAN NOT NULL DEFAULT false,
  is_default   BOOLEAN NOT NULL DEFAULT false,
  position     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX group_roles_group_idx ON group_roles (group_id, position);
CREATE UNIQUE INDEX group_roles_one_default ON group_roles (group_id) WHERE is_default;

CREATE TABLE member_roles (
  group_id  TEXT NOT NULL,
  user_id   TEXT NOT NULL,
  role_id   TEXT NOT NULL REFERENCES group_roles(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id, role_id),
  FOREIGN KEY (group_id, user_id) REFERENCES group_members(group_id, user_id) ON DELETE CASCADE
);

CREATE TABLE group_bans (
  group_id    TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL DEFAULT '',
  banned_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE group_invites (
  code        TEXT PRIMARY KEY,
  group_id    TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ,
  max_uses    INTEGER NOT NULL DEFAULT 0 CHECK (max_uses >= 0),
  uses        INTEGER NOT NULL DEFAULT 0 CHECK (uses >= 0)
);

CREATE INDEX group_invites_group_idx ON group_invites (group_id);

CREATE TABLE group_events (
  id             TEXT PRIMARY KEY,
  group_id       TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  event_date     DATE NOT NULL,
  event_time     TIME,
  description    TEXT NOT NULL DEFAULT '',
  created_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  reminded_for   DATE
);

CREATE INDEX group_events_date_idx ON group_events (group_id, event_date);

CREATE TABLE group_logs (
  id          TEXT PRIMARY KEY,
  group_id    TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  actor_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX group_logs_group_idx ON group_logs (group_id, created_at DESC);

CREATE TABLE admin_logs (
  id          TEXT PRIMARY KEY,
  action      TEXT NOT NULL,
  actor_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX admin_logs_created_idx ON admin_logs (created_at DESC);

CREATE TABLE channel_categories (
  id        TEXT PRIMARY KEY,
  group_id  TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  position  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE channels (
  id           TEXT PRIMARY KEY,
  group_id     TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  parent_id    TEXT REFERENCES channels(id) ON DELETE CASCADE,
  category_id  TEXT REFERENCES channel_categories(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX channels_group_idx ON channels (group_id);

CREATE TABLE channel_allowed_roles (
  channel_id  TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  role_id     TEXT NOT NULL REFERENCES group_roles(id) ON DELETE CASCADE,
  PRIMARY KEY (channel_id, role_id)
);

CREATE TABLE projects (
  id           TEXT PRIMARY KEY,
  group_id     TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  archived_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX projects_group_idx ON projects (group_id);

CREATE TABLE project_members (
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE project_channels (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE board_columns (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tasks (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  column_id      TEXT NOT NULL REFERENCES board_columns(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  priority       TEXT CHECK (priority IN ('low', 'medium', 'high')),
  due_date       DATE,
  position       INTEGER NOT NULL DEFAULT 0,
  reminded_for   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tasks_project_idx ON tasks (project_id, column_id, position);
CREATE INDEX tasks_due_idx ON tasks (due_date) WHERE due_date IS NOT NULL;

CREATE TABLE task_assignees (
  task_id  TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX task_assignees_user_idx ON task_assignees (user_id);

CREATE TABLE task_checklist_items (
  id        TEXT PRIMARY KEY,
  task_id   TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text      TEXT NOT NULL,
  done      BOOLEAN NOT NULL DEFAULT false,
  position  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE task_comments (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversations (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL CHECK (type IN ('dm', 'group')),
  name        TEXT,
  owner_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversation_participants (
  conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX conversation_participants_user_idx ON conversation_participants (user_id);

CREATE TABLE messages (
  id                  TEXT PRIMARY KEY,
  channel_id          TEXT REFERENCES channels(id) ON DELETE CASCADE,
  project_channel_id  TEXT REFERENCES project_channels(id) ON DELETE CASCADE,
  conversation_id     TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  parent_id           TEXT REFERENCES messages(id) ON DELETE CASCADE,
  author_id           TEXT REFERENCES users(id) ON DELETE SET NULL,
  author_name         TEXT NOT NULL,
  author_avatar       TEXT,
  text                TEXT NOT NULL DEFAULT '',
  is_edited           BOOLEAN NOT NULL DEFAULT false,
  pinned_at           TIMESTAMPTZ,
  pinned_by           TEXT REFERENCES users(id) ON DELETE SET NULL,
  poll_question       TEXT,
  poll_multiple       BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(channel_id, project_channel_id, conversation_id) = 1)
);

CREATE INDEX messages_channel_idx ON messages (channel_id, created_at DESC) WHERE channel_id IS NOT NULL;
CREATE INDEX messages_project_channel_idx ON messages (project_channel_id, created_at DESC) WHERE project_channel_id IS NOT NULL;
CREATE INDEX messages_conversation_idx ON messages (conversation_id, created_at DESC) WHERE conversation_id IS NOT NULL;
CREATE INDEX messages_parent_idx ON messages (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX messages_author_idx ON messages (author_id);
CREATE INDEX messages_text_search_idx ON messages USING gin (text gin_trgm_ops);

CREATE TABLE message_attachments (
  id          BIGSERIAL PRIMARY KEY,
  message_id  TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  name        TEXT NOT NULL,
  type        TEXT,
  size        INTEGER
);

CREATE INDEX message_attachments_message_idx ON message_attachments (message_id);

CREATE TABLE message_mentions (
  message_id  TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX message_mentions_user_idx ON message_mentions (user_id);

CREATE TABLE message_reactions (
  message_id  TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE TABLE poll_options (
  id          TEXT NOT NULL,
  message_id  TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (message_id, id)
);

CREATE TABLE poll_votes (
  message_id  TEXT NOT NULL,
  option_id   TEXT NOT NULL,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, option_id, user_id),
  FOREIGN KEY (message_id, option_id) REFERENCES poll_options(message_id, id) ON DELETE CASCADE
);

CREATE TABLE scheduled_messages (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text                TEXT NOT NULL CHECK (length(text) <= 4000),
  target_type         TEXT NOT NULL CHECK (target_type IN ('channel', 'project', 'dm', 'gdm')),
  channel_id          TEXT REFERENCES channels(id) ON DELETE CASCADE,
  project_channel_id  TEXT REFERENCES project_channels(id) ON DELETE CASCADE,
  conversation_id     TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  dm_user_id          TEXT REFERENCES users(id) ON DELETE CASCADE,
  target_name         TEXT NOT NULL DEFAULT '',
  send_at             TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(channel_id, project_channel_id, conversation_id, dm_user_id) = 1)
);

CREATE INDEX scheduled_messages_send_idx ON scheduled_messages (send_at);

CREATE TABLE notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  target      JSONB,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON notifications (user_id) WHERE NOT is_read;

CREATE TABLE daily_active_users (
  day      DATE NOT NULL,
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (day, user_id)
);

CREATE TABLE daily_peak_online (
  day      DATE PRIMARY KEY,
  peak     INTEGER NOT NULL DEFAULT 0,
  peak_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO tier_settings (tier, name, icon, color, rank, file_mb, preset_themes, custom_theme) VALUES
  ('none', 'ทั่วไป', '', '#64748b', 0, 5, '{}', false),
  ('vip', 'VIP', '💎', '#c026d3', 1, 25, '{sakura,midnight}', true),
  ('supervip', 'SUPER VIP', '👑', '#f59e0b', 2, 50, '{sakura,midnight,ocean,forest}', true);
