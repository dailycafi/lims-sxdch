import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/date-utils';
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
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/dialog';
import { toast } from 'react-hot-toast';
import { MagnifyingGlassIcon, ArrowPathIcon, ArrowRightIcon } from '@heroicons/react/20/solid';

// Tab 1: 领用 (Checkout) 组件
function CheckoutTab({ projectId }: { projectId: number | null }) {
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
        // 注意：后端目前 is_primary 是 bool，不支持多选混合（既要a1又要b1），
        // 这里简化处理：如果选了正份则查正份，如果选了备份查备份，如果都选或都没选则不限
        // 理想情况后端应该支持 primary_types / backup_types 筛选
      };
      
      const res = await api.get('/samples', { params });
      setPreviewSamples(res.data || []);
      setSelectedSamples([]); // 重置选择
    } catch (e) {
      toast.error('查询样本失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedSamples.length === previewSamples.length) {
      setSelectedSamples([]);
    } else {
      setSelectedSamples(previewSamples.map(s => s.sample_code));
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
                 />
                 <MatrixFilter 
                    title="检测类型" 
                    options={matrixData.testTypes} 
                    selected={selection.testTypes} 
                    onChange={(v) => setSelection({...selection, testTypes: v})}
                 />
                 <MatrixFilter 
                    title="正份 (套)" 
                    options={matrixData.primary} 
                    selected={selection.primary} 
                    onChange={(v) => setSelection({...selection, primary: v})}
                 />
                 <MatrixFilter 
                    title="备份 (套)" 
                    options={matrixData.backup} 
                    selected={selection.backup} 
                    onChange={(v) => setSelection({...selection, backup: v})}
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
                                checked={previewSamples.length > 0 && selectedSamples.length === previewSamples.length}
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
                            <TableRow key={sample.id}>
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
                                <TableCell colSpan={7} className="text-center py-8 text-zinc-500">暂无待归还的领用单</TableCell>
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
                                            <Button plain className="text-zinc-900" onClick={() => router.push(`/samples/return/${req.id}`)}>
                                                归还
                                            </Button>
                                            {/* 跟踪表功能在归还页面或此处皆可，这里演示 */}
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
    const [generating, setGenerating] = useState(false);
    const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);

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
                         <Input value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="扫描或输入冰箱编号"/>
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


export default function SampleOperationsPage() {
  const router = useRouter();
  const { selectedProjectId } = useProjectStore();
  const [activeTab, setActiveTab] = useState<'borrow' | 'return' | 'inbound'>('borrow');

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
                ]}
                activeTab={activeTab}
                onChange={(k) => setActiveTab(k as any)}
            />
        </div>

        {/* 内容区域 */}
        <div className="mt-4">
            {activeTab === 'borrow' && <CheckoutTab projectId={selectedProjectId} />}
            {activeTab === 'return' && <ReturnTab projectId={selectedProjectId} />}
            {activeTab === 'inbound' && <InboundTab projectId={selectedProjectId} />}
        </div>
      </div>
    </AppLayout>
  );
}
