import { useState, useCallback } from 'react';
import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { CloudArrowUpIcon, XMarkIcon, DocumentTextIcon, CheckCircleIcon } from '@heroicons/react/20/solid';
import { api } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface SampleListUploadProps {
  onParseComplete: (sampleCodes: string[], file: File | null) => void;
  disabled?: boolean;
}

interface ParseResult {
  success: boolean;
  sample_codes: string[];
  count: number;
  column_used: string | null;
}

export function SampleListUpload({ onParseComplete, disabled = false }: SampleListUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const filename = selectedFile.name.toLowerCase();
    if (!filename.endsWith('.xlsx') && !filename.endsWith('.xls') && !filename.endsWith('.csv')) {
      toast.error('仅支持 Excel (.xlsx, .xls) 或 CSV (.csv) 文件');
      return;
    }

    setFile(selectedFile);
    setParsing(true);
    setParseResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await api.post<ParseResult>('/samples/receive/parse-sample-list', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const result = response.data;
      setParseResult(result);
      onParseComplete(result.sample_codes, selectedFile);

      if (result.count > 0) {
        toast.success(`成功解析 ${result.count} 个样本编号`);
      } else {
        toast.error('未能从文件中解析出样本编号');
      }
    } catch (error: any) {
      const message = error?.response?.data?.detail || '解析文件失败';
      toast.error(message);
      setFile(null);
      onParseComplete([], null);
    } finally {
      setParsing(false);
    }

    e.target.value = '';
  }, [onParseComplete]);

  const handleClear = useCallback(() => {
    setFile(null);
    setParseResult(null);
    onParseComplete([], null);
  }, [onParseComplete]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className={disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
            disabled={disabled || parsing}
          />
          <div className="inline-flex items-center justify-center gap-x-2 rounded-lg border px-4 py-2 text-sm font-semibold border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 shadow-sm transition-colors cursor-pointer">
            <CloudArrowUpIcon className="w-4 h-4 text-zinc-500" />
            {parsing ? '解析中...' : '上传样本清单'}
          </div>
        </label>
        {!file && (
          <Text className="text-sm text-zinc-500">支持 Excel (.xlsx, .xls) 或 CSV 格式</Text>
        )}
      </div>

      {file && parseResult && (
        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
          <DocumentTextIcon className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Text className="text-sm font-medium text-green-900 truncate">{file.name}</Text>
              <CheckCircleIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
            </div>
            <Text className="text-xs text-green-700">
              解析到 {parseResult.count} 个样本编号
              {parseResult.column_used && ` (来自列: ${parseResult.column_used})`}
            </Text>
          </div>
          <Button
            plain
            onClick={handleClear}
            disabled={disabled}
            className="flex-shrink-0"
          >
            <XMarkIcon className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
