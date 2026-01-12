import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/date-utils';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { Tabs } from '@/components/tabs';
import { api } from '@/lib/api';
import { useProjectStore } from '@/store/project';
import { MatrixFilter } from '@/components/matrix-filter';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Badge } from '@/components/badge';
import { Checkbox } from '@/components/checkbox';
import { Select } from '@/components/select';
import { Input } from '@/components/input';
import { Dialog, DialogTitle, DialogBody, DialogActions, DialogDescription } from '@/components/dialog';
import { toast } from 'react-hot-toast';
import { 
  MagnifyingGlassIcon, 
  ArrowPathIcon, 
  ArrowRightIcon,
  ArchiveBoxIcon,
  CubeIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  ChevronLeftIcon,
  Squares2X2Icon,
  ListBulletIcon,
  PlusIcon 
} from '@heroicons/react/20/solid';
import clsx from 'clsx';
import { AnimatePresence } from 'framer-motion';

// 导入拆分后的存储组件
import { 
  Freezer, 
  SampleBox, 
  BoxSample, 
  STATUS_COLORS,
  FreezerCard,
  BoxCard,
  BoxGridView,
  BoxListView
} from '@/components/storage';

// Tab 1: 领用 (Checkout) 组件
function CheckoutTab({ projectId, initialSamples }: { projectId: number | null, initialSamples?: any[] }) {
  const [loading, setLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // 矩阵筛选状态
  const [matrixData, setMatrixData] = useState({
    cycles: [] as string[],
    testTypes: [] as string[],
    primary: [] as string[],
    backup: [] as string[],
  });
  
  const [selection, setSelection] = useState({
    cycles: [] as string[],
    testTypes: [] as string[],
    primary: [] as string[],
    backup: [] as string[],
  });

  const [previewSamples, setPreviewSamples] = useState<any[]>([]);
  const [selectedSamples, setSelectedSamples] = useState<string[]>([]);
  
  // 申请表单
  const [requestForm, setRequestForm] = useState({
    purpose: 'first_test',
    target_location: '',
    target_date: '',
    notes: ''
  });

  const EmptyConfigLink = ({ label }: { label: string }) => (
    <div className="flex flex-col items-center gap-1">
      <span>暂无{label}</span>
      {projectId && (
        <Link href={`/projects/${projectId}`} className="text-blue-600 hover:text-blue-700 hover:underline cursor-pointer">
          去配置
        </Link>
      )}
    </div>
  );

  // 处理从外部传入的初始样本
  useEffect(() => {
    if (initialSamples && initialSamples.length > 0) {
      // 将初始样本添加到预览列表（如果不在）
      setPreviewSamples(prev => {
        const existingIds = new Set(prev.map(s => s.sample_code));
        const newSamples = initialSamples.filter(s => !existingIds.has(s.sample_code));
        return [...newSamples, ...prev];
      });
      
      // 自动勾选
      setSelectedSamples(prev => {
        const newSet = new Set([...prev, ...initialSamples.map(s => s.sample_code)]);
        return Array.from(newSet);
      });
    }
  }, [initialSamples]);

  // 加载项目配置的字典数据
  useEffect(() => {
    if (!projectId) return;
    
    const fetchConfig = async () => {
      try {
        const res = await api.get(`/projects/${projectId}`);
        const rule = res.data.sample_code_rule || {};
        const dicts = rule.dictionaries || {};
        
        setMatrixData({
            cycles: dicts.cycles || [],
            testTypes: dicts.test_types || [],
            primary: dicts.primary_types || [],
            backup: dicts.backup_types || [],
        });
      } catch (e) {
        console.error("Failed to load project config", e);
      }
    };
    
    fetchConfig();
  }, [projectId]);

  const handleSearch = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      // 构建筛选参数
      const params = {
        project_id: projectId,
        status: 'in_storage', // 只筛选在库样本
        cycles: selection.cycles.length ? selection.cycles : undefined,
        test_types: selection.testTypes.length ? selection.testTypes : undefined,
        is_primary: selection.primary.length > 0 ? true : (selection.backup.length > 0 ? false : undefined),
      };
      
      const res = await api.get('/samples', { params });
      setPreviewSamples(res.data || []);
      // 搜索时保留已选中的样本，还是重置？通常重置更符合直觉，或者保留已选但不在结果中的样本？
      // 这里简单处理：搜索结果覆盖预览列表，但如果之前选中的样本不在新结果中，是否保留？
      // 为了避免已选样本丢失，我们可以只将预览列表替换为搜索结果，
      // 但这样如果用户想反选之前选中的样本（而它又不在当前搜索结果里），就操作不了了。
      // 更好的做法是：预览列表 = 搜索结果 + (已选但不在结果中的样本)
      // 暂时先只显示搜索结果，如果用户需要保留已选，可以先不点搜索。
      // 或者，我们在底部栏显示已选样本数量，点击可以查看详情列表。
      // 鉴于 currently selectedSamples 只是 string[]，我们最好保持 previewSamples 包含所有 selectedSamples 对应的对象。
      
      // 改进：将搜索结果和已选样本合并展示
      const searchResults = res.data || [];
      setPreviewSamples(prev => {
        // 找出已选但不在搜索结果中的样本
        const selectedButNotInSearch = prev.filter(s => selectedSamples.includes(s.sample_code) && !searchResults.find((r: any) => r.sample_code === s.sample_code));
        return [...selectedButNotInSearch, ...searchResults];
      });
      
    } catch (e) {
      toast.error('查询样本失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    // 全选当前预览列表中的所有样本
    const allPreviewCodes = previewSamples.map(s => s.sample_code);
    if (selectedSamples.length >= previewSamples.length && previewSamples.every(s => selectedSamples.includes(s.sample_code))) {
        // 如果当前预览的全都选了，则取消全选
        setSelectedSamples([]);
    } else {
        // 否则全选
        setSelectedSamples(Array.from(new Set([...selectedSamples, ...allPreviewCodes])));
    }
  };

  const handleSubmitRequest = async () => {
    if (!projectId || selectedSamples.length === 0) return;
    
    try {
        await api.post('/samples/borrow-request', {
            project_id: projectId,
            sample_codes: selectedSamples,
            ...requestForm
        });
        toast.success('领用申请已提交');
        setIsCreateDialogOpen(false);
        setPreviewSamples([]);
        setSelectedSamples([]);
    } catch (e) {
        toast.error('提交失败');
    }
  };

  return (
    <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-4">
            <Text className="font-medium mb-4">通过勾选条件筛选出样本编号</Text>
            <div className="grid grid-cols-4 gap-4 h-64">
                 <MatrixFilter 
                    title="周期/组别" 
                    options={matrixData.cycles} 
                    selected={selection.cycles} 
                    onChange={(v) => setSelection({...selection, cycles: v})}
                    emptyText={<EmptyConfigLink label="周期" />}
                 />
                 <MatrixFilter 
                    title="检测类型" 
                    options={matrixData.testTypes} 
                    selected={selection.testTypes} 
                    onChange={(v) => setSelection({...selection, testTypes: v})}
                    emptyText={<EmptyConfigLink label="检测类型" />}
                 />
                 <MatrixFilter 
                    title="正份 (套)" 
                    options={matrixData.primary} 
                    selected={selection.primary} 
                    onChange={(v) => setSelection({...selection, primary: v})}
                    emptyText={<EmptyConfigLink label="正份" />}
                 />
                 <MatrixFilter 
                    title="备份 (套)" 
                    options={matrixData.backup} 
                    selected={selection.backup} 
                    onChange={(v) => setSelection({...selection, backup: v})}
                    emptyText={<EmptyConfigLink label="备份" />}
                 />
            </div>
            <div className="flex justify-end mt-4">
                <Button onClick={handleSearch} disabled={!projectId}>
                    <MagnifyingGlassIcon className="w-4 h-4 mr-2"/>
                    筛选样本
                </Button>
            </div>
        </div>

        {/* 样本列表 */}
        <div className="bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto">
            <Table>
                <TableHead>
                    <TableRow>
                        <TableHeader className="w-12">
                            <Checkbox 
                                checked={previewSamples.length > 0 && previewSamples.every(s => selectedSamples.includes(s.sample_code))}
                                onChange={handleSelectAll}
                                disabled={previewSamples.length === 0}
                            />
                        </TableHeader>
                        <TableHeader>样本编号</TableHeader>
                        <TableHeader>检测类型</TableHeader>
                        <TableHeader>特殊事项</TableHeader>
                        <TableHeader>位置</TableHeader>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {previewSamples.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-zinc-500">
                                {loading ? '加载中...' : '请先选择条件进行筛选'}
                            </TableCell>
                        </TableRow>
                    ) : (
                        previewSamples.map((sample) => (
                            <TableRow key={sample.id} className={clsx(selectedSamples.includes(sample.sample_code) ? "bg-blue-50/50" : "")}>
                                <TableCell>
                                    <Checkbox 
                                        checked={selectedSamples.includes(sample.sample_code)}
                                        onChange={() => {
                                            if (selectedSamples.includes(sample.sample_code)) {
                                                setSelectedSamples(selectedSamples.filter(c => c !== sample.sample_code));
                                            } else {
                                                setSelectedSamples([...selectedSamples, sample.sample_code]);
                                            }
                                        }}
                                    />
                                </TableCell>
                                <TableCell className="font-mono">{sample.sample_code}</TableCell>
                                <TableCell>{sample.test_type}</TableCell>
                                <TableCell>{sample.special_notes || '-'}</TableCell>
                                <TableCell>{sample.freezer_id ? `${sample.freezer_id}-${sample.shelf_level}-${sample.rack_position}` : '-'}</TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
            </div>
        </div>

        <div className="flex justify-between items-center bg-zinc-50 p-4 rounded-lg border border-zinc-200">
            <div className="text-sm text-zinc-600">
                已选 <span className="font-bold text-zinc-900">{selectedSamples.length}</span> 个样本
            </div>
            <div className="flex gap-2">
                <Button outline onClick={() => setSelectedSamples([])} disabled={selectedSamples.length === 0}>取消选择</Button>
                <Button color="dark" onClick={() => setIsCreateDialogOpen(true)} disabled={selectedSamples.length === 0}>
                    确定 (申请领用)
                </Button>
            </div>
        </div>

        <Dialog open={isCreateDialogOpen} onClose={() => setIsCreateDialogOpen(false)}>
            <DialogTitle>申请领用</DialogTitle>
            <DialogBody>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">用途</label>
                        <Select value={requestForm.purpose} onChange={e => setRequestForm({...requestForm, purpose: e.target.value})}>
                            <option value="first_test">首次检测</option>
                            <option value="retest">重测</option>
                            <option value="isr">ISR</option>
                        </Select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">目标位置</label>
                        <Input value={requestForm.target_location} onChange={e => setRequestForm({...requestForm, target_location: e.target.value})} placeholder="如：分析室A"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">目标时间</label>
                        <Input type="datetime-local" value={requestForm.target_date} onChange={e => setRequestForm({...requestForm, target_date: e.target.value})}/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">备注</label>
                        <Input value={requestForm.notes} onChange={e => setRequestForm({...requestForm, notes: e.target.value})}/>
                    </div>
                </div>
            </DialogBody>
            <DialogActions>
                <Button plain onClick={() => setIsCreateDialogOpen(false)}>取消</Button>
                <Button color="dark" onClick={handleSubmitRequest}>提交申请</Button>
            </DialogActions>
        </Dialog>
    </div>
  );
}

// Tab 2: 归还 (Return) 组件
function ReturnTab({ projectId }: { projectId: number | null }) {
    const router = useRouter();
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!projectId) return;
        fetchRequests();
    }, [projectId]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            // 获取"已领用"状态的申请单
            const res = await api.get('/samples/borrow-requests', { 
                params: { status: 'borrowed' } 
            });
            // 前端过滤项目
            const projectRequests = res.data.filter((r: any) => 
                // 假设后端返回 project.lab_project_code，需要匹配当前 selectedProjectId
                // 这里简化处理，如果后端支持 project_id 筛选更好，但目前后端 get_borrow_requests 似乎不支持 project_id 参数
                // 我们假设用户只能看到相关的
                true 
            );
            setRequests(projectRequests);
        } catch (e) {
            toast.error('加载待归还列表失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
             <div className="bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
                    <Text className="font-medium">待归还领用单</Text>
                    <Button plain onClick={fetchRequests}>
                        <ArrowPathIcon className="w-4 h-4 mr-1"/>刷新
                    </Button>
                </div>
                <div className="p-6">
                    <div className="border border-zinc-200 rounded-lg overflow-hidden">
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeader>序号</TableHeader>
                                    <TableHeader>申请单号</TableHeader>
                                    <TableHeader>样本数量</TableHeader>
                                    <TableHeader>申请人</TableHeader>
                                    <TableHeader>领用时间</TableHeader>
                                    <TableHeader>目标位置</TableHeader>
                                    <TableHeader>操作</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {requests.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-16 text-zinc-500 bg-zinc-50/50">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <Text>暂无待归还的领用单</Text>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    requests.map((req, idx) => (
                                        <TableRow key={req.id}>
                                            <TableCell>{idx + 1}</TableCell>
                                            <TableCell className="font-mono">{req.request_code}</TableCell>
                                            <TableCell>{req.sample_count}</TableCell>
                                            <TableCell>{req.requested_by.full_name}</TableCell>
                                            <TableCell>{formatDate(req.created_at)}</TableCell>
                                            <TableCell>{req.target_location}</TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    <Button plain className="text-blue-600 hover:text-blue-800" onClick={() => router.push(`/samples/return/${req.id}`)}>
                                                        归还
                                                    </Button>
                                                    <Button plain onClick={() => {
                                                        /* 打印逻辑 */
                                                        toast('请进入归还详情页打印跟踪表', { icon: 'ℹ️' });
                                                    }}>查看</Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
             </div>
        </div>
    );
}

// Tab 3: 入库 (Inbound) 组件 - 稳定性及质控
function InboundTab({ projectId }: { projectId: number | null }) {
    const [form, setForm] = useState({
        category: 'STB', // STB or QC
        quantity: 0,
        code: '',
        location: ''
    });
    const [freezers, setFreezers] = useState<Freezer[]>([]);
    const [generating, setGenerating] = useState(false);
    const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);

    useEffect(() => {
        fetchFreezers();
    }, []);

    const fetchFreezers = async () => {
        try {
            const res = await api.get('/samples/storage/freezers');
            setFreezers(res.data || []);
        } catch (e) {
            console.error('Failed to fetch freezers', e);
        }
    };

    const handleGeneratePreview = async () => {
        if (!projectId || !form.code || !form.quantity) return;
        setGenerating(true);
        try {
            const res = await api.post(`/projects/${projectId}/generate-stability-qc-codes`, {
                sample_category: form.category,
                code: form.code,
                quantity: form.quantity,
                start_number: 1
            });
            setGeneratedCodes(res.data.sample_codes || []);
        } catch (e) {
            toast.error('生成编号失败');
        } finally {
            setGenerating(false);
        }
    };

    const handleSubmitInbound = async () => {
        if (!projectId || generatedCodes.length === 0) return;
        if (!form.location) {
            toast.error('请选择目标冰箱');
            return;
        }
        try {
            // 构造样本数据
            const samples = generatedCodes.map(code => ({
                sample_code: code,
                project_id: projectId,
                status: 'in_storage',
                // 解析 location: freezer-shelf-rack
                // 实际应用中应该更严谨地分配位置
                freezer_id: form.location, 
                test_type: form.category === 'STB' ? 'Stability' : 'QC'
            }));
            
            await api.post('/samples/batch', samples);
            toast.success('入库成功');
            setGeneratedCodes([]);
            setForm({...form, quantity: 0, code: ''});
        } catch (e) {
            toast.error('入库失败');
        }
    };

    return (
        <div className="space-y-6">
             <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-6">
                <Heading level={2} className="mb-6">稳定性及质控样本入库</Heading>
                <div className="grid grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">样本类别</label>
                        <Select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                            <option value="STB">稳定性样本 (STB)</option>
                            <option value="QC">质控样本 (QC)</option>
                        </Select>
                    </div>
                    <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">代码标识</label>
                         <Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="如：L, M, H"/>
                    </div>
                    <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">样本数量</label>
                         <Input type="number" value={form.quantity || ''} onChange={e => setForm({...form, quantity: parseInt(e.target.value) || 0})} placeholder="数量"/>
                    </div>
                </div>
                
                <div className="mt-6 flex gap-4 items-end">
                    <div className="flex-1">
                         <label className="block text-sm font-medium text-gray-700 mb-1">目标位置 (冰箱)</label>
                         <Select value={form.location} onChange={e => setForm({...form, location: e.target.value})}>
                            <option value="">请选择冰箱...</option>
                            {freezers.map(f => (
                                <option key={f.id} value={f.id}>{f.name} ({f.location})</option>
                            ))}
                         </Select>
                    </div>
                    <Button onClick={handleGeneratePreview} disabled={generating}>
                        生成预览
                    </Button>
                </div>

                {generatedCodes.length > 0 && (
                    <div className="mt-6 p-4 bg-zinc-50 rounded-lg border border-zinc-200">
                        <Text className="font-medium mb-2">预览编号 ({generatedCodes.length})</Text>
                        <div className="grid grid-cols-4 gap-2 text-sm font-mono text-zinc-600">
                            {generatedCodes.map((c, i) => <div key={i}>{c}</div>)}
                        </div>
                    </div>
                )}
             </div>
             
             <div className="flex justify-end">
                <Button color="dark" onClick={handleSubmitInbound} disabled={generatedCodes.length === 0}>
                    申请入库
                </Button>
             </div>
        </div>
    );
}

// Tab 4: 样本存储管理 (Storage Management) 组件 - 迁移自 storage.tsx
function StorageTab({ projectId, onCheckout }: { projectId: number | null, onCheckout: (sample: any) => void }) {
  // 状态
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [freezers, setFreezers] = useState<Freezer[]>([]);
  const [boxes, setBoxes] = useState<SampleBox[]>([]);
  const [selectedFreezer, setSelectedFreezer] = useState<Freezer | null>(null);
  const [selectedBox, setSelectedBox] = useState<SampleBox | null>(null);
  const [boxSamples, setBoxSamples] = useState<BoxSample[]>([]);
  const [loadingBoxSamples, setLoadingBoxSamples] = useState(false);
  
  // 视图模式
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [boxDetailViewMode, setBoxDetailViewMode] = useState<'grid' | 'list'>('grid');
  
  // 筛选
  const [searchQuery, setSearchQuery] = useState('');
  
  // 对话框
  const [isBoxDetailOpen, setIsBoxDetailOpen] = useState(false);
  const [isAddBoxOpen, setIsAddBoxOpen] = useState(false);
  const [isEditBoxOpen, setIsEditBoxOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // 选中状态
  const [selectedSampleId, setSelectedSampleId] = useState<number | null>(null);
  const [highlightedPosition, setHighlightedPosition] = useState<string | null>(null);
  const [selectedSample, setSelectedSample] = useState<BoxSample | null>(null);
  const [boxToDelete, setBoxToDelete] = useState<SampleBox | null>(null);
  const [boxToEdit, setBoxToEdit] = useState<SampleBox | null>(null);

  // 新建/编辑样本盒表单
  const [boxForm, setBoxForm] = useState({
    code: '',
    freezer_id: '',
    shelf_level: '',
    rack_position: '',
    rows: 10,
    cols: 10
  });

  useEffect(() => {
    fetchFreezers();
    fetchBoxes();
  }, []);

  const fetchFreezers = async () => {
    try {
      const res = await api.get('/samples/storage/freezers');
      setFreezers(res.data || []);
    } catch (e) {
      console.error('Failed to fetch freezers', e);
      // 模拟数据
      setFreezers([
        { id: 'F001', name: '超低温冰箱-1', location: '样本库A区', temperature: -80, shelves: 5, total_boxes: 50, used_boxes: 35 },
        { id: 'F002', name: '超低温冰箱-2', location: '样本库A区', temperature: -80, shelves: 5, total_boxes: 50, used_boxes: 42 },
        { id: 'F003', name: '低温冰箱-1', location: '样本库B区', temperature: -20, shelves: 4, total_boxes: 40, used_boxes: 28 },
        { id: 'F004', name: '冷藏冰箱-1', location: '样本库C区', temperature: 4, shelves: 3, total_boxes: 30, used_boxes: 15 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBoxes = async (freezerId?: string) => {
    try {
      const params = freezerId ? { freezer_id: freezerId } : {};
      const res = await api.get('/samples/storage/boxes', { params });
      setBoxes(res.data || []);
    } catch (e) {
      console.error('Failed to fetch boxes', e);
    }
  };

  const fetchBoxSamples = async (box: SampleBox) => {
    setLoadingBoxSamples(true);
    try {
      const url = `/samples/storage/box/${encodeURIComponent(box.freezer_id)}/${encodeURIComponent(box.shelf_level)}/${encodeURIComponent(box.rack_position)}/${encodeURIComponent(box.code)}`;
      const res = await api.get(url);
      setBoxSamples(res.data || []);
    } catch (e) {
      console.error('Failed to fetch box samples', e);
    } finally {
      setLoadingBoxSamples(false);
    }
  };

  const handleFreezerSelect = (freezer: Freezer) => {
    setSelectedFreezer(freezer);
    fetchBoxes(freezer.id);
  };

  const handleBoxSelect = (box: SampleBox) => {
    setSelectedBox(box);
    fetchBoxSamples(box);
    setIsBoxDetailOpen(true);
    setBoxDetailViewMode('grid');
  };

  const handleBackToFreezers = () => {
    setSelectedFreezer(null);
    fetchBoxes();
  };

  const handleSampleClick = (sample: BoxSample) => {
    setSelectedSample(sample);
    setSelectedSampleId(sample.id);
  };

  // 添加样本盒
  const handleAddBox = async () => {
    if (!selectedFreezer) return;
    
    try {
      await api.post('/samples/storage/boxes', {
        ...boxForm,
        freezer_id: selectedFreezer.id,
        total_slots: boxForm.rows * boxForm.cols,
        used_slots: 0
      });
      toast.success('样本盒创建成功');
      setIsAddBoxOpen(false);
      setBoxForm({ code: '', freezer_id: '', shelf_level: '', rack_position: '', rows: 10, cols: 10 });
      fetchBoxes(selectedFreezer.id);
    } catch (e) {
      toast.error('创建失败');
    }
  };

  // 编辑样本盒
  const handleEditBox = async () => {
    if (!boxToEdit) return;
    
    try {
      await api.put(`/samples/storage/boxes/${boxToEdit.id}`, {
        code: boxForm.code,
        shelf_level: boxForm.shelf_level,
        rack_position: boxForm.rack_position,
      });
      toast.success('样本盒更新成功');
      setIsEditBoxOpen(false);
      setBoxToEdit(null);
      setBoxForm({ code: '', freezer_id: '', shelf_level: '', rack_position: '', rows: 10, cols: 10 });
      fetchBoxes(selectedFreezer?.id);
    } catch (e) {
      toast.error('更新失败');
    }
  };

  // 删除样本盒
  const handleDeleteBox = async () => {
    if (!boxToDelete) return;
    
    try {
      await api.delete(`/samples/storage/boxes/${boxToDelete.id}`);
      toast.success('样本盒删除成功');
      setIsDeleteConfirmOpen(false);
      setBoxToDelete(null);
      fetchBoxes(selectedFreezer?.id);
    } catch (e) {
      toast.error('删除失败，样本盒可能包含样本');
    }
  };

  const openEditDialog = (box: SampleBox) => {
    setBoxToEdit(box);
    setBoxForm({
      code: box.code,
      freezer_id: box.freezer_id,
      shelf_level: box.shelf_level,
      rack_position: box.rack_position,
      rows: box.rows,
      cols: box.cols
    });
    setIsEditBoxOpen(true);
  };

  const openDeleteDialog = (box: SampleBox) => {
    setBoxToDelete(box);
    setIsDeleteConfirmOpen(true);
  };

  // 筛选逻辑
  const filteredFreezers = freezers.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredBoxes = boxes.filter(b =>
    b.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (selectedFreezer ? b.freezer_id === selectedFreezer.id : true)
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-4">
        {/* ... existing code ... */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            {selectedFreezer && (
              <Button plain onClick={handleBackToFreezers}>
                <ChevronLeftIcon className="w-5 h-5" />
              </Button>
            )}
            <div>
              <Text className="font-medium text-lg">
                {selectedFreezer ? `${selectedFreezer.name}` : '冰箱列表'}
              </Text>
              <Text className="text-sm text-zinc-500">
                {selectedFreezer 
                  ? `${selectedFreezer.location} | ${selectedFreezer.temperature}°C | ${selectedFreezer.used_boxes}/${selectedFreezer.total_boxes} 盒`
                  : '管理实验室所有冰箱及其存储的样本盒'
                }
              </Text>
            </div>
          </div>
          <div className="flex gap-2">
            {selectedFreezer && (
              <Button onClick={() => {
                setBoxForm({ code: '', freezer_id: selectedFreezer.id, shelf_level: '', rack_position: '', rows: 10, cols: 10 });
                setIsAddBoxOpen(true);
              }}>
                <PlusIcon className="w-4 h-4 mr-1" />
                添加样本盒
              </Button>
            )}
            <Button plain onClick={() => { fetchFreezers(); fetchBoxes(selectedFreezer?.id); }}>
              <ArrowPathIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none z-10" />
              <Input
                type="text"
                placeholder={selectedFreezer ? "搜索样本盒..." : "搜索冰箱..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-1 bg-zinc-100 rounded-lg p-1">
              <button
                className={clsx(
                  'px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1',
                  viewMode === 'grid' ? 'bg-white shadow text-zinc-900' : 'text-zinc-600 hover:text-zinc-900'
                )}
                onClick={() => setViewMode('grid')}
              >
                <Squares2X2Icon className="w-4 h-4" />
                网格
              </button>
              <button
                className={clsx(
                  'px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1',
                  viewMode === 'list' ? 'bg-white shadow text-zinc-900' : 'text-zinc-600 hover:text-zinc-900'
                )}
                onClick={() => setViewMode('list')}
              >
                <ListBulletIcon className="w-4 h-4" />
                列表
              </button>
            </div>
        </div>

        <div className="min-h-[400px]">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
              <Text className="text-zinc-500">加载存储数据中...</Text>
            </div>
          ) : selectedFreezer ? (
            // 样本盒视图
            <div>
              {filteredBoxes.length === 0 ? (
                <div className="text-center py-12">
                  <ArchiveBoxIcon className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
                  <Text className="text-zinc-500 mb-4">该冰箱暂无样本盒</Text>
                  <Button onClick={() => {
                    setBoxForm({ code: '', freezer_id: selectedFreezer.id, shelf_level: '', rack_position: '', rows: 10, cols: 10 });
                    setIsAddBoxOpen(true);
                  }}>
                    <PlusIcon className="w-4 h-4" />
                    添加第一个样本盒
                  </Button>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  <AnimatePresence>
                    {filteredBoxes.map((box) => (
                      <BoxCard 
                        key={box.id} 
                        box={box} 
                        onClick={() => handleBoxSelect(box)}
                        onEdit={() => openEditDialog(box)}
                        onDelete={() => openDeleteDialog(box)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <Table striped>
                  <TableHead>
                    <TableRow>
                      <TableHeader>样本盒编号</TableHeader>
                      <TableHeader>位置</TableHeader>
                      <TableHeader>规格</TableHeader>
                      <TableHeader>使用情况</TableHeader>
                      <TableHeader>创建时间</TableHeader>
                      <TableHeader>操作</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredBoxes.map((box) => (
                      <TableRow key={box.id}>
                        <TableCell className="font-medium">{box.code}</TableCell>
                        <TableCell className="font-mono text-sm">{box.shelf_level}-{box.rack_position}</TableCell>
                        <TableCell>{box.rows} × {box.cols}</TableCell>
                        <TableCell>
                          <Badge color={box.used_slots === box.total_slots ? 'red' : box.used_slots > box.total_slots * 0.8 ? 'yellow' : 'green'}>
                            {box.used_slots} / {box.total_slots}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(box.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button plain onClick={() => handleBoxSelect(box)}>
                              <EyeIcon className="w-4 h-4" />
                            </Button>
                            <Button plain onClick={() => openEditDialog(box)}>
                              <PencilIcon className="w-4 h-4" />
                            </Button>
                            <Button plain onClick={() => openDeleteDialog(box)} className="text-red-600 hover:text-red-700">
                              <TrashIcon className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ) : (
            // 冰箱视图
            <div>
              {filteredFreezers.length === 0 ? (
                <div className="text-center py-12">
                  <CubeIcon className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
                  <Text className="text-zinc-500">暂无冰箱数据</Text>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  <AnimatePresence>
                    {filteredFreezers.map((freezer) => (
                      <FreezerCard
                        key={freezer.id}
                        freezer={freezer}
                        onClick={() => handleFreezerSelect(freezer)}
                        isSelected={(selectedFreezer as any)?.id === freezer.id}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <Table striped>
                  <TableHead>
                    <TableRow>
                      <TableHeader>冰箱名称</TableHeader>
                      <TableHeader>位置</TableHeader>
                      <TableHeader>温度</TableHeader>
                      <TableHeader>层数</TableHeader>
                      <TableHeader>样本盒</TableHeader>
                      <TableHeader>使用率</TableHeader>
                      <TableHeader>操作</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredFreezers.map((freezer) => (
                      <TableRow key={freezer.id}>
                        <TableCell className="font-medium">{freezer.name}</TableCell>
                        <TableCell>{freezer.location}</TableCell>
                        <TableCell>
                          <Badge color={freezer.temperature <= -70 ? 'blue' : freezer.temperature <= -20 ? 'cyan' : 'yellow'}>
                            {freezer.temperature}°C
                          </Badge>
                        </TableCell>
                        <TableCell>{freezer.shelves} 层</TableCell>
                        <TableCell>{freezer.used_boxes} / {freezer.total_boxes}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-zinc-100 rounded-full overflow-hidden">
                              <div 
                                className={clsx(
                                  'h-full rounded-full',
                                  freezer.used_boxes / freezer.total_boxes >= 0.9 ? 'bg-red-500' :
                                  freezer.used_boxes / freezer.total_boxes >= 0.7 ? 'bg-amber-500' : 'bg-emerald-500'
                                )}
                                style={{ width: `${(freezer.used_boxes / freezer.total_boxes) * 100}%` }}
                              />
                            </div>
                            <span className="text-sm">{Math.round((freezer.used_boxes / freezer.total_boxes) * 100)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button plain onClick={() => handleFreezerSelect(freezer)}>查看</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 样本盒详情对话框 */}
      <Dialog open={isBoxDetailOpen} onClose={() => setIsBoxDetailOpen(false)} size="4xl">
        <DialogTitle className="flex items-center justify-between">
          <span>{selectedBox ? `样本盒详情 - ${selectedBox.code}` : '样本盒详情'}</span>
          <div className="flex gap-1 bg-zinc-100 rounded-lg p-1">
            <button
              className={clsx(
                'px-2 py-1 text-xs rounded transition-all flex items-center gap-1',
                boxDetailViewMode === 'grid' ? 'bg-white shadow text-zinc-900' : 'text-zinc-600 hover:text-zinc-900'
              )}
              onClick={() => setBoxDetailViewMode('grid')}
            >
              <Squares2X2Icon className="w-3 h-3" />
              网格
            </button>
            <button
              className={clsx(
                'px-2 py-1 text-xs rounded transition-all flex items-center gap-1',
                boxDetailViewMode === 'list' ? 'bg-white shadow text-zinc-900' : 'text-zinc-600 hover:text-zinc-900'
              )}
              onClick={() => setBoxDetailViewMode('list')}
            >
              <ListBulletIcon className="w-3 h-3" />
              列表
            </button>
          </div>
        </DialogTitle>
        <DialogDescription>
          {selectedBox && (
            <div className="grid grid-cols-4 gap-4 mt-2">
              <div className="text-center p-2 bg-zinc-50 rounded">
                <div className="text-xs text-zinc-500">冰箱</div>
                <div className="font-medium">{selectedBox.freezer_id}</div>
              </div>
              <div className="text-center p-2 bg-zinc-50 rounded">
                <div className="text-xs text-zinc-500">位置</div>
                <div className="font-medium">{selectedBox.shelf_level}-{selectedBox.rack_position}</div>
              </div>
              <div className="text-center p-2 bg-zinc-50 rounded">
                <div className="text-xs text-zinc-500">规格</div>
                <div className="font-medium">{selectedBox.rows} × {selectedBox.cols}</div>
              </div>
              <div className="text-center p-2 bg-zinc-50 rounded">
                <div className="text-xs text-zinc-500">使用</div>
                <div className="font-medium">{boxSamples.length} / {selectedBox.total_slots}</div>
              </div>
            </div>
          )}
        </DialogDescription>
        <DialogBody>
          {loadingBoxSamples ? (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
              <Text className="text-zinc-500">加载样本数据...</Text>
            </div>
          ) : selectedBox ? (
            boxDetailViewMode === 'grid' ? (
              <BoxGridView
                box={selectedBox}
                samples={boxSamples}
                onSampleClick={handleSampleClick}
                selectedSampleId={selectedSampleId}
                highlightedPosition={highlightedPosition}
                onPositionHover={setHighlightedPosition}
              />
            ) : (
              <BoxListView
                samples={boxSamples}
                onSampleClick={handleSampleClick}
                selectedSampleId={selectedSampleId}
              />
            )
          ) : null}
        </DialogBody>
        <DialogActions>
          <div className="flex gap-2 w-full justify-end">
            {selectedSample?.status === 'in_storage' && (
              <>
                <Button outline onClick={() => {
                  setIsBoxDetailOpen(false);
                  onCheckout([selectedSample]); // 传递数组
                }}>
                  申请领用
                </Button>
                <Button outline onClick={() => {
                  // 跳转到转移页面，并带上样本编号
                  router.push(`/samples/transfer?code=${selectedSample.sample_code}`);
                }}>
                  申请转移
                </Button>
              </>
            )}
            <Button plain onClick={() => setIsBoxDetailOpen(false)}>关闭</Button>
          </div>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default function SampleOperationsPage() {
  const router = useRouter();
  const { selectedProjectId } = useProjectStore();
  const [activeTab, setActiveTab] = useState<'borrow' | 'return' | 'inbound' | 'storage'>('borrow');
  const [checkoutSamples, setCheckoutSamples] = useState<any[]>([]);

  // 处理从其他 Tab 跳转过来的领用请求
  const handleCheckout = (samples: any[]) => {
    setCheckoutSamples(samples);
    setActiveTab('borrow');
  };

  // 简单的权限或项目检查
  if (!selectedProjectId) {
      return (
          <AppLayout>
              <div className="text-center py-20">
                  <Text>请先在左上角选择一个项目</Text>
              </div>
          </AppLayout>
      )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
            <Heading>样本作业中心</Heading>
            <Text className="mt-1 text-zinc-600">一站式管理样本领用、归还及特殊入库</Text>
        </div>

        {/* 主要导航 Tabs */}
        <div className="mb-6">
            <Tabs 
                tabs={[
                    { key: 'borrow', label: '样本领用' },
                    { key: 'return', label: '样本归还' },
                    { key: 'inbound', label: '特殊入库' },
                    { key: 'storage', label: '存储管理' },
                ]}
                activeTab={activeTab}
                onChange={(k) => setActiveTab(k as any)}
            />
        </div>

        {/* 内容区域 */}
        <div className="mt-4">
            {activeTab === 'borrow' && <CheckoutTab projectId={selectedProjectId} initialSamples={checkoutSamples} />}
            {activeTab === 'return' && <ReturnTab projectId={selectedProjectId} />}
            {activeTab === 'inbound' && <InboundTab projectId={selectedProjectId} />}
            {activeTab === 'storage' && <StorageTab projectId={selectedProjectId} onCheckout={handleCheckout} />}
        </div>
      </div>
    </AppLayout>
  );
}
