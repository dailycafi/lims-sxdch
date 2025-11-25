import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Checkbox } from '@/components/checkbox';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Heading } from '@/components/heading';
import { DescriptionList, DescriptionTerm, DescriptionDetails } from '@/components/description-list';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { Divider } from '@/components/divider';
import { api } from '@/lib/api';
import { ESignatureDialog } from '@/components/e-signature-dialog';
import { useAuthStore } from '@/store/auth';
import { useProjectStore } from '@/store/project';
import { 
  CogIcon, 
  DocumentTextIcon, 
  PrinterIcon, 
  ArrowUpTrayIcon,
  CheckCircleIcon,
  AdjustmentsHorizontalIcon,
  XMarkIcon
} from '@heroicons/react/20/solid';
import JsBarcode from 'jsbarcode';

const SLOT_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

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
  { id: 'lab_code', name: 'lab_code', label: '临床试验研究室项目编号', number: '②' },
  { id: 'clinic_code', name: 'clinic_code', label: '临床机构编号', number: '③' },
  { id: 'subject_id', name: 'subject_id', label: '受试者编号', number: '④' },
  { id: 'test_type', name: 'test_type', label: '检测类型', number: '⑤' },
  { id: 'sample_seq', name: 'sample_seq', label: '采血序号', number: '⑥' },
  { id: 'sample_time', name: 'sample_time', label: '采血时间', number: '⑦' },
  { id: 'cycle_group', name: 'cycle_group', label: '周期/组别', number: '⑧' },
  { id: 'sample_type', name: 'sample_type', label: '正份备份', number: '⑨' },
];

// 定义每个插槽允许选择的要素 ID 列表
const SLOT_ALLOWED_ELEMENTS: Record<number, string[]> = {
  0: ['sponsor_code', 'lab_code'], // A: ①/②
  1: ['clinic_code'],              // B: ③
  2: ['subject_id'],               // C: ④
  3: ['test_type'],                // D: ⑤
  4: ['sample_seq', 'sample_time'],// E: ⑥/⑦
  5: ['cycle_group'],              // F: ⑧
  6: ['sample_type'],              // G: ⑨
};

