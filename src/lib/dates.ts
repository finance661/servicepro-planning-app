// src/lib/dates.ts

import { format, parse, isValid, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { nl } from 'date-fns/locale';

// Sheets stores dates as "DD-MM-YY" or "DD-01-25"
export function parseDienstDatum(datumStr: string): Date | null {
  if (!datumStr) return null;
  
  // Try DD-MM-YY
  let d = parse(datumStr, 'dd-MM-yy', new Date());
  if (isValid(d)) return d;
  
  // Try DD-MM-YYYY
  d = parse(datumStr, 'dd-MM-yyyy', new Date());
  if (isValid(d)) return d;
  
  return null;
}

export function formatDatumForSheet(date: Date): string {
  return format(date, 'dd-MM-yy');
}

export function formatDatumDisplay(datumStr: string): string {
  const d = parseDienstDatum(datumStr);
  if (!d) return datumStr;
  return format(d, 'dd-MM-yyyy');
}

export function formatDatumInput(datumStr: string): string {
  const d = parseDienstDatum(datumStr);
  if (!d) return '';
  return format(d, 'yyyy-MM-dd'); // HTML date input format
}

export function inputDateToSheet(inputDate: string): string {
  // inputDate is "YYYY-MM-DD" from HTML input
  const d = parse(inputDate, 'yyyy-MM-dd', new Date());
  if (!isValid(d)) return inputDate;
  return format(d, 'dd-MM-yy');
}

export function todayForInput(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function getWeekRange(date: Date): { start: string; end: string } {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
}

export function getMonthRange(date: Date): { start: string; end: string } {
  return {
    start: format(startOfMonth(date), 'yyyy-MM-dd'),
    end: format(endOfMonth(date), 'yyyy-MM-dd'),
  };
}

export function dienstDatumInRange(datumStr: string, begin: string, eind: string): boolean {
  const d = parseDienstDatum(datumStr);
  if (!d) return false;
  const df = format(d, 'yyyy-MM-dd');
  return df >= begin && df <= eind;
}

export function formatMonthHeader(dateStr: string): string {
  const d = parse(dateStr, 'yyyy-MM-dd', new Date());
  return format(d, 'MMMM yyyy', { locale: nl });
}

export function formatWeekdayShort(datumStr: string): string {
  const d = parseDienstDatum(datumStr);
  if (!d) return '';
  return format(d, 'EEEE', { locale: nl });
}
