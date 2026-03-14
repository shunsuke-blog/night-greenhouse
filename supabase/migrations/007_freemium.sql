-- フリーミアムモデル用カラム追加
-- total_analyses_count: これまでに完了した分析の回数
-- total_logs_at_last_analysis: 最後の分析時点での累計ログ数
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS total_analyses_count        int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_logs_at_last_analysis int NOT NULL DEFAULT 0;
