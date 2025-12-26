import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { api } from '@/lib/api';
import { 
  CloudArrowUpIcon,
  QrCodeIcon,
  InformationCircleIcon
} from '@heroicons/react/20/solid';
import { toast } from 'react-hot-toast';
import { GlobalParamsService } from '@/services';
import { useProjectStore } from '@/store/project';

export default function SampleReceivePage() {
  const router = useRouter();
  const {
    projects,
    selectedProjectId,
    fetchProjects: fetchProjectList,
  } = useProjectStore();
  
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [temperatureFile, setTemperatureFile] = useState<File | null>(null);
  const [expressPhotos, setExpressPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    clinical_site: '',
    transport_company: '',
    transport_method: '',
    temperature_monitor_id: '',
    is_over_temperature: 'false',
    sample_count: '',
    sample_status: '',
    storage_location: '',
  });

  // 获取当前选中的项目信息
  const currentProject = projects.find(p => p.id === selectedProjectId);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (projects.length === 0) {
      fetchProjectList().catch((error: any) => {
        if (error?.response?.status !== 401 && !error?.isAuthError) {
          console.error('Failed to fetch projects:', error);
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
        console.error('Failed to fetch organizations:', error);
      }
    }
  };

  // 验证表单
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
    return true;
  };

  const handleReceive = async () => {
    if (!validateForm()) {
      return;
    }
    
    setSubmitting(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('project_id', String(selectedProjectId));
      formDataToSend.append('clinical_org_id', formData.clinical_site);
      formDataToSend.append('transport_org_id', formData.transport_company);
      formDataToSend.append('transport_method', formData.transport_method);
      formDataToSend.append('temperature_monitor_id', formData.temperature_monitor_id);
      formDataToSend.append('is_over_temperature', formData.is_over_temperature);
      formDataToSend.append('sample_count', formData.sample_count);
      formDataToSend.append('sample_status', formData.sample_status);
      formDataToSend.append('storage_location', formData.storage_location);
      
      if (temperatureFile) {
        formDataToSend.append('temperature_file', temperatureFile);
      }
      
      expressPhotos.forEach((photo) => {
        formDataToSend.append('express_photos', photo);
      });

      await api.post('/samples/receive', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      toast.success('样本接收成功，已生成清点任务');
      
      // 延迟跳转，让用户看清提示
      setTimeout(() => {
        router.push('/samples/inventory');
      }, 1000);
      
    } catch (error: any) {
      if (error?.response?.status !== 401 && !error?.isAuthError) {
        console.error('Failed to receive samples:', error);
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
        {/* 页面标题 */}
        <div className="mb-6">
            <Heading>样本接收</Heading>
        </div>

        {/* 表单主体 */}
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
                  onChange={(e) => setFormData({ ...formData, transport_method: e.target.value })}
                  required
                    className="w-full"
                    disabled={!selectedProjectId}
                >
                  <option value="">请选择运输方式</option>
                  <option value="dry_ice">干冰</option>
                  <option value="ice_pack">冰袋</option>
                  <option value="room_temp">室温</option>
                  <option value="other">其它</option>
                </Select>
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
                      accept=".csv,.xlsx,.xls,.txt,.pdf"
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
                    <Text className="text-sm text-zinc-500">支持 CSV, Excel, TXT, PDF</Text>
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
                  onChange={(e) => setFormData({ ...formData, sample_status: e.target.value })}
                  required
                    className="w-full"
                    disabled={!selectedProjectId}
                >
                  <option value="">请选择样本状态</option>
                  <option value="frozen">冰冻</option>
                  <option value="partially_thawed">部分融化</option>
                  <option value="completely_thawed">完成融化</option>
                  <option value="other">其它</option>
                </Select>
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
                    <Button plain className="px-3" disabled={!selectedProjectId}>
                      <QrCodeIcon className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  快递单及其他照片
                </label>
                  <div className="flex items-center gap-3">
                    <label className={!selectedProjectId ? "cursor-not-allowed opacity-50" : "cursor-pointer"}>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png"
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
                    <Text className="text-sm text-zinc-500">支持 JPG, PNG 格式</Text>
                  )}
                </div>
              </div>
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
              disabled={submitting}
              className="min-w-[120px]"
          >
              {submitting ? '提交中...' : '接收完成'}
          </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
