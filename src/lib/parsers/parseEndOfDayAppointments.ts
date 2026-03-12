import * as XLSX from "xlsx";
import { normalizeText, normalizeDate, normalizeTime, safeNumber } from "../utils/normalize";
import type { EndOfDayAppointmentRow, EndOfDayDailyTotals, ParsedEndOfDay } from "../../types/reports";

/**
 * Parses ChiroTouch "End-of-Day Report - Appointments" export.
 * Now captures patientName from col[0] on appointment rows.
 */
export function parseEndOfDayAppointments(file: File): Promise<ParsedEndOfDay> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        const titleCell = normalizeText(rows[0]?.[0]);
        if (!titleCell.includes("end-of-day report")) {
          throw new Error(
            'This does not appear to be an "End-of-Day Report - Appointments" file. ' +
            `Found title: "${rows[0]?.[0]}"`
          );
        }

        const appointments: EndOfDayAppointmentRow[] = [];
        const dailyTotals: EndOfDayDailyTotals[] = [];

        let currentDate: string | null = null;
        let currentProvider = "";
        let currentLocation = "";
        let inTotalsBlock = false;
        let currentTotals: Partial<EndOfDayDailyTotals> | null = null;

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const col0 = normalizeText(row[0]);

          if (col0 === "appointments for") {
            if (currentTotals && currentDate) {
              dailyTotals.push(currentTotals as EndOfDayDailyTotals);
            }
            currentDate = normalizeDate(row[2]);
            currentProvider = String(row[5] || "").trim();
            currentLocation = String(row[11] || "").trim();
            inTotalsBlock = false;
            currentTotals = null;
            continue;
          }

          if (col0 === "totals for") {
            inTotalsBlock = true;
            const totDate = normalizeDate(row[1]) ?? currentDate ?? "";
            const totProvider = String(row[5] || currentProvider).trim();
            const totLocation = String(row[11] || currentLocation).trim();
            currentTotals = {
              source: "endOfDayTotals",
              date: totDate,
              provider: totProvider,
              location: totLocation,
            };
            continue;
          }

          if (inTotalsBlock && currentTotals) {
            parseSummaryRow(row, currentTotals);
            if (col0 === "total appointments:") {
              dailyTotals.push(currentTotals as EndOfDayDailyTotals);
              currentTotals = null;
              inTotalsBlock = false;
            }
            continue;
          }

          if (
            !inTotalsBlock &&
            currentDate &&
            col0 !== "patient" &&
            col0 !== "appointments"
          ) {
            const status = String(row[5] || "").trim();
            const purpose = String(row[10] || "").trim();
            const statusLower = status.toLowerCase();

            // Exclude no-show and checked-in rows from Report A
            // No-shows are tracked via Report B (CMR); checked-in is incomplete
            const isExcludedStatus =
              statusLower.includes("no-show") ||
              statusLower.includes("no show") ||
              statusLower === "checked-in";

            if (status && purpose && status !== "status" && !isExcludedStatus) {
              // Capture patient name from col[0] — may be blank if PHI removed
              const rawName = String(row[0] || "").trim();
              const patientName = rawName && !normalizeText(rawName).includes("appointments")
                ? rawName
                : undefined;

              appointments.push({
                source: "endOfDay",
                date: currentDate,
                provider: currentProvider,
                location: currentLocation,
                scheduledTime: normalizeTime(row[2]) ?? undefined,
                statusRaw: status,
                purposeRaw: purpose,
                checkInRaw: normalizeTime(row[7]) ?? undefined,
                postedChargesRaw: row[12] !== "" ? row[12] as string | number : undefined,
                patientName,
              });
            }
          }
        }

        if (currentTotals && (currentTotals as EndOfDayDailyTotals).date) {
          dailyTotals.push(currentTotals as EndOfDayDailyTotals);
        }

        const allDates = appointments.map((a) => a.date).filter(Boolean).sort();
        const providers = [...new Set(appointments.map((a) => a.provider).filter(Boolean))];

        resolve({
          appointments,
          dailyTotals,
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

function parseSummaryRow(row: unknown[], totals: Partial<EndOfDayDailyTotals>): void {
  const pairs: Array<[string, unknown]> = [
    [normalizeText(row[0]), row[3]],
    [normalizeText(row[5]), row[8]],
    [normalizeText(row[11]), row[13]],
  ];

  for (const [label, val] of pairs) {
    const n = safeNumber(val);
    if (n === null) continue;
    if (label.includes("scheduled appointments")) totals.scheduledAppointments = n;
    else if (label.includes("no show")) totals.noShowAppointments = n;
    else if (label.includes("new patients")) totals.newPatients = n;
    else if (label.includes("walk-in")) totals.walkInAppointments = n;
    else if (label.includes("canceled appointments")) totals.canceledAppointments = n;
    else if (label.includes("current patients")) totals.currentPatients = n;
    else if (label.includes("total patients")) totals.totalPatients = n;
    else if (label.includes("total appointments")) totals.totalAppointments = n;
    else if (label.includes("checked-out")) totals.checkedOutAppointments = n;
    else if (label.includes("patients encountered")) totals.patientsEncountered = n;
  }
}
