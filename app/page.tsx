"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

type Seed = {
  seed_name: string;
  os_description: string;
  logic_reflection: string;
  environment_condition: string;
};

type DayStatus = {
  logCount: number;
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
  const [seed, setSeed] = useState<Seed | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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
      if (res.ok) setDayStatus(await res.json());
    } catch {}
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognition?.stop();
      if (transcript.trim()) sendToLogs(transcript);
    } else {
      setTranscript("");
      setAiResponse("");
      recognition?.start();
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
      if (res.ok) setSeed(data);
      else setAiResponse(data.error ?? "分析に失敗しました");
    } catch {
      setAiResponse("分析中にエラーが発生しました");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const canRecord = emotionScore !== null;

  // Day7 分析結果の表示
  if (seed) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-6 space-y-6">
        <h1 className="text-2xl font-light tracking-widest text-emerald-400">夜の温室</h1>
        <p className="text-xs text-slate-500 tracking-widest">— 芽吹き —</p>

        <div className="max-w-md w-full space-y-4">
          <div className="text-center py-6">
            <p className="text-xs text-slate-500 mb-2">あなたの強みのタネ</p>
            <p className="text-3xl font-light text-emerald-300 tracking-wider">{seed.seed_name}</p>
          </div>

          <div className="p-5 bg-slate-900/40 rounded-2xl border border-emerald-900/30 space-y-1">
            <p className="text-xs text-emerald-600 tracking-wider">OS（性質）</p>
            <p className="text-sm text-slate-300 leading-relaxed">{seed.os_description}</p>
          </div>

          <div className="p-5 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-1">
            <p className="text-xs text-slate-500 tracking-wider">過去の苦しみの再定義</p>
            <p className="text-sm text-slate-400 leading-relaxed">{seed.logic_reflection}</p>
          </div>

          <div className="p-5 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-1">
            <p className="text-xs text-slate-500 tracking-wider">輝ける土壌</p>
            <p className="text-sm text-slate-400 leading-relaxed">{seed.environment_condition}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-6 space-y-8">
      <div className="w-full max-w-md flex items-center justify-between">
        <h1 className="text-2xl font-light tracking-widest text-emerald-400">夜の温室</h1>
        <Link href="/seeds" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
          Seed Library →
        </Link>
      </div>

      {/* 今週の進捗 */}
      {dayStatus && (
        <div className="flex gap-2 items-center">
          {Array.from({ length: 7 }, (_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all ${
                i < dayStatus.logCount
                  ? "bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                  : "bg-slate-800"
              }`}
            />
          ))}
          <span className="text-xs text-slate-600 ml-1">{dayStatus.logCount}/7日</span>
        </div>
      )}

      {/* Day7 分析ボタン */}
      {dayStatus?.isDay7Ready && !dayStatus.alreadyAnalyzed && (
        <div className="max-w-md w-full">
          <button
            onClick={runAnalyze}
            disabled={isAnalyzing}
            className="w-full py-4 bg-emerald-900/30 border border-emerald-700/50 rounded-2xl text-emerald-300 text-sm tracking-wide hover:bg-emerald-900/50 transition-all disabled:opacity-50"
          >
            {isAnalyzing ? "タネが芽吹いています..." : "✦ 7日間のタネを見る"}
          </button>
          <p className="text-center text-xs text-slate-600 mt-2">
            一期一会。分析は一度だけです。
          </p>
        </div>
      )}

      {/* AI の返答エリア */}
      <div className="max-w-md w-full min-h-[150px] p-6 bg-slate-900/40 rounded-2xl border border-emerald-900/30 backdrop-blur-sm">
        {isLoading ? (
          <p className="text-emerald-500/50 animate-pulse">案内人があなたの言葉を噛み締めています...</p>
        ) : (
          <p className="text-slate-300 leading-relaxed italic">
            {aiResponse || "「お帰りなさい。今日はどんな一日でしたか？」"}
          </p>
        )}
      </div>

      {/* 感情スコア選択 */}
      <div className="max-w-md w-full space-y-3">
        <p className="text-xs text-slate-500 text-center">
          今の気持ちを数字で教えてください
          <span className="ml-2 text-slate-600">（1: とても辛い　10: とても良い）</span>
        </p>
        <div className="flex justify-between gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setEmotionScore(n)}
              className={`flex-1 aspect-square rounded-lg text-xs font-medium transition-all ${
                emotionScore === n
                  ? "bg-emerald-600 text-white shadow-[0_0_12px_rgba(52,211,153,0.4)]"
                  : "bg-slate-900/60 text-slate-500 border border-slate-800 hover:border-emerald-900"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* 録音ボタン */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={toggleRecording}
          disabled={!canRecord && !isRecording}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
            isRecording
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
    </main>
  );
}
