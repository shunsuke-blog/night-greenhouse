"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

type DayLog = {
  id: string;
  transcript: string;
  emotion_score: number | null;
  created_at: string;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-indexed

  const [logDates, setLogDates] = useState<Set<string>>(new Set());
  const [isLoadingMonth, setIsLoadingMonth] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayLogs, setDayLogs] = useState<DayLog[] | null>(null);
  const [isLoadingDay, setIsLoadingDay] = useState(false);

  // 月ごとのキャッシュ: key = "2026-03"
  const monthCache = useRef<Map<string, string[]>>(new Map());

  useEffect(() => {
    loadMonth(year, month);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const loadMonth = async (y: number, m: number) => {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (monthCache.current.has(key)) {
      setLogDates(new Set(monthCache.current.get(key)));
      return;
    }
    setIsLoadingMonth(true);
    try {
      const res = await fetch(`/api/calendar?year=${y}&month=${m}`);
      if (res.ok) {
        const data: { dates: string[] } = await res.json();
        monthCache.current.set(key, data.dates);
        setLogDates(new Set(data.dates));
      }
    } finally {
      setIsLoadingMonth(false);
    }
  };

  const loadDay = async (date: string) => {
    setSelectedDate(date);
    setDayLogs(null);
    setIsLoadingDay(true);
    try {
      const res = await fetch(`/api/calendar/${date}`);
      if (res.ok) {
        const data: { logs: DayLog[] } = await res.json();
        setDayLogs(data.logs);
      }
    } finally {
      setIsLoadingDay(false);
    }
  };

  const prevMonth = () => {
    setSelectedDate(null);
    setDayLogs(null);
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    setSelectedDate(null);
    setDayLogs(null);
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  };

  // カレンダーグリッド構築
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0=日
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // 選択日のラベル
  const selectedLabel = selectedDate
    ? (() => {
        const [y, m, d] = selectedDate.split("-");
        return `${y}年${m}月${d}日`;
      })()
    : null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center px-4 py-8 sm:px-6 gap-6">

      {/* ヘッダー */}
      <div className="w-full max-w-md flex items-center justify-between">
        <Link
          href="/"
          className="text-slate-500 hover:text-slate-300 transition-colors text-sm"
        >
          ← 戻る
        </Link>
        <h1 className="text-lg font-light tracking-widest text-emerald-400">記録の庭</h1>
        <div className="w-14" />
      </div>

      {/* 月ナビゲーション */}
      <div className="w-full max-w-md flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors text-xl"
          aria-label="前の月"
        >
          ‹
        </button>
        <p className="text-sm text-slate-300 tracking-wide">
          {year}年{month}月
        </p>
        <button
          onClick={nextMonth}
          className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors text-xl"
          aria-label="次の月"
        >
          ›
        </button>
      </div>

      {/* カレンダー */}
      <div className="w-full max-w-md">
        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-xs text-slate-600 py-1">{d}</div>
          ))}
        </div>

        {/* 日付グリッド */}
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;

            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const hasLog = logDates.has(dateStr);
            const isSelected = selectedDate === dateStr;

            return (
              <button
                key={i}
                onClick={() => hasLog && loadDay(dateStr)}
                disabled={!hasLog}
                className={`flex flex-col items-center justify-center h-10 rounded-lg text-sm transition-all ${
                  isSelected
                    ? "bg-emerald-900/50 border border-emerald-700 text-emerald-300"
                    : hasLog
                    ? "text-slate-200 hover:bg-slate-800/60"
                    : "text-slate-700 cursor-default"
                }`}
              >
                {day}
                {hasLog && (
                  <span
                    className={`w-1 h-1 rounded-full mt-0.5 ${
                      isSelected ? "bg-emerald-400" : "bg-emerald-600"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {isLoadingMonth && (
          <p className="text-center text-xs text-slate-600 mt-3 animate-pulse">読み込み中...</p>
        )}
      </div>

      {/* 選択日のログ */}
      {selectedDate && (
        <div className="w-full max-w-md space-y-3 pb-8">
          <p className="text-xs text-slate-500 tracking-wider text-center">
            — {selectedLabel} —
          </p>

          {isLoadingDay ? (
            <p className="text-center text-xs text-slate-600 animate-pulse">ログを読み込み中...</p>
          ) : dayLogs?.length === 0 ? (
            <p className="text-center text-xs text-slate-600">この日のログはありません</p>
          ) : (
            dayLogs?.map((log) => (
              <div
                key={log.id}
                className="p-4 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3"
              >
                {log.emotion_score !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">気持ち</span>
                    <span className="text-xs text-emerald-500 border border-emerald-900/50 px-2 py-0.5 rounded-full">
                      {log.emotion_score} / 10
                    </span>
                  </div>
                )}
                <p className="text-sm text-slate-300 leading-relaxed">{log.transcript}</p>
              </div>
            ))
          )}
        </div>
      )}

    </main>
  );
}
