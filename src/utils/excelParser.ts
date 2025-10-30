import * as XLSX from 'xlsx';
import { AppointmentRow, ColumnMapping, Keywords } from '@/types/dashboard';

const normalizeString = (str: string | undefined): string => {
  if (!str) return '';
  return str.toString().trim().replace(/\s+/g, ' ').toLowerCase();
};

const parseExcelDate = (value: any): Date | null => {
  if (!value) return null;
  
  // Excel serial date
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return new Date(date.y, date.m - 1, date.d);
    }
  }
  
  // String date
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  
  return null;
};

export const detectColumnMapping = (headers: string[]): ColumnMapping => {
  const headerMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    if (h) headerMap[normalizeString(h)] = i;
  });

  // Enhanced keyword matching for flexible column detection
  const findColumn = (keywords: string[]): string => {
    for (const header in headerMap) {
      for (const keyword of keywords) {
        const normalizedKeyword = normalizeString(keyword);
        if (header.includes(normalizedKeyword)) {
          return headers[headerMap[header]];
        }
      }
    }
    // Return first keyword as fallback
    return keywords[0];
  };

  return {
    status: findColumn(['status', 'appt status', 'appointment status', 'c']),
    purpose: findColumn(['purpose', 'appointment type', 'appt type', 'type', 'visit type', 'j']),
    provider: findColumn(['provider', 'doctor', 'clinician', 'g']),
    date: findColumn(['date', 'appt date', 'appointment date', 'visit date', 'a']),
    patient: findColumn(['patient', 'patient name', 'name', 'client', 'b']),
  };
};

const isValidAppointmentRow = (
  row: any,
  mapping: ColumnMapping,
  keywords: Keywords
): boolean => {
  const status = normalizeString(row[mapping.status]);
  const purpose = normalizeString(row[mapping.purpose]);

  if (!status || !purpose) return false;

  const hasStatus = 
    status.includes(normalizeString(keywords.completed)) ||
    status.includes(normalizeString(keywords.canceled)) ||
    status.includes(normalizeString(keywords.noShow));

  return hasStatus && purpose.length > 0;
};

export const parseExcelFile = async (
  file: File,
  mapping: ColumnMapping,
  keywords: Keywords
): Promise<AppointmentRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { 
          header: 1,
          raw: false,
          defval: ''
        }) as any[][];

        // Find header row
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(20, jsonData.length); i++) {
          const row = jsonData[i];
          if (row && row.some((cell: any) => {
            const normalized = normalizeString(cell);
            return normalized.includes('status') || 
                   normalized.includes('purpose') || 
                   normalized.includes('provider');
          })) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          reject(new Error('Could not find header row in Excel file. Please ensure the file contains columns like Status, Purpose, Provider, Date, and Patient.'));
          return;
        }

        const headers = jsonData[headerRowIndex].map((h: any) => h?.toString() || '');
        const dataRows = jsonData.slice(headerRowIndex + 1);

        // Validate that essential columns exist
        const hasStatus = headers.some(h => normalizeString(h).includes('status'));
        const hasPurpose = headers.some(h => 
          normalizeString(h).includes('purpose') || 
          normalizeString(h).includes('type')
        );
        
        if (!hasStatus || !hasPurpose) {
          reject(new Error('Missing required columns. Excel file must contain Status and Purpose/Type columns.'));
          return;
        }

        // Convert to objects
        const rows: AppointmentRow[] = [];
        
        for (const dataRow of dataRows) {
          const rowObj: AppointmentRow = {};
          headers.forEach((header: string, i: number) => {
            if (header) {
              rowObj[header] = dataRow[i];
            }
          });

          // Skip if not a valid appointment row
          if (!isValidAppointmentRow(rowObj, mapping, keywords)) {
            continue;
          }

          // Normalize status and purpose
          rowObj._statusNormalized = normalizeString(rowObj[mapping.status]);
          rowObj._purposeNormalized = normalizeString(rowObj[mapping.purpose]);

          // Parse date if present
          if (mapping.date && rowObj[mapping.date]) {
            const parsedDate = parseExcelDate(rowObj[mapping.date]);
            if (parsedDate) {
              rowObj.date = parsedDate;
            }
          }

          rows.push(rowObj);
        }

        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
};
