-- user_profiles にサブスクリプション管理カラムを追加

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id      text,
  ADD COLUMN IF NOT EXISTS subscription_status     text NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS trial_ends_at           timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end      timestamptz,
  ADD COLUMN IF NOT EXISTS is_admin                boolean NOT NULL DEFAULT false;

-- 既存ユーザーのトライアル終了日を created_at + 7日 か NOW + 7日 の大きい方に設定
-- (今後も7日間は無料で使えるよう猶予を設ける)
UPDATE user_profiles
SET trial_ends_at = GREATEST(
  created_at + INTERVAL '7 days',
  NOW()       + INTERVAL '7 days'
)
WHERE trial_ends_at IS NULL;

-- 将来の新規ユーザーはアプリ側で trial_ends_at を INSERT 時に設定する
