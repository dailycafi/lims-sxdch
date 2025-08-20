import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
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
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { api } from '@/lib/api';
import { 
  CogIcon, 
  DocumentTextIcon, 
  PrinterIcon, 
  PlusIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon 
} from '@heroicons/react/20/solid';

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
  enabled: boolean;
  order: number;
}

const sampleCodeElements = [
  { id: 'sponsor_code', name: 'sponsor_code', label: '申办者项目编号' },
  { id: 'lab_code', name: 'lab_code', label: '临床试验研究室项目编号' },
  { id: 'clinic_code', name: 'clinic_code', label: '临床机构编号' },
  { id: 'subject_id', name: 'subject_id', label: '受试者编号' },
  { id: 'test_type', name: 'test_type', label: '检测类型' },
  { id: 'sample_seq', name: 'sample_seq', label: '采血序号' },
  { id: 'sample_time', name: 'sample_time', label: '采血时间' },
  { id: 'cycle_group', name: 'cycle_group', label: '周期/组别' },
  { id: 'sample_type', name: 'sample_type', label: '正份备份' },
];

export default function ProjectDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isBatchGenerateDialogOpen, setIsBatchGenerateDialogOpen] = useState(false);
  const [selectedElements, setSelectedElements] = useState<SampleCodeElement[]>([]);
  const [auditReason, setAuditReason] = useState('');
  
  // 批量生成表单
  const [batchForm, setBatchForm] = useState({
    cycles: [],
    testTypes: [],
    primaryCounts: [],
    backupCounts: [],
    subjects: '',
    sampleSeqs: '',
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

  const fetchProject = async () => {
    try {
      const response = await api.get(`/projects/${id}`);
      setProject(response.data);
      
      // 初始化样本编号规则
      if (response.data.sample_code_rule) {
        const rule = response.data.sample_code_rule;
        const elements = sampleCodeElements.map((el, index) => ({
          ...el,
          enabled: rule.elements?.includes(el.id) || false,
          order: rule.order?.[el.id] || index,
        }));
        setSelectedElements(elements.sort((a, b) => a.order - b.order));
      } else {
        setSelectedElements(sampleCodeElements.map((el, index) => ({
          ...el,
          enabled: false,
          order: index,
        })));
      }
    } catch (error) {
      console.error('Failed to fetch project:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCodeRule = async () => {
    try {
      const enabledElements = selectedElements.filter(el => el.enabled);
      const rule = {
        elements: enabledElements.map(el => el.id),
        order: enabledElements.reduce((acc, el, index) => ({
          ...acc,
          [el.id]: index,
        }), {}),
      };

      await api.put(`/projects/${id}/sample-code-rule`, {
        sample_code_rule: rule,
        audit_reason: auditReason,
      });

      setIsConfigDialogOpen(false);
      setAuditReason('');
      fetchProject();
    } catch (error) {
      console.error('Failed to save sample code rule:', error);
    }
  };

  const handleElementToggle = (elementId: string) => {
    setSelectedElements(prev =>
      prev.map(el =>
        el.id === elementId ? { ...el, enabled: !el.enabled } : el
      )
    );
  };

  const handleElementMove = (elementId: string, direction: 'up' | 'down') => {
    const index = selectedElements.findIndex(el => el.id === elementId);
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === selectedElements.length - 1)
    ) {
      return;
    }

    const newElements = [...selectedElements];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newElements[index], newElements[newIndex]] = [newElements[newIndex], newElements[index]];
    
    // 更新order
    newElements.forEach((el, idx) => {
      el.order = idx;
    });
    
    setSelectedElements(newElements);
  };

  const handleGenerateStabilityQCCodes = async () => {
    try {
      const response = await api.post(`/projects/${id}/generate-stability-qc-codes`, stabilityQCParams);
      
      // 显示生成结果
      alert(`成功生成 ${response.data.count} 个${stabilityQCParams.sample_category === 'STB' ? '稳定性' : '质控'}样本编号`);
      
      // 可以在这里显示生成的编号列表
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
      alert('生成失败，请重试');
    }
  };

  const generateSamplePreview = () => {
    const enabledElements = selectedElements.filter(el => el.enabled).sort((a, b) => a.order - b.order);
    const parts = enabledElements.map(el => {
      switch (el.id) {
        case 'sponsor_code':
          return project?.sponsor_project_code || 'SPONSOR';
        case 'lab_code':
          return project?.lab_project_code || 'LAB';
        case 'clinic_code':
          return 'CHH';
        case 'subject_id':
          return '004';
        case 'test_type':
          return 'PK';
        case 'sample_seq':
          return '01';
        case 'sample_time':
          return '2h';
        case 'cycle_group':
          return 'A';
        case 'sample_type':
          return 'a1';
        default:
          return '';
      }
    });
    return parts.join('-');
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
            <Button onClick={() => router.back()} plain>
              返回
            </Button>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <DescriptionList>
              <div>
                <DescriptionTerm>申办者项目编号</DescriptionTerm>
                <DescriptionDetails>{project.sponsor_project_code}</DescriptionDetails>
              </div>
              <div>
                <DescriptionTerm>实验室项目编号</DescriptionTerm>
                <DescriptionDetails>{project.lab_project_code}</DescriptionDetails>
              </div>
              <div>
                <DescriptionTerm>申办者</DescriptionTerm>
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

            <div className="p-6 space-y-6">
              {/* 样本编号规则 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Text className="font-medium">样本编号规则</Text>
                    <Text className="text-sm text-zinc-600 mt-1">
                      配置样本编号的组成要素和顺序
                    </Text>
                  </div>
                  <Button onClick={() => setIsConfigDialogOpen(true)}>
                    <CogIcon />
                    配置规则
                  </Button>
                </div>
                
                {project.sample_code_rule ? (
                  <div className="bg-zinc-50 rounded-lg p-4">
                    <Text className="text-sm text-zinc-600 mb-2">当前规则预览：</Text>
                    <Text className="font-mono text-lg">{generateSamplePreview()}</Text>
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
                    onClick={() => setIsBatchGenerateDialogOpen(true)}
                    disabled={!project.sample_code_rule}
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

      {/* 配置样本编号规则对话框 */}
      <Dialog open={isConfigDialogOpen} onClose={setIsConfigDialogOpen}>
        <DialogTitle>配置样本编号规则</DialogTitle>
        <DialogDescription>
          选择样本编号的组成要素并设置顺序
        </DialogDescription>
        <DialogBody>
          <div className="space-y-4">
            <div className="bg-zinc-50 rounded-lg p-3">
              <Text className="text-sm text-zinc-600 mb-2">编号预览：</Text>
              <Text className="font-mono">{generateSamplePreview()}</Text>
            </div>

            <div className="space-y-2">
              {selectedElements.map((element, index) => (
                <div
                  key={element.id}
                  className="flex items-center gap-3 p-3 bg-white border border-zinc-200 rounded-lg"
                >
                  <Checkbox
                    checked={element.enabled}
                    onChange={() => handleElementToggle(element.id)}
                  />
                  <Text className="flex-1">{element.label}</Text>
                  {element.enabled && (
                    <div className="flex gap-1">
                      <Button
                        plain
                        size="small"
                        onClick={() => handleElementMove(element.id, 'up')}
                        disabled={index === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        plain
                        size="small"
                        onClick={() => handleElementMove(element.id, 'down')}
                        disabled={index === selectedElements.length - 1}
                      >
                        ↓
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {project.sample_code_rule && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  修改理由 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={auditReason}
                  onChange={(e) => setAuditReason(e.target.value)}
                  placeholder="请输入修改理由"
                />
                <Text className="text-sm text-amber-600 mt-1">
                  注意：一旦有样本被接收，编号规则将不允许修改
                </Text>
              </div>
            )}
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsConfigDialogOpen(false)}>
            取消
          </Button>
          <Button 
            onClick={handleSaveCodeRule}
            disabled={!selectedElements.some(el => el.enabled) || (project.sample_code_rule && !auditReason)}
          >
            保存配置
          </Button>
        </DialogActions>
      </Dialog>

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
                  <Input placeholder="如：A,B,C 或 第1期,第2期" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    检测类型（可多选）
                  </label>
                  <Input placeholder="如：PK,PD 或 血清,血浆" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    正份（可多选）
                  </label>
                  <Input placeholder="如：a1,a2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    备份（可多选）
                  </label>
                  <Input placeholder="如：b1,b2" />
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
                    <Button plain>
                      <ArrowUpTrayIcon />
                      导入Excel
                    </Button>
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
                    <Button plain>
                      <ArrowUpTrayIcon />
                      导入Excel
                    </Button>
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
                  onClick={handleGenerateStabilityQCCodes}
                  disabled={!stabilityQCParams.sample_category || !stabilityQCParams.code || !stabilityQCParams.quantity}
                >
                  生成稳定性/质控样本编号
                </Button>
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsBatchGenerateDialogOpen(false)}>
            取消
          </Button>
          <Button>
            <CheckCircleIcon />
            确认生成
          </Button>
          <Button>
            <PrinterIcon />
            生成并打印
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
