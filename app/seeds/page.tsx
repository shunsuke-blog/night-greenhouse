"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Root = {
  id: string;
  root: string;
  log_id: string;
  daily_logs: {
    transcript: string;
    emotion_score: number | null;
    created_at: string;
  } | null;
};

type Flower = {
  id: string;
  flower_name: string;
  level: number;
  os_description: string | null;
  logic_reflection: string | null;
  environment_condition: string | null;
  roots: Root[];
};

function FlowerCard({ flower }: { flower: Flower }) {
  const [open, setOpen] = useState(false);
  const [openRootId, setOpenRootId] = useState<string | null>(null);

  return (
    <div className="border border-slate-800 rounded-2xl overflow-hidden">
      {/* カードヘッダー */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-5 text-left hover:bg-slate-900/40 transition-colors"
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-lg font-light text-emerald-300 tracking-wide">{flower.flower_name}</p>
            {flower.os_description && (
              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                {flower.os_description}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0 ml-4">
            <span className="text-xs bg-emerald-900/40 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded-full">
              Lv.{flower.level}
            </span>
            <span className="text-xs text-slate-700">{flower.roots.length}件の根</span>
          </div>
        </div>
      </button>

      {/* 展開：詳細 + 根っこ一覧 */}
      {open && (
        <div className="border-t border-slate-800/60 bg-slate-950/40">
          {/* 詳細分析 */}
          <div className="p-5 space-y-3">
            {flower.os_description && (
              <div className="space-y-1">
                <p className="text-xs text-emerald-700 tracking-wider">花の解説</p>
                <p className="text-sm text-slate-300 leading-relaxed">{flower.os_description}</p>
              </div>
            )}
            {flower.logic_reflection && (
              <div className="space-y-1">
                <p className="text-xs text-slate-600 tracking-wider">過去の苦しみの再定義</p>
                <p className="text-sm text-slate-400 leading-relaxed">{flower.logic_reflection}</p>
              </div>
            )}
            {flower.environment_condition && (
              <div className="space-y-1">
                <p className="text-xs text-slate-600 tracking-wider">輝ける土壌</p>
                <p className="text-sm text-slate-400 leading-relaxed">{flower.environment_condition}</p>
              </div>
            )}
          </div>

          {/* 根っこ（根拠エピソード） */}
          {flower.roots.length > 0 && (
            <div className="border-t border-slate-800/40 p-5 space-y-2">
              <p className="text-xs text-slate-600 tracking-wider mb-3">根っこ（証拠）</p>
              {flower.roots.map((root) => (
                <div key={root.id} className="space-y-1">
                  <button
                    onClick={() => setOpenRootId(openRootId === root.id ? null : root.id)}
                    className="w-full text-left p-3 bg-slate-900/60 border border-slate-800 rounded-xl hover:border-emerald-900/60 transition-colors"
                  >
                    <p className="text-xs text-slate-400 leading-relaxed">{root.root}</p>
                    <p className="text-xs text-slate-700 mt-1">
                      {openRootId === root.id ? "▲ 閉じる" : "▼ 元のエピソードを見る"}
                    </p>
                  </button>

                  {openRootId === root.id && root.daily_logs && (
                    <div className="ml-3 p-3 bg-slate-900/30 border-l border-emerald-900/40 rounded-r-xl">
                      {root.daily_logs.emotion_score !== null && (
                        <p className="text-xs text-slate-600 mb-1">
                          感情スコア: {root.daily_logs.emotion_score}/10
                        </p>
                      )}
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {root.daily_logs.transcript}
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

export default function FlowersPage() {
  const [flowers, setFlowers] = useState<Flower[]>([]);
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
      const withinFreePeriod = profile?.created_at
        ? new Date(profile.created_at).getTime() + 7 * 24 * 60 * 60 * 1000 > Date.now()
        : false;
      const hasAccess =
        profile?.is_admin ||
        profile?.subscription_status === "active" ||
        withinFreePeriod;
      if (!hasAccess) { router.push("/upgrade"); return; }
      fetch("/api/flowers")
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setFlowers(data); })
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
          <h1 className="text-xl font-light tracking-widest text-emerald-400">強みの庭</h1>
          <p className="text-xs text-slate-600 mt-1">積み重ねられた、あなたの性質たち</p>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-600 text-sm animate-pulse text-center py-12">読み込み中...</p>
      ) : flowers.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-slate-600 text-sm">まだ花が咲いていません</p>
          <p className="text-slate-700 text-xs">7日間ログを記録すると、強みの花が咲きます</p>
        </div>
      ) : (
        <div className="space-y-3">
          {flowers.map((flower) => (
            <FlowerCard key={flower.id} flower={flower} />
          ))}
        </div>
      )}
    </main>
  );
}
