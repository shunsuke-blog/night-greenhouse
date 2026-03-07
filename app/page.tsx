"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { PlantAnimation, getPlantStage } from "@/components/PlantAnimation";
import { getQuestion, getResponse } from "@/lib/messages";
import { useMotionValue, useSpring } from "framer-motion";
import Onboarding, { ONBOARDING_STORAGE_KEY } from "@/components/Onboarding";

type AnalyzeResult = {
  flowers: { id: string; flower_name: string; level: number }[];
  fragment_count: number;
  treasures: { id: string; treasure_name: string; level: number }[];
  treasure_count: number;
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
  // responseIndex: 記録直前の cycleLogCount。null = 問いかけ表示
  const [responseIndex, setResponseIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [emotionScore, setEmotionScore] = useState<number | null>(null);
  const [dayStatus, setDayStatus] = useState<DayStatus | null>(null);
  const [cycleLogCount, setCycleLogCount] = useState(0);
  const cycleInitialized = useRef(false);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  // loadProfile と fetchDayStatus の両方が完了したら true → メッセージ表示確定
  const [initialized, setInitialized] = useState(false);
  const initDoneRef = useRef(0); // 完了した初期化の数（2になったら描画開始）
  const [showOnboarding, setShowOnboarding] = useState(false);
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

  // 初回訪問時にオンボーディングを表示
  useEffect(() => {
    if (!localStorage.getItem(ONBOARDING_STORAGE_KEY)) {
      setShowOnboarding(true);
    }
  }, []);

  useEffect(() => {
    // プロフィール取得 + タイムゾーン自動保存
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // 未認証時もカウントを進めて fetchDayStatus 完了だけで描画を解放できるようにする
        if (++initDoneRef.current >= 2) setInitialized(true);
        return;
      }

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

      // 初期化カウントを進め、両方完了したら描画を解放
      if (++initDoneRef.current >= 2) setInitialized(true);
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
          // 初期化カウントを進め、両方完了したら描画を解放
          if (++initDoneRef.current >= 2) setInitialized(true);
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
      setResponseIndex(null);
      setErrorMsg("");
      recognition?.start();
      startVolumeTracking();
    }
    setIsRecording(!isRecording);
  };

  const sendToLogs = async (text: string) => {
    setIsLoading(true);
    const indexAtSend = cycleLogCount; // 送信時点のカウントを返しのインデックスに使う
    try {
      await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text, emotion_score: emotionScore }),
      });
      setResponseIndex(indexAtSend);
      setCycleLogCount(prev => prev + 1);
      await fetchDayStatus();
    } catch {
      setErrorMsg("（通信が少し不安定なようです。もう一度お試しください）");
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
        setErrorMsg(data.error ?? "分析に失敗しました");
      }
    } catch {
      setErrorMsg("分析中にエラーが発生しました");
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

        <div className="max-w-md w-full space-y-5">
          {/* 強みの断片 */}
          <div className="space-y-2">
            <p className="text-xs text-slate-600 tracking-wider text-center">
              今週の言葉から <span className="text-emerald-300">{analyzeResult.fragment_count}</span> 個の強みが見つかりました
            </p>
            {analyzeResult.flowers.map((flower) => (
              <div key={flower.id} className="flex items-center justify-between p-4 bg-slate-900/40 border border-slate-800 rounded-xl">
                <p className="text-sm text-emerald-300">{flower.flower_name}</p>
                <span className="text-xs text-emerald-600 border border-emerald-900/50 px-2 py-0.5 rounded-full">
                  Lv.{flower.level}
                </span>
              </div>
            ))}
            <Link
              href="/seeds"
              className="block w-full py-3 text-center bg-emerald-900/30 border border-emerald-700/50 rounded-2xl text-emerald-300 text-sm tracking-wide hover:bg-emerald-900/50 transition-all"
            >
              強みの庭を見る →
            </Link>
          </div>

          {/* 価値観の宝物 */}
          {analyzeResult.treasures.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-600 tracking-wider text-center">
                今週の言葉から <span className="text-amber-300">{analyzeResult.treasure_count}</span> 個の価値観が見つかりました
              </p>
              {analyzeResult.treasures.map((treasure) => (
                <div key={treasure.id} className="flex items-center justify-between p-4 bg-slate-900/40 border border-slate-800 rounded-xl">
                  <p className="text-sm text-amber-300">{treasure.treasure_name}</p>
                  <span className="text-xs text-amber-600 border border-amber-900/50 px-2 py-0.5 rounded-full">
                    Lv.{treasure.level}
                  </span>
                </div>
              ))}
              <Link
                href="/treasures"
                className="block w-full py-3 text-center bg-amber-900/30 border border-amber-700/50 rounded-2xl text-amber-300 text-sm tracking-wide hover:bg-amber-900/50 transition-all"
              >
                価値観の倉庫を見る →
              </Link>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center px-4 py-8 sm:px-6 gap-5">

      {/* タイトル行: 左:設定 / 中央:タイトル */}
      <div className="w-full max-w-md relative flex items-center justify-center">
        <h1 className="text-2xl font-light tracking-widest text-emerald-400">夜の温室</h1>
        <Link
          href="/settings"
          className="absolute left-0 w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-slate-900/60 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-all"
          aria-label="設定"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </div>

      {/* ナビゲーション行: カレンダー / 価値観の倉庫 / 強みの庭 */}
      <div className="flex items-center gap-2">
        <Link
          href="/calendar"
          data-onboarding="calendar-button"
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-slate-900/60 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-all"
          aria-label="記録の庭"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="16" y1="2" x2="16" y2="6" />
          </svg>
        </Link>
        <Link
          href="/treasures"
          data-onboarding="treasures-button"
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-slate-900/60 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-all"
          aria-label="価値観の倉庫"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l2.4 4.8L20 7.6l-4 3.9 1 5.5L12 14.5l-5 2.5 1-5.5-4-3.9 5.6-.8z" />
          </svg>
        </Link>
        <Link
          href="/seeds"
          data-onboarding="seeds-button"
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-slate-900/60 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-all"
          aria-label="強みの庭"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="2" />
            <ellipse cx="12" cy="5.5" rx="1.8" ry="3" />
            <ellipse cx="12" cy="18.5" rx="1.8" ry="3" />
            <ellipse cx="5.5" cy="12" rx="3" ry="1.8" />
            <ellipse cx="18.5" cy="12" rx="3" ry="1.8" />
          </svg>
        </Link>
      </div>

      {/* ログカウント（進捗ランプ）— 常にレンダリングしてレイアウトシフトを防ぐ */}
      <div data-onboarding="progress-lamps" className="flex gap-2 items-center">
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

      {/* 案内人のメッセージ — initialized まではプレースホルダーでレイアウトを固定 */}
      <div className="max-w-md w-full min-h-[72px] p-4 bg-slate-900/40 rounded-2xl border border-emerald-900/30 backdrop-blur-sm">
        {!initialized || isLoading ? (
          <p className="text-slate-800 animate-pulse text-sm select-none">…</p>
        ) : errorMsg ? (
          <p className="text-slate-500 leading-relaxed italic text-sm">{errorMsg}</p>
        ) : responseIndex !== null ? (
          <p className="text-slate-300 leading-relaxed italic text-sm">{getResponse(responseIndex)}</p>
        ) : (
          <p className="text-slate-300 leading-relaxed italic text-sm">{getQuestion(cycleLogCount, displayName)}</p>
        )}
      </div>

      {/* 植物（録音中は音量に合わせて土がグロー） */}
      <div data-onboarding="plant-animation">
        <PlantAnimation stage={plantStage} volume={smoothVolume} />
      </div>

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
      <div data-onboarding="emotion-score" className="max-w-md w-full space-y-2">
        <p className="text-xs text-slate-500 text-center">
          今の気持ちを数字で教えてください
          <span className="ml-2 text-slate-600">（1: 不快　10:快）</span>
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
          data-onboarding="talk-button"
          onClick={toggleRecording}
          disabled={!canRecord && !isRecording}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isRecording
            ? "bg-red-500/20 border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]"
            : canRecord
              ? "bg-emerald-600 shadow-lg shadow-emerald-900/20 hover:bg-emerald-500"
              : "bg-slate-800 border border-slate-700 opacity-40 cursor-not-allowed"
            }`}
        >
          <span className="text-xs">{isRecording ? "やめる" : "はなす"}</span>
        </button>
        <p className={`text-xs text-slate-600 ${!canRecord && !isRecording ? "" : "invisible"}`}>スコアを選んでから話せます</p>
      </div>

      {transcript && (
        <p className="text-xs text-slate-500 italic max-w-md text-center">
          あなたの声: {transcript}
        </p>
      )}

      {/* オンボーディング */}
      {showOnboarding && (
        <Onboarding
          onComplete={() => {
            localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
            setShowOnboarding(false);
          }}
        />
      )}

    </main>
  );
}
