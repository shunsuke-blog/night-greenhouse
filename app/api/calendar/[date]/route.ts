import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { localDateStr, getDayUTCRange } from "@/lib/date-utils";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { date } = await params; // "YYYY-MM-DD"

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date は YYYY-MM-DD 形式で指定してください" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("timezone")
      .eq("id", user.id)
      .maybeSingle();
    const timezone = profile?.timezone ?? "Asia/Tokyo";

    // バッファ付きUTC範囲で取得し、タイムゾーン変換で当日分のみ残す
    const { gte, lt } = getDayUTCRange(date);
    const { data: logs } = await supabase
      .from("daily_logs")
      .select("id, transcript, emotion_score, created_at")
      .eq("user_id", user.id)
      .gte("created_at", gte)
      .lt("created_at", lt)
      .order("created_at", { ascending: true });

    const filtered = (logs ?? []).filter(
      (l) => localDateStr(new Date(l.created_at), timezone) === date
    );

    return NextResponse.json({ logs: filtered });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
