const TZ = 'Asia/Kolkata';
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_LONG: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', weekday: 'short', hourCycle: 'h23',
});

export function istParts(iso: string) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour % 24, minute: +p.minute, weekday: p.weekday };
}

export function resolveNow(value?: string): Date {
  return value ? new Date(value) : new Date();
}

export function splitEvents<T extends { start: string; end: string | null }>(events: T[], now: Date) {
  const t = now.getTime();
  const endOf = (e: T) => Date.parse(e.end ?? e.start);
  const upcoming = events.filter((e) => endOf(e) >= t).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const past = events.filter((e) => endOf(e) < t).sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
  return { upcoming, past };
}

export function formatDateStamp(iso: string) {
  const p = istParts(iso);
  return { weekday: p.weekday, day: String(p.day).padStart(2, '0'), month: MONTH_SHORT[p.month - 1] };
}

export function formatLongDate(iso: string) {
  const p = istParts(iso);
  return `${WEEKDAY_LONG[p.weekday]} ${p.day} ${MONTH_LONG[p.month - 1]}`;
}

export function formatShortDate(iso: string) {
  const p = istParts(iso);
  return `${p.weekday} ${p.day} ${MONTH_SHORT[p.month - 1]}`;
}

function clock(iso: string) {
  const { hour, minute } = istParts(iso);
  const meridiem = hour < 12 ? 'am' : 'pm';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return { text: minute === 0 ? `${h}` : `${h}:${String(minute).padStart(2, '0')}`, meridiem };
}

export function formatTime(iso: string) {
  const c = clock(iso);
  return `${c.text} ${c.meridiem}`;
}

export function formatTimeRange(start: string, end: string | null) {
  if (!end) return formatTime(start);
  const a = clock(start);
  const b = clock(end);
  return a.meridiem === b.meridiem ? `${a.text} to ${b.text} ${b.meridiem}` : `${a.text} ${a.meridiem} to ${b.text} ${b.meridiem}`;
}
