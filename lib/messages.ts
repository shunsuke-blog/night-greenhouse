/**
 * 案内人の問いかけ・返しパターン
 * cycleLogCount（0〜6）を使ってインデックスを決定する
 */

// ログ記録前に表示する問いかけ（7パターン）
const QUESTIONS = [
  "今夜もここに来てくれましたね。今日はどんな一日でしたか？",
  "あなたの言葉を待っていました。今、心の中で一番大きく感じていることは何ですか？",
  "また会えましたね。今日起きたことを、ゆっくり話してみてください。",
  "静かな夜に、あなたの声が届きました。今日、あなたを動かした出来事はありましたか？",
  "こんばんは。今夜の気持ちを、そのまま聞かせてください。",
  "あなたが来てくれると、温室が少し温かくなります。今日はどんな気持ちでしたか？",
  "今日の終わりに、ここに来てくれた。その一日を、少し聞かせてもらえますか？",
] as const;

// ログ記録後に表示する返し（7パターン）
const RESPONSES = [
  "今夜の言葉を、静かに受け取りました。あなたがここに来てくれたことで、土が少し温かくなりました。",
  "その言葉が、ここに根を張りました。ゆっくり休んでください。",
  "話してくれてありがとうございます。あなたの声が、この温室の栄養になっています。",
  "その気持ちを、ありのままに受け取りました。どうか今夜は、安らかに。",
  "あなたの言葉は、ちゃんとここに届いています。また明日、聞かせてください。",
  "今日もよく話してくれましたね。その言葉が、あなたの中で少しずつ育っています。",
  "今夜もここに来てくれて、ありがとうございます。あなたの一日が、この土に刻まれました。",
] as const;

/**
 * cycleLogCount（未記録数）に対応する問いかけを返す
 * displayName がある場合は文頭に添える
 */
export function getQuestion(cycleLogCount: number, displayName?: string): string {
  const q = QUESTIONS[cycleLogCount % QUESTIONS.length];
  const prefix = displayName ? `${displayName}さん、` : "";
  return `「${prefix}${q}」`;
}

/**
 * 記録直後に表示する返しを返す（記録前の cycleLogCount を渡す）
 */
export function getResponse(cycleLogCount: number): string {
  return `「${RESPONSES[cycleLogCount % RESPONSES.length]}」`;
}
