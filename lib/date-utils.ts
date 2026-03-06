/**
 * 指定タイムゾーンでの暦日文字列を返す (YYYY-MM-DD)
 * ※ JST(UTC+9)の場合、UTC 15:00 以降は翌日として扱う
 */
export function localDateStr(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * firstLogDate から現在まで何週目かを計算（タイムゾーン対応）
 * ユーザーの暦日ベースで比較するため、JST深夜もズレなし
 */
export function calcWeekNumber(firstLogDate: Date, timezone: string): number {
  // 両日付をユーザーのタイムゾーンで暦日化してUTC 00:00 で比較
  const first = new Date(localDateStr(firstLogDate, timezone) + "T00:00:00Z");
  const now   = new Date(localDateStr(new Date(), timezone) + "T00:00:00Z");
  const diffDays = Math.round((now.getTime() - first.getTime()) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}
