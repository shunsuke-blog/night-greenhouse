import { createBrowserClient } from '@supabase/ssr'

// ビルド時ではなく実際に使用される瞬間に生成（SSR/プリレンダリング対策）
let _client: ReturnType<typeof createBrowserClient> | null = null

function getClient() {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _client
}

// 既存の supabase.auth.xxx の書き方をそのまま使えるよう Proxy でラップ
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_, prop: string) {
    return (getClient() as any)[prop]
  }
})

export type DailyLog = {
  id: string
  user_id: string
  created_at: string
  week_number: number
  transcript: string
  emotion_score: number | null
  ai_response: string | null
  is_analyzed: boolean
}

export type Seed = {
  id: string
  user_id: string
  week_number: number
  analyzed_at: string
  seed_name: string
  os_description: string | null
  logic_reflection: string | null
  environment_condition: string | null
}
