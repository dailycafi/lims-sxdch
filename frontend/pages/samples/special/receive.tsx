import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { Button } from '@/components/button';
import { Badge } from '@/components/badge';
import { Checkbox } from '@/components/checkbox';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { toast } from 'react-hot-toast';
import {
  BeakerIcon,
  CheckIcon,
  XMarkIcon,
  PrinterIcon,
  InboxArrowDownIcon,
} from '@heroicons/react/20/solid';
import {
  SpecialSamplesService,
  SpecialSampleApplication,
  SpecialSample,
  SAMPLE_TYPE_LABELS,
  SAMPLE_STATUS_LABELS,
  STATUS_COLORS,
} from '@/services/special-samples.service';
import clsx from 'clsx';
import JsBarcode from 'jsbarcode';

export default function SpecialSampleReceivePage() {
  const router = useRouter();
  const [applications, setApplications] = useState<SpecialSampleApplication[]>([]);
  const [samples, setSamples] = useState<SpecialSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(null);
  const [selectedSampleIds, setSelectedSampleIds] = useState<number[]>([]);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [selectedForApproval, setSelectedForApproval] = useState<SpecialSampleApplication | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printingSamples, setPrintingSamples] = useState<SpecialSample[]>([]);

  const fetchApplications = useCallback(async () => {
    try {
      // Get pending and approved applications
      const [pending, approved] = await Promise.all([
        SpecialSamplesService.getApplications({ status: 'pending' }),
        SpecialSamplesService.getApplications({ status: 'approved' }),
      ]);
      setApplications([...pending, ...approved]);
    } catch (error) {
      console.error('Failed to fetch applications:', error);
    }
  }, []);

  const fetchSamples = useCallback(async (applicationId: number) => {
    try {
      const data = await SpecialSamplesService.getSamples({ application_id: applicationId });
      setSamples(data);
    } catch (error) {
      console.error('Failed to fetch samples:', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchApplications();
      setLoading(false);
    };
    loadData();
  }, [fetchApplications]);

  useEffect(() => {
    if (selectedApplicationId) {
      fetchSamples(selectedApplicationId);
    } else {
      setSamples([]);
    }
  }, [selectedApplicationId, fetchSamples]);

  const handleSelectApplication = (app: SpecialSampleApplication) => {
    setSelectedApplicationId(app.id);
    setSelectedSampleIds([]);
  };

  const handleApproval = (app: SpecialSampleApplication) => {
    setSelectedForApproval(app);
    setRejectionReason('');
    setShowApprovalDialog(true);
  };

  const submitApproval = async (approved: boolean) => {
    if (!selectedForApproval) return;

    if (!approved && !rejectionReason.trim()) {
      toast.error('Please enter rejection reason');
      return;
    }

    setSubmitting(true);
    try {
      await SpecialSamplesService.approveApplication(
        selectedForApproval.id,
        approved,
        approved ? undefined : rejectionReason.trim()
      );
      toast.success(approved ? 'Application approved' : 'Application rejected');
      setShowApprovalDialog(false);
      fetchApplications();
      if (selectedApplicationId === selectedForApproval.id) {
        fetchSamples(selectedApplicationId);
      }
    } catch (error) {
      console.error('Failed to process approval:', error);
      toast.error('Failed to process approval');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectSample = (sampleId: number, checked: boolean) => {
    if (checked) {
      setSelectedSampleIds(prev => [...prev, sampleId]);
    } else {
      setSelectedSampleIds(prev => prev.filter(id => id !== sampleId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const receivableSamples = samples.filter(s => s.status === 'approved');
      setSelectedSampleIds(receivableSamples.map(s => s.id));
    } else {
      setSelectedSampleIds([]);
    }
  };

  const handleReceive = async () => {
    if (selectedSampleIds.length === 0) {
      toast.error('Please select samples to receive');
      return;
    }

    setSubmitting(true);
    try {
      const result = await SpecialSamplesService.receiveSamples(selectedSampleIds);
      toast.success(`Successfully received ${result.received_count} samples`);
      setSelectedSampleIds([]);
      if (selectedApplicationId) {
        fetchSamples(selectedApplicationId);
      }
      fetchApplications();
    } catch (error) {
      console.error('Failed to receive samples:', error);
      toast.error('Failed to receive samples');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintLabels = () => {
    const selectedSamples = samples.filter(s => selectedSampleIds.includes(s.id));
    if (selectedSamples.length === 0) {
      toast.error('Please select samples to print');
      return;
    }
    setPrintingSamples(selectedSamples);
    setShowPrintDialog(true);
  };

  const confirmPrint = async () => {
    setSubmitting(true);
    try {
      const result = await SpecialSamplesService.printLabels(
        printingSamples.map(s => s.id)
      );
      toast.success(`Printed ${result.labels.length} labels`);
      setShowPrintDialog(false);

      // Trigger actual print
      printLabels(result.labels);

      if (selectedApplicationId) {
        fetchSamples(selectedApplicationId);
      }
    } catch (error) {
      console.error('Failed to print labels:', error);
      toast.error('Failed to print labels');
    } finally {
      setSubmitting(false);
    }
  };

  const printLabels = (labels: any[]) => {
    // Create print window
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      toast.error('Please allow pop-ups for printing');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sample Labels</title>
        <style>
          @page { size: 50mm 30mm; margin: 0; }
          body { margin: 0; padding: 0; font-family: monospace; }
          .label {
            width: 50mm;
            height: 30mm;
            padding: 2mm;
            box-sizing: border-box;
            page-break-after: always;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .label:last-child { page-break-after: auto; }
          .sample-code { font-size: 12pt; font-weight: bold; }
          .sample-name { font-size: 8pt; }
          .barcode { text-align: center; }
          .barcode img { max-width: 100%; height: 15mm; }
        </style>
      </head>
      <body>
        ${labels.map(label => `
          <div class="label">
            <div class="sample-code">${label.sample_code}</div>
            <div class="sample-name">${label.sample_name}</div>
            <div class="barcode">
              <canvas id="barcode-${label.id}"></canvas>
            </div>
          </div>
        `).join('')}
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <script>
          ${labels.map(label => `
            JsBarcode("#barcode-${label.id}", "${label.barcode || label.sample_code}", {
              format: "CODE128",
              width: 1.5,
              height: 40,
              displayValue: true,
              fontSize: 8
            });
          `).join('')}
          setTimeout(() => { window.print(); }, 500);
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const selectedApplication = applications.find(a => a.id === selectedApplicationId);
  const receivableSamples = samples.filter(s => s.status === 'approved');
  const allSelected = receivableSamples.length > 0 &&
    receivableSamples.every(s => selectedSampleIds.includes(s.id));

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Heading level={2}>样本接收</Heading>
          <Text className="text-zinc-600 mt-1">
            接收已审批的特殊样本，进行初步信息录入并打印标签
          </Text>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Applications List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <Text className="font-medium">待处理申请</Text>
              </div>

              {loading ? (
                <div className="p-8 text-center">
                  <Text className="text-gray-500">Loading...</Text>
                </div>
              ) : applications.length === 0 ? (
                <div className="p-8 text-center">
                  <InboxArrowDownIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <Text className="text-gray-500">暂无待处理申请</Text>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {applications.map((app) => (
                    <div
                      key={app.id}
                      onClick={() => handleSelectApplication(app)}
                      className={clsx(
                        'p-4 cursor-pointer transition-colors',
                        selectedApplicationId === app.id
                          ? 'bg-blue-50 border-l-4 border-blue-500'
                          : 'hover:bg-gray-50'
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Text className="font-mono text-sm font-medium">
                          {app.application_code.split('-').slice(-1)[0]}
                        </Text>
                        <Badge color={STATUS_COLORS[app.status]} className="text-xs">
                          {SAMPLE_STATUS_LABELS[app.status]}
                        </Badge>
                      </div>
                      <Text className="text-sm text-zinc-700 mb-1">{app.sample_name}</Text>
                      <div className="flex items-center justify-between">
                        <Text className="text-xs text-zinc-500">
                          {SAMPLE_TYPE_LABELS[app.sample_type]}
                        </Text>
                        <Text className="text-xs text-zinc-500">
                          {app.sample_count} {app.unit}
                        </Text>
                      </div>

                      {app.status === 'pending' && (
                        <div className="mt-3 flex gap-2">
                          <Button
                            color="green"
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              handleApproval(app);
                            }}
                            className="flex-1 text-xs py-1"
                          >
                            <CheckIcon className="w-3 h-3" />
                            批准
                          </Button>
                          <Button
                            outline
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              setSelectedForApproval(app);
                              setShowApprovalDialog(true);
                            }}
                            className="flex-1 text-xs py-1 text-red-600 border-red-300 hover:bg-red-50"
                          >
                            <XMarkIcon className="w-3 h-3" />
                            拒绝
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Samples List */}
          <div className="lg:col-span-2">
            {selectedApplication ? (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Application Header */}
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <Text className="font-medium">{selectedApplication.sample_name}</Text>
                      <Text className="text-sm text-zinc-500 mt-1">
                        {selectedApplication.project_code_prefix}
                        {selectedApplication.project_code_suffix
                          ? `${selectedApplication.project_code_separator}${selectedApplication.project_code_suffix}`
                          : ''}
                        {selectedApplication.project_code_separator}[1-{selectedApplication.sample_count}]
                      </Text>
                    </div>
                    <div className="flex gap-2">
                      {selectedSampleIds.length > 0 && (
                        <>
                          <Button outline onClick={handlePrintLabels}>
                            <PrinterIcon className="w-4 h-4" />
                            打印标签 ({selectedSampleIds.length})
                          </Button>
                          <Button onClick={handleReceive} disabled={submitting}>
                            <CheckIcon className="w-4 h-4" />
                            确认接收 ({selectedSampleIds.length})
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Samples Table */}
                {samples.length === 0 ? (
                  <div className="p-8 text-center">
                    <BeakerIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <Text className="text-gray-500">
                      {selectedApplication.status === 'pending'
                        ? '申请待审批，审批后将生成样本'
                        : '暂无样本数据'}
                    </Text>
                  </div>
                ) : (
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeader className="w-12">
                          <Checkbox
                            checked={allSelected}
                            onChange={(checked) => handleSelectAll(checked)}
                            disabled={receivableSamples.length === 0}
                          />
                        </TableHeader>
                        <TableHeader>样本编号</TableHeader>
                        <TableHeader>条形码</TableHeader>
                        <TableHeader>状态</TableHeader>
                        <TableHeader>标签打印</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {samples.map((sample) => (
                        <TableRow key={sample.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedSampleIds.includes(sample.id)}
                              onChange={(checked) => handleSelectSample(sample.id, checked)}
                              disabled={sample.status !== 'approved'}
                            />
                          </TableCell>
                          <TableCell className="font-mono font-medium">
                            {sample.sample_code}
                          </TableCell>
                          <TableCell className="font-mono text-sm text-zinc-500">
                            {sample.barcode || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge color={STATUS_COLORS[sample.status]}>
                              {SAMPLE_STATUS_LABELS[sample.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {sample.label_printed ? (
                              <span className="text-green-600 text-sm flex items-center gap-1">
                                <CheckIcon className="w-4 h-4" />
                                已打印 ({sample.print_count})
                              </span>
                            ) : (
                              <span className="text-zinc-400 text-sm">未打印</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <BeakerIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <Text className="text-gray-500">请从左侧选择一个申请</Text>
                <Text className="text-sm text-gray-400 mt-1">
                  选择后可查看样本详情、批准申请或接收样本
                </Text>
              </div>
            )}
          </div>
        </div>

        {/* Approval Dialog */}
        <Dialog open={showApprovalDialog} onClose={() => setShowApprovalDialog(false)}>
          <DialogTitle>
            {selectedForApproval?.status === 'pending' ? '审批入库申请' : '拒绝原因'}
          </DialogTitle>
          <DialogBody>
            {selectedForApproval && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <Text className="font-medium">{selectedForApproval.sample_name}</Text>
                  <Text className="text-sm text-zinc-500 mt-1">
                    {SAMPLE_TYPE_LABELS[selectedForApproval.sample_type]} - {selectedForApproval.sample_count} {selectedForApproval.unit}
                  </Text>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    拒绝原因 (仅拒绝时需要)
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 p-3 text-sm"
                    rows={3}
                    placeholder="请输入拒绝原因..."
                  />
                </div>
              </div>
            )}
          </DialogBody>
          <DialogActions>
            <Button plain onClick={() => setShowApprovalDialog(false)}>
              取消
            </Button>
            <Button
              color="red"
              onClick={() => submitApproval(false)}
              disabled={submitting}
            >
              拒绝
            </Button>
            <Button
              color="green"
              onClick={() => submitApproval(true)}
              disabled={submitting}
            >
              批准
            </Button>
          </DialogActions>
        </Dialog>

        {/* Print Preview Dialog */}
        <Dialog open={showPrintDialog} onClose={() => setShowPrintDialog(false)} size="xl">
          <DialogTitle>打印标签预览</DialogTitle>
          <DialogDescription>
            确认打印 {printingSamples.length} 个标签
          </DialogDescription>
          <DialogBody>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {printingSamples.map((sample) => (
                <div
                  key={sample.id}
                  className="border-2 border-dashed border-zinc-300 rounded-lg p-3 bg-white"
                >
                  <Text className="font-mono font-bold text-sm">{sample.sample_code}</Text>
                  <Text className="text-xs text-zinc-500 mt-1">{sample.sample_name}</Text>
                  <div className="mt-2 h-10 bg-zinc-100 flex items-center justify-center rounded">
                    <div className="flex gap-px">
                      {Array.from({ length: 30 }).map((_, i) => (
                        <div
                          key={i}
                          className="bg-zinc-800"
                          style={{
                            width: Math.random() > 0.5 ? 2 : 1,
                            height: 30
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <Text className="text-xs text-center text-zinc-500 mt-1 font-mono">
                    {sample.barcode || sample.sample_code}
                  </Text>
                </div>
              ))}
            </div>
          </DialogBody>
          <DialogActions>
            <Button plain onClick={() => setShowPrintDialog(false)}>
              取消
            </Button>
            <Button onClick={confirmPrint} disabled={submitting}>
              <PrinterIcon className="w-4 h-4" />
              确认打印
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </AppLayout>
  );
}
