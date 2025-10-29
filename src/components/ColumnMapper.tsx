import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ColumnMapping } from '@/types/dashboard';

interface ColumnMapperProps {
  mapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
}

export const ColumnMapper = ({ mapping, onMappingChange }: ColumnMapperProps) => {
  const handleChange = (field: keyof ColumnMapping, value: string) => {
    onMappingChange({ ...mapping, [field]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Column Mapping</CardTitle>
        <CardDescription>
          Configure which columns contain each type of data. Enter column names or letters (e.g., "A", "B", "C").
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="status-col">Status Column</Label>
          <Input
            id="status-col"
            value={mapping.status}
            onChange={(e) => handleChange('status', e.target.value)}
            placeholder="Status or C"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="purpose-col">Purpose/Type Column</Label>
          <Input
            id="purpose-col"
            value={mapping.purpose}
            onChange={(e) => handleChange('purpose', e.target.value)}
            placeholder="Purpose or J"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="provider-col">Provider Column</Label>
          <Input
            id="provider-col"
            value={mapping.provider}
            onChange={(e) => handleChange('provider', e.target.value)}
            placeholder="Provider or G"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date-col">Date Column</Label>
          <Input
            id="date-col"
            value={mapping.date}
            onChange={(e) => handleChange('date', e.target.value)}
            placeholder="Date or A"
          />
        </div>
      </CardContent>
    </Card>
  );
};
