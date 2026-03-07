/**
 * ある月のUTC取得範囲を返す（タイムゾーン最大オフセット±14hバッファ付き）
 * 取得後は localDateStr で暦日変換・フィルタすること
 */
export function getMonthUTCRange(year: number, month: number): { gte: string; lt: string } {
  const buffer = 14 * 3600_000; // 14h = 世界最大オフセット
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const nextMonth = new Date(Date.UTC(year, month, 1));
  return {
    gte: new Date(firstDay.getTime() - buffer).toISOString(),
    lt:  new Date(nextMonth.getTime() + buffer).toISOString(),
  };
}

/**
 * ある日のUTC取得範囲を返す（タイムゾーン最大オフセット±14hバッファ付き）
 * 取得後は localDateStr で暦日変換・フィルタすること
 */
export function getDayUTCRange(dateStr: string): { gte: string; lt: string } {
  const buffer = 14 * 3600_000;
  const dayStart = new Date(dateStr + "T00:00:00Z");
  return {
    gte: new Date(dayStart.getTime() - buffer).toISOString(),
    lt:  new Date(dayStart.getTime() + 24 * 3600_000 + buffer).toISOString(),
  };
}

export function localDateStr(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * 1日の切り替わりを午前5時とする「アプリ内日付」を返す
 * 例: 午前4:30 → 前日扱い、午前5:00 → 当日扱い
 */
const DAY_START_HOUR = 5;
export function appDateStr(date: Date, timezone: string): string {
  const shifted = new Date(date.getTime() - DAY_START_HOUR * 3600_000);
  return localDateStr(shifted, timezone);
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
