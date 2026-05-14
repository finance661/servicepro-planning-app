import { google } from "googleapis";
import { randomUUID } from "crypto";
import { DEFAULT_STATUSES, LogboekItem, PLANNING_HEADERS, PlanningInput, PlanningItem, StatusOption } from "@/lib/types";
import { calculateWorkedHours, formatSheetDate, inputDateToSheetDate, parseDate, parseUniversalDate } from "@/lib/time";
import { GoogleSheetsSettings, requireGoogleSheetsSettings } from "@/lib/googleSheetsSettings";

const PLANNING_SHEET = "Planning ServicePro";
const SERVICES_SHEET = "Services";
const MEDEWERKERS_SHEET = "Medewerker";
const LOGBOOK_SHEET = "Logboek";
const PREFERRED_PLANNING_HINT = "planningserviceprobv19042026";
const GOOGLE_SHEETS_CACHE_TTL_MS = 60_000;
const LOGBOOK_HEADERS = [
  "Datum/tijd mutatie",
  "Actie",
  "Dienst datum",
  "Service",
  "Medewerker",
  "Status oud",
  "Status nieuw",
  "Start oud",
  "Start nieuw",
  "Einde oud",
  "Einde nieuw",
  "Uren oud",
  "Uren nieuw",
  "Opmerking",
  "Gebruiker"
] as const;

type CacheOptions = {
  forceRefresh?: boolean;
};

type CacheEntry<T> = {
  key?: string;
  value?: T;
  expiresAt: number;
  promise?: Promise<T>;
};

type PlanningColumns = {
  id: number;
  datum: number;
  service: number;
  medewerker: number;
  status: number;
  starttijd: number;
  pauze: number;
  eindtijd: number;
  totaalUren: number;
  opmerking: number;
  verwijderd: number;
};

type PlanningSchema = {
  sheetName: string;
  headerRow: number;
  headers: string[];
  columns: PlanningColumns;
  width: number;
};

type PlanningSchemaCandidate = PlanningSchema & {
  score: number;
  detectedCount: number;
  rawPreviewRows: number;
};

export type PlanningDiagnostics = {
  sheetNames: string[];
  candidates: Array<{
    sheetName: string;
    headerRow: number;
    headers: string[];
    detectedCount: number;
    rawPreviewRows: number;
    score: number;
  }>;
  chosenSheetName: string;
  headerRow: number;
  headers: string[];
  rawRowCount: number;
  mappedCount: number;
  firstItems: PlanningItem[];
};

const planningSchemaCache: CacheEntry<PlanningSchema> = { expiresAt: 0 };
const planningCache: CacheEntry<PlanningItem[]> = { expiresAt: 0 };
const servicesCache: CacheEntry<string[]> = { expiresAt: 0 };
const medewerkersCache: CacheEntry<string[]> = { expiresAt: 0 };
let planningDiagnostics: PlanningDiagnostics = {
  sheetNames: [],
  candidates: [],
  chosenSheetName: "",
  headerRow: 0,
  headers: [],
  rawRowCount: 0,
  mappedCount: 0,
  firstItems: []
};

export function getPlanningDiagnostics(): PlanningDiagnostics {
  return planningDiagnostics;
}

async function readThroughCache<T>(
  cacheName: string,
  key: string,
  cache: CacheEntry<T>,
  forceRefresh: boolean | undefined,
  loader: () => Promise<T>
): Promise<T> {
  const now = Date.now();

  if (!forceRefresh && cache.key === key && cache.value !== undefined && cache.expiresAt > now) {
    console.log(`[ServicePro Sheets] cache gebruikt: ${cacheName}`);
    return cache.value;
  }

  if (!forceRefresh && cache.key === key && cache.promise) {
    console.log(`[ServicePro Sheets] wacht op lopende request: ${cacheName}`);
    return cache.promise;
  }

  console.log(`[ServicePro Sheets] Google Sheets request: ${cacheName}`);
  cache.key = key;
  cache.promise = loader()
    .then((value) => {
      cache.value = value;
      cache.expiresAt = Date.now() + GOOGLE_SHEETS_CACHE_TTL_MS;
      return value;
    })
    .finally(() => {
      cache.promise = undefined;
    });

  return cache.promise;
}

function invalidateGoogleSheetsDataCache() {
  planningCache.expiresAt = 0;
  planningCache.value = undefined;
  planningCache.promise = undefined;
  servicesCache.expiresAt = 0;
  servicesCache.value = undefined;
  servicesCache.promise = undefined;
  medewerkersCache.expiresAt = 0;
  medewerkersCache.value = undefined;
  medewerkersCache.promise = undefined;
}

async function getSheetsContext(settingsOverride?: GoogleSheetsSettings) {
  const settings = settingsOverride ?? (await requireGoogleSheetsSettings());
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: settings.serviceAccountEmail,
      private_key: settings.privateKey.replace(/\\n/g, "\n")
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  return {
    sheets: google.sheets({ version: "v4", auth }),
    spreadsheetId: settings.sheetId
  };
}

