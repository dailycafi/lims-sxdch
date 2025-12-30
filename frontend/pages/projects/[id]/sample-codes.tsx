import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Heading } from '@/components/heading';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { Tabs } from '@/components/tabs';
import { api, extractDetailMessage } from '@/lib/api';
import { ESignatureDialog } from '@/components/e-signature-dialog';
import { useAuthStore } from '@/store/auth';
import { 
  PrinterIcon, 
  XMarkIcon, 
  PlusIcon, 
  BeakerIcon,
  PencilSquareIcon,
  MagnifyingGlassIcon,
  ArrowUpOnSquareIcon,
  ChevronLeftIcon,
  DocumentTextIcon,
  CheckCircleIcon
} from '@heroicons/react/20/solid';
import JsBarcode from 'jsbarcode';
import clsx from 'clsx';

// --- Sub-components copied from [id].tsx ---

function ClinicSubjectTable({ 
  data, 
  onChange, 
  clinicOptions 
}: { 
  data: { clinic: string; subject: string }[], 
  onChange: (data: { clinic: string; subject: string }[]) => void,
  clinicOptions: string[]
}) {
  const addRow = () => onChange([...data, { clinic: '', subject: '' }]);
  const updateRow = (index: number, field: 'clinic' | 'subject', value: string) => {
    const newData = [...data];
    newData[index] = { ...newData[index], [field]: value };
    onChange(newData);
  };
  const removeRow = (index: number) => onChange(data.filter((_, i) => i !== index));

  return (
    <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-2 flex items-center justify-between">
        <div className="font-medium text-sm text-zinc-700">列表 ({data.length})</div>
        <Button plain onClick={addRow} className="!py-1 !px-2 text-xs text-blue-600">
          <PlusIcon className="w-3 h-3 mr-1"/>添加
        </Button>
      </div>
      <div className="max-h-60 overflow-y-auto min-h-[100px]">
        <Table bleed dense>
          <TableHead>
            <TableRow>
              <TableHeader className="!py-1">临床机构代码</TableHeader>
              <TableHeader className="!py-1">受试者编号</TableHeader>
              <TableHeader className="!py-1 w-10"></TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-zinc-400 text-xs">暂无数据，请添加</TableCell>
              </TableRow>
            ) : (
              data.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="!py-1">
                    <Select value={row.clinic} onChange={(e) => updateRow(i, 'clinic', e.target.value)} className="!py-1 !text-xs">
                      <option value="">请选择</option>
                      {clinicOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </Select>
                  </TableCell>
                  <TableCell className="!py-1">
                    <Input value={row.subject} onChange={(e) => updateRow(i, 'subject', e.target.value)} className="!py-1 !text-xs" placeholder="如: 001" />
                  </TableCell>
                  <TableCell className="!py-1">
                    <button onClick={() => removeRow(i)} className="p-1 text-zinc-300 hover:text-red-500 transition-colors"><XMarkIcon className="w-4 h-4"/></button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
  onImport?: () => void
}) {
  const addRow = () => onChange([...data, { seq: '', time: '' }]);
  const updateRow = (index: number, field: 'seq' | 'time', value: string) => {
    const newData = [...data];
    newData[index] = { ...newData[index], [field]: value };
    onChange(newData);
  };
  const removeRow = (index: number) => onChange(data.filter((_, i) => i !== index));

  return (
    <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-2 flex items-center justify-between">
        <div className="font-medium text-sm text-zinc-700">列表 ({data.length})</div>
        <div className="flex gap-2">
            {onImport && (
                <Button plain onClick={onImport} className="!py-1 !px-2 text-xs text-green-600">
                    <ArrowUpOnSquareIcon className="w-3 h-3 mr-1"/>导入
                </Button>
            )}
            <Button plain onClick={addRow} className="!py-1 !px-2 text-xs text-blue-600">
                <PlusIcon className="w-3 h-3 mr-1"/>添加
            </Button>
        </div>
      </div>
      <div className="max-h-60 overflow-y-auto min-h-[100px]">
        <Table bleed dense>
          <TableHead>
            <TableRow>
              <TableHeader className="!py-1">采血序号</TableHeader>
              <TableHeader className="!py-1">采血时间</TableHeader>
              <TableHeader className="!py-1 w-10"></TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-zinc-400 text-xs">暂无数据，请添加</TableCell>
              </TableRow>
            ) : (
              data.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="!py-1">
                    <Input value={row.seq} onChange={(e) => updateRow(i, 'seq', e.target.value)} className="!py-1 !text-xs" placeholder="如: 01" />
                  </TableCell>
                  <TableCell className="!py-1">
                    <Input value={row.time} onChange={(e) => updateRow(i, 'time', e.target.value)} className="!py-1 !text-xs" placeholder="如: Pre-dose" />
                  </TableCell>
                  <TableCell className="!py-1">
                    <button onClick={() => removeRow(i)} className="p-1 text-zinc-300 hover:text-red-500 transition-colors"><XMarkIcon className="w-4 h-4"/></button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
  action
}: {
  title: string;
  options: string[];
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
  onAddOption?: (opt: string) => void;
  action?: React.ReactNode;
}) {
  const [newOpt, setNewOpt] = useState('');
  const toggleSelection = (opt: string) => {
    if (selected.includes(opt)) onSelectionChange(selected.filter(s => s !== opt));
    else onSelectionChange([...selected, opt]);
  };
  const toggleAll = () => {
    if (selected.length === options.length) onSelectionChange([]);
    else onSelectionChange([...options]);
  };

  return (
    <div className="flex flex-col h-full border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <div className="bg-zinc-50 border-b border-zinc-200 p-3">
        <div className="flex items-center justify-between mb-2">
            <Text className="font-bold text-xs text-zinc-900 uppercase tracking-wider">{title}</Text>
            <button onClick={toggleAll} className="text-[10px] text-blue-600 font-semibold hover:text-blue-700">
                {selected.length === options.length ? '取消' : '全选'}
            </button>
        </div>
        {onAddOption && (
            <div className="flex gap-1">
                <Input value={newOpt} onChange={e => setNewOpt(e.target.value)} onKeyDown={e => e.key === 'Enter' && (onAddOption(newOpt), setNewOpt(''))} className="!py-1 !text-xs" placeholder="新增..." />
                <Button outline onClick={() => { onAddOption(newOpt); setNewOpt(''); }} className="!p-1"><PlusIcon className="w-3 h-3"/></Button>
            </div>
        )}
        {action}
      </div>
      <div className="flex-1 overflow-y-auto p-1 space-y-0.5 min-h-[150px]">
        {options.map(opt => (
          <div key={opt} onClick={() => toggleSelection(opt)} className={clsx("group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all", selected.includes(opt) ? "bg-blue-50 text-blue-700" : "hover:bg-zinc-50 text-zinc-600")}>
            <div className={clsx("w-3.5 h-3.5 border rounded flex-shrink-0 flex items-center justify-center transition-colors", selected.includes(opt) ? "bg-blue-600 border-blue-600" : "border-zinc-300 bg-white")}>
                {selected.includes(opt) && <CheckCircleIcon className="w-2.5 h-2.5 text-white" />}
            </div>
            <span className="text-xs font-medium truncate">{opt}</span>
          </div>
        ))}
        {options.length === 0 && <div className="text-center py-10 text-zinc-400 text-[10px]">暂无选项</div>}
      </div>
    </div>
  );
}

// --- Main Page Component ---

const statusColors: Record<string, any> = {
  pending: 'yellow',
  received: 'blue',
  in_storage: 'green',
  checked_out: 'orange',
  transferred: 'purple',
  destroyed: 'red',
  returned: 'green',
};

const statusLabels: Record<string, string> = {
  pending: '待接收',
  received: '已接收',
  in_storage: '在库',
  checked_out: '已领用',
  transferred: '已转移',
  destroyed: '已销毁',
  returned: '已归还',
};

export default function ProjectSampleCodesPage() {
  const router = useRouter();
  const { id, tab } = router.query;
  const { user } = useAuthStore();
  
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeGenerationTab, setActiveGenerationTab] = useState(tab as string || 'clinical');
  const [isGeneratingCodes, setIsGeneratingCodes] = useState(false);
  
  const [dictionaries, setDictionaries] = useState({
    cycles: [] as string[],
    test_types: [] as string[],
    primary_types: [] as string[],
    backup_types: [] as string[],
    clinic_codes: [] as string[],
  });

  const [batchForm, setBatchForm] = useState({
    cycles: [] as string[],
    testTypes: [] as string[],
    primary: [] as string[],
    backup: [] as string[],
    clinicSubjectPairs: [] as { clinic: string; subject: string }[],
    seqTimePairs: [] as { seq: string; time: string }[],
    selectedCycles: [] as string[],
    selectedTestTypes: [] as string[],
    selectedPrimary: [] as string[],
    selectedBackup: [] as string[],
    selectedSubjects: [] as string[],
    selectedTimepoints: [] as string[],
  });

  const [generatedSamples, setGeneratedSamples] = useState<any[]>([]);
  const [projectSamples, setProjectSamples] = useState<any[]>([]);
  const [isLoadingProjectSamples, setIsLoadingProjectSamples] = useState(false);
  const [selectedSamples, setSelectedSamples] = useState<Set<string>>(new Set());

  const [quickAddForm, setQuickAddForm] = useState({
    subject: '', cycle: '', testType: '', seq: '', time: '', stype: ''
  });
  const [quickAddPreview, setQuickAddPreview] = useState('');

  const [stabilityQCParams, setStabilityQCParams] = useState({
    sample_category: '', code: '', quantity: 0, start_number: 1
  });
  const [generatedQCCodes, setGeneratedQCCodes] = useState<string[]>([]);

  const [editingSample, setEditingSample] = useState<any | null>(null);
  const [isEditInputOpen, setIsEditInputOpen] = useState(false);
  const [isEditVerifyOpen, setIsEditVerifyOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProject();
    }
  }, [id]);

  useEffect(() => {
    if (tab) {
        setActiveGenerationTab(tab as string);
    }
  }, [tab]);

  useEffect(() => {
    if (activeGenerationTab === 'result' && id) {
      fetchProjectSamples();
    }
  }, [activeGenerationTab, id]);

  const fetchProject = async () => {
    try {
      const response = await api.get(`/projects/${id}`);
      setProject(response.data);
      const rule = response.data.sample_code_rule;
      if (rule && rule.dictionaries) {
        setDictionaries({
          cycles: rule.dictionaries.cycles || [],
          test_types: rule.dictionaries.test_types || [],
          primary_types: rule.dictionaries.primary_types || [],
          backup_types: rule.dictionaries.backup_types || [],
          clinic_codes: rule.dictionaries.clinic_codes || [],
        });
        setBatchForm(prev => ({
          ...prev,
          cycles: rule.dictionaries.cycles || [],
          testTypes: rule.dictionaries.test_types || [],
          primary: rule.dictionaries.primary_types || [],
          backup: rule.dictionaries.backup_types || [],
        }));
      }
    } catch (error) {
      console.error('Failed to fetch project details:', error);
      toast.error('项目加载失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectSamples = async () => {
    if (!id) return;
    setIsLoadingProjectSamples(true);
    try {
      const response = await api.get(`/samples?project_id=${id}&limit=1000`);
      const formatted = response.data.map((s: any) => ({
        id: s.id,
        code: s.sample_code,
        originalCode: s.sample_code,
        sponsor_project_code: project?.sponsor_project_code,
        lab_project_code: project?.lab_project_code,
        isExisting: true,
        status: s.status,
      }));
      setProjectSamples(formatted);
    } catch (error) {
      console.error('Failed to fetch project samples', error);
    } finally {
      setIsLoadingProjectSamples(false);
    }
  };

  const handleQuickAdd = async () => {
    const payload = {
        cycles: [quickAddForm.cycle],
        test_types: [quickAddForm.testType],
        primary: dictionaries.primary_types.includes(quickAddForm.stype) ? [quickAddForm.stype] : [],
        backup: dictionaries.backup_types.includes(quickAddForm.stype) ? [quickAddForm.stype] : [],
        subjects: [quickAddForm.subject],
        seq_time_pairs: [{ seq: quickAddForm.seq, time: quickAddForm.time }],
        clinic_codes: [project?.clinical_org?.name || '']
    };
    try {
        const response = await api.post(`/projects/${id}/generate-sample-codes`, payload);
        if (response.data?.sample_codes?.length > 0) {
            setQuickAddPreview(response.data.sample_codes[0]);
        }
    } catch (e) {
        toast.error('生成预览失败');
    }
  };

  const addQuickAddToList = () => {
    if (!quickAddPreview) return;
    const newSample = {
        id: `GEN-${Date.now()}-QA`,
        code: quickAddPreview,
        originalCode: quickAddPreview,
        sponsor_project_code: project?.sponsor_project_code,
        lab_project_code: project?.lab_project_code,
    };
    setGeneratedSamples(prev => [newSample, ...prev]);
    setActiveGenerationTab('result');
    setQuickAddPreview('');
    setQuickAddForm({ subject: '', cycle: '', testType: '', seq: '', time: '', stype: '' });
    toast.success('已添加到结果列表');
  };

  const handleViewSamples = async () => {
    const { selectedCycles, selectedTestTypes, selectedPrimary, selectedBackup, selectedSubjects, selectedTimepoints } = batchForm;
    if (selectedCycles.length === 0 && selectedTestTypes.length === 0 && selectedPrimary.length === 0 && selectedBackup.length === 0 && selectedSubjects.length === 0 && selectedTimepoints.length === 0) {
        toast.error('请至少选择一个条件进行生成');
      return;
    }
    setIsGeneratingCodes(true);
    try {
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
      const samples = codes.map((code, index) => ({
        id: `QC-${Date.now()}-${index}`,
        code,
        originalCode: code,
        sponsor_project_code: project?.sponsor_project_code,
        lab_project_code: project?.lab_project_code,
      }));
      setGeneratedSamples(samples);
      setGeneratedQCCodes(codes);
      setActiveGenerationTab('result');
      toast.success(`成功生成 ${response.data.count} 个${categoryLabel}样本编号`);
      setStabilityQCParams({ sample_category: '', code: '', quantity: 0, start_number: 1 });
    } catch (error) {
      console.error('生成失败:', error);
      toast.error('生成失败');
    }
  };

  const generateBarcodeDataUrl = (text: string) => {
    if (typeof document === 'undefined') return '';
    const canvas = document.createElement('canvas');
    try {
      JsBarcode(canvas, text, {
        format: "CODE128", width: 1.5, height: 40, displayValue: true, fontSize: 14, margin: 0
      });
      return canvas.toDataURL('image/png');
    } catch (e) {
      console.error('Barcode failed', e);
      return '';
    }
  };

  const triggerPrint = (samples: any[], mode: 'list' | 'label' = 'list') => {
    if (typeof window === 'undefined') return;
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) {
      toast.error('浏览器阻止了打印窗口');
      return;
    }
    const generatedAt = new Date().toLocaleString('zh-CN');
    const projectLabel = project?.lab_project_code || project?.sponsor_project_code || '项目';
    let content = '';
    if (mode === 'label') {
      const barcodes = samples.map(s => ({ code: s.code, src: generateBarcodeDataUrl(s.code) }));
      content = `<div class="labels">${barcodes.map(item => `<div class="label"><img src="${item.src}" alt="${item.code}" /></div>`).join('')}</div>`;
    } else {
      content = `
        <div class="header"><h1>样本编号列表</h1><p>项目：${projectLabel} | 打印时间：${generatedAt}</p></div>
        <table>
          <thead><tr><th>序号</th><th>申办方</th><th>实验室项目编号</th><th>样本编号</th></tr></thead>
          <tbody>${samples.map((s, i) => `<tr><td>${i + 1}</td><td>${project?.sponsor?.name || '-'}</td><td>${project?.lab_project_code || '-'}</td><td class="code">${s.code}</td></tr>`).join('')}</tbody>
        </table>`;
    }
    printWindow.document.write(`<html><head><style>
      body { font-family: sans-serif; padding: 20px; }
      .header { text-align: center; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #000; padding: 6px; text-align: center; }
      .code { font-family: monospace; font-weight: bold; }
      .labels { display: grid; grid-template-columns: repeat(auto-fill, 50mm); gap: 5mm; }
      .label { width: 50mm; height: 30mm; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; padding: 2mm; box-sizing: border-box; page-break-inside: avoid; }
      .label img { max-width: 100%; max-height: 100%; }
      @media print { .label { border: none; } }
    </style></head><body>${content}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const displaySamples = useMemo(() => {
    return generatedSamples.length > 0 ? generatedSamples : projectSamples;
  }, [generatedSamples, projectSamples]);

  const toggleSampleSelection = (id: string) => {
    const newSet = new Set(selectedSamples);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedSamples(newSet);
  };

  const toggleAllSamples = () => {
    if (selectedSamples.size === displaySamples.length) setSelectedSamples(new Set());
    else setSelectedSamples(new Set(displaySamples.map(s => s.id)));
  };

  const handleEditVerifyConfirm = async (password: string, reasonText: string) => {
    if (!editingSample) return;
    try {
      await api.post('/auth/verify-signature', { password, purpose: 'edit_sample_code' });
      const newSamples = generatedSamples.map(s => {
        if (s.id === editingSample.id) return { ...s, code: editingSample.newCode };
        return s;
      });
      setGeneratedSamples(newSamples);
      setEditingSample(null);
      setIsEditVerifyOpen(false);
      toast.success('样本编号已修改');
    } catch (error: any) {
       throw new Error(extractDetailMessage(error.response?.data) || '验证失败');
    }
  };

  if (loading) return <AppLayout><div className="flex justify-center items-center h-64"><Text>加载中...</Text></div></AppLayout>;
  if (!project) return <AppLayout><div className="flex justify-center items-center h-64"><Text>项目不存在</Text></div></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
            <button onClick={() => router.back()} className="flex items-center text-sm text-zinc-500 hover:text-zinc-700 transition-colors mb-2">
                <ChevronLeftIcon className="w-4 h-4 mr-1"/> 返回项目详情
            </button>
            <div className="flex items-center justify-between">
                <div>
                    <Heading>样本编号管理</Heading>
                    <Text className="mt-1">项目：{project.lab_project_code} ({project.sponsor?.name})</Text>
                </div>
                <div className="flex gap-3">
                    <Button outline onClick={() => triggerPrint(displaySamples.filter(s => selectedSamples.has(s.id)), 'list')} disabled={selectedSamples.size === 0}>
                        <PrinterIcon className="w-4 h-4 mr-1"/> 打印清单
                    </Button>
                    <Button color="dark" onClick={() => triggerPrint(displaySamples.filter(s => selectedSamples.has(s.id)), 'label')} disabled={selectedSamples.size === 0}>
                        <PrinterIcon className="w-4 h-4 mr-1"/> 打印标签
                    </Button>
                </div>
            </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
            <div className="border-b border-zinc-200 bg-zinc-50/50 px-6">
                <Tabs 
                    tabs={[
                        { key: 'clinical', label: '生成临床样本编号' }, 
                        { key: 'result', label: '查看/打印编号' },
                        { key: 'stability', label: '稳定性及质控样本' }
                    ]} 
                    activeTab={activeGenerationTab} 
                    onChange={(key) => setActiveGenerationTab(key)} 
                    className="!mb-0"
                />
            </div>

            <div className="p-6">
                {activeGenerationTab === 'clinical' && (
                    <div className="space-y-8">
                        {/* Quick Add Section */}
                        <div className="bg-blue-50/40 p-5 rounded-2xl border border-blue-100 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <Text className="font-semibold text-blue-900 flex items-center gap-2">
                                    <PlusIcon className="w-5 h-5" /> 快速单条添加
                                </Text>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
                                <div><label className="block text-[10px] uppercase font-bold text-blue-600 mb-1">受试者编号</label><Input className="!bg-white" placeholder="如: 001" onChange={e => setQuickAddForm({...quickAddForm, subject: e.target.value})} value={quickAddForm.subject}/></div>
                                <div><label className="block text-[10px] uppercase font-bold text-blue-600 mb-1">周期</label><Select className="!bg-white" onChange={e => setQuickAddForm({...quickAddForm, cycle: e.target.value})} value={quickAddForm.cycle}><option value="">选择</option>{dictionaries.cycles.map(opt => <option key={opt} value={opt}>{opt}</option>)}</Select></div>
                                <div><label className="block text-[10px] uppercase font-bold text-blue-600 mb-1">检测类型</label><Select className="!bg-white" onChange={e => setQuickAddForm({...quickAddForm, testType: e.target.value})} value={quickAddForm.testType}><option value="">选择</option>{dictionaries.test_types.map(opt => <option key={opt} value={opt}>{opt}</option>)}</Select></div>
                                <div><label className="block text-[10px] uppercase font-bold text-blue-600 mb-1">采血序号</label><Input className="!bg-white" placeholder="如: 01" onChange={e => setQuickAddForm({...quickAddForm, seq: e.target.value})} value={quickAddForm.seq}/></div>
                                <div><label className="block text-[10px] uppercase font-bold text-blue-600 mb-1">正/备</label><Select className="!bg-white" onChange={e => setQuickAddForm({...quickAddForm, stype: e.target.value})} value={quickAddForm.stype}><option value="">选择</option>{[...dictionaries.primary_types, ...dictionaries.backup_types].map(opt => <option key={opt} value={opt}>{opt}</option>)}</Select></div>
                                <Button className="w-full" onClick={handleQuickAdd} disabled={!quickAddForm.subject || !quickAddForm.cycle}>生成预览</Button>
                            </div>
                            {quickAddPreview && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-3 bg-white border border-blue-200 rounded-xl flex items-center justify-between shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium text-blue-600">预览结果:</span>
                                        <code className="font-mono font-bold text-base text-zinc-900 bg-zinc-100 px-3 py-1 rounded-lg">{quickAddPreview}</code>
                                    </div>
                                    <Button plain onClick={addQuickAddToList} className="text-blue-600 font-semibold"><PlusIcon className="w-4 h-4 mr-1"/>添加到结果列表</Button>
                                </motion.div>
                            )}
                        </div>

                        {/* Batch Config */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <label className="text-sm font-bold text-zinc-700 block px-1">数据源 A: 临床机构与受试者</label>
                                <ClinicSubjectTable data={batchForm.clinicSubjectPairs} onChange={d => setBatchForm({...batchForm, clinicSubjectPairs: d})} clinicOptions={dictionaries.clinic_codes} />
                            </div>
                            <div className="space-y-4">
                                <label className="text-sm font-bold text-zinc-700 block px-1">数据源 B: 采血序号与时间</label>
                                <SeqTimeTable 
                                    data={batchForm.seqTimePairs} 
                                    onChange={d => setBatchForm({...batchForm, seqTimePairs: d})} 
                                    onImport={() => document.getElementById('seqtime-file')?.click()}
                                />
                                <input id="seqtime-file" type="file" accept=".xlsx,.xls" className="hidden" onChange={async (e) => {
                                    if (!e.target.files?.[0]) return;
                                    const form = new FormData();
                                    form.append('file', e.target.files[0]);
                                    try {
                                        const res = await api.post(`/projects/${id}/import-seq-times`, form, { headers: { 'Content-Type': 'multipart/form-data' }});
                                        setBatchForm(prev => ({...prev, seqTimePairs: [...prev.seqTimePairs, ...(res.data.seq_time_pairs || [])]}));
                                        toast.success('导入成功');
                                    } catch { toast.error('导入失败'); }
                                    e.currentTarget.value = '';
                                }} />
                            </div>
                        </div>

                        {/* Matrix Selection */}
                        <div className="pt-4">
                            <div className="flex items-center justify-between mb-4 border-b border-zinc-100 pb-2">
                                <div>
                                    <Text className="font-bold text-zinc-900">组合生成条件 (笛卡尔积)</Text>
                                    <p className="text-xs text-zinc-500 mt-1">系统将自动组合所选各列的所有选项生成编号</p>
                                </div>
                                <div className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-sm">
                                    预估总计: {
                                        (batchForm.selectedSubjects.length || 0) * 
                                        (batchForm.selectedCycles.length || 1) * 
                                        (batchForm.selectedTestTypes.length || 1) * 
                                        (batchForm.selectedTimepoints.length || 1) * 
                                        ((batchForm.selectedPrimary.length + batchForm.selectedBackup.length) || 1)
                                    } 个样本
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 h-[400px]">
                                <MatrixColumn title='周期/组别' options={batchForm.cycles} selected={batchForm.selectedCycles} onSelectionChange={l => setBatchForm({...batchForm, selectedCycles: l})} onAddOption={opt => { setDictionaries(d => ({...d, cycles: [...d.cycles, opt]})); setBatchForm(prev => ({...prev, cycles: [...prev.cycles, opt], selectedCycles: [...prev.selectedCycles, opt]})); }} />
                                <MatrixColumn title='检测类型' options={batchForm.testTypes} selected={batchForm.selectedTestTypes} onSelectionChange={l => setBatchForm({...batchForm, selectedTestTypes: l})} onAddOption={opt => { setDictionaries(d => ({...d, test_types: [...d.test_types, opt]})); setBatchForm(prev => ({...prev, testTypes: [...prev.testTypes, opt], selectedTestTypes: [...prev.selectedTestTypes, opt]})); }} />
                                <MatrixColumn title='正份' options={batchForm.primary} selected={batchForm.selectedPrimary} onSelectionChange={l => setBatchForm({...batchForm, selectedPrimary: l})} onAddOption={opt => { setDictionaries(d => ({...d, primary_types: [...d.primary_types, opt]})); setBatchForm(prev => ({...prev, primary: [...prev.primary, opt], selectedPrimary: [...prev.selectedPrimary, opt]})); }} />
                                <MatrixColumn title='备份' options={batchForm.backup} selected={batchForm.selectedBackup} onSelectionChange={l => setBatchForm({...batchForm, selectedBackup: l})} onAddOption={opt => { setDictionaries(d => ({...d, backup_types: [...d.backup_types, opt]})); setBatchForm(prev => ({...prev, backup: [...prev.backup, opt], selectedBackup: [...prev.selectedBackup, opt]})); }} />
                                <MatrixColumn title='受试者 (从 A 选择)' options={batchForm.clinicSubjectPairs.map(p => `${p.clinic}|${p.subject}`)} selected={batchForm.selectedSubjects} onSelectionChange={l => setBatchForm({...batchForm, selectedSubjects: l})} />
                            </div>
                        </div>

                        <div className="flex justify-center pt-6">
                            <Button color="dark" onClick={handleViewSamples} disabled={isGeneratingCodes} className="!px-12 !py-3 !text-base shadow-xl hover:scale-[1.02] transition-transform">
                                {isGeneratingCodes ? '生成中...' : '开始批量生成并预览'}
                            </Button>
                        </div>
                    </div>
                )}

                {activeGenerationTab === 'result' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between bg-zinc-50 p-3 rounded-2xl border border-zinc-200 shadow-sm">
                            <div className="flex items-center gap-4">
                                <Text className="font-bold text-zinc-900 ml-2">
                                    {generatedSamples.length > 0 ? '🎉 预览新生成的编号' : '📋 已存入系统的样本编号'} 
                                    <span className="ml-2 text-zinc-400 font-normal">({displaySamples.length})</span>
                                </Text>
                                <Badge color="blue" className="!px-3 !py-1">已选择 {selectedSamples.size}</Badge>
                            </div>
                            <div className="flex gap-2">
                                {generatedSamples.length > 0 && (
                                    <Button outline onClick={() => { setGeneratedSamples([]); setSelectedSamples(new Set()); }} className="text-zinc-600">清空预览</Button>
                                )}
                                <Button outline onClick={toggleAllSamples}>
                                    {selectedSamples.size === displaySamples.length ? '取消全选' : '全部选择'}
                                </Button>
                            </div>
                        </div>

                        <div className="border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                            <Table bleed striped>
                                <TableHead>
                                    <TableRow className="!bg-zinc-50">
                                        <TableHeader className="w-12 text-center"><Checkbox checked={displaySamples.length > 0 && selectedSamples.size === displaySamples.length} onChange={toggleAllSamples}/></TableHeader>
                                        <TableHeader>样本编号</TableHeader>
                                        <TableHeader>状态</TableHeader>
                                        <TableHeader>实验室编号</TableHeader>
                                        <TableHeader>申办方编号</TableHeader>
                                        <TableHeader className="w-20">操作</TableHeader>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {displaySamples.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-20 text-zinc-500">
                                                {isLoadingProjectSamples ? (
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="w-8 h-8 border-4 border-zinc-200 border-t-blue-600 rounded-full animate-spin"></div>
                                                        <p>正在读取样本数据...</p>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-4">
                                                        <div className="p-4 bg-zinc-50 rounded-full text-zinc-300"><DocumentTextIcon className="w-12 h-12"/></div>
                                                        <p className="font-medium">当前暂无编号</p>
                                                        <Button color="dark" onClick={() => setActiveGenerationTab('clinical')}>立即去生成</Button>
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        displaySamples.map((sample) => (
                                            <TableRow key={sample.id} className="hover:bg-blue-50/30 transition-colors">
                                                <TableCell className="text-center">
                                                    <Checkbox checked={selectedSamples.has(sample.id)} onChange={() => toggleSampleSelection(sample.id)}/>
                                                </TableCell>
                                                <TableCell><span className="font-mono font-bold text-zinc-900 tracking-tight">{sample.code}</span></TableCell>
                                                <TableCell>
                                                    {sample.isExisting ? (
                                                        <Badge color={statusColors[sample.status] || 'zinc'}>{statusLabels[sample.status] || sample.status}</Badge>
                                                    ) : (
                                                        <Badge color="yellow" className="animate-pulse">新生成 (预览)</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-zinc-500 text-xs font-medium">{project.lab_project_code}</TableCell>
                                                <TableCell className="text-zinc-500 text-xs font-medium">{project.sponsor_project_code}</TableCell>
                                                <TableCell>
                                                    <Button plain onClick={() => { setEditingSample({ id: sample.id, oldCode: sample.code, newCode: sample.code }); setIsEditInputOpen(true); }} className="hover:text-blue-600">
                                                        <PencilSquareIcon className="w-4 h-4"/>
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
                    <div className="max-w-2xl mx-auto py-10">
                        <div className="bg-zinc-50 p-8 rounded-3xl border border-zinc-200 shadow-sm space-y-6">
                            <div className="flex items-center gap-3 border-b border-zinc-200 pb-4">
                                <BeakerIcon className="w-8 h-8 text-blue-600"/>
                                <div>
                                    <h3 className="text-lg font-bold text-zinc-900">稳定性及质控样本生成</h3>
                                    <p className="text-xs text-zinc-500">用于生成具有特定前缀和递增序号的质控样本编号</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-zinc-600 uppercase">样本类别 *</label>
                                    <Select value={stabilityQCParams.sample_category} onChange={e => setStabilityQCParams({...stabilityQCParams, sample_category: e.target.value})} className="!py-2.5">
                                        <option value="">请选择</option><option value="STB">稳定性样本 (STB)</option><option value="QC">质控样本 (QC)</option>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-zinc-600 uppercase">标识代码 *</label>
                                    <Input value={stabilityQCParams.code} onChange={e => setStabilityQCParams({...stabilityQCParams, code: e.target.value})} placeholder="如: L, M, H" className="!py-2.5"/>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-zinc-600 uppercase">生成数量 *</label>
                                    <Input type="number" value={stabilityQCParams.quantity || ''} onChange={e => setStabilityQCParams({...stabilityQCParams, quantity: parseInt(e.target.value) || 0})} placeholder="所需生成的总数" className="!py-2.5"/>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-zinc-600 uppercase">起始序号 *</label>
                                    <Input type="number" value={stabilityQCParams.start_number || ''} onChange={e => setStabilityQCParams({...stabilityQCParams, start_number: parseInt(e.target.value) || 1})} placeholder="如: 1" className="!py-2.5"/>
                                </div>
                            </div>
                            <Button color="dark" className="w-full !py-3 !text-base shadow-lg" onClick={handleGenerateStabilityQCCodes}>
                                <CheckCircleIcon className="w-5 h-5 mr-2"/> 确认生成样本编号
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Edit Dialogs */}
        <Dialog open={isEditInputOpen} onClose={setIsEditInputOpen}>
            <DialogTitle>编辑样本编号</DialogTitle>
            <DialogBody>
                <div className="space-y-4 pt-2">
                    <div><label className="block text-xs font-bold text-zinc-500 mb-1">原编号</label><div className="p-3 bg-zinc-50 rounded-lg font-mono text-sm text-zinc-400 border border-zinc-100">{editingSample?.oldCode}</div></div>
                    <div><label className="block text-xs font-bold text-zinc-700 mb-1">新编号 *</label><Input value={editingSample?.newCode || ''} onChange={e => setEditingSample({...editingSample, newCode: e.target.value})} className="!font-mono !text-base" autoFocus/></div>
                </div>
            </DialogBody>
            <DialogActions>
                <Button plain onClick={() => setIsEditInputOpen(false)}>取消</Button>
                <Button color="dark" onClick={() => { setIsEditInputOpen(false); setIsEditVerifyOpen(true); }}>确认修改</Button>
            </DialogActions>
        </Dialog>

        <ESignatureDialog 
            open={isEditVerifyOpen} 
            onClose={setIsEditVerifyOpen} 
            onConfirm={handleEditVerifyConfirm} 
            title="确认修改编号" 
            description="修改样本编号需要进行电子签名校验，请验证您的身份密码。"
        />
      </div>
    </AppLayout>
  );
}

