import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Keywords } from '@/types/dashboard';

interface KeywordsConfigProps {
  keywords: Keywords;
  onKeywordsChange: (keywords: Keywords) => void;
}

export const KeywordsConfig = ({ keywords, onKeywordsChange }: KeywordsConfigProps) => {
  const handleChange = (field: keyof Keywords, value: string) => {
    onKeywordsChange({ ...keywords, [field]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Keywords Configuration</CardTitle>
        <CardDescription>
          Define the keywords used to identify different appointment types and statuses.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="completed-kw">Completed Keyword</Label>
          <Input
            id="completed-kw"
            value={keywords.completed}
            onChange={(e) => handleChange('completed', e.target.value)}
            placeholder="checked"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="canceled-kw">Canceled Keyword</Label>
          <Input
            id="canceled-kw"
            value={keywords.canceled}
            onChange={(e) => handleChange('canceled', e.target.value)}
            placeholder="cancel"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="noshow-kw">No Show Keyword</Label>
          <Input
            id="noshow-kw"
            value={keywords.noShow}
            onChange={(e) => handleChange('noShow', e.target.value)}
            placeholder="no show"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rof-kw">ROF Keyword</Label>
          <Input
            id="rof-kw"
            value={keywords.rof}
            onChange={(e) => handleChange('rof', e.target.value)}
            placeholder="ROF"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="exclude-kw">Exclude Keywords (comma-separated)</Label>
          <Input
            id="exclude-kw"
            value={keywords.excludeKeywords}
            onChange={(e) => handleChange('excludeKeywords', e.target.value)}
            placeholder="massage, therapy: 50 min, phone call"
          />
          <p className="text-xs text-muted-foreground">
            These appointment types will be excluded from Retention Rate, Total Kept, and Weekly Average calculations, but will still appear in Visit Type Breakdown.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
