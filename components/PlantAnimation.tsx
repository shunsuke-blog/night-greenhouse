"use client";
import { motion, AnimatePresence, type MotionValue, useTransform } from "framer-motion";

export type PlantStage = "soil" | "sprout" | "seedling" | "grown" | "bud" | "flower";

export function getPlantStage(count: number): PlantStage {
  if (count >= 6) return "bud";
  if (count >= 4) return "grown";
  if (count >= 2) return "seedling";
  if (count >= 1) return "sprout";
  return "soil";
}

// ─── カラーパレット（ここを変えるだけで全体の色が変わる） ───
const C = {
  soilFill:   "#1e293b", // slate-800
  soilStroke: "#334155", // slate-700
  stem:       "#34d399", // emerald-400
  leaf:       "#34d399", // emerald-400
  leafFill:   "#064e3b", // emerald-950
  bud:        "#6ee7b7", // emerald-300
  budFill:    "#065f46", // emerald-900
  petal:      "#6ee7b7", // emerald-300
  petalFill:  "#064e3b", // emerald-950
  center:     "#059669", // emerald-600
} as const;

// ─── 花専用カラー（優しい赤/ローズ系） ───
const FC = {
  petal:     "#fda4af", // rose-300
  petalFill: "#4c0519", // rose-950
  center:    "#fb7185", // rose-400
  glow:      "#fda4af", // rose-300
} as const;

// ─── 共通 props ───
const stemP = {
  stroke: C.stem, strokeWidth: 1.5, fill: "none",
  strokeLinecap: "round" as const,
};
const leafP  = { stroke: C.leaf, strokeWidth: 1.5, fill: C.leafFill };
const leafPs = { stroke: C.leaf, strokeWidth: 1.2, fill: C.leafFill };

// ─── 土台（音量なし・静的） ───
function Soil() {
  return (
    <ellipse cx="60" cy="145" rx="40" ry="11"
      fill={C.soilFill} stroke={C.soilStroke} strokeWidth="1.5" />
  );
}

// ─── 土台（音量グロー付き） ───
// 感度調整: [0, 0.06] → 小さな音でも大きく光る
function SoilGlow({ volume }: { volume: MotionValue<number> }) {
  const opacity = useTransform(volume, [0, 0.2], [0, 0.88]);
  return (
    <>
      {/* グロー層（土の後ろに描画） */}
      <motion.ellipse
        cx="60" cy="148" rx="72" ry="24"
        fill="#6ee7b7"
        style={{ opacity, filter: "blur(30px)" }}
      />
      {/* 土（グロー層の上に重ねてクリーンに見せる） */}
      <ellipse cx="60" cy="145" rx="40" ry="11"
        fill={C.soilFill} stroke={C.soilStroke} strokeWidth="1.5" />
    </>
  );
}

// ─── 葉（下段・上段） ───
function LeavesLow() {
  return (
    <>
      <path d="M61,118 Q40,107 45,127 Q54,124 61,118" {...leafP} />
      <path d="M61,118 Q82,107 77,127 Q68,124 61,118" {...leafP} />
    </>
  );
}
function LeavesHigh() {
  return (
    <>
      <path d="M62,98 Q47,90 50,105 Q57,103 62,98" {...leafPs} />
      <path d="M62,98 Q77,90 74,105 Q67,103 62,98" {...leafPs} />
    </>
  );
}

// ─── ステージ別コンテンツ ───
function Sprout() {
  return (
    <>
      <path d="M60,136 Q62,127 60,118" {...stemP} />
      <circle cx="60" cy="116" r="3" fill={C.budFill} stroke={C.bud} strokeWidth="1.2" />
    </>
  );
}

function Seedling() {
  return (
    <>
      <path d="M60,136 Q63,115 60,95" {...stemP} />
      <path d="M60,115 Q42,105 46,123 Q54,119 60,115" {...leafPs} />
      <path d="M60,115 Q78,105 74,123 Q66,119 60,115" {...leafPs} />
      <path d="M60,95 Q65,86 60,82 Q55,86 60,95"
        stroke={C.bud} strokeWidth="1.2" fill={C.budFill} />
    </>
  );
}

function Grown() {
  return (
    <>
      <path d="M60,136 Q65,112 62,76" {...stemP} />
      <LeavesLow />
      <LeavesHigh />
      <path d="M62,76 Q68,66 62,61 Q56,66 62,76"
        stroke={C.bud} strokeWidth="1.5" fill={C.budFill} />
    </>
  );
}

function Bud() {
  return (
    <>
      <path d="M60,136 Q65,108 63,68" {...stemP} />
      <LeavesLow />
      <LeavesHigh />
      {/* 蕾 */}
      <path d="M63,68 Q72,55 63,48 Q54,55 63,68"
        stroke={C.bud} strokeWidth="1.8" fill={C.budFill} />
      {/* 萼 */}
      <path d="M63,65 Q56,60 58,52" stroke={C.leaf} strokeWidth="1" fill="none" />
      <path d="M63,65 Q70,60 68,52" stroke={C.leaf} strokeWidth="1" fill="none" />
    </>
  );
}

const PETAL_ANGLES = [0, 60, 120, 180, 240, 300];

function Flower() {
  return (
    <>
      <path d="M60,136 Q65,108 63,68" {...stemP} />
      <LeavesLow />
      <LeavesHigh />
      {/* 花びら 6枚（中心 63,56 を軸に回転） — ローズ系カラー */}
      {PETAL_ANGLES.map((deg) => (
        <ellipse key={deg}
          cx="63" cy="44" rx="5" ry="10"
          fill={FC.petalFill} stroke={FC.petal} strokeWidth="1.2"
          transform={`rotate(${deg}, 63, 56)`}
        />
      ))}
      {/* 花の中心 */}
      <circle cx="63" cy="56" r="6" fill={FC.center} stroke={FC.glow} strokeWidth="1" />
    </>
  );
}

// ─── ステージ → コンテンツのマッピング ───
const STAGE_CONTENT: Record<PlantStage, React.ReactNode> = {
  soil:     null,
  sprout:   <Sprout />,
  seedling: <Seedling />,
  grown:    <Grown />,
  bud:      <Bud />,
  flower:   <Flower />,
};

// ─── メインコンポーネント ───
const variants = {
  initial: { opacity: 0, y: 6, scale: 0.94 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit:    { opacity: 0, y: -4, scale: 0.97 },
};

export function PlantAnimation({
  stage,
  volume,
}: {
  stage: PlantStage;
  volume?: MotionValue<number>;
}) {
  return (
    <svg viewBox="0 0 120 160" width="120" height="160"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "visible" }}
    >
      {volume ? <SoilGlow volume={volume} /> : <Soil />}
      <AnimatePresence mode="wait">
        <motion.g
          key={stage}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          {STAGE_CONTENT[stage]}
        </motion.g>
      </AnimatePresence>
    </svg>
  );
}
