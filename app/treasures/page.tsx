"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { hasAccessWithFreeTrial } from "@/lib/subscription";

type DigSite = {
  id: string;
  site: string;
  log_id: string;
  daily_logs: {
    transcript: string;
    emotion_score: number | null;
    created_at: string;
  } | null;
};

type Treasure = {
  id: string;
  treasure_name: string;
  level: number;
  description: string | null;
  keywords: string[] | null;
  fulfillment_state: string | null;
  threat_signal: string | null;
  sites: DigSite[];
};

function TreasureCard({ treasure }: { treasure: Treasure }) {
  const [open, setOpen] = useState(false);
  const [openSiteId, setOpenSiteId] = useState<string | null>(null);

  return (
    <div className="border border-slate-800 rounded-2xl overflow-hidden">
      {/* カードヘッダー */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-5 text-left hover:bg-slate-900/40 transition-colors"
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-lg font-light text-amber-300 tracking-wide">{treasure.treasure_name}</p>
            {treasure.description && (
              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                {treasure.description}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0 ml-4">
            <span className="text-xs bg-amber-900/40 text-amber-400 border border-amber-800/50 px-2 py-0.5 rounded-full">
              Lv.{treasure.level}
            </span>
            <span className="text-xs text-slate-700">{treasure.sites.length}件の発掘場所</span>
          </div>
        </div>
      </button>

      {/* 展開：詳細 + 発掘場所一覧 */}
      {open && (
        <div className="border-t border-slate-800/60 bg-slate-950/40">
          {/* 詳細 */}
          <div className="p-5 space-y-3">
            {treasure.description && (
              <div className="space-y-1">
                <p className="text-xs text-amber-700 tracking-wider">宝物の解説</p>
                <p className="text-sm text-slate-300 leading-relaxed">{treasure.description}</p>
              </div>
            )}
            {treasure.fulfillment_state && (
              <div className="space-y-1">
                <p className="text-xs text-amber-700 tracking-wider">✦ さらに光輝かせるために(価値観が満たされているとき)</p>
                <p className="text-sm text-slate-300 leading-relaxed">{treasure.fulfillment_state}</p>
              </div>
            )}
            {treasure.threat_signal && (
              <div className="space-y-1">
                <p className="text-xs text-amber-700 tracking-wider">⚠ 宝を失わないために(価値観が脅かされているサイン)</p>
                <p className="text-sm text-slate-300 leading-relaxed">{treasure.threat_signal}</p>
              </div>
            )}
            {treasure.keywords && treasure.keywords.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-600 tracking-wider">キーワード</p>
                <div className="flex flex-wrap gap-2">
                  {treasure.keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 bg-amber-900/30 border border-amber-800/40 text-amber-400 rounded-full"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 発掘場所（根拠エピソード） */}
          {treasure.sites.length > 0 && (
            <div className="border-t border-slate-800/40 p-5 space-y-2">
              <p className="text-xs text-slate-600 tracking-wider mb-3">発掘場所（証拠）</p>
              {treasure.sites.map((site) => (
                <div key={site.id} className="space-y-1">
                  <button
                    onClick={() => setOpenSiteId(openSiteId === site.id ? null : site.id)}
                    className="w-full text-left p-3 bg-slate-900/60 border border-slate-800 rounded-xl hover:border-amber-900/60 transition-colors"
                  >
                    <p className="text-xs text-slate-400 leading-relaxed">{site.site}</p>
                    <p className="text-xs text-slate-700 mt-1">
                      {openSiteId === site.id ? "▲ 閉じる" : "▼ 元のエピソードを見る"}
                    </p>
                  </button>

                  {openSiteId === site.id && site.daily_logs && (
                    <div className="ml-3 p-3 bg-slate-900/30 border-l border-amber-900/40 rounded-r-xl">
                      {site.daily_logs.emotion_score !== null && (
                        <p className="text-xs text-slate-600 mb-1">
                          感情スコア: {site.daily_logs.emotion_score}/10
                        </p>
                      )}
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {site.daily_logs.transcript}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TreasuresPage() {
  const [treasures, setTreasures] = useState<Treasure[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("is_admin, subscription_status, created_at")
        .eq("id", user.id)
        .maybeSingle();
      if (!hasAccessWithFreeTrial(profile)) { router.push("/upgrade"); return; }
      fetch("/api/treasures")
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setTreasures(data); })
        .finally(() => setLoading(false));
    })();
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 px-4 py-6 sm:px-6 max-w-lg mx-auto space-y-6">
      <div className="relative flex items-center justify-center pt-4">
        <Link href="/" className="absolute left-0 text-xs text-slate-600 hover:text-slate-400 transition-colors">
          ← 温室へ戻る
        </Link>
        <div className="text-center">
          <h1 className="text-xl font-light tracking-widest text-amber-400">価値観の宝庫</h1>
          <p className="text-xs text-slate-600 mt-1">あなたが大切にしてきた、宝物たち</p>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-600 text-sm animate-pulse text-center py-12">読み込み中...</p>
      ) : treasures.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-slate-600 text-sm">まだ宝物が見つかっていません</p>
          <p className="text-slate-700 text-xs">3日間ログを記録すると、価値観の宝物が現れます</p>
        </div>
      ) : (
        <div className="space-y-3">
          {treasures.map((treasure) => (
            <TreasureCard key={treasure.id} treasure={treasure} />
          ))}
        </div>
      )}
    </main>
  );
}
