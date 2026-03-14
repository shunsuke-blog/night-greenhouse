import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { calcWeekNumber, getDayUTCRange, appDateStr } from "@/lib/date-utils";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // Step1: プロフィール + 最初のログを並列取得
    const [profileResult, firstLogResult] = await Promise.all([
      supabase
        .from("user_profiles")
        .select("timezone, display_name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("daily_logs")
        .select("created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .single(),
    ]);

    const timezone = profileResult.data?.timezone ?? "Asia/Tokyo";
    const displayName = profileResult.data?.display_name ?? "";
    const weekNumber = firstLogResult.data
      ? calcWeekNumber(new Date(firstLogResult.data.created_at), timezone)
      : 1;

    // Step2: 今週のログ + 今日のログを並列取得
    const today = appDateStr(new Date(), timezone);
    const { gte, lt } = getDayUTCRange(today);

    const [weekLogsResult, todayLogsResult] = await Promise.all([
      supabase
        .from("daily_logs")
        .select("id, is_analyzed")
        .eq("user_id", user.id)
        .eq("week_number", weekNumber),
      supabase
        .from("daily_logs")
        .select("id, created_at, transcript")
        .eq("user_id", user.id)
        .gte("created_at", gte)
        .lt("created_at", lt)
        .order("created_at", { ascending: false }),
    ]);

    const weekLogs = weekLogsResult.data ?? [];
    const totalCount = weekLogs.length;
    const unanalyzedCount = weekLogs.filter(l => !l.is_analyzed).length;
    const alreadyAnalyzed = totalCount >= 7 && weekLogs.every(l => l.is_analyzed);

    const todayLogsFiltered = (todayLogsResult.data ?? []).filter(
      l => appDateStr(new Date(l.created_at), timezone) === today
    );
    const todayLog = todayLogsFiltered[0];

    return NextResponse.json({
      weekNumber,
      logCount: totalCount,
      unanalyzedCount,
      isDay7Ready: totalCount >= 7 && !alreadyAnalyzed,
      alreadyAnalyzed,
      today_log_id: todayLog?.id ?? null,
      today_log_transcript: todayLog?.transcript ?? null,
      today_log_count: todayLogsFiltered.length,
      display_name: displayName,
      timezone,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