export function getGoogleSheetsErrorMessage(error: unknown): string {
  const err = error as {
    code?: number;
    status?: number;
    message?: string;
    errors?: Array<{ reason?: string; message?: string }>;
    response?: { status?: number; data?: { error?: string; error_description?: string } };
  };
  const status = err.code ?? err.status ?? err.response?.status;
  const message = `${err.message ?? ""} ${err.response?.data?.error ?? ""} ${err.response?.data?.error_description ?? ""}`;
  const lowerMessage = message.toLowerCase();
  const reason = err.errors?.[0]?.reason?.toLowerCase() ?? "";

  if (lowerMessage.includes("private key") || lowerMessage.includes("pem") || lowerMessage.includes("invalid_grant")) {
    return "Private key ongeldig. Plak opnieuw de private key uit je JSON-bestand.";
  }

  if (status === 404 || reason === "notfound") {
    return "Sheet ID klopt niet, of de Google Sheet is niet gedeeld met het service account.";
  }

  if (status === 403 || reason === "forbidden") {
    return "Geen toegang tot de Sheet. Deel de Google Sheet met het service account emailadres en controleer of de Google Sheets API is ingeschakeld.";
  }

  if (status === 429 || lowerMessage.includes("quota")) {
    return "Google Sheets quota bereikt. Wacht kort en klik daarna op Data vernieuwen.";
  }

  if (status === 400) {
    return "Google Sheets API verzoek ongeldig. Controleer de Sheet ID, service account email en private key.";
  }

  if (lowerMessage.includes("api has not been used") || lowerMessage.includes("disabled")) {
    return "Google Sheets API is niet ingeschakeld voor dit Google Cloud project.";
  }

  return "Google Sheets verbinding mislukt. Controleer of de Sheet is gedeeld met het service account, de private key geldig is, de Google Sheets API is ingeschakeld en de Sheet ID klopt.";
}

function readCell(row: string[], index: number): string {
  return row[index]?.toString().trim() ?? "";
}

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function findHeaderIndex(row: string[], names: string[]): number {
  const normalizedNames = names.map(normalizeHeader);
  return row.findIndex((cell) => normalizedNames.includes(normalizeHeader(cell)));
}

function compactRow(row: unknown[] | undefined): string[] {
  return (row ?? []).map((cell) => cell?.toString() ?? "");
}

function sheetRange(sheetName: string, range: string): string {
  return `'${sheetName.replaceAll("'", "''")}'!${range}`;
}

function columnNumberToLetter(columnNumber: number): string {
  let remaining = columnNumber;
  let letters = "";

  while (remaining > 0) {
    const modulo = (remaining - 1) % 26;
    letters = String.fromCharCode(65 + modulo) + letters;
    remaining = Math.floor((remaining - modulo) / 26);
  }

  return letters;
}

async function getSpreadsheetSheetNames(settingsOverride?: GoogleSheetsSettings): Promise<string[]> {
  const { sheets, spreadsheetId } = await getSheetsContext(settingsOverride);
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title"
  });
  const sheetNames = response.data.sheets?.map((sheet) => sheet.properties?.title).filter(Boolean) as string[] | undefined;
  const names = sheetNames ?? [];
  console.log("[ServicePro Sheets] gevonden tabbladen:", names);
  planningDiagnostics = { ...planningDiagnostics, sheetNames: names };
  return names;
}

async function getPlanningSheetName(settingsOverride?: GoogleSheetsSettings): Promise<string> {
  const sheetNames = await getSpreadsheetSheetNames(settingsOverride);

  if (!sheetNames.length) return PLANNING_SHEET;
  return sheetNames.includes(PLANNING_SHEET) ? PLANNING_SHEET : sheetNames[0];
}

function fallbackPlanningSchema(sheetName: string): PlanningSchema {
  const columns: PlanningColumns = {
    id: 9,
    datum: 0,
    service: 1,
    medewerker: 2,
    status: 3,
    starttijd: 4,
    pauze: 5,
    eindtijd: 6,
    totaalUren: 7,
    opmerking: 8,
    verwijderd: 10
  };

  return {
    sheetName,
    headerRow: 1,
    headers: [...PLANNING_HEADERS, "ID", "Verwijderd"],
    columns,
    width: 11
  };
}

function planningColumnsFromHeader(row: string[]): PlanningColumns {
  return {
    id: findHeaderIndex(row, ["ID", "Dienst ID", "UUID"]),
    datum: findHeaderIndex(row, ["Datum", "Date"]),
    service: findHeaderIndex(row, ["Service", "Services", "Dienst"]),
    medewerker: findHeaderIndex(row, ["Medewerker", "Werknemer", "Employee"]),
    status: findHeaderIndex(row, ["Status"]),
    starttijd: findHeaderIndex(row, ["Starttijd", "Startijd", "Start", "Begintijd"]),
    pauze: findHeaderIndex(row, ["Pauze", "Break"]),
    eindtijd: findHeaderIndex(row, ["Eindtijd", "Einddtijd", "End", "Einde"]),
    totaalUren: findHeaderIndex(row, ["Totaal uren", "Totaal", "Uren gewerkt", "Uren", "Hours"]),
    opmerking: findHeaderIndex(row, ["Opmerking", "Opmerkingen", "Note", "Notes"]),
    verwijderd: findHeaderIndex(row, ["Verwijderd", "Deleted"])
  };
}

