import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { FRAGMENT_ANALYZE_PROMPT, VALUE_ANALYZE_PROMPT, ANALYZE_SYSTEM_PROMPT } from "@/lib/prompts";
import { getAnalysisStatus } from "@/lib/subscription";
import { RATE_LIMIT_MS } from "@/lib/constants";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 分析可否チェック
    const status = await getAnalysisStatus(supabase, user.id);
    if (!status.canAnalyze) {
      if (status.freeAnalysesLeft === 0 && !status.isSubscribed) {
        return NextResponse.json({ error: "subscription_required" }, { status: 402 });
      }
      return NextResponse.json(
        { error: `あと ${status.logsUntilNextAnalysis} 件のログで分析できます` },
        { status: 400 }
      );
    }

    // レート制限: 直近の分析完了から24時間以内は拒否
    const { data: recentAnalyzed } = await supabase
      .from("daily_logs")
      .select("updated_at")
      .eq("user_id", user.id)
      .eq("is_analyzed", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentAnalyzed?.updated_at) {
      const elapsed = Date.now() - new Date(recentAnalyzed.updated_at).getTime();
      if (elapsed < RATE_LIMIT_MS) {
        const waitMin = Math.ceil((RATE_LIMIT_MS - elapsed) / 60_000);
        return NextResponse.json(
          { error: `分析は24時間に1回です。あと約${waitMin}分後にお試しください。` },
          { status: 429 }
        );
      }
    }

    // 未分析ログを取得（前回分析以降の全件）
    const { data: logs, error: logsError } = await supabase
      .from("daily_logs")
      .select("id, transcript, emotion_score, is_analyzed, week_number")
      .eq("user_id", user.id)
      .eq("is_analyzed", false)
      .order("created_at", { ascending: true });

    if (logsError || !logs || logs.length === 0) {
      return NextResponse.json({ error: "分析対象のログがありません" }, { status: 400 });
    }

    const logInputs = logs.map((l, i) => ({
      index: i,
      transcript: l.transcript,
      emotion_score: l.emotion_score,
    }));

    // 既存の花・価値観を取得（並列）
    const [{ data: existingFlowers }, { data: existingTreasures }] = await Promise.all([
      supabase.from("flower_collection").select("id, flower_name").eq("user_id", user.id),
      supabase.from("treasure_collection").select("id, treasure_name").eq("user_id", user.id),
    ]);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    // 強み分析・価値観分析・OS命名を並列実行
    const logText = logInputs.map((l) => `Day${l.index + 1}（感情スコア: ${l.emotion_score ?? "未回答"}）\n${l.transcript}`).join("\n\n---\n\n");
    const [flowerResult, treasureResult, seedResult] = await Promise.all([
      model.generateContent(FRAGMENT_ANALYZE_PROMPT(logInputs, existingFlowers ?? [])),
      model.generateContent(VALUE_ANALYZE_PROMPT(logInputs, existingTreasures ?? [])),
      model.generateContent({ contents: [{ role: "user", parts: [{ text: logText }] }], systemInstruction: ANALYZE_SYSTEM_PROMPT }),
    ]);

    // ── 強みの処理 ────────────────────────────────────────────────────────────
    type FlowerFragment = {
      roots: { log_index: number; root: string }[];
      is_new_flower: boolean;
      flower_id?: string;
      flower_name?: string;
      os_description?: string;
      logic_reflection?: string;
      environment_condition?: string;
    };

    let flowerFragments: FlowerFragment[];
    try {
      const parsed = JSON.parse(flowerResult.response.text()) as { fragments: FlowerFragment[] };
      flowerFragments = parsed.fragments ?? [];
    } catch {
      console.error("強み分析JSONパース失敗:", flowerResult.response.text());
      return NextResponse.json({ error: "強み分析結果の解析に失敗しました。再度お試しください。" }, { status: 422 });
    }

    // 既存花のレベルを一括取得（N+1解消）
    const existingFlowerIds = flowerFragments
      .filter(f => !f.is_new_flower && f.flower_id)
      .map(f => f.flower_id!);
    const { data: existingFlowerLevels } = existingFlowerIds.length > 0
      ? await supabase.from("flower_collection").select("id, level").in("id", existingFlowerIds)
      : { data: [] as { id: string; level: number }[] };
    const flowerLevelMap = new Map(existingFlowerLevels?.map(f => [f.id, f.level]) ?? []);

    const flowerCache: Record<string, string> = {};
    const allRootInserts: { user_id: string; flower_id: string; log_id: string; root: string }[] = [];

    for (const fragment of flowerFragments) {
      const rootEntries = (fragment.roots ?? [])
        .map(r => ({ log: logs[r.log_index], root: r.root }))
        .filter(r => r.log != null);
      if (rootEntries.length === 0) continue;

      let flower_id: string;
      const flowerLevelGain = Math.ceil(Math.sqrt(rootEntries.length));

      if (!fragment.is_new_flower && fragment.flower_id) {
        flower_id = fragment.flower_id;
        const currentLevel = flowerLevelMap.get(flower_id) ?? 1;
        await supabase
          .from("flower_collection")
          .update({ level: currentLevel + flowerLevelGain })
          .eq("id", flower_id);
        flowerLevelMap.set(flower_id, currentLevel + flowerLevelGain);
      } else {
        const name = fragment.flower_name ?? "名もなき強み";
        if (flowerCache[name]) {
          flower_id = flowerCache[name];
          const currentLevel = flowerLevelMap.get(flower_id) ?? 1;
          await supabase
            .from("flower_collection")
            .update({ level: currentLevel + flowerLevelGain })
            .eq("id", flower_id);
          flowerLevelMap.set(flower_id, currentLevel + flowerLevelGain);
        } else {
          const { data: newFlower, error: insertError } = await supabase
            .from("flower_collection")
            .insert({
              user_id: user.id,
              flower_name: name,
              os_description: fragment.os_description ?? null,
              logic_reflection: fragment.logic_reflection ?? null,
              environment_condition: fragment.environment_condition ?? null,
              level: flowerLevelGain,
            })
            .select("id")
            .single();
          if (insertError || !newFlower) {
            throw new Error(`花の作成に失敗しました: ${insertError?.message ?? "newFlower is null"}`);
          }
          flower_id = newFlower.id;
          flowerCache[name] = flower_id;
          flowerLevelMap.set(flower_id, flowerLevelGain);
        }
      }

      for (const { log, root } of rootEntries) {
        allRootInserts.push({ user_id: user.id, flower_id, log_id: log.id, root });
      }
    }

    // root_elements を一括INSERT（N+1解消）
    if (allRootInserts.length > 0) {
      await supabase.from("root_elements").insert(allRootInserts);
    }

    // ── 価値観の処理 ──────────────────────────────────────────────────────────
    type TreasureFragment = {
      sites: { log_index: number; site: string }[];
      is_new_treasure: boolean;
      treasure_id?: string;
      treasure_name?: string;
      description?: string;
      keywords?: string[];
      fulfillment_state?: string;
      threat_signal?: string;
    };

    let treasureFragments: TreasureFragment[];
    try {
      const parsed = JSON.parse(treasureResult.response.text()) as { fragments: TreasureFragment[] };
      treasureFragments = parsed.fragments ?? [];
    } catch {
      console.error("価値観分析JSONパース失敗:", treasureResult.response.text());
      return NextResponse.json({ error: "価値観分析結果の解析に失敗しました。再度お試しください。" }, { status: 422 });
    }

    // 既存価値観のレベルを一括取得（N+1解消）
    const existingTreasureIds = treasureFragments
      .filter(f => !f.is_new_treasure && f.treasure_id)
      .map(f => f.treasure_id!);
    const { data: existingTreasureLevels } = existingTreasureIds.length > 0
      ? await supabase.from("treasure_collection").select("id, level").in("id", existingTreasureIds)
      : { data: [] as { id: string; level: number }[] };
    const treasureLevelMap = new Map(existingTreasureLevels?.map(t => [t.id, t.level]) ?? []);

    const treasureCache: Record<string, string> = {};
    const allDigSiteInserts: { user_id: string; treasure_id: string; log_id: string; site: string }[] = [];

    for (const fragment of treasureFragments) {
      const siteEntries = (fragment.sites ?? [])
        .map(s => ({ log: logs[s.log_index], site: s.site }))
        .filter(s => s.log != null);
      if (siteEntries.length === 0) continue;

      let treasure_id: string;
      const treasureLevelGain = Math.ceil(Math.sqrt(siteEntries.length));

      if (!fragment.is_new_treasure && fragment.treasure_id) {
        treasure_id = fragment.treasure_id;
        const currentLevel = treasureLevelMap.get(treasure_id) ?? 1;
        await supabase
          .from("treasure_collection")
          .update({ level: currentLevel + treasureLevelGain })
          .eq("id", treasure_id);
        treasureLevelMap.set(treasure_id, currentLevel + treasureLevelGain);
      } else {
        const name = fragment.treasure_name ?? "名もなき価値観";
        if (treasureCache[name]) {
          treasure_id = treasureCache[name];
          const currentLevel = treasureLevelMap.get(treasure_id) ?? 1;
          await supabase
            .from("treasure_collection")
            .update({ level: currentLevel + treasureLevelGain })
            .eq("id", treasure_id);
          treasureLevelMap.set(treasure_id, currentLevel + treasureLevelGain);
        } else {
          const { data: newTreasure, error: insertError } = await supabase
            .from("treasure_collection")
            .insert({
              user_id: user.id,
              treasure_name: name,
              description: fragment.description ?? null,
              keywords: fragment.keywords ?? [],
              fulfillment_state: fragment.fulfillment_state ?? null,
              threat_signal: fragment.threat_signal ?? null,
              level: treasureLevelGain,
            })
            .select("id")
            .single();
          if (insertError || !newTreasure) {
            throw new Error(`価値観の作成に失敗しました: ${insertError?.message ?? "newTreasure is null"}`);
          }
          treasure_id = newTreasure.id;
          treasureCache[name] = treasure_id;
          treasureLevelMap.set(treasure_id, treasureLevelGain);
        }
      }

      for (const { log, site } of siteEntries) {
        allDigSiteInserts.push({ user_id: user.id, treasure_id, log_id: log.id, site });
      }
    }

    // dig_sites を一括INSERT（N+1解消）
    if (allDigSiteInserts.length > 0) {
      await supabase.from("dig_sites").insert(allDigSiteInserts);
    }

    // ── タネ（OS命名）の処理 ──────────────────────────────────────────────────
    let seedData: { seed_name: string; os_description: string; logic_reflection: string; environment_condition: string };
    try {
      seedData = JSON.parse(seedResult.response.text());
    } catch {
      console.error("タネ分析JSONパース失敗:", seedResult.response.text());
      // タネのパース失敗は致命的ではないため処理を継続
      seedData = { seed_name: "", os_description: "", logic_reflection: "", environment_condition: "" };
    }

    if (seedData.seed_name) {
      const week_number = logs[0]?.week_number ?? 1;
      await supabase.from("seeds_collection").upsert(
        { user_id: user.id, week_number, ...seedData },
        { onConflict: "user_id,week_number" }
      );
    }

    // ログを分析済みにマーク
    const logIds = logs.map(l => l.id);
    await supabase
      .from("daily_logs")
      .update({ is_analyzed: true })
      .in("id", logIds);

    // 累計ログ数を取得してプロフィール更新
    const { count: totalLogsCount } = await supabase
      .from("daily_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    await supabase
      .from("user_profiles")
      .update({
        total_analyses_count: status.totalAnalysesCount + 1,
        total_logs_at_last_analysis: totalLogsCount ?? 0,
      })
      .eq("id", user.id);

    // 更新後の花・価値観一覧を返す（並列）
    const [{ data: updatedFlowers }, { data: updatedTreasures }] = await Promise.all([
      supabase
        .from("flower_collection")
        .select("id, flower_name, level")
        .eq("user_id", user.id)
        .order("level", { ascending: false }),
      supabase
        .from("treasure_collection")
        .select("id, treasure_name, level")
        .eq("user_id", user.id)
        .order("level", { ascending: false }),
    ]);

    return NextResponse.json({
      flowers: updatedFlowers ?? [],
      fragment_count: flowerFragments.length,
      treasures: updatedTreasures ?? [],
      treasure_count: treasureFragments.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Analyze Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
