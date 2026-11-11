-- M1-04: staff push devices (Expo push tokens) + the push channel and the
-- skipped_no_device outbox status. Safe to run more than once.
BEGIN;

CREATE TABLE IF NOT EXISTS user_devices (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL,
  expo_push_token varchar(200) NOT NULL,
  platform        varchar(10) NOT NULL,
  device_label    varchar(80),
  app_version     varchar(20),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_user_devices_user_id FOREIGN KEY (user_id) REFERENCES users (uuid) ON DELETE CASCADE
);
ALTER TABLE user_devices DROP CONSTRAINT IF EXISTS chk_user_devices_platform;
ALTER TABLE user_devices
  ADD CONSTRAINT chk_user_devices_platform CHECK ("platform" IN ('android', 'ios'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_devices_token ON user_devices (expo_push_token);
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices (user_id);

-- `push` joins the channel enum (notification_outbox, notification_templates,
-- notification_rules) and `skipped_no_device` the outbox status enum.
ALTER TABLE notification_outbox DROP CONSTRAINT IF EXISTS chk_notification_outbox_channel;
ALTER TABLE notification_outbox ADD CONSTRAINT chk_notification_outbox_channel
  CHECK ("channel" IN ('in_app', 'whatsapp', 'sms', 'email', 'push'));

ALTER TABLE notification_outbox DROP CONSTRAINT IF EXISTS chk_notification_outbox_status;
ALTER TABLE notification_outbox ADD CONSTRAINT chk_notification_outbox_status
  CHECK ("status" IN ('queued', 'held_quiet_hours', 'sent', 'delivered', 'failed', 'skipped_disabled', 'skipped_opt_out', 'skipped_unverified', 'skipped_no_device'));

ALTER TABLE notification_templates DROP CONSTRAINT IF EXISTS chk_notification_templates_channel;
ALTER TABLE notification_templates ADD CONSTRAINT chk_notification_templates_channel
  CHECK ("channel" IN ('in_app', 'whatsapp', 'sms', 'email', 'push'));

ALTER TABLE notification_rules DROP CONSTRAINT IF EXISTS chk_notification_rules_channel;
ALTER TABLE notification_rules ADD CONSTRAINT chk_notification_rules_channel
  CHECK ("channel" IN ('in_app', 'whatsapp', 'sms', 'email', 'push'));

COMMIT;
