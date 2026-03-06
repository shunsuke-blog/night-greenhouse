-- user_profiles にタイムゾーンを追加（デフォルト: 日本時間）
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Tokyo';
