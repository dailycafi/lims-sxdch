import { useState, useEffect, useMemo } from 'react';
import { formatDate } from '@/lib/date-utils';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Textarea } from '@/components/textarea';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Heading } from '@/components/heading';
import { DescriptionList, DescriptionTerm, DescriptionDetails } from '@/components/description-list';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { Divider } from '@/components/divider';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { api, extractDetailMessage } from '@/lib/api';
import { ESignatureDialog } from '@/components/e-signature-dialog';
import { useAuthStore } from '@/store/auth';
import { useProjectStore } from '@/store/project';
import { Tabs } from '@/components/tabs';
import { 
  CogIcon, 
  DocumentTextIcon, 
  AdjustmentsHorizontalIcon,
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  PencilSquareIcon,
  MagnifyingGlassIcon,
  BeakerIcon,
  ClipboardDocumentListIcon,
  DocumentDuplicateIcon,
  CheckCircleIcon,
  LockClosedIcon,
  UserGroupIcon
} from '@heroicons/react/20/solid';
import { TagInput } from '@/components/tag-input';
import { TestGroupManager } from '@/components/test-group-manager';
import { Tooltip } from '@/components/tooltip';

const SLOT_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];

interface Project {
  id: number;
  sponsor_project_code: string;
  lab_project_code: string;
  sponsor_id: number;
  clinical_org_id: number;
  sponsor?: any;
  clinical_org?: any;
  sample_code_rule?: any;
  is_active: boolean;
  is_archived: boolean;
  created_at: string;
}

interface SampleCodeElement {
  id: string;
  name: string;
  label: string;
  number: string;
}

const sampleCodeElements: SampleCodeElement[] = [
  { id: 'sponsor_code', name: 'sponsor_code', label: '申办方项目编号', number: '①' },
  { id: 'lab_code', name: 'lab_code', label: '实验室项目编号', number: '②' },
  { id: 'clinic_code', name: 'clinic_code', label: '临床机构编号', number: '③' },
  { id: 'subject_id', name: 'subject_id', label: '受试者编号', number: '④' },
  { id: 'test_type', name: 'test_type', label: '检测类型', number: '⑤' },
  { id: 'sample_seq', name: 'sample_seq', label: '采血序号', number: '⑥' },
  { id: 'sample_time', name: 'sample_time', label: '采血时间', number: '⑦' },
  { id: 'cycle_group', name: 'cycle_group', label: '周期/组别', number: '⑧' },
  { id: 'sample_type', name: 'sample_type', label: '正份备份', number: '⑨' },
];

interface SampleType {
  id: number;
  category: string;
  cycle_group?: string;
  test_type?: string;
  code?: string;
  primary_count: number;
  backup_count: number;
  purpose?: string;
  transport_method?: string;
  status?: string;
  special_notes?: string;
}

interface ProjectOrganizationLink {
  id: number;
  organization_id: number;
  organization: any;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  notes?: string;
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [clinicalSampleTypes, setClinicalSampleTypes] = useState<SampleType[]>([]);
  const [qcSampleTypes, setQCSampleTypes] = useState<SampleType[]>([]);
  
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [configTab, setConfigTab] = useState('rules'); 
  
  const [slots, setSlots] = useState<string[]>([]);
  
  const [dictionaries, setDictionaries] = useState({
    cycles: [] as string[],
    test_types: [] as string[],
    primary_types: [] as string[],
    backup_types: [] as string[],
    clinic_codes: [] as string[],
  });
  
  // 全局参数中的选项
  const [globalOptions, setGlobalOptions] = useState({
    cycles: [] as string[],
    test_types: [] as string[],
    primary_codes: [] as string[],
    backup_codes: [] as string[],
    collection_points: [] as { code: string; name: string; time_description?: string }[],
  });
  
  // 选择数量（选前N个）
  const [selectedCounts, setSelectedCounts] = useState({
    cycles: 0,
    test_types: 0,
    primary_codes: 0,
    backup_codes: 0,
    subject_count: 0,
    collection_points: 0,
  });
  
  // 采血点和受试者编号弹窗
  const [isCollectionPointDialogOpen, setIsCollectionPointDialogOpen] = useState(false);
  const [isSubjectDialogOpen, setIsSubjectDialogOpen] = useState(false);
  const [collectionPointsConfig, setCollectionPointsConfig] = useState<string[]>([]);
  const [subjectConfig, setSubjectConfig] = useState({
    prefix: '',
    start: 1,
    count: 10,
  });
  
