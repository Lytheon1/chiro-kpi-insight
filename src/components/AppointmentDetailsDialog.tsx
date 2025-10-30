import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AppointmentRow, ColumnMapping } from '@/types/dashboard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMemo } from 'react';

interface AppointmentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  appointments: AppointmentRow[];
  mapping: ColumnMapping;
}

export const AppointmentDetailsDialog = ({
  open,
  onOpenChange,
  title,
  description,
  appointments,
  mapping,
}: AppointmentDetailsDialogProps) => {
  // Group appointments by date
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, AppointmentRow[]>();
    
    appointments.forEach(apt => {
      const dateKey = apt.date 
        ? new Date(apt.date).toLocaleDateString() 
        : 'No Date';
      
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(apt);
    });

    // Sort by date
    return Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === 'No Date') return 1;
      if (b[0] === 'No Date') return -1;
      return new Date(a[0]).getTime() - new Date(b[0]).getTime();
    });
  }, [appointments]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[500px]">
          {appointments.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No appointments found
            </div>
          ) : (
            <div className="space-y-6">
              {groupedByDate.map(([date, dateAppointments]) => (
                <div key={date}>
                  <h3 className="font-semibold text-lg mb-3 sticky top-0 bg-background py-2 border-b">
                    {date}
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead>Purpose</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dateAppointments.map((apt, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{apt[mapping.patient] || 'N/A'}</TableCell>
                          <TableCell>{apt[mapping.purpose] || 'N/A'}</TableCell>
                          <TableCell>{apt[mapping.status] || 'N/A'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
