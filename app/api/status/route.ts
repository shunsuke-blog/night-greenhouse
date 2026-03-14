import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { calcWeekNumber, getDayUTCRange, appDateStr } from "@/lib/date-utils";
import { getAnalysisStatus } from "@/lib/subscription";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // プロフィール + 最初のログ + 今日のログを並列取得
    const today = appDateStr(new Date(), "Asia/Tokyo"); // timezoneはプロフィール取得後に補正
    const [profileResult, firstLogResult, analysisStatus] = await Promise.all([
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
      getAnalysisStatus(supabase, user.id),
    ]);

    const timezone = profileResult.data?.timezone ?? "Asia/Tokyo";
    const displayName = profileResult.data?.display_name ?? "";
    const weekNumber = firstLogResult.data
      ? calcWeekNumber(new Date(firstLogResult.data.created_at), timezone)
      : 1;

    // 今日のログ取得
    const todayStr = appDateStr(new Date(), timezone);
    const { gte, lt } = getDayUTCRange(todayStr);
    const { data: todayLogsData } = await supabase
      .from("daily_logs")
      .select("id, created_at, transcript")
      .eq("user_id", user.id)
      .gte("created_at", gte)
      .lt("created_at", lt)
      .order("created_at", { ascending: false });

    const todayLogsFiltered = (todayLogsData ?? []).filter(
      l => appDateStr(new Date(l.created_at), timezone) === todayStr
    );
    const todayLog = todayLogsFiltered[0];

    return NextResponse.json({
      weekNumber,
      timezone,
      display_name: displayName,
      today_log_id: todayLog?.id ?? null,
      today_log_transcript: todayLog?.transcript ?? null,
      today_log_count: todayLogsFiltered.length,
      // 分析ステータス
      unanalyzedCount: analysisStatus.unanalyzedCount,
      canAnalyze: analysisStatus.canAnalyze,
      freeAnalysesLeft: analysisStatus.freeAnalysesLeft,
      isSubscribed: analysisStatus.isSubscribed,
      isAdmin: analysisStatus.isAdmin,
      totalAnalysesCount: analysisStatus.totalAnalysesCount,
      cycleTarget: analysisStatus.cycleTarget,
      logsUntilNextAnalysis: analysisStatus.logsUntilNextAnalysis,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
