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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No appointments found
                  </TableCell>
                </TableRow>
              ) : (
                appointments.map((apt, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      {apt.date
                        ? new Date(apt.date).toLocaleDateString()
                        : 'N/A'}
                    </TableCell>
                    <TableCell>{apt[mapping.provider] || 'N/A'}</TableCell>
                    <TableCell>{apt[mapping.purpose] || 'N/A'}</TableCell>
                    <TableCell>{apt[mapping.status] || 'N/A'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
