"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { PlantAnimation, getPlantStage } from "@/components/PlantAnimation";
import { useMotionValue, useSpring } from "framer-motion";

type AnalyzeResult = {
  flowers: { id: string; flower_name: string; level: number }[];
  fragment_count: number;
};

type DayStatus = {
  logCount: number;
  unanalyzedCount: number;
  weekNumber: number;
  isDay7Ready: boolean;
  alreadyAnalyzed: boolean;
};

export default function NightGreenhouse() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [emotionScore, setEmotionScore] = useState<number | null>(null);
  const [dayStatus, setDayStatus] = useState<DayStatus | null>(null);
  const [cycleLogCount, setCycleLogCount] = useState(0);
  const cycleInitialized = useRef(false);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const router = useRouter();

  // ─── 音量（土グロー用） ───
  const rawVolume = useMotionValue(0);
  const smoothVolume = useSpring(rawVolume, { damping: 18, stiffness: 200 });

  const audioCtxRef  = useRef<AudioContext | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const rafRef       = useRef<number | null>(null);

  // アンマウント時に音声リソースを解放
  useEffect(() => {
    return () => { stopVolumeTracking(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // プロフィール取得 + タイムゾーン自動保存
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("display_name, timezone")
        .eq("id", user.id)
        .maybeSingle();

      setDisplayName(profile?.display_name ?? "");

      // ブラウザのタイムゾーンが未保存 or 変わっていたら更新
      if (!profile || profile.timezone !== browserTz) {
        await supabase
          .from("user_profiles")
          .upsert({ id: user.id, timezone: browserTz });
      }
    };
    loadProfile();
  }, []);

  useEffect(() => {
    fetchDayStatus();

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recog = new SpeechRecognition();
      recog.lang = "ja-JP";
      recog.continuous = true;
      recog.interimResults = true;
      recog.onresult = (event: any) => {
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript;
        }
        setTranscript((prev) => prev + final);
      };
      setRecognition(recog);
    }
  }, []);

  const fetchDayStatus = async () => {
    try {
      const res = await fetch("/api/status");
      if (res.ok) {
        const data = await res.json();
        setDayStatus(data);
        // 初回のみDBから未分析ログ数でカウントを初期化
        if (!cycleInitialized.current) {
          setCycleLogCount(data.alreadyAnalyzed ? 0 : (data.unanalyzedCount ?? 0));
          cycleInitialized.current = true;
        }
      }
    } catch { }
  };

  const startVolumeTracking = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((sum, v) => sum + v, 0) / (data.length * 255);
        rawVolume.set(avg);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch { /* マイクアクセス拒否 → 無音で継続 */ }
  };

  const stopVolumeTracking = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    rawVolume.set(0);
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognition?.stop();
      stopVolumeTracking();
      if (transcript.trim()) sendToLogs(transcript);
    } else {
      setTranscript("");
      setAiResponse("");
      recognition?.start();
      startVolumeTracking();
    }
    setIsRecording(!isRecording);
  };

  const sendToLogs = async (text: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text, emotion_score: emotionScore }),
      });
      const data = await res.json();
      setAiResponse(data.text);
      setCycleLogCount(prev => prev + 1);
      await fetchDayStatus();
    } catch {
      setAiResponse("（案内人が静かに頷いています。通信が少し不安定なようです）");
    } finally {
      setIsLoading(false);
    }
  };

  const runAnalyze = async () => {
    if (!dayStatus) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_number: dayStatus.weekNumber }),
      });
      const data = await res.json();
      if (res.ok) {
        setAnalyzeResult(data);
        setCycleLogCount(0);
        await fetchDayStatus();
      } else {
        setAiResponse(data.error ?? "分析に失敗しました");
      }
    } catch {
      setAiResponse("分析中にエラーが発生しました");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const canRecord = emotionScore !== null;
  const plantStage = analyzeResult ? "flower" : getPlantStage(cycleLogCount);

  // 分析完了後の表示
  if (analyzeResult) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center px-4 py-8 sm:px-6 gap-5">
        <h1 className="text-2xl font-light tracking-widest text-emerald-400">夜の温室</h1>

        {/* 花が咲いた植物 */}
        <PlantAnimation stage="flower" />

        <p className="text-xs text-slate-500 tracking-widest">— 花が咲きました —</p>

        <div className="max-w-md w-full space-y-4">
          <div className="text-center">
            <p className="text-slate-400 text-sm">
              今週の言葉から <span className="text-emerald-300 text-lg">{analyzeResult.fragment_count}</span> 個の強みの断片が見つかりました
            </p>
          </div>

          <div className="space-y-2">
            {analyzeResult.flowers.map((flower) => (
              <div key={flower.id} className="flex items-center justify-between p-4 bg-slate-900/40 border border-slate-800 rounded-xl">
                <p className="text-sm text-emerald-300">{flower.flower_name}</p>
                <span className="text-xs text-emerald-600 border border-emerald-900/50 px-2 py-0.5 rounded-full">
                  Lv.{flower.level}
                </span>
              </div>
            ))}
          </div>

          <Link
            href="/seeds"
            className="block w-full py-4 text-center bg-emerald-900/30 border border-emerald-700/50 rounded-2xl text-emerald-300 text-sm tracking-wide hover:bg-emerald-900/50 transition-all"
          >
            強みの庭を見る →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center px-4 py-8 sm:px-6 gap-5">

      {/* タイトル + 左:カレンダー / 右:設定 */}
      <div className="w-full max-w-md relative flex items-center justify-center">
        <h1 className="text-2xl font-light tracking-widest text-emerald-400">夜の温室</h1>
        {/* カレンダーボタン（左） */}
        <Link
          href="/calendar"
          className="absolute left-0 w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-slate-900/60 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-all"
          aria-label="記録の庭"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="16" y1="2" x2="16" y2="6" />
          </svg>
        </Link>
        {/* 設定ボタン（右） */}
        <Link
          href="/settings"
          className="absolute right-0 w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-slate-900/60 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-all text-3xl leading-none"
          aria-label="設定"
        >
          ⚙
        </Link>
      </div>

      {/* ログカウント（進捗ランプ） */}
      {dayStatus && (
        <div className="flex gap-2 items-center">
          {Array.from({ length: 7 }, (_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all ${i < cycleLogCount
                ? "bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                : "bg-slate-800"
                }`}
            />
          ))}
          <span className="text-xs text-slate-600 ml-1">{cycleLogCount}/7日</span>
        </div>
      )}

      {/* AI メッセージ */}
      <div className="max-w-md w-full min-h-[72px] p-4 bg-slate-900/40 rounded-2xl border border-emerald-900/30 backdrop-blur-sm">
        {isLoading ? (
          <p className="text-emerald-500/50 animate-pulse text-sm">案内人があなたの言葉を噛み締めています...</p>
        ) : (
          <p className="text-slate-300 leading-relaxed italic text-sm">
            {aiResponse || `「お帰りなさい${displayName ? `、${displayName}さん` : ""}。今日はどんな一日でしたか？」`}
          </p>
        )}
      </div>

      {/* 植物（録音中は音量に合わせて土がグロー） */}
      <PlantAnimation stage={plantStage} volume={smoothVolume} />

      {/* Day7 分析ボタン */}
      {cycleLogCount >= 7 && !dayStatus?.alreadyAnalyzed && (
        <div className="max-w-md w-full">
          <button
            onClick={runAnalyze}
            disabled={isAnalyzing}
            className="w-full py-4 bg-emerald-900/30 border border-emerald-700/50 rounded-2xl text-emerald-300 text-sm tracking-wide hover:bg-emerald-900/50 transition-all disabled:opacity-50"
          >
            {isAnalyzing ? "強みの花が咲いています..." : "✦ 今週の強みの花を咲かせる"}
          </button>
          <p className="text-center text-xs text-slate-600 mt-2">
            7つのログから強みの断片を抽出します
          </p>
        </div>
      )}

      {/* 感情スコア選択 */}
      <div className="max-w-md w-full space-y-2">
        <p className="text-xs text-slate-500 text-center">
          今の気持ちを数字で教えてください
          <span className="ml-2 text-slate-600">（1: 辛い　10: 良い）</span>
        </p>
        <div className="flex justify-between gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setEmotionScore(n)}
              className={`flex-1 h-11 rounded-lg text-xs font-medium transition-all ${emotionScore === n
                ? "bg-emerald-600 text-white shadow-[0_0_12px_rgba(52,211,153,0.4)]"
                : "bg-slate-900/60 text-slate-500 border border-slate-800 hover:border-emerald-900"
                }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* TALK ボタン */}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={toggleRecording}
          disabled={!canRecord && !isRecording}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isRecording
            ? "bg-red-500/20 border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]"
            : canRecord
              ? "bg-emerald-600 shadow-lg shadow-emerald-900/20 hover:bg-emerald-500"
              : "bg-slate-800 border border-slate-700 opacity-40 cursor-not-allowed"
            }`}
        >
          <span className="text-xs">{isRecording ? "STOP" : "TALK"}</span>
        </button>
        {!canRecord && !isRecording && (
          <p className="text-xs text-slate-600">スコアを選んでから話せます</p>
        )}
      </div>

      {transcript && (
        <p className="text-xs text-slate-500 italic max-w-md text-center">
          あなたの声: {transcript}
        </p>
      )}

      {/* 強みの庭 ボタン（設定ボタンと同じコンテナ幅・余白で右端を揃える） */}
      <div className="fixed bottom-8 inset-x-0 flex justify-center px-4 sm:px-6 pointer-events-none">
        <div className="w-full max-w-md relative h-0">
          <Link
            href="/seeds"
            className="absolute right-0 pointer-events-auto flex items-center gap-2 px-5 py-3 bg-slate-900/80 border border-emerald-900/60 rounded-full text-emerald-400 text-sm tracking-wide backdrop-blur-sm hover:bg-emerald-900/30 hover:border-emerald-700 transition-all shadow-lg"
          >
            強みの庭
            <span className="text-emerald-600">→</span>
          </Link>
        </div>
      </div>

    </main>
  );
}