function completePlanningColumns(columns: PlanningColumns, sheetName: string, row: string[]): PlanningColumns | null {
  const detectedCount = Object.values(columns).filter((column) => column >= 0).length;
  const looksLikePlanningHeader =
    columns.datum >= 0 &&
    columns.service >= 0 &&
    columns.medewerker >= 0 &&
    columns.starttijd >= 0 &&
    columns.eindtijd >= 0 &&
    detectedCount >= 5;

  if (!looksLikePlanningHeader) return null;

  return {
    id: columns.id,
    datum: columns.datum,
    service: columns.service,
    medewerker: columns.medewerker,
    status: columns.status,
    starttijd: columns.starttijd,
    pauze: columns.pauze,
    eindtijd: columns.eindtijd,
    totaalUren: columns.totaalUren,
    opmerking: columns.opmerking,
    verwijderd: columns.verwijderd
  };
}

function countParseableDates(rows: unknown[][], column: number): number {
  if (column < 0) return 0;
  return rows.reduce((count, row) => (parseUniversalDate(row[column]) ? count + 1 : count), 0);
}

function chooseBestDateColumn(columns: PlanningColumns, previewRows: unknown[][]): PlanningColumns {
  const currentDateCount = countParseableDates(previewRows, columns.datum);
  const firstColumnDateCount = countParseableDates(previewRows, 0);

  if (firstColumnDateCount > currentDateCount) {
    console.log("[ServicePro Sheets] datumkolom aangepast naar kolom A", {
      gevondenDatumKolom: columns.datum,
      gevondenDatumAantal: currentDateCount,
      kolomAAantal: firstColumnDateCount
    });
    return { ...columns, datum: 0 };
  }

  return columns;
}

async function getPlanningSchema(settingsOverride?: GoogleSheetsSettings, options: CacheOptions = {}): Promise<PlanningSchema> {
  const settings = settingsOverride ?? (await requireGoogleSheetsSettings());
  return readThroughCache("planning schema", settings.sheetId, planningSchemaCache, options.forceRefresh, () =>
    loadPlanningSchema(settings)
  );
}

async function loadPlanningSchema(settingsOverride?: GoogleSheetsSettings): Promise<PlanningSchema> {
  const { sheets, spreadsheetId } = await getSheetsContext(settingsOverride);
  const sheetNames = await getSpreadsheetSheetNames(settingsOverride);
  const candidates: PlanningSchemaCandidate[] = [];

  for (const sheetName of sheetNames) {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: sheetRange(sheetName, "A1:AZ40"),
      valueRenderOption: "FORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING"
    });
    const rows = response.data.values ?? [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = compactRow(rows[index]);
      const columns = planningColumnsFromHeader(row);
      const completedColumns = completePlanningColumns(columns, sheetName, row);
      if (!completedColumns) continue;
      const previewRows = rows.slice(index + 1);
      const enhancedColumns = chooseBestDateColumn(completedColumns, previewRows);

      const detectedCount = Object.values(columns).filter((column) => column >= 0).length;
      const normalizedSheetName = normalizeHeader(sheetName);
      const rawPreviewRows = previewRows.filter((entry) => compactRow(entry).some(Boolean)).length;
      const score =
        detectedCount * 10 +
        rawPreviewRows +
        (normalizedSheetName.includes("planning") ? 35 : 0) +
        (normalizedSheetName.includes(PREFERRED_PLANNING_HINT) ? 100 : 0) +
        (normalizedSheetName.includes("servicepro") ? 15 : 0);

      candidates.push({
        sheetName,
        headerRow: index + 1,
        headers: row,
        columns: enhancedColumns,
        width: Math.max(...Object.values(enhancedColumns)) + 1,
        score,
        detectedCount,
        rawPreviewRows
      });
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score || b.detectedCount - a.detectedCount || b.rawPreviewRows - a.rawPreviewRows);
    const { score, detectedCount, rawPreviewRows, ...schema } = candidates[0];
    planningDiagnostics = {
      ...planningDiagnostics,
      candidates: candidates.map((candidate) => ({
        sheetName: candidate.sheetName,
        headerRow: candidate.headerRow,
        headers: candidate.headers,
        detectedCount: candidate.detectedCount,
        rawPreviewRows: candidate.rawPreviewRows,
        score: candidate.score
      })),
      chosenSheetName: schema.sheetName,
      headerRow: schema.headerRow,
      headers: schema.headers
    };
    console.log("[ServicePro Sheets] gekozen planningtabblad:", schema.sheetName);
    console.log("[ServicePro Sheets] gevonden header-rij:", schema.headerRow);
    console.log("[ServicePro Sheets] gevonden headers:", schema.headers);
    console.log("[ServicePro Sheets] kolommapping:", schema.columns);
    return schema;
  }

  console.log("[ServicePro Sheets] geen planningheader gevonden, fallback gebruikt:", sheetNames[0] ?? PLANNING_SHEET);
  planningDiagnostics = {
    ...planningDiagnostics,
    candidates: [],
    chosenSheetName: sheetNames[0] ?? PLANNING_SHEET,
    headerRow: 1,
    headers: [...PLANNING_HEADERS]
  };
  return fallbackPlanningSchema(sheetNames[0] ?? PLANNING_SHEET);
}