  const [isESignatureOpen, setIsESignatureOpen] = useState(false);
  const [pendingSaveRule, setPendingSaveRule] = useState<any | null>(null);
  const { user } = useAuthStore();
  const { removeProject, fetchProjects: refreshProjects } = useProjectStore();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteSignatureOpen, setIsDeleteSignatureOpen] = useState(false);
  
  const [auditReason, setAuditReason] = useState('');

  useEffect(() => {
    if (id) {
      fetchProject();
      fetchGlobalOptions();
    }
  }, [id]);

  useEffect(() => {
    if (isConfigDialogOpen && project) {
      initSlotsFromRule(project.sample_code_rule);
    }
  }, [isConfigDialogOpen, project]);
  
  // 获取全局参数中的选项
  const fetchGlobalOptions = async () => {
    try {
      const [sampleTypesRes, collectionPointsRes] = await Promise.all([
        api.get('/global-params/sample-types'),
        api.get('/global-params/collection-points').catch(() => ({ data: [] })),
      ]);
      const configs = sampleTypesRes.data;
      
      const cycles = new Set<string>();
      const testTypes = new Set<string>();
      const primaryCodes = new Set<string>();
      const backupCodes = new Set<string>();
      
      configs.forEach((config: any) => {
        if (config.category === 'clinical' || !config.category) {
          if (config.cycle_group) {
            config.cycle_group.split(',').forEach((c: string) => cycles.add(c.trim()));
          }
          if (config.test_type) {
            config.test_type.split(',').forEach((t: string) => testTypes.add(t.trim()));
          }
          if (config.primary_codes) {
            config.primary_codes.split(',').forEach((c: string) => primaryCodes.add(c.trim()));
          }
          if (config.backup_codes) {
            config.backup_codes.split(',').forEach((c: string) => backupCodes.add(c.trim()));
          }
        }
      });
      
      setGlobalOptions({
        cycles: Array.from(cycles),
        test_types: Array.from(testTypes),
        primary_codes: Array.from(primaryCodes),
        backup_codes: Array.from(backupCodes),
        collection_points: collectionPointsRes.data || [],
      });
    } catch (error) {
      console.error('Failed to fetch global options:', error);
    }
  };

  const initSlotsFromRule = (ruleStr: any) => {
    const rule = typeof ruleStr === 'string' ? JSON.parse(ruleStr) : ruleStr;
    if (rule && rule.elements && rule.order) {
      // 根据 order 对 elements 进行排序，确保顺序正确
      const newSlots = [...rule.elements].sort((a, b) => {
        const orderA = rule.order[a] !== undefined ? rule.order[a] : 999;
        const orderB = rule.order[b] !== undefined ? rule.order[b] : 999;
        return orderA - orderB;
      });
      setSlots(newSlots);
    } else {
      setSlots([]);
    }
    
    if (rule && rule.dictionaries) {
      setDictionaries({
        cycles: rule.dictionaries.cycles || [],
        test_types: rule.dictionaries.test_types || [],
        primary_types: rule.dictionaries.primary_types || [],
        backup_types: rule.dictionaries.backup_types || [],
        clinic_codes: rule.dictionaries.clinic_codes || [],
      });
    }
    
    // 加载选择数量配置
    if (rule && rule.selectedCounts) {
      setSelectedCounts({
        cycles: rule.selectedCounts.cycles || 0,
        test_types: rule.selectedCounts.test_types || 0,
        primary_codes: rule.selectedCounts.primary_codes || 0,
        backup_codes: rule.selectedCounts.backup_codes || 0,
        subject_count: rule.selectedCounts.subject_count || 0,
        collection_points: rule.selectedCounts.collection_points || 0,
      });
    }
    
    // 加载采血点配置
    if (rule && rule.collectionPoints) {
      setCollectionPointsConfig(rule.collectionPoints);
    }
    
    // 加载受试者编号配置
    if (rule && rule.subjectConfig) {
      setSubjectConfig(rule.subjectConfig);
    }
  };

  const fetchProject = async () => {
    try {
      const response = await api.get(`/projects/${id}`);
      const projectData = response.data;
      setProject(projectData);
      initSlotsFromRule(projectData.sample_code_rule);
      
      const sampleTypesRes = await api.get(`/global-params/sample-types?project_id=${id}`);
      const allSamples = sampleTypesRes.data as SampleType[];
      setClinicalSampleTypes(allSamples.filter(s => s.category === 'clinical'));
      setQCSampleTypes(allSamples.filter(s => s.category === 'qc_stability'));
      
    } catch (error) {
      console.error('Failed to fetch project details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCodeRule = async () => {
    const hasSlots = slots.some(s => !!s);
    const hasOptions = Object.values(dictionaries).some(arr => arr && arr.length > 0);
    const hasSelectedCounts = Object.values(selectedCounts).some(c => c > 0);

    if (!hasSlots && !hasOptions && !hasSelectedCounts) {
      toast.error('配置为空，请至少配置一项规则或选项');
      return;
    }

    const enabledElements = slots.filter(s => !!s);
    const orderMap: Record<string, number> = {};
    enabledElements.forEach((elementId, index) => {
      orderMap[elementId] = index;
    });

    // 根据选择数量生成实际使用的选项
    const actualDictionaries = {
      cycles: selectedCounts.cycles > 0 
        ? globalOptions.cycles.slice(0, selectedCounts.cycles) 
        : dictionaries.cycles,
      test_types: selectedCounts.test_types > 0 
        ? globalOptions.test_types.slice(0, selectedCounts.test_types) 
        : dictionaries.test_types,
      primary_types: selectedCounts.primary_codes > 0 
        ? globalOptions.primary_codes.slice(0, selectedCounts.primary_codes) 
        : dictionaries.primary_types,
      backup_types: selectedCounts.backup_codes > 0 
        ? globalOptions.backup_codes.slice(0, selectedCounts.backup_codes) 
        : dictionaries.backup_types,
      clinic_codes: dictionaries.clinic_codes,
      collection_points: selectedCounts.collection_points > 0
        ? globalOptions.collection_points.slice(0, selectedCounts.collection_points)
        : [],
    };

    const rule = {
      elements: enabledElements,
      order: orderMap,
      dictionaries: actualDictionaries,
      selectedCounts: selectedCounts,
      collectionPoints: selectedCounts.collection_points > 0
        ? globalOptions.collection_points.slice(0, selectedCounts.collection_points).map(p => `${p.code}:${p.name}`)
        : collectionPointsConfig,
      subjectConfig: subjectConfig,
    };
    setPendingSaveRule(rule);
    setIsESignatureOpen(true);
  };

  const handleESignatureConfirm = async (password: string, reasonText: string) => {
    if (!pendingSaveRule) return;
    try {
      await api.post('/auth/verify-signature', { password, purpose: 'update_sample_code_rule' });

      const payload = {
        sample_code_rule: pendingSaveRule,
        audit_reason: JSON.stringify({ reason: reasonText, password })
      };
      await api.put(`/projects/${id}/sample-code-rule`, payload);

      setIsConfigDialogOpen(false);
      setPendingSaveRule(null);
      setIsESignatureOpen(false);
      fetchProject();
      toast.success('样本编号规则及选项已更新');
    } catch (error: any) {
      if (error.response?.status === 401) {
        toast.error('密码错误，请重试');
      } else {
        toast.error('保存失败，请重试');
      }
    }
  };

  const handleSlotChange = (index: number, value: string) => {
    const newSlots = [...slots];
    newSlots[index] = value;
    setSlots(newSlots);
  };

  const handleAddSlot = () => {
    setSlots([...slots, '']);
  };

  const handleRemoveSlot = (index: number) => {
    const newSlots = [...slots];
    newSlots.splice(index, 1);
    setSlots(newSlots);
  };

  const generateVisualPreview = () => {
    return (
      <div className="font-mono text-xl tracking-wide">
        {slots.map((slot, index) => {
          if (!slot) return null;
          const isLast = index === slots.length - 1 || slots.slice(index + 1).every(s => !s);
          let example = '???';
          const element = sampleCodeElements.find(e => e.id === slot);
          if (element) {
              if (slot === 'sponsor_code') example = project?.sponsor_project_code || 'SPONSOR';
              else if (slot === 'lab_code') example = project?.lab_project_code || 'LAB';
              else example = element.label;
          }

          return (
            <span key={index} className="text-red-600 font-medium">
              {example}
              {!isLast && <span className="text-zinc-400 mx-1">-</span>}
            </span>
          );
        })}
        {(slots.length === 0 || slots.every(s => !s)) && (
          <span className="text-zinc-400 text-base italic">暂未配置规则，请点击下方按钮添加...</span>
        )}
      </div>
    );
  };

  const handleDeleteProject = async (password: string, reason: string) => {
    if (!project) return;
    setIsDeleting(true);
    try {
      // 先验证电子签名
      await api.post('/auth/verify-signature', { password, purpose: 'delete_project' });
      
      // 删除项目，附带理由
      await api.delete(`/projects/${project.id}`, {
        data: { reason, password }
      });
      toast.success('项目已删除');
      removeProject(project.id);
      await refreshProjects({ force: true });
      setIsDeleteSignatureOpen(false);
      setIsDeleteDialogOpen(false);
      router.push('/projects');
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('密码验证失败，请重试');
      }
      const message = extractDetailMessage(error?.response?.data) || '删除项目失败';
      throw new Error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const [isSampleTypeDialogOpen, setIsSampleTypeDialogOpen] = useState(false);
  const [editingSampleType, setEditingSampleType] = useState<SampleType | null>(null);
  const [sampleTypeForm, setSampleTypeForm] = useState({
    category: 'clinical',
    cycle_group: '',
    test_type: '',
    primary_count: 1,
    backup_count: 1,
    purpose: '',
    transport_method: '',
    status: '',
    special_notes: '',
  });

  const handleSampleTypeSubmit = async () => {
    try {
      const payload = { ...sampleTypeForm, project_id: parseInt(id as string) };
      if (editingSampleType) {
        if (!auditReason.trim()) {
          toast.error('请输入修改理由');
          return;
        }
        await api.put(`/global-params/sample-types/${editingSampleType.id}`, {
          ...payload,
          audit_reason: auditReason.trim()
        });
        toast.success('更新成功');
      } else {
        await api.post('/global-params/sample-types', payload);
        toast.success('创建成功');
      }
      setIsSampleTypeDialogOpen(false);
      setAuditReason('');
      fetchProject();
    } catch (error: any) {
      toast.error(extractDetailMessage(error.response?.data) || '操作失败');
    }
  };

  const deleteSampleType = async (stId: number) => {
    if (!confirm('确定要删除此配置吗？')) return;
    try {
      await api.delete(`/global-params/sample-types/${stId}`);
      toast.success('删除成功');
      fetchProject();
    } catch (error) {
      toast.error('删除失败');
    }
  };

  if (loading) return <AppLayout><div className="flex justify-center items-center h-64"><Text>加载中...</Text></div></AppLayout>;
  if (!project) return <AppLayout><div className="flex justify-center items-center h-64"><Text>项目不存在</Text></div></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Heading>项目详情</Heading>
              {project.is_archived && <Badge color="zinc">已归档</Badge>}
            </div>
            <div className="flex items-center gap-2">
              {user?.role === 'system_admin' && !project.is_archived && (
                <Button color="red" onClick={() => setIsDeleteDialogOpen(true)}>删除项目</Button>
              )}
              <Button onClick={() => router.back()} plain>返回</Button>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <DescriptionList>
              <div><DescriptionTerm>申办方项目编号</DescriptionTerm><DescriptionDetails>{project.sponsor_project_code}</DescriptionDetails></div>
              <div><DescriptionTerm>实验室项目编号</DescriptionTerm><DescriptionDetails>{project.lab_project_code}</DescriptionDetails></div>
              <div><DescriptionTerm>申办方</DescriptionTerm><DescriptionDetails>{project.sponsor?.name || '-'}</DescriptionDetails></div>
              <div><DescriptionTerm>临床机构</DescriptionTerm><DescriptionDetails>{project.clinical_org?.name || '-'}</DescriptionDetails></div>
              <div><DescriptionTerm>创建时间</DescriptionTerm><DescriptionDetails>{formatDate(project.created_at)}</DescriptionDetails></div>
              <div><DescriptionTerm>状态</DescriptionTerm><DescriptionDetails><Badge color={project.is_active ? 'green' : 'red'}>{project.is_active ? '活跃' : '停用'}</Badge></DescriptionDetails></div>
            </DescriptionList>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-zinc-200">
            <div className="flex items-center gap-2">
              <CogIcon className="h-5 w-5 text-zinc-400" />
              <Text className="font-medium">项目配置</Text>
            </div>
          </div>
          <div className="p-6 space-y-8">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Text className="font-medium">样本编号规则</Text>
                  <Text className="text-sm text-zinc-600 mt-1">配置样本编号的组成要素、顺序及可选项</Text>
                </div>
                <Button outline onClick={() => setIsConfigDialogOpen(true)} className="whitespace-nowrap flex-shrink-0">
                  <AdjustmentsHorizontalIcon />
                  配置规则
                </Button>
              </div>
              {project.sample_code_rule ? (
                <div className="bg-zinc-50 rounded-lg p-6 border border-zinc-200">
                  <div className="text-sm text-zinc-500 font-medium mb-2">编号预览：</div>
                  {generateVisualPreview()}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-8 text-sm mt-4">
                    {slots.map((slotId, index) => {
                      if (!slotId) return null;
                      const element = sampleCodeElements.find(e => e.id === slotId);
                      if (!element) return null;
                      return (
                        <div key={index} className="flex items-baseline gap-2">
                          <span className="font-bold text-red-600 w-4">{SLOT_LABELS[index]}</span>
                          <span className="text-zinc-700">{element.label}<span className="text-red-600 ml-1">{element.number}</span></span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 rounded-lg p-4 text-amber-800 text-sm">尚未配置样本编号规则，请先配置规则后才能生成样本编号</div>
              )}
            </div>

            <Divider />

            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Text className="font-medium">临床样本编号管理</Text>
                  <Text className="text-sm text-zinc-600 mt-1">生成临床样本编号、查看已生成的编号并打印标签</Text>
                </div>
                <div className="flex gap-3">
                  <Button outline onClick={() => {
                    router.push(`/projects/${id}/sample-codes?tab=result`);
                  }} disabled={!project.sample_code_rule} className="shadow-sm relative z-10">
                    <MagnifyingGlassIcon />
                    查看编号
                  </Button>
                  <Button color="dark" onClick={() => {
                    router.push(`/projects/${id}/sample-codes?tab=clinical`);
                  }} disabled={!project.sample_code_rule} className="shadow-sm relative z-10">
                    <DocumentTextIcon />
                    生成编号
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 临床试验信息 */}
        <div className="bg-white rounded-lg shadow mt-8">
          <div className="px-6 py-4 border-b border-zinc-200">
            <div className="flex items-center gap-2">
              <UserGroupIcon className="h-5 w-5 text-zinc-400" />
              <Text className="font-medium">临床试验信息</Text>
            </div>
          </div>
          <div className="p-6">
            <TestGroupManager projectId={project.id} isArchived={project.is_archived} />
          </div>
        </div>
      </div>

      <Dialog open={isConfigDialogOpen} onClose={setIsConfigDialogOpen} size="5xl">
        <DialogTitle>项目配置 - {project.lab_project_code}</DialogTitle>
        <DialogBody>
          <Tabs 
            tabs={[
              { key: 'rules', label: '编号结构', icon: AdjustmentsHorizontalIcon }, 
              { key: 'options', label: '选项配置', icon: CogIcon },
              { key: 'samples', label: '临床样本配置', icon: BeakerIcon }
            ]} 
            activeTab={configTab} 
            onChange={setConfigTab} 
            className="mb-6"
          />
          {configTab === 'rules' ? (
            <div className="space-y-8">
              <div className="space-y-3">
                <Text className="text-base font-semibold text-zinc-900">编号预览</Text>
                <div className="p-6 bg-zinc-50/80 rounded-2xl border border-zinc-200/60 flex items-center justify-center min-h-[100px] shadow-sm">{generateVisualPreview()}</div>
                <p className="text-xs text-zinc-500 px-1">* 编号将按照 A 到 G 的顺序自动拼接，未配置的位置将被自动忽略。</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <Text className="text-base font-semibold text-zinc-900">规则配置</Text>
                  <button onClick={() => setSlots([])} className="text-xs text-zinc-600 font-medium hover:text-zinc-900">重置所有</button>
                </div>
                <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden divide-y divide-zinc-100">
                  {slots.map((currentSlotValue, index) => {
                    const label = SLOT_LABELS[index] || String.fromCharCode(65 + index);
                    const currentElement = sampleCodeElements.find(e => e.id === currentSlotValue);
                    return (
                      <div key={index} className="group flex items-center p-4 hover:bg-zinc-50 transition-colors relative">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-zinc-100 text-zinc-500 flex items-center justify-center font-mono font-bold text-lg mr-4 group-hover:bg-white group-hover:shadow-sm transition-all">{label}</div>
                        <div className="flex-grow min-w-0">
                          <div className="relative">
                            <select 
                              value={currentSlotValue || ''} 
                              onChange={(e) => handleSlotChange(index, e.target.value)} 
                              className="w-full appearance-none bg-transparent py-2 pl-0 pr-8 text-base text-zinc-900 font-medium focus:outline-none cursor-pointer"
                            >
                              <option value="" disabled>请选择编号要素</option>
                              {sampleCodeElements.map(el => (
                                <option key={el.id} value={el.id}>{el.number} {el.label}</option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-400">
                              <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                            </div>
                          </div>
                          <div className="text-xs text-zinc-500 mt-0.5">{currentElement ? `已选择: ${currentElement.label}` : '请选择一个编号要素'}</div>
                        </div>
                        <button onClick={() => handleRemoveSlot(index)} className="ml-4 p-1 text-zinc-300 hover:text-red-500 transition-colors"><XMarkIcon className="w-5 h-5" /></button>
                      </div>
                    );
                  })}
                  
                  <div className="p-4 bg-zinc-50/50 flex justify-center">
                    <button 
                      onClick={handleAddSlot}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                    >
                      <PlusIcon className="w-4 h-4" />
                      添加位置
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : configTab === 'options' ? (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <Text className="text-sm text-blue-800">
                  从全局参数中选择该项目使用的选项数量。选择数字 N 表示使用全局配置中的前 N 个选项。
                </Text>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 左侧列 */}
                <div className="space-y-4">
                  {/* 周期/剂量组 */}
                  <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200">
                    <h4 className="font-medium text-zinc-900 mb-3 flex justify-between items-center">
                      <span>周期/剂量组</span>
                      <Badge color="blue">{globalOptions.cycles.length} 个可选</Badge>
                    </h4>
                    <div className="flex items-center gap-3 mb-3">
                      <Text className="text-sm text-zinc-600 flex-shrink-0">选择前</Text>
                      <Select
                        value={selectedCounts.cycles}
                        onChange={(e) => setSelectedCounts({...selectedCounts, cycles: parseInt(e.target.value)})}
                        className="w-20"
                      >
                        <option value={0}>不选</option>
                        {Array.from({ length: Math.min(10, globalOptions.cycles.length) }, (_, i) => (
                          <option key={i + 1} value={i + 1}>{i + 1}</option>
                        ))}
                      </Select>
                      <Text className="text-sm text-zinc-600">个</Text>
                    </div>
                    {selectedCounts.cycles > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-zinc-200">
                        {globalOptions.cycles.slice(0, selectedCounts.cycles).map((c, i) => (
                          <Badge key={i} color="blue">{c}</Badge>
                        ))}
                      </div>
                    )}
                    {globalOptions.cycles.length === 0 && (
                      <Text className="text-xs text-zinc-400">请先在全局参数中配置周期/剂量组</Text>
                    )}
                  </div>

                  {/* 检测类型 */}
                  <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200">
                    <h4 className="font-medium text-zinc-900 mb-3 flex justify-between items-center">
                      <span>检测类型</span>
                      <Badge color="green">{globalOptions.test_types.length} 个可选</Badge>
                    </h4>
                    <div className="flex items-center gap-3 mb-3">
                      <Text className="text-sm text-zinc-600 flex-shrink-0">选择前</Text>
                      <Select
                        value={selectedCounts.test_types}
                        onChange={(e) => setSelectedCounts({...selectedCounts, test_types: parseInt(e.target.value)})}
                        className="w-20"
                      >
                        <option value={0}>不选</option>
                        {Array.from({ length: Math.min(10, globalOptions.test_types.length) }, (_, i) => (
                          <option key={i + 1} value={i + 1}>{i + 1}</option>
                        ))}
                      </Select>
                      <Text className="text-sm text-zinc-600">个</Text>
                    </div>
                    {selectedCounts.test_types > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-zinc-200">
                        {globalOptions.test_types.slice(0, selectedCounts.test_types).map((t, i) => (
                          <Badge key={i} color="green">{t}</Badge>
                        ))}
                      </div>
                    )}
                    {globalOptions.test_types.length === 0 && (
                      <Text className="text-xs text-zinc-400">请先在全局参数中配置检测类型</Text>
                    )}
                  </div>

                  {/* 临床机构代码 - 保持手动输入 */}
                  <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200">
                    <h4 className="font-medium text-zinc-900 mb-2 flex justify-between">
                      <span>临床机构代码</span>
                      <span className="text-xs font-normal text-zinc-500">{dictionaries.clinic_codes.length} 个选项</span>
                    </h4>
                    <TagInput 
                      value={dictionaries.clinic_codes} 
                      onChange={(vals) => setDictionaries({...dictionaries, clinic_codes: vals})} 
                      placeholder="输入机构代码后回车 (如: 01, 02)"
                    />
                  </div>
                </div>

                {/* 右侧列 */}
                <div className="space-y-4">
                  {/* 正份代码 */}
                  <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200">
                    <h4 className="font-medium text-zinc-900 mb-3 flex justify-between items-center">
                      <span>正份代码</span>
                      <Badge color="purple">{globalOptions.primary_codes.length} 个可选</Badge>
                    </h4>
                    <div className="flex items-center gap-3 mb-3">
                      <Text className="text-sm text-zinc-600 flex-shrink-0">选择前</Text>
                      <Select
                        value={selectedCounts.primary_codes}
                        onChange={(e) => setSelectedCounts({...selectedCounts, primary_codes: parseInt(e.target.value)})}
                        className="w-20"
                      >
                        <option value={0}>不选</option>
                        {Array.from({ length: Math.min(10, globalOptions.primary_codes.length) }, (_, i) => (
                          <option key={i + 1} value={i + 1}>{i + 1}</option>
                        ))}
                      </Select>
                      <Text className="text-sm text-zinc-600">个</Text>
                    </div>
                    {selectedCounts.primary_codes > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-zinc-200">
                        {globalOptions.primary_codes.slice(0, selectedCounts.primary_codes).map((c, i) => (
                          <Badge key={i} color="purple">{c}</Badge>
                        ))}
                      </div>
                    )}
                    {globalOptions.primary_codes.length === 0 && (
                      <Text className="text-xs text-zinc-400">请先在全局参数中配置正份代码</Text>
                    )}
                  </div>

                  {/* 备份代码 */}
                  <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200">
                    <h4 className="font-medium text-zinc-900 mb-3 flex justify-between items-center">
                      <span>备份代码</span>
                      <Badge color="amber">{globalOptions.backup_codes.length} 个可选</Badge>
                    </h4>
                    <div className="flex items-center gap-3 mb-3">
                      <Text className="text-sm text-zinc-600 flex-shrink-0">选择前</Text>
                      <Select
                        value={selectedCounts.backup_codes}
                        onChange={(e) => setSelectedCounts({...selectedCounts, backup_codes: parseInt(e.target.value)})}
                        className="w-20"
                      >
                        <option value={0}>不选</option>
                        {Array.from({ length: Math.min(10, globalOptions.backup_codes.length) }, (_, i) => (
                          <option key={i + 1} value={i + 1}>{i + 1}</option>
                        ))}
                      </Select>
                      <Text className="text-sm text-zinc-600">个</Text>
                    </div>
                    {selectedCounts.backup_codes > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-zinc-200">
                        {globalOptions.backup_codes.slice(0, selectedCounts.backup_codes).map((c, i) => (
                          <Badge key={i} color="amber">{c}</Badge>
                        ))}
                      </div>
                    )}
                    {globalOptions.backup_codes.length === 0 && (
                      <Text className="text-xs text-zinc-400">请先在全局参数中配置备份代码</Text>
                    )}
                  </div>

                  {/* 采血点配置 */}
                  <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200">
                    <h4 className="font-medium text-zinc-900 mb-3 flex justify-between items-center">
                      <span>采血点/时间点</span>
                      <Badge color="cyan">{globalOptions.collection_points.length} 个可选</Badge>
                    </h4>
                    <div className="flex items-center gap-2 mb-3">
                      <Text className="text-sm text-zinc-600">选择前</Text>
                      <Select 
                        value={selectedCounts.collection_points}
                        onChange={(e) => setSelectedCounts({ ...selectedCounts, collection_points: parseInt(e.target.value) })}
                        className="w-20"
                      >
                        <option value={0}>0</option>
                        {Array.from({ length: Math.min(20, globalOptions.collection_points.length) }, (_, i) => (
                          <option key={i + 1} value={i + 1}>{i + 1}</option>
                        ))}
                      </Select>
                      <Text className="text-sm text-zinc-600">个采血点</Text>
                    </div>
                    {selectedCounts.collection_points > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-zinc-200">
                        {globalOptions.collection_points.slice(0, selectedCounts.collection_points).map((p, i) => (
                          <Badge key={i} color="cyan" title={p.time_description || p.name}>
                            {p.code}: {p.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {globalOptions.collection_points.length === 0 && (
                      <Text className="text-xs text-zinc-400">请先在全局参数中配置采血点</Text>
                    )}
                  </div>

                  {/* 受试者编号配置 */}
                  <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200">
                    <h4 className="font-medium text-zinc-900 mb-3 flex justify-between items-center">
                      <span>受试者编号</span>
                      <Button plain onClick={() => setIsSubjectDialogOpen(true)} className="text-xs">
                        <PlusIcon className="w-3 h-3 mr-1" />
                        配置
                      </Button>
                    </h4>
                    {subjectConfig.count > 0 ? (
                      <div className="text-sm text-zinc-600">
                        <div>前缀：<span className="font-medium text-zinc-900">{subjectConfig.prefix || '无'}</span></div>
                        <div>范围：<span className="font-medium text-zinc-900">{subjectConfig.start} - {subjectConfig.start + subjectConfig.count - 1}</span></div>
                        <div>数量：<span className="font-medium text-zinc-900">{subjectConfig.count} 个</span></div>
                      </div>
                    ) : (
                      <Text className="text-xs text-zinc-400">点击配置按钮设置受试者编号范围</Text>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {configTab === 'samples' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Text className="text-sm text-zinc-600">配置项目的临床样本类型组合</Text>
                <Button onClick={() => {
                  setEditingSampleType(null);
                  setSampleTypeForm({ category: 'clinical', cycle_group: '', test_type: '', primary_count: 1, backup_count: 1, purpose: '', transport_method: '', status: '', special_notes: '' });
                  setIsSampleTypeDialogOpen(true);
                }}>
                  <PlusIcon className="w-4 h-4 mr-1"/> 新增配置
                </Button>
              </div>
              <div className="border border-zinc-200 rounded-lg overflow-hidden">
                <Table bleed>
                  <TableHead>
                    <TableRow>
                      <TableHeader>周期/组别</TableHeader>
                      <TableHeader>检测类型</TableHeader>
                      <TableHeader>数量(正/备)</TableHeader>
                      <TableHeader>操作</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {clinicalSampleTypes.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-zinc-500">暂无临床样本配置</TableCell></TableRow>
                    ) : (
                      clinicalSampleTypes.map(st => (
                        <TableRow key={st.id}>
                          <TableCell>{st.cycle_group || '-'}</TableCell>
                          <TableCell>{st.test_type || '-'}</TableCell>
                          <TableCell>{st.primary_count} / {st.backup_count}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Tooltip content="编辑">
                                <Button plain onClick={() => {
                                  setEditingSampleType(st);
                                  setSampleTypeForm({ 
                                      category: st.category,
                                      cycle_group: st.cycle_group || '',
                                      test_type: st.test_type || '',
                                      primary_count: st.primary_count,
                                      backup_count: st.backup_count,
                                      purpose: st.purpose || '',
                                      transport_method: st.transport_method || '',
                                      status: st.status || '',
                                      special_notes: st.special_notes || '',
                                  });
                                  setIsSampleTypeDialogOpen(true);
                                }}>
                                  <PencilSquareIcon className="w-4 h-4"/>
                                </Button>
                              </Tooltip>
                              <Tooltip content="删除">
                                <Button plain onClick={() => deleteSampleType(st.id)}>
                                  <TrashIcon className="w-4 h-4 text-red-500"/>
                                </Button>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsConfigDialogOpen(false)}>取消</Button>
          <Button color="dark" onClick={handleSaveCodeRule} className="shadow-md">保存配置</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onClose={setIsDeleteDialogOpen}>
        <DialogTitle>删除项目</DialogTitle>
        <DialogDescription>删除后将无法恢复该项目及其配置。</DialogDescription>
        <DialogBody>
          <p className="text-sm text-zinc-600">请确认项目下没有任何样本或流程数据再执行删除操作。</p>
          <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm text-amber-800">
              ⚠️ 删除操作需要填写理由并进行电子签名确认，此操作将被永久记录在审计日志中。
            </p>
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsDeleteDialogOpen(false)}>取消</Button>
          <Button color="red" onClick={() => { setIsDeleteDialogOpen(false); setIsDeleteSignatureOpen(true); }}>
            继续删除
          </Button>
        </DialogActions>
      </Dialog>

      <ESignatureDialog
        open={isDeleteSignatureOpen}
        onClose={setIsDeleteSignatureOpen}
        onConfirm={handleDeleteProject}
        title="确认删除项目"
        description={`您正在删除项目「${project?.lab_project_code}」，此操作不可撤销。`}
        requireReason={true}
        reasonLabel="删除理由"
        reasonPlaceholder="请说明删除此项目的原因"
        actionType="delete"
      />

      <ESignatureDialog
        open={isESignatureOpen}
        onClose={setIsESignatureOpen}
        onConfirm={handleESignatureConfirm}
        requireReason={false}
        title="确认保存规则"
        description="请验证密码以保存样本编号规则配置。"
      />

      <Dialog open={isSampleTypeDialogOpen} onClose={setIsSampleTypeDialogOpen} size="xl">
        <DialogTitle>{editingSampleType ? '编辑样本配置' : '新增样本配置'}</DialogTitle>
        <DialogBody>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-700">周期/组别</label>
              <Input value={sampleTypeForm.cycle_group} onChange={e => setSampleTypeForm({...sampleTypeForm, cycle_group: e.target.value})} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-700">检测类型</label>
              <Input value={sampleTypeForm.test_type} onChange={e => setSampleTypeForm({...sampleTypeForm, test_type: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">正份数量</label>
              <Input type="number" value={sampleTypeForm.primary_count} onChange={e => setSampleTypeForm({...sampleTypeForm, primary_count: parseInt(e.target.value) || 1})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">备份数量</label>
              <Input type="number" value={sampleTypeForm.backup_count} onChange={e => setSampleTypeForm({...sampleTypeForm, backup_count: parseInt(e.target.value) || 1})} />
            </div>
            {editingSampleType && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-zinc-700">修改理由 *</label>
                <Textarea value={auditReason} onChange={e => setAuditReason(e.target.value)} placeholder="请输入修改理由" rows={2} required />
              </div>
            )}
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsSampleTypeDialogOpen(false)}>取消</Button>
          <Button color="dark" onClick={handleSampleTypeSubmit}>确定</Button>
        </DialogActions>
      </Dialog>

      {/* 采血点配置弹窗 */}
      <Dialog open={isCollectionPointDialogOpen} onClose={setIsCollectionPointDialogOpen}>
        <DialogTitle>配置采血点</DialogTitle>
        <DialogBody>
          <div className="space-y-4">
            <Text className="text-sm text-zinc-600">添加该项目的采血点编号，每行一个。</Text>
            <TagInput 
              value={collectionPointsConfig} 
              onChange={setCollectionPointsConfig} 
              placeholder="输入采血点编号后回车 (如: 01, 02, 03)"
            />
            <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
              <Text className="text-xs text-zinc-500 mb-2">已添加 {collectionPointsConfig.length} 个采血点：</Text>
              {collectionPointsConfig.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {collectionPointsConfig.map((p, i) => (
                    <Badge key={i} color="zinc">{p}</Badge>
                  ))}
                </div>
              ) : (
                <Text className="text-xs text-zinc-400">暂未添加采血点</Text>
              )}
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsCollectionPointDialogOpen(false)}>取消</Button>
          <Button color="dark" onClick={() => setIsCollectionPointDialogOpen(false)}>确定</Button>
        </DialogActions>
      </Dialog>

      {/* 受试者编号配置弹窗 */}
      <Dialog open={isSubjectDialogOpen} onClose={setIsSubjectDialogOpen}>
        <DialogTitle>配置受试者编号</DialogTitle>
        <DialogBody>
          <div className="space-y-4">
            <Text className="text-sm text-zinc-600">设置受试者编号的生成规则。</Text>
            
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">编号前缀（可选）</label>
              <Input 
                value={subjectConfig.prefix} 
                onChange={(e) => setSubjectConfig({...subjectConfig, prefix: e.target.value})}
                placeholder="如：S、C101 等"
              />
              <Text className="text-xs text-zinc-500 mt-1">前缀会添加在编号前面，如 S001、C101-001</Text>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">起始编号</label>
                <Input 
                  type="number"
                  value={subjectConfig.start} 
                  onChange={(e) => setSubjectConfig({...subjectConfig, start: parseInt(e.target.value) || 1})}
                  min={1}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">数量</label>
                <Select
                  value={subjectConfig.count}
                  onChange={(e) => setSubjectConfig({...subjectConfig, count: parseInt(e.target.value)})}
                >
                  <option value={0}>不设置</option>
                  {Array.from({ length: 20 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </Select>
              </div>
            </div>

            {subjectConfig.count > 0 && (
              <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                <Text className="text-xs text-zinc-500 mb-2">预览生成的受试者编号：</Text>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: Math.min(subjectConfig.count, 10) }, (_, i) => {
                    const num = String(subjectConfig.start + i).padStart(3, '0');
                    return (
                      <Badge key={i} color="blue">
                        {subjectConfig.prefix ? `${subjectConfig.prefix}-${num}` : num}
                      </Badge>
                    );
                  })}
                  {subjectConfig.count > 10 && (
                    <Badge color="zinc">...共 {subjectConfig.count} 个</Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsSubjectDialogOpen(false)}>取消</Button>
          <Button color="dark" onClick={() => setIsSubjectDialogOpen(false)}>确定</Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
