-- daily_logs から ai_response カラムを削除
-- AI返信はクライアント側の固定メッセージに移行したため不要
ALTER TABLE public.daily_logs DROP COLUMN IF EXISTS ai_response;