function planningRowToItem(row: string[], rowIndex: number, columns: PlanningColumns): PlanningItem {
  const rawDate = readCell(row, columns.datum);
  const parsedDate = parseDate(rawDate);
  const starttijd = readCell(row, columns.starttijd);
  const pauze = readCell(row, columns.pauze);
  const eindtijd = readCell(row, columns.eindtijd);
  const storedTotal = readCell(row, columns.totaalUren);

  if (rowIndex < 15 || readCell(row, columns.service).toLowerCase().includes("fc utrecht")) {
    console.log("[ServicePro Sheets] datum debug", {
      rowId: rowIndex,
      rawDate,
      parsedDate,
      service: readCell(row, columns.service)
    });
  }

  return {
    rowId: rowIndex,
    id: readCell(row, columns.id) || String(rowIndex),
    datum: formatSheetDate(rawDate),
    service: readCell(row, columns.service),
    medewerker: readCell(row, columns.medewerker),
    status: readCell(row, columns.status) || "Open",
    starttijd,
    pauze,
    eindtijd,
    urenGewerkt: storedTotal || calculateWorkedHours(starttijd, eindtijd, pauze),
    opmerking: readCell(row, columns.opmerking),
    verwijderd: readCell(row, columns.verwijderd)
  };
}

function applyPlanningInputToRow(row: string[], input: PlanningInput, columns: PlanningColumns, width: number): string[] {
  const values = [...row];
  while (values.length < width) values.push("");

  const starttijd = input.starttijd?.trim() ?? "";
  const eindtijd = input.eindtijd?.trim() ?? "";
  const pauze = input.pauze?.trim() ?? "";

  if (columns.id >= 0) values[columns.id] = input.id?.trim() ?? values[columns.id] ?? "";
  if (columns.datum >= 0) values[columns.datum] = inputDateToSheetDate(input.datum ?? "");
  if (columns.service >= 0) values[columns.service] = input.service?.trim() ?? "";
  if (columns.medewerker >= 0) values[columns.medewerker] = input.medewerker?.trim() ?? "";
  if (columns.status >= 0) values[columns.status] = input.status?.trim() ?? "";
  if (columns.starttijd >= 0) values[columns.starttijd] = starttijd;
  if (columns.pauze >= 0) values[columns.pauze] = pauze;
  if (columns.eindtijd >= 0) values[columns.eindtijd] = eindtijd;
  if (columns.totaalUren >= 0) values[columns.totaalUren] = calculateWorkedHours(starttijd, eindtijd, pauze);
  if (columns.opmerking >= 0) values[columns.opmerking] = input.opmerking?.trim() ?? "";
  if (columns.verwijderd >= 0) values[columns.verwijderd] = input.verwijderd?.trim() ?? values[columns.verwijderd] ?? "";

  return values;
}

function hasPlanningContent(row: string[], columns: PlanningColumns): boolean {
  return [
    columns.datum,
    columns.service,
    columns.medewerker,
    columns.status,
    columns.starttijd,
    columns.eindtijd,
    columns.opmerking
  ].some((column) => column >= 0 && readCell(row, column));
}

function planningCellPayload(input: PlanningInput, columns: PlanningColumns): Array<{ column: number; value: string }> {
  const starttijd = input.starttijd?.trim() ?? "";
  const eindtijd = input.eindtijd?.trim() ?? "";
  const pauze = input.pauze?.trim() ?? "";
  const writes: Array<{ column: number; value: string }> = [];

  function add(column: number, value: string | undefined) {
    if (column >= 0) writes.push({ column, value: value ?? "" });
  }

  add(columns.id, input.id?.trim());
  add(columns.datum, inputDateToSheetDate(input.datum ?? ""));
  add(columns.service, input.service?.trim());
  add(columns.medewerker, input.medewerker?.trim());
  add(columns.status, input.status?.trim());
  add(columns.starttijd, starttijd);
  add(columns.pauze, pauze);
  add(columns.eindtijd, eindtijd);
  add(columns.totaalUren, calculateWorkedHours(starttijd, eindtijd, pauze));
  add(columns.opmerking, input.opmerking?.trim());
  add(columns.verwijderd, input.verwijderd?.trim() ?? "");

  return writes;
}

async function writePlanningCells(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetName: string,
  rowId: number,
  payload: Array<{ column: number; value: string }>
) {
  const data = payload.map((entry) => ({
    range: sheetRange(sheetName, `${columnNumberToLetter(entry.column + 1)}${rowId}`),
    values: [[entry.value]]
  }));

  return sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      includeValuesInResponse: true,
      data
    }
  });
}

