const MINUTES_IN_DAY = 24 * 60;

function datePartsToLocalDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function toCanonicalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseUniversalDate(value: unknown): Date | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return datePartsToLocalDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 20000 && value < 90000) {
      const date = new Date(Date.UTC(1899, 11, 30 + Math.floor(value)));
      return datePartsToLocalDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    }
    return null;
  }

  if (typeof value !== "string") return null;
  if (!value.trim()) return null;

  const trimmed = value.trim();

  if (/^\d{4,6}(\.\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed);
    if (Number.isFinite(serial) && serial > 20000 && serial < 90000) {
      const date = new Date(Date.UTC(1899, 11, 30 + Math.floor(serial)));
      return datePartsToLocalDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    }
  }

  const compactMatch = trimmed.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2}|\d{4})$/);
  if (compactMatch) {
    const day = Number(compactMatch[1]);
    const month = Number(compactMatch[2]);
    const year = compactMatch[3].length === 2 ? Number(`20${compactMatch[3]}`) : Number(compactMatch[3]);
    return datePartsToLocalDate(year, month, day);
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return datePartsToLocalDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;

  return datePartsToLocalDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function parseDateValue(value: unknown): string {
  const parsed = parseUniversalDate(value);
  return parsed ? toCanonicalDate(parsed) : "";
}

export function parseDate(value: unknown): string {
  return parseDateValue(value);
}

export function parseSheetDate(value: unknown): Date | null {
  return parseUniversalDate(value);
}

export function parseInputDate(value: unknown): Date | null {
  return parseUniversalDate(value);
}

export function isSameDate(left: unknown, right: unknown): boolean {
  const leftDate = parseUniversalDate(left);
  const rightDate = parseUniversalDate(right);
  return Boolean(leftDate && rightDate && leftDate.getTime() === rightDate.getTime());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function isWithinDateRange(serviceDate: unknown, startDate: unknown, endDate: unknown): boolean {
  if (!startDate && !endDate) return false;

  const service = parseSheetDate(serviceDate);
  const start = startDate ? parseInputDate(startDate) : null;
  const end = endDate ? parseInputDate(endDate) : null;

  if (!service) return false;
  if (start && service.getTime() < start.getTime()) return false;
  if (end && service.getTime() > end.getTime()) return false;
  return true;
}

export function formatDate(value: unknown): string {
  const parsed = parseDate(value);
  if (!parsed) return typeof value === "string" ? value.trim() : "";

  const [year, month, day] = parsed.split("-");
  return `${day}-${month}-${year}`;
}

export function formatSheetDate(value: string): string {
  return formatDate(value);
}

export function sheetDateToInputDate(value: string): string {
  return parseDate(value);
}

export function inputDateToSheetDate(value: string): string {
  return formatSheetDate(value);
}

function parseTimeToMinutes(value: string): number | null {
  if (!value) return null;

  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function parseDurationToMinutes(value: string): number {
  const parsed = parseTimeToMinutes(value);
  return parsed ?? 0;
}

function formatMinutesAsDuration(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

export function calculateWorkedHours(starttijd: string, eindtijd: string, pauze: string): string {
  const start = parseTimeToMinutes(starttijd);
  let end = parseTimeToMinutes(eindtijd);

  if (start === null || end === null) return "";

  if (end < start) {
    end += MINUTES_IN_DAY;
  }

  return formatMinutesAsDuration(end - start - parseDurationToMinutes(pauze));
}

export function calculateHours(starttijd: string, eindtijd: string, pauze: string): string {
  return calculateWorkedHours(starttijd, eindtijd, pauze);
}
