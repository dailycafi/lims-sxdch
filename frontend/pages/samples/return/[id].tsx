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

    if (samples[sampleIndex].status === 'scanned') {
      alert('该样本已经扫描过了');
      return;
    }

    if (samples[sampleIndex].status !== 'pending_return') {
      alert('该样本未选择归还');
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

      // 询问是否打印样本跟踪表
      if (confirm('归还完成！是否打印样本跟踪表？')) {
        printTrackingForm();
      }
      
      router.push('/samples/borrow');
    } catch (error) {
      console.error('Failed to complete return:', error);
      alert('归还失败，请重试');
    }
  };

  // 打印样本跟踪表
  const printTrackingForm = () => {
    if (typeof window === 'undefined' || !borrowRecord) return;

    const printWindow = window.open('', '', 'width=900,height=700');
    if (!printWindow) {
      alert('浏览器阻止了打印窗口，请允许弹窗后重试');
      return;
    }

    const generatedAt = new Date().toLocaleString('zh-CN');
    const returnedSamples = samples.filter(s => s.status === 'scanned');
    const borrowedAt = new Date(borrowRecord.borrowed_at);
    const returnedAt = new Date();
    const durationMs = returnedAt.getTime() - borrowedAt.getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));
    const durationHours = Math.floor(durationMinutes / 60);
    const durationMins = durationMinutes % 60;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>样本跟踪表</title>
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
            margin-bottom: 25px;
            border-bottom: 3px double #000;
            padding-bottom: 15px;
          }
          .header h1 { 
            font-size: 20pt; 
            font-weight: bold;
            letter-spacing: 5px;
            margin-bottom: 5px;
          }
          .header .subtitle {
            font-size: 11pt;
            color: #666;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 25px;
          }
          .info-box {
            border: 1px solid #333;
            padding: 12px 15px;
          }
          .info-box .label {
            font-size: 10pt;
            color: #666;
            margin-bottom: 3px;
          }
          .info-box .value {
            font-size: 12pt;
            font-weight: bold;
          }
          .highlight-box {
            background: #fff3cd;
            border: 2px solid #ffc107;
            padding: 15px;
            margin-bottom: 25px;
            text-align: center;
          }
          .highlight-box .duration {
            font-size: 24pt;
            font-weight: bold;
            color: #856404;
          }
          .highlight-box .label {
            font-size: 10pt;
            color: #856404;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 20px;
          }
          th, td { 
            border: 1px solid #333; 
            padding: 8px 10px; 
            text-align: left;
          }
          th { 
            background: #333; 
            color: white;
            font-weight: bold;
          }
          tr:nth-child(even) { background: #f5f5f5; }
          .status-good { color: #28a745; font-weight: bold; }
          .status-damaged { color: #ffc107; font-weight: bold; }
          .status-lost { color: #dc3545; font-weight: bold; }
          .footer {
            margin-top: 40px;
            border-top: 1px solid #333;
            padding-top: 20px;
          }
          .signature-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-top: 30px;
          }
          .signature-item {
            text-align: center;
          }
          .signature-line {
            border-bottom: 1px solid #333;
            height: 40px;
            margin-bottom: 5px;
          }
          .signature-label {
            font-size: 10pt;
            color: #666;
          }
          .summary-section {
            background: #e8f4fd;
            border: 1px solid #0066cc;
            padding: 15px;
            margin-bottom: 20px;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            text-align: center;
          }
          .summary-item .number {
            font-size: 20pt;
            font-weight: bold;
            color: #0066cc;
          }
          .summary-item .label {
            font-size: 10pt;
            color: #666;
          }
          @media print {
            body { padding: 10mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>样 本 跟 踪 表</h1>
          <p class="subtitle">Sample Tracking Form</p>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <div class="label">领用单号</div>
            <div class="value">${borrowRecord.request_code}</div>
          </div>
          <div class="info-box">
            <div class="label">项目编号</div>
            <div class="value">${borrowRecord.project.lab_project_code}</div>
          </div>
          <div class="info-box">
            <div class="label">申办方编号</div>
            <div class="value">${borrowRecord.project.sponsor_project_code}</div>
          </div>
          <div class="info-box">
            <div class="label">领用人</div>
            <div class="value">${borrowRecord.borrowed_by.full_name}</div>
          </div>
          <div class="info-box">
            <div class="label">领用时间</div>
            <div class="value">${borrowedAt.toLocaleString('zh-CN')}</div>
          </div>
          <div class="info-box">
            <div class="label">归还时间</div>
            <div class="value">${returnedAt.toLocaleString('zh-CN')}</div>
          </div>
        </div>

        <div class="highlight-box">
          <div class="label">样本暴露时长</div>
          <div class="duration">${durationHours > 0 ? durationHours + ' 小时 ' : ''}${durationMins} 分钟</div>
          <div class="label">(共 ${durationMinutes} 分钟)</div>
        </div>

        <div class="summary-section">
          <div class="summary-grid">
            <div class="summary-item">
              <div class="number">${borrowRecord.samples.length}</div>
              <div class="label">领用样本数</div>
            </div>
            <div class="summary-item">
              <div class="number">${returnedSamples.length}</div>
              <div class="label">归还样本数</div>
            </div>
            <div class="summary-item">
              <div class="number">${borrowRecord.samples.length - returnedSamples.length}</div>
              <div class="label">未归还样本数</div>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 50px;">序号</th>
              <th>样本编号</th>
              <th style="width: 100px;">归还状态</th>
              <th style="width: 100px;">样本状态</th>
              <th>存入样本盒</th>
            </tr>
          </thead>
          <tbody>
            ${returnedSamples.map((sample, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td style="font-family: monospace;">${sample.sample_code}</td>
                <td class="status-good">✓ 已归还</td>
                <td class="${sample.return_status === 'good' ? 'status-good' : sample.return_status === 'damaged' ? 'status-damaged' : 'status-lost'}">
                  ${sample.return_status === 'good' ? '完好' : sample.return_status === 'damaged' ? '破损' : sample.return_status === 'lost' ? '丢失' : '-'}
                </td>
                <td>${sample.box_code || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p><strong>备注：</strong></p>
          <div style="border: 1px solid #ddd; min-height: 60px; padding: 10px; margin-top: 10px;">
            &nbsp;
          </div>

          <div class="signature-grid">
            <div class="signature-item">
              <div class="signature-line"></div>
              <div class="signature-label">归还人签字</div>
            </div>
            <div class="signature-item">
              <div class="signature-line"></div>
              <div class="signature-label">样本管理员签字</div>
            </div>
            <div class="signature-item">
              <div class="signature-line"></div>
              <div class="signature-label">复核人签字</div>
            </div>
            <div class="signature-item">
              <div class="signature-line"></div>
              <div class="signature-label">日期</div>
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
            {returnMode === 'full' ? (
              <Button color="dark" onClick={() => handleReturnModeChange('full')}>
                全部归还
              </Button>
            ) : (
              <Button outline onClick={() => handleReturnModeChange('full')}>
                全部归还
              </Button>
            )}
            {returnMode === 'partial' ? (
              <Button color="dark" onClick={() => handleReturnModeChange('partial')}>
                部分归还
              </Button>
            ) : (
              <Button outline onClick={() => handleReturnModeChange('partial')}>
                部分归还
              </Button>
            )}
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
                  {scanMode === 'sample' ? (
                    <Button onClick={() => setScanMode('sample')}>
                      扫描样本
                    </Button>
                  ) : (
                    <Button outline onClick={() => setScanMode('sample')}>
                      扫描样本
                    </Button>
                  )}
                  {scanMode === 'box' ? (
                    <Button onClick={() => setScanMode('box')}>
                      扫描盒子
                    </Button>
                  ) : (
                    <Button outline onClick={() => setScanMode('box')}>
                      扫描盒子
                    </Button>
                  )}
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
                        <Badge color="zinc">
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
                        <Badge color="zinc">已归还</Badge>
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
          <Button outline onClick={() => router.back()}>
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
