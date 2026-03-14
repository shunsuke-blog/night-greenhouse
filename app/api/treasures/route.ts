import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 価値観一覧をレベル降順で取得
    const { data: treasures, error } = await supabase
      .from("treasure_collection")
      .select("id, treasure_name, level, description, keywords, fulfillment_state, threat_signal")
      .eq("user_id", user.id)
      .order("level", { ascending: false });

    if (error) throw error;

    // 各価値観の dig_sites（発掘場所）と元ログを取得
    const treasuresWithSites = await Promise.all(
      (treasures ?? []).map(async (treasure) => {
        const { data: sites } = await supabase
          .from("dig_sites")
          .select("id, site, log_id, daily_logs(transcript, emotion_score, created_at)")
          .eq("treasure_id", treasure.id)
          .order("created_at", { ascending: true });

        return { ...treasure, sites: sites ?? [] };
      })
    );

    return NextResponse.json(treasuresWithSites);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
