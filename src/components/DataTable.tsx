import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AppointmentRow } from '@/types/dashboard';
import { Search } from 'lucide-react';

interface DataTableProps {
  rows: AppointmentRow[];
  mapping: { status: string; purpose: string; provider: string; date: string };
}

export const DataTable = ({ rows, mapping }: DataTableProps) => {
  const [search, setSearch] = useState('');

  const filteredRows = useMemo(() => {
    if (!search) return rows;
    
    const searchLower = search.toLowerCase();
    return rows.filter(row => {
      const status = (row[mapping.status] || '').toString().toLowerCase();
      const purpose = (row[mapping.purpose] || '').toString().toLowerCase();
      const provider = (row[mapping.provider] || '').toString().toLowerCase();
      
      return status.includes(searchLower) || 
             purpose.includes(searchLower) || 
             provider.includes(searchLower);
    });
  }, [rows, search, mapping]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appointment Data</CardTitle>
        <CardDescription>
          All parsed appointment rows ({filteredRows.length} of {rows.length} shown)
        </CardDescription>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search appointments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-auto max-h-[500px]">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Purpose/Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No appointments found
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {row.date 
                        ? (row.date instanceof Date ? row.date : new Date(row.date)).toLocaleDateString()
                        : 'N/A'
                      }
                    </TableCell>
                    <TableCell>{row[mapping.provider] || 'N/A'}</TableCell>
                    <TableCell>{row[mapping.status] || 'N/A'}</TableCell>
                    <TableCell>{row[mapping.purpose] || 'N/A'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
