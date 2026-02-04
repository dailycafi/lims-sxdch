import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Text } from '@/components/text';
import { Textarea } from '@/components/textarea';
import { api } from '@/lib/api';
import {
  CloudArrowUpIcon,
  QrCodeIcon,
  DocumentPlusIcon,
  CheckCircleIcon,
  UserCircleIcon,
  ShieldCheckIcon
} from '@heroicons/react/20/solid';
import { toast } from 'react-hot-toast';
import { GlobalParamsService } from '@/services';
import { useProjectStore } from '@/store/project';
import { Tooltip } from '@/components/tooltip';
import { SampleListUpload } from '@/components/sample-list-upload';
import { SampleSelectionDialog } from '@/components/sample-selection-dialog';
import { ReviewerVerificationDialog } from '@/components/reviewer-verification-dialog';
import { useAuthStore } from '@/store/auth';

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

interface ReviewerInfo {
  reviewer_id: number;
  reviewer_name: string;
  reviewer_username: string;
}

export default function SampleReceivePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    projects,
    selectedProjectId,
    fetchProjects: fetchProjectList,
  } = useProjectStore();

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
  const [temperatureFile, setTemperatureFile] = useState<File | null>(null);
  const [expressPhotos, setExpressPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [sampleListFile, setSampleListFile] = useState<File | null>(null);
  const [sampleCodesFromList, setSampleCodesFromList] = useState<string[]>([]);
  const [selectedSampleIds, setSelectedSampleIds] = useState<number[]>([]);
  const [sampleSelectionOpen, setSampleSelectionOpen] = useState(false);
  const [reviewerDialogOpen, setReviewerDialogOpen] = useState(false);
  const [reviewerInfo, setReviewerInfo] = useState<ReviewerInfo | null>(null);
  const [additionalNotes, setAdditionalNotes] = useState('');

  const [formData, setFormData] = useState({
    clinical_site: '',
    transport_company: '',
    transport_method: '',
    transport_method_other: '',
    temperature_monitor_id: '',
    is_over_temperature: 'false',
    sample_count: '',
    sample_status: '',
    sample_status_other: '',
    storage_location: '',
  });

  useEffect(() => {
    fetchOrganizations();
    fetchClinicalOptions();
  }, []);

  useEffect(() => {
    if (projects.length === 0) {
      fetchProjectList().catch((error: any) => {
        if (error?.response?.status !== 401 && !error?.isAuthError) {
          toast.error('加载项目列表失败');
        }
      });
    }
  }, [projects.length, fetchProjectList]);

  const fetchOrganizations = async () => {
    try {
      const organizations = await GlobalParamsService.getOrganizations();
      setOrganizations(organizations);
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

  const handleSampleListParsed = useCallback((codes: string[], file: File | null) => {
    setSampleCodesFromList(codes);
    setSampleListFile(file);
  }, []);

  const handleSampleSelectionChange = useCallback((ids: number[]) => {
    setSelectedSampleIds(ids);
  }, []);

  const handleReviewerVerified = useCallback((info: ReviewerInfo) => {
    setReviewerInfo(info);
  }, []);

  const clearReviewer = useCallback(() => {
    setReviewerInfo(null);
  }, []);

  const validateForm = (): boolean => {
    if (!selectedProjectId) {
      toast.error('请先在右上角选择项目');
      return false;
    }
    if (!formData.clinical_site) {
      toast.error('请选择临床机构/分中心');
      return false;
    }
    if (!formData.transport_company) {
      toast.error('请选择运输单位/部门');
      return false;
    }
    if (!formData.transport_method) {
      toast.error('请选择运输方式');
      return false;
    }
    if (formData.transport_method === 'other' && !formData.transport_method_other.trim()) {
      toast.error('请输入其它运输方式');
      return false;
    }
    if (!formData.temperature_monitor_id.trim()) {
      toast.error('请输入温度记录仪编号/序列号');
      return false;
    }
    if (!formData.sample_count || parseInt(formData.sample_count) <= 0) {
      toast.error('请输入有效的样本数量');
      return false;
    }
    if (!formData.sample_status) {
      toast.error('请选择样本状态');
      return false;
    }
    if (formData.sample_status === 'other' && !formData.sample_status_other.trim()) {
      toast.error('请输入其它样本状态');
      return false;
    }
    if (!reviewerInfo) {
      toast.error('请完成复核人验证');
      return false;
    }
    return true;
  };

  const handleReceive = async () => {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      const formDataToSend = new FormData();

      const transportMethodToSend =
        formData.transport_method === 'other'
          ? `其它：${formData.transport_method_other.trim()}`
          : formData.transport_method;

      const sampleStatusToSend =
        formData.sample_status === 'other'
          ? `其它：${formData.sample_status_other.trim()}`
          : formData.sample_status;

      formDataToSend.append('project_id', String(selectedProjectId));
      formDataToSend.append('clinical_org_id', formData.clinical_site);
      formDataToSend.append('transport_org_id', formData.transport_company);
      formDataToSend.append('transport_method', transportMethodToSend);
      formDataToSend.append('temperature_monitor_id', formData.temperature_monitor_id);
      formDataToSend.append('is_over_temperature', formData.is_over_temperature);
      formDataToSend.append('sample_count', formData.sample_count);
      formDataToSend.append('sample_status', sampleStatusToSend);
      formDataToSend.append('storage_location', formData.storage_location);

      if (temperatureFile) {
        formDataToSend.append('temperature_file', temperatureFile);
      }

      expressPhotos.forEach((photo) => {
        formDataToSend.append('express_photos', photo);
      });

      if (sampleListFile) {
        formDataToSend.append('sample_list_file', sampleListFile);
      }

      if (selectedSampleIds.length > 0) {
        formDataToSend.append('selected_sample_ids', JSON.stringify(selectedSampleIds));
      }

      if (additionalNotes.trim()) {
        formDataToSend.append('additional_notes', additionalNotes.trim());
      }

      if (reviewerInfo) {
        formDataToSend.append('reviewer_id', String(reviewerInfo.reviewer_id));
      }

      await api.post('/samples/receive', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('样本接收成功，已生成清点任务');

      setTimeout(() => {
        router.push('/samples/inventory');
      }, 1000);

    } catch (error: any) {
      if (error?.response?.status !== 401 && !error?.isAuthError) {
        toast.error('接收失败，请重试');
      }
      setSubmitting(false);
    }
  };

  const handleTemperatureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setTemperatureFile(e.target.files[0]);
    }
  };

  const handleExpressPhotosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setExpressPhotos(Array.from(e.target.files));
    }
  };

  const clinicalOrgs = organizations.filter(org => org.org_type === 'clinical');
  const transportOrgs = organizations.filter(org => org.org_type === 'transport');

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="p-6 md:p-8 space-y-8">

            {/* 第一部分：基础信息 */}
            <div>
              <h3 className="text-base font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                基础信息
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    临床机构/分中心 <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={formData.clinical_site}
                    onChange={(e) => setFormData({ ...formData, clinical_site: e.target.value })}
                    required
                    className="w-full"
                    disabled={!selectedProjectId}
                  >
                    <option value="">请选择临床机构</option>
                    {clinicalOrgs.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    运输单位/部门 <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={formData.transport_company}
                    onChange={(e) => setFormData({ ...formData, transport_company: e.target.value })}
                    required
                    className="w-full"
                    disabled={!selectedProjectId}
                  >
                    <option value="">请选择运输单位</option>
                    {transportOrgs.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </Select>
                </div>

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
                    required
                    className="w-full"
                    disabled={!selectedProjectId}
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
                        disabled={!selectedProjectId}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-100"></div>

            {/* 第二部分：温度监控 */}
            <div>
              <h3 className="text-base font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                温度监控
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    温度记录仪编号/序列号 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.temperature_monitor_id}
                    onChange={(e) => setFormData({ ...formData, temperature_monitor_id: e.target.value })}
                    placeholder="输入温度记录仪编号"
                    required
                    className="w-full"
                    disabled={!selectedProjectId}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    温度数据文件
                  </label>
                  <div className="flex items-center gap-3">
                    <label className={!selectedProjectId ? "cursor-not-allowed opacity-50" : "cursor-pointer"}>
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls,.txt,.pdf,.jpg,.jpeg,.png,.webp"
                        onChange={handleTemperatureFileChange}
                        className="hidden"
                        disabled={!selectedProjectId}
                      />
                      <div className="inline-flex items-center justify-center gap-x-2 rounded-lg border px-4 py-2 text-sm font-semibold border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 shadow-sm transition-colors cursor-pointer">
                        <CloudArrowUpIcon className="w-4 h-4 text-zinc-500" />
                        上传文件
                      </div>
                    </label>
                    {temperatureFile ? (
                      <div className="flex flex-col">
                        <Text className="text-sm font-medium text-zinc-900">{temperatureFile.name}</Text>
                        <Text className="text-xs text-zinc-500">{(temperatureFile.size / 1024).toFixed(1)} KB</Text>
                      </div>
                    ) : (
                      <Text className="text-sm text-zinc-500">支持 CSV、Excel、TXT、PDF 及图片格式</Text>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-100"></div>

            {/* 第三部分：样本信息 */}
            <div>
              <h3 className="text-base font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                样本信息
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    样本数量 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    value={formData.sample_count}
                    onChange={(e) => setFormData({ ...formData, sample_count: e.target.value })}
                    placeholder="输入样本数量"
                    required
                    className="w-full"
                    disabled={!selectedProjectId}
                  />
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
                    required
                    className="w-full"
                    disabled={!selectedProjectId}
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
                        disabled={!selectedProjectId}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    是否存在超温情况 <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={formData.is_over_temperature}
                    onChange={(e) => setFormData({ ...formData, is_over_temperature: e.target.value })}
                    required
                    className="w-full"
                    disabled={!selectedProjectId}
                  >
                    <option value="true">是</option>
                    <option value="false">否</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    暂存位置
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.storage_location}
                      onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                      placeholder="扫描冰箱条码或手动输入"
                      className="flex-1"
                      disabled={!selectedProjectId}
                    />
                    <Tooltip content="扫描条码">
                      <Button plain className="px-3" disabled={!selectedProjectId}>
                        <QrCodeIcon className="w-5 h-5" />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-100"></div>

            {/* 第四部分：样本清单上传与选择 */}
            <div>
              <h3 className="text-base font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                样本清单
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
                    上传样本清单
                  </label>
                  <SampleListUpload
                    onParseComplete={handleSampleListParsed}
                    disabled={!selectedProjectId}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
                    选择待接收样本
                  </label>
                  <div className="flex items-center gap-3">
                    <Button
                      plain
                      onClick={() => setSampleSelectionOpen(true)}
                      disabled={!selectedProjectId}
                    >
                      <DocumentPlusIcon className="w-4 h-4 mr-1" />
                      选择样本
                    </Button>
                    {selectedSampleIds.length > 0 && (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircleIcon className="w-4 h-4" />
                        <Text className="text-sm">已选择 {selectedSampleIds.length} 个样本</Text>
                      </div>
                    )}
                    {sampleCodesFromList.length > 0 && selectedSampleIds.length === 0 && (
                      <Text className="text-sm text-zinc-500">
                        清单包含 {sampleCodesFromList.length} 个样本编号，点击选择样本进行匹配
                      </Text>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-100"></div>

            {/* 第五部分：其他信息 */}
            <div>
              <h3 className="text-base font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                其他信息
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    快递单及其他照片
                  </label>
                  <div className="flex items-center gap-3">
                    <label className={!selectedProjectId ? "cursor-not-allowed opacity-50" : "cursor-pointer"}>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp"
                        multiple
                        onChange={handleExpressPhotosChange}
                        className="hidden"
                        disabled={!selectedProjectId}
                      />
                      <div className="inline-flex items-center justify-center gap-x-2 rounded-lg border px-4 py-2 text-sm font-semibold border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 shadow-sm transition-colors cursor-pointer">
                        <CloudArrowUpIcon className="w-4 h-4 text-zinc-500" />
                        上传照片
                      </div>
                    </label>
                    {expressPhotos.length > 0 ? (
                      <div className="flex flex-col">
                        <Text className="text-sm font-medium text-green-600">已选择 {expressPhotos.length} 个文件</Text>
                      </div>
                    ) : (
                      <Text className="text-sm text-zinc-500">支持 JPG, PNG, WEBP 等图片格式</Text>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    备注信息
                  </label>
                  <Textarea
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="输入其他需要记录的信息..."
                    rows={3}
                    disabled={!selectedProjectId}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-100"></div>

            {/* 第六部分：复核人验证 */}
            <div>
              <h3 className="text-base font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                复核人验证 <span className="text-red-500">*</span>
              </h3>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mb-4">
                <div className="flex items-start gap-2">
                  <ShieldCheckIcon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <Text className="text-sm font-medium text-blue-900">
                      双人复核要求
                    </Text>
                    <Text className="text-sm text-blue-700 mt-1">
                      样本接收需要另一位样本管理员进行复核确认，以确保操作的准确性和可追溯性。
                    </Text>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 p-3 bg-zinc-50 rounded-lg">
                  <UserCircleIcon className="h-5 w-5 text-zinc-500" />
                  <div>
                    <Text className="text-xs text-zinc-500">当前操作人</Text>
                    <Text className="text-sm font-medium text-zinc-900">{user?.full_name || user?.username || '-'}</Text>
                  </div>
                </div>

                {reviewerInfo ? (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    <div>
                      <Text className="text-xs text-green-600">复核人已验证</Text>
                      <Text className="text-sm font-medium text-green-900">{reviewerInfo.reviewer_name}</Text>
                    </div>
                    <Button plain onClick={clearReviewer} className="ml-2">
                      更换
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => setReviewerDialogOpen(true)}
                    disabled={!selectedProjectId}
                  >
                    <ShieldCheckIcon className="w-4 h-4 mr-1" />
                    验证复核人
                  </Button>
                )}
              </div>
            </div>

          </div>

          {/* 底部操作栏 */}
          <div className="bg-zinc-50 px-6 py-4 border-t border-zinc-200 flex items-center justify-end gap-3">
            <Button plain onClick={() => router.back()}>
              取消
            </Button>
            <Button
              onClick={handleReceive}
              disabled={submitting || !reviewerInfo}
              className="min-w-[120px]"
            >
              {submitting ? '提交中...' : '接收完成'}
            </Button>
          </div>
        </div>
      </div>

      {/* 样本选择对话框 */}
      <SampleSelectionDialog
        open={sampleSelectionOpen}
        onClose={setSampleSelectionOpen}
        projectId={selectedProjectId}
        sampleCodesFromList={sampleCodesFromList}
        selectedIds={selectedSampleIds}
        onSelectionChange={handleSampleSelectionChange}
      />

      {/* 复核人验证对话框 */}
      <ReviewerVerificationDialog
        open={reviewerDialogOpen}
        onClose={setReviewerDialogOpen}
        onVerified={handleReviewerVerified}
        currentUserName={user?.full_name || user?.username}
      />
    </AppLayout>
  );
}
