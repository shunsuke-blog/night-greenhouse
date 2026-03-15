import type { SupabaseClient } from "@supabase/supabase-js";

/** 無料で受けられる分析の最大回数 */
export const FREE_ANALYSIS_COUNT = 3;

/**
 * 各無料分析に必要な「前回分析からの新規ログ数」
 * 分析1: 2件、分析2: 2件、分析3: 3件
 */
export const ANALYSIS_THRESHOLDS = [2, 2, 3] as const;

/** 有料ユーザーの分析に必要なログ数 */
export const PAID_ANALYSIS_THRESHOLD = 3;

/**
 * 次の分析に必要な「前回分析からの新規ログ数」を返す。
 * 無料上限を超えており未課金の場合は null（分析不可）。
 */
export function getAnalysisThreshold(
  analysesCount: number,
  isSubscribed: boolean
): number | null {
  if (analysesCount < FREE_ANALYSIS_COUNT) {
    return ANALYSIS_THRESHOLDS[analysesCount];
  }
  if (isSubscribed) return PAID_ANALYSIS_THRESHOLD;
  return null;
}

export type AnalysisStatus = {
  canAnalyze: boolean;
  freeAnalysesLeft: number;   // 残り無料分析回数（0〜3）
  isSubscribed: boolean;
  isAdmin: boolean;
  totalAnalysesCount: number;
  unanalyzedCount: number;    // 前回分析以降のログ数
  cycleTarget: number;        // 現サイクルのランプ上限（2 / 2 / 3）
  logsUntilNextAnalysis: number; // あと何件で分析可能か（0なら今すぐ可能）
};

/**
 * ユーザーの分析可否・進捗を一括取得する。
 */
export async function getAnalysisStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<AnalysisStatus> {
  const [profileResult, logCountResult] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("is_admin, subscription_status, total_analyses_count, total_logs_at_last_analysis")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("daily_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  const isAdmin = profileResult.data?.is_admin ?? false;
  const subscriptionStatus = profileResult.data?.subscription_status ?? "none";
  const isSubscribed = subscriptionStatus === "active" || isAdmin;
  const totalAnalysesCount = profileResult.data?.total_analyses_count ?? 0;
  const totalLogsAtLastAnalysis = profileResult.data?.total_logs_at_last_analysis ?? 0;
  const totalLogsCount = logCountResult.count ?? 0;

  const unanalyzedCount = totalLogsCount - totalLogsAtLastAnalysis;
  const freeAnalysesLeft = Math.max(0, FREE_ANALYSIS_COUNT - totalAnalysesCount);

  const threshold = getAnalysisThreshold(totalAnalysesCount, isSubscribed);

  let canAnalyze: boolean;
  let logsUntilNextAnalysis: number;

  if (threshold === null) {
    // 無料上限到達 & 未課金
    canAnalyze = false;
    logsUntilNextAnalysis = 0;
  } else {
    canAnalyze = unanalyzedCount >= threshold;
    logsUntilNextAnalysis = Math.max(0, threshold - unanalyzedCount);
  }

  // 現サイクルのランプ上限
  let cycleTarget: number;
  if (totalAnalysesCount < FREE_ANALYSIS_COUNT) {
    cycleTarget = ANALYSIS_THRESHOLDS[totalAnalysesCount];
  } else if (isSubscribed) {
    cycleTarget = PAID_ANALYSIS_THRESHOLD;
  } else {
    cycleTarget = PAID_ANALYSIS_THRESHOLD; // 未課金でも表示用に3
  }

  return {
    canAnalyze,
    freeAnalysesLeft,
    isSubscribed,
    isAdmin,
    totalAnalysesCount,
    unanalyzedCount,
    cycleTarget,
    logsUntilNextAnalysis,
  };
}

import { FREE_TRIAL_DAYS } from "@/lib/constants";

/** 無料トライアル期間（ms） */
export const FREE_TRIAL_MS = FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000;

/**
 * 強み一覧・価値観一覧ページへのアクセス権チェック。
 * 有料ユーザー(active) または管理者のみ許可。
 */
export async function checkPremiumAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("user_profiles")
    .select("is_admin, subscription_status")
    .eq("id", userId)
    .maybeSingle();

  if (!data) return false;
  if (data.is_admin) return true;
  return data.subscription_status === "active";
}

/**
 * 無料トライアル期間中を含むアクセス権チェック。
 * seeds/page・treasures/page で使用。
 */
export function hasAccessWithFreeTrial(profile: {
  is_admin?: boolean;
  subscription_status?: string;
  created_at?: string;
} | null): boolean {
  if (!profile) return false;
  if (profile.is_admin) return true;
  if (profile.subscription_status === "active") return true;
  if (!profile.created_at) return false;
  return new Date(profile.created_at).getTime() + FREE_TRIAL_MS > Date.now();
}
