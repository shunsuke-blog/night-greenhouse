import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { localDateStr, getMonthUTCRange } from "@/lib/date-utils";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const year  = parseInt(searchParams.get("year")  ?? "");
    const month = parseInt(searchParams.get("month") ?? "");

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json({ error: "year と month は必須です" }, { status: 400 });
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

    // バッファ付きUTC範囲でログを取得（created_at のみ）
    const { gte, lt } = getMonthUTCRange(year, month);
    const { data: logs } = await supabase
      .from("daily_logs")
      .select("created_at")
      .eq("user_id", user.id)
      .gte("created_at", gte)
      .lt("created_at", lt);

    // タイムゾーン変換して暦日に変換し、指定月のものだけ残す
    const monthStr = `${year}-${String(month).padStart(2, "0")}`;
    const dates = [
      ...new Set(
        (logs ?? [])
          .map((l) => localDateStr(new Date(l.created_at), timezone))
          .filter((d) => d.startsWith(monthStr))
      ),
    ].sort();

    return NextResponse.json({ dates });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
