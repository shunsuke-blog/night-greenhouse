"use client";
import { useState, useEffect, useCallback } from "react";

// ─── ステップ定義（拡張はここに追加するだけ） ───────────────────────────────
export type OnboardingStep = {
  id: string;
  target: string;       // [data-onboarding] 属性値
  title: string;
  description: string;
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "growth",
    target: "plant-animation",
    title: "記録が花を育てます",
    description:
      "日々の想いを記録するたびにタネが成長し、花が咲きます。あなたの言葉がタネの栄養になっています。",
  },
  {
    id: "emotion-score",
    target: "emotion-score",
    title: "今の気持ちを数字で選ぶ",
    description:
      "記録する前に、今の気持ちを 1〜10 の数字で選んでください。1 が不快(悪い)、10 が快(良い)です。",
  },
  {
    id: "talk-button",
    target: "talk-button",
    title: "声で記録する",
    description:
      "このボタンを押すと音声で想いを記録できます。停止ボタンを押すと自動的に保存されます。",
  },
  {
    id: "write-button",
    target: "write-button",
    title: "文字で記録する",
    description:
      "このボタンを押すとテキストで想いを記録できます。電車の中など声が出せない場所でも、その日の気持ちを残せます。",
  },
  {
    id: "calendar-button",
    target: "calendar-button",
    title: "記録の足跡を見る",
    description:
      "カレンダーから過去の記録をいつでも読み返せます。あなたの言葉の積み重ねがここに残ります。",
  },
  {
    id: "treasures-button",
    target: "treasures-button",
    title: "宝物を見る",
    description:
      "あなたの言葉から見つかった「あなたが大切にしている価値観」が宝物として大切し保管されます。このボタンから一覧で確認することができます。",
  },
  {
    id: "seeds-button",
    target: "seeds-button",
    title: "咲いた花を見る",
    description:
      "あなたの言葉から見つかった「あなたの強み」が花として咲いています。このボタンから一覧で確認することができます。",
  },
];

export const ONBOARDING_STORAGE_KEY = "bloomine_onboarded";

// ─── 型 ────────────────────────────────────────────────────────────────────
type Rect = { top: number; left: number; width: number; height: number };

const PADDING = 10;         // スポットライトの余白
const TOOLTIP_WIDTH = 272;  // ツールチップの幅

function getTargetRect(target: string): Rect | null {
  const el = document.querySelector(`[data-onboarding="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

// ─── コンポーネント ─────────────────────────────────────────────────────────
interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const step = ONBOARDING_STEPS[stepIndex];
  const isLast = stepIndex === ONBOARDING_STEPS.length - 1;

  const updateRect = useCallback(() => {
    const r = getTargetRect(step.target);
    setRect(r);
  }, [step.target]);

  // ステップ変化 / リサイズ時にターゲット座標を再取得
  useEffect(() => {
    const timer = setTimeout(updateRect, 60); // DOM 安定後に取得
    return () => clearTimeout(timer);
  }, [updateRect]);

  useEffect(() => {
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, [updateRect]);

  const goNext = () => {
    if (!isLast) {
      setRect(null); // 遷移中チラつき防止
      setStepIndex((s) => s + 1);
    } else {
      onComplete();
    }
  };

  // ターゲット未確定の間は何も表示しない
  if (!rect) return null;

  // スポットライト範囲
  const spotTop    = rect.top    - PADDING;
  const spotLeft   = rect.left   - PADDING;
  const spotWidth  = rect.width  + PADDING * 2;
  const spotHeight = rect.height + PADDING * 2;

  // ツールチップ位置：画面下半分にターゲットがあれば上に、それ以外は下に
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const targetCenterY = spotTop + spotHeight / 2;
  const showBelow = targetCenterY < vh * 0.55;
  const tooltipTop = showBelow
    ? spotTop + spotHeight + 28
    : spotTop - 28 - 180; // 180 = ツールチップの概算高さ

  // 左端がはみ出さないようにクランプ
  const tooltipLeft = Math.max(
    16,
    Math.min(spotLeft, vw - TOOLTIP_WIDTH - 16)
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50 }} aria-modal="true">
      {/* ── スポットライト（大きなbox-shadowで周囲を暗くする） ── */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: spotTop,
          left: spotLeft,
          width: spotWidth,
          height: spotHeight,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.74), inset 0 0 0 1px rgba(52,211,153,0.25)",
          background: "rgba(255,255,255,0.07)",
          borderRadius: 14,
          pointerEvents: "none",
          transition: "top 0.28s ease, left 0.28s ease, width 0.28s ease, height 0.28s ease",
          zIndex: 51,
        }}
      />

      {/* ── スポットライト外をクリックで次へ ── */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 50, cursor: "pointer" }}
        onClick={goNext}
        aria-hidden="true"
      />

      {/* ── ツールチップ ── */}
      <div
        style={{
          position: "fixed",
          top: Math.max(16, Math.min(tooltipTop, vh - 220)),
          left: tooltipLeft,
          width: TOOLTIP_WIDTH,
          zIndex: 52,
        }}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl"
      >
        {/* ステップドット */}
        <div className="flex gap-1.5 mb-4">
          {ONBOARDING_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i === stepIndex
                  ? "bg-emerald-500"
                  : i < stepIndex
                  ? "bg-emerald-800"
                  : "bg-slate-700"
              }`}
            />
          ))}
        </div>

        <h3 className="text-sm font-medium text-emerald-400 mb-2 leading-snug">
          {step.title}
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed mb-5">
          {step.description}
        </p>

        <div className="flex items-center justify-between">
          <button
            onClick={onComplete}
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
          >
            スキップ
          </button>
          <button
            onClick={goNext}
            className="text-xs px-4 py-2 bg-emerald-800/60 border border-emerald-700/50 text-emerald-300 rounded-xl hover:bg-emerald-700/60 transition-all"
          >
            {isLast ? "はじめる" : "次へ →"}
          </button>
        </div>
      </div>
    </div>
  );
}
