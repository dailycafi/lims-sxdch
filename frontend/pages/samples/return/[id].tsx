import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Checkbox } from '@/components/checkbox';
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
  ArchiveBoxIcon
} from '@heroicons/react/20/solid';

interface BorrowRecord {
  id: number;
  request_code: string;
  project: {
    lab_project_code: string;
    sponsor_project_code: string;
  };
  borrowed_by: {
    full_name: string;
  };
  borrowed_at: string;
  samples: ReturnSample[];
}

interface ReturnSample {
  id: number;
  sample_code: string;
  status: 'borrowed' | 'returned' | 'pending_return' | 'scanned';
  return_status?: 'good' | 'damaged' | 'lost';
  box_code?: string;
}

interface SampleBox {
  id: string;
  code: string;
  samples: string[];
}

export default function SampleReturnPage() {
  const router = useRouter();
  const { id } = router.query;
  const [borrowRecord, setBorrowRecord] = useState<BorrowRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [samples, setSamples] = useState<ReturnSample[]>([]);
  const [currentScanCode, setCurrentScanCode] = useState('');
  const [scanMode, setScanMode] = useState<'sample' | 'box'>('sample');
  const [currentBox, setCurrentBox] = useState<SampleBox | null>(null);
  const [boxes, setBoxes] = useState<SampleBox[]>([]);
  const [returnMode, setReturnMode] = useState<'full' | 'partial'>('full');

  useEffect(() => {
    if (id) {
      fetchBorrowRecord();
    }
  }, [id]);

  const fetchBorrowRecord = async () => {
    try {
      const response = await api.get(`/samples/borrow-record/${id}`);
      setBorrowRecord(response.data);
      setSamples(response.data.samples.map((s: ReturnSample) => ({
        ...s,
        status: returnMode === 'full' ? 'pending_return' : 'borrowed'
      })));
    } catch (error) {
      console.error('Failed to fetch borrow record:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReturnModeChange = (mode: 'full' | 'partial') => {
    setReturnMode(mode);
    if (mode === 'full') {
      // 全部归还模式：所有样本都标记为待归还
      setSamples(samples.map(s => ({ ...s, status: 'pending_return' })));
    } else {
      // 部分归还模式：重置所有样本状态
      setSamples(samples.map(s => ({ ...s, status: 'borrowed' })));
    }
  };

  const handleSampleToggle = (sampleId: number) => {
    if (returnMode === 'partial') {
      setSamples(samples.map(s => 
        s.id === sampleId 
          ? { ...s, status: s.status === 'borrowed' ? 'pending_return' : 'borrowed' }
          : s
      ));
    }
  };

  const handleScan = (code: string) => {
    if (scanMode === 'sample') {
      handleSampleScan(code);
    } else {
      handleBoxScan(code);
    }
  };

  const handleSampleScan = (code: string) => {
    const sampleIndex = samples.findIndex(s => s.sample_code === code);
    
    if (sampleIndex === -1) {
      alert('样本不在归还清单中');
      return;
    }

    if (samples[sampleIndex].status !== 'pending_return') {
      alert('该样本未选择归还');
      return;
    }

    if (samples[sampleIndex].status === 'scanned') {
      alert('该样本已经扫描过了');
      return;
    }

    // 更新样本状态
    const updatedSamples = [...samples];
    updatedSamples[sampleIndex] = {
      ...updatedSamples[sampleIndex],
      status: 'scanned',
      return_status: 'good',
      box_code: currentBox?.code
    };
    setSamples(updatedSamples);

    // 如果有当前盒子，将样本加入盒子
    if (currentBox) {
      const updatedBox = {
        ...currentBox,
        samples: [...currentBox.samples, code]
      };
      setCurrentBox(updatedBox);
      setBoxes(boxes.map(box => 
        box.id === updatedBox.id ? updatedBox : box
      ));
    }
  };

  const handleBoxScan = (code: string) => {
    const newBox: SampleBox = {
      id: code,
      code: code,
      samples: []
    };

    setBoxes([...boxes, newBox]);
    setCurrentBox(newBox);
    setScanMode('sample');
  };

  const handleComplete = async () => {
    const returningCount = samples.filter(s => s.status === 'scanned').length;
    const selectedCount = samples.filter(s => s.status === 'pending_return' || s.status === 'scanned').length;

    if (returningCount < selectedCount) {
      if (!confirm(`还有 ${selectedCount - returningCount} 个样本未扫描，确定要完成归还吗？`)) {
        return;
      }
    }

    try {
      await api.post(`/samples/return`, {
        borrow_record_id: id,
        samples: samples.filter(s => s.status === 'scanned'),
        boxes: boxes
      });

      alert('归还完成！');
      router.push('/samples/borrow');
    } catch (error) {
      console.error('Failed to complete return:', error);
      alert('归还失败，请重试');
    }
  };

  const getProgress = () => {
    const scanned = samples.filter(s => s.status === 'scanned').length;
    const selected = samples.filter(s => s.status === 'pending_return' || s.status === 'scanned').length;
    return { scanned, selected, percentage: selected > 0 ? (scanned / selected) * 100 : 0 };
  };

  if (loading || !borrowRecord) {
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
      <div className="max-w-7xl mx-auto">
        {/* 头部信息 */}
        <div className="mb-6">
          <Heading>样本归还</Heading>
          <Text className="mt-1 text-zinc-600">
            领用编号：{borrowRecord.request_code}
          </Text>
        </div>

        {/* 基本信息 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <DescriptionList>
            <div>
              <DescriptionTerm>项目</DescriptionTerm>
              <DescriptionDetails>
                {borrowRecord.project.lab_project_code} / {borrowRecord.project.sponsor_project_code}
              </DescriptionDetails>
            </div>
            <div>
              <DescriptionTerm>领用人</DescriptionTerm>
              <DescriptionDetails>{borrowRecord.borrowed_by.full_name}</DescriptionDetails>
            </div>
            <div>
              <DescriptionTerm>领用时间</DescriptionTerm>
              <DescriptionDetails>
                {new Date(borrowRecord.borrowed_at).toLocaleString('zh-CN')}
              </DescriptionDetails>
            </div>
            <div>
              <DescriptionTerm>样本总数</DescriptionTerm>
              <DescriptionDetails>{borrowRecord.samples.length}</DescriptionDetails>
            </div>
          </DescriptionList>
        </div>

        {/* 归还模式选择 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <Text className="font-medium mb-4">归还模式</Text>
          <div className="flex gap-4">
            <Button
              variant={returnMode === 'full' ? 'primary' : 'secondary'}
              onClick={() => handleReturnModeChange('full')}
            >
              全部归还
            </Button>
            <Button
              variant={returnMode === 'partial' ? 'primary' : 'secondary'}
              onClick={() => handleReturnModeChange('partial')}
            >
              部分归还
            </Button>
          </div>
          {returnMode === 'partial' && (
            <Text className="text-sm text-zinc-600 mt-2">
              请在下方列表中勾选需要归还的样本
            </Text>
          )}
        </div>

        {/* 扫描进度 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <Text className="font-medium">归还进度</Text>
            <Text className="text-sm text-zinc-600">
              已扫描 {progress.scanned} / 待归还 {progress.selected} ({progress.percentage.toFixed(0)}%)
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
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <Text className="font-medium">扫码模式：</Text>
                <div className="flex gap-2">
                  <Button
                    size="small"
                    variant={scanMode === 'sample' ? 'primary' : 'secondary'}
                    onClick={() => setScanMode('sample')}
                  >
                    扫描样本
                  </Button>
                  <Button
                    size="small"
                    variant={scanMode === 'box' ? 'primary' : 'secondary'}
                    onClick={() => setScanMode('box')}
                  >
                    扫描盒子
                  </Button>
                </div>
              </div>

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
                  placeholder={scanMode === 'sample' ? '扫描样本条码' : '扫描样本盒条码'}
                  autoFocus
                />
                <Button onClick={() => {
                  handleScan(currentScanCode);
                  setCurrentScanCode('');
                }}>
                  <QrCodeIcon />
                </Button>
              </div>

              {currentBox && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <Text className="font-medium text-blue-900">当前样本盒</Text>
                  <Text className="text-sm text-blue-700 mt-1">
                    编号：{currentBox.code}
                  </Text>
                  <Text className="text-sm text-blue-700">
                    已装入：{currentBox.samples.length} 个样本
                  </Text>
                </div>
              )}
            </div>

            <div>
              <Text className="font-medium mb-4">已使用样本盒</Text>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {boxes.length === 0 ? (
                  <Text className="text-sm text-zinc-500">请先扫描样本盒</Text>
                ) : (
                  boxes.map(box => (
                    <div key={box.id} className="p-3 bg-zinc-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <Text className="font-medium">{box.code}</Text>
                        <Badge color="blue">
                          {box.samples.length} 个样本
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
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
                  {returnMode === 'partial' && <TableHeader className="w-12"></TableHeader>}
                  <TableHeader>样本编号</TableHeader>
                  <TableHeader>状态</TableHeader>
                  <TableHeader>归还状态</TableHeader>
                  <TableHeader>样本盒</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {samples.map((sample) => (
                  <TableRow key={sample.id}>
                    {returnMode === 'partial' && (
                      <TableCell>
                        <Checkbox
                          checked={sample.status === 'pending_return' || sample.status === 'scanned'}
                          onChange={() => handleSampleToggle(sample.id)}
                          disabled={sample.status === 'scanned'}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-mono">{sample.sample_code}</TableCell>
                    <TableCell>
                      {sample.status === 'borrowed' && (
                        <Badge color="zinc">未选择</Badge>
                      )}
                      {sample.status === 'pending_return' && (
                        <Badge color="yellow">待扫描</Badge>
                      )}
                      {sample.status === 'scanned' && (
                        <Badge color="green">
                          <CheckCircleIcon className="h-4 w-4" />
                          已扫描
                        </Badge>
                      )}
                      {sample.status === 'returned' && (
                        <Badge color="blue">已归还</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {sample.return_status === 'good' && (
                        <Badge color="green">完好</Badge>
                      )}
                      {sample.return_status === 'damaged' && (
                        <Badge color="amber">破损</Badge>
                      )}
                      {sample.return_status === 'lost' && (
                        <Badge color="red">丢失</Badge>
                      )}
                      {!sample.return_status && '-'}
                    </TableCell>
                    <TableCell>{sample.box_code || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-4">
          <Button variant="secondary" onClick={() => router.back()}>
            取消
          </Button>
          <Button 
            onClick={handleComplete}
            disabled={progress.scanned === 0}
          >
            完成归还
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
