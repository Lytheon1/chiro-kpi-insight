import * as XLSX from "xlsx";
import { normalizeText, normalizeDate, normalizeTime } from "../utils/normalize";
import type { CmrRow, ParsedCMR } from "../../types/reports";

/**
 * Parses ChiroTouch "Canceled/Missed/Rescheduled Appointments" export.
 * Now captures patientName from section header rows above event rows.
 */
export function parseCanceledMissedRescheduled(file: File): Promise<ParsedCMR> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        const titleCell = normalizeText(rows[0]?.[0]);
        if (!titleCell.includes("canceled/missed") && !titleCell.includes("cancelled/missed")) {
          throw new Error(
            'This does not appear to be a "Canceled/Missed/Rescheduled Appointments" file. ' +
            `Found title: "${rows[0]?.[0]}"`
          );
        }

        const rawRows: CmrRow[] = [];
        // Track current patient name from section headers
        let currentPatientName: string | undefined = undefined;

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const col0 = row[0];
          const col0Str = normalizeText(col0);
          const col1Str = normalizeText(row[1]);
          const col2Str = normalizeText(row[2]);
          const col6Str = normalizeText(row[6]);

          if (row.every((c) => c === "" || c === null || c === undefined)) continue;
          if (col0Str.includes("canceled/missed") || col0Str.includes("cancelled/missed")) continue;
          if (col1Str === "through") continue;
          if (typeof col0 === "string" && /^\d{1,2}:\d{2}\s*(am|pm)$/i.test(col0Str)) continue;
          if (col0Str === "date" && col6Str === "status") continue;
          if (col0Str.startsWith("phone numbers")) continue;

          // Patient name rows: col0 is non-numeric text, col2 is empty, col6 is empty
          if (typeof col0 === "string" && col0Str && !col6Str && !col2Str) {
            // This is a patient name section header — update state
            const name = String(col0).trim();
            if (name && !col0Str.startsWith("phone numbers")) {
              currentPatientName = name;
            }
            continue;
          }

          // Valid event rows: col0 is a number (Excel date serial) AND col2 and col6 have content
          if (typeof col0 === "number" && col0 > 1000 && col2Str && col6Str) {
            const date = normalizeDate(col0);
            if (!date) continue;

            rawRows.push({
              source: "cmr",
              date,
              time: normalizeTime(row[1]) ?? undefined,
              apptTypeRaw: String(row[2] || "").trim(),
              provider: String(row[4] || "").trim(),
              location: String(row[5] || "").trim(),
              statusRaw: String(row[6] || "").trim(),
              reasonRaw: String(row[7] || "").trim() || undefined,
              patientName: currentPatientName,
            });
          }
        }

        // Deduplicate
        const seen = new Set<string>();
        const deduped: CmrRow[] = [];
        for (const r of rawRows) {
          const key = [r.patientName ?? "", r.provider, r.date, r.time ?? "", r.apptTypeRaw, r.statusRaw, r.reasonRaw ?? "", r.location ?? ""].join("|");
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(r);
          }
        }

        const allDates = deduped.map((r) => r.date).filter(Boolean).sort();
        const providers = [...new Set(deduped.map((r) => r.provider).filter(Boolean))];

        resolve({
          rows: deduped,
          minDate: allDates[0],
          maxDate: allDates[allDates.length - 1],
          providers,
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}
