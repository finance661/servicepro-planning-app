"use client";

import { BookOpen, CalendarDays, Check, Clock3, Download, Loader2, Pencil, Plus, RefreshCw, Save, Search, Settings, Trash2, X } from "lucide-react";
import Image from "next/image";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { GoogleSheetsSettingsModal } from "@/components/GoogleSheetsSettingsModal";
import {
  addDays as addDateDays,
  calculateHours,
  formatDate,
  isWithinDateRange as isServiceWithinDateRange,
  parseDate,
  parseUniversalDate,
  sheetDateToInputDate
} from "@/lib/time";
import { DEFAULT_STATUSES } from "@/lib/types";
import type { LogboekItem, PlanningInput, PlanningItem, PublicGoogleSheetsSettings, StatusOption } from "@/lib/types";

type ViewMode = "day" | "week" | "month";

type FormState = PlanningInput & {
  rowId?: number;
};

type PlanningFilters = {
  begindatum: string;
  einddatum: string;
  service: string;
  medewerker: string;
  status: string;
};

const GOOGLE_SHEETS_NOT_CONNECTED_MESSAGE = "Google Sheets nog niet gekoppeld. Open Instellingen om te koppelen.";
const SERVICEPRO_LOGO_SRC = "/Bedrijfslog ServicePro_2026.png";
const serviceProLogoProps = {
  src: SERVICEPRO_LOGO_SRC,
  alt: "ServicePro logo",
  width: 160,
  height: 60,
  className: "h-14 w-auto object-contain",
  priority: true
};

const emptyFilters: PlanningFilters = {
  begindatum: "",
  einddatum: "",
  service: "",
  medewerker: "",
  status: ""
};

const emptyForm: FormState = {
  datum: new Date().toISOString().slice(0, 10),
  service: "",
  medewerker: "",
  status: "Open",
  starttijd: "08:00",
  pauze: "00:30",
  eindtijd: "17:00",
  opmerking: ""
};

const statusClasses: Record<StatusOption["kleur"], string> = {
  orange: "bg-amber-100 text-amber-800 ring-amber-200",
  blue: "bg-blue-100 text-blue-800 ring-blue-200",
  purple: "bg-purple-100 text-purple-800 ring-purple-200",
  green: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  red: "bg-red-100 text-red-800 ring-red-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-200"
};

