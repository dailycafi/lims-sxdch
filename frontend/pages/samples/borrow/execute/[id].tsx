import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Heading } from '@/components/heading';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { DescriptionList, DescriptionTerm, DescriptionDetails } from '@/components/description-list';
import { api } from '@/lib/api';
import { 
  QrCodeIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/20/solid';

interface BorrowRequest {
  id: number;
  request_code: string;
  project: {
    lab_project_code: string;
    sponsor_project_code: string;
  };
  requested_by: {
    full_name: string;
  };
  purpose: string;
  target_location: string;
  sample_count: number;
  samples: SampleItem[];
}

interface SampleItem {
  id: number;
  sample_code: string;
  status: 'pending' | 'scanned' | 'error';
  errorReason?: string;
}

export default function BorrowExecutePage() {
  const router = useRouter();
  const { id } = router.query;
  const [borrowRequest, setBorrowRequest] = useState<BorrowRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [currentScanCode, setCurrentScanCode] = useState('');
  const [scanErrors, setScanErrors] = useState<string[]>([]);

  useEffect(() => {
    if (id) {
      fetchBorrowRequest();
    }
  }, [id]);

  const fetchBorrowRequest = async () => {
    try {
      const response = await api.get(`/samples/borrow-request/${id}`);
      setBorrowRequest(response.data);
      setSamples(response.data.samples.map((s: any) => ({
        ...s,
        status: 'pending'
      })));
    } catch (error) {
      console.error('Failed to fetch borrow request:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = (code: string) => {
    const sampleIndex = samples.findIndex(s => s.sample_code === code);
    
    if (sampleIndex === -1) {
      // 样本不在领用清单中
      setScanErrors([...scanErrors, `样本 ${code} 不在领用清单中`]);
      return;
    }

    if (samples[sampleIndex].status === 'scanned') {
      // 重复扫描
      setScanErrors([...scanErrors, `样本 ${code} 已经扫描过了`]);
      return;
    }

    // 更新样本状态
    const updatedSamples = [...samples];
    updatedSamples[sampleIndex] = {
      ...updatedSamples[sampleIndex],
      status: 'scanned'
    };
    setSamples(updatedSamples);
  };

  const handleSkipSample = (sampleId: number, reason: string) => {
    const updatedSamples = samples.map(s => 
      s.id === sampleId ? { ...s, status: 'error' as const, errorReason: reason } : s
    );
    setSamples(updatedSamples);
  };

  const handleComplete = async () => {
    const scannedCount = samples.filter(s => s.status === 'scanned').length;
    const totalCount = samples.length;

    if (scannedCount < totalCount) {
      if (!confirm(`还有 ${totalCount - scannedCount} 个样本未扫描，确定要完成领用吗？`)) {
        return;
      }
    }

    try {
      await api.post(`/samples/borrow-request/${id}/execute`, {
        samples: samples
      });

      alert('领用完成！');
      router.push('/samples/borrow');
    } catch (error) {
      console.error('Failed to complete borrow:', error);
      alert('领用失败，请重试');
    }
  };

  const getProgress = () => {
    const scanned = samples.filter(s => s.status === 'scanned').length;
    const total = samples.length;
    return { scanned, total, percentage: total > 0 ? (scanned / total) * 100 : 0 };
  };

  const getPurposeLabel = (purpose: string) => {
    switch (purpose) {
      case 'first_test':
        return '首次检测';
      case 'retest':
        return '重测';
      case 'isr':
        return 'ISR测试';
      default:
        return purpose;
    }
  };

  if (loading || !borrowRequest) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-64">
          <Text>加载中...</Text>
        </div>
      </AppLayout>
    );
  }

  const progress = getProgress();

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        {/* 头部信息 */}
        <div className="mb-6">
          <Heading>执行样本领用</Heading>
          <Text className="mt-1 text-zinc-600">
            申请编号：{borrowRequest.request_code}
          </Text>
        </div>

        {/* 基本信息 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <DescriptionList>
            <div>
              <DescriptionTerm>项目</DescriptionTerm>
              <DescriptionDetails>
                {borrowRequest.project.lab_project_code} / {borrowRequest.project.sponsor_project_code}
              </DescriptionDetails>
            </div>
            <div>
              <DescriptionTerm>申请人</DescriptionTerm>
              <DescriptionDetails>{borrowRequest.requested_by.full_name}</DescriptionDetails>
            </div>
            <div>
              <DescriptionTerm>用途</DescriptionTerm>
              <DescriptionDetails>{getPurposeLabel(borrowRequest.purpose)}</DescriptionDetails>
            </div>
            <div>
              <DescriptionTerm>目标位置</DescriptionTerm>
              <DescriptionDetails>{borrowRequest.target_location}</DescriptionDetails>
            </div>
            <div>
              <DescriptionTerm>样本数量</DescriptionTerm>
              <DescriptionDetails>{borrowRequest.sample_count}</DescriptionDetails>
            </div>
          </DescriptionList>
        </div>

        {/* 扫描进度 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <Text className="font-medium">扫描进度</Text>
            <Text className="text-sm text-zinc-600">
              {progress.scanned} / {progress.total} ({progress.percentage.toFixed(0)}%)
            </Text>
          </div>
          <div className="w-full bg-zinc-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>

        {/* 扫码区域 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="mb-4">
            <Text className="font-medium mb-2">扫描样本条码</Text>
            <div className="flex gap-2">
              <Input
                value={currentScanCode}
                onChange={(e) => setCurrentScanCode(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleScan(currentScanCode);
                    setCurrentScanCode('');
                  }
                }}
                placeholder="扫描或输入样本条码"
                autoFocus
              />
              <Button onClick={() => {
                handleScan(currentScanCode);
                setCurrentScanCode('');
              }}>
                <QrCodeIcon />
              </Button>
            </div>
          </div>

          {scanErrors.length > 0 && (
            <div className="mt-4 p-4 bg-red-50 rounded-lg">
              <div className="flex items-start gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <Text className="font-medium text-red-900">扫描错误</Text>
                  <ul className="mt-1 space-y-1">
                    {scanErrors.slice(-3).map((error, index) => (
                      <li key={index} className="text-sm text-red-700">{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 样本列表 */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-zinc-200">
            <Text className="font-medium">样本清单</Text>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>样本编号</TableHeader>
                  <TableHeader>状态</TableHeader>
                  <TableHeader>操作</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {samples.map((sample) => (
                  <TableRow key={sample.id}>
                    <TableCell className="font-mono">{sample.sample_code}</TableCell>
                    <TableCell>
                      {sample.status === 'pending' && (
                        <Badge color="zinc">待扫描</Badge>
                      )}
                      {sample.status === 'scanned' && (
                        <Badge color="green">
                          <CheckCircleIcon className="h-4 w-4" />
                          已扫描
                        </Badge>
                      )}
                      {sample.status === 'error' && (
                        <Badge color="red">
                          <XCircleIcon className="h-4 w-4" />
                          {sample.errorReason}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {sample.status === 'pending' && (
                        <Button
                          plain
                          size="small"
                          onClick={() => {
                            const reason = prompt('请输入跳过原因：');
                            if (reason) {
                              handleSkipSample(sample.id, reason);
                            }
                          }}
                        >
                          跳过
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-4">
          <Button outline onClick={() => router.back()}>
            取消
          </Button>
          <Button 
            onClick={handleComplete}
            disabled={progress.scanned === 0}
          >
            领用完成
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
