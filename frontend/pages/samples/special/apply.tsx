import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Textarea } from '@/components/textarea';
import { Badge } from '@/components/badge';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { toast } from 'react-hot-toast';
import {
  PlusIcon,
  XMarkIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  DocumentTextIcon,
  BeakerIcon,
} from '@heroicons/react/20/solid';
import {
  SpecialSamplesService,
  SpecialSampleApplication,
  SpecialSampleApplicationCreate,
  SpecialSampleConfig,
  SpecialSampleType,
  SAMPLE_TYPE_LABELS,
  SAMPLE_STATUS_LABELS,
  STATUS_COLORS,
} from '@/services/special-samples.service';
import clsx from 'clsx';

interface FormData {
  sample_type: SpecialSampleType;
  project_code_prefix: string;
  project_code_separator: string;
  project_code_suffix: string;
  sample_name: string;
  sample_source: string;
  sample_count: number;
  unit: string;
  storage_temperature: string;
  storage_conditions: string;
  purpose: string;
  notes: string;
}

const initialFormData: FormData = {
  sample_type: 'SC',
  project_code_prefix: 'SC',
  project_code_separator: '-',
  project_code_suffix: '',
  sample_name: '',
  sample_source: '',
  sample_count: 1,
  unit: 'tube',
  storage_temperature: '-20',
  storage_conditions: '',
  purpose: '',
  notes: '',
};

