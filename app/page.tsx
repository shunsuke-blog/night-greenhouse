"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { PlantAnimation, getPlantStage } from "@/components/PlantAnimation";
import { getQuestion, getResponse, getRandomQuestions, type JournalPrompt } from "@/lib/messages";
import Onboarding, { ONBOARDING_STORAGE_KEY } from "@/components/Onboarding";
import { EMOTION_SCORE_MIN, EMOTION_SCORE_MAX } from "@/lib/constants";
import { useVolumeTracker } from "@/hooks/useVolumeTracker";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

type AnalyzeResult = {
  flowers: { id: string; flower_name: string; level: number }[];
  fragment_count: number;
  treasures: { id: string; treasure_name: string; level: number }[];
  treasure_count: number;
};

type DayStatus = {
  unanalyzedCount: number;
  weekNumber: number;
  canAnalyze: boolean;
  freeAnalysesLeft: number;
  isSubscribed: boolean;
  totalAnalysesCount: number;
  cycleTarget: number;
  logsUntilNextAnalysis: number;
  today_log_id: string | null;
  today_log_transcript: string | null;
  today_log_count: number;
};

export default function NightGreenhouse() {
  const [isRecording, setIsRecording] = useState(false);
  // responseIndex: 記録直前の cycleLogCount。null = 問いかけ表示
  const [responseIndex, setResponseIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emotionScore, setEmotionScore] = useState<number | null>(null);

  const { smoothVolume, start: startVolumeTracking, stop: stopVolumeTracking } = useVolumeTracker();
  const { transcript, setTranscript, recognition } = useSpeechRecognition();
  const [dayStatus, setDayStatus] = useState<DayStatus | null>(null);
  const [cycleLogCount, setCycleLogCount] = useState(0);
  const cycleInitialized = useRef(false);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [todayLogId, setTodayLogId] = useState<string | null>(null);
  const [todayLogTranscript, setTodayLogTranscript] = useState<string | null>(null);
  const [todayLogCount, setTodayLogCount] = useState(0);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [writeText, setWriteText] = useState("");
  const [showLogChoiceModal, setShowLogChoiceModal] = useState(false);
  const [pendingSource, setPendingSource] = useState<"mic" | "write" | null>(null);
  const [logSaveAction, setLogSaveAction] = useState<"add" | "update" | null>(null);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [questionChoices, setQuestionChoices] = useState<(JournalPrompt | null)[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<JournalPrompt | null | undefined>(undefined);
  const router = useRouter();

  // 初回訪問時にオンボーディングを表示
  useEffect(() => {
    if (!localStorage.getItem(ONBOARDING_STORAGE_KEY)) {
      setShowOnboarding(true);
    }
  }, []);

  useEffect(() => {
    fetchDayStatus();
  }, []);

  const fetchDayStatus = async () => {
    try {
      const res = await fetch("/api/status");
      if (res.ok) {
        const data = await res.json();
        setDayStatus(data);
        setTodayLogId(data.today_log_id ?? null);
        setTodayLogTranscript(data.today_log_transcript ?? null);
        setTodayLogCount(data.today_log_count ?? 0);
        if (data.display_name) setDisplayName(data.display_name);
        // 初回のみDBから未分析ログ数でカウントを初期化
        if (!cycleInitialized.current) {
          setCycleLogCount(data.unanalyzedCount ?? 0);
          cycleInitialized.current = true;
          setInitialized(true);
          // タイムゾーンがずれていたらバックグラウンドで更新（描画をブロックしない）
          const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (data.timezone && data.timezone !== browserTz) {
            void (async () => {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) await supabase.from("user_profiles").upsert({ id: user.id, timezone: browserTz });
            })();
          }
        }
      }
    } catch { }
  };

  const startRecording = () => {
    setTranscript("");
    setResponseIndex(null);
    setErrorMsg("");
    startVolumeTracking().then((ok) => {
      if (!ok) { setErrorMsg("マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。"); return; }
      try { recognition?.start(); } catch { /* 音声認識非対応環境 */ }
      setIsRecording(true);
    });
  };

  const toggleRecording = () => {
    if (isRecording) {
      // 停止 → そのまま保存
      recognition?.stop();
      stopVolumeTracking();
      if (transcript.trim()) {
        saveLog(transcript, logSaveAction ?? "add");
      }
      setIsRecording(false);
    } else {
      // 質問選択モーダルを先に表示
      setQuestionChoices(getRandomQuestions());
      setPendingSource("mic");
      setShowQuestionModal(true);
    }
  };

  const handleQuestionSelect = (prompt: JournalPrompt | null) => {
    setSelectedPrompt(prompt);
    setShowQuestionModal(false);
    if (pendingSource === "mic") {
      if (todayLogId) {
        setShowLogChoiceModal(true);
      } else {
        startRecording();
      }
    } else if (pendingSource === "write") {
      if (todayLogId) {
        setShowLogChoiceModal(true);
      } else {
        setShowWriteModal(true);
      }
    }
  };

  const handleLogChoice = (action: "add" | "update") => {
    setLogSaveAction(action);
    setShowLogChoiceModal(false);
    if (pendingSource === "mic") {
      startRecording();
    } else if (pendingSource === "write") {
      setShowWriteModal(true);
    }
    setPendingSource(null);
  };

  const submitWriteLog = () => {
    if (!writeText.trim()) return;
    setShowWriteModal(false);
    saveLog(writeText, logSaveAction ?? "add");
    setWriteText("");
  };

  const saveLog = async (text: string, action: "add" | "update") => {
    setIsLoading(true);
    const indexAtSend = cycleLogCount;
    try {
      if (action === "update" && todayLogId) {
        await fetch("/api/logs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ log_id: todayLogId, transcript: text, emotion_score: emotionScore }),
        });
        setTodayLogTranscript(text);
      } else {
        const res = await fetch("/api/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: text, emotion_score: emotionScore, prompt_id: selectedPrompt?.id ?? null }),
        });
        const data = await res.json();
        if (data.log_id) setTodayLogId(data.log_id);
        setTodayLogTranscript(text);
        setTodayLogCount(prev => prev + 1);
        setCycleLogCount(prev => prev + 1);
      }
      setResponseIndex(indexAtSend);
      setLogSaveAction(null);
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
      const res = await fetch("/api/analyze", { method: "POST" });
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
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    await supabase.auth.signOut();
    router.push("/login");
  };

  const canRecord = emotionScore !== null;
  const plantStage = analyzeResult ? "flower" : getPlantStage(cycleLogCount);

  // 分析完了後の表示
  if (analyzeResult) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center px-4 py-8 sm:px-6 gap-5">
        <h1 className="text-2xl font-light tracking-widest text-emerald-400">心の土壌</h1>

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
                価値観の宝庫を見る →
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
        <h1 className="text-2xl font-light tracking-widest text-emerald-400">心の土壌</h1>
        <Link
          href="/settings"
          className="absolute left-0 w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-slate-900/60 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-all"
          aria-label="設定"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </div>

      {/* ナビゲーション行: カレンダー / 価値観の宝庫 / 強みの庭 */}
      <div className="flex items-center gap-2">
        <Link
          href="/calendar"
          data-onboarding="calendar-button"
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-slate-900/60 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-all"
          aria-label="記録の足跡"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="16" y1="2" x2="16" y2="6" />
          </svg>
        </Link>
        <Link
          href="/treasures"
          data-onboarding="treasures-button"
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-slate-900/60 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-all"
          aria-label="価値観の宝庫"
        >
          {/* ダイヤモンドアイコン */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3h12l4 6-10 12L2 9z" />
            <line x1="2" y1="9" x2="22" y2="9" />
            <polyline points="6 3 12 9 18 3" />
          </svg>
        </Link>
        <Link
          href="/seeds"
          data-onboarding="seeds-button"
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-slate-900/60 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-all"
          aria-label="強みの庭"
        >
          {/* 花アイコン（5枚花びら） */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12"   cy="7.5"  r="4.2" />
            <circle cx="16.3" cy="10.6" r="4.2" />
            <circle cx="14.6" cy="15.6" r="4.2" />
            <circle cx="9.4"  cy="15.6" r="4.2" />
            <circle cx="7.7"  cy="10.6" r="4.2" />
            <circle cx="12"   cy="12"   r="3.5" fill="currentColor" stroke="none" />
          </svg>
        </Link>
      </div>

      {/* ログカウント（進捗ランプ）— 常にレンダリングしてレイアウトシフトを防ぐ */}
      <div data-onboarding="progress-lamps" className="flex gap-2 items-center">
        {Array.from({ length: dayStatus?.cycleTarget ?? 3 }, (_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-all ${i < cycleLogCount
              ? "bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
              : "bg-slate-800"
              }`}
          />
        ))}
        <span className="text-xs text-slate-600 ml-1">
          {cycleLogCount}/{dayStatus?.cycleTarget ?? 3}日
        </span>
      </div>

      {/* 案内人のメッセージ — initialized まではプレースホルダーでレイアウトを固定 */}
      <div className="max-w-md w-full min-h-18 p-4 bg-slate-900/40 rounded-2xl border border-emerald-900/30 backdrop-blur-sm">
        {!initialized || isLoading ? (
          <p className="text-slate-800 animate-pulse text-sm select-none">…</p>
        ) : errorMsg ? (
          <p className="text-slate-500 leading-relaxed italic text-sm">{errorMsg}</p>
        ) : responseIndex !== null ? (
          <p className="text-slate-300 leading-relaxed italic text-sm">{getResponse(responseIndex)}</p>
        ) : isRecording && selectedPrompt ? (
          <p className="text-slate-300 leading-relaxed italic text-sm">「{selectedPrompt.text}」</p>
        ) : (
          <p className="text-slate-300 leading-relaxed italic text-sm">{getQuestion(cycleLogCount, displayName)}</p>
        )}
      </div>

      {/* 植物（録音中は音量に合わせて土がグロー） */}
      <div data-onboarding="plant-animation">
        <PlantAnimation stage={plantStage} volume={smoothVolume} />
      </div>

      {/* 分析ボタン */}
      {dayStatus?.canAnalyze && (
        <div className="max-w-md w-full">
          <button
            onClick={runAnalyze}
            disabled={isAnalyzing}
            className="w-full py-4 bg-emerald-900/30 border border-emerald-700/50 rounded-2xl text-emerald-300 text-sm tracking-wide hover:bg-emerald-900/50 transition-all disabled:opacity-50"
          >
            {isAnalyzing ? "強みの花が咲いています..." : "✦ 強みの花を咲かせる"}
          </button>
          <p className="text-center text-xs text-slate-600 mt-2">
            {cycleLogCount}つのログから強みと価値観を抽出します
          </p>
        </div>
      )}
      {/* 無料分析上限到達 → サブスク誘導ボタン */}
      {!dayStatus?.canAnalyze && dayStatus?.freeAnalysesLeft === 0 && !dayStatus?.isSubscribed && (
        <div className="max-w-md w-full">
          <button
            onClick={() => router.push("/upgrade")}
            className="w-full py-4 bg-slate-800/60 border border-slate-700 rounded-2xl text-slate-400 text-sm tracking-wide hover:bg-slate-800 hover:border-slate-500 transition-all"
          >
            ✦ 続けて強みの花を咲かせる
          </button>
          <p className="text-center text-xs text-slate-600 mt-2">
            月額プランで引き続き分析できます
          </p>
        </div>
      )}

      {/* 感情スコア選択 */}
      <div data-onboarding="emotion-score" className="max-w-md w-full space-y-2">
        <p className="text-xs text-slate-500 text-center">
          今の気持ちを数字で教えてください
          <span className="ml-2 text-slate-600">（1: 不快(悪い)　10:快(良い)）</span>
        </p>
        <div className="flex justify-between gap-1">
          {Array.from({ length: EMOTION_SCORE_MAX - EMOTION_SCORE_MIN + 1 }, (_, i) => i + EMOTION_SCORE_MIN).map((n) => (
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

      {/* TALK / かく ボタン */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-6">
          {/* マイクボタン */}
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
            {isRecording ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <rect x="5" y="5" width="14" height="14" rx="2" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <rect x="9" y="2" width="6" height="11" rx="3" fill="currentColor" stroke="none" opacity={0.9} />
                <path d="M5 10a7 7 0 0 0 14 0" strokeLinecap="round" />
                <line x1="12" y1="17" x2="12" y2="21" strokeLinecap="round" />
                <line x1="9" y1="21" x2="15" y2="21" strokeLinecap="round" />
              </svg>
            )}
          </button>
          {/* かくボタン（録音中は非表示） */}
          {!isRecording && (
            <button
              data-onboarding="write-button"
              onClick={() => {
                setQuestionChoices(getRandomQuestions());
                setPendingSource("write");
                setShowQuestionModal(true);
              }}
              disabled={!canRecord}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                canRecord
                  ? "bg-emerald-600 shadow-lg shadow-emerald-900/20 hover:bg-emerald-500"
                  : "bg-slate-800 border border-slate-700 opacity-40 cursor-not-allowed"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L14 13l-4 1 1-4 7.5-7.5z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
        <p className={`text-xs text-slate-600 ${!canRecord && !isRecording ? "" : "invisible"}`}>スコアを選んでから話せます</p>
      </div>

      {transcript && (
        <p className="text-xs text-slate-500 italic max-w-md text-center">
          あなたの声: {transcript}
        </p>
      )}

      {/* 質問選択モーダル */}
      {showQuestionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm bg-slate-900 border border-emerald-900/40 rounded-2xl p-5 space-y-3">
            <p className="text-xs text-slate-400 text-center">今日はどんなことを話しますか？</p>
            {questionChoices.map((prompt, i) => (
              <button
                key={prompt?.id ?? "free"}
                onClick={() => handleQuestionSelect(prompt)}
                className="w-full text-left px-4 py-3 rounded-xl border border-slate-700 hover:border-emerald-700 hover:bg-emerald-950/30 transition-all space-y-1"
              >
                <p className="text-sm text-slate-200 leading-snug">
                  {prompt ? prompt.text : "自由に話す・書く"}
                </p>
                {prompt && (
                  <p className="text-xs text-slate-500">{prompt.hint}</p>
                )}
              </button>
            ))}
            <button
              onClick={() => { setShowQuestionModal(false); setPendingSource(null); }}
              className="w-full py-2 rounded-xl text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* ログ選択ポップアップ（追加 / 更新 / キャンセル） */}
      {showLogChoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm bg-slate-900 border border-emerald-900/40 rounded-2xl p-5 space-y-4">
            <p className="text-sm text-emerald-400">本日{todayLogCount + 1}回目のログです。</p>
            <div className="border border-slate-700 rounded-xl px-3 py-2 max-h-36 overflow-y-auto">
              <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">
                {todayLogTranscript ?? "（前回のログなし）"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowLogChoiceModal(false); setPendingSource(null); }}
                className="flex-1 py-2 rounded-xl text-xs text-slate-400 border border-slate-700 hover:border-slate-500 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleLogChoice("update")}
                className="flex-1 py-2 rounded-xl text-xs border border-slate-600 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                更新
              </button>
              <button
                onClick={() => handleLogChoice("add")}
                className="flex-1 py-2 rounded-xl text-xs bg-emerald-700 text-emerald-100 hover:bg-emerald-600 transition-colors"
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* テキスト入力モーダル */}
      {showWriteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm bg-slate-900 border border-emerald-900/40 rounded-2xl p-5 space-y-4">
            <p className="text-xs text-slate-400">
              {selectedPrompt ? selectedPrompt.text : "今日の気持ちを書いてください"}
            </p>
            <textarea
              autoFocus
              value={writeText}
              onChange={(e) => setWriteText(e.target.value)}
              rows={5}
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-800 resize-none"
              placeholder={selectedPrompt ? selectedPrompt.hint + "…" : "今日あったことや感じたことを自由に…"}
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowWriteModal(false); setWriteText(""); }}
                className="flex-1 py-2 rounded-xl text-xs text-slate-400 border border-slate-700 hover:border-slate-500 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={submitWriteLog}
                disabled={!writeText.trim()}
                className="flex-1 py-2 rounded-xl text-xs bg-emerald-700 text-emerald-100 hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                記録する
              </button>
            </div>
          </div>
        </div>
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
