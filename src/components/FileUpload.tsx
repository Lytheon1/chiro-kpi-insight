import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
}

export const FileUpload = ({ onFileSelect, accept = '.xls,.xlsx', multiple = true }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.name.endsWith('.xls') || file.name.endsWith('.xlsx')
    );

    if (files.length > 0) {
      setSelectedFiles(files);
      onFileSelect(files);
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      setSelectedFiles(files);
      onFileSelect(files);
    }
  }, [onFileSelect]);

  return (
    <Card
      className={cn(
        'border-2 border-dashed transition-all duration-200',
        isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
      )}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <div className="p-12 text-center">
        <div className="flex justify-center mb-6">
          <div className={cn(
            'p-6 rounded-full transition-colors',
            isDragging ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}>
            <Upload className="h-12 w-12" />
          </div>
        </div>
        
        <h3 className="text-xl font-semibold mb-2">Upload Excel File</h3>
        <p className="text-muted-foreground mb-6">
          Drag and drop your ChiroTouch Cloud export file here, or click to browse
        </p>

        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInput}
        />
        <label htmlFor="file-upload">
          <Button asChild>
            <span>Browse Files</span>
          </Button>
        </label>

        {selectedFiles.length > 0 && (
          <div className="mt-6 space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>{file.name}</span>
                <span className="text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