export default function SpecialSampleApplyPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<SpecialSampleApplication[]>([]);
  const [configs, setConfigs] = useState<SpecialSampleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<SpecialSampleApplication | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);

  const fetchApplications = useCallback(async () => {
    try {
      const data = await SpecialSamplesService.getApplications();
      setApplications(data);
    } catch (error) {
      console.error('Failed to fetch applications:', error);
      toast.error('Failed to load applications');
    }
  }, []);

  const fetchConfigs = useCallback(async () => {
    try {
      const data = await SpecialSamplesService.getConfigs();
      setConfigs(data);
    } catch (error) {
      console.error('Failed to fetch configs:', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchApplications(), fetchConfigs()]);
      setLoading(false);
    };
    loadData();
  }, [fetchApplications, fetchConfigs]);

  const handleTypeChange = async (type: SpecialSampleType) => {
    setFormData(prev => ({
      ...prev,
      sample_type: type,
      project_code_prefix: type === 'OTHER' ? '' : type,
    }));

    // Load config for this type
    try {
      const config = await SpecialSamplesService.getConfig(type);
      if (config) {
        setFormData(prev => ({
          ...prev,
          project_code_prefix: config.prefix,
          project_code_separator: config.default_separator,
        }));
      }
    } catch {
      // Use defaults
    }
  };

  const generatePreviewCode = (): string => {
    const { project_code_prefix, project_code_separator, project_code_suffix, sample_count } = formData;
    const parts = [project_code_prefix];
    if (project_code_suffix) {
      parts.push(project_code_suffix);
    }
    parts.push('1');

    const firstCode = parts.join(project_code_separator);
    if (sample_count > 1) {
      const lastParts = [project_code_prefix];
      if (project_code_suffix) {
        lastParts.push(project_code_suffix);
      }
      lastParts.push(String(sample_count));
      const lastCode = lastParts.join(project_code_separator);
      return `${firstCode} ~ ${lastCode}`;
    }
    return firstCode;
  };

  const handleSubmit = async () => {
    // Validate
    if (!formData.project_code_prefix.trim()) {
      toast.error('Please enter project code prefix');
      return;
    }
    if (!formData.sample_name.trim()) {
      toast.error('Please enter sample name');
      return;
    }
    if (formData.sample_count < 1) {
      toast.error('Sample count must be at least 1');
      return;
    }

    setSubmitting(true);
    try {
      const createData: SpecialSampleApplicationCreate = {
        sample_type: formData.sample_type,
        project_code_prefix: formData.project_code_prefix.trim(),
        project_code_separator: formData.project_code_separator,
        project_code_suffix: formData.project_code_suffix.trim() || undefined,
        sample_name: formData.sample_name.trim(),
        sample_source: formData.sample_source.trim() || undefined,
        sample_count: formData.sample_count,
        unit: formData.unit,
        storage_temperature: formData.storage_temperature || undefined,
        storage_conditions: formData.storage_conditions.trim() || undefined,
        purpose: formData.purpose.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      };

      await SpecialSamplesService.createApplication(createData);
      toast.success('Application submitted successfully');
      setShowCreateDialog(false);
      setFormData(initialFormData);
      fetchApplications();
    } catch (error) {
      console.error('Failed to create application:', error);
      toast.error('Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDetail = (app: SpecialSampleApplication) => {
    setSelectedApplication(app);
    setShowDetailDialog(true);
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

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading level={2}>申请入库</Heading>
            <Text className="text-zinc-600 mt-1">
              提交特殊样本入库申请，等待审批后进行接收
            </Text>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <PlusIcon className="w-4 h-4" />
            新建申请
          </Button>
        </div>

        {/* Applications List */}
        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
            <Text className="text-gray-500">Loading...</Text>
          </div>
        ) : applications.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <DocumentTextIcon className="h-8 w-8 text-gray-400" />
            </div>
            <Text className="text-gray-500">暂无入库申请</Text>
            <Text className="text-sm text-gray-400 mt-1">点击上方按钮创建新的特殊样本入库申请</Text>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>申请编号</TableHeader>
                  <TableHeader>样本类型</TableHeader>
                  <TableHeader>项目编号</TableHeader>
                  <TableHeader>样本名称</TableHeader>
                  <TableHeader>数量</TableHeader>
                  <TableHeader>状态</TableHeader>
                  <TableHeader>申请人</TableHeader>
                  <TableHeader>申请时间</TableHeader>
                  <TableHeader>操作</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-mono text-sm">{app.application_code}</TableCell>
                    <TableCell>
                      <Badge color={app.sample_type === 'SC' ? 'blue' : app.sample_type === 'QC' ? 'purple' : 'zinc'}>
                        {SAMPLE_TYPE_LABELS[app.sample_type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">
                      {app.project_code_prefix}
                      {app.project_code_suffix ? `${app.project_code_separator}${app.project_code_suffix}` : ''}
                      {app.project_code_separator}1
                    </TableCell>
                    <TableCell>{app.sample_name}</TableCell>
                    <TableCell>{app.sample_count} {app.unit}</TableCell>
                    <TableCell>
                      <Badge color={STATUS_COLORS[app.status]}>
                        {SAMPLE_STATUS_LABELS[app.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{app.requester_name || '-'}</TableCell>
                    <TableCell className="text-sm text-zinc-500">{formatDate(app.created_at)}</TableCell>
                    <TableCell>
                      <Button plain onClick={() => handleViewDetail(app)}>
                        <EyeIcon className="w-4 h-4" />
                        查看
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Create Application Dialog */}
        <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} size="2xl">
          <DialogTitle>新建入库申请</DialogTitle>
          <DialogDescription>
            填写特殊样本信息，提交入库申请
          </DialogDescription>
          <DialogBody className="space-y-6">
            {/* Sample Type Selection */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                样本类型 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-4 gap-3">
                {(['SC', 'QC', 'BLANK', 'OTHER'] as SpecialSampleType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleTypeChange(type)}
                    className={clsx(
                      'px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all',
                      formData.sample_type === type
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-zinc-200 hover:border-zinc-300 text-zinc-700'
                    )}
                  >
                    {SAMPLE_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            {/* Project Code Configuration */}
            <div className="bg-zinc-50 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <BeakerIcon className="w-5 h-5 text-zinc-500" />
                <Text className="font-medium text-zinc-700">项目编号配置</Text>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    前缀 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.project_code_prefix}
                    onChange={(e) => setFormData({ ...formData, project_code_prefix: e.target.value })}
                    placeholder="例如：SC, QC"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    分隔符
                  </label>
                  <Select
                    value={formData.project_code_separator}
                    onChange={(e) => setFormData({ ...formData, project_code_separator: e.target.value })}
                  >
                    <option value="-">横线 (-)</option>
                    <option value="_">下划线 (_)</option>
                    <option value="">无分隔符</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    代码 (可选)
                  </label>
                  <Input
                    value={formData.project_code_suffix}
                    onChange={(e) => setFormData({ ...formData, project_code_suffix: e.target.value })}
                    placeholder="例如：L, A, B"
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="mt-3 p-3 bg-white rounded border border-zinc-200">
                <Text className="text-xs text-zinc-500 mb-1">编号预览</Text>
                <Text className="font-mono text-lg font-semibold text-zinc-900">
                  {generatePreviewCode()}
                </Text>
              </div>
            </div>

            {/* Sample Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  样本名称 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.sample_name}
                  onChange={(e) => setFormData({ ...formData, sample_name: e.target.value })}
                  placeholder="输入样本名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  样本来源
                </label>
                <Input
                  value={formData.sample_source}
                  onChange={(e) => setFormData({ ...formData, sample_source: e.target.value })}
                  placeholder="输入样本来源"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  数量 <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={formData.sample_count}
                  onChange={(e) => setFormData({ ...formData, sample_count: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  单位
                </label>
                <Select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                >
                  <option value="tube">管</option>
                  <option value="vial">瓶</option>
                  <option value="box">盒</option>
                  <option value="piece">个</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  存储温度
                </label>
                <Select
                  value={formData.storage_temperature}
                  onChange={(e) => setFormData({ ...formData, storage_temperature: e.target.value })}
                >
                  <option value="-80">-80°C</option>
                  <option value="-20">-20°C</option>
                  <option value="4">2-8°C</option>
                  <option value="25">室温</option>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                用途说明
              </label>
              <Textarea
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                placeholder="描述样本用途"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                备注
              </label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="其他说明"
                rows={2}
              />
            </div>
          </DialogBody>
          <DialogActions>
            <Button plain onClick={() => setShowCreateDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '提交中...' : '提交申请'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Application Detail Dialog */}
        <Dialog open={showDetailDialog} onClose={() => setShowDetailDialog(false)} size="xl">
          {selectedApplication && (
            <>
              <DialogTitle>申请详情</DialogTitle>
              <DialogBody className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Text className="text-sm text-zinc-500">申请编号</Text>
                    <Text className="font-mono font-medium">{selectedApplication.application_code}</Text>
                  </div>
                  <div>
                    <Text className="text-sm text-zinc-500">状态</Text>
                    <Badge color={STATUS_COLORS[selectedApplication.status]}>
                      {SAMPLE_STATUS_LABELS[selectedApplication.status]}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Text className="text-sm text-zinc-500">样本类型</Text>
                    <Text className="font-medium">{SAMPLE_TYPE_LABELS[selectedApplication.sample_type]}</Text>
                  </div>
                  <div>
                    <Text className="text-sm text-zinc-500">项目编号格式</Text>
                    <Text className="font-mono font-medium">
                      {selectedApplication.project_code_prefix}
                      {selectedApplication.project_code_suffix
                        ? `${selectedApplication.project_code_separator}${selectedApplication.project_code_suffix}`
                        : ''}
                      {selectedApplication.project_code_separator}[序号]
                    </Text>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Text className="text-sm text-zinc-500">样本名称</Text>
                    <Text className="font-medium">{selectedApplication.sample_name}</Text>
                  </div>
                  <div>
                    <Text className="text-sm text-zinc-500">数量</Text>
                    <Text className="font-medium">{selectedApplication.sample_count} {selectedApplication.unit}</Text>
                  </div>
                </div>

                {selectedApplication.sample_source && (
                  <div>
                    <Text className="text-sm text-zinc-500">样本来源</Text>
                    <Text className="font-medium">{selectedApplication.sample_source}</Text>
                  </div>
                )}

                {selectedApplication.storage_temperature && (
                  <div>
                    <Text className="text-sm text-zinc-500">存储温度</Text>
                    <Text className="font-medium">{selectedApplication.storage_temperature}°C</Text>
                  </div>
                )}

                {selectedApplication.purpose && (
                  <div>
                    <Text className="text-sm text-zinc-500">用途说明</Text>
                    <Text>{selectedApplication.purpose}</Text>
                  </div>
                )}

                {selectedApplication.notes && (
                  <div>
                    <Text className="text-sm text-zinc-500">备注</Text>
                    <Text>{selectedApplication.notes}</Text>
                  </div>
                )}

                <div className="border-t border-zinc-200 pt-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Text className="text-sm text-zinc-500">申请人</Text>
                      <Text className="font-medium">{selectedApplication.requester_name || '-'}</Text>
                    </div>
                    <div>
                      <Text className="text-sm text-zinc-500">申请时间</Text>
                      <Text className="font-medium">{formatDate(selectedApplication.created_at)}</Text>
                    </div>
                  </div>

                  {selectedApplication.approved_by && (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <Text className="text-sm text-zinc-500">审批人</Text>
                        <Text className="font-medium">{selectedApplication.approver_name || '-'}</Text>
                      </div>
                      <div>
                        <Text className="text-sm text-zinc-500">审批时间</Text>
                        <Text className="font-medium">
                          {selectedApplication.approved_at ? formatDate(selectedApplication.approved_at) : '-'}
                        </Text>
                      </div>
                    </div>
                  )}

                  {selectedApplication.rejection_reason && (
                    <div className="mt-4 p-3 bg-red-50 rounded-lg">
                      <Text className="text-sm text-red-600 font-medium">拒绝原因</Text>
                      <Text className="text-red-700">{selectedApplication.rejection_reason}</Text>
                    </div>
                  )}
                </div>
              </DialogBody>
              <DialogActions>
                <Button plain onClick={() => setShowDetailDialog(false)}>
                  关闭
                </Button>
                {selectedApplication.status === 'approved' && (
                  <Button onClick={() => router.push('/samples/special/receive')}>
                    前往接收
                  </Button>
                )}
              </DialogActions>
            </>
          )}
        </Dialog>
      </div>
    </AppLayout>
  );
}