const statusAccentClasses: Record<StatusOption["kleur"], string> = {
  orange: "border-l-amber-400",
  blue: "border-l-blue-500",
  purple: "border-l-purple-500",
  green: "border-l-emerald-500",
  red: "border-l-red-500",
  slate: "border-l-slate-300"
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function toInputDate(value: string): string {
  return sheetDateToInputDate(value) || "";
}

function formatDisplayDate(value: string): string {
  return formatDate(value) || "Geen datum";
}

function getISOWeekNumber(value: unknown): number | null {
  const parsed = parseUniversalDate(value);
  if (!parsed) return null;

  const date = new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function dateFromInput(value: string): Date {
  return parseUniversalDate(value) ?? parseUniversalDate(new Date()) ?? new Date();
}

function inputDateFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatInputDate(date: Date): string {
  return parseDate(date);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function getStartOfCurrentMonth(): Date {
  const today = parseUniversalDate(new Date()) ?? new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1);
}

function getEndOfCurrentMonth(): Date {
  const today = parseUniversalDate(new Date()) ?? new Date();
  return new Date(today.getFullYear(), today.getMonth() + 1, 0);
}

function getMonday(dateString: string): Date {
  const date = dateFromInput(dateString);
  const day = date.getDay() || 7;
  return addDays(date, 1 - day);
}

function isInSelectedWeek(item: PlanningItem, dateString: string): boolean {
  const itemDate = toInputDate(item.datum);
  if (!itemDate || !dateString) return false;

  const weekStart = getMonday(dateString).getTime();
  const weekEnd = addDays(getMonday(dateString), 7).getTime();
  const current = dateFromInput(itemDate).getTime();
  return current >= weekStart && current < weekEnd;
}

function formatWeekRange(dateString: string): string {
  const monday = getMonday(dateString);
  const sunday = addDays(monday, 6);
  return `${formatDisplayDate(inputDateFromDate(monday))} - ${formatDisplayDate(inputDateFromDate(sunday))}`;
}

function timeToMinutes(value: string): number {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 9999;
  return Number(match[1]) * 60 + Number(match[2]);
}

function byDateAndTimeNewestFirst(a: PlanningItem, b: PlanningItem): number {
  const aDate = parseUniversalDate(a.datum);
  const bDate = parseUniversalDate(b.datum);
  if (!aDate && !bDate) return timeToMinutes(a.starttijd) - timeToMinutes(b.starttijd);
  if (!aDate) return 1;
  if (!bDate) return -1;
  if (aDate.getTime() !== bDate.getTime()) return aDate.getTime() - bDate.getTime();
  return timeToMinutes(a.starttijd) - timeToMinutes(b.starttijd);
}

function durationToMinutes(value: string): number {
  const normalized = value.trim().replace(",", ".");
  const hoursAndMinutes = normalized.match(/^(\d{1,4}):(\d{2})$/);
  if (hoursAndMinutes) return Number(hoursAndMinutes[1]) * 60 + Number(hoursAndMinutes[2]);

  const decimal = Number(normalized);
  if (Number.isFinite(decimal)) return Math.round(decimal * 60);

  return 0;
}

function formatTotalHours(totalMinutes: number): string {
  const hours = totalMinutes / 60;
  return `${hours.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} uur`;
}

function totalWorkedMinutes(items: PlanningItem[]): number {
  return items.reduce((total, item) => {
    const value = item.urenGewerkt || calculateHours(item.starttijd, item.eindtijd, item.pauze);
    return total + durationToMinutes(value);
  }, 0);
}

type ExcelValue = string | number;

function escapeXml(value: ExcelValue): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function excelColumnName(index: number): string {
  let value = index + 1;
  let name = "";

  while (value > 0) {
    const modulo = (value - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    value = Math.floor((value - modulo) / 26);
  }

  return name;
}

function worksheetXml(rows: ExcelValue[][]): string {
  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, columnIndex) => {
          const reference = `${excelColumnName(columnIndex)}${rowIndex + 1}`;
          return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>
    <col min="1" max="1" width="14" customWidth="1"/>
    <col min="2" max="2" width="34" customWidth="1"/>
    <col min="3" max="3" width="24" customWidth="1"/>
    <col min="4" max="4" width="14" customWidth="1"/>
    <col min="5" max="7" width="12" customWidth="1"/>
    <col min="8" max="8" width="42" customWidth="1"/>
  </cols>
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()): { time: number; date: number } {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dosDate };
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function createZip(files: Array<{ name: string; content: string }>): Blob {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const stamp = dosDateTime();

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = encoder.encode(file.content);
    const checksum = crc32(dataBytes);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, stamp.time, true);
    localView.setUint16(12, stamp.date, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, dataBytes.length, true);
    localView.setUint32(22, dataBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, stamp.time, true);
    centralView.setUint16(14, stamp.date, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, dataBytes.length, true);
    centralView.setUint32(24, dataBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    localParts.push(localHeader, dataBytes);
    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  const zipBytes = concatBytes([...localParts, centralDirectory, endRecord]);
  const zipBuffer = zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength) as ArrayBuffer;

  return new Blob([zipBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

function createPlanningWorkbook(rows: ExcelValue[][]): Blob {
  return createZip([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Planning Export" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
    },
    {
      name: "xl/styles.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: worksheetXml(rows)
    }
  ]);
}

function sortedUniqueOptions(options: string[]): string[] {
  return [...new Set(options.map((option) => option.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "nl", { sensitivity: "base" })
  );
}

function statusOptionFor(status: string, options: StatusOption[]): StatusOption {
  const exact = options.find((option) => normalize(option.naam) === normalize(status));
  if (exact) return exact;
  if (normalize(status).includes("gesloten")) return { naam: status || "Gesloten", kleur: "green" };
  return { naam: status || "Open", kleur: "orange" };
}

function dateInputFromDate(date: Date): string {
  return formatInputDate(date);
}

function getEffectiveDateRange(filters: PlanningFilters, viewMode: ViewMode): { startDate: string; endDate: string } {
  if (filters.begindatum || filters.einddatum) {
    return {
      startDate: filters.begindatum,
      endDate: filters.einddatum
    };
  }

  const today = parseUniversalDate(new Date()) ?? new Date();
  const startDate = dateInputFromDate(today);
  const endDate = viewMode === "week" ? dateInputFromDate(addDateDays(today, 6)) : startDate;

  return { startDate, endDate };
}

function filterPlanning(items: PlanningItem[], filters: PlanningFilters, viewMode: ViewMode): PlanningItem[] {
  const { startDate, endDate } = getEffectiveDateRange(filters, viewMode);
  console.log("[ServicePro] datumfilter debug", {
    rawStart: filters.begindatum,
    rawEnd: filters.einddatum,
    filterStartDatum: startDate,
    filterEindDatum: endDate,
    eersteDatums: items.slice(0, 5).map((item) => ({
      raw: item.datum,
      parsed: parseDate(item.datum),
      service: item.service
    }))
  });

  return items
    .filter((item) => {
      const itemDate = toInputDate(item.datum);
      const matchesDate = isServiceWithinDateRange(itemDate, startDate, endDate);
      const matchesService = !filters.service || item.service === filters.service;
      const matchesMedewerker = !filters.medewerker || item.medewerker === filters.medewerker;
      const matchesStatus = !filters.status || normalize(item.status) === normalize(filters.status);
      return matchesDate && matchesService && matchesMedewerker && matchesStatus;
    })
    .sort(byDateAndTimeNewestFirst);
}

function formatPeriodTitle(filters: PlanningFilters): string {
  if (filters.begindatum && filters.einddatum) {
    return `${formatDisplayDate(filters.begindatum)} - ${formatDisplayDate(filters.einddatum)}`;
  }
  if (filters.begindatum) return `Vanaf ${formatDisplayDate(filters.begindatum)}`;
  if (filters.einddatum) return `Tot en met ${formatDisplayDate(filters.einddatum)}`;
  return "Kies een periode";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Er ging iets mis.");
  return data as T;
}

export default function Home() {
  const initialized = useRef(false);
  const topTableScrollRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef(false);
  const [planning, setPlanning] = useState<PlanningItem[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [medewerkers, setMedewerkers] = useState<string[]>([]);
  const [statussen, setStatussen] = useState<StatusOption[]>(DEFAULT_STATUSES);
  const [settings, setSettings] = useState<PublicGoogleSheetsSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logboekOpen, setLogboekOpen] = useState(false);
  const [logboekItems, setLogboekItems] = useState<LogboekItem[]>([]);
  const [logboekLoading, setLogboekLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [filters, setFilters] = useState<PlanningFilters>(emptyFilters);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editForm, setEditForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadSettings(): Promise<PublicGoogleSheetsSettings> {
    const loadedSettings = await fetchJson<PublicGoogleSheetsSettings>("/api/settings/google-sheets");
    setSettings(loadedSettings);
    return loadedSettings;
  }

  async function loadData(forceRefresh = false) {
    setLoading(true);
    setError("");
    try {
      console.log(`[ServicePro] data laden${forceRefresh ? " met verversen" : ""}`);
      const refresh = forceRefresh ? "?refresh=1" : "";
      const [planningData, serviceData, medewerkerData, statusData] = await Promise.all([
        fetchJson<PlanningItem[]>(`/api/planning${refresh}`),
        fetchJson<string[]>(`/api/services${refresh}`),
        fetchJson<string[]>(`/api/medewerkers${refresh}`),
        fetchJson<StatusOption[]>("/api/statussen")
      ]);
      setPlanning(planningData);
      setServices(serviceData);
      setMedewerkers(medewerkerData);
      setStatussen(statusData);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Data kon niet worden geladen.";
      if (message.includes("Google Sheets nog niet gekoppeld")) {
        setError(GOOGLE_SHEETS_NOT_CONNECTED_MESSAGE);
        setSettingsOpen(true);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function initialize() {
      setLoading(true);
      setError("");
      try {
        const currentSettings = await loadSettings();
        if (currentSettings.configured) {
          await loadData();
        } else {
          setError(GOOGLE_SHEETS_NOT_CONNECTED_MESSAGE);
          setSettingsOpen(true);
          setLoading(false);
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Instellingen konden niet worden geladen.");
        setLoading(false);
      }
    }

    void initialize();
  }, []);

  const hasDateFilter = Boolean(filters.begindatum || filters.einddatum);
  const filteredPlanning = useMemo(() => filterPlanning(planning, filters, viewMode), [filters, planning, viewMode]);
  const selectedTotalHours = useMemo(() => formatTotalHours(totalWorkedMinutes(filteredPlanning)), [filteredPlanning]);
  const sortedServices = useMemo(() => sortedUniqueOptions(services), [services]);
  const sortedMedewerkers = useMemo(() => sortedUniqueOptions(medewerkers), [medewerkers]);
  const workedHours = calculateHours(form.starttijd, form.eindtijd, form.pauze);
  const effectiveRange = getEffectiveDateRange(filters, viewMode);
  const titleDate = hasDateFilter
    ? formatPeriodTitle(filters)
    : viewMode === "week"
      ? `${formatDisplayDate(effectiveRange.startDate)} - ${formatDisplayDate(effectiveRange.endDate)}`
      : formatDisplayDate(effectiveRange.startDate);
  const emptyStateTitle = planning.length === 0
      ? "Geen planningdata gevonden in Google Sheets. Controleer tabblad en kolommen."
      : hasDateFilter
        ? "Er zijn diensten geladen, maar niet binnen deze periode."
        : "Geen diensten gevonden";
  const emptyStateDescription = hasDateFilter ? "Pas de periode of filters aan." : "Pas de filters aan of klik op Data vernieuwen.";

  useEffect(() => {
    console.log("[ServicePro] aantal diensten na filter:", filteredPlanning.length);
  }, [filteredPlanning.length]);

  function modeButtonClass(mode: ViewMode): string {
    return `flex min-w-24 flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
      viewMode === mode ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"
    }`;
  }

  function selectViewMode(mode: ViewMode) {
    const today = parseUniversalDate(new Date()) ?? new Date();
    let begindatum = formatInputDate(today);
    let einddatum = begindatum;

    if (mode === "week") {
      einddatum = formatInputDate(addDateDays(today, 6));
    }

    if (mode === "month") {
      begindatum = formatInputDate(getStartOfCurrentMonth());
      einddatum = formatInputDate(getEndOfCurrentMonth());
    }

    setViewMode(mode);
    setFilters((current) => ({ ...current, begindatum, einddatum }));
  }

  function syncTableScroll(source: "top" | "table") {
    const top = topTableScrollRef.current;
    const table = tableScrollRef.current;
    if (!top || !table || syncingScrollRef.current) return;

    const sourceElement = source === "top" ? top : table;
    const targetElement = source === "top" ? table : top;
    syncingScrollRef.current = true;
    targetElement.scrollLeft = sourceElement.scrollLeft;
    window.requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }

  function editItem(item: PlanningItem) {
    setEditForm({
      rowId: item.rowId,
      id: item.id,
      datum: toInputDate(item.datum),
      service: item.service,
      medewerker: item.medewerker,
      status: item.status || "Open",
      starttijd: item.starttijd,
      pauze: item.pauze,
      eindtijd: item.eindtijd,
      opmerking: item.opmerking
    });
  }

  function resetForm(dateToKeep = form.datum) {
    setForm({ ...emptyForm, datum: dateToKeep });
  }

  async function savePlanning(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload: PlanningInput = {
      datum: form.datum,
      service: form.service,
      medewerker: form.medewerker,
      status: form.status,
      starttijd: form.starttijd,
      pauze: form.pauze,
      eindtijd: form.eindtijd,
      opmerking: form.opmerking
    };

    try {
      const url = form.rowId ? `/api/planning/${form.rowId}` : "/api/planning";
      const method = form.rowId ? "PUT" : "POST";
      await fetchJson<PlanningItem>(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      await loadData(true);
      if (form.rowId) {
        setSuccessMessage("Dienst opgeslagen");
      } else {
        setSuccessMessage("Dienst succesvol toegevoegd");
      }
      resetForm(form.datum);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Opslaan is niet gelukt.";
      console.error("[ServicePro] Opslaan naar Google Sheets mislukt:", caught);
      setError(form.rowId ? message : `Opslaan naar Google Sheets mislukt. ${message}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveEditedPlanning(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editForm?.rowId) return;

    setSaving(true);
    setError("");

    const payload: PlanningInput = {
      id: editForm.id,
      datum: editForm.datum,
      service: editForm.service,
      medewerker: editForm.medewerker,
      status: editForm.status,
      starttijd: editForm.starttijd,
      pauze: editForm.pauze,
      eindtijd: editForm.eindtijd,
      opmerking: editForm.opmerking
    };

    try {
      await fetchJson<PlanningItem>(`/api/planning/${editForm.rowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      await loadData(true);
      setSuccessMessage("Dienst succesvol gewijzigd");
      setEditForm(null);
    } catch (caught) {
      console.error("[ServicePro] Opslaan naar Google Sheets mislukt:", caught);
      setError(caught instanceof Error ? caught.message : "Dienst wijzigen is niet gelukt.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(item: PlanningItem) {
    const confirmed = window.confirm("Weet je zeker dat je deze dienst wilt verwijderen?");
    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      await fetchJson<PlanningItem>(`/api/planning/${item.rowId}`, { method: "DELETE" });
      await loadData(true);
      setSuccessMessage("Dienst succesvol verwijderd");
    } catch (caught) {
      console.error("[ServicePro] Opslaan naar Google Sheets mislukt:", caught);
      setError(caught instanceof Error ? caught.message : "Dienst verwijderen is niet gelukt.");
    } finally {
      setSaving(false);
    }
  }

  async function openLogboek() {
    setLogboekOpen(true);
    setLogboekLoading(true);
    setError("");

    try {
      const items = await fetchJson<LogboekItem[]>("/api/logboek");
      setLogboekItems(items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Logboek kon niet worden geladen.");
    } finally {
      setLogboekLoading(false);
    }
  }

  function downloadExcel() {
    if (filteredPlanning.length === 0) {
      setError("Geen diensten om te exporteren.");
      return;
    }

    setError("");
    const startDate = parseDate(effectiveRange.startDate) || "zonder-startdatum";
    const endDate = parseDate(effectiveRange.endDate) || startDate;
    const rows: ExcelValue[][] = [
      ["ServicePro Planning Export"],
      [],
      ["Periode", `${formatDisplayDate(effectiveRange.startDate)} t/m ${formatDisplayDate(effectiveRange.endDate)}`],
      ["Totaal diensten", filteredPlanning.length],
      ["Totaal gewerkte uren", selectedTotalHours],
      [],
      ["Datum", "Service", "Medewerker", "Status", "Starttijd", "Eindtijd", "Uren", "Opmerking"],
      ...filteredPlanning.map((item) => [
        formatDisplayDate(item.datum),
        item.service,
        item.medewerker,
        item.status,
        item.starttijd,
        item.eindtijd,
        item.urenGewerkt || calculateHours(item.starttijd, item.eindtijd, item.pauze),
        item.opmerking
      ])
    ];
    const blob = createPlanningWorkbook(rows);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `servicepro-planning_${startDate}_tot_${endDate}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  async function updateStatus(item: PlanningItem, status: string) {
    setSaving(true);
    setError("");

    try {
      const saved = await fetchJson<PlanningItem>(`/api/planning/${item.rowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          datum: item.datum,
          service: item.service,
          medewerker: item.medewerker,
          status,
          starttijd: item.starttijd,
          pauze: item.pauze,
          eindtijd: item.eindtijd,
          opmerking: item.opmerking
        })
      });

      setPlanning((current) => current.map((entry) => (entry.rowId === saved.rowId ? saved : entry)));
      setSuccessMessage("Status opgeslagen");
      void loadData(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Status wijzigen is niet gelukt.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8 text-slate-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-teal-700">ServicePro</p>
            <div className="mt-1 flex items-center gap-3">
              <Image {...serviceProLogoProps} />
              <h1 className="text-4xl font-bold tracking-normal text-slate-950">Planning</h1>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex h-11 w-full rounded-xl border border-slate-200 bg-white p-1 shadow-sm md:w-auto">
              <button type="button" onClick={() => selectViewMode("day")} className={modeButtonClass("day")}>
                <CalendarDays className="h-4 w-4" />
                Dag
              </button>
              <button type="button" onClick={() => selectViewMode("week")} className={modeButtonClass("week")}>
                <Clock3 className="h-4 w-4" />
                Week
              </button>
              <button type="button" onClick={() => selectViewMode("month")} className={modeButtonClass("month")}>
                <CalendarDays className="h-4 w-4" />
                Maand
              </button>
            </div>
            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={loading}
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Data vernieuwen
            </button>
            <button
              type="button"
              onClick={() => void openLogboek()}
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <BookOpen className="h-4 w-4" />
              Logboek
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Settings className="h-4 w-4" />
              Instellingen
            </button>
            <div className="flex h-16 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
              <Image {...serviceProLogoProps} />
            </div>
          </div>
        </header>

        {successMessage ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
            {successMessage}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {error}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3 lg:grid-cols-6">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Begindatum
            <input
              type="date"
              value={filters.begindatum}
              onChange={(event) => setFilters((current) => ({ ...current, begindatum: event.target.value }))}
              className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
            <WeekBadge date={filters.begindatum} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Einddatum
            <input
              type="date"
              value={filters.einddatum}
              onChange={(event) => setFilters((current) => ({ ...current, einddatum: event.target.value }))}
              className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
            <WeekBadge date={filters.einddatum} />
          </label>
          <FilterSelect label="Service" value={filters.service} options={sortedServices} onChange={(value) => setFilters((current) => ({ ...current, service: value }))} />
          <FilterSelect
            label="Medewerker"
            value={filters.medewerker}
            options={medewerkers}
            onChange={(value) => setFilters((current) => ({ ...current, medewerker: value }))}
          />
          <FilterSelect
            label="Status"
            value={filters.status}
            options={statussen.map((status) => status.naam)}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          />
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setFilters(emptyFilters)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Search className="h-4 w-4" />
              Wis filters
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_0.9fr]">
          <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">{titleDate}</h2>
                <p className="text-sm text-slate-500">{filteredPlanning.length} diensten</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Totaal gewerkte uren</p>
                  <p className="mt-1 text-xl font-bold text-slate-950">{selectedTotalHours}</p>
                </div>
                <button
                  type="button"
                  onClick={downloadExcel}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  Download Excel
                </button>
                {loading ? (
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Laden
                  </div>
                ) : null}
              </div>
            </div>

            <div className="hidden border-b border-slate-100 bg-white lg:block">
              <div
                ref={topTableScrollRef}
                onScroll={() => syncTableScroll("top")}
                className="overflow-x-auto"
                aria-hidden="true"
              >
                <div className="h-3 w-full min-w-[720px]" />
              </div>
            </div>

            <div ref={tableScrollRef} onScroll={() => syncTableScroll("table")} className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-[98px] whitespace-nowrap px-4 py-3">Datum</th>
                    <th className="w-[220px] px-4 py-3">Service</th>
                    <th className="w-[180px] px-4 py-3">Medewerker</th>
                    <th className="w-[112px] whitespace-nowrap px-4 py-3">Status</th>
                    <th className="w-[76px] whitespace-nowrap px-4 py-3">Start</th>
                    <th className="w-[92px] whitespace-nowrap px-4 py-3">Einde</th>
                    <th className="w-[74px] whitespace-nowrap px-4 py-3">Uren</th>
                    <th className="px-4 py-3">Opmerking</th>
                    <th className="w-[104px] px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPlanning.map((item) => {
                    const status = statusOptionFor(item.status, statussen);
                    return (
                      <tr key={item.rowId} className="align-middle transition hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{formatDisplayDate(item.datum)}</td>
                        <td className="max-w-[220px] truncate px-4 py-3 text-slate-700" title={item.service}>{item.service}</td>
                        <td className="max-w-[180px] truncate px-4 py-3 text-slate-700" title={item.medewerker}>{item.medewerker}</td>
                        <td className="px-4 py-3">
                          <select
                            value={status.naam}
                            onChange={(event) => void updateStatus(item, event.target.value)}
                            className={`h-9 rounded-full px-3 text-xs font-bold ring-1 outline-none ${statusClasses[status.kleur]}`}
                          >
                            {DEFAULT_STATUSES.map((option) => (
                              <option key={option.naam} value={option.naam}>
                                {option.naam}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">{item.starttijd}</td>
                        <td className="min-w-[92px] whitespace-nowrap px-4 py-3 text-slate-700">{item.eindtijd}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-950">{item.urenGewerkt || calculateHours(item.starttijd, item.eindtijd, item.pauze)}</td>
                        <td className="max-w-52 truncate px-4 py-3 text-slate-600">{item.opmerking}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => editItem(item)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                            aria-label="Dienst aanpassen"
                            title="Dienst aanpassen"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteItem(item)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-white text-red-600 shadow-sm transition hover:bg-red-50"
                            aria-label="Dienst verwijderen"
                            title="Dienst verwijderen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!loading && filteredPlanning.length === 0 ? <EmptyState title={emptyStateTitle} description={emptyStateDescription} /> : null}
            </div>

            <MobilePlanningList
              items={filteredPlanning}
              statussen={statussen}
              onEdit={editItem}
              onDelete={deleteItem}
              onStatusChange={updateStatus}
              loading={loading}
              emptyTitle={emptyStateTitle}
              emptyDescription={emptyStateDescription}
            />
          </section>

          <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-950">Nieuwe dienst</h2>
            </div>
            <form className="grid gap-3" onSubmit={savePlanning}>
              <Field label="Datum">
                <input required type="date" value={form.datum} onChange={(event) => setForm((current) => ({ ...current, datum: event.target.value }))} className="input" />
              </Field>
              <Field label="Service">
                <select required value={form.service} onChange={(event) => setForm((current) => ({ ...current, service: event.target.value }))} className="input">
                  <option value="">Selecteer service</option>
                  {sortedServices.map((service) => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Medewerker">
                <select required value={form.medewerker} onChange={(event) => setForm((current) => ({ ...current, medewerker: event.target.value }))} className="input">
                  <option value="">Selecteer medewerker</option>
                  {sortedMedewerkers.map((medewerker) => (
                    <option key={medewerker} value={medewerker}>
                      {medewerker}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select required value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="input">
                  {DEFAULT_STATUSES.map((status) => (
                    <option key={status.naam} value={status.naam}>
                      {status.naam}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Starttijd">
                  <input required type="time" value={form.starttijd} onChange={(event) => setForm((current) => ({ ...current, starttijd: event.target.value }))} className="input" />
                </Field>
                <Field label="Pauze">
                  <input
                    required
                    type="text"
                    inputMode="numeric"
                    pattern="^[0-9]{1,2}:[0-9]{2}$"
                    value={form.pauze}
                    onChange={(event) => setForm((current) => ({ ...current, pauze: event.target.value }))}
                    className="input"
                  />
                </Field>
                <Field label="Eindtijd">
                  <input required type="time" value={form.eindtijd} onChange={(event) => setForm((current) => ({ ...current, eindtijd: event.target.value }))} className="input" />
                </Field>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-teal-100 bg-teal-50 px-3 py-3">
                <span className="text-sm font-medium text-teal-900">Uren</span>
                <span className="text-lg font-bold text-teal-950">{workedHours || "0:00"}</span>
              </div>
              <Field label="Opmerking">
                <textarea
                  value={form.opmerking}
                  onChange={(event) => setForm((current) => ({ ...current, opmerking: event.target.value }))}
                  className="input min-h-24 resize-y py-3"
                />
              </Field>
              <button
                type="submit"
                disabled={saving}
                className="mt-1 flex h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-teal-300"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Toevoegen
              </button>
            </form>
          </aside>
        </div>
      </div>
      <EditServiceModal
        form={editForm}
        services={sortedServices}
        medewerkers={sortedMedewerkers}
        saving={saving}
        onClose={() => setEditForm(null)}
        onSubmit={saveEditedPlanning}
        onChange={(nextForm) => setEditForm(nextForm)}
      />
      <LogboekModal
        open={logboekOpen}
        items={logboekItems}
        loading={logboekLoading}
        onClose={() => setLogboekOpen(false)}
      />
      <GoogleSheetsSettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSaved={(savedSettings, message) => {
          setSettings(savedSettings);
          setSettingsOpen(false);
          setSuccessMessage(message);
          void loadData(true);
        }}
      />
    </main>
  );
}

function EditServiceModal({
  form,
  services,
  medewerkers,
  saving,
  onClose,
  onSubmit,
  onChange
}: {
  form: FormState | null;
  services: string[];
  medewerkers: string[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (form: FormState) => void;
}) {
  if (!form) return null;

  const hours = calculateHours(form.starttijd, form.eindtijd, form.pauze);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-700">ServicePro</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">Dienst wijzigen</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
            aria-label="Sluiten"
            title="Sluiten"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Datum">
              <input required type="date" value={form.datum} onChange={(event) => onChange({ ...form, datum: event.target.value })} className="input" />
            </Field>
            <Field label="Status">
              <select required value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value })} className="input">
                {DEFAULT_STATUSES.map((status) => (
                  <option key={status.naam} value={status.naam}>
                    {status.naam}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Service">
            <select required value={form.service} onChange={(event) => onChange({ ...form, service: event.target.value })} className="input">
              <option value="">Selecteer service</option>
              {services.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Medewerker">
            <select required value={form.medewerker} onChange={(event) => onChange({ ...form, medewerker: event.target.value })} className="input">
              <option value="">Selecteer medewerker</option>
              {medewerkers.map((medewerker) => (
                <option key={medewerker} value={medewerker}>
                  {medewerker}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Starttijd">
              <input required type="time" value={form.starttijd} onChange={(event) => onChange({ ...form, starttijd: event.target.value })} className="input" />
            </Field>
            <Field label="Pauze">
              <input
                required
                type="text"
                inputMode="numeric"
                pattern="^[0-9]{1,2}:[0-9]{2}$"
                value={form.pauze}
                onChange={(event) => onChange({ ...form, pauze: event.target.value })}
                className="input"
              />
            </Field>
            <Field label="Eindtijd">
              <input required type="time" value={form.eindtijd} onChange={(event) => onChange({ ...form, eindtijd: event.target.value })} className="input" />
            </Field>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-teal-100 bg-teal-50 px-3 py-3">
            <span className="text-sm font-medium text-teal-900">Uren</span>
            <span className="text-lg font-bold text-teal-950">{hours || "0:00"}</span>
          </div>
          <Field label="Opmerking">
            <textarea value={form.opmerking} onChange={(event) => onChange({ ...form, opmerking: event.target.value })} className="input min-h-24 resize-y py-3" />
          </Field>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-teal-300"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Opslaan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LogboekModal({ open, items, loading, onClose }: { open: boolean; items: LogboekItem[]; loading: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-700">ServicePro</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">Logboek</h2>
            <p className="mt-1 text-sm text-slate-500">Laatste 100 mutaties, nieuwste bovenaan.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
            aria-label="Sluiten"
            title="Sluiten"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[68vh] overflow-auto">
          {loading ? (
            <div className="flex min-h-44 items-center justify-center gap-2 text-sm font-medium text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Logboek laden
            </div>
          ) : (
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Mutatie</th>
                  <th className="px-4 py-3">Actie</th>
                  <th className="px-4 py-3">Dienst</th>
                  <th className="px-4 py-3">Medewerker</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tijd</th>
                  <th className="px-4 py-3">Uren</th>
                  <th className="px-4 py-3">Opmerking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, index) => (
                  <tr key={`${item.mutatieDatum}-${index}`} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{item.mutatieDatum}</td>
                    <td className="px-4 py-3"><LogboekBadge action={item.actie} /></td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{item.dienstDatum}</p>
                      <p className="max-w-[240px] truncate text-slate-600" title={item.service}>{item.service}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.medewerker}</td>
                    <td className="px-4 py-3 text-slate-700">{item.statusOud || "-"} -&gt; {item.statusNieuw || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{item.startOud || "-"} / {item.startNieuw || "-"} - {item.eindeOud || "-"} / {item.eindeNieuw || "-"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-950">{item.urenOud || "-"} -&gt; {item.urenNieuw || "-"}</td>
                    <td className="max-w-[260px] truncate px-4 py-3 text-slate-600" title={item.opmerking}>{item.opmerking}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && items.length === 0 ? <EmptyState title="Geen mutaties gevonden" description="Nieuwe wijzigingen verschijnen hier automatisch." /> : null}
        </div>
      </div>
    </div>
  );
}

function LogboekBadge({ action }: { action: string }) {
  const normalizedAction = normalize(action);
  const classes = normalizedAction.includes("verwijderd")
    ? "bg-red-100 text-red-800 ring-red-200"
    : normalizedAction.includes("gewijzigd")
      ? "bg-blue-100 text-blue-800 ring-blue-200"
      : "bg-emerald-100 text-emerald-800 ring-emerald-200";

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${classes}`}>{action}</span>;
}

function WeekBadge({ date }: { date: string }) {
  const weekNumber = getISOWeekNumber(date);

  return (
    <span className="mt-1 inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
      {weekNumber ? `Week ${weekNumber}` : "Week -"}
    </span>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      >
        <option value="">Alle</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
      {label}
      {children}
    </label>
  );
}

function TimeBlock({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-2">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-sm ${strong ? "font-bold text-slate-950" : "font-semibold text-slate-700"}`}>{value}</p>
    </div>
  );
}

function MobilePlanningList({
  items,
  statussen,
  onEdit,
  onDelete,
  onStatusChange,
  loading,
  emptyTitle,
  emptyDescription
}: {
  items: PlanningItem[];
  statussen: StatusOption[];
  onEdit: (item: PlanningItem) => void;
  onDelete: (item: PlanningItem) => Promise<void>;
  onStatusChange: (item: PlanningItem, status: string) => Promise<void>;
  loading: boolean;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <div className="grid gap-3 p-5 lg:hidden">
      {items.map((item) => {
        const status = statusOptionFor(item.status, statussen);
        return (
          <article
            key={item.rowId}
            className={`rounded-xl border-y border-r border-slate-200 bg-white p-4 shadow-sm border-l-4 ${statusAccentClasses[status.kleur]}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-500">{formatDisplayDate(item.datum)}</p>
                <h3 className="truncate text-lg font-semibold text-slate-950">{item.service}</h3>
                <p className="text-sm text-slate-600">{item.medewerker}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(item)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                  aria-label="Dienst aanpassen"
                  title="Dienst aanpassen"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void onDelete(item)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-white text-red-600 shadow-sm transition hover:bg-red-50"
                  aria-label="Dienst verwijderen"
                  title="Dienst verwijderen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-sm">
              <TimeBlock label="Start" value={item.starttijd} />
              <TimeBlock label="Pauze" value={item.pauze} />
              <TimeBlock label="Einde" value={item.eindtijd} />
              <TimeBlock label="Uren" value={item.urenGewerkt || calculateHours(item.starttijd, item.eindtijd, item.pauze)} strong />
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <select
                value={status.naam}
                onChange={(event) => void onStatusChange(item, event.target.value)}
                className={`h-10 rounded-full px-3 text-sm font-bold ring-1 outline-none ${statusClasses[status.kleur]}`}
              >
                {DEFAULT_STATUSES.map((option) => (
                  <option key={option.naam} value={option.naam}>
                    {option.naam}
                  </option>
                ))}
              </select>
              {item.opmerking ? <p className="text-sm text-slate-600">{item.opmerking}</p> : null}
            </div>
          </article>
        );
      })}
      {!loading && items.length === 0 ? <EmptyState title={emptyTitle} description={emptyDescription} /> : null}
    </div>
  );
}

function EmptyState({ title = "Geen diensten gevonden", description = "Pas de filters aan of voeg een dienst toe." }: { title?: string; description?: string }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Check className="h-5 w-5" />
      </div>
      <div>
        <p className="font-semibold text-slate-950">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}
