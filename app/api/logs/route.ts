import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { GUIDE_SYSTEM_PROMPT } from "@/lib/prompts";
import { calcWeekNumber } from "@/lib/date-utils";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

// 開発用モック返答（DEV_MOCK_AI=true のとき使用）
const MOCK_RESPONSES = [
  "今日もここに来てくれたんですね。その一歩が、温室の土を少し温めました。…今夜、あなたの胸の中で一番重く感じているものは、何でしょう？",
  "言葉にするのが難しいことを、それでも話してくれた。そのことが、もう十分なんだと思います。…その出来事の中で、あなたが一番「自分らしくない」と感じた瞬間はどこでしたか？",
  "そこにある感情を、ありのままに受け取りました。…今その気持ちに、もし色をつけるとしたら、何色が浮かびますか？",
  "そういうことが重なると、疲れますよね。あなたがそれを感じていること自体が、あなたの繊細さの証明です。…その疲れの中で、少しだけ「ほっとした」瞬間はありましたか？",
  "その経験が今のあなたの中で生きていることが、伝わってきます。…もし過去の自分に一言声をかけられるとしたら、何と言いますか？",
  "ここまで話してくれて、ありがとうございます。…今夜、眠りにつく前に、あなたが「これだけは大切にしたい」と思うことは何ですか？",
  "7日間、ここに来てくれましたね。あなたの言葉はすべて、この温室の土になりました。…明日の朝、目覚めたとき、どんな気持ちでいたいですか？",
];

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

async function getLogCountForWeek(supabase: SupabaseClient, userId: string, weekNumber: number): Promise<number> {
  const { count } = await supabase
    .from("daily_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("week_number", weekNumber);
  return count ?? 0;
}

export async function POST(req: Request) {
  try {
    const { transcript, emotion_score } = await req.json();

    if (!transcript?.trim()) {
      return NextResponse.json({ error: "メッセージが空です" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // ユーザープロフィール（名前・タイムゾーン）を取得
    let displayName: string | undefined;
    let timezone = "Asia/Tokyo";
    if (user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("display_name, timezone")
        .eq("id", user.id)
        .maybeSingle();
      displayName = profile?.display_name ?? undefined;
      timezone = profile?.timezone ?? "Asia/Tokyo";
    }

    // AI 返答を生成（DEV_MOCK_AI=true のときはモックを使用）
    let ai_response: string;
    if (process.env.DEV_MOCK_AI === "true") {
      const logCount = user
        ? await getLogCountForWeek(supabase, user.id, await getWeekNumber(supabase, user.id, timezone))
        : 0;
      ai_response = MOCK_RESPONSES[Math.min(logCount, MOCK_RESPONSES.length - 1)];
    } else {
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: GUIDE_SYSTEM_PROMPT(displayName),
      });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: transcript }] }],
      });
      ai_response = result.response.text();
    }

    // 認証済みの場合は DB に保存
    let log_id: string | null = null;
    if (user) {
      const week_number = await getWeekNumber(supabase, user.id, timezone);
      const { data: log } = await supabase
        .from("daily_logs")
        .insert({
          user_id: user.id,
          transcript,
          emotion_score: emotion_score ?? null,
          ai_response,
          week_number,
        })
        .select("id")
        .single();
      log_id = log?.id ?? null;
    }

    return NextResponse.json({ text: ai_response, log_id });
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
