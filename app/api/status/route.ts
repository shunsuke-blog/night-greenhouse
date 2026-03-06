import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 最初のログから week_number を計算
    const { data: firstLog } = await supabase
      .from("daily_logs")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    const weekNumber = firstLog
      ? Math.floor((Date.now() - new Date(firstLog.created_at).getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1
      : 1;

    // 今週のログを取得（is_analyzed フラグ込み）
    const { data: weekLogs } = await supabase
      .from("daily_logs")
      .select("id, is_analyzed")
      .eq("user_id", user.id)
      .eq("week_number", weekNumber);

    const totalCount = weekLogs?.length ?? 0;
    const unanalyzedCount = weekLogs?.filter(l => !l.is_analyzed).length ?? 0;
    const alreadyAnalyzed = totalCount >= 7 && (weekLogs?.every(l => l.is_analyzed) ?? false);

    return NextResponse.json({
      weekNumber,
      logCount: totalCount,
      unanalyzedCount,
      isDay7Ready: totalCount >= 7 && !alreadyAnalyzed,
      alreadyAnalyzed,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