async function readPlanningRow(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  schema: PlanningSchema,
  rowId: number
): Promise<string[]> {
  const lastColumn = columnNumberToLetter(Math.max(schema.width, 1));
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetRange(schema.sheetName, `A${rowId}:${lastColumn}${rowId}`),
    valueRenderOption: "FORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING"
  });

  return compactRow(response.data.values?.[0]);
}

async function resolvePlanningRowIdById(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  schema: PlanningSchema,
  fallbackRowId: number,
  id?: string
): Promise<number> {
  if (!id || schema.columns.id < 0) return fallbackRowId;

  const idColumn = columnNumberToLetter(schema.columns.id + 1);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetRange(schema.sheetName, `${idColumn}${schema.headerRow + 1}:${idColumn}`),
    valueRenderOption: "FORMATTED_VALUE"
  });
  const rows = response.data.values ?? [];
  const matchIndex = rows.findIndex((row) => row[0]?.toString().trim() === id);

  return matchIndex >= 0 ? schema.headerRow + 1 + matchIndex : fallbackRowId;
}

async function ensurePlanningSchema(settingsOverride?: GoogleSheetsSettings, options: CacheOptions = {}): Promise<PlanningSchema> {
  const { sheets, spreadsheetId } = await getSheetsContext(settingsOverride);
  let schema = await getPlanningSchema(settingsOverride, options);
  const isFallback =
    schema.headerRow === 1 && PLANNING_HEADERS.every((header, index) => schema.headers[index] === header);

  if (!isFallback) {
    return ensurePlanningSystemColumns(sheets, spreadsheetId, schema);
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetRange(schema.sheetName, "A1:I1")
  });
  const currentHeaders = response.data.values?.[0] ?? [];
  const hasHeaders = PLANNING_HEADERS.every((header, index) => currentHeaders[index] === header);

  if (isFallback && !hasHeaders) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: sheetRange(schema.sheetName, "A1:K1"),
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[...PLANNING_HEADERS, "ID", "Verwijderd"]]
      }
    });
    planningSchemaCache.expiresAt = 0;
    schema = fallbackPlanningSchema(schema.sheetName);
  }

  return ensurePlanningSystemColumns(sheets, spreadsheetId, schema);
}

async function ensurePlanningSystemColumns(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  schema: PlanningSchema
): Promise<PlanningSchema> {
  let nextColumn = Math.max(schema.width, schema.headers.length, ...Object.values(schema.columns).filter((column) => column >= 0).map((column) => column + 1));
  const updates: Array<{ column: number; header: string; key: "id" | "verwijderd" }> = [];

  if (schema.columns.id < 0) {
    updates.push({ column: nextColumn, header: "ID", key: "id" });
    nextColumn += 1;
  }

  if (schema.columns.verwijderd < 0) {
    updates.push({ column: nextColumn, header: "Verwijderd", key: "verwijderd" });
    nextColumn += 1;
  }

  if (!updates.length) {
    return schema;
  }

  const headers = [...schema.headers];
  const columns = { ...schema.columns };

  for (const update of updates) {
    headers[update.column] = update.header;
    columns[update.key] = update.column;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: sheetRange(schema.sheetName, `${columnNumberToLetter(update.column + 1)}${schema.headerRow}`),
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[update.header]]
      }
    });
  }

  planningSchemaCache.expiresAt = 0;
  return {
    ...schema,
    headers,
    columns,
    width: Math.max(nextColumn, schema.width)
  };
}

export async function getPlanning(options: CacheOptions = {}): Promise<PlanningItem[]> {
  const settings = await requireGoogleSheetsSettings();
  return readThroughCache("planning data", settings.sheetId, planningCache, options.forceRefresh, async () => {
    const schema = await ensurePlanningSchema(settings, options);

    const { sheets, spreadsheetId } = await getSheetsContext(settings);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: sheetRange(schema.sheetName, `A${schema.headerRow + 1}:AZ`),
      valueRenderOption: "FORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING"
    });
    const rawRows = response.data.values ?? [];
    planningDiagnostics = { ...planningDiagnostics, rawRowCount: rawRows.length };
    console.log(`[ServicePro Sheets] planning rijen opgehaald: ${rawRows.length}`);

    const items = rawRows.map((row, index) =>
      planningRowToItem(compactRow(row), index + schema.headerRow + 1, schema.columns)
    );

    let previousDate = "";
    for (const item of items) {
      if (item.datum) {
        previousDate = item.datum;
      } else if (previousDate && (item.service || item.medewerker || item.status || item.starttijd || item.eindtijd)) {
        item.datum = previousDate;
      }
    }

    let nextDate = "";
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      if (item.datum) {
        nextDate = item.datum;
      } else if (nextDate && (item.service || item.medewerker || item.status || item.starttijd || item.eindtijd)) {
        item.datum = nextDate;
      }
    }

    const mappedItems = items.filter(
      (item) =>
        (item.datum || item.service || item.medewerker || item.status || item.starttijd || item.eindtijd) &&
        normalizeHeader(item.verwijderd ?? "") !== "ja"
    );
    planningDiagnostics = {
      ...planningDiagnostics,
      mappedCount: mappedItems.length,
      firstItems: mappedItems.slice(0, 5)
    };
    console.log("[ServicePro Sheets] eerste 5 gemapte diensten:", mappedItems.slice(0, 5));
    console.log(`[ServicePro Sheets] planning diensten gemapt: ${mappedItems.length}`);
    return mappedItems;
  });
}

