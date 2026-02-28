"use client";
import { useState, useEffect } from "react";

export default function NightGreenhouse() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    // ブラウザの音声認識セットアップ
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recog = new SpeechRecognition();
      recog.lang = "ja-JP";
      recog.continuous = true;
      recog.interimResults = true;

      recog.onresult = (event: any) => {
        let current = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          current += event.results[i][0].transcript;
        }
        setTranscript(current);
      };

      setRecognition(recog);
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognition?.stop();
    } else {
      setTranscript("");
      recognition?.start();
    }
    setIsRecording(!isRecording);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-8">
        <h1 className="text-2xl font-light tracking-widest text-emerald-400">夜の温室</h1>

        <p className="text-sm text-slate-400 leading-relaxed">
          「目標や、やりたいことが見つからなくても、自分を責めないでください。ここは、あなたが『ありのまま』でいられる場所です。」
        </p>

        {/* タネのメタファー（仮） */}
        <div className={`w-32 h-32 mx-auto rounded-full bg-emerald-500/20 blur-2xl transition-all duration-1000 ${isRecording ? 'scale-125 animate-pulse' : 'scale-100'}`} />

        <div className="min-h-[100px] p-4 bg-slate-900/50 rounded-lg border border-slate-800 text-left italic text-slate-300">
          {transcript || "（あなたの声を待っています...）"}
        </div>

        <button
          onClick={toggleRecording}
          className={`px-8 py-4 rounded-full font-medium transition-all ${isRecording ? "bg-red-500/80 text-white" : "bg-emerald-600 hover:bg-emerald-500 text-white"
            }`}
        >
          {isRecording ? "話を終える" : "独り言をはじめる"}
        </button>
      </div>
    </main>
  );
}