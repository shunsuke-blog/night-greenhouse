import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { calcWeekNumber } from "@/lib/date-utils";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** タイムゾーン対応の週番号を取得 */
async function getWeekNumber(supabase: SupabaseClient, userId: string, timezone: string): Promise<number> {
  const { data } = await supabase
    .from("daily_logs")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (!data) return 1;
  return calcWeekNumber(new Date(data.created_at), timezone);
}

export async function POST(req: Request) {
  try {
    const { transcript, emotion_score } = await req.json();

    if (!transcript?.trim()) {
      return NextResponse.json({ error: "メッセージが空です" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let log_id: string | null = null;
    if (user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("timezone")
        .eq("id", user.id)
        .maybeSingle();
      const timezone = profile?.timezone ?? "Asia/Tokyo";

      const week_number = await getWeekNumber(supabase, user.id, timezone);
      const { data: log } = await supabase
        .from("daily_logs")
        .insert({
          user_id: user.id,
          transcript,
          emotion_score: emotion_score ?? null,
          week_number,
        })
        .select("id")
        .single();
      log_id = log?.id ?? null;
    }

    return NextResponse.json({ log_id });
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { log_id, transcript, emotion_score } = await req.json();
    if (!log_id || !transcript?.trim()) {
      return NextResponse.json({ error: "log_id と transcript が必要です" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { error } = await supabase
      .from("daily_logs")
      .update({ transcript, emotion_score: emotion_score ?? null })
      .eq("id", log_id)
      .eq("user_id", user.id);

    if (error) throw error;
    return NextResponse.json({ log_id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