function logboekTimestamp(): string {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Europe/Amsterdam"
  }).format(new Date());
}

function logboekRow(action: LogboekItem["actie"], next: PlanningItem | PlanningInput, previous?: PlanningItem): string[] {
  const nextHours = next.urenGewerkt || calculateWorkedHours(next.starttijd, next.eindtijd, next.pauze);
  const previousHours = previous?.urenGewerkt || (previous ? calculateWorkedHours(previous.starttijd, previous.eindtijd, previous.pauze) : "");

  return [
    logboekTimestamp(),
    action,
    next.datum,
    next.service,
    next.medewerker,
    previous?.status ?? "",
    next.status,
    previous?.starttijd ?? "",
    next.starttijd,
    previous?.eindtijd ?? "",
    next.eindtijd,
    previousHours,
    nextHours,
    next.opmerking,
    "ServicePro App"
  ];
}

async function ensureLogboekSheet(sheets: ReturnType<typeof google.sheets>, spreadsheetId: string): Promise<void> {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title"
  });
  const sheetNames = metadata.data.sheets?.map((sheet) => sheet.properties?.title).filter(Boolean) ?? [];

  if (!sheetNames.includes(LOGBOOK_SHEET)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: LOGBOOK_SHEET } } }]
      }
    });
  }

  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetRange(LOGBOOK_SHEET, `A1:${columnNumberToLetter(LOGBOOK_HEADERS.length)}1`)
  });
  const currentHeaders = headerResponse.data.values?.[0] ?? [];
  const hasHeaders = LOGBOOK_HEADERS.every((header, index) => currentHeaders[index] === header);

  if (!hasHeaders) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: sheetRange(LOGBOOK_SHEET, `A1:${columnNumberToLetter(LOGBOOK_HEADERS.length)}1`),
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[...LOGBOOK_HEADERS]]
      }
    });
  }
}

async function appendLogboek(action: LogboekItem["actie"], next: PlanningItem | PlanningInput, previous?: PlanningItem): Promise<void> {
  const settings = await requireGoogleSheetsSettings();
  const { sheets, spreadsheetId } = await getSheetsContext(settings);
  await ensureLogboekSheet(sheets, spreadsheetId);
  const row = logboekRow(action, next, previous);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: sheetRange(LOGBOOK_SHEET, "A:O"),
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [row]
    }
  });
}

export async function addPlanningItem(input: PlanningInput): Promise<PlanningItem> {
  const settings = await requireGoogleSheetsSettings();
  const schema = await ensurePlanningSchema(settings, { forceRefresh: true });

  const { sheets, spreadsheetId } = await getSheetsContext(settings);
  const inputWithId: PlanningInput = { ...input, id: input.id || randomUUID(), verwijderd: "" };
  const existingRowsResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetRange(schema.sheetName, `A${schema.headerRow + 1}:${columnNumberToLetter(Math.max(schema.width, 1))}`),
    valueRenderOption: "FORMATTED_VALUE"
  });
  const existingRows = existingRowsResponse.data.values ?? [];
  const lastDataIndex = existingRows.reduce((lastIndex, row, index) => {
    return hasPlanningContent(compactRow(row), schema.columns) ? index : lastIndex;
  }, -1);
  const anticipatedAppendRow = schema.headerRow + 1 + lastDataIndex + 1;
  const payload = planningCellPayload(inputWithId, schema.columns);

  console.log("[ServicePro Sheets] spreadsheetId:", spreadsheetId);
  console.log("[ServicePro Sheets] schrijven naar planningtabblad:", schema.sheetName);
  console.log("[ServicePro Sheets] header-rij voor schrijven:", schema.headerRow);
  console.log("[ServicePro Sheets] columnMap:", schema.columns);
  console.log("[ServicePro Sheets] verwachte append-rij:", anticipatedAppendRow);
  console.log("[ServicePro Sheets] update ranges:", payload.map((entry) => `${columnNumberToLetter(entry.column + 1)}${anticipatedAppendRow}`));
  console.log("[ServicePro Sheets] payload naar Google Sheets:", payload);

  const response = await writePlanningCells(sheets, spreadsheetId, schema.sheetName, anticipatedAppendRow, payload);

  const rowId = anticipatedAppendRow;
  console.log("[ServicePro Sheets] gekozen append-rij:", rowId);
  console.log("[ServicePro Sheets] Google Sheets API response:", response.data);
  invalidateGoogleSheetsDataCache();
  console.log("[ServicePro Sheets] cache invalidated:", true);

  const created = planningRowToItem(await readPlanningRow(sheets, spreadsheetId, schema, rowId), rowId, schema.columns);
  await appendLogboek("Toegevoegd", created);
  return created;
}

