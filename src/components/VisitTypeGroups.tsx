import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppointmentRow, Keywords, ColumnMapping } from '@/types/dashboard';
import { Badge } from '@/components/ui/badge';
import { isCompleted, isCanceled, isNoShow } from '@/utils/kpiCalculator';
import { useState } from 'react';
import { AppointmentDetailsDialog } from './AppointmentDetailsDialog';

interface VisitTypeGroupsProps {
  rows: AppointmentRow[];
  keywords: Keywords;
  mapping: ColumnMapping;
}

interface TypeGroup {
  type: string;
  kept: number;
  canceled: number;
  noShow: number;
  keptAppts: AppointmentRow[];
  canceledAppts: AppointmentRow[];
  noShowAppts: AppointmentRow[];
}

export const VisitTypeGroups = ({ rows, keywords, mapping }: VisitTypeGroupsProps) => {
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    title: string;
    description: string;
    appointments: AppointmentRow[];
  }>({
    open: false,
    title: '',
    description: '',
    appointments: [],
  });

  const groups = new Map<string, TypeGroup>();

  rows.forEach(row => {
    const type = row[mapping.purpose] || 'Unknown';
    
    if (!groups.has(type)) {
      groups.set(type, {
        type,
        kept: 0,
        canceled: 0,
        noShow: 0,
        keptAppts: [],
        canceledAppts: [],
        noShowAppts: [],
      });
    }

    const group = groups.get(type)!;
    
    if (isCompleted(row, keywords)) {
      group.kept++;
      group.keptAppts.push(row);
    } else if (isCanceled(row, keywords)) {
      group.canceled++;
      group.canceledAppts.push(row);
    } else if (isNoShow(row, keywords)) {
      group.noShow++;
      group.noShowAppts.push(row);
    }
  });

  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    const aTotal = a.kept + a.canceled + a.noShow;
    const bTotal = b.kept + b.canceled + b.noShow;
    return bTotal - aTotal;
  });

  const handleGroupClick = (type: string, status: 'kept' | 'canceled' | 'noShow', appointments: AppointmentRow[]) => {
    setDialogState({
      open: true,
      title: `${type} - ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      description: `${appointments.length} appointment${appointments.length !== 1 ? 's' : ''}`,
      appointments,
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Visit Type Breakdown</CardTitle>
          <CardDescription>Appointments grouped by type and status (click to view details)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sortedGroups.map(group => (
              <div key={group.type} className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">{group.type}</h3>
                <div className="flex flex-wrap gap-2">
                  {group.kept > 0 && (
                    <Badge
                      variant="default"
                      className="cursor-pointer bg-success hover:bg-success/80"
                      onClick={() => handleGroupClick(group.type, 'kept', group.keptAppts)}
                    >
                      Kept: {group.kept}
                    </Badge>
                  )}
                  {group.canceled > 0 && (
                    <Badge
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => handleGroupClick(group.type, 'canceled', group.canceledAppts)}
                    >
                      Canceled: {group.canceled}
                    </Badge>
                  )}
                  {group.noShow > 0 && (
                    <Badge
                      variant="destructive"
                      className="cursor-pointer"
                      onClick={() => handleGroupClick(group.type, 'noShow', group.noShowAppts)}
                    >
                      No Show: {group.noShow}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AppointmentDetailsDialog
        open={dialogState.open}
        onOpenChange={(open) => setDialogState({ ...dialogState, open })}
        title={dialogState.title}
        description={dialogState.description}
        appointments={dialogState.appointments}
        mapping={mapping}
      />
    </>
  );
};
