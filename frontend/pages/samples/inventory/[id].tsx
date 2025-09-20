import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
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
  ArchiveBoxIcon,
  BeakerIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/20/solid';

interface ReceiveRecord {
  id: number;
  project: {
    id: number;
    lab_project_code: string;
    sponsor_project_code: string;
  };
  clinical_org: {
    name: string;
  };
  sample_count: number;
  received_at: string;
  status: string;
}

interface SampleCode {
  id: string;
  code: string;
  status: 'pending' | 'scanned' | 'error';
  errorReason?: string;
  boxCode?: string;
}

interface SampleBox {
  id: string;
  code: string;
  capacity: number;
  currentCount: number;
  samples: string[];
}

export default function SampleInventoryPage() {
  const router = useRouter();
  const { id } = router.query;
  const [receiveRecord, setReceiveRecord] = useState<ReceiveRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [samples, setSamples] = useState<SampleCode[]>([]);
  const [currentScanCode, setCurrentScanCode] = useState('');
  const [scanMode, setScanMode] = useState<'sample' | 'box'>('sample');
  const [currentBox, setCurrentBox] = useState<SampleBox | null>(null);
  const [boxes, setBoxes] = useState<SampleBox[]>([]);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);
  const [errorSample, setErrorSample] = useState<SampleCode | null>(null);
  const [errorReason, setErrorReason] = useState('');
  const [isStorageDialogOpen, setIsStorageDialogOpen] = useState(false);
  const [storageLocation, setStorageLocation] = useState({
    freezer: '',
    level: '',
    rack: '',
    position: ''
  });
  const [scannerActive, setScannerActive] = useState(true);

  useEffect(() => {
    if (id) {
      fetchReceiveRecord();
      fetchSampleCodes();
      // 页面加载完成，激活扫码枪
      setScannerActive(true);
    }
  }, [id]);

  const fetchReceiveRecord = async () => {
    try {
      const response = await api.get(`/samples/receive-records/${id}`);
      setReceiveRecord(response.data);
    } catch (error) {
      console.error('Failed to fetch receive record:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSampleCodes = async () => {
    try {
      // 根据接收记录获取应该清点的样本编号
      const response = await api.get(`/samples/receive-records/${id}/expected-samples`);
      setSamples(response.data.map((code: string) => ({
        id: code,
        code: code,
        status: 'pending'
      })));
    } catch (error) {
      console.error('Failed to fetch sample codes:', error);
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
    const sampleIndex = samples.findIndex(s => s.code === code);
    
    if (sampleIndex === -1) {
      // 样本不在清单中
      const errorSample: SampleCode = {
        id: code,
        code: code,
        status: 'error',
        errorReason: '样本不在接收清单中'
      };
      setErrorSample(errorSample);
      setIsErrorDialogOpen(true);
      return;
    }

    if (samples[sampleIndex].status === 'scanned') {
      // 重复扫描
      alert('该样本已经扫描过了');
      return;
    }

    // 更新样本状态
    const updatedSamples = [...samples];
    updatedSamples[sampleIndex] = {
      ...updatedSamples[sampleIndex],
      status: 'scanned',
      boxCode: currentBox?.code
    };
    setSamples(updatedSamples);

    // 如果有当前盒子，将样本加入盒子
    if (currentBox) {
      const updatedBox = {
        ...currentBox,
        currentCount: currentBox.currentCount + 1,
        samples: [...currentBox.samples, code]
      };
      setCurrentBox(updatedBox);
      
      // 更新盒子列表
      setBoxes(boxes.map(box => 
        box.id === updatedBox.id ? updatedBox : box
      ));

      // 如果盒子满了，自动切换到扫描盒子模式
      if (updatedBox.currentCount >= updatedBox.capacity) {
        setScanMode('box');
        setCurrentBox(null);
      }
    }
  };

  const handleBoxScan = (code: string) => {
    // 检查是否已存在
    if (boxes.find(box => box.code === code)) {
      alert('该样本盒已经使用过了');
      return;
    }

    // 创建新盒子
    const newBox: SampleBox = {
      id: code,
      code: code,
      capacity: 100, // 默认容量100
      currentCount: 0,
      samples: []
    };

    setBoxes([...boxes, newBox]);
    setCurrentBox(newBox);
    setScanMode('sample'); // 切换回扫描样本模式
  };

  const handleErrorConfirm = async () => {
    if (!errorSample || !errorReason) return;

    // 记录错误并继续
    const updatedSamples = [...samples, {
      ...errorSample,
      errorReason
    }];
    setSamples(updatedSamples);

    // TODO: 发送错误记录到后端
    
    setIsErrorDialogOpen(false);
    setErrorSample(null);
    setErrorReason('');
  };

  const handleInventoryComplete = async () => {
    const scannedCount = samples.filter(s => s.status === 'scanned').length;
    const totalCount = samples.filter(s => s.status !== 'error').length;

    if (scannedCount < totalCount) {
      if (!confirm(`还有 ${totalCount - scannedCount} 个样本未清点，确定要完成清点吗？`)) {
        return;
      }
    }

    try {
      await api.post(`/samples/receive-records/${id}/complete-inventory`, {
        samples: samples,
        boxes: boxes
      });

      alert('清点完成！');
      setIsStorageDialogOpen(true);
    } catch (error) {
      console.error('Failed to complete inventory:', error);
      alert('清点失败，请重试');
    }
  };

  const handleStorageConfirm = async () => {
    try {
      // 为每个盒子分配存储位置
      const storageAssignments = boxes.map((box, index) => ({
        box_code: box.code,
        freezer_id: storageLocation.freezer,
        shelf_level: storageLocation.level,
        rack_position: storageLocation.rack,
        compartment: `${storageLocation.position}-${index + 1}`
      }));

      await api.post(`/samples/storage/assign`, {
        receive_record_id: id,
        assignments: storageAssignments
      });

      alert('入库完成！');
      router.push('/samples');
    } catch (error) {
      console.error('Failed to assign storage:', error);
      alert('入库失败，请重试');
    }
  };

  const getProgress = () => {
    const scanned = samples.filter(s => s.status === 'scanned').length;
    const total = samples.filter(s => s.status !== 'error').length;
    return { scanned, total, percentage: total > 0 ? (scanned / total) * 100 : 0 };
  };

  if (loading || !receiveRecord) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-64">
          <Text>加载中...</Text>
        </div>
      </AppLayout>
    );
  }

  const progress = getProgress();

  // 简化输入处理
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentScanCode(e.target.value);
  };

  // 扫码枪扫描完成会自动发送Enter，直接执行清点
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleScan(currentScanCode);
      setCurrentScanCode('');
    }
  };

  // 手动确认按钮（备用）
  const handleManualScan = () => {
    if (currentScanCode.trim()) {
      handleScan(currentScanCode);
      setCurrentScanCode('');
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* 头部信息 */}
        <div className="mb-6">
          <Heading>样本清点入库</Heading>
          <Text className="mt-1 text-zinc-600">
            接收编号：RCV-{receiveRecord.id.toString().padStart(4, '0')}
          </Text>
        </div>

        {/* 基本信息 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <DescriptionList>
            <div>
              <DescriptionTerm>项目编号</DescriptionTerm>
              <DescriptionDetails>
                {receiveRecord.project.lab_project_code} / {receiveRecord.project.sponsor_project_code}
              </DescriptionDetails>
            </div>
            <div>
              <DescriptionTerm>临床机构</DescriptionTerm>
              <DescriptionDetails>{receiveRecord.clinical_org.name}</DescriptionDetails>
            </div>
            <div>
              <DescriptionTerm>样本数量</DescriptionTerm>
              <DescriptionDetails>{receiveRecord.sample_count}</DescriptionDetails>
            </div>
            <div>
              <DescriptionTerm>接收时间</DescriptionTerm>
              <DescriptionDetails>
                {new Date(receiveRecord.received_at).toLocaleString('zh-CN')}
              </DescriptionDetails>
            </div>
          </DescriptionList>
        </div>

        {/* 清点进度 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <Text className="font-medium">清点进度</Text>
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

        {/* 扫码状态提示 */}
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <Text className="text-green-800 font-medium">扫码枪已激活</Text>
          </div>
          <Text className="text-sm text-green-700 mt-1">
            请使用扫码枪扫描{scanMode === 'sample' ? '样本' : '样本盒'}条码，扫描后将自动清点
          </Text>
        </div>

        {/* 扫码区域 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-3 gap-6">
            {/* 扫码输入 */}
            <div className="col-span-2">
              <div className="flex items-center gap-4 mb-4">
                <Text className="font-medium">当前扫码模式：</Text>
                <div className="flex gap-2">
                  {scanMode === 'sample' ? (
                    <Button onClick={() => setScanMode('sample')}>
                      <BeakerIcon className="h-4 w-4" />
                      扫描样本
                    </Button>
                  ) : (
                    <Button outline onClick={() => setScanMode('sample')}>
                      <BeakerIcon className="h-4 w-4" />
                      扫描样本
                    </Button>
                  )}
                  {scanMode === 'box' ? (
                    <Button onClick={() => setScanMode('box')}>
                      <ArchiveBoxIcon className="h-4 w-4" />
                      扫描盒子
                    </Button>
                  ) : (
                    <Button outline onClick={() => setScanMode('box')}>
                      <ArchiveBoxIcon className="h-4 w-4" />
                      扫描盒子
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex gap-2 max-w-md">
                <Input
                  value={currentScanCode}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={scanMode === 'sample' ? '扫描样本条码（自动）' : '扫描样本盒条码（自动）'}
                  autoFocus
                  className="flex-1"
                />
                <Button 
                  onClick={handleManualScan}
                  className="flex-shrink-0 px-4"
                  outline
                >
                  <QrCodeIcon className="h-4 w-4" />
                  确认
                </Button>
              </div>

              {currentBox && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <Text className="font-medium text-blue-900">当前样本盒</Text>
                  <Text className="text-sm text-blue-700 mt-1">
                    编号：{currentBox.code}
                  </Text>
                  <Text className="text-sm text-blue-700">
                    容量：{currentBox.currentCount} / {currentBox.capacity}
                  </Text>
                </div>
              )}
            </div>

            {/* 样本盒列表 */}
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
                        <Badge color={box.currentCount >= box.capacity ? 'green' : 'blue'}>
                          {box.currentCount} / {box.capacity}
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
                  <TableHeader>样本编号</TableHeader>
                  <TableHeader>状态</TableHeader>
                  <TableHeader>样本盒</TableHeader>
                  <TableHeader>备注</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {samples.map((sample) => (
                  <TableRow key={sample.id}>
                    <TableCell className="font-mono">{sample.code}</TableCell>
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
                          异常
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{sample.boxCode || '-'}</TableCell>
                    <TableCell className="text-sm text-zinc-600">
                      {sample.errorReason || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-between gap-4">
          <div>
            <Button
              outline
              onClick={() => {
                window.open(`/api/v1/samples/receive-records/${id}/export`, '_blank');
              }}
            >
              导出清单表（Excel）
            </Button>
          </div>
          <Button outline onClick={() => router.back()}>
            取消
          </Button>
          <Button 
            onClick={handleInventoryComplete}
            disabled={progress.scanned === 0}
          >
            清点完成
          </Button>
        </div>
      </div>

      {/* 错误处理对话框 */}
      <Dialog open={isErrorDialogOpen} onClose={setIsErrorDialogOpen}>
        <DialogTitle className="px-6 pt-6">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
            样本异常
          </div>
        </DialogTitle>
        <DialogDescription className="px-6 pt-1">
          样本 {errorSample?.code} 不在接收清单中，请输入原因
        </DialogDescription>
        <DialogBody className="px-6 py-2">
          <input
            type="text"
            value={errorReason}
            onChange={(e) => setErrorReason(e.target.value)}
            placeholder="请输入异常原因"
            className="w-full px-4 py-2 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </DialogBody>
        <DialogActions className="px-6 pb-6">
          <Button plain onClick={() => {
            setIsErrorDialogOpen(false);
            setErrorSample(null);
            setErrorReason('');
          }}>
            跳过
          </Button>
          <Button onClick={handleErrorConfirm} disabled={!errorReason}>
            确认并继续
          </Button>
        </DialogActions>
      </Dialog>

      {/* 入库对话框 */}
      <Dialog open={isStorageDialogOpen} onClose={setIsStorageDialogOpen} size="lg">
        <DialogTitle>样本入库</DialogTitle>
        <DialogDescription>
          清点完成，请扫描存储位置
        </DialogDescription>
        <DialogBody>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  冰箱编号
                </label>
                <Input
                  value={storageLocation.freezer}
                  onChange={(e) => setStorageLocation({...storageLocation, freezer: e.target.value})}
                  placeholder="扫描或输入冰箱编号"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  层
                </label>
                <Input
                  value={storageLocation.level}
                  onChange={(e) => setStorageLocation({...storageLocation, level: e.target.value})}
                  placeholder="如：第3层"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  架子
                </label>
                <Input
                  value={storageLocation.rack}
                  onChange={(e) => setStorageLocation({...storageLocation, rack: e.target.value})}
                  placeholder="如：A架"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  起始位置
                </label>
                <Input
                  value={storageLocation.position}
                  onChange={(e) => setStorageLocation({...storageLocation, position: e.target.value})}
                  placeholder="如：1-1"
                />
              </div>
            </div>

            <div className="bg-zinc-50 rounded-lg p-4">
              <Text className="text-sm text-zinc-600">
                共 {boxes.length} 个样本盒需要存放
              </Text>
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsStorageDialogOpen(false)}>
            取消
          </Button>
          <Button onClick={handleStorageConfirm}>
            确认入库
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