export async function updatePlanningItem(rowId: number, input: PlanningInput): Promise<PlanningItem> {
  if (!Number.isInteger(rowId) || rowId < 2) {
    throw new Error("Ongeldige rij voor planning update.");
  }

  const settings = await requireGoogleSheetsSettings();
  const schema = await ensurePlanningSchema(settings);

  const { sheets, spreadsheetId } = await getSheetsContext(settings);
  const targetRowId = await resolvePlanningRowIdById(sheets, spreadsheetId, schema, rowId, input.id);
  const previous = planningRowToItem(await readPlanningRow(sheets, spreadsheetId, schema, targetRowId), targetRowId, schema.columns);
  const inputWithId: PlanningInput = { ...input, id: input.id || previous.id || randomUUID(), verwijderd: previous.verwijderd ?? "" };
  const payload = planningCellPayload(inputWithId, schema.columns);

  console.log("[ServicePro Sheets] spreadsheetId:", spreadsheetId);
  console.log("[ServicePro Sheets] wijzigen planningtabblad:", schema.sheetName);
  console.log("[ServicePro Sheets] headerRowIndex:", schema.headerRow);
  console.log("[ServicePro Sheets] columnMap:", schema.columns);
  console.log("[ServicePro Sheets] update rowId:", targetRowId);
  console.log("[ServicePro Sheets] update ranges:", payload.map((entry) => `${columnNumberToLetter(entry.column + 1)}${targetRowId}`));
  console.log("[ServicePro Sheets] payload naar Google Sheets:", payload);

  const response = await writePlanningCells(sheets, spreadsheetId, schema.sheetName, targetRowId, payload);
  console.log("[ServicePro Sheets] Google Sheets API response:", response.data);
  invalidateGoogleSheetsDataCache();
  console.log("[ServicePro Sheets] cache invalidated:", true);

  const updated = planningRowToItem(await readPlanningRow(sheets, spreadsheetId, schema, targetRowId), targetRowId, schema.columns);
  await appendLogboek("Gewijzigd", updated, previous);
  return updated;
}

export async function deletePlanningItem(rowId: number): Promise<PlanningItem> {
  if (!Number.isInteger(rowId) || rowId < 2) {
    throw new Error("Ongeldige rij voor planning verwijderen.");
  }

  const settings = await requireGoogleSheetsSettings();
  const schema = await ensurePlanningSchema(settings);
  const { sheets, spreadsheetId } = await getSheetsContext(settings);
  const previous = planningRowToItem(await readPlanningRow(sheets, spreadsheetId, schema, rowId), rowId, schema.columns);
  const payload = planningCellPayload(
    {
      ...previous,
      id: previous.id || String(rowId),
      verwijderd: "Ja"
    },
    schema.columns
  ).filter((entry) => entry.column === schema.columns.id || entry.column === schema.columns.verwijderd);

  console.log("[ServicePro Sheets] spreadsheetId:", spreadsheetId);
  console.log("[ServicePro Sheets] verwijderen planningtabblad:", schema.sheetName);
  console.log("[ServicePro Sheets] headerRowIndex:", schema.headerRow);
  console.log("[ServicePro Sheets] columnMap:", schema.columns);
  console.log("[ServicePro Sheets] delete rowId:", rowId);
  console.log("[ServicePro Sheets] update ranges:", payload.map((entry) => `${columnNumberToLetter(entry.column + 1)}${rowId}`));
  console.log("[ServicePro Sheets] payload naar Google Sheets:", payload);

  const response = await writePlanningCells(sheets, spreadsheetId, schema.sheetName, rowId, payload);
  console.log("[ServicePro Sheets] Google Sheets API response:", response.data);

  invalidateGoogleSheetsDataCache();
  console.log("[ServicePro Sheets] cache invalidated:", true);
  const deleted = planningRowToItem(await readPlanningRow(sheets, spreadsheetId, schema, rowId), rowId, schema.columns);
  await appendLogboek("Verwijderd", deleted, previous);
  return deleted;
}

const MEDEWERKER_HEADER_ALIASES = ["Medewerker", "Medewerkers", "Werknemer", "Employee"];

