import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Textarea } from '@/components/textarea';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Heading } from '@/components/heading';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { api } from '@/lib/api';
import { 
  ArrowsRightLeftIcon,
  TruckIcon,
  BuildingOfficeIcon,
  QrCodeIcon,
  CloudArrowUpIcon,
  CheckCircleIcon
} from '@heroicons/react/20/solid';

interface TransferRequest {
  id: number;
  transfer_code: string;
  transfer_type: 'internal' | 'external';
  project: {
    lab_project_code: string;
    sponsor_project_code: string;
  };
  requested_by: {
    full_name: string;
  };
  sample_count: number;
  from_location: string;
  to_location: string;
  status: string;
  created_at: string;
}

interface Sample {
  id: number;
  sample_code: string;
  current_location: string;
  selected?: boolean;
}

export default function SampleTransferPage() {
  const [activeTab, setActiveTab] = useState<'internal' | 'external'>('external');
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [isInternalTransferOpen, setIsInternalTransferOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedSamples, setSelectedSamples] = useState<string[]>([]);
  const [availableSamples, setAvailableSamples] = useState<Sample[]>([]);
  
  // 外部转移表单
  const [externalForm, setExternalForm] = useState({
    target_org_id: '',
    transport_method: '',
    target_date: '',
    approval_file: null as File | null,
    notes: ''
  });

  // 内部转移表单
  const [internalForm, setInternalForm] = useState({
    from_location: '',
    to_location: '',
    transport_method: '',
    temperature_monitor_id: '',
    sample_status: '',
    samples: [] as string[]
  });

  useEffect(() => {
    fetchTransfers();
    fetchProjects();
    fetchOrganizations();
  }, [activeTab]);

  const fetchTransfers = async () => {
    try {
      const response = await api.get('/samples/transfers', {
        params: { type: activeTab }
      });
      setTransfers(response.data);
    } catch (error) {
      console.error('Failed to fetch transfers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await api.get('/projects');
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const response = await api.get('/global_params/organizations');
      setOrganizations(response.data);
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    }
  };

  const fetchAvailableSamples = async (projectId: string) => {
    try {
      const response = await api.get('/samples', {
        params: {
          project_id: projectId,
          status: 'in_storage'
        }
      });
      setAvailableSamples(response.data);
    } catch (error) {
      console.error('Failed to fetch samples:', error);
    }
  };

  const handleExternalTransfer = async () => {
    try {
      const formData = new FormData();
      formData.append('project_id', selectedProject);
      formData.append('sample_codes', JSON.stringify(selectedSamples));
      formData.append('target_org_id', externalForm.target_org_id);
      formData.append('transport_method', externalForm.transport_method);
      formData.append('target_date', externalForm.target_date);
      formData.append('notes', externalForm.notes);
      
      if (externalForm.approval_file) {
        formData.append('approval_file', externalForm.approval_file);
      }

      await api.post('/samples/transfer/external', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setIsTransferDialogOpen(false);
      resetExternalForm();
      fetchTransfers();
    } catch (error) {
      console.error('Failed to create external transfer:', error);
    }
  };

  const handleInternalTransfer = async () => {
    try {
      await api.post('/samples/transfer/internal', {
        ...internalForm,
        samples: internalForm.samples
      });
      
      setIsInternalTransferOpen(false);
      resetInternalForm();
      fetchTransfers();
    } catch (error) {
      console.error('Failed to create internal transfer:', error);
    }
  };

  const handleScanLocation = (code: string, field: 'from' | 'to') => {
    if (field === 'from') {
      setInternalForm({ ...internalForm, from_location: code });
    } else {
      setInternalForm({ ...internalForm, to_location: code });
    }
  };

  const handleScanSample = (code: string) => {
    if (!internalForm.samples.includes(code)) {
      setInternalForm({
        ...internalForm,
        samples: [...internalForm.samples, code]
      });
    }
  };

  const resetExternalForm = () => {
    setSelectedProject('');
    setSelectedSamples([]);
    setExternalForm({
      target_org_id: '',
      transport_method: '',
      target_date: '',
      approval_file: null,
      notes: ''
    });
  };

  const resetInternalForm = () => {
    setInternalForm({
      from_location: '',
      to_location: '',
      transport_method: '',
      temperature_monitor_id: '',
      sample_status: '',
      samples: []
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge color="yellow">待执行</Badge>;
      case 'in_transit':
        return <Badge color="blue">运输中</Badge>;
      case 'completed':
        return <Badge color="green">已完成</Badge>;
      default:
        return <Badge color="zinc">{status}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading>样本转移</Heading>
            <Text className="mt-1 text-zinc-600">管理样本的内部和外部转移</Text>
          </div>
          <Button onClick={() => activeTab === 'external' ? setIsTransferDialogOpen(true) : setIsInternalTransferOpen(true)}>
            <ArrowsRightLeftIcon />
            {activeTab === 'external' ? '申请外部转移' : '内部转移'}
          </Button>
        </div>

        {/* 标签页 */}
        <div className="flex space-x-1 border-b border-zinc-200 mb-6">
          <button
            onClick={() => setActiveTab('external')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'external'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <TruckIcon className="h-5 w-5" />
            外部转移
          </button>
          <button
            onClick={() => setActiveTab('internal')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'internal'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <BuildingOfficeIcon className="h-5 w-5" />
            内部转移
          </button>
        </div>

        {/* 转移记录列表 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>转移编号</TableHeader>
                <TableHeader>项目</TableHeader>
                <TableHeader>申请人</TableHeader>
                <TableHeader>样本数量</TableHeader>
                <TableHeader>出发地</TableHeader>
                <TableHeader>目的地</TableHeader>
                <TableHeader>申请时间</TableHeader>
                <TableHeader>状态</TableHeader>
                <TableHeader>操作</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <Text>加载中...</Text>
                  </TableCell>
                </TableRow>
              ) : transfers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <Text>暂无转移记录</Text>
                  </TableCell>
                </TableRow>
              ) : (
                transfers.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell className="font-medium">{transfer.transfer_code}</TableCell>
                    <TableCell>{transfer.project.lab_project_code}</TableCell>
                    <TableCell>{transfer.requested_by.full_name}</TableCell>
                    <TableCell>{transfer.sample_count}</TableCell>
                    <TableCell>{transfer.from_location}</TableCell>
                    <TableCell>{transfer.to_location}</TableCell>
                    <TableCell className="text-zinc-600">
                      {new Date(transfer.created_at).toLocaleDateString('zh-CN')}
                    </TableCell>
                    <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                    <TableCell>
                      <Button plain size="small">
                        查看
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 外部转移对话框 */}
      <Dialog open={isTransferDialogOpen} onClose={setIsTransferDialogOpen} size="4xl">
        <DialogTitle>申请外部转移</DialogTitle>
        <DialogDescription>
          将样本转移到外部单位
        </DialogDescription>
        <DialogBody>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  项目 <span className="text-red-500">*</span>
                </label>
                <Select
                  value={selectedProject}
                  onChange={(e) => {
                    setSelectedProject(e.target.value);
                    if (e.target.value) {
                      fetchAvailableSamples(e.target.value);
                    }
                  }}
                  required
                >
                  <option value="">请选择项目</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.lab_project_code} - {project.sponsor_project_code}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  目标单位 <span className="text-red-500">*</span>
                </label>
                <Select
                  value={externalForm.target_org_id}
                  onChange={(e) => setExternalForm({...externalForm, target_org_id: e.target.value})}
                  required
                >
                  <option value="">请选择目标单位</option>
                  {organizations.map((org) => (
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
                  value={externalForm.transport_method}
                  onChange={(e) => setExternalForm({...externalForm, transport_method: e.target.value})}
                  required
                >
                  <option value="">请选择运输方式</option>
                  <option value="cold_chain">冷链运输</option>
                  <option value="frozen">冷冻运输</option>
                  <option value="room_temp">常温运输</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  目标时间 <span className="text-red-500">*</span>
                </label>
                <Input
                  type="datetime-local"
                  value={externalForm.target_date}
                  onChange={(e) => setExternalForm({...externalForm, target_date: e.target.value})}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                申办方批准文件 <span className="text-red-500">*</span>
              </label>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setExternalForm({...externalForm, approval_file: e.target.files[0]});
                    }
                  }}
                  className="hidden"
                />
                <Button as="span" plain>
                  <CloudArrowUpIcon />
                  上传批准文件
                </Button>
              </label>
              {externalForm.approval_file && (
                <Text className="text-sm text-green-600 mt-1">
                  已选择: {externalForm.approval_file.name}
                </Text>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                备注
              </label>
              <Textarea
                value={externalForm.notes}
                onChange={(e) => setExternalForm({...externalForm, notes: e.target.value})}
                placeholder="特殊要求或说明"
                rows={2}
              />
            </div>

            {/* 样本选择 */}
            {selectedProject && (
              <div>
                <Text className="font-medium mb-2">选择样本（已选 {selectedSamples.length} 个）</Text>
                <div className="border border-zinc-200 rounded-lg max-h-64 overflow-y-auto">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeader className="w-12">
                          <input
                            type="checkbox"
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSamples(availableSamples.map(s => s.sample_code));
                              } else {
                                setSelectedSamples([]);
                              }
                            }}
                          />
                        </TableHeader>
                        <TableHeader>样本编号</TableHeader>
                        <TableHeader>当前位置</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {availableSamples.map((sample) => (
                        <TableRow key={sample.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedSamples.includes(sample.sample_code)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSamples([...selectedSamples, sample.sample_code]);
                                } else {
                                  setSelectedSamples(selectedSamples.filter(s => s !== sample.sample_code));
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">{sample.sample_code}</TableCell>
                          <TableCell className="text-sm text-zinc-600">{sample.current_location}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => {
            setIsTransferDialogOpen(false);
            resetExternalForm();
          }}>
            取消
          </Button>
          <Button 
            onClick={handleExternalTransfer}
            disabled={!selectedProject || selectedSamples.length === 0 || !externalForm.target_org_id || !externalForm.approval_file}
          >
            提交申请
          </Button>
        </DialogActions>
      </Dialog>

      {/* 内部转移对话框 */}
      <Dialog open={isInternalTransferOpen} onClose={setIsInternalTransferOpen} size="4xl">
        <DialogTitle>内部转移</DialogTitle>
        <DialogDescription>
          在实验室内部转移样本位置
        </DialogDescription>
        <DialogBody>
          <div className="space-y-6">
            {/* 转出部分 */}
            <div>
              <Text className="font-medium mb-4">转出信息</Text>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    转出位置
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={internalForm.from_location}
                      onChange={(e) => setInternalForm({...internalForm, from_location: e.target.value})}
                      placeholder="扫描或输入位置条码"
                    />
                    <Button plain onClick={() => {}}>
                      <QrCodeIcon />
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    温度记录仪编号
                  </label>
                  <Input
                    value={internalForm.temperature_monitor_id}
                    onChange={(e) => setInternalForm({...internalForm, temperature_monitor_id: e.target.value})}
                    placeholder="输入温度记录仪编号"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    运输方式
                  </label>
                  <Select
                    value={internalForm.transport_method}
                    onChange={(e) => setInternalForm({...internalForm, transport_method: e.target.value})}
                  >
                    <option value="">请选择</option>
                    <option value="cart">推车运输</option>
                    <option value="portable_freezer">便携式冷冻箱</option>
                    <option value="manual">人工搬运</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    样本状态
                  </label>
                  <Select
                    value={internalForm.sample_status}
                    onChange={(e) => setInternalForm({...internalForm, sample_status: e.target.value})}
                  >
                    <option value="">请选择</option>
                    <option value="good">完好</option>
                    <option value="thawed">疑似解冻</option>
                    <option value="damaged">包装破损</option>
                  </Select>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  扫描样本
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="扫描样本条码"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleScanSample((e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                  />
                  <Button plain>
                    <QrCodeIcon />
                  </Button>
                </div>
                {internalForm.samples.length > 0 && (
                  <div className="mt-2 p-2 bg-zinc-50 rounded">
                    <Text className="text-sm text-zinc-600">
                      已扫描 {internalForm.samples.length} 个样本
                    </Text>
                  </div>
                )}
              </div>
            </div>

            {/* 转入部分 */}
            <div>
              <Text className="font-medium mb-4">转入信息</Text>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  目标位置
                </label>
                <div className="flex gap-2">
                  <Input
                    value={internalForm.to_location}
                    onChange={(e) => setInternalForm({...internalForm, to_location: e.target.value})}
                    placeholder="扫描或输入目标位置条码"
                  />
                  <Button plain onClick={() => {}}>
                    <QrCodeIcon />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => {
            setIsInternalTransferOpen(false);
            resetInternalForm();
          }}>
            取消
          </Button>
          <Button onClick={() => alert('确认转出')} variant="secondary">
            确认转出
          </Button>
          <Button 
            onClick={handleInternalTransfer}
            disabled={!internalForm.from_location || !internalForm.to_location || internalForm.samples.length === 0}
          >
            <CheckCircleIcon />
            完成转入
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
