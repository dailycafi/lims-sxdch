import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { Tabs } from '@/components/tabs';
import { api } from '@/lib/api';
import { 
  ArrowsRightLeftIcon,
  TruckIcon,
  BuildingOfficeIcon,
  QrCodeIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  FunnelIcon,
  ChevronUpIcon,
  XMarkIcon
} from '@heroicons/react/20/solid';
import { AnimatedLoadingState, AnimatedEmptyState, AnimatedTableRow } from '@/components/animated-table';
import { ArrowsRightLeftIcon as ArrowsRightLeftIconOutline } from '@heroicons/react/24/outline';

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
  const [viewMode, setViewMode] = useState<'internal' | 'external' | 'completed' | 'all'>('external');
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [isInternalTransferOpen, setIsInternalTransferOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedSamples, setSelectedSamples] = useState<string[]>([]);
  const [availableSamples, setAvailableSamples] = useState<Sample[]>([]);
  
  // 新增筛选状态
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const [filters, setFilters] = useState({
    searchText: '',
    project: 'all',
    fromLocation: 'all',
    toLocation: 'all',
    transferType: 'all',
    dateFrom: '',
    dateTo: ''
  });
  
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
  }, [viewMode]); // 依赖项改为 viewMode

  const fetchTransfers = async () => {
    try {
      const response = await api.get('/samples/transfers', {
        params: { type: viewMode } // 根据 viewMode 传递参数
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
      const response = await api.get('/global-params/organizations');  // 修改为使用连字符
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

  // 计算活跃筛选器数量
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    return value !== '' && value !== 'all';
  }).length;

  // 重置筛选
  const resetFilters = () => {
    setFilters({
      searchText: '',
      project: 'all',
      fromLocation: 'all',
      toLocation: 'all',
      transferType: 'all',
      dateFrom: '',
      dateTo: ''
    });
  };

  // 应用视图模式过滤
  const filteredByViewMode = (transfers: TransferRequest[]) => {
    if (viewMode === 'all') return transfers;
    if (viewMode === 'internal') return transfers.filter(t => t.transfer_type === 'internal');
    if (viewMode === 'external') return transfers.filter(t => t.transfer_type === 'external');
    if (viewMode === 'completed') return transfers.filter(t => t.status === 'completed');
    return transfers;
  };

  // 应用筛选
  const applyFilters = (transfers: TransferRequest[]) => {
    return transfers.filter(transfer => {
      // 搜索文本筛选
      if (filters.searchText && 
          !transfer.transfer_code.toLowerCase().includes(filters.searchText.toLowerCase()) &&
          !transfer.project.lab_project_code.toLowerCase().includes(filters.searchText.toLowerCase())) {
        return false;
      }
      
      // 项目筛选
      if (filters.project !== 'all' && transfer.project.lab_project_code !== filters.project) {
        return false;
      }
      
      // 来源位置筛选
      if (filters.fromLocation !== 'all' && transfer.from_location !== filters.fromLocation) {
        return false;
      }
      
      // 目标位置筛选
      if (filters.toLocation !== 'all' && transfer.to_location !== filters.toLocation) {
        return false;
      }
      
      // 转移类型筛选
      if (filters.transferType !== 'all' && transfer.transfer_type !== filters.transferType) {
        return false;
      }
      
      // 日期范围筛选
      const transferDate = new Date(transfer.created_at);
      if (filters.dateFrom && new Date(filters.dateFrom) > transferDate) {
        return false;
      }
      if (filters.dateTo && new Date(filters.dateTo) < transferDate) {
        return false;
      }
      
      return true;
    });
  };

  const filteredTransfers = applyFilters(filteredByViewMode(transfers));

  // 获取唯一值用于筛选
  const uniqueFromLocations = Array.from(new Set(transfers.map(t => t.from_location)));
  const uniqueToLocations = Array.from(new Set(transfers.map(t => t.to_location)));

  const handleViewDetails = (transfer: TransferRequest) => {
    // 实现查看详情逻辑
    console.log('Viewing details for transfer:', transfer);
    // 可以打开一个对话框或导航到详情页面
  };

  const handleExecuteTransfer = (transfer: TransferRequest) => {
    // 实现执行转移逻辑
    console.log('Executing transfer:', transfer);
    // 可以打开一个确认对话框
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* 页面标题和操作按钮 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Heading>样本转移</Heading>
            <Text className="mt-1 text-zinc-600">管理样本内部和外部转移</Text>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => setIsInternalTransferOpen(true)}
            >
              <BuildingOfficeIcon className="h-4 w-4" />
              内部转移
            </Button>
            <Button 
              onClick={() => setIsTransferDialogOpen(true)}
            >
              <TruckIcon className="h-4 w-4" />
              外部转移
            </Button>
          </div>
        </div>

        {/* 筛选区域 - 可折叠 */}
        <div className="bg-white rounded-lg shadow-md border border-gray-100 mb-6 overflow-hidden">
          {/* 筛选标题栏 */}
          <div 
            className="px-5 py-3 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          >
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-600" />
              <span className="font-medium text-gray-900">筛选条件</span>
              {activeFilterCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </div>
            <motion.div
              animate={{ rotate: isFilterExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronUpIcon className="h-5 w-5 text-gray-400" />
            </motion.div>
          </div>

          {/* 可折叠的筛选内容 */}
          <AnimatePresence initial={false}>
            {isFilterExpanded && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="p-5">
                  {/* 搜索框行 */}
                  <div className="mb-4">
                    <Input
                      type="text"
                      placeholder="搜索转移编号或项目..."
                      value={filters.searchText}
                      onChange={(e) => setFilters({ ...filters, searchText: e.target.value })}
                      className="w-full max-w-md h-11"
                    />
                  </div>

                  {/* 筛选器行 */}
                  <div className="grid grid-cols-4 gap-4 items-end">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">项目</label>
                      <Select
                        value={filters.project}
                        onChange={(e) => setFilters({ ...filters, project: e.target.value })}
                        className="w-full h-11 custom-select"
                      >
                        <option value="all">全部项目</option>
                        {projects.map(project => (
                          <option key={project.id} value={project.lab_project_code}>
                            {project.lab_project_code}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">来源位置</label>
                      <Select
                        value={filters.fromLocation}
                        onChange={(e) => setFilters({ ...filters, fromLocation: e.target.value })}
                        className="w-full h-11 custom-select"
                      >
                        <option value="all">全部来源</option>
                        {uniqueFromLocations.map(location => (
                          <option key={location} value={location}>{location}</option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">目标位置</label>
                      <Select
                        value={filters.toLocation}
                        onChange={(e) => setFilters({ ...filters, toLocation: e.target.value })}
                        className="w-full h-11 custom-select"
                      >
                        <option value="all">全部目标</option>
                        {uniqueToLocations.map(location => (
                          <option key={location} value={location}>{location}</option>
                        ))}
                      </Select>
                    </div>

                    <div className="flex gap-2">
                      {activeFilterCount > 0 && (
                        <Button
                          color="white"
                          onClick={resetFilters}
                          className="h-11"
                        >
                          <XMarkIcon className="h-4 w-4" />
                          清除筛选
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* 日期范围筛选 */}
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">转移日期范围</label>
                    <div className="flex items-center gap-2 max-w-md">
                      <Input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                        className="flex-1 h-11 custom-date-input"
                      />
                      <span className="text-gray-500">至</span>
                      <Input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                        className="flex-1 h-11 custom-date-input"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 表格容器 - 包含tabs */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white rounded-xl shadow-lg overflow-hidden"
        >
          {/* Tabs 栏 */}
          <div className="bg-gray-50 px-6 py-3">
            <Tabs
              tabs={[
                { key: 'external', label: '外部转移' },
                { key: 'internal', label: '内部转移' },
                { key: 'completed', label: '已完成' },
                { key: 'all', label: '全部' }
              ]}
              activeTab={viewMode}
              onChange={(key) => setViewMode(key as any)}
            />
          </div>

          {/* 结果统计 */}
          <div className="px-6 py-3 bg-gray-50/50">
            <Text className="text-sm text-zinc-600">
              共 {filteredTransfers.length} 条记录
              {activeFilterCount > 0 && ` (已应用 ${activeFilterCount} 个筛选条件)`}
            </Text>
          </div>
          
          {/* 表格内容 */}
          <div>
            <Table bleed={true} striped>
              <TableHead>
                <TableRow>
                  <TableHeader>转移编号</TableHeader>
                  <TableHeader>项目</TableHeader>
                  <TableHeader>类型</TableHeader>
                  <TableHeader>样本数量</TableHeader>
                  <TableHeader>来源</TableHeader>
                  <TableHeader>目标</TableHeader>
                  <TableHeader>申请人</TableHeader>
                  <TableHeader>申请时间</TableHeader>
                  <TableHeader>状态</TableHeader>
                  <TableHeader>操作</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                <AnimatePresence mode="wait">
                  {loading ? (
                    <AnimatedLoadingState 
                      key="loading"
                      colSpan={10} 
                      variant="skeleton"
                    />
                  ) : filteredTransfers.length === 0 ? (
                    <AnimatedEmptyState
                      key="empty"
                      colSpan={10}
                      icon={ArrowsRightLeftIcon}
                      text={activeFilterCount > 0 
                        ? '没有符合筛选条件的转移记录' 
                        : '暂无转移记录'}
                    />
                  ) : (
                    filteredTransfers.map((transfer) => (
                      <AnimatedTableRow key={transfer.id} index={0}>
                        <TableCell className="font-medium">{transfer.transfer_code}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{transfer.project.lab_project_code}</div>
                            <div className="text-xs text-zinc-500">{transfer.project.sponsor_project_code}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {transfer.transfer_type === 'internal' ? (
                            <Badge color="blue">内部</Badge>
                          ) : (
                            <Badge color="purple">外部</Badge>
                          )}
                        </TableCell>
                        <TableCell>{transfer.sample_count}</TableCell>
                        <TableCell className="text-sm">{transfer.from_location}</TableCell>
                        <TableCell className="text-sm">{transfer.to_location}</TableCell>
                        <TableCell>{transfer.requested_by.full_name}</TableCell>
                        <TableCell className="text-sm">
                          {new Date(transfer.created_at).toLocaleDateString('zh-CN')}
                        </TableCell>
                        <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button plain onClick={() => handleViewDetails(transfer)}>
                              查看
                            </Button>
                            {transfer.status === 'pending' && (
                              <Button color="blue" onClick={() => handleExecuteTransfer(transfer)}>
                                执行
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </AnimatedTableRow>
                    ))
                  )}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>
        </motion.div>
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
              <div className="cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setExternalForm({...externalForm, approval_file: e.target.files[0]});
                    }
                  }}
                  className="hidden"
                  id="approval-file-input"
                />
                <label htmlFor="approval-file-input">
                  <Button plain onClick={(e: React.MouseEvent) => e.preventDefault()}>
                    <CloudArrowUpIcon />
                    上传批准文件
                  </Button>
                </label>
              </div>
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
          <Button onClick={() => alert('确认转出')} color="white">
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
