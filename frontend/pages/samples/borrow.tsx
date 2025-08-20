import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Checkbox } from '@/components/checkbox';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Heading } from '@/components/heading';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { Textarea } from '@/components/textarea';
import { Tabs } from '@/components/tabs';
import { api } from '@/lib/api';
import { 
  PlusIcon,
  BeakerIcon,
  ArrowUpOnSquareIcon,
  ArrowDownOnSquareIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  FunnelIcon,
  ChevronUpIcon,
  XMarkIcon
} from '@heroicons/react/20/solid';

interface BorrowRequest {
  id: number;
  request_code: string;
  project: {
    lab_project_code: string;
    sponsor_project_code: string;
  };
  requested_by: {
    full_name: string;
  };
  sample_count: number;
  purpose: string;
  target_location: string;
  target_date: string;
  status: 'pending' | 'approved' | 'borrowed' | 'returned' | 'partial_returned';
  created_at: string;
}

interface Sample {
  id: number;
  sample_code: string;
  test_type: string;
  subject_code: string;
  collection_time: string;
  status: string;
  location: string;
  selected?: boolean;
}

export default function SampleBorrowPage() {
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'pending' | 'approved' | 'borrowed' | 'returned' | 'all'>('pending');
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<BorrowRequest | null>(null);
  const [selectedProject, setSelectedProject] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [availableSamples, setAvailableSamples] = useState<Sample[]>([]);
  const [selectedSamples, setSelectedSamples] = useState<string[]>([]);
  
  // 新增筛选状态
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const [filters, setFilters] = useState({
    searchText: '',
    project: 'all',
    requestedBy: 'all',
    targetLocation: 'all',
    dateFrom: '',
    dateTo: ''
  });
  
  const [borrowForm, setBorrowForm] = useState({
    purpose: '',
    target_location: '',
    target_date: '',
    notes: ''
  });

  useEffect(() => {
    fetchRequests();
    fetchProjects();
  }, [viewMode]); // 依赖于 viewMode 变化

  const fetchRequests = async () => {
    try {
      const response = await api.get('/samples/borrow-requests', {
        params: { status: viewMode } // 根据 viewMode 筛选
      });
      setRequests(response.data);
    } catch (error) {
      console.error('Failed to fetch borrow requests:', error);
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

  const fetchAvailableSamples = async (projectId: string) => {
    try {
      const response = await api.get('/samples', {
        params: {
          project_id: projectId,
          status: 'in_storage'
        }
      });
      setAvailableSamples(response.data.map((sample: Sample) => ({
        ...sample,
        selected: false
      })));
    } catch (error) {
      console.error('Failed to fetch available samples:', error);
    }
  };

  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId);
    setSelectedSamples([]);
    if (projectId) {
      fetchAvailableSamples(projectId);
    } else {
      setAvailableSamples([]);
    }
  };

  const handleSampleToggle = (sampleCode: string) => {
    setSelectedSamples(prev => {
      if (prev.includes(sampleCode)) {
        return prev.filter(code => code !== sampleCode);
      } else {
        return [...prev, sampleCode];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedSamples.length === availableSamples.length) {
      setSelectedSamples([]);
    } else {
      setSelectedSamples(availableSamples.map(s => s.sample_code));
    }
  };

  const handleSubmitRequest = async () => {
    try {
      await api.post('/samples/borrow-request', {
        project_id: selectedProject,
        sample_codes: selectedSamples,
        ...borrowForm
      });
      
      setIsRequestDialogOpen(false);
      resetForm();
      fetchRequests();
    } catch (error) {
      console.error('Failed to submit borrow request:', error);
    }
  };

  const handleApproveBorrow = async (requestId: number) => {
    try {
      await api.post(`/samples/borrow-request/${requestId}/approve`);
      fetchRequests();
    } catch (error) {
      console.error('Failed to approve borrow request:', error);
    }
  };

  const handleExecuteBorrow = async (request: BorrowRequest) => {
    // 跳转到领用执行页面
    window.location.href = `/samples/borrow/execute/${request.id}`;
  };

  const handleReturnSamples = async (requestId: number) => {
    // 跳转到归还页面
    window.location.href = `/samples/return/${requestId}`;
  };

  const handleViewDetails = (request: BorrowRequest) => {
    setSelectedRequest(request);
    setIsDetailDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedProject('');
    setSelectedSamples([]);
    setAvailableSamples([]);
    setBorrowForm({
      purpose: '',
      target_location: '',
      target_date: '',
      notes: ''
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge color="yellow">待审批</Badge>;
      case 'approved':
        return <Badge color="blue">已批准</Badge>;
      case 'borrowed':
        return <Badge color="purple">已领用</Badge>;
      case 'returned':
        return <Badge color="green">已归还</Badge>;
      case 'partial_returned':
        return <Badge color="amber">部分归还</Badge>;
      default:
        return <Badge color="zinc">{status}</Badge>;
    }
  };

  const getPurposeLabel = (purpose: string) => {
    switch (purpose) {
      case 'first_test':
        return '首次检测';
      case 'retest':
        return '重测';
      case 'isr':
        return 'ISR测试';
      default:
        return purpose;
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
      requestedBy: 'all',
      targetLocation: 'all',
      dateFrom: '',
      dateTo: ''
    });
  };

  // 应用视图模式过滤
  const filteredByViewMode = (requests: BorrowRequest[]) => {
    if (viewMode === 'all') return requests;
    return requests.filter(r => r.status === viewMode);
  };

  // 应用筛选
  const applyFilters = (requests: BorrowRequest[]) => {
    return requests.filter(request => {
      // 搜索文本筛选
      if (filters.searchText && 
          !request.request_code.toLowerCase().includes(filters.searchText.toLowerCase()) &&
          !request.purpose.toLowerCase().includes(filters.searchText.toLowerCase())) {
        return false;
      }
      
      // 项目筛选
      if (filters.project !== 'all' && request.project.lab_project_code !== filters.project) {
        return false;
      }
      
      // 申请人筛选
      if (filters.requestedBy !== 'all' && request.requested_by.full_name !== filters.requestedBy) {
        return false;
      }
      
      // 目标位置筛选
      if (filters.targetLocation !== 'all' && request.target_location !== filters.targetLocation) {
        return false;
      }
      
      // 日期范围筛选
      const requestDate = new Date(request.created_at);
      if (filters.dateFrom && new Date(filters.dateFrom) > requestDate) {
        return false;
      }
      if (filters.dateTo && new Date(filters.dateTo) < requestDate) {
        return false;
      }
      
      return true;
    });
  };

  const filteredRequests = applyFilters(filteredByViewMode(requests));

  // 获取唯一值用于筛选
  const uniqueRequesters = Array.from(new Set(requests.map(r => r.requested_by.full_name)));
  const uniqueLocations = Array.from(new Set(requests.map(r => r.target_location)));

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* 页面标题和操作按钮 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Heading>样本领用</Heading>
            <Text className="mt-1 text-zinc-600">管理样本领用申请和记录</Text>
          </div>
          <Button color="blue" onClick={() => setIsRequestDialogOpen(true)}>
            <PlusIcon className="h-4 w-4" />
            新建领用申请
          </Button>
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
                      placeholder="搜索申请编号或用途..."
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">申请人</label>
                      <Select
                        value={filters.requestedBy}
                        onChange={(e) => setFilters({ ...filters, requestedBy: e.target.value })}
                        className="w-full h-11 custom-select"
                      >
                        <option value="all">全部申请人</option>
                        {uniqueRequesters.map(requester => (
                          <option key={requester} value={requester}>{requester}</option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">目标位置</label>
                      <Select
                        value={filters.targetLocation}
                        onChange={(e) => setFilters({ ...filters, targetLocation: e.target.value })}
                        className="w-full h-11 custom-select"
                      >
                        <option value="all">全部位置</option>
                        {uniqueLocations.map(location => (
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">申请日期范围</label>
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
                { key: 'pending', label: '待审批' },
                { key: 'approved', label: '已批准' },
                { key: 'borrowed', label: '已领用' },
                { key: 'returned', label: '已归还' },
                { key: 'all', label: '全部' }
              ]}
              activeTab={viewMode}
              onChange={(key) => setViewMode(key as any)}
            />
          </div>

          {/* 结果统计 */}
          <div className="px-6 py-3 bg-gray-50/50">
            <Text className="text-sm text-zinc-600">
              共 {filteredRequests.length} 条记录
              {activeFilterCount > 0 && ` (已应用 ${activeFilterCount} 个筛选条件)`}
            </Text>
          </div>
          
          {/* 表格内容 */}
          <div>
            <Table bleed={true} striped>
              <TableHead>
                <TableRow>
                  <TableHeader>申请编号</TableHeader>
                  <TableHeader>项目</TableHeader>
                  <TableHeader>申请人</TableHeader>
                  <TableHeader>样本数量</TableHeader>
                  <TableHeader>用途</TableHeader>
                  <TableHeader>目标位置</TableHeader>
                  <TableHeader>预计日期</TableHeader>
                  <TableHeader>状态</TableHeader>
                  <TableHeader>操作</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900"></div>
                        <Text className="text-zinc-500">加载中...</Text>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <BeakerIcon className="h-12 w-12 text-zinc-300" />
                        <Text className="text-zinc-500">
                          {activeFilterCount > 0 
                            ? '没有符合筛选条件的领用申请' 
                            : '暂无领用申请'}
                        </Text>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">{request.request_code}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{request.project.lab_project_code}</div>
                          <div className="text-xs text-zinc-500">{request.project.sponsor_project_code}</div>
                        </div>
                      </TableCell>
                      <TableCell>{request.requested_by.full_name}</TableCell>
                      <TableCell>{request.sample_count}</TableCell>
                      <TableCell className="max-w-xs truncate">{request.purpose}</TableCell>
                      <TableCell>{request.target_location}</TableCell>
                      <TableCell>{new Date(request.target_date).toLocaleDateString('zh-CN')}</TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            plain 
                            onClick={() => handleViewDetails(request)}
                          >
                            查看
                          </Button>
                          {request.status === 'approved' && (
                            <Button 
                              color="blue"
                              onClick={() => handleExecuteBorrow(request)}
                            >
                              执行领用
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </motion.div>
      </div>

      {/* 申请领用对话框 */}
      <Dialog open={isRequestDialogOpen} onClose={setIsRequestDialogOpen} size="4xl">
        <DialogTitle>申请领用样本</DialogTitle>
        <DialogDescription>
          选择需要领用的样本并填写领用信息
        </DialogDescription>
        <DialogBody>
          <div className="space-y-6">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  项目 <span className="text-red-500">*</span>
                </label>
                <Select
                  value={selectedProject}
                  onChange={(e) => handleProjectChange(e.target.value)}
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
                  用途 <span className="text-red-500">*</span>
                </label>
                <Select
                  value={borrowForm.purpose}
                  onChange={(e) => setBorrowForm({...borrowForm, purpose: e.target.value})}
                  required
                >
                  <option value="">请选择用途</option>
                  <option value="first_test">首次检测</option>
                  <option value="retest">重测</option>
                  <option value="isr">ISR测试</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  目标位置 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={borrowForm.target_location}
                  onChange={(e) => setBorrowForm({...borrowForm, target_location: e.target.value})}
                  placeholder="如：分析实验室A"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  目标时间 <span className="text-red-500">*</span>
                </label>
                <Input
                  type="datetime-local"
                  value={borrowForm.target_date}
                  onChange={(e) => setBorrowForm({...borrowForm, target_date: e.target.value})}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                备注
              </label>
              <Textarea
                value={borrowForm.notes}
                onChange={(e) => setBorrowForm({...borrowForm, notes: e.target.value})}
                placeholder="特殊要求或说明"
                rows={2}
              />
            </div>

            {/* 样本选择 */}
            {selectedProject && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <Text className="font-medium">选择样本（已选 {selectedSamples.length} 个）</Text>
                  <Button plain onClick={handleSelectAll}>
                    {selectedSamples.length === availableSamples.length ? '取消全选' : '全选'}
                  </Button>
                </div>
                
                <div className="border border-zinc-200 rounded-lg max-h-96 overflow-y-auto">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeader className="w-12"></TableHeader>
                        <TableHeader>样本编号</TableHeader>
                        <TableHeader>检测类型</TableHeader>
                        <TableHeader>受试者</TableHeader>
                        <TableHeader>采血时间</TableHeader>
                        <TableHeader>存储位置</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {availableSamples.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-4">
                            <Text className="text-zinc-500">暂无可用样本</Text>
                          </TableCell>
                        </TableRow>
                      ) : (
                        availableSamples.map((sample) => (
                          <TableRow key={sample.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedSamples.includes(sample.sample_code)}
                                onChange={() => handleSampleToggle(sample.sample_code)}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {sample.sample_code}
                            </TableCell>
                            <TableCell>{sample.test_type}</TableCell>
                            <TableCell>{sample.subject_code}</TableCell>
                            <TableCell>{sample.collection_time}</TableCell>
                            <TableCell className="text-sm text-zinc-600">
                              {sample.location}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => {
            setIsRequestDialogOpen(false);
            resetForm();
          }}>
            取消
          </Button>
          <Button 
            onClick={handleSubmitRequest}
            disabled={!selectedProject || selectedSamples.length === 0 || !borrowForm.purpose}
          >
            提交申请
          </Button>
        </DialogActions>
      </Dialog>

      {/* 详情对话框 */}
      <Dialog open={isDetailDialogOpen} onClose={setIsDetailDialogOpen}>
        <DialogTitle>领用申请详情</DialogTitle>
        <DialogBody>
          {selectedRequest && (
            <div className="space-y-4">
              <div>
                <Text className="text-sm text-zinc-600">申请编号</Text>
                <Text className="font-medium">{selectedRequest.request_code}</Text>
              </div>
              <div>
                <Text className="text-sm text-zinc-600">项目</Text>
                <Text className="font-medium">
                  {selectedRequest.project.lab_project_code} - {selectedRequest.project.sponsor_project_code}
                </Text>
              </div>
              <div>
                <Text className="text-sm text-zinc-600">申请人</Text>
                <Text className="font-medium">{selectedRequest.requested_by.full_name}</Text>
              </div>
              <div>
                <Text className="text-sm text-zinc-600">样本数量</Text>
                <Text className="font-medium">{selectedRequest.sample_count}</Text>
              </div>
              <div>
                <Text className="text-sm text-zinc-600">用途</Text>
                <Text className="font-medium">{getPurposeLabel(selectedRequest.purpose)}</Text>
              </div>
              <div>
                <Text className="text-sm text-zinc-600">目标位置</Text>
                <Text className="font-medium">{selectedRequest.target_location}</Text>
              </div>
              <div>
                <Text className="text-sm text-zinc-600">目标时间</Text>
                <Text className="font-medium">
                  {new Date(selectedRequest.target_date).toLocaleString('zh-CN')}
                </Text>
              </div>
              <div>
                <Text className="text-sm text-zinc-600">状态</Text>
                {getStatusBadge(selectedRequest.status)}
              </div>
            </div>
          )}
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsDetailDialogOpen(false)}>
            关闭
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
