import { promises as fs } from "fs";
import path from "path";

export const DEFAULT_GOOGLE_SHEET_ID = "1E4LHEm2rWesLba85SF2Bux3tgk5Lfx21R7eLuFuwxMI";
export const DEFAULT_GOOGLE_SERVICE_ACCOUNT_EMAIL =
  "servicepro-planning@servicepro-planning-app-2026.iam.gserviceaccount.com";
export const GOOGLE_SHEETS_NOT_CONNECTED_MESSAGE =
  "Google Sheets nog niet gekoppeld. Open Instellingen om te koppelen.";

export type GoogleSheetsSettings = {
  serviceAccountEmail: string;
  privateKey: string;
  sheetId: string;
};

export type PublicGoogleSheetsSettings = {
  configured: boolean;
  clientEmail: string;
  sheetId: string;
  hasPrivateKey: boolean;
};

const CONFIG_DIR = path.join(process.cwd(), "config");
const SETTINGS_PATH = path.join(CONFIG_DIR, "google-sheets.json");

function normalizePrivateKey(privateKey: string): string {
  return privateKey.trim().replace(/\\n/g, "\n");
}

async function readStoredSettings(): Promise<GoogleSheetsSettings | null> {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<GoogleSheetsSettings> & {
      client_email?: string;
      private_key?: string;
      spreadsheet_id?: string;
    };
    const serviceAccountEmail = (parsed.serviceAccountEmail ?? parsed.client_email ?? "").trim();
    const privateKey = (parsed.privateKey ?? parsed.private_key ?? "").trim();
    const sheetId = (parsed.sheetId ?? parsed.spreadsheet_id ?? DEFAULT_GOOGLE_SHEET_ID).trim();

    if (!serviceAccountEmail || !privateKey) return null;

    return {
      serviceAccountEmail,
      privateKey: normalizePrivateKey(privateKey),
      sheetId
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw error;
  }
}

export async function getGoogleSheetsSettings(): Promise<GoogleSheetsSettings | null> {
  return readStoredSettings();
}

export async function requireGoogleSheetsSettings(): Promise<GoogleSheetsSettings> {
  const settings = await getGoogleSheetsSettings();
  if (!settings) {
    throw new Error(GOOGLE_SHEETS_NOT_CONNECTED_MESSAGE);
  }
  return settings;
}

export async function getPublicGoogleSheetsSettings(): Promise<PublicGoogleSheetsSettings> {
  const settings = await getGoogleSheetsSettings();

  return {
    configured: Boolean(settings),
    clientEmail: settings?.serviceAccountEmail ?? DEFAULT_GOOGLE_SERVICE_ACCOUNT_EMAIL,
    sheetId: settings?.sheetId ?? DEFAULT_GOOGLE_SHEET_ID,
    hasPrivateKey: Boolean(settings?.privateKey)
  };
}

export async function saveGoogleSheetsSettings(input: {
  clientEmail: string;
  privateKey?: string;
  sheetId?: string;
}): Promise<PublicGoogleSheetsSettings> {
  const existing = await getGoogleSheetsSettings();
  const clientEmail = input.clientEmail.trim();
  const privateKey = input.privateKey?.trim() ? normalizePrivateKey(input.privateKey) : existing?.privateKey ?? "";
  const sheetId = input.sheetId?.trim() || DEFAULT_GOOGLE_SHEET_ID;

  if (!clientEmail) {
    throw new Error("Google Service Account Email is verplicht.");
  }

  if (!privateKey) {
    throw new Error("Plak opnieuw de private key uit je JSON-bestand.");
  }

  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(
    SETTINGS_PATH,
    `${JSON.stringify(
      {
        serviceAccountEmail: clientEmail,
        privateKey,
        sheetId
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return {
    configured: true,
    clientEmail,
    sheetId,
    hasPrivateKey: true
  };
}
