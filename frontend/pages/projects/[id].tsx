import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Checkbox, CheckboxField } from '@/components/checkbox';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Heading } from '@/components/heading';
import { DescriptionList, DescriptionTerm, DescriptionDetails } from '@/components/description-list';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { Divider } from '@/components/divider';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { api } from '@/lib/api';
import { ESignatureDialog } from '@/components/e-signature-dialog';
import { useAuthStore } from '@/store/auth';
import { useProjectStore } from '@/store/project';
import { Tabs } from '@/components/tabs';
import { 
  CogIcon, 
  DocumentTextIcon, 
  PrinterIcon, 
  ArrowUpTrayIcon,
  CheckCircleIcon,
  AdjustmentsHorizontalIcon,
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  BeakerIcon,
  PencilSquareIcon,
  MagnifyingGlassIcon,
  ArrowUpOnSquareIcon
} from '@heroicons/react/20/solid';
import JsBarcode from 'jsbarcode';
import clsx from 'clsx';

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
  3: ['test_type'],                // D: ④
  4: ['sample_seq', 'sample_time'],// E: ⑥/⑦
  5: ['cycle_group'],              // F: ⑧
  6: ['sample_type'],              // G: ⑨
};

// 简单的标签输入组件
function TagInput({ 
  values, 
  onChange, 
  placeholder = "输入后按回车添加" 
}: { 
  values: string[], 
  onChange: (values: string[]) => void,
  placeholder?: string
}) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) {
        if (!values.includes(inputValue.trim())) {
          onChange([...values, inputValue.trim()]);
        }
        setInputValue('');
      }
    }
  };

  const removeTag = (indexToRemove: number) => {
    onChange(values.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2 mb-2">
        {values.map((tag, index) => (
          <span key={index} className="inline-flex items-center pl-2 pr-1 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
            {tag}
            <button 
              onClick={() => removeTag(index)} 
              className="appearance-none border-none bg-transparent p-0 ml-1 text-blue-400 hover:text-blue-600 focus:outline-none focus:ring-0"
            >
              <XMarkIcon className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button plain onClick={() => {
          if (inputValue.trim()) {
            if (!values.includes(inputValue.trim())) {
              onChange([...values, inputValue.trim()]);
            }
            setInputValue('');
          }
        }}>
          <PlusIcon className="w-4 h-4" />
          添加
        </Button>
      </div>
    </div>
  );
}

function ClinicSubjectTable({ 
  data, 
  onChange, 
  clinicOptions, 
  onImport 
}: { 
  data: { clinic: string; subject: string }[], 
  onChange: (data: { clinic: string; subject: string }[]) => void,
  clinicOptions: string[],
  onImport: () => void
}) {
  const addRow = () => onChange([...data, { clinic: '', subject: '' }]);
  
  const updateRow = (index: number, field: 'clinic' | 'subject', value: string) => {
    const newData = [...data];
    newData[index] = { ...newData[index], [field]: value };
    onChange(newData);
  };

  const removeRow = (index: number) => {
    onChange(data.filter((_, i) => i !== index));
  };

  return (
    <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-2 flex items-center justify-between">
        <div className="font-medium text-sm text-zinc-700">
            列表 ({data.length})
        </div>
        <div className="flex gap-2">
            <Button plain onClick={onImport} className="!py-1 !px-2 text-xs">
                <ArrowUpTrayIcon className="w-3 h-3 mr-1"/>
                导入
            </Button>
            <Button plain onClick={addRow} className="!py-1 !px-2 text-xs">
                <PlusIcon className="w-3 h-3 mr-1"/>
                添加
            </Button>
             {data.length > 0 && (
                <Button plain onClick={() => onChange([])} className="!py-1 !px-2 text-xs text-red-600 hover:text-red-700">
                  清空
                </Button>
             )}
        </div>
      </div>
      <div className="max-h-[300px] overflow-y-auto">
        <table className="min-w-full divide-y divide-zinc-200">
          <thead className="bg-zinc-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 w-1/2">临床机构/分中心序号</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 w-1/2">受试者编号</th>
              <th className="w-10 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white">
             {data.map((row, idx) => (
               <tr key={idx}>
                 <td className="px-4 py-2">
                   {clinicOptions.length > 0 ? (
                     <select 
                       className="block w-full rounded-md border-0 py-1.5 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                       value={row.clinic}
                       onChange={e => updateRow(idx, 'clinic', e.target.value)}
                     >
                       <option value="">请选择</option>
                       {clinicOptions.map(opt => (
                         <option key={opt} value={opt}>{opt}</option>
                       ))}
                     </select>
                   ) : (
                     <input 
                        type="text"
                        className="block w-full rounded-md border-0 py-1.5 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                        value={row.clinic}
                        onChange={e => updateRow(idx, 'clinic', e.target.value)}
                        placeholder="输入序号"
                     />
                   )}
                 </td>
                 <td className="px-4 py-2">
                    <input 
                        type="text"
                        className="block w-full rounded-md border-0 py-1.5 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                        value={row.subject}
                        onChange={e => updateRow(idx, 'subject', e.target.value)}
                        placeholder="输入编号"
                     />
                 </td>
                 <td className="px-2 py-2 text-center">
                    <button onClick={() => removeRow(idx)} className="text-zinc-400 hover:text-red-500">
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                 </td>
               </tr>
             ))}
             {data.length === 0 && (
                <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-sm text-zinc-500">
                        暂无数据，请点击上方“添加”或“导入”
                    </td>
                </tr>
             )}
          </tbody>
        </table>
        </div>
    </div>
  );
}

function SeqTimeTable({ 
  data, 
  onChange, 
  onImport 
}: { 
  data: { seq: string; time: string }[], 
  onChange: (data: { seq: string; time: string }[]) => void,
  onImport: () => void
}) {
  const addRow = () => onChange([...data, { seq: '', time: '' }]);
  
  const updateRow = (index: number, field: 'seq' | 'time', value: string) => {
    const newData = [...data];
    newData[index] = { ...newData[index], [field]: value };
    onChange(newData);
  };

  const removeRow = (index: number) => {
    onChange(data.filter((_, i) => i !== index));
  };

  return (
    <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-2 flex items-center justify-between">
        <div className="font-medium text-sm text-zinc-700">
            列表 ({data.length})
        </div>
        <div className="flex gap-2">
            <Button plain onClick={onImport} className="!py-1 !px-2 text-xs">
                <ArrowUpTrayIcon className="w-3 h-3 mr-1"/>
                导入
            </Button>
            <Button plain onClick={addRow} className="!py-1 !px-2 text-xs">
                <PlusIcon className="w-3 h-3 mr-1"/>
                添加
            </Button>
             {data.length > 0 && (
                <Button plain onClick={() => onChange([])} className="!py-1 !px-2 text-xs text-red-600 hover:text-red-700">
                  清空
                </Button>
             )}
        </div>
      </div>
      <div className="max-h-[300px] overflow-y-auto">
        <table className="min-w-full divide-y divide-zinc-200">
          <thead className="bg-zinc-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 w-1/2">采血序号</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 w-1/2">采血时间</th>
              <th className="w-10 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white">
             {data.map((row, idx) => (
               <tr key={idx}>
                 <td className="px-4 py-2">
                   <input 
                      type="text"
                      className="block w-full rounded-md border-0 py-1.5 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                      value={row.seq}
                      onChange={e => updateRow(idx, 'seq', e.target.value)}
                      placeholder="如：01"
                   />
                 </td>
                 <td className="px-4 py-2">
                    <input 
                        type="text"
                        className="block w-full rounded-md border-0 py-1.5 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                        value={row.time}
                        onChange={e => updateRow(idx, 'time', e.target.value)}
                        placeholder="如：0h"
                     />
                 </td>
                 <td className="px-2 py-2 text-center">
                    <button onClick={() => removeRow(idx)} className="text-zinc-400 hover:text-red-500">
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                 </td>
               </tr>
             ))}
             {data.length === 0 && (
                <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-sm text-zinc-500">
                        暂无数据，请点击上方“添加”或“导入”
                    </td>
                </tr>
             )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatrixColumn({
  title,
  options,
  selected,
  onSelectionChange,
  onAddOption,
  action, // 新增 action 属性，用于放置“导入”按钮
  emptyText = "暂无选项"
}: {
  title: string;
  options: string[];
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
  onAddOption?: (opt: string) => void;
  action?: React.ReactNode; // 类型定义
  emptyText?: string;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newOption, setNewOption] = useState('');

  const toggleSelection = (item: string) => {
    if (selected.includes(item)) {
      onSelectionChange(selected.filter(i => i !== item));
    } else {
      onSelectionChange([...selected, item]);
    }
  };

  const toggleAll = () => {
    if (selected.length === options.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange([...options]);
    }
  };

  const onAdd = () => {
    if (newOption.trim() && onAddOption) {
      onAddOption(newOption.trim());
      setNewOption('');
      setIsAdding(false);
    }
  };

  return (
    <div className="flex flex-col h-full border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <div className="bg-zinc-50 border-b border-zinc-200 px-3 py-2 flex items-center justify-between shrink-0">
        <span className="font-medium text-sm text-zinc-700">{title}</span>
        <div className="flex items-center gap-2">
          {onAddOption && (
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="text-zinc-400 hover:text-zinc-700 transition-colors"
              title="添加选项"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          )}
          <Checkbox
            checked={options.length > 0 && selected.length === options.length}
            indeterminate={selected.length > 0 && selected.length < options.length}
            onChange={toggleAll}
            disabled={options.length === 0}
          />
        </div>
      </div>

      {isAdding && (
        <div className="p-2 border-b border-zinc-100 bg-zinc-50 flex gap-1">
          <input
            autoFocus
            className="flex-1 px-2 py-1 text-sm border border-zinc-300 rounded focus:outline-none focus:border-blue-500"
            value={newOption}
            onChange={e => setNewOption(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onAdd()}
            placeholder="输入并回车"
          />
          <button onClick={onAdd} className="text-blue-600 px-1 hover:text-blue-800"><CheckCircleIcon className="w-5 h-5" /></button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[150px]">
        {options.length > 0 ? (
          options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2 p-1.5 hover:bg-zinc-50 rounded text-sm transition-colors cursor-pointer" onClick={() => toggleSelection(opt)}>
              <Checkbox
                checked={selected.includes(opt)}
                onChange={() => { }} // handled by parent div click
                className="pointer-events-none"
              />
              <span className="truncate select-none text-zinc-700" title={opt}>{opt}</span>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-8 text-zinc-400 text-xs">
            <span>{emptyText}</span>
            {onAddOption && (
              <button onClick={() => setIsAdding(true)} className="mt-2 text-blue-500 hover:text-blue-600 underline">
                点击添加
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* 底部操作栏 (例如导入按钮) */}
      {action && (
        <div className="border-t border-zinc-100 bg-zinc-50 p-2 flex justify-center">
            {action}
        </div>
      )}
    </div>
  );
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isBatchGenerateDialogOpen, setIsBatchGenerateDialogOpen] = useState(false);
  const [configTab, setConfigTab] = useState('rules'); // 'rules' | 'options'
  const [activeGenerationTab, setActiveGenerationTab] = useState('clinical'); // 'clinical' | 'result' | 'stability'
  
  // 新的插槽状态，长度为7 (A-G)
  const [slots, setSlots] = useState<(string | null)[]>(Array(7).fill(null));
  
  // 选项字典配置
  const [dictionaries, setDictionaries] = useState({
    cycles: [] as string[],
    test_types: [] as string[],
    primary_types: [] as string[],
    backup_types: [] as string[],
    clinic_codes: [] as string[],
  });
  
  const [isESignatureOpen, setIsESignatureOpen] = useState(false);
  const [pendingSaveRule, setPendingSaveRule] = useState<any | null>(null);
  const [isGeneratingCodes, setIsGeneratingCodes] = useState(false);
  const { user } = useAuthStore();
  const { removeProject, fetchProjects: refreshProjects } = useProjectStore();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // 批量生成表单 (Generation Matrix)
  const [batchForm, setBatchForm] = useState({
    cycles: [] as string[],
    testTypes: [] as string[],
    primary: [] as string[],
    backup: [] as string[],
    clinicSubjectPairs: [] as { clinic: string; subject: string }[],
    seqTimePairs: [] as { seq: string; time: string }[],
    // 矩阵选择状态 (选中的值)
    selectedCycles: [] as string[],
    selectedTestTypes: [] as string[],
    selectedPrimary: [] as string[],
    selectedBackup: [] as string[],
    selectedSubjects: [] as string[], // Values formatted as "clinic|subject"
    selectedTimepoints: [] as string[], // Values formatted as "seq|time"
  });

  // 生成结果状态
  const [generatedSamples, setGeneratedSamples] = useState<any[]>([]);
  const [selectedSamples, setSelectedSamples] = useState<Set<string>>(new Set());
  const [editingSample, setEditingSample] = useState<any | null>(null);
  
  // 编辑状态
  const [isEditInputOpen, setIsEditInputOpen] = useState(false);
  const [isEditVerifyOpen, setIsEditVerifyOpen] = useState(false);

  // 稳定性及质控样本
  const [stabilityQCParams, setStabilityQCParams] = useState({
    sample_category: '',
    code: '',
    quantity: 0,
    start_number: 1
  });
  const [generatedQCCodes, setGeneratedQCCodes] = useState<string[]>([]);

  useEffect(() => {
    if (id) {
      fetchProject();
    }
  }, [id]);

  useEffect(() => {
    if (!isBatchGenerateDialogOpen) {
      setGeneratedSamples([]);
      setSelectedSamples(new Set());
      setActiveGenerationTab('clinical');
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
    
    // 初始化字典
    if (rule && rule.dictionaries) {
      setDictionaries({
        cycles: rule.dictionaries.cycles || [],
        test_types: rule.dictionaries.test_types || [],
        primary_types: rule.dictionaries.primary_types || [],
        backup_types: rule.dictionaries.backup_types || [],
        clinic_codes: rule.dictionaries.clinic_codes || [],
      });
      // 初始化生成表单的选择项
      setBatchForm(prev => ({
        ...prev,
        cycles: rule.dictionaries.cycles || [],
        testTypes: rule.dictionaries.test_types || [],
        primary: rule.dictionaries.primary_types || [],
        backup: rule.dictionaries.backup_types || [],
      }));
    }
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
    // 允许仅保存选项配置，不强制要求编号规则插槽
    // 如果全空则提示
    const hasSlots = slots.some(s => s !== null);
    const hasOptions = Object.values(dictionaries).some(arr => arr && arr.length > 0);

    if (!hasSlots && !hasOptions) {
      toast.error('配置为空，请至少配置一项规则或选项');
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
      dictionaries: dictionaries, // 保存字典配置
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
        throw new Error('密码错误，请重试');
      }
      throw new Error('保存失败，请重试');
    }
  };

  const handleEditSignatureConfirm = async (password: string, reasonText: string) => {
    if (!editingSample) return;
    try {
       // Verify signature
      await api.post('/auth/verify-signature', { password, purpose: 'edit_sample_code' });
      
      // Update local state
      const newSamples = generatedSamples.map(s => {
        if (s.id === editingSample.id) {
          return { ...s, code: editingSample.newCode };
        }
        return s;
      });
      setGeneratedSamples(newSamples);
      
      setEditingSample(null);
      setIsEditVerifyOpen(false);
      toast.success('样本编号已修改');
    } catch (error: any) {
       throw new Error(error.response?.data?.detail || '验证失败');
    }
  }

  const handleSlotChange = (index: number, value: string) => {
    const newSlots = [...slots];
    newSlots[index] = value === '' ? null : value;
    setSlots(newSlots);
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

  const triggerPrint = (samples: any[], mode: 'list' | 'label' = 'list') => {
    if (typeof window === 'undefined') return;

    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) {
      toast.error('浏览器阻止了打印窗口，请允许弹窗后重试');
      return;
    }

    const generatedAt = new Date().toLocaleString('zh-CN');
    const projectLabel = project?.lab_project_code || project?.sponsor_project_code || '项目';
    
    let content = '';
    if (mode === 'label') {
      const barcodes = samples.map(s => ({ code: s.code, src: generateBarcodeDataUrl(s.code) }));
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
        <div class="header">
        <h1>样本编号列表</h1>
          <p>项目：${projectLabel} | 打印时间：${generatedAt}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>序号</th>
              <th>申办方</th>
              <th>申办方项目编号</th>
              <th>实验室项目编号</th>
              <th>样本编号</th>
            </tr>
          </thead>
          <tbody>
            ${samples.map((s, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${project?.sponsor?.name || '-'}</td>
                <td>${project?.sponsor_project_code || '-'}</td>
                <td>${project?.lab_project_code || '-'}</td>
                <td class="code">${s.code}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    printWindow.document.write(`<!DOCTYPE html>
      <html lang="zh-CN">
        <head>
          <meta charSet="utf-8" />
          <title>样本编号打印</title>
          <style>
            body { font-family: 'SF Pro SC', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            h1 { margin: 0 0 10px 0; font-size: 18pt; }
            p { color: #666; font-size: 10pt; }
            
            /* Table Styles */
            table { width: 100%; border-collapse: collapse; font-size: 10pt; }
            th, td { border: 1px solid #000; padding: 6px 8px; text-align: center; }
            th { background-color: #f3f4f6; font-weight: bold; }
            .code { font-family: monospace; font-weight: bold; font-size: 11pt; }
            
            /* Label Styles */
            .labels { 
              display: grid; 
              grid-template-columns: repeat(auto-fill, 50mm); 
              gap: 5mm; 
              gap: 5mm; 
            }
            .label {
              width: 50mm;
              height: 30mm;
              border: 1px dashed #ccc;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 2mm;
              box-sizing: border-box;
              page-break-inside: avoid;
            }
            .label img { max-width: 100%; max-height: 100%; }

            @media print {
              body { padding: 0; }
              .label { border: none; }
              th { background-color: #ddd !important; -webkit-print-color-adjust: exact; }
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

  const handleViewSamples = async () => {
    // 收集所有选中的参数
    const { selectedCycles, selectedTestTypes, selectedPrimary, selectedBackup, selectedSubjects, selectedTimepoints } = batchForm;
    
    if (selectedCycles.length === 0 && selectedTestTypes.length === 0 && selectedPrimary.length === 0 && selectedBackup.length === 0 && selectedSubjects.length === 0 && selectedTimepoints.length === 0) {
        toast.error('请至少选择一个条件进行生成');
      return;
    }

    setIsGeneratingCodes(true);
    try {
        // 构造生成请求
        const subjects = selectedSubjects.map(s => {
            const [clinic, subject] = s.split('|');
            return { clinic, subject };
        });
        const timepoints = selectedTimepoints.map(t => {
            const [seq, time] = t.split('|');
            return { seq, time };
        });

        const payload = {
            cycles: selectedCycles.length ? selectedCycles : undefined,
            test_types: selectedTestTypes.length ? selectedTestTypes : undefined,
            primary: selectedPrimary.length ? selectedPrimary : undefined,
            backup: selectedBackup.length ? selectedBackup : undefined,
            clinic_subject_pairs: subjects.length ? subjects : undefined,
            seq_time_pairs: timepoints.length ? timepoints : undefined,
        };
        
      const response = await api.post(`/projects/${id}/generate-sample-codes`, payload);
      const codes: string[] = response.data?.sample_codes || [];
        
        // 转换为对象格式以便展示和编辑
        const samples = codes.map((code, index) => ({
            id: `GEN-${Date.now()}-${index}`,
            code,
            originalCode: code,
            sponsor_project_code: project?.sponsor_project_code,
            lab_project_code: project?.lab_project_code,
        }));
        
        setGeneratedSamples(samples);
        setActiveGenerationTab('result');
        toast.success(`生成预览成功，共 ${samples.length} 个样本`);

    } catch (error) {
        console.error('生成失败', error);
        toast.error('生成预览失败');
    } finally {
      setIsGeneratingCodes(false);
    }
  };

  const handleGenerateStabilityQCCodes = async () => {
    if (!stabilityQCParams.sample_category || !stabilityQCParams.code || !stabilityQCParams.quantity) {
      toast.error('请填写所有必填字段（样本类别、代码、数量）');
      return;
    }

    try {
      const response = await api.post(`/projects/${id}/generate-stability-qc-codes`, stabilityQCParams);
      
      const categoryLabel = stabilityQCParams.sample_category === 'STB' ? '稳定性' : '质控';
      const codes: string[] = response.data.sample_codes || [];
      
      // 转换为对象格式以便在结果页展示和打印
      const samples = codes.map((code, index) => ({
        id: `QC-${Date.now()}-${index}`,
        code,
        originalCode: code,
        sponsor_project_code: project?.sponsor_project_code,
        lab_project_code: project?.lab_project_code,
      }));

      setGeneratedSamples(samples);
      setGeneratedQCCodes(codes); // 保留一份纯代码列表如果需要
      setActiveGenerationTab('result');
      
      toast.success(`成功生成 ${response.data.count} 个${categoryLabel}样本编号`);
      
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

  const generateVisualPreview = () => {
    return (
      <div className="font-mono text-xl tracking-wide">
        {slots.map((slot, index) => {
          if (!slot) return null;
          const isLast = slots.slice(index + 1).every(s => s === null);
          // 获取示例值
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
        {slots.every(s => s === null) && (
          <span className="text-zinc-400 text-base italic">暂未配置规则，请在下方选择...</span>
        )}
      </div>
    );
  };

  const handleDeleteProject = async () => {
    if (!project) return;
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


  const toggleSampleSelection = (id: string) => {
      const newSet = new Set(selectedSamples);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedSamples(newSet);
  };

  const toggleAllSamples = () => {
      if (selectedSamples.size === generatedSamples.length) {
          setSelectedSamples(new Set());
      } else {
          setSelectedSamples(new Set(generatedSamples.map(s => s.id)));
      }
  };

  if (loading) return <AppLayout><div className="flex justify-center items-center h-64"><Text>加载中...</Text></div></AppLayout>;
  if (!project) return <AppLayout><div className="flex justify-center items-center h-64"><Text>项目不存在</Text></div></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        {/* ... Project Header ... */}
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
              <div><DescriptionTerm>创建时间</DescriptionTerm><DescriptionDetails>{new Date(project.created_at).toLocaleDateString('zh-CN')}</DescriptionDetails></div>
              <div><DescriptionTerm>状态</DescriptionTerm><DescriptionDetails><Badge color={project.is_active ? 'green' : 'red'}>{project.is_active ? '活跃' : '停用'}</Badge></DescriptionDetails></div>
            </DescriptionList>
          </div>
        </div>

        {/* Project Config Section */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-zinc-200">
                <div className="flex items-center gap-2">
                  <CogIcon className="h-5 w-5 text-zinc-400" />
                  <Text className="font-medium">项目配置</Text>
                </div>
              </div>
            <div className="p-6 space-y-8">
               {/* Sample Code Rule Config */}
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

               {/* Batch Generation Entry */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Text className="font-medium">批量生成样本编号</Text>
                        <Text className="text-sm text-zinc-600 mt-1">根据配置的规则批量生成样本编号并打印标签</Text>
                  </div>
                    <Button color="dark" onClick={() => setIsBatchGenerateDialogOpen(true)} disabled={!project.sample_code_rule} className="shadow-sm relative z-10">
                    <DocumentTextIcon />
                    生成编号
                  </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Config Dialog */}
      <Dialog open={isConfigDialogOpen} onClose={setIsConfigDialogOpen} size="3xl">
        <DialogTitle>配置样本编号规则</DialogTitle>
        <DialogBody>
          <Tabs tabs={[{ key: 'rules', label: '编号结构' }, { key: 'options', label: '选项配置' }]} activeTab={configTab} onChange={setConfigTab} className="mb-6"/>
          {configTab === 'rules' ? (
             /* Rule Config content same as before */
            <div className="space-y-8">
                {/* Preview */}
              <div className="space-y-3">
                <Text className="text-base font-semibold text-zinc-900">编号预览</Text>
                    <div className="p-6 bg-zinc-50/80 rounded-2xl border border-zinc-200/60 flex items-center justify-center min-h-[100px] shadow-sm">{generateVisualPreview()}</div>
                    <p className="text-xs text-zinc-500 px-1">* 编号将按照 A 到 G 的顺序自动拼接，未配置的位置将被自动忽略。</p>
                </div>
                {/* Slots */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <Text className="text-base font-semibold text-zinc-900">规则配置</Text>
                        <button onClick={() => setSlots(Array(7).fill(null))} className="text-xs text-blue-600 font-medium hover:text-blue-700">重置所有</button>
                </div>
                <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden divide-y divide-zinc-100">
                  {SLOT_LABELS.map((label, index) => {
                    const currentSlotValue = slots[index];
                    const currentElement = sampleCodeElements.find(e => e.id === currentSlotValue);
                    return (
                      <div key={label} className="group flex items-center p-4 hover:bg-zinc-50 transition-colors relative">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-zinc-100 text-zinc-500 flex items-center justify-center font-mono font-bold text-lg mr-4 group-hover:bg-white group-hover:shadow-sm transition-all">{label}</div>
                        <div className="flex-grow min-w-0">
                          <div className="relative">
                                            <select value={currentSlotValue || ''} onChange={(e) => handleSlotChange(index, e.target.value)} className="w-full appearance-none bg-transparent py-2 pl-0 pr-8 text-base text-zinc-900 font-medium focus:outline-none cursor-pointer">
                              <option value="">未配置 (跳过)</option>
                              <optgroup label="该位置可用选项">
                                                    {sampleCodeElements.filter(el => SLOT_ALLOWED_ELEMENTS[index]?.includes(el.id)).map(el => (
                                                        <option key={el.id} value={el.id}>{el.number} {el.label}</option>
                                ))}
                              </optgroup>
                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-400"><svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg></div>
                    </div>
                                        <div className="text-xs text-zinc-500 mt-0.5">{currentElement ? `已选择: ${currentElement.label}` : '该位置将不显示任何内容'}</div>
                          </div>
                        {currentSlotValue && (
                                        <button onClick={() => handleSlotChange(index, '')} className="ml-4 p-1 text-zinc-300 hover:text-red-500 transition-colors"><XMarkIcon className="w-5 h-5" /></button>
                  )}
                </div>
                    );
                  })}
            </div>
              </div>
            </div>
          ) : (
             /* Option Config content */
            <div className="space-y-6">
                <Text className="text-sm text-zinc-600">在此处预设项目的标准选项，避免在生成编号时手动输入错误。</Text>
              <div className="space-y-4">
                    <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200"><h4 className="font-medium text-zinc-900 mb-2">检测类型 (Test Type)</h4><TagInput values={dictionaries.test_types} onChange={(vals) => setDictionaries({...dictionaries, test_types: vals})} placeholder="例如: PK, PD, ADA, Nab"/></div>
                    <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200"><h4 className="font-medium text-zinc-900 mb-2">周期/组别 (Cycle/Group)</h4><TagInput values={dictionaries.cycles} onChange={(vals) => setDictionaries({...dictionaries, cycles: vals})} placeholder="例如: A, B, 第1周期, 第2周期"/></div>
                <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200"><h4 className="font-medium text-zinc-900 mb-2">正份 (Primary)</h4><TagInput values={dictionaries.primary_types} onChange={(vals) => setDictionaries({...dictionaries, primary_types: vals})} placeholder="例如: a1, a2, a3"/></div>
                        <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200"><h4 className="font-medium text-zinc-900 mb-2">备份 (Backup)</h4><TagInput values={dictionaries.backup_types} onChange={(vals) => setDictionaries({...dictionaries, backup_types: vals})} placeholder="例如: b1, b2, b3"/></div>
                  </div>
                    <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200"><h4 className="font-medium text-zinc-900 mb-2">临床机构代码 (Clinic Code)</h4><TagInput values={dictionaries.clinic_codes} onChange={(vals) => setDictionaries({...dictionaries, clinic_codes: vals})} placeholder="例如: CHH, CENTER01"/></div>
              </div>
            </div>
          )}
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsConfigDialogOpen(false)}>取消</Button>
          <Button color="dark" onClick={handleSaveCodeRule} className="shadow-md">保存配置</Button>
        </DialogActions>
      </Dialog>

      {/* New Batch Generation Dialog (Fullscreen/Large) */}
      <Dialog open={isBatchGenerateDialogOpen} onClose={setIsBatchGenerateDialogOpen} size="7xl">
        <DialogTitle>临床样本编号管理</DialogTitle>
        <DialogDescription>生成、查看及打印临床样本编号</DialogDescription>
        <DialogBody>
            <Tabs 
                tabs={[
                    { key: 'clinical', label: '生成临床样本编号' }, 
                    { key: 'result', label: '查看临床样本编号' },
                    { key: 'stability', label: '稳定性及质控样本' }
                ]} 
                activeTab={activeGenerationTab} 
                onChange={(key) => setActiveGenerationTab(key)} 
                className="mb-6"
            />

            {activeGenerationTab === 'clinical' && (
                <div className="space-y-6">
                    {/* Data Entry for Dynamic Lists */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">临床机构 / 受试者编号数据源</label>
                  <ClinicSubjectTable
                    data={batchForm.clinicSubjectPairs}
                    onChange={(data) => setBatchForm({...batchForm, clinicSubjectPairs: data})}
                    clinicOptions={dictionaries.clinic_codes}
                    onImport={() => document.getElementById('clinic-subject-file')?.click()}
                  />
                            <input id="clinic-subject-file" type="file" accept=".xlsx,.xls" className="hidden" onChange={/* Reuse import logic */ async (e) => {
                        if (!e.target.files || !e.target.files[0]) return;
                        const form = new FormData();
                        form.append('file', e.target.files[0]);
                        try {
                          const res = await api.post(`/projects/${id}/import-clinic-subjects`, form, { headers: { 'Content-Type': 'multipart/form-data' }});
                                    const pairs = res.data.clinic_subject_pairs || [];
                                    setBatchForm(prev => ({...prev, clinicSubjectPairs: [...prev.clinicSubjectPairs, ...pairs]}));
                                    toast.success(`成功导入 ${pairs.length} 条`);
                                } catch { toast.error('导入失败'); }
                        e.currentTarget.value = '';
                            }} />
                </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">采血序号 / 时间数据源</label>
                  <SeqTimeTable
                    data={batchForm.seqTimePairs}
                    onChange={(data) => setBatchForm({...batchForm, seqTimePairs: data})}
                    onImport={() => document.getElementById('seqtime-file')?.click()}
                  />
                            <input id="seqtime-file" type="file" accept=".xlsx,.xls" className="hidden" onChange={async (e) => {
                        if (!e.target.files || !e.target.files[0]) return;
                        const form = new FormData();
                        form.append('file', e.target.files[0]);
                                try {
                        const res = await api.post(`/projects/${id}/import-seq-times`, form, { headers: { 'Content-Type': 'multipart/form-data' }});
                                    const arr = res.data.seq_time_pairs || [];
                                    setBatchForm(prev => ({...prev, seqTimePairs: [...prev.seqTimePairs, ...arr]}));
                                    toast.success(`成功导入 ${arr.length} 条`);
                                } catch { toast.error('导入失败'); }
                        e.currentTarget.value = '';
                            }} />
                </div>
              </div>

                    {/* Matrix Selection Grid */}
                    <Text className="font-semibold border-b border-zinc-100 pb-2">选择生成条件 (生成所选组合的样本编号)</Text>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 h-[400px]">
                        <MatrixColumn
                            title='周期/组别'
                            options={batchForm.cycles}
                            selected={batchForm.selectedCycles}
                            onSelectionChange={(l) => setBatchForm({...batchForm, selectedCycles: l})}
                            onAddOption={(opt) => {
                                setDictionaries(d => ({...d, cycles: [...d.cycles, opt]}));
                                setBatchForm(prev => ({...prev, cycles: [...prev.cycles, opt], selectedCycles: [...prev.selectedCycles, opt]}));
                            }}
                        />
                        <MatrixColumn
                            title='检测类型'
                            options={batchForm.testTypes}
                            selected={batchForm.selectedTestTypes}
                            onSelectionChange={(l) => setBatchForm({...batchForm, selectedTestTypes: l})}
                            onAddOption={(opt) => {
                                setDictionaries(d => ({...d, test_types: [...d.test_types, opt]}));
                                setBatchForm(prev => ({...prev, testTypes: [...prev.testTypes, opt], selectedTestTypes: [...prev.selectedTestTypes, opt]}));
                            }}
                        />
                        <MatrixColumn
                            title='正份 (套)'
                            options={batchForm.primary}
                            selected={batchForm.selectedPrimary}
                            onSelectionChange={(l) => setBatchForm({...batchForm, selectedPrimary: l})}
                            onAddOption={(opt) => {
                                setDictionaries(d => ({...d, primary_types: [...d.primary_types, opt]}));
                                setBatchForm(prev => ({...prev, primary: [...prev.primary, opt], selectedPrimary: [...prev.selectedPrimary, opt]}));
                            }}
                        />
                        <MatrixColumn
                            title='备份 (套)'
                            options={batchForm.backup}
                            selected={batchForm.selectedBackup}
                            onSelectionChange={(l) => setBatchForm({...batchForm, selectedBackup: l})}
                            onAddOption={(opt) => {
                                setDictionaries(d => ({...d, backup_types: [...d.backup_types, opt]}));
                                setBatchForm(prev => ({...prev, backup: [...prev.backup, opt], selectedBackup: [...prev.selectedBackup, opt]}));
                            }}
                        />
                        <MatrixColumn
                            title='采血序号, 时间'
                            options={batchForm.seqTimePairs.map(p => `${p.seq}|${p.time}`)}
                            selected={batchForm.selectedTimepoints}
                            onSelectionChange={(l) => setBatchForm({...batchForm, selectedTimepoints: l})}
                            action={
                                <Button plain className="!w-full !justify-center text-xs !py-1" onClick={() => document.getElementById('seqtime-file')?.click()}>
                                    <ArrowUpOnSquareIcon className="w-3 h-3 mr-1"/>导入 Excel
                                </Button>
                            }
                            emptyText="请点击下方按钮导入数据"
                        />
                        <MatrixColumn
                            title='受试者编号'
                            options={batchForm.clinicSubjectPairs.map(p => `${p.clinic}|${p.subject}`)}
                            selected={batchForm.selectedSubjects}
                            onSelectionChange={(l) => setBatchForm({...batchForm, selectedSubjects: l})}
                            action={
                                <Button plain className="!w-full !justify-center text-xs !py-1" onClick={() => document.getElementById('clinic-subject-file')?.click()}>
                                    <ArrowUpOnSquareIcon className="w-3 h-3 mr-1"/>导入 Excel
                                </Button>
                            }
                            emptyText="请点击下方按钮导入数据"
                        />
            </div>

                    <div className="flex justify-end mt-4">
                         <Button color="dark" onClick={handleViewSamples} disabled={isGeneratingCodes} className="!px-8">
                            {isGeneratingCodes ? '生成中...' : '查看'}
                         </Button>
                </div>
                </div>
            )}

            {activeGenerationTab === 'result' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between bg-zinc-50 p-2 rounded-lg border border-zinc-200">
                         <div className="flex items-center gap-3">
                            <Text className="font-medium ml-2">样本列表 ({generatedSamples.length})</Text>
                            {generatedSamples.length > 0 && (
                                <Badge color="zinc">
                                    已选 {selectedSamples.size}
                                </Badge>
                            )}
                </div>
                         <div className="flex gap-2">
                            <Button outline onClick={toggleAllSamples} className="!py-1.5">
                                {selectedSamples.size === generatedSamples.length ? '取消全选' : '全选'}
                            </Button>
                            <Button outline onClick={() => triggerPrint(generatedSamples.filter(s => selectedSamples.has(s.id)), 'list')} disabled={selectedSamples.size === 0} className="!py-1.5">
                                <PrinterIcon className="w-4 h-4 mr-1"/>打印清单
                            </Button>
                            <Button outline onClick={() => triggerPrint(generatedSamples.filter(s => selectedSamples.has(s.id)), 'label')} disabled={selectedSamples.size === 0} className="!py-1.5">
                                <PrinterIcon className="w-4 h-4 mr-1"/>打印标签
                            </Button>
              </div>
            </div>

                    <div className="border border-zinc-200 rounded-lg overflow-hidden">
                        <Table bleed striped className="w-full">
                            <TableHead>
                                <TableRow>
                                    <TableHeader className="w-12 text-center">
                                        <Checkbox 
                                            checked={generatedSamples.length > 0 && selectedSamples.size === generatedSamples.length} 
                                            onChange={toggleAllSamples}
                                        />
                                    </TableHeader>
                                    <TableHeader>申办方</TableHeader>
                                    <TableHeader>申办者项目编号</TableHeader>
                                    <TableHeader>临床试验研究室项目编号</TableHeader>
                                    <TableHeader>样本编号</TableHeader>
                                    <TableHeader>操作</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {generatedSamples.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12 text-zinc-500">
                                            <div className="flex flex-col items-center gap-3">
                                                <p>请先在"生成临床样本编号"中选择条件并生成</p>
                                                <Button onClick={() => setActiveGenerationTab('clinical')}>
                                                    去生成
                                                </Button>
                  </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    generatedSamples.map((sample) => (
                                        <TableRow key={sample.id}>
                                            <TableCell className="text-center">
                                                <Checkbox 
                                                    checked={selectedSamples.has(sample.id)} 
                                                    onChange={() => toggleSampleSelection(sample.id)}
                                                />
                                            </TableCell>
                                            <TableCell>{project?.sponsor?.name || '-'}</TableCell>
                                            <TableCell>{project?.sponsor_project_code}</TableCell>
                                            <TableCell>{project?.lab_project_code}</TableCell>
                                            <TableCell>
                                                <span className="font-mono font-medium text-zinc-900">{sample.code}</span>
                                                {sample.code !== sample.originalCode && <span className="ml-2 text-xs text-amber-600">(已修改)</span>}
                                            </TableCell>
                                            <TableCell>
                                                <Button plain onClick={() => {
                                                    setEditingSample({ id: sample.id, oldCode: sample.code, newCode: sample.code });
                                                    setIsEditInputOpen(true);
                                                }}>
                                                    <PencilSquareIcon className="w-4 h-4 text-zinc-500"/>
                                                    <span className="sr-only">编辑</span>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                      </div>
                  </div>
            )}

            {activeGenerationTab === 'stability' && (
                /* Reuse existing stability logic */
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">样本类别 *</label>
                            <Select value={stabilityQCParams.sample_category} onChange={(e) => setStabilityQCParams({...stabilityQCParams, sample_category: e.target.value})}>
                                <option value="">请选择</option><option value="STB">稳定性样本</option><option value="QC">质控样本</option>
                            </Select>
                  </div>
                        <div><label className="block text-sm font-medium text-zinc-700 mb-1">代码 *</label><Input value={stabilityQCParams.code} onChange={(e) => setStabilityQCParams({...stabilityQCParams, code: e.target.value})} placeholder="如：L, M, H"/></div>
                        <div><label className="block text-sm font-medium text-zinc-700 mb-1">数量 *</label><Input type="number" value={stabilityQCParams.quantity || ''} onChange={(e) => setStabilityQCParams({...stabilityQCParams, quantity: parseInt(e.target.value) || 0})} placeholder="生成数量"/></div>
                        <div><label className="block text-sm font-medium text-zinc-700 mb-1">起始编号 *</label><Input type="number" value={stabilityQCParams.start_number || ''} onChange={(e) => setStabilityQCParams({...stabilityQCParams, start_number: parseInt(e.target.value) || 1})} placeholder="如：31"/></div>
                      </div>
                    <div className="flex justify-end"><Button color="dark" onClick={handleGenerateStabilityQCCodes}><BeakerIcon />生成</Button></div>
                    {generatedQCCodes.length > 0 && (
                        <div className="bg-zinc-50 p-4 rounded border border-zinc-200">
                            <div className="font-medium mb-2">生成结果 ({generatedQCCodes.length})</div>
                            <div className="grid grid-cols-4 gap-2 font-mono text-sm">{generatedQCCodes.map((c, i) => <div key={i}>{c}</div>)}</div>
                  </div>
            )}
          </div>
            )}
        </DialogBody>
        <DialogActions>
             <Button plain onClick={() => setIsBatchGenerateDialogOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog ... */}
      <Dialog open={isDeleteDialogOpen} onClose={setIsDeleteDialogOpen}>
        <DialogTitle>删除项目</DialogTitle>
        <DialogDescription>删除后将无法恢复该项目及其配置。</DialogDescription>
        <DialogBody><p className="text-sm text-zinc-600">请确认项目下没有任何样本或流程数据再执行删除操作。</p></DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsDeleteDialogOpen(false)}>取消</Button>
          <Button color="red" onClick={handleDeleteProject} disabled={isDeleting}>{isDeleting ? '删除中…' : '确认删除'}</Button>
        </DialogActions>
      </Dialog>

      {/* Config Signature */}
      <ESignatureDialog
        open={isESignatureOpen}
        onClose={setIsESignatureOpen}
        onConfirm={handleESignatureConfirm}
        requireReason={false}
        title="确认保存规则"
        description="请验证密码以保存样本编号规则配置。"
      />

      {/* Edit Sample Code - Step 1: Input */}
      {editingSample && (
        <Dialog open={isEditInputOpen} onClose={() => setIsEditInputOpen(false)}>
            <DialogTitle>修改样本编号</DialogTitle>
            <DialogBody>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700">原编号</label>
                        <div className="mt-1 p-2 bg-zinc-100 rounded text-zinc-600">{editingSample.oldCode}</div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700">新编号</label>
                        <Input 
                            value={editingSample.newCode} 
                            onChange={e => setEditingSample({...editingSample, newCode: e.target.value})}
                            className="mt-1"
                        />
                    </div>
                    <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-800 border border-yellow-200">
                        注意：修改样本编号需要电子签名确认，并将记录在审计日志中。
                    </div>
                </div>
            </DialogBody>
            <DialogActions>
                <Button plain onClick={() => setIsEditInputOpen(false)}>取消</Button>
                <Button color="dark" onClick={() => {
                    setIsEditInputOpen(false);
                    setIsEditVerifyOpen(true);
                }}>
                     下一步 (签名)
                </Button>
            </DialogActions>
        </Dialog>
      )}
      
      {/* Edit Sample Code - Step 2: Signature Verification */}
       <ESignatureDialog
        open={isEditVerifyOpen}
        onClose={() => setIsEditVerifyOpen(false)}
        onConfirm={handleEditSignatureConfirm}
        title="确认修改样本编号"
        description="请验证密码并输入修改原因以完成操作。"
        requireReason={true}
        reasonLabel="修改原因"
        reasonPlaceholder="例如：编号生成规则调整"
      />
    </AppLayout>
  );
}
