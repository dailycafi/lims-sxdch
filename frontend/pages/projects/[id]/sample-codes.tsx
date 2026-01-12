import { useState, useEffect, useMemo, KeyboardEvent } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Checkbox } from '@/components/checkbox';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Heading } from '@/components/heading';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Tabs } from '@/components/tabs';
import { ESignatureDialog } from '@/components/e-signature-dialog';
import { Divider } from '@/components/divider';
import { api, extractDetailMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import JsBarcode from 'jsbarcode';
import {
  PlusIcon, XMarkIcon, PrinterIcon,
  PencilSquareIcon, ArrowUpOnSquareIcon, MagnifyingGlassIcon, DocumentTextIcon, BeakerIcon, ChevronLeftIcon
} from '@heroicons/react/20/solid';
import { TagInput } from '@/components/tag-input';
import clsx from 'clsx';

// Constants and Interfaces
interface Project {
  id: string;
  lab_project_code: string;
  sponsor_project_code: string;
  sample_code_rule: any;
  sponsor?: { name: string };
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

const SLOT_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const SLOT_ALLOWED_ELEMENTS: Record<number, string[]> = {
  0: ['sponsor_code', 'lab_code'],
  1: ['clinic_code'],
  2: ['subject_id'],
  3: ['test_type'],
  4: ['sample_seq', 'sample_time'],
  5: ['cycle_group'],
  6: ['sample_type'],
};

const statusColors: Record<string, any> = {
    'pending': 'zinc',
    'received': 'blue',
    'in_storage': 'green',
    'borrowed': 'purple',
    'consumed': 'red',
    'destroyed': 'red',
    'transferred': 'orange'
};

const statusLabels: Record<string, string> = {
    'pending': '待接收',
    'received': '已接收',
    'in_storage': '在库',
    'borrowed': '已借出',
    'consumed': '已消耗',
    'destroyed': '已销毁',
    'transferred': '已转出'
};

// Helper Components
const ClinicSubjectTable = ({ data, onRemove }: { data: any[], onRemove: (index: number) => void }) => (
    <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="max-h-[300px] overflow-y-auto min-h-[100px]">
            <Table bleed dense>
                <TableHead>
                    <TableRow className="!bg-zinc-50/50">
                        <TableHeader className="!py-2 text-[10px] uppercase tracking-wider font-bold text-zinc-500">机构代码</TableHeader>
                        <TableHeader className="!py-2 text-[10px] uppercase tracking-wider font-bold text-zinc-500">受试者编号</TableHeader>
                        <TableHeader className="w-10 !py-2"></TableHeader>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {data.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={3} className="text-center text-zinc-400 py-10">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="p-2 bg-zinc-50 rounded-full text-zinc-300">
                                        <DocumentTextIcon className="w-6 h-6" />
                                    </div>
                                    <span className="text-[11px]">暂无受试者数据</span>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : (
                        data.map((item, index) => (
                            <TableRow key={index} className="group hover:bg-blue-50/30 transition-colors">
                                <TableCell className="text-xs font-mono font-medium text-zinc-600">{item.clinic}</TableCell>
                                <TableCell className="text-xs font-mono font-bold text-zinc-900">{item.subject}</TableCell>
                                <TableCell className="text-right">
                                    <button 
                                        onClick={() => onRemove(index)} 
                                        className="p-1 rounded-md text-zinc-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <XMarkIcon className="w-3.5 h-3.5"/>
                                    </button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    </div>
);

const SeqTimeTable = ({ data, onRemove }: { data: any[], onRemove: (index: number) => void }) => (
    <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="max-h-[300px] overflow-y-auto min-h-[100px]">
            <Table bleed dense>
                <TableHead>
                    <TableRow className="!bg-zinc-50/50">
                        <TableHeader className="!py-2 text-[10px] uppercase tracking-wider font-bold text-zinc-500">序号</TableHeader>
                        <TableHeader className="!py-2 text-[10px] uppercase tracking-wider font-bold text-zinc-500">采血时间</TableHeader>
                        <TableHeader className="w-10 !py-2"></TableHeader>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {data.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={3} className="text-center text-zinc-400 py-10">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="p-2 bg-zinc-50 rounded-full text-zinc-300">
                                        <BeakerIcon className="w-6 h-6" />
                                    </div>
                                    <span className="text-[11px]">暂无采血点数据</span>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : (
                        data.map((item, index) => (
                            <TableRow key={index} className="group hover:bg-blue-50/30 transition-colors">
                                <TableCell className="text-xs font-mono font-medium text-zinc-600">{item.seq}</TableCell>
                                <TableCell className="text-xs font-mono font-bold text-zinc-900">{item.time}</TableCell>
                                <TableCell className="text-right">
                                    <button 
                                        onClick={() => onRemove(index)} 
                                        className="p-1 rounded-md text-zinc-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <XMarkIcon className="w-3.5 h-3.5"/>
                                    </button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    </div>
);

const MatrixColumn = ({ title, options, selected, onSelectionChange, action, emptyText = "暂无数据", onAddOption }: { 
    title: string, 
    options: string[], 
    selected: string[], 
    onSelectionChange: (selected: string[]) => void,
    action?: React.ReactNode,
    emptyText?: string,
    onAddOption?: (val: string) => void
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newVal, setNewVal] = useState('');

    const toggle = (opt: string) => {
        const next = new Set(selected);
        if (next.has(opt)) next.delete(opt);
        else next.add(opt);
        onSelectionChange(Array.from(next));
    };

    const toggleAll = () => {
        if (selected.length === options.length) onSelectionChange([]);
        else onSelectionChange([...options]);
    };

    const handleAdd = () => {
        if (newVal.trim() && onAddOption) {
            onAddOption(newVal.trim());
            setNewVal('');
            setIsAdding(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm transition-shadow hover:shadow-md">
            <div className="px-3 py-2.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-zinc-900 uppercase tracking-wider">{title}</span>
                    <Badge color="zinc" className="!px-1.5 !py-0 !text-[9px]">{options.length}</Badge>
                </div>
                <div className="flex items-center gap-1.5">
                    <button onClick={toggleAll} className="text-[9px] font-bold text-zinc-600 hover:text-zinc-900 transition-colors uppercase tracking-tight">
                        {selected.length === options.length ? '取消' : '全选'}
                    </button>
                    {onAddOption && (
                        <button 
                            onClick={() => setIsAdding(!isAdding)} 
                            className={clsx(
                                "p-1 rounded transition-colors",
                                isAdding ? "text-red-500 hover:bg-red-50" : "text-zinc-600 hover:bg-zinc-100"
                            )}
                        >
                            {isAdding ? <XMarkIcon className="w-3 h-3"/> : <PlusIcon className="w-3 h-3"/>}
                        </button>
                    )}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-[250px] max-h-[400px]">
                {isAdding && (
                    <div className="flex gap-1 mb-2 p-1 bg-blue-50/50 rounded-lg border border-blue-100">
                        <Input 
                            value={newVal} 
                            onChange={e => setNewVal(e.target.value)} 
                            className="!py-1 !px-2 !text-xs !bg-white" 
                            placeholder="输入新选项"
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                            autoFocus
                        />
                        <Button onClick={handleAdd} className="!py-1 !px-2 !text-[10px] !font-bold">OK</Button>
                    </div>
                )}
                {options.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                        <div className="p-2 bg-zinc-50 rounded-full mb-2">
                            <PlusIcon className="w-5 h-5 text-zinc-300" />
                        </div>
                        <span className="text-[10px]">{emptyText}</span>
                    </div>
                ) : (
                    options.map(opt => (
                        <div 
                            key={opt} 
                            onClick={() => toggle(opt)}
                            className={clsx(
                                "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all border",
                                selected.includes(opt) 
                                    ? "bg-blue-50 text-blue-700 border-blue-100 font-bold shadow-sm" 
                                    : "bg-white border-transparent text-zinc-600 hover:bg-zinc-50"
                            )}
                        >
                            <div className={clsx(
                                "w-3 h-3 rounded flex-shrink-0 flex items-center justify-center border transition-all",
                                selected.includes(opt) 
                                    ? "bg-blue-600 border-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.3)]" 
                                    : "border-zinc-300 bg-white"
                            )}>
                                {selected.includes(opt) && <div className="w-1 h-1 bg-white rounded-full" />}
                            </div>
                            <span className="text-[11px] truncate leading-none font-mono">{opt}</span>
                        </div>
                    ))
                )}
            </div>
            {action && (
                <div className="p-2 bg-zinc-50/50 border-t border-zinc-100">
                    {action}
                </div>
            )}
        </div>
    );
};

export default function ProjectSampleCodesPage() {
    const router = useRouter();
    const { id, tab } = router.query;
    const { user } = useAuthStore();
    
    const [project, setProject] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeGenerationTab, setActiveGenerationTab] = useState<string>('clinical');
    
    // Logic state
    const [batchForm, setBatchForm] = useState({
        cycles: [] as string[],
        testTypes: [] as string[],
        primary: [] as string[],
        backup: [] as string[],
        clinicSubjectPairs: [] as { clinic: string, subject: string }[],
        seqTimePairs: [] as { seq: string, time: string }[],
        
        selectedCycles: [] as string[],
        selectedTestTypes: [] as string[],
        selectedPrimary: [] as string[],
        selectedBackup: [] as string[],
        selectedSubjects: [] as string[],
        selectedTimepoints: [] as string[]
    });

    const [generatedSamples, setGeneratedSamples] = useState<any[]>([]);
    const [projectSamples, setProjectSamples] = useState<any[]>([]);
    const [isLoadingProjectSamples, setIsLoadingProjectSamples] = useState(false);
    const [selectedSamples, setSelectedSamples] = useState<Set<string>>(new Set());

    const [quickAddForm, setQuickAddForm] = useState({ clinic: '', startSubject: '', endSubject: '' });
    const [quickAddPreview, setQuickAddPreview] = useState<{ clinic: string, subject: string }[]>([]);

    const [editingSample, setEditingSample] = useState<{ id: string, oldCode: string, newCode: string } | null>(null);
    const [isEditInputOpen, setIsEditInputOpen] = useState(false);
    const [isEditVerifyOpen, setIsEditVerifyOpen] = useState(false);
    const [isGeneratingCodes, setIsGeneratingCodes] = useState(false);

    const [stabilityQCParams, setStabilityQCParams] = useState({
        sample_category: '',
        code: '',
        quantity: 0,
        start_number: 1
    });

    const [slots, setSlots] = useState<(string | null)[]>(Array(7).fill(null));

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
        setLoading(true);
        try {
            const response = await api.get(`/projects/${id}`);
            const data = response.data;
            setProject(data);
            
            if (data.sample_code_rule) {
                const rule = data.sample_code_rule;
                setSlots(rule.slots || Array(7).fill(null));
                
                // Initialize dictionaries
                setBatchForm(prev => ({
                    ...prev,
                    cycles: rule.dictionaries?.cycles || [],
                    testTypes: rule.dictionaries?.test_types || [],
                    primary: rule.dictionaries?.primary_types || [],
                    backup: rule.dictionaries?.backup_types || [],
                    selectedCycles: rule.dictionaries?.cycles || [],
                    selectedTestTypes: rule.dictionaries?.test_types || [],
                    selectedPrimary: rule.dictionaries?.primary_types || [],
                    selectedBackup: rule.dictionaries?.backup_types || []
                }));
            }
        } catch (error) {
            console.error('获取项目详情失败', error);
            toast.error('获取项目详情失败');
        } finally {
            setLoading(false);
        }
    };

    const fetchProjectSamples = async () => {
        setIsLoadingProjectSamples(true);
        try {
            const response = await api.get(`/samples?project_id=${id}&limit=1000`);
            setProjectSamples(response.data.map((s: any) => ({
                ...s,
                id: s.id,
                code: s.sample_code,
                originalCode: s.sample_code,
                isExisting: true,
                status: s.status,
            })));
        } catch (error) {
            console.error('获取样本列表失败', error);
        } finally {
            setIsLoadingProjectSamples(false);
        }
    };

    const handleQuickAdd = () => {
        const start = parseInt(quickAddForm.startSubject);
        const end = parseInt(quickAddForm.endSubject);
        if (isNaN(start) || isNaN(end) || !quickAddForm.clinic) {
            toast.error('请填写完整信息');
            return;
        }
        if (start > end) {
            toast.error('起始编号不能大于结束编号');
            return;
        }

        const newPairs = [];
        for (let i = start; i <= end; i++) {
            newPairs.push({ clinic: quickAddForm.clinic, subject: i.toString().padStart(3, '0') });
        }
        setQuickAddPreview(newPairs);
    };

    const addQuickAddToList = () => {
        setBatchForm({
            ...batchForm,
            clinicSubjectPairs: [...batchForm.clinicSubjectPairs, ...quickAddPreview],
            selectedSubjects: [...batchForm.selectedSubjects, ...quickAddPreview.map(p => `${p.clinic}|${p.subject}`)]
        });
        setQuickAddPreview([]);
        setQuickAddForm({ clinic: '', startSubject: '', endSubject: '' });
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
            const codes: string[] = response.data.sample_codes || [];
            
            const samples = codes.map((code, index) => ({
                id: `QC-${Date.now()}-${index}`,
                code,
                originalCode: code,
                sponsor_project_code: project?.sponsor_project_code,
                lab_project_code: project?.lab_project_code,
            }));

            setGeneratedSamples(samples);
            setActiveGenerationTab('result');
            toast.success(`成功生成 ${response.data.count} 个样本编号`);
            
            setStabilityQCParams({
                sample_category: '',
                code: '',
                quantity: 0,
                start_number: 1
            });
        } catch (error) {
            console.error('生成失败:', error);
            toast.error('生成稳定性/质控样本编号失败');
        }
    };

    const toggleSampleSelection = (id: string) => {
        const newSet = new Set(selectedSamples);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedSamples(newSet);
    };

    const displaySamples = useMemo(() => {
        return generatedSamples.length > 0 ? generatedSamples : projectSamples;
    }, [generatedSamples, projectSamples]);

    const toggleAllSamples = () => {
        if (selectedSamples.size === displaySamples.length) {
            setSelectedSamples(new Set());
        } else {
            setSelectedSamples(new Set(displaySamples.map(s => s.id)));
        }
    };

    const generateBarcodeDataUrl = (text: string) => {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, text, {
            format: "CODE128",
            width: 2,
            height: 100,
            displayValue: true
        });
        return canvas.toDataURL("image/png");
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
                        table { width: 100%; border-collapse: collapse; font-size: 10pt; }
                        th, td { border: 1px solid #000; padding: 6px 8px; text-align: center; }
                        th { background-color: #f3f4f6; font-weight: bold; }
                        .code { font-family: monospace; font-weight: bold; font-size: 11pt; }
                        .labels { display: grid; grid-template-columns: repeat(auto-fill, 50mm); gap: 5mm; }
                        .label { width: 50mm; height: 30mm; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; padding: 2mm; box-sizing: border-box; page-break-inside: avoid; }
                        .label img { max-width: 100%; max-height: 100%; }
                        @media print { body { padding: 0; } .label { border: none; } th { background-color: #ddd !important; -webkit-print-color-adjust: exact; } }
                    </style>
                </head>
                <body>${content}</body>
            </html>`);

        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };

    const handleEditSignatureConfirm = async (password: string, reason: string) => {
        if (!editingSample) return;
        try {
            // 如果是已存在的样本，则调用 PATCH /samples/{id} 更新
            if (editingSample.id.toString().indexOf('GEN-') === -1 && editingSample.id.toString().indexOf('QC-') === -1) {
                // 先验证电子签名（由于后端 patch 接口暂时没有内置校验，这里手动前置校验）
                await api.post('/auth/verify-signature', { password, purpose: 'edit_sample_code' });

                await api.patch(`/samples/${editingSample.id}`, {
                    sample_code: editingSample.newCode,
                    audit_reason: reason
                });
                toast.success('样本编号已修改');
                fetchProjectSamples();
            } else {
                // 如果是新生成的预览样本，则直接更新前端状态
                const updatedSamples = generatedSamples.map(s => {
                    if (s.id === editingSample.id) {
                        return { ...s, code: editingSample.newCode };
                    }
                    return s;
                });
                setGeneratedSamples(updatedSamples);
                toast.success('预览编号已修改');
            }
            setIsEditVerifyOpen(false);
            setEditingSample(null);
        } catch (error: any) {
            toast.error(extractDetailMessage(error?.response?.data) || '修改失败');
            throw error; // 抛出错误以便 ESignatureDialog 显示错误信息
        }
    };

    if (loading) return <AppLayout><div className="flex justify-center items-center h-64"><Text>加载中...</Text></div></AppLayout>;
    if (!project) return <AppLayout><div className="flex justify-center items-center h-64"><Text>项目不存在</Text></div></AppLayout>;

    return (
        <AppLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center gap-4 mb-8">
                    <Button plain onClick={() => router.push(`/projects/${id}`)}>
                        <ChevronLeftIcon className="w-5 h-5 mr-1" />
                        返回项目详情
                    </Button>
                    <Heading>样本编号管理 - {project.lab_project_code}</Heading>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
                    <div className="border-b border-zinc-200 bg-zinc-50/50 px-6 py-4">
                        <Tabs 
                            tabs={[
                                { key: 'clinical', label: '生成临床样本', icon: DocumentTextIcon },
                                { key: 'result', label: '查看/打印编号', icon: MagnifyingGlassIcon },
                                { key: 'stability', label: '稳定性/质控样本', icon: BeakerIcon }
                            ]} 
                            activeTab={activeGenerationTab} 
                            onChange={setActiveGenerationTab}
                        />
                    </div>

                    <div className="p-6 bg-zinc-50/30">
                        {activeGenerationTab === 'clinical' && (
                            <div className="space-y-8">
                                <div className="grid grid-cols-1 xl:grid-cols-5 gap-8 items-start">
                                    {/* Left Column: Subject Management (2/5) */}
                                    <div className="xl:col-span-2 space-y-6">
                                        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col h-full">
                                            <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
                                                <div>
                                                    <Heading level={3} className="!text-sm flex items-center gap-2">
                                                        <PlusIcon className="w-4 h-4 text-blue-600" />
                                                        受试者入组管理
                                                    </Heading>
                                                    <p className="text-[10px] text-zinc-500 mt-0.5">批量添加受试者并分配至临床机构</p>
                                                </div>
                                                <Button plain className="!text-xs text-zinc-600 hover:bg-zinc-100 !py-1 !px-2">
                                                    <ArrowUpOnSquareIcon className="w-3 h-3 mr-1" />
                                                    Excel 导入
                                                </Button>
                                            </div>
                                            
                                            <div className="p-5 space-y-5">
                                                {/* Quick Add Form */}
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">机构代码</label>
                                                        <Input 
                                                            value={quickAddForm.clinic} 
                                                            onChange={e => setQuickAddForm({...quickAddForm, clinic: e.target.value})} 
                                                            placeholder="如: 01" 
                                                            className="!py-1.5 !text-xs !bg-zinc-50/50 focus:!bg-white"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">起始号</label>
                                                        <Input 
                                                            value={quickAddForm.startSubject} 
                                                            onChange={e => setQuickAddForm({...quickAddForm, startSubject: e.target.value})} 
                                                            placeholder="001" 
                                                            className="!py-1.5 !text-xs !bg-zinc-50/50 focus:!bg-white"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">截止号</label>
                                                        <Input 
                                                            value={quickAddForm.endSubject} 
                                                            onChange={e => setQuickAddForm({...quickAddForm, endSubject: e.target.value})} 
                                                            placeholder="010" 
                                                            className="!py-1.5 !text-xs !bg-zinc-50/50 focus:!bg-white"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <Button 
                                                        outline 
                                                        className="flex-1 !text-xs !py-2 shadow-sm" 
                                                        onClick={handleQuickAdd}
                                                        disabled={!quickAddForm.clinic || !quickAddForm.startSubject || !quickAddForm.endSubject}
                                                    >
                                                        预览入组序列
                                                    </Button>
                                                    {quickAddPreview.length > 0 && (
                                                        <Button 
                                                            color="dark" 
                                                            className="flex-1 !text-xs !py-2 shadow-sm animate-in fade-in zoom-in duration-200" 
                                                            onClick={addQuickAddToList}
                                                        >
                                                            <PlusIcon className="w-3.5 h-3.5 mr-1" />
                                                            确认添加 {quickAddPreview.length} 人
                                                        </Button>
                                                    )}
                                                </div>

                                                <Divider className="!my-2" />

                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">当前入组列表</label>
                                                        <Badge color="zinc" className="!text-[9px] !px-1.5">{batchForm.clinicSubjectPairs.length} 人</Badge>
                                                    </div>
                                                    <ClinicSubjectTable 
                                                        data={batchForm.clinicSubjectPairs} 
                                                        onRemove={(idx) => {
                                                            const newPairs = [...batchForm.clinicSubjectPairs];
                                                            newPairs.splice(idx, 1);
                                                            setBatchForm({...batchForm, clinicSubjectPairs: newPairs});
                                                        }} 
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column: Matrix Config (3/5) */}
                                    <div className="xl:col-span-3 space-y-6">
                                        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col h-full">
                                            <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
                                                <div>
                                                    <Heading level={3} className="!text-sm flex items-center gap-2">
                                                        <DocumentTextIcon className="w-4 h-4 text-blue-600" />
                                                        生成参数矩阵 (笛卡尔积)
                                                    </Heading>
                                                    <p className="text-[10px] text-zinc-500 mt-0.5">选择下方各维度的选项，系统将自动组合并生成唯一编号</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="text-right mr-2 hidden sm:block">
                                                        <p className="text-[9px] font-bold text-zinc-400 uppercase leading-none">预估生成</p>
                                                        <p className="text-sm font-black text-blue-600 leading-tight">
                                                            {(batchForm.selectedCycles.length || 1) * 
                                                             (batchForm.selectedTestTypes.length || 1) * 
                                                             (batchForm.selectedPrimary.length || 1) * 
                                                             (batchForm.selectedBackup.length || 1) * 
                                                             (batchForm.selectedSubjects.length || 1)} <span className="text-[10px] font-medium text-zinc-400">份</span>
                                                        </p>
                                                    </div>
                                                    <Button 
                                                        color="dark" 
                                                        onClick={handleViewSamples} 
                                                        disabled={isGeneratingCodes || batchForm.selectedSubjects.length === 0}
                                                        className="shadow-lg shadow-blue-900/10 !px-6 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                                    >
                                                        {isGeneratingCodes ? '正在处理...' : '开始生成预览'}
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="p-5">
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                    <MatrixColumn 
                                                        title='周期 / 组别' 
                                                        options={batchForm.cycles} 
                                                        selected={batchForm.selectedCycles} 
                                                        onSelectionChange={(l) => setBatchForm({...batchForm, selectedCycles: l})}
                                                        onAddOption={(v) => setBatchForm(prev => ({...prev, cycles: [...prev.cycles, v], selectedCycles: [...prev.selectedCycles, v]}))}
                                                    />
                                                    <MatrixColumn 
                                                        title='检测类型' 
                                                        options={batchForm.testTypes} 
                                                        selected={batchForm.selectedTestTypes} 
                                                        onSelectionChange={(l) => setBatchForm({...batchForm, selectedTestTypes: l})}
                                                        onAddOption={(v) => setBatchForm(prev => ({...prev, testTypes: [...prev.testTypes, v], selectedTestTypes: [...prev.selectedTestTypes, v]}))}
                                                    />
                                                    <MatrixColumn 
                                                        title='正份标识' 
                                                        options={batchForm.primary} 
                                                        selected={batchForm.selectedPrimary} 
                                                        onSelectionChange={(l) => setBatchForm({...batchForm, selectedPrimary: l})}
                                                        onAddOption={(v) => setBatchForm(prev => ({...prev, primary: [...prev.primary, v], selectedPrimary: [...prev.selectedPrimary, v]}))}
                                                    />
                                                    <MatrixColumn 
                                                        title='备份标识' 
                                                        options={batchForm.backup} 
                                                        selected={batchForm.selectedBackup} 
                                                        onSelectionChange={(l) => setBatchForm({...batchForm, selectedBackup: l})}
                                                        onAddOption={(v) => setBatchForm(prev => ({...prev, backup: [...prev.backup, v], selectedBackup: [...prev.selectedBackup, v]}))}
                                                    />
                                                    <MatrixColumn 
                                                        title='受试者 (从左侧选择)' 
                                                        options={batchForm.clinicSubjectPairs.map(p => `${p.clinic}|${p.subject}`)} 
                                                        selected={batchForm.selectedSubjects} 
                                                        onSelectionChange={(l) => setBatchForm({...batchForm, selectedSubjects: l})}
                                                        emptyText="请先在左侧添加受试者"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeGenerationTab === 'result' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between bg-zinc-50 p-4 rounded-lg border border-zinc-200">
                                    <div className="flex items-center gap-4">
                                        <Text className="font-medium">
                                            {generatedSamples.length > 0 ? '预览新生成的编号' : '查看已存样本编号'} 
                                            <span className="ml-1 text-zinc-500">({displaySamples.length})</span>
                                        </Text>
                                        {displaySamples.length > 0 && (
                                            <Badge color="zinc">已选 {selectedSamples.size}</Badge>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        {generatedSamples.length > 0 && (
                                            <Button outline onClick={() => setGeneratedSamples([])}>清空预览</Button>
                                        )}
                                        <Button outline onClick={toggleAllSamples}>
                                            {selectedSamples.size === displaySamples.length ? '取消全选' : '全选'}
                                        </Button>
                                        <Button outline onClick={() => triggerPrint(displaySamples.filter(s => selectedSamples.has(s.id)), 'list')} disabled={selectedSamples.size === 0}>
                                            <PrinterIcon className="w-4 h-4 mr-1"/>打印清单
                                        </Button>
                                        <Button color="dark" onClick={() => triggerPrint(displaySamples.filter(s => selectedSamples.has(s.id)), 'label')} disabled={selectedSamples.size === 0}>
                                            <PrinterIcon className="w-4 h-4 mr-1"/>打印标签
                                        </Button>
                                    </div>
                                </div>

                                <div className="border border-zinc-200 rounded-lg overflow-hidden">
                                    <Table bleed striped>
                                        <TableHead>
                                            <TableRow>
                                                <TableHeader className="w-12 text-center">
                                                    <Checkbox 
                                                        checked={displaySamples.length > 0 && selectedSamples.size === displaySamples.length} 
                                                        onChange={toggleAllSamples}
                                                    />
                                                </TableHeader>
                                                <TableHeader>样本编号</TableHeader>
                                                <TableHeader>状态</TableHeader>
                                                <TableHeader>操作</TableHeader>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {displaySamples.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center py-12 text-zinc-500">
                                                        {isLoadingProjectSamples ? '加载中...' : '暂无编号，请先生成编号'}
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                displaySamples.map((sample) => (
                                                    <TableRow key={sample.id}>
                                                        <TableCell className="text-center">
                                                            <Checkbox 
                                                                checked={selectedSamples.has(sample.id)} 
                                                                onChange={() => toggleSampleSelection(sample.id)}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className="font-mono font-medium text-zinc-900">{sample.code}</span>
                                                            {sample.code !== sample.originalCode && <span className="ml-2 text-xs text-amber-600">(已修改)</span>}
                                                        </TableCell>
                                                        <TableCell>
                                                            {sample.isExisting ? (
                                                                <Badge color={statusColors[sample.status] || 'zinc'}>
                                                                    {statusLabels[sample.status] || sample.status}
                                                                </Badge>
                                                            ) : (
                                                                <Badge color="yellow">预览中</Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button plain onClick={() => {
                                                                setEditingSample({ id: sample.id, oldCode: sample.code, newCode: sample.code });
                                                                setIsEditInputOpen(true);
                                                            }}>
                                                                <PencilSquareIcon className="w-4 h-4 text-zinc-500"/>
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
                            <div className="max-w-2xl mx-auto py-8">
                                <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-8 space-y-6">
                                    <div className="space-y-2 text-center mb-8">
                                        <Heading level={2}>生成稳定性/质控样本</Heading>
                                        <Text>该功能用于生成项目所需的额外质控、稳定性或特殊检测样本编号。</Text>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium">样本类别</label>
                                            <Select 
                                                value={stabilityQCParams.sample_category} 
                                                onChange={e => setStabilityQCParams({...stabilityQCParams, sample_category: e.target.value})}
                                            >
                                                <option value="">请选择...</option>
                                                <option value="STB">稳定性 (STB)</option>
                                                <option value="QC">质控 (QC)</option>
                                                <option value="VAL">验证 (VAL)</option>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium">代码标识</label>
                                            <Input 
                                                value={stabilityQCParams.code} 
                                                onChange={e => setStabilityQCParams({...stabilityQCParams, code: e.target.value})} 
                                                placeholder="如: PK01, PD01" 
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium">生成数量</label>
                                            <Input 
                                                type="number" 
                                                value={stabilityQCParams.quantity || ''} 
                                                onChange={e => setStabilityQCParams({...stabilityQCParams, quantity: parseInt(e.target.value) || 0})} 
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium">起始流水号</label>
                                            <Input 
                                                type="number" 
                                                value={stabilityQCParams.start_number || ''} 
                                                onChange={e => setStabilityQCParams({...stabilityQCParams, start_number: parseInt(e.target.value) || 1})} 
                                            />
                                        </div>
                                    </div>
                                    <Button color="dark" className="w-full h-12 text-base mt-6" onClick={handleGenerateStabilityQCCodes}>
                                        <BeakerIcon className="w-5 h-5 mr-2" />
                                        立即生成编号
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Edit Sample Code Dialog */}
            <Dialog open={isEditInputOpen} onClose={setIsEditInputOpen}>
                <DialogTitle>编辑样本编号</DialogTitle>
                <DialogDescription>修改该样本的唯一标识。该操作需要电子签名确认并会记录在审计日志中。</DialogDescription>
                <DialogBody>
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-zinc-500">原编号</label>
                            <div className="p-2 bg-zinc-100 rounded font-mono text-zinc-600">{editingSample?.oldCode}</div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-zinc-900">新编号</label>
                            <Input 
                                value={editingSample?.newCode || ''} 
                                onChange={e => setEditingSample(prev => prev ? { ...prev, newCode: e.target.value } : null)}
                                placeholder="输入新的编号"
                                autoFocus
                            />
                        </div>
                    </div>
                </DialogBody>
                <DialogActions>
                    <Button plain onClick={() => setIsEditInputOpen(false)}>取消</Button>
                    <Button color="dark" onClick={() => {
                        if (!editingSample?.newCode || editingSample.newCode === editingSample.oldCode) {
                            toast.error('编号未变更或为空');
                            return;
                        }
                        setIsEditInputOpen(false);
                        setIsEditVerifyOpen(true);
                    }}>保存修改</Button>
                </DialogActions>
            </Dialog>

            <ESignatureDialog 
                open={isEditVerifyOpen} 
                onClose={() => setIsEditVerifyOpen(false)} 
                onConfirm={handleEditSignatureConfirm}
                title="确认修改编号"
                description={`确认将样本编号从 ${editingSample?.oldCode} 修改为 ${editingSample?.newCode}？`}
            />
        </AppLayout>
    );
}
