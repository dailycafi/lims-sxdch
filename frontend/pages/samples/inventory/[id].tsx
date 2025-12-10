import { useState, useEffect, useRef } from 'react';
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
  ExclamationTriangleIcon,
  CheckIcon
} from '@heroicons/react/20/solid';
import { clsx } from 'clsx';

import { StorageLocationPicker } from '@/components/storage/StorageLocationPicker';

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
  specialNotes?: string;
}

const SPECIAL_NOTE_OPTIONS = [
  '溶血',
  '脂血',
  '黄疸',
  '凝块',
  '量少'
];

interface SampleBox {
  id: string;
  code: string;
  capacity: number;
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
    shelf: '',
    rack: '',
    position: ''
  });
  const [scannerActive, setScannerActive] = useState(true);
  const [currentAssigningBox, setCurrentAssigningBox] = useState<SampleBox | null>(null);
  const [assignedBoxes, setAssignedBoxes] = useState<Array<{boxCode: string, location: {freezer: string, shelf: string, rack: string, position: string}}>>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);

  // 自动聚焦逻辑：只要没有弹窗且扫描激活，就保持焦点在输入框
  useEffect(() => {
    if (!isErrorDialogOpen && !isStorageDialogOpen && scannerActive && inputRef.current) {
      // 只有当焦点不在其他输入框（如备注）时才强制聚焦
      if (document.activeElement?.tagName !== 'INPUT' || document.activeElement === document.body) {
        inputRef.current.focus();
      }
    }
  }, [samples, currentBox, isErrorDialogOpen, isStorageDialogOpen, scannerActive, scanMode]);

  useEffect(() => {
    if (id) {
      fetchReceiveRecord();
      fetchSampleCodes();
      setScannerActive(true);
      if (!currentBox) {
        setScanMode('box');
      }
    }
  }, [id, currentBox]);

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
    if (!currentBox) {
      alert('请先扫描样本盒，再扫描样本！');
      setScanMode('box');
      return;
    }

    const sampleIndex = samples.findIndex(s => s.code === code);
    
    if (sampleIndex === -1) {
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
      alert('该样本已经扫描过了');
      return;
    }

    // 检查盒子容量
    if (currentBox.samples.length >= currentBox.capacity) {
      alert(`当前样本盒 ${currentBox.code} 已满（${currentBox.capacity}个）！请扫描新的样本盒。`);
      setScanMode('box');
      setCurrentBox(null);
      return;
    }

    // 更新样本状态
    const updatedSamples = [...samples];
    updatedSamples[sampleIndex] = {
      ...updatedSamples[sampleIndex],
      status: 'scanned',
      boxCode: currentBox.code
    };
    setSamples(updatedSamples);

    // 成功提示音效（可选，这里用 console 代替，实际可换成 Audio）
    // const audio = new Audio('/sounds/beep.mp3');
    // audio.play().catch(() => {});

    // 将样本加入盒子
    const updatedBox = {
      ...currentBox,
      samples: [...currentBox.samples, code]
    };
    setCurrentBox(updatedBox);
    
    // 更新盒子列表
    setBoxes(boxes.map(box => 
      box.id === updatedBox.id ? updatedBox : box
    ));

    // 容量警告提示
    const newCount = updatedBox.samples.length;
    if (newCount >= updatedBox.capacity) {
      alert(`样本盒 ${updatedBox.code} 已满 (${newCount}/${updatedBox.capacity})！下一个样本需要新的样本盒。`);
      setScanMode('box');
      setCurrentBox(null);
    } else if (newCount >= updatedBox.capacity * 0.9) {
      alert(`注意：样本盒 ${updatedBox.code} 即将满了 (${newCount}/${updatedBox.capacity})！`);
    }
  };

  const handleBoxScan = (code: string) => {
    if (boxes.find(box => box.code === code)) {
      alert('该样本盒已经使用过了');
      return;
    }

    // 创建新盒子 - 恢复容量设置
    const newBox: SampleBox = {
      id: code,
      code: code,
      capacity: 100, // 默认容量100，可以根据实际需求调整
      samples: []
    };

    setBoxes([...boxes, newBox]);
    setCurrentBox(newBox);
    setScanMode('sample');
  };

  const handleErrorConfirm = async () => {
    if (!errorSample || !errorReason) return;

    const updatedSamples = [...samples, {
      ...errorSample,
      errorReason
    }];
    setSamples(updatedSamples);

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

      alert('清点完成，请开始分配存储位置！');
      setIsStorageDialogOpen(true);
      // Reset assignment state
      setAssignedBoxes([]);
      if (boxes.length > 0) {
        setCurrentAssigningBox(boxes[0]);
      }
    } catch (error) {
      console.error('Failed to complete inventory:', error);
      alert('清点失败，请重试');
    }
  };

  const handleStorageSelect = (location: { freezer: string; shelf: string; rack: string; box: string }) => {
    if (!currentAssigningBox) return;

    // Add to assigned list
    const newAssignment = {
      boxCode: currentAssigningBox.code,
      location: {
        freezer: location.freezer,
        shelf: location.shelf,
        rack: location.rack,
        position: location.box
      }
    };
    
    const updatedAssigned = [...assignedBoxes, newAssignment];
    setAssignedBoxes(updatedAssigned);

    // Move to next box or finish
    const nextIndex = boxes.findIndex(b => b.code === currentAssigningBox.code) + 1;
    if (nextIndex < boxes.length) {
      setCurrentAssigningBox(boxes[nextIndex]);
    } else {
      setCurrentAssigningBox(null); // All done
    }
  };

  const handleStorageConfirm = async () => {
    if (assignedBoxes.length < boxes.length) {
      alert('还有样本盒未分配位置！');
      return;
    }

    try {
      const storageAssignments = assignedBoxes.map(item => ({
        box_code: item.boxCode,
        freezer_id: item.location.freezer,
        shelf_level: item.location.shelf,
        rack_position: item.location.rack,
      }));

      await api.post(`/samples/storage/assign`, {
        receive_record_id: id,
        assignments: storageAssignments
      });

      // 询问是否打印样本清单表
      if (confirm('入库完成！是否打印样本清单表？')) {
        printSampleListReport();
      }
      
      router.push('/samples');
    } catch (error) {
      console.error('Failed to assign storage:', error);
      alert('入库失败，请重试');
    }
  };

  // 打印样本清单表
  const printSampleListReport = () => {
    if (typeof window === 'undefined') return;

    const printWindow = window.open('', '', 'width=900,height=700');
    if (!printWindow) {
      alert('浏览器阻止了打印窗口，请允许弹窗后重试');
      return;
    }

    const generatedAt = new Date().toLocaleString('zh-CN');
    const projectInfo = receiveRecord?.project;
    const scannedSamples = samples.filter(s => s.status === 'scanned');

    // 按样本盒分组
    const samplesByBox: Record<string, SampleCode[]> = {};
    scannedSamples.forEach(sample => {
      const boxCode = sample.boxCode || '未分配';
      if (!samplesByBox[boxCode]) {
        samplesByBox[boxCode] = [];
      }
      samplesByBox[boxCode].push(sample);
    });

    // 获取存储位置信息
    const getBoxLocation = (boxCode: string) => {
      const assignment = assignedBoxes.find(a => a.boxCode === boxCode);
      if (assignment) {
        return `${assignment.location.freezer} / ${assignment.location.shelf} / ${assignment.location.rack}`;
      }
      return '-';
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>样本清单表</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'SimSun', 'Songti SC', serif; 
            padding: 20mm; 
            font-size: 12pt;
            line-height: 1.6;
          }
          .header { 
            text-align: center; 
            margin-bottom: 20px;
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
          }
          .header h1 { 
            font-size: 18pt; 
            font-weight: bold;
            margin-bottom: 10px;
          }
          .info-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 20px;
            padding: 15px;
            background: #f9f9f9;
            border: 1px solid #ddd;
          }
          .info-item {
            display: flex;
          }
          .info-label {
            font-weight: bold;
            min-width: 100px;
          }
          .box-section {
            margin-bottom: 25px;
            page-break-inside: avoid;
          }
          .box-header {
            background: #333;
            color: white;
            padding: 8px 15px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 10px;
          }
          th, td { 
            border: 1px solid #333; 
            padding: 6px 10px; 
            text-align: left;
            font-size: 10pt;
          }
          th { 
            background: #e0e0e0; 
            font-weight: bold;
          }
          tr:nth-child(even) { background: #f5f5f5; }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
          }
          .signature-section {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 30px;
            margin-top: 40px;
          }
          .signature-item {
            border-bottom: 1px solid #333;
            padding-bottom: 5px;
          }
          .signature-label {
            font-size: 10pt;
            color: #666;
          }
          .summary {
            background: #f0f7ff;
            border: 1px solid #0066cc;
            padding: 15px;
            margin-bottom: 20px;
          }
          @media print {
            body { padding: 10mm; }
            .box-section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>样 本 清 单 表</h1>
          <p>Sample Inventory List</p>
        </div>

        <div class="info-section">
          <div class="info-item">
            <span class="info-label">项目编号:</span>
            <span>${projectInfo?.lab_project_code || '-'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">申办方编号:</span>
            <span>${projectInfo?.sponsor_project_code || '-'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">临床机构:</span>
            <span>${receiveRecord?.clinical_org?.name || '-'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">接收时间:</span>
            <span>${receiveRecord?.received_at ? new Date(receiveRecord.received_at).toLocaleString('zh-CN') : '-'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">清点时间:</span>
            <span>${generatedAt}</span>
          </div>
          <div class="info-item">
            <span class="info-label">样本总数:</span>
            <span>${scannedSamples.length} 个</span>
          </div>
        </div>

        <div class="summary">
          <strong>汇总信息:</strong> 
          共 ${Object.keys(samplesByBox).length} 个样本盒，${scannedSamples.length} 个样本已入库
        </div>

        ${Object.entries(samplesByBox).map(([boxCode, boxSamples]) => `
          <div class="box-section">
            <div class="box-header">
              <span>样本盒: ${boxCode}</span>
              <span>存储位置: ${getBoxLocation(boxCode)} | 数量: ${boxSamples.length}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 50px;">序号</th>
                  <th>样本编号</th>
                  <th style="width: 80px;">盒内位置</th>
                  <th style="width: 80px;">状态</th>
                </tr>
              </thead>
              <tbody>
                ${boxSamples.map((sample, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td style="font-family: monospace;">${sample.code}</td>
                    <td>${idx + 1}</td>
                    <td>✓ 已入库</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}

        <div class="footer">
          <div class="signature-section">
            <div>
              <div class="signature-label">清点人:</div>
              <div class="signature-item">&nbsp;</div>
            </div>
            <div>
              <div class="signature-label">复核人:</div>
              <div class="signature-item">&nbsp;</div>
            </div>
            <div>
              <div class="signature-label">日期:</div>
              <div class="signature-item">&nbsp;</div>
            </div>
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
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
  const currentBoxFillPercent = currentBox && currentBox.capacity > 0
    ? Math.round((currentBox.samples.length / currentBox.capacity) * 100)
    : 0;
  const currentBoxStatusColor = currentBox
    ? currentBox.samples.length >= currentBox.capacity
      ? 'red'
      : currentBox.samples.length >= currentBox.capacity * 0.9
        ? 'amber'
        : 'blue'
    : 'blue';
  const currentBoxStatusLabel = currentBox
    ? currentBox.samples.length >= currentBox.capacity
      ? '已满'
      : currentBox.samples.length >= currentBox.capacity * 0.9
        ? '即将满'
        : '使用中'
    : '';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentScanCode(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleScan(currentScanCode);
      setCurrentScanCode('');
    }
  };

  const handleManualScan = () => {
    if (currentScanCode.trim()) {
      handleScan(currentScanCode);
      setCurrentScanCode('');
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 页面标题和基本信息 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Heading>样本清点入库</Heading>
              <Text className="mt-1 text-zinc-600">
                接收编号：RCV-{receiveRecord.id.toString().padStart(4, '0')}
              </Text>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">
                {progress.scanned} / {progress.total}
              </div>
              <Text className="text-sm text-zinc-500">已清点样本</Text>
            </div>
          </div>

          <DescriptionList className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <DescriptionTerm>项目编号</DescriptionTerm>
              <DescriptionDetails className="font-mono">
                {receiveRecord.project.lab_project_code}
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
                {new Date(receiveRecord.received_at).toLocaleDateString('zh-CN')}
              </DescriptionDetails>
            </div>
          </DescriptionList>

          {/* 进度条 */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <Text className="text-sm font-medium">清点进度</Text>
              <Text className="text-sm text-zinc-600">
                {progress.percentage.toFixed(0)}%
              </Text>
            </div>
            <div className="w-full bg-zinc-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* 扫码区域 - 顶部满行 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <Text className="text-lg font-semibold">扫码操作</Text>
            <div className={clsx(
              "flex items-center gap-2 px-3 py-1 rounded-full text-sm",
              scannerActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
            )}>
              <div className={clsx(
                "w-2 h-2 rounded-full",
                scannerActive ? "bg-green-500 animate-pulse" : "bg-gray-400"
              )}></div>
              {scannerActive ? '扫码枪激活' : '扫码枪未激活'}
            </div>
          </div>

          {/* 扫码模式切换 */}
          <div className="mb-4">
            <Text className="text-sm font-medium mb-2">扫码模式：</Text>
            <div className="flex gap-2">
              <Button 
                onClick={() => setScanMode('box')}
                className={scanMode === 'box' ? 'bg-blue-600' : 'bg-gray-100 text-gray-700'}
              >
                <ArchiveBoxIcon className="h-4 w-4" />
                扫描盒子
              </Button>
              <Button 
                onClick={() => {
                  if (currentBox) {
                    setScanMode('sample');
                  } else {
                    alert('请先扫描样本盒！');
                  }
                }}
                disabled={!currentBox}
                className={clsx(
                  scanMode === 'sample' && currentBox ? 'bg-blue-600' : 'bg-gray-100 text-gray-700',
                  !currentBox && 'opacity-50 cursor-not-allowed'
                )}
              >
                <BeakerIcon className="h-4 w-4" />
                扫描样本
              </Button>
            </div>
          </div>

          {/* 扫码输入框 */}
          <div className="space-y-3">
            <div className="flex gap-2 max-w-2xl">
              <Input
                ref={inputRef}
                value={currentScanCode}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  scanMode === 'sample' 
                    ? (currentBox ? '扫描样本条码' : '请先扫描样本盒') 
                    : '扫描样本盒条码'
                }
                disabled={scanMode === 'sample' && !currentBox}
                autoFocus={!(scanMode === 'sample' && !currentBox)}
                className="flex-1"
              />
              <Button 
                onClick={handleManualScan}
                outline
                disabled={scanMode === 'sample' && !currentBox}
              >
                <CheckIcon className="h-4 w-4" />
                确认
              </Button>
            </div>
            
            <Text className="text-sm text-zinc-600">
              {scanMode === 'sample' 
                ? (currentBox ? '扫描后按回车或点击确认' : '请先扫描样本盒') 
                : '扫描样本盒条码后自动切换到样本扫描模式'
              }
            </Text>
          </div>
        </div>

        {/* 状态区域 - 两栏布局 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* 左侧：当前样本盒状态 */}
          <div className="bg-white rounded-lg shadow p-6 flex flex-col">
            <Text className="text-lg font-semibold mb-4">当前样本盒状态</Text>
            
            <div className="flex-1">
            {currentBox ? (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex flex-col gap-2 h-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Text className="font-mono font-bold text-blue-900 text-lg">
                      {currentBox.code}
                    </Text>
                    <Badge color="zinc">当前使用</Badge>
                    <Badge color={currentBoxStatusColor}>{currentBoxStatusLabel}</Badge>
                  </div>
                  <Badge color={currentBoxStatusColor}>
                    {currentBox.samples.length} / {currentBox.capacity}
                  </Badge>
                </div>

                {/* 当前样本盒进度条（保留，因为有容量限制） */}
                <div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className={clsx(
                        "h-2 rounded-full transition-all duration-300",
                        currentBox.samples.length >= currentBox.capacity ? "bg-red-500" :
                        currentBox.samples.length >= currentBox.capacity * 0.9 ? "bg-amber-500" :
                        "bg-blue-500"
                      )}
                      style={{ width: `${Math.min(currentBoxFillPercent, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Text className="text-sm text-blue-700">
                    已有：{currentBox.samples.length} 个
                  </Text>
                  <Button 
                    onClick={() => {
                      setScanMode('box');
                      setCurrentBox(null);
                    }}
                    outline
                    className="text-xs px-2 py-1"
                    disabled={currentBox.samples.length === 0}
                  >
                    切换盒子
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg text-center h-full flex flex-col justify-center">
                <ExclamationTriangleIcon className="h-12 w-12 mx-auto mb-3 text-amber-500" />
                <Text className="font-semibold text-amber-800 mb-2">请先扫描样本盒</Text>
                <Text className="text-sm text-amber-700 mb-4">
                  扫描样本盒后才能开始扫描样本
                </Text>
                <Button 
                  onClick={() => setScanMode('box')}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <ArchiveBoxIcon className="h-4 w-4" />
                  立即扫描样本盒
                </Button>
              </div>
            )}
            </div>
          </div>

          {/* 右侧：样本清点进度 */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200 flex flex-col">
            <div className="mb-4">
              <Text className="text-lg font-semibold text-gray-900">待清点样本</Text>
            </div>

            {/* 样本统计和进度条 */}
            <div className="p-4 bg-gray-50 rounded-lg flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-3">
                <Text className="font-medium text-gray-900">样本清点进度</Text>
                <div className="flex gap-2">
                  <Badge color="zinc">待扫描: {samples.filter(s => s.status === 'pending').length}</Badge>
                  <Badge color="green">已扫描: {samples.filter(s => s.status === 'scanned').length}</Badge>
                  <Badge color="red">异常: {samples.filter(s => s.status === 'error').length}</Badge>
                </div>
              </div>
              
              {/* 进度条 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <Text className="text-gray-600">
                    {progress.scanned} / {progress.total} 已完成
                  </Text>
                  <Text className="text-gray-600 font-medium">
                    {progress.percentage.toFixed(0)}%
                  </Text>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 样本列表 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200 bg-gray-50">
            <Text className="text-lg font-semibold text-gray-900">样本清单</Text>
          </div>
          
          {/* 固定表头 */}
          <div className="bg-white border-b border-zinc-200 sticky top-0 z-10">
            <div className="grid grid-cols-5 gap-4 px-6 py-3 text-sm font-medium text-zinc-700 bg-zinc-50">
              <div className="flex items-center">
                <Text className="font-semibold">样本编号</Text>
              </div>
              <div className="flex items-center justify-center">
                <Text className="font-semibold">状态</Text>
              </div>
              <div className="flex items-center justify-center">
                <Text className="font-semibold">样本盒</Text>
              </div>
              <div className="flex items-center justify-center">
                <Text className="font-semibold">特殊事项</Text>
              </div>
              <div className="flex items-center justify-center">
                <Text className="font-semibold">备注</Text>
              </div>
            </div>
          </div>
          
          {/* 滚动内容区域 */}
          <div className="max-h-96 overflow-y-auto">
            <div className="divide-y divide-zinc-100">
              {samples.map((sample, index) => (
                <div key={sample.id} className={clsx(
                  "grid grid-cols-5 gap-4 px-6 py-4 hover:bg-zinc-50 transition-colors",
                  index % 2 === 0 ? "bg-white" : "bg-zinc-50/30"
                )}>
                  <div className="flex items-center">
                    <Text className="font-mono text-sm font-medium">{sample.code}</Text>
                  </div>
                  <div className="flex items-center justify-center">
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
                  </div>
                  <div className="flex items-center justify-center">
                    <Text className="font-mono text-sm">{sample.boxCode || '-'}</Text>
                  </div>
                  <div className="flex items-center justify-center">
                    <input
                      list={`special-notes-${sample.id}`}
                      type="text"
                      className="w-full px-2 py-1 text-sm border border-zinc-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-zinc-100 disabled:text-zinc-400"
                      value={sample.specialNotes || ''}
                      onChange={(e) => {
                        const newSamples = [...samples];
                        newSamples[index] = { ...newSamples[index], specialNotes: e.target.value };
                        setSamples(newSamples);
                      }}
                      placeholder={sample.status === 'scanned' ? "选择或输入" : "-"}
                      disabled={sample.status !== 'scanned'}
                    />
                    <datalist id={`special-notes-${sample.id}`}>
                      {SPECIAL_NOTE_OPTIONS.map(opt => (
                        <option key={opt} value={opt} />
                      ))}
                    </datalist>
                  </div>
                  <div className="flex items-center justify-center">
                    <Text className="text-sm text-zinc-600">{sample.errorReason || '-'}</Text>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-between items-center">
          <Button
            outline
            onClick={() => {
              window.open(`/api/v1/samples/receive-records/${id}/export`, '_blank');
            }}
          >
            导出清单表（Excel）
          </Button>
          
          <div className="flex gap-3">
            <Button outline onClick={() => router.back()}>
              取消
            </Button>
            <Button 
              onClick={handleInventoryComplete}
              disabled={progress.scanned === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              清点完成 ({progress.scanned}/{progress.total})
            </Button>
          </div>
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
      <Dialog open={isStorageDialogOpen} onClose={() => {}} size="xl">
        <DialogTitle>样本入库分配</DialogTitle>
        <DialogDescription>
          请为每个样本盒选择存储位置
        </DialogDescription>
        <DialogBody>
          <div className="flex flex-col h-[600px]">
            {/* Progress / Status */}
            <div className="mb-4 bg-blue-50 p-4 rounded-lg border border-blue-100">
              <div className="flex items-center justify-between mb-2">
                <Text className="font-medium text-blue-900">
                  分配进度: {assignedBoxes.length} / {boxes.length}
                </Text>
                <div className="text-sm text-blue-700">
                  当前处理: <span className="font-bold">{currentAssigningBox?.code || '完成'}</span>
                </div>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all" 
                  style={{ width: `${(assignedBoxes.length / boxes.length) * 100}%` }}
                />
              </div>
            </div>

            {currentAssigningBox ? (
              <div className="flex-1 border rounded-lg overflow-hidden flex flex-col">
                <div className="bg-zinc-50 px-4 py-2 border-b">
                  <Text className="text-sm font-medium">
                    请选择样本盒 <span className="font-bold text-blue-600">{currentAssigningBox.code}</span> 的存放位置
                  </Text>
                </div>
                <div className="flex-1 p-4 overflow-hidden">
                  <StorageLocationPicker 
                    onSelect={handleStorageSelect}
                    onCancel={() => {}} // No cancel inside picker flow
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-green-50 border border-green-100 rounded-lg">
                <CheckCircleIcon className="w-16 h-16 text-green-500 mb-4" />
                <Text className="text-xl font-semibold text-green-800">所有样本盒已分配位置</Text>
                <Text className="text-green-700 mt-2">点击确认入库完成操作</Text>
              </div>
            )}
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsStorageDialogOpen(false)} disabled={assignedBoxes.length > 0}>
            取消
          </Button>
          <Button onClick={handleStorageConfirm} disabled={assignedBoxes.length < boxes.length}>
            确认入库
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
