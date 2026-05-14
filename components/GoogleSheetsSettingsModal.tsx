"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Save, ShieldCheck, TestTube2, X } from "lucide-react";
import type { PublicGoogleSheetsSettings } from "@/lib/types";

type SettingsForm = {
  clientEmail: string;
  privateKey: string;
  sheetId: string;
};

const DEFAULT_SHEET_ID = "1E4LHEm2rWesLba85SF2Bux3tgk5Lfx21R7eLuFuwxMI";
const DEFAULT_SERVICE_ACCOUNT_EMAIL = "servicepro-planning@servicepro-planning-app-2026.iam.gserviceaccount.com";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Er ging iets mis.");
  }
  return data as T;
}

export function GoogleSheetsSettingsModal({
  open,
  settings,
  onClose,
  onSaved
}: {
  open: boolean;
  settings: PublicGoogleSheetsSettings | null;
  onClose: () => void;
  onSaved: (settings: PublicGoogleSheetsSettings, message: string) => void;
}) {
  const [form, setForm] = useState<SettingsForm>({
    clientEmail: "",
    privateKey: "",
    sheetId: DEFAULT_SHEET_ID
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setForm({
      clientEmail: settings?.clientEmail || DEFAULT_SERVICE_ACCOUNT_EMAIL,
      privateKey: "",
      sheetId: settings?.sheetId || DEFAULT_SHEET_ID
    });
    setMessage("");
    setError("");
  }, [open, settings]);

  if (!open) return null;

  function payload() {
    return {
      clientEmail: form.clientEmail,
      privateKey: form.privateKey,
      sheetId: form.sheetId
    };
  }

  async function testConnection() {
    setTesting(true);
    setError("");
    setMessage("");

    try {
      if (!form.clientEmail.trim() || !form.sheetId.trim()) {
        throw new Error("Vul de Google Service Account Email en Google Sheet ID in.");
      }
      if (!form.privateKey.trim() && !settings?.hasPrivateKey) {
        throw new Error("Plak opnieuw de private key uit je JSON-bestand.");
      }

      const result = await requestJson<{ ok: boolean; message: string }>("/api/settings/test-google-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload())
      });
      setMessage(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Test verbinding is niet gelukt.");
    } finally {
      setTesting(false);
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (!form.clientEmail.trim() || !form.sheetId.trim()) {
        throw new Error("Vul de Google Service Account Email en Google Sheet ID in.");
      }
      if (!form.privateKey.trim() && !settings?.hasPrivateKey) {
        throw new Error("Plak opnieuw de private key uit je JSON-bestand.");
      }

      const testResult = await requestJson<{ ok: boolean; message: string }>("/api/settings/test-google-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload())
      });

      const saved = await requestJson<PublicGoogleSheetsSettings>("/api/settings/google-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload())
      });

      setForm((current) => ({ ...current, privateKey: "" }));
      setMessage(testResult.message);
      onSaved(saved, testResult.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Opslaan is niet gelukt.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="servicepro-modal-backdrop">
      <div className="servicepro-modal">
        <div className="servicepro-modal-header flex items-start justify-between gap-4">
          <div>
            <p className="servicepro-brand">Instellingen</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">Google Sheets koppeling</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="servicepro-icon-button flex h-10 w-10 shrink-0 items-center justify-center text-slate-600"
            aria-label="Instellingen sluiten"
            title="Sluiten"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="grid gap-4 px-5 py-5" onSubmit={saveSettings}>
          {settings?.configured ? (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <span>Er is al een Google Sheets koppeling opgeslagen. Private key: •••••••• opgeslagen.</span>
            </div>
          ) : null}

          {message ? (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{message}</span>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {error}
            </div>
          ) : null}

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Google Service Account Email
            <input
              required
              type="email"
              value={form.clientEmail}
              onChange={(event) => setForm((current) => ({ ...current, clientEmail: event.target.value }))}
              className="input"
              placeholder={DEFAULT_SERVICE_ACCOUNT_EMAIL}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Google Private Key
            <input
              required={!settings?.hasPrivateKey}
              type="password"
              value={form.privateKey}
              onChange={(event) => setForm((current) => ({ ...current, privateKey: event.target.value }))}
              className="input"
              placeholder={settings?.hasPrivateKey ? "•••••••• opgeslagen" : "-----BEGIN PRIVATE KEY-----"}
              autoComplete="off"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Google Sheet ID
            <input
              required
              type="text"
              value={form.sheetId}
              onChange={(event) => setForm((current) => ({ ...current, sheetId: event.target.value }))}
              className="input"
            />
          </label>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => void testConnection()}
              disabled={testing || saving}
              className="servicepro-secondary-button flex h-11 items-center justify-center gap-2 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}
              Test verbinding
            </button>
            <button
              type="submit"
              disabled={saving || testing}
              className="servicepro-primary-button flex h-11 items-center justify-center gap-2 px-4 text-sm disabled:cursor-not-allowed disabled:bg-teal-300"
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