export default function ProjectDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isBatchGenerateDialogOpen, setIsBatchGenerateDialogOpen] = useState(false);
  
  // 新的插槽状态，长度为7 (A-G)
  const [slots, setSlots] = useState<(string | null)[]>(Array(7).fill(null));
  
  const [auditReason, setAuditReason] = useState('');
  const [isESignatureOpen, setIsESignatureOpen] = useState(false);
  const [pendingSaveRule, setPendingSaveRule] = useState<any | null>(null);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [isGeneratingCodes, setIsGeneratingCodes] = useState(false);
  const { user } = useAuthStore();
  const { removeProject, fetchProjects: refreshProjects } = useProjectStore();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // 批量生成表单
  const [batchForm, setBatchForm] = useState({
    cycles: [] as string[],
    testTypes: [] as string[],
    primary: [] as string[],
    backup: [] as string[],
    subjects: '' as string,
    sampleSeqs: '' as string,
    clinicCodes: '' as string,
  });

  // 稳定性及质控样本
  const [stabilityQCParams, setStabilityQCParams] = useState({
    sample_category: '',
    code: '',
    quantity: 0,
    start_number: 1
  });

  useEffect(() => {
    if (id) {
      fetchProject();
    }
  }, [id]);

  useEffect(() => {
    if (!isBatchGenerateDialogOpen) {
      setGeneratedCodes([]);
    }
  }, [isBatchGenerateDialogOpen]);

  // 当打开配置弹窗时，重新根据项目规则初始化 slots，防止未保存的修改残留
  useEffect(() => {
    if (isConfigDialogOpen && project) {
      initSlotsFromRule(project.sample_code_rule);
    }
  }, [isConfigDialogOpen, project]);

  const initSlotsFromRule = (rule: any) => {
    const newSlots = Array(7).fill(null);
    if (rule && rule.elements && rule.order) {
      rule.elements.forEach((elementId: string) => {
        const position = rule.order[elementId];
        if (position !== undefined && position < 7) {
          newSlots[position] = elementId;
        }
      });
    }
    setSlots(newSlots);
  };

  const fetchProject = async () => {
    try {
      const response = await api.get(`/projects/${id}`);
      setProject(response.data);
      // 初始化 slots
      initSlotsFromRule(response.data.sample_code_rule);
    } catch (error) {
      console.error('Failed to fetch project:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCodeRule = async () => {
    // 校验：必须配置至少一个插槽
    if (!slots.some(s => s !== null)) {
      toast.error('请至少配置一项编号规则');
      return;
    }

    const enabledElements = slots.filter(s => s !== null) as string[];
    const orderMap: Record<string, number> = {};
    
    slots.forEach((elementId, index) => {
      if (elementId) {
        orderMap[elementId] = index;
      }
    });

    const rule = {
      elements: enabledElements,
      order: orderMap,
    };
    setPendingSaveRule(rule);
    setIsESignatureOpen(true);
  };

  const handleESignatureConfirm = async (password: string, reasonText: string) => {
    if (!pendingSaveRule) return;
    try {
      // 先验证电子签名
      await api.post('/auth/verify-signature', { password, purpose: 'update_sample_code_rule' });

      // 提交规则，携带密码（后端做兼容校验）
      const payload = {
        sample_code_rule: pendingSaveRule,
        audit_reason: JSON.stringify({ reason: auditReason || reasonText, password })
      };
      await api.put(`/projects/${id}/sample-code-rule`, payload);

      setIsConfigDialogOpen(false);
      setAuditReason('');
      setPendingSaveRule(null);
      setIsESignatureOpen(false);
      fetchProject();
      toast.success('样本编号规则已更新');
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('密码错误，请重试');
      }
      throw new Error('保存失败，请重试');
    }
  };

  const handleSlotChange = (index: number, value: string) => {
    const newSlots = [...slots];
    newSlots[index] = value === '' ? null : value;
    setSlots(newSlots);
  };

  const parseCommaSeparatedList = (value: string) =>
    value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);

  const parseSeqTimePairs = (input: string) => {
    return input
      .split(',')
      .map(segment => segment.trim())
      .filter(Boolean)
      .map(pair => {
        const [seq = '', time = ''] = pair.split('/');
        return {
          seq: seq.trim(),
          time: time.trim(),
        };
      })
      .filter(item => item.seq || item.time);
  };

  const generateBarcodeDataUrl = (text: string) => {
    const canvas = document.createElement('canvas');
    try {
      JsBarcode(canvas, text, {
        format: "CODE128",
        width: 1.5,
        height: 40,
        displayValue: true,
        fontSize: 14,
        margin: 0
      });
      return canvas.toDataURL('image/png');
    } catch (e) {
      console.error('Barcode generation failed for', text, e);
      return '';
    }
  };

  const triggerPrint = (codes: string[], mode: 'list' | 'label' = 'list') => {
    if (typeof window === 'undefined') {
      return;
    }

    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) {
      toast.error('浏览器阻止了打印窗口，请允许弹窗后重试');
      return;
    }

    const generatedAt = new Date().toLocaleString('zh-CN');
    const projectLabel = project?.lab_project_code || project?.sponsor_project_code || '项目';
    
    let content = '';
    if (mode === 'label') {
      const barcodes = codes.map(code => ({ code, src: generateBarcodeDataUrl(code) }));
      content = `
        <div class="labels">
          ${barcodes.map(item => `
            <div class="label">
              <img src="${item.src}" alt="${item.code}" />
            </div>
          `).join('')}
        </div>
      `;
    } else {
      content = `
        <h1>样本编号列表</h1>
        <p>项目：${projectLabel} | 生成时间：${generatedAt}</p>
        <ul>
          ${codes.map(code => `<li>${code}</li>`).join('')}
        </ul>
      `;
    }

    printWindow.document.write(`<!DOCTYPE html>
      <html lang="zh-CN">
        <head>
          <meta charSet="utf-8" />
          <title>样本编号打印</title>
          <style>
            body { font-family: 'SF Pro SC', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif; padding: 24px; }
            h1 { margin-bottom: 8px; }
            p { margin-bottom: 16px; color: #4b5563; }
            
            /* List Styles */
            ul { columns: 2; column-gap: 32px; padding: 0; list-style: none; }
            li { margin-bottom: 8px; font-size: 14px; }
            
            /* Label Styles */
            .labels { 
              display: grid; 
              grid-template-columns: repeat(auto-fill, 50mm); 
              gap: 5mm; 
            }
            .label {
              width: 50mm;
              height: 30mm;
              border: 1px dashed #ccc; /* Preview border */
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 2mm;
              box-sizing: border-box;
              page-break-inside: avoid;
              }
            .label img {
              max-width: 100%;
              max-height: 100%;
            }

            @media print {
              body { padding: 0; }
              ul { columns: 3; }
              .label { border: none; } /* Remove border for print */
            }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>`);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const handleGenerateSampleCodes = async (mode: 'preview' | 'print' | 'print_label' = 'preview') => {
    if (!project) {
      toast.error('项目信息尚未加载完成');
      return;
    }

    const subjects = parseCommaSeparatedList(batchForm.subjects);
    const clinicCodes = parseCommaSeparatedList(batchForm.clinicCodes);
    const seqTimePairs = parseSeqTimePairs(batchForm.sampleSeqs);

    const payload: Record<string, any> = {
      cycles: batchForm.cycles.length ? batchForm.cycles : undefined,
      test_types: batchForm.testTypes.length ? batchForm.testTypes : undefined,
      primary: batchForm.primary.length ? batchForm.primary : undefined,
      backup: batchForm.backup.length ? batchForm.backup : undefined,
      subjects: subjects.length ? subjects : undefined,
      clinic_codes: clinicCodes.length ? clinicCodes : undefined,
      seq_time_pairs: seqTimePairs.length ? seqTimePairs : undefined,
    };

    setIsGeneratingCodes(true);
    try {
      const response = await api.post(`/projects/${id}/generate-sample-codes`, payload);
      const codes: string[] = response.data?.sample_codes || [];
      setGeneratedCodes(codes);

      const successMessage = response.data?.message || `成功生成 ${codes.length} 个样本编号`;
      toast.success(successMessage);

      if (mode === 'print' && codes.length > 0) {
        triggerPrint(codes, 'list');
      } else if (mode === 'print_label' && codes.length > 0) {
        triggerPrint(codes, 'label');
      }
    } catch (error) {
      console.error('生成样本编号失败:', error);
      toast.error('生成样本编号失败，请稍后重试');
    } finally {
      setIsGeneratingCodes(false);
    }
  };

  const handleGenerateStabilityQCCodes = async () => {
    try {
      const response = await api.post(`/projects/${id}/generate-stability-qc-codes`, stabilityQCParams);
      
      const categoryLabel = stabilityQCParams.sample_category === 'STB' ? '稳定性' : '质控';
      toast.success(`成功生成 ${response.data.count} 个${categoryLabel}样本编号`);
      console.log('生成的编号:', response.data.sample_codes);
      
      // 重置表单
      setStabilityQCParams({
        sample_category: '',
        code: '',
        quantity: 0,
        start_number: 1
      });
    } catch (error) {
      console.error('生成失败:', error);
      toast.error('生成稳定性/质控样本编号失败，请稍后重试');
    }
  };

  // 获取示例值
  const getExampleValue = (elementId: string) => {
    switch (elementId) {
      case 'sponsor_code': return project?.sponsor_project_code || 'SPONSOR';
      case 'lab_code': return project?.lab_project_code || 'LAB';
      case 'clinic_code': return 'CHH';
      case 'subject_id': return '004';
      case 'test_type': return 'PK';
      case 'sample_seq': return '01';
      case 'sample_time': return '2h';
      case 'cycle_group': return 'A';
      case 'sample_type': return 'a1';
      default: return '???';
    }
  };

  const generateVisualPreview = () => {
    return (
      <div className="font-mono text-xl tracking-wide">
        {slots.map((slot, index) => {
          if (!slot) return null;
          const isLast = slots.slice(index + 1).every(s => s === null);
          return (
            <span key={index} className="text-red-600 font-medium">
              {getExampleValue(slot)}
              {!isLast && <span className="text-zinc-400 mx-1">-</span>}
            </span>
          );
        })}
        {slots.every(s => s === null) && (
          <span className="text-zinc-400 text-base italic">暂未配置规则，请在下方选择...</span>
        )}
      </div>
    );
  };

  const canDeleteProject = user?.role === 'system_admin';

  const handleDeleteProject = async () => {
    if (!project) {
      return;
    }
    setIsDeleting(true);
    try {
      await api.delete(`/projects/${project.id}`);
      toast.success('项目已删除');
      removeProject(project.id);
      await refreshProjects({ force: true });
      setIsDeleteDialogOpen(false);
      router.push('/projects');
    } catch (error: any) {
      const message = error?.response?.data?.detail || '删除项目失败';
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-64">
          <Text>加载中...</Text>
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-64">
          <Text>项目不存在</Text>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        {/* 项目基本信息 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Heading>项目详情</Heading>
              {project.is_archived && (
                <Badge color="zinc">已归档</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canDeleteProject && !project.is_archived && (
                <Button color="red" onClick={() => setIsDeleteDialogOpen(true)}>
                  删除项目
                </Button>
              )}
              <Button onClick={() => router.back()} plain>
                返回
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <DescriptionList>
              <div>
                <DescriptionTerm>申办方项目编号</DescriptionTerm>
                <DescriptionDetails>{project.sponsor_project_code}</DescriptionDetails>
              </div>
              <div>
                <DescriptionTerm>实验室项目编号</DescriptionTerm>
                <DescriptionDetails>{project.lab_project_code}</DescriptionDetails>
              </div>
              <div>
                <DescriptionTerm>申办方</DescriptionTerm>
                <DescriptionDetails>{project.sponsor?.name || '-'}</DescriptionDetails>
              </div>
              <div>
                <DescriptionTerm>临床机构</DescriptionTerm>
                <DescriptionDetails>{project.clinical_org?.name || '-'}</DescriptionDetails>
              </div>
              <div>
                <DescriptionTerm>创建时间</DescriptionTerm>
                <DescriptionDetails>
                  {new Date(project.created_at).toLocaleDateString('zh-CN')}
                </DescriptionDetails>
              </div>
              <div>
                <DescriptionTerm>状态</DescriptionTerm>
                <DescriptionDetails>
                  <Badge color={project.is_active ? 'green' : 'red'}>
                    {project.is_active ? '活跃' : '停用'}
                  </Badge>
                </DescriptionDetails>
              </div>
            </DescriptionList>
          </div>
        </div>

        {/* 项目配置 */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-zinc-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CogIcon className="h-5 w-5 text-zinc-400" />
                  <Text className="font-medium">项目配置</Text>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-8">
              {/* 样本编号规则 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Text className="font-medium">样本编号规则</Text>
                    <Text className="text-sm text-zinc-600 mt-1">
                      配置样本编号的组成要素和顺序
                    </Text>
                  </div>
                  <Button outline onClick={() => setIsConfigDialogOpen(true)} className="whitespace-nowrap flex-shrink-0">
                    <AdjustmentsHorizontalIcon />
                    配置规则
                  </Button>
                </div>
                
                {project.sample_code_rule ? (
                  <div className="bg-zinc-50 rounded-lg p-6 border border-zinc-200">
                    <div className="space-y-4">
                      <div>
                        <Text className="text-sm text-zinc-500 font-medium mb-2">编号预览：</Text>
                        {generateVisualPreview()}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-8 text-sm">
                        {slots.map((slotId, index) => {
                          if (!slotId) return null;
                          const element = sampleCodeElements.find(e => e.id === slotId);
                          if (!element) return null;
                          return (
                            <div key={index} className="flex items-baseline gap-2">
                              <span className="font-bold text-red-600 w-4">{SLOT_LABELS[index]}</span>
                              <span className="text-zinc-700">
                                {element.label}
                                <span className="text-red-600 ml-1">{element.number}</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 rounded-lg p-4">
                    <Text className="text-sm text-amber-800">
                      尚未配置样本编号规则，请先配置规则后才能生成样本编号
                    </Text>
                  </div>
                )}
              </div>

              <Divider />

              {/* 批量生成样本编号 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Text className="font-medium">批量生成样本编号</Text>
                    <Text className="text-sm text-zinc-600 mt-1">
                      根据配置的规则批量生成样本编号并打印标签
                    </Text>
                  </div>
                  <Button 
                    color="dark"
                    onClick={() => setIsBatchGenerateDialogOpen(true)}
                    disabled={!project.sample_code_rule}
                    className="whitespace-nowrap flex-shrink-0"
                  >
                    <DocumentTextIcon />
                    生成编号
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 配置样本编号规则对话框 - 视觉化重构版 */}
      <Dialog open={isConfigDialogOpen} onClose={setIsConfigDialogOpen} size="3xl">
        <DialogTitle>配置样本编号规则</DialogTitle>
        <DialogDescription>
          样本编号规则配置，下拉选择每一位的内容
        </DialogDescription>
        <DialogBody>
          <div className="space-y-8">
            
            {/* 预览区域 - 优化视觉 */}
            <div className="space-y-3">
              <Text className="text-base font-semibold text-zinc-900">编号预览</Text>
              <div className="p-6 bg-zinc-50/80 backdrop-blur-sm rounded-2xl border border-zinc-200/60 flex items-center justify-center min-h-[100px] shadow-sm">
                {generateVisualPreview()}
              </div>
              <p className="text-xs text-zinc-500 px-1">
                * 编号将按照 A 到 G 的顺序自动拼接，未配置的位置将被自动忽略。
              </p>
            </div>

            {/* 配置列表区域 - iOS Settings 风格 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <Text className="text-base font-semibold text-zinc-900">规则配置</Text>
                <button 
                  onClick={() => setSlots(Array(7).fill(null))}
                  className="text-xs text-blue-600 font-medium hover:text-blue-700 transition-colors"
                >
                  重置所有
                </button>
              </div>
              <p className="text-xs text-zinc-500 px-1 mb-2">
                根据标准规范，每个位置仅支持特定的编号要素。
              </p>
              
              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden divide-y divide-zinc-100">
                {SLOT_LABELS.map((label, index) => {
                  const currentSlotValue = slots[index];
                  const currentElement = sampleCodeElements.find(e => e.id === currentSlotValue);
                  
                  return (
                    <div key={label} className="group flex items-center p-4 hover:bg-zinc-50 transition-colors relative">
                      {/* 左侧：位置标识 */}
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-zinc-100 text-zinc-500 flex items-center justify-center font-mono font-bold text-lg mr-4 group-hover:bg-white group-hover:shadow-sm transition-all">
                        {label}
                      </div>
                      
                      {/* 中间：选择器 */}
                      <div className="flex-grow min-w-0">
                        <div className="relative">
                          <select
                            value={currentSlotValue || ''}
                            onChange={(e) => handleSlotChange(index, e.target.value)}
                            className="w-full appearance-none bg-transparent py-2 pl-0 pr-8 text-base text-zinc-900 font-medium focus:outline-none cursor-pointer"
                          >
                            <option value="">未配置 (跳过)</option>
                            <optgroup label="该位置可用选项">
                              {sampleCodeElements
                                .filter(el => SLOT_ALLOWED_ELEMENTS[index]?.includes(el.id))
                                .map(el => (
                                  <option key={el.id} value={el.id}>
                                    {el.number} {el.label}
                                  </option>
                              ))}
                            </optgroup>
                          </select>
                          {/* 自定义下拉箭头 */}
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-400">
                            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                          </div>
                        </div>
                        {/* 描述文本 */}
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {currentElement ? `已选择: ${currentElement.label}` : '该位置将不显示任何内容'}
                        </div>
                      </div>

                      {/* 右侧：清除按钮 (仅当有值时显示) */}
                      {currentSlotValue && (
                        <button 
                          onClick={() => handleSlotChange(index, '')}
                          className="ml-4 p-1 text-zinc-300 hover:text-red-500 transition-colors"
                          title="清除该位置"
                        >
                          <XMarkIcon className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsConfigDialogOpen(false)}>
            取消
          </Button>
          <Button 
            color="dark"
            onClick={handleSaveCodeRule}
            disabled={false}
          >
            保存配置
          </Button>
        </DialogActions>
      </Dialog>

      {/* 电子签名对话框 */}
      <ESignatureDialog
        open={isESignatureOpen}
        onClose={setIsESignatureOpen}
        onConfirm={handleESignatureConfirm}
        title="保存样本编号规则"
        description="该操作较为敏感，需要进行电子签名验证。"
        requireReason={false}
        actionType="approve"
      />

      {/* 批量生成样本编号对话框 */}
      <Dialog open={isBatchGenerateDialogOpen} onClose={setIsBatchGenerateDialogOpen} size="xl">
        <DialogTitle>批量生成样本编号</DialogTitle>
        <DialogDescription>
          根据项目配置的编号规则批量生成样本编号
        </DialogDescription>
        <DialogBody>
          <div className="space-y-6">
            {/* 临床样本 */}
            <div>
              <Text className="font-medium mb-4">临床样本</Text>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    周期/组别（可多选）
                  </label>
                  <Input 
                    placeholder="如：A,B,C 或 第1期,第2期"
                    value={batchForm.cycles.join(',')}
                    onChange={(e) => setBatchForm({...batchForm, cycles: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    检测类型（可多选）
                  </label>
                  <Input 
                    placeholder="如：PK,PD 或 血清,血浆"
                    value={batchForm.testTypes.join(',')}
                    onChange={(e) => setBatchForm({...batchForm, testTypes: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    正份（可多选）
                  </label>
                  <Input 
                    placeholder="如：a1,a2"
                    value={batchForm.primary.join(',')}
                    onChange={(e) => setBatchForm({...batchForm, primary: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    备份（可多选）
                  </label>
                  <Input 
                    placeholder="如：b1,b2"
                    value={batchForm.backup.join(',')}
                    onChange={(e) => setBatchForm({...batchForm, backup: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    临床机构编号（可选，逗号分隔）
                  </label>
                  <Input 
                    placeholder="如：01,02,03"
                    value={batchForm.clinicCodes}
                    onChange={(e) => setBatchForm({...batchForm, clinicCodes: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    受试者编号
                  </label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="输入编号，多个用逗号分隔" 
                      className="flex-1"
                      value={batchForm.subjects}
                      onChange={(e) => setBatchForm({...batchForm, subjects: e.target.value})}
                    />
                    <Button plain onClick={() => document.getElementById('subjects-file')?.click()}>
                      <ArrowUpTrayIcon />
                      导入Excel
                    </Button>
                    <input id="subjects-file" type="file" accept=".xlsx,.xls" className="hidden" 
                      onChange={async (e) => {
                        if (!e.target.files || !e.target.files[0]) return;
                        const form = new FormData();
                        form.append('file', e.target.files[0]);
                        const res = await api.post(`/projects/${id}/import-subjects`, form, { headers: { 'Content-Type': 'multipart/form-data' }});
                        const arr: string[] = res.data.subjects || [];
                        setBatchForm({...batchForm, subjects: arr.join(',')});
                        e.currentTarget.value = '';
                      }}
                    />
                  </div>
                  <Text className="text-sm text-zinc-600 mt-1">
                    格式：001,002,003 或从Excel导入
                  </Text>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    采血序号/时间
                  </label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="序号/时间对，如：01/0h,02/2h" 
                      className="flex-1"
                      value={batchForm.sampleSeqs}
                      onChange={(e) => setBatchForm({...batchForm, sampleSeqs: e.target.value})}
                    />
                    <Button plain onClick={() => document.getElementById('seqtime-file')?.click()}>
                      <ArrowUpTrayIcon />
                      导入Excel
                    </Button>
                    <input id="seqtime-file" type="file" accept=".xlsx,.xls" className="hidden" 
                      onChange={async (e) => {
                        if (!e.target.files || !e.target.files[0]) return;
                        const form = new FormData();
                        form.append('file', e.target.files[0]);
                        const res = await api.post(`/projects/${id}/import-seq-times`, form, { headers: { 'Content-Type': 'multipart/form-data' }});
                        const arr: {seq:string,time:string}[] = res.data.seq_time_pairs || [];
                        setBatchForm({...batchForm, sampleSeqs: arr.map(p=>`${p.seq}/${p.time}`).join(',')});
                        e.currentTarget.value = '';
                      }}
                    />
                  </div>
                  <Text className="text-sm text-zinc-600 mt-1">
                    格式：01/0h,02/2h,03/4h 或从Excel导入
                  </Text>
                </div>
              </div>
            </div>

            <Divider />

            {/* 稳定性及质控样本 */}
            <div>
              <Text className="font-medium mb-4">稳定性及质控样本</Text>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    样本类别
                  </label>
                  <Select
                    value={stabilityQCParams.sample_category}
                    onChange={(e) => setStabilityQCParams({...stabilityQCParams, sample_category: e.target.value})}
                  >
                    <option value="">请选择</option>
                    <option value="STB">稳定性样本</option>
                    <option value="QC">质控样本</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    代码
                  </label>
                  <Input 
                    placeholder="如：L, M, H"
                    value={stabilityQCParams.code}
                    onChange={(e) => setStabilityQCParams({...stabilityQCParams, code: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    数量
                  </label>
                  <Input 
                    type="number" 
                    placeholder="生成数量" 
                    min="1"
                    value={stabilityQCParams.quantity || ''}
                    onChange={(e) => setStabilityQCParams({...stabilityQCParams, quantity: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    起始编号
                  </label>
                  <Input 
                    type="number" 
                    placeholder="如：31" 
                    min="1"
                    value={stabilityQCParams.start_number || ''}
                    onChange={(e) => setStabilityQCParams({...stabilityQCParams, start_number: parseInt(e.target.value) || 1})}
                  />
                </div>
              </div>
              <div className="mt-4">
                <Button 
                  color="dark"
                  onClick={handleGenerateStabilityQCCodes}
                  disabled={!stabilityQCParams.sample_category || !stabilityQCParams.code || !stabilityQCParams.quantity}
                >
                  生成稳定性/质控样本编号
                </Button>
              </div>
            </div>

            {generatedCodes.length > 0 && (
              <>
                <Divider />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Text className="font-medium">生成结果</Text>
                    <Badge color="blue">{generatedCodes.length}</Badge>
                  </div>
                  <Text className="text-sm text-zinc-600">
                    最近一次生成的样本编号如下，可再次生成或直接打印。
                  </Text>
                  <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-sm leading-6">
                    {generatedCodes.map((code, index) => (
                      <div key={`${code}-${index}`} className="text-zinc-800">
                        {code}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsBatchGenerateDialogOpen(false)}>
            取消
          </Button>
          <Button 
            color="dark"
            onClick={() => handleGenerateSampleCodes('preview')}
            disabled={isGeneratingCodes}
          >
            <CheckCircleIcon />
            {isGeneratingCodes ? '生成中…' : '确认生成'}
          </Button>
          <Button 
            color="dark"
            onClick={() => handleGenerateSampleCodes('print')}
            disabled={isGeneratingCodes}
          >
            <PrinterIcon />
            {isGeneratingCodes ? '生成中…' : '生成并打印清单'}
          </Button>
          <Button 
            color="dark"
            onClick={() => handleGenerateSampleCodes('print_label')}
            disabled={isGeneratingCodes}
          >
            <PrinterIcon />
            {isGeneratingCodes ? '生成中…' : '生成并打印标签'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onClose={setIsDeleteDialogOpen}>
        <DialogTitle>删除项目</DialogTitle>
        <DialogDescription>
          删除后将无法恢复该项目及其配置。
        </DialogDescription>
        <DialogBody>
          <p className="text-sm text-zinc-600">
            请确认项目下没有任何样本或流程数据再执行删除操作。
          </p>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsDeleteDialogOpen(false)}>
            取消
          </Button>
          <Button color="red" onClick={handleDeleteProject} disabled={isDeleting}>
            {isDeleting ? '删除中…' : '确认删除'}
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
