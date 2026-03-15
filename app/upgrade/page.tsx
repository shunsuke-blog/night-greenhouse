"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { FREE_ANALYSIS_COUNT } from "@/lib/subscription";

type ProfileStatus = {
  subscription_status: string;
  current_period_end: string | null;
  is_admin: boolean;
  total_analyses_count: number;
  created_at: string;
};

function UpgradeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  const [profile, setProfile] = useState<ProfileStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly");

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data } = await supabase
        .from("user_profiles")
        .select("subscription_status, current_period_end, is_admin, total_analyses_count, created_at")
        .eq("id", user.id)
        .maybeSingle();
      setProfile(data);
    })();
  }, [router]);

  const handleCheckout = async () => {
    setLoading(true);
    const res = await fetch("/api/stripe/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: selectedPlan }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setLoading(false);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    const res = await fetch("/api/stripe/create-portal", { method: "POST" });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setPortalLoading(false);
    }
  };

  const isActive = profile?.subscription_status === "active";
  const freeUsed = profile?.total_analyses_count ?? 0;
  const freeLeft = Math.max(0, FREE_ANALYSIS_COUNT - freeUsed);
  const hasAnalyzedData = freeUsed > 0;
  const withinFreePeriod = profile?.created_at
    ? new Date(profile.created_at).getTime() + 7 * 24 * 60 * 60 * 1000 > Date.now()
    : false;
  // 7日経過 & 未課金 & 分析データあり → 「データは保存されています」を表示
  const showDataSavedNotice = !isActive && !withinFreePeriod && hasAnalyzedData && !success;

  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-light tracking-widest text-emerald-400">プランを確認する</h1>
        <p className="text-xs text-slate-500">subscription</p>
      </div>

      {/* 成功・キャンセルメッセージ */}
      {success && (
        <div className="p-4 bg-emerald-900/30 border border-emerald-700/50 rounded-2xl text-center space-y-2">
          <p className="text-emerald-300 text-sm">ご契約ありがとうございます</p>
          <p className="text-slate-400 text-xs">引き続き心の土壌をお楽しみください。</p>
        </div>
      )}
      {canceled && (
        <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-2xl text-center">
          <p className="text-slate-400 text-sm">お支払いがキャンセルされました</p>
        </div>
      )}

      {/* 現在のステータス */}
      {profile && !success && (
        <div className="p-5 bg-slate-900/40 border border-slate-800/60 rounded-2xl space-y-4">
          <div className="space-y-1">
            <p className="text-xs text-slate-500">現在のプラン</p>
            {isActive ? (
              <p className="text-emerald-300 text-sm">月額プラン（¥450/月）</p>
            ) : (
              <p className="text-amber-300 text-sm">無料プラン</p>
            )}
          </div>

          {!isActive && (
            <div className="space-y-1">
              <p className="text-xs text-slate-500">無料分析の使用状況</p>
              <div className="flex gap-1.5 items-center">
                {Array.from({ length: FREE_ANALYSIS_COUNT }, (_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full border ${i < freeUsed
                      ? "bg-emerald-600 border-emerald-500"
                      : "bg-slate-800 border-slate-700"
                      }`}
                  />
                ))}
                <span className="text-xs text-slate-500 ml-1">
                  {freeUsed}/{FREE_ANALYSIS_COUNT} 回使用
                  {freeLeft > 0 ? `（あと ${freeLeft} 回）` : "（上限到達）"}
                </span>
              </div>
            </div>
          )}

          {isActive && profile.current_period_end && (
            <div className="space-y-1">
              <p className="text-xs text-slate-500">次回更新日</p>
              <p className="text-slate-300 text-sm">
                {new Date(profile.current_period_end).toLocaleDateString("ja-JP")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* データ保存済み通知 */}
      {showDataSavedNotice && (
        <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-2xl space-y-1">
          <p className="text-xs text-slate-400">
            ✦ これまでに発見した強みと価値観はすべて保存されています
          </p>
          <p className="text-xs text-slate-600">
            月額プランに登録すると、いつでも続きから閲覧・蓄積できます。
          </p>
        </div>
      )}

      {/* プラン説明 */}
      {!isActive && !success && (
        <div className="space-y-4">
          {/* プラン切り替えトグル */}
          <div className="flex rounded-xl overflow-hidden border border-slate-700">
            <button
              onClick={() => setSelectedPlan("monthly")}
              className={`flex-1 py-2 text-xs transition-colors ${selectedPlan === "monthly" ? "bg-emerald-800/60 text-emerald-200" : "text-slate-500 hover:text-slate-300"}`}
            >
              月額
            </button>
            <button
              onClick={() => setSelectedPlan("yearly")}
              className={`relative flex-1 py-2 text-xs transition-colors ${selectedPlan === "yearly" ? "bg-emerald-800/60 text-emerald-200" : "text-slate-500 hover:text-slate-300"}`}
            >
              年額
              <span className="absolute top-0.5 right-1.5 text-amber-400 text-[10px]">お得</span>
            </button>
          </div>

          <div className="p-5 bg-slate-900/40 border border-emerald-900/30 rounded-2xl space-y-4">
            <div className="flex items-baseline justify-between">
              <p className="text-emerald-300 text-base">
                {selectedPlan === "monthly" ? "月額プラン" : "年額プラン"}
              </p>
              {selectedPlan === "monthly" ? (
                <p className="text-emerald-400 text-lg font-light">¥480 <span className="text-xs text-slate-500">/ 月</span></p>
              ) : (
                <div className="text-right">
                  <p className="text-emerald-400 text-lg font-light">¥4,800 <span className="text-xs text-slate-500">/ 年</span></p>
                  <p className="text-xs text-amber-400">¥400/月相当</p>
                </div>
              )}
            </div>
            <ul className="space-y-2">
              {[
                "あなたのログに基づくAI自己分析（無制限）",
                "AIによる傾聴と問いかけ",
                "「強みの庭」「価値観の宝庫」への無制限アクセス",
                "強みと価値観の蓄積を振り返る",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="text-emerald-500 mt-0.5 shrink-0">✦</span>
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full py-3 bg-emerald-700/60 border border-emerald-600/50 rounded-xl text-emerald-100 text-sm tracking-wide hover:bg-emerald-700/80 transition-colors disabled:opacity-50"
            >
              {loading ? "Stripe へ移動中..." : selectedPlan === "monthly" ? "月額プランで始める" : "年額プランで始める"}
            </button>
            <p className="text-xs text-slate-600 text-center">
              クレジットカード決済 · いつでもキャンセル可能
            </p>
          </div>
        </div>
      )}

      {/* 解約（アクティブ時） */}
      {isActive && !success && (
        <button
          onClick={handlePortal}
          disabled={portalLoading}
          className="w-full py-3 border border-red-800/60 rounded-xl text-red-400 text-xs hover:bg-red-900/20 hover:border-red-700 transition-colors disabled:opacity-50"
        >
          {portalLoading ? "移動中..." : "解約する"}
        </button>
      )}

      <button
        onClick={() => router.push("/settings")}
        className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors"
      >
        ← 設定へ戻る
      </button>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center px-4 py-8 sm:px-6">
      <Suspense>
        <UpgradeContent />
      </Suspense>
    </main>
  );
}
