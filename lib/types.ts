export type PlanningStatus = "Open" | "Gesloten";

export type PlanningItem = {
  rowId: number;
  id?: string;
  datum: string;
  service: string;
  medewerker: string;
  status: string;
  starttijd: string;
  pauze: string;
  eindtijd: string;
  urenGewerkt: string;
  opmerking: string;
  verwijderd?: string;
};

export type PlanningInput = Omit<PlanningItem, "rowId" | "urenGewerkt"> & {
  urenGewerkt?: string;
};

export type StatusOption = {
  naam: string;
  kleur: "orange" | "blue" | "purple" | "green" | "red" | "slate";
};

export type PublicGoogleSheetsSettings = {
  configured: boolean;
  clientEmail: string;
  sheetId: string;
  hasPrivateKey: boolean;
};

export type LogboekItem = {
  mutatieDatum: string;
  actie: "Toegevoegd" | "Gewijzigd" | "Verwijderd" | string;
  dienstDatum: string;
  service: string;
  medewerker: string;
  statusOud: string;
  statusNieuw: string;
  startOud: string;
  startNieuw: string;
  eindeOud: string;
  eindeNieuw: string;
  urenOud: string;
  urenNieuw: string;
  opmerking: string;
  gebruiker: string;
};

export const PLANNING_HEADERS = [
  "Datum",
  "Service",
  "Medewerker",
  "Status",
  "Starttijd",
  "Pauze",
  "Eindtijd",
  "Totaal uren",
  "Opmerking"
] as const;

export const DEFAULT_STATUSES: StatusOption[] = [
  { naam: "Open", kleur: "orange" },
  { naam: "Gesloten", kleur: "green" }
];
