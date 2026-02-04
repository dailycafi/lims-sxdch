import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { PencilSquareIcon, UserCircleIcon } from '@heroicons/react/20/solid';
import { api } from '@/lib/api';
import { GlobalParamsService } from '@/services';
import { toast } from 'react-hot-toast';

interface ReceiveTask {
  id: number;
  project_id: number;
  project_name: string;
  clinical_site: string;
  transport_company: string;
  transport_method: string;
  temperature_monitor_id: string;
  is_over_temperature: boolean;
  sample_count: number;
  sample_status: string;
  received_by: string;
  received_at: string;
  status: string;
}

interface EditorInfo {
  editor_id: number;
  editor_name: string;
  editor_username: string;
}

interface ClinicalSampleOptions {
  cycles: string[];
  test_types: string[];
  primary_codes: string[];
  backup_codes: string[];
  sample_types: string[];
  purposes: string[];
  transport_methods: string[];
  sample_statuses: string[];
  special_notes: string[];
}

interface ReceiveRecordEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  task: ReceiveTask;
  editorInfo: EditorInfo;
}

export function ReceiveRecordEditDialog({
  open,
  onClose,
  onSave,
  task,
  editorInfo,
}: ReceiveRecordEditDialogProps) {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [clinicalOptions, setClinicalOptions] = useState<ClinicalSampleOptions>({
    cycles: [],
    test_types: [],
    primary_codes: [],
    backup_codes: [],
    sample_types: [],
    purposes: [],
    transport_methods: [],
    sample_statuses: [],
    special_notes: [],
  });
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    transport_method: '',
    transport_method_other: '',
    temperature_monitor_id: '',
    is_over_temperature: 'false',
    sample_count: '',
    sample_status: '',
    sample_status_other: '',
    edit_reason: '',
  });

  useEffect(() => {
    if (open && task) {
      const transportMethod = task.transport_method;
      const sampleStatus = task.sample_status;

      // Check if transport method is custom
      const isTransportOther = transportMethod.startsWith('其它：');
      const isStatusOther = sampleStatus.startsWith('其它：');

      setFormData({
        transport_method: isTransportOther ? 'other' : transportMethod,
        transport_method_other: isTransportOther ? transportMethod.replace('其它：', '') : '',
        temperature_monitor_id: task.temperature_monitor_id,
        is_over_temperature: String(task.is_over_temperature),
        sample_count: String(task.sample_count),
        sample_status: isStatusOther ? 'other' : sampleStatus,
        sample_status_other: isStatusOther ? sampleStatus.replace('其它：', '') : '',
        edit_reason: '',
      });

      fetchOrganizations();
      fetchClinicalOptions();
    }
  }, [open, task]);

  const fetchOrganizations = async () => {
    try {
      const orgs = await GlobalParamsService.getOrganizations();
      setOrganizations(orgs);
    } catch (error: any) {
      if (error?.response?.status !== 401 && !error?.isAuthError) {
        // Silently fail
      }
    }
  };

  const fetchClinicalOptions = async () => {
    try {
      const response = await api.get('/global-params/clinical-sample-options');
      setClinicalOptions(response.data || {});
    } catch (error: any) {
      if (error?.response?.status !== 401 && !error?.isAuthError) {
        // Silently fail
      }
    }
  };

  const handleSave = async () => {
    if (!formData.edit_reason.trim()) {
      toast.error('请填写修改原因');
      return;
    }

    if (!formData.temperature_monitor_id.trim()) {
      toast.error('请输入温度记录仪编号');
      return;
    }

    if (!formData.sample_count || parseInt(formData.sample_count) <= 0) {
      toast.error('请输入有效的样本数量');
      return;
    }

    if (!formData.sample_status) {
      toast.error('请选择样本状态');
      return;
    }

    if (formData.sample_status === 'other' && !formData.sample_status_other.trim()) {
      toast.error('请输入其它样本状态');
      return;
    }

    setLoading(true);

    try {
      const transportMethodToSend =
        formData.transport_method === 'other'
          ? `其它：${formData.transport_method_other.trim()}`
          : formData.transport_method;

      const sampleStatusToSend =
        formData.sample_status === 'other'
          ? `其它：${formData.sample_status_other.trim()}`
          : formData.sample_status;

      await api.put(`/samples/receive-records/${task.id}`, {
        transport_method: transportMethodToSend,
        temperature_monitor_id: formData.temperature_monitor_id,
        is_over_temperature: formData.is_over_temperature === 'true',
        sample_count: parseInt(formData.sample_count),
        sample_status: sampleStatusToSend,
        editor_id: editorInfo.editor_id,
        edit_reason: formData.edit_reason.trim(),
      });

      onSave();
    } catch (error: any) {
      if (error?.response?.status !== 401 && !error?.isAuthError) {
        const message = error?.response?.data?.detail || '保存失败';
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <DialogTitle>
        <div className="flex items-center gap-2">
          <PencilSquareIcon className="h-5 w-5 text-blue-500" />
          编辑接收记录
        </div>
      </DialogTitle>
      <DialogDescription>
        修改接收时填写的信息。所有修改将被记录在审计日志中。
      </DialogDescription>

      <DialogBody>
        <div className="space-y-6">
          {/* 编辑者信息 */}
          <div className="p-3 bg-zinc-50 rounded-lg">
            <div className="flex items-center gap-2">
              <UserCircleIcon className="h-5 w-5 text-zinc-500" />
              <div>
                <Text className="text-sm text-zinc-600">编辑人</Text>
                <Text className="text-sm font-medium text-zinc-900">{editorInfo.editor_name}</Text>
              </div>
            </div>
          </div>

          {/* 只读信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                项目编号
              </label>
              <Input
                value={task.project_name}
                disabled
                className="bg-zinc-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                临床机构
              </label>
              <Input
                value={task.clinical_site}
                disabled
                className="bg-zinc-50"
              />
            </div>
          </div>

          {/* 可编辑信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                运输方式 <span className="text-red-500">*</span>
              </label>
              <Select
                value={formData.transport_method}
                onChange={(e) => {
                  const v = e.target.value;
                  setFormData({
                    ...formData,
                    transport_method: v,
                    transport_method_other: v === 'other' ? formData.transport_method_other : '',
                  });
                }}
                className="w-full"
              >
                <option value="">请选择运输方式</option>
                {clinicalOptions.transport_methods && clinicalOptions.transport_methods.length > 0 ? (
                  <>
                    {clinicalOptions.transport_methods.map((method) => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                    <option value="other">其它</option>
                  </>
                ) : (
                  <>
                    <option value="dry_ice">干冰</option>
                    <option value="ice_pack">冰袋</option>
                    <option value="room_temp">室温</option>
                    <option value="other">其它</option>
                  </>
                )}
              </Select>
              {formData.transport_method === 'other' && (
                <div className="mt-2">
                  <Input
                    value={formData.transport_method_other}
                    onChange={(e) => setFormData({ ...formData, transport_method_other: e.target.value })}
                    placeholder="请输入其它运输方式"
                    className="w-full"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                温度记录仪编号 <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.temperature_monitor_id}
                onChange={(e) => setFormData({ ...formData, temperature_monitor_id: e.target.value })}
                placeholder="输入温度记录仪编号"
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                样本数量 <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                value={formData.sample_count}
                onChange={(e) => setFormData({ ...formData, sample_count: e.target.value })}
                placeholder="输入样本数量"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                是否存在超温情况 <span className="text-red-500">*</span>
              </label>
              <Select
                value={formData.is_over_temperature}
                onChange={(e) => setFormData({ ...formData, is_over_temperature: e.target.value })}
                className="w-full"
              >
                <option value="true">是</option>
                <option value="false">否</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              样本状态 <span className="text-red-500">*</span>
            </label>
            <Select
              value={formData.sample_status}
              onChange={(e) => {
                const v = e.target.value;
                setFormData({
                  ...formData,
                  sample_status: v,
                  sample_status_other: v === 'other' ? formData.sample_status_other : '',
                });
              }}
              className="w-full"
            >
              <option value="">请选择样本状态</option>
              {clinicalOptions.sample_statuses && clinicalOptions.sample_statuses.length > 0 ? (
                <>
                  {clinicalOptions.sample_statuses.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                  <option value="other">其它</option>
                </>
              ) : (
                <>
                  <option value="frozen">冰冻</option>
                  <option value="partially_thawed">部分融化</option>
                  <option value="completely_thawed">完全融化</option>
                  <option value="other">其它</option>
                </>
              )}
            </Select>
            {formData.sample_status === 'other' && (
              <div className="mt-2">
                <Input
                  value={formData.sample_status_other}
                  onChange={(e) => setFormData({ ...formData, sample_status_other: e.target.value })}
                  placeholder="请输入其它样本状态"
                  className="w-full"
                />
              </div>
            )}
          </div>

          {/* 修改原因 */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              修改原因 <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.edit_reason}
              onChange={(e) => setFormData({ ...formData, edit_reason: e.target.value })}
              placeholder="请填写修改原因"
              className="w-full"
            />
            <Text className="text-xs text-zinc-500 mt-1">
              修改原因将被记录在审计日志中
            </Text>
          </div>
        </div>
      </DialogBody>

      <DialogActions>
        <Button plain onClick={onClose} disabled={loading}>
          取消
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? '保存中...' : '保存修改'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