function cleanLookupValues(values: string[], headerNames: string[]): string[] {
  const headerSet = new Set(headerNames.map(normalizeHeader));
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    const normalized = normalizeHeader(trimmed);

    if (!trimmed || headerSet.has(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    cleaned.push(trimmed);
  }

  return cleaned.sort((a, b) => a.localeCompare(b, "nl", { sensitivity: "base" }));
}

function logServiceLookupDiagnostics(services: string[], rawCount: number, source: string) {
  const hasRegiecentraleJDW = services.includes("Regiecentrale JDW");
  console.log("[ServicePro Sheets] services bron:", source);
  console.log("[ServicePro Sheets] aantal services gevonden:", services.length);
  console.log("[ServicePro Sheets] aantal ruwe services gevonden:", rawCount);
  console.log("[ServicePro Sheets] laatste 20 services:", services.slice(-20));
  console.log("[ServicePro Sheets] bevat Regiecentrale JDW:", hasRegiecentraleJDW);
  if (!hasRegiecentraleJDW) {
    console.log("[ServicePro Sheets] Regiecentrale JDW ontbreekt in opgehaalde Services-data");
  }
}

async function getServiceValues(options: CacheOptions = {}): Promise<string[]> {
  const settings = await requireGoogleSheetsSettings();
  const { sheets, spreadsheetId } = await getSheetsContext(settings);
  const columnBRange = sheetRange(SERVICES_SHEET, "B:B");
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: columnBRange,
    valueRenderOption: "FORMATTED_VALUE"
  });

  if (options.forceRefresh) {
    servicesCache.expiresAt = 0;
    servicesCache.value = undefined;
    servicesCache.promise = undefined;
  }

  const rawValues = (response.data.values ?? []).map((row) => row[0]?.toString().trim() ?? "");
  const services = cleanLookupValues(rawValues, ["Services"]);

  console.log("[ServicePro Sheets] Services gebruikte range:", columnBRange);
  logServiceLookupDiagnostics(services, rawValues.filter(Boolean).length, "Services!B:B");
  return services;
}

async function getFirstColumnValues(sheetName: string, options: CacheOptions = {}): Promise<string[]> {
  const settings = await requireGoogleSheetsSettings();
  const cache = sheetName === SERVICES_SHEET ? servicesCache : medewerkersCache;

  return readThroughCache(sheetName, `${settings.sheetId}:${sheetName}`, cache, options.forceRefresh, async () => {
    const { sheets, spreadsheetId } = await getSheetsContext(settings);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: sheetRange(sheetName, "A1:Z")
    });

    const rows = response.data.values ?? [];
    console.log(`[ServicePro Sheets] ${sheetName} rijen opgehaald: ${rows.length}`);
    const columnCount = Math.max(0, ...rows.map((row) => row.length));
    let bestColumn = 0;
    let bestCount = 0;

    for (let column = 0; column < columnCount; column += 1) {
      const count = rows
        .slice(1)
        .map((row) => row[column]?.toString().trim() ?? "")
        .filter(Boolean).length;

      if (count > bestCount) {
        bestColumn = column;
        bestCount = count;
      }
    }

    return cleanLookupValues(
      rows.map((row) => row[bestColumn]?.toString().trim() ?? ""),
      MEDEWERKER_HEADER_ALIASES
    );
  });
}

export async function getServices(options: CacheOptions = {}): Promise<string[]> {
  return getServiceValues(options);
}

export async function getMedewerkers(options: CacheOptions = {}): Promise<string[]> {
  return getFirstColumnValues(MEDEWERKERS_SHEET, options);
}

export async function getLogboek(limit = 100): Promise<LogboekItem[]> {
  const settings = await requireGoogleSheetsSettings();
  const { sheets, spreadsheetId } = await getSheetsContext(settings);
  await ensureLogboekSheet(sheets, spreadsheetId);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetRange(LOGBOOK_SHEET, "A2:O"),
    valueRenderOption: "FORMATTED_VALUE"
  });

  const rows = response.data.values ?? [];
  return rows
    .map((row) => {
      const cells = compactRow(row);
      return {
        mutatieDatum: cells[0] ?? "",
        actie: cells[1] ?? "",
        dienstDatum: cells[2] ?? "",
        service: cells[3] ?? "",
        medewerker: cells[4] ?? "",
        statusOud: cells[5] ?? "",
        statusNieuw: cells[6] ?? "",
        startOud: cells[7] ?? "",
        startNieuw: cells[8] ?? "",
        eindeOud: cells[9] ?? "",
        eindeNieuw: cells[10] ?? "",
        urenOud: cells[11] ?? "",
        urenNieuw: cells[12] ?? "",
        opmerking: cells[13] ?? "",
        gebruiker: cells[14] ?? ""
      };
    })
    .filter((item) => item.mutatieDatum || item.actie || item.service)
    .reverse()
    .slice(0, limit);
}

function statusColor(status: string): StatusOption["kleur"] {
  return DEFAULT_STATUSES.find((option) => option.naam.toLowerCase() === status.toLowerCase())?.kleur ?? "slate";
}

export async function getStatussen(): Promise<StatusOption[]> {
  return DEFAULT_STATUSES;
}

export async function testGoogleSheetsConnection(settingsOverride?: GoogleSheetsSettings): Promise<void> {
  const { sheets, spreadsheetId } = await getSheetsContext(settingsOverride);

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "properties.title,sheets.properties.title"
  });

  const sheetNames = response.data.sheets?.map((sheet) => sheet.properties?.title).filter(Boolean) ?? [];
  console.log("[ServicePro Sheets] test verbinding tabbladen:", sheetNames);

  if (!sheetNames.length) {
    throw new Error("Sheet ID klopt niet, of er zijn geen tabbladen leesbaar.");
  }
}
