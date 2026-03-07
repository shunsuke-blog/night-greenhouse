import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { calcWeekNumber, getDayUTCRange, localDateStr } from "@/lib/date-utils";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // ユーザーのタイムゾーンを取得
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("timezone")
      .eq("id", user.id)
      .maybeSingle();
    const timezone = profile?.timezone ?? "Asia/Tokyo";

    // 最初のログから週番号を計算（タイムゾーン対応）
    const { data: firstLog } = await supabase
      .from("daily_logs")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    const weekNumber = firstLog
      ? calcWeekNumber(new Date(firstLog.created_at), timezone)
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

    // 今日のログIDを取得（1日1回制限 + やり直し用）
    const today = localDateStr(new Date(), timezone);
    const { gte, lt } = getDayUTCRange(today);
    const { data: todayLogs } = await supabase
      .from("daily_logs")
      .select("id, created_at")
      .eq("user_id", user.id)
      .gte("created_at", gte)
      .lt("created_at", lt)
      .order("created_at", { ascending: false });

    const todayLog = todayLogs?.find(
      l => localDateStr(new Date(l.created_at), timezone) === today
    );

    return NextResponse.json({
      weekNumber,
      logCount: totalCount,
      unanalyzedCount,
      isDay7Ready: totalCount >= 7 && !alreadyAnalyzed,
      alreadyAnalyzed,
      today_log_id: todayLog?.id ?? null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
