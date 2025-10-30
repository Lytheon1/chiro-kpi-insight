# Chiro KPI Dashboard

A production-ready KPI tracking dashboard for chiropractic practices using ChiroTouch Cloud exports.

## 📊 Features

- **Excel File Import**: Upload ChiroTouch Cloud appointment exports
- **Flexible Column Mapping**: Automatic detection of Status, Purpose, Provider, Date, and Patient columns
- **KPI Tracking**: 
  - ROF (Return of Findings) Completion Rate
  - Retention Rate (excluding massage appointments)
  - Weekly and Quarterly Kept Appointment Targets
- **Manual Adjustments**: Add completed, cancelled, and rescheduled visits manually
- **Visual Analytics**: Weekly charts, ROF trends, and retention graphs
- **Export Options**: CSV and dashboard image exports

## 📁 Excel File Requirements

Your ChiroTouch export must contain the following columns (headers can vary):

| Required Field | Accepted Column Names |
|----------------|----------------------|
| **Status** | Status, Appt Status, Appointment Status, C |
| **Purpose** | Purpose, Appointment Type, Appt Type, Type, Visit Type, J |
| **Provider** | Provider, Doctor, Clinician, G |
| **Date** | Date, Appt Date, Appointment Date, Visit Date, A |
| **Patient** | Patient, Patient Name, Name, Client, B |

### Example Excel Structure
```
Date         | Patient Name | Status    | Purpose  | Provider
-------------|--------------|-----------|----------|----------
2025-01-15   | John Doe     | Completed | Consult  | Dr. Smith
2025-01-16   | Jane Doe     | Cancelled | Massage  | Dr. Jones
```

## 🔧 System Architecture

### Core Files
- **`src/utils/kpiCalculator.ts`**: KPI calculation logic with date mutation fixes
- **`src/utils/excelParser.ts`**: Enhanced Excel parsing with flexible column detection
- **`src/utils/dataFilters.ts`**: Pre-filtering and caching for performance
- **`src/pages/Dashboard.tsx`**: Main dashboard with loading states and error handling

### Recent Fixes (Based on Audit Report)
✅ **Week Calculation**: Fixed to only count weeks with actual data  
✅ **Date Mutation**: Eliminated date mutation bugs in weekly calculations  
✅ **Column Detection**: Enhanced keyword matching for ChiroTouch exports  
✅ **Error Handling**: Better validation and error messages for invalid files  
✅ **Manual Adjustments**: Input validation with auto-update calculations  
✅ **Loading States**: Proper async loading with skeleton screens

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## 📝 Usage

1. **Upload File**: Upload your ChiroTouch Excel export on the Upload page
2. **Configure Keywords**: Set keywords for Completed, Cancelled, No-Show, ROF, and Massage exclusions
3. **Map Columns**: Verify automatic column detection or adjust manually
4. **View Dashboard**: Review KPIs, charts, and detailed appointment data
5. **Manual Adjustments**: Add additional visits via the collapsible adjustment panel
6. **Export**: Download CSV reports or dashboard images

## 🎯 KPI Formulas

### ROF Completion Rate
```
(Completed ROF Appointments / Scheduled ROF Appointments) × 100
```

### Retention Rate
```
(Completed Non-Massage Appointments / Scheduled Non-Massage Appointments) × 100
```

### Weekly Average
```
Total Kept Non-Massage Appointments / Effective Weeks
```

**Note**: Effective Weeks prioritizes Manual Adjustments Override → Dashboard Override → Auto-Calculated Weeks

## 🔒 Security & Privacy

- All data processing happens client-side
- No PHI (Protected Health Information) is transmitted to external servers
- Session storage is cleared on page refresh
- Excel files are never uploaded to external services

## 🐛 Troubleshooting

### "Could not find header row"
- Ensure your Excel file has clear column headers
- Headers should be in the first 20 rows of the file

### "Missing required columns"
- Verify your export contains Status and Purpose/Type columns
- Check that column names match one of the accepted variations (see table above)

### Manual Adjustments Not Updating
- Manual adjustments automatically recalculate KPIs
- Ensure numeric values are entered (not text)
- Check that Weeks Override (if used) is a positive number

---

## Project Info

**URL**: https://lovable.dev/projects/ef4e3e03-bbab-4505-af38-40432acf47ae

## Technologies

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Recharts

## Deployment

Simply open [Lovable](https://lovable.dev/projects/ef4e3e03-bbab-4505-af38-40432acf47ae) and click on Share → Publish.

## Custom Domain

You can connect a custom domain in Project > Settings > Domains.

Read more: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
