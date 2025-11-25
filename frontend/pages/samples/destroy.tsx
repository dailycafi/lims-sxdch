import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
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
import { ESignatureDialog } from '@/components/e-signature-dialog';
import { 
  TrashIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  ChevronUpIcon,
  XMarkIcon
} from '@heroicons/react/20/solid';
import { AnimatedLoadingState, AnimatedEmptyState, AnimatedTableRow } from '@/components/animated-table';
import { toast } from 'react-hot-toast';
import { useProjectStore } from '@/store/project';
import clsx from 'clsx';

interface DestroyRequest {
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
  reason: string;
  status: string;
  current_approver?: string;
  created_at: string;
}

interface ApprovalFlow {
  id: number;
  approver: {
    full_name: string;
    role: string;
  };
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
  approved_at?: string;
}

export default function SampleDestroyPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<DestroyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'pending' | 'approved' | 'completed' | 'rejected' | 'all'>('pending');
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DestroyRequest | null>(null);
  const [approvalFlows, setApprovalFlows] = useState<ApprovalFlow[]>([]);
  const {
    projects,
    selectedProjectId,
    setSelectedProject,
    fetchProjects: fetchProjectList,
  } = useProjectStore();
  const [selectedSamples, setSelectedSamples] = useState<string[]>([]);
  const [availableSamples, setAvailableSamples] = useState<any[]>([]);
  
  // 新增筛选状态
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const [filters, setFilters] = useState({
    searchText: '',
    project: 'all',
    requestedBy: 'all',
    reason: 'all',
    dateFrom: '',
    dateTo: ''
  });

  const [destroyForm, setDestroyForm] = useState({
    reason: '',
    approval_file: null as File | null,
    notes: ''
  });
  const [approvalForm, setApprovalForm] = useState({
    action: 'approve',
    comments: ''
  });
  const [isESignatureOpen, setIsESignatureOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{type: string; id?: number} | null>(null);
  const [highlightedRequestId, setHighlightedRequestId] = useState<number | null>(null);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, [viewMode]);

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const getSingleParam = (value: string | string[] | undefined) => {
      if (!value) return undefined;
      return Array.isArray(value) ? value[0] : value;
    };

    const taskType = getSingleParam(router.query.taskType);
    const taskIdParam = getSingleParam(router.query.taskId);
    const viewParam = getSingleParam(router.query.view);

    if (viewParam && ['pending', 'approved', 'completed', 'rejected', 'all'].includes(viewParam)) {
      setViewMode(viewParam as any);
    } else if (taskType === 'destroy') {
      setViewMode('all');
    }

    if (taskIdParam) {
      const id = Number(taskIdParam);
      if (!Number.isNaN(id)) {
        setHighlightedRequestId(id);
        setHasAutoOpened(false);
      }
    }
  }, [router.isReady, router.query]);

  useEffect(() => {
    if (!highlightedRequestId || !requests.length || hasAutoOpened) {
      return;
    }

    const matched = requests.find((item) => item.id === highlightedRequestId);
    if (matched && !isApprovalDialogOpen) {
      handleViewDetails(matched);
      setHasAutoOpened(true);
    }
  }, [requests, highlightedRequestId, isApprovalDialogOpen, hasAutoOpened]);

  useEffect(() => {
    if (projects.length === 0) {
      fetchProjectList().catch((error: any) => {
        console.error('Failed to fetch projects:', error);
        toast.error('加载项目列表失败');
      });
    }
  }, [projects.length, fetchProjectList]);

  const fetchRequests = async () => {
    try {
      const response = await api.get('/samples/destroy-requests', {
        params: { status: viewMode }
      });
      setRequests(response.data);
    } catch (error) {
      console.error('Failed to fetch destroy requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableSamples = async (projectId: number) => {
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

  const handleProjectChange = (value: string) => {
    const id = value ? Number(value) : null;
    setSelectedProject(id);
    setSelectedSamples([]);
    if (!id) {
      setAvailableSamples([]);
    }
  };

  const fetchApprovalFlow = async (requestId: number) => {
    try {
      const response = await api.get(`/samples/destroy-request/${requestId}/approvals`);
      setApprovalFlows(response.data);
    } catch (error) {
      console.error('Failed to fetch approval flow:', error);
    }
  };

  const handleSubmitRequest = async () => {
    if (!selectedProjectId) {
      toast.error('请先选择项目');
      return;
    }
    if (selectedSamples.length === 0) {
      toast.error('请选择需要销毁的样本');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('project_id', String(selectedProjectId));
      formData.append('sample_codes', JSON.stringify(selectedSamples));
      formData.append('reason', destroyForm.reason);
      formData.append('notes', destroyForm.notes);
      
      if (destroyForm.approval_file) {
        formData.append('approval_file', destroyForm.approval_file);
      }

      await api.post('/samples/destroy-request', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setIsRequestDialogOpen(false);
      resetForm();
      fetchRequests();
    } catch (error) {
      console.error('Failed to submit destroy request:', error);
    }
  };

  const handleApproval = async () => {
    if (!selectedRequest) return;

    try {
      await api.post(`/samples/destroy-request/${selectedRequest.id}/approve`, {
        action: approvalForm.action,
        comments: approvalForm.comments
      });
      
      setIsApprovalDialogOpen(false);
      setApprovalForm({ action: 'approve', comments: '' });
      fetchRequests();
    } catch (error) {
      console.error('Failed to process approval:', error);
    }
  };

  const handleExecuteDestroy = async (requestId: number) => {
    setPendingAction({ type: 'execute', id: requestId });
    setIsESignatureOpen(true);
  };

  const handleESignatureConfirm = async (password: string, reason: string) => {
    if (!pendingAction) return;

    try {
      // 验证电子签名
      await api.post('/auth/verify-signature', { password });

      // 执行对应的操作
      if (pendingAction.type === 'execute' && pendingAction.id) {
        await api.post(`/samples/destroy-request/${pendingAction.id}/execute`, {
          e_signature_reason: reason
        });
        alert('样本销毁执行成功');
        fetchRequests();
      }

      setPendingAction(null);
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('密码错误，请重试');
      }
      throw new Error('操作失败，请重试');
    }
  };

  const resetForm = () => {
    setSelectedSamples([]);
    setAvailableSamples([]);
    setDestroyForm({
      reason: '',
      approval_file: null,
      notes: ''
    });
  };

  useEffect(() => {
    if (isRequestDialogOpen) {
      setSelectedSamples([]);
      if (selectedProjectId) {
        fetchAvailableSamples(selectedProjectId).catch(() => {
          toast.error('加载可销毁样本失败');
        });
      } else {
        setAvailableSamples([]);
      }
    }
  }, [isRequestDialogOpen, selectedProjectId]);

  const getStatusColor = (status: string): "yellow" | "blue" | "purple" | "orange" | "green" | "red" | "zinc" => {
    switch (status) {
      case 'pending':
        return "yellow";
      case 'test_manager_approved':
        return "blue";
      case 'director_approved':
        return "purple";
      case 'ready':
        return "orange";
      case 'completed':
        return "green";
      case 'rejected':
        return "red";
      default:
        return "zinc";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '待审批';
      case 'test_manager_approved':
        return '主管已批准';
      case 'director_approved':
        return '主任已批准';
      case 'ready':
        return '待执行';
      case 'completed':
        return '已销毁';
      case 'rejected':
        return '已拒绝';
      default:
        return status;
    }
  };

  const getStatusBadge = (status: string) => {
    return <Badge color={getStatusColor(status)}>{getStatusText(status)}</Badge>;
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'test_manager':
        return '分析测试主管';
      case 'lab_director':
        return '研究室主任';
      default:
        return role;
    }
  };

  const handleViewDetails = (request: DestroyRequest) => {
    setSelectedRequest(request);
    fetchApprovalFlow(request.id);
    setIsApprovalDialogOpen(true);
  };

  const handleOpenApproval = (request: DestroyRequest) => {
    setSelectedRequest(request);
    setIsApprovalDialogOpen(true);
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
      reason: 'all',
      dateFrom: '',
      dateTo: ''
    });
  };

  // 应用视图模式过滤
  const filteredByViewMode = (requests: DestroyRequest[]) => {
    if (viewMode === 'all') return requests;
    return requests.filter(r => r.status === viewMode);
  };

  // 应用筛选
  const applyFilters = (requests: DestroyRequest[]) => {
    return requests.filter(request => {
      // 搜索文本筛选
      if (filters.searchText && 
          !request.request_code.toLowerCase().includes(filters.searchText.toLowerCase()) &&
          !request.reason.toLowerCase().includes(filters.searchText.toLowerCase())) {
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
      
      // 销毁原因筛选
      if (filters.reason !== 'all' && request.reason !== filters.reason) {
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
  const uniqueReasons = Array.from(new Set(requests.map(r => r.reason)));

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* 页面标题和操作按钮 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Heading>样本销毁</Heading>
            <Text className="mt-1 text-zinc-600">管理样本销毁申请和审批流程</Text>
          </div>
          <Button onClick={() => setIsRequestDialogOpen(true)}>
            <TrashIcon className="h-4 w-4" />
            申请销毁
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
                      placeholder="搜索申请编号或销毁原因..."
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">销毁原因</label>
                      <Select
                        value={filters.reason}
                        onChange={(e) => setFilters({ ...filters, reason: e.target.value })}
                        className="w-full h-11 custom-select"
                      >
                        <option value="all">全部原因</option>
                        {uniqueReasons.map(reason => (
                          <option key={reason} value={reason}>{reason}</option>
                        ))}
                      </Select>
                    </div>

                    <div className="flex gap-2">
                      {activeFilterCount > 0 && (
                        <Button
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
                { key: 'completed', label: '已销毁' },
                { key: 'rejected', label: '已拒绝' },
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
                  <TableHeader>销毁原因</TableHeader>
                  <TableHeader>当前审批人</TableHeader>
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
                      colSpan={9} 
                      variant="skeleton"
                    />
                  ) : filteredRequests.length === 0 ? (
                    <AnimatedEmptyState
                      key="empty"
                      colSpan={9}
                      icon={TrashIcon}
                      text={activeFilterCount > 0 
                        ? '没有符合筛选条件的销毁申请' 
                        : '暂无销毁申请'}
                    />
                  ) : (
                    filteredRequests.map((request, index) => (
                      <AnimatedTableRow
                        key={request.id}
                        index={index}
                        className={clsx(
                          highlightedRequestId === request.id &&
                            'bg-blue-50/80 ring-1 ring-inset ring-blue-200'
                        )}
                      >
                        <TableCell className="font-medium">{request.request_code}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{request.project.lab_project_code}</div>
                            <div className="text-sm text-zinc-500">{request.project.sponsor_project_code}</div>
                          </div>
                        </TableCell>
                        <TableCell>{request.requested_by.full_name}</TableCell>
                        <TableCell>{request.sample_count}</TableCell>
                        <TableCell>{request.reason}</TableCell>
                        <TableCell>{request.current_approver || '-'}</TableCell>
                        <TableCell>{new Date(request.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge color={getStatusColor(request.status)}>
                            {getStatusText(request.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              plain
                              onClick={() => handleViewDetails(request)}
                            >
                              查看
                            </Button>
                            {request.status === 'ready' && (
                              <Button
                                color="red"
                                onClick={() => handleExecuteDestroy(request.id)}
                              >
                                <TrashIcon className="h-4 w-4 mr-1" />
                                执行销毁
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

      {/* 申请销毁对话框 */}
      <Dialog open={isRequestDialogOpen} onClose={setIsRequestDialogOpen} size="4xl">
        <DialogTitle>申请销毁样本</DialogTitle>
        <DialogDescription>
          选择需要销毁的样本并提供销毁原因
        </DialogDescription>
        <DialogBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                项目 <span className="text-red-500">*</span>
              </label>
              <Select
                value={selectedProjectId ? String(selectedProjectId) : ''}
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
                销毁原因 <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={destroyForm.reason}
                onChange={(e) => setDestroyForm({...destroyForm, reason: e.target.value})}
                placeholder="请详细说明销毁原因"
                rows={3}
                required
              />
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
                      setDestroyForm({...destroyForm, approval_file: e.target.files[0]});
                    }
                  }}
                  className="hidden"
                  id="destroy-approval-file-input"
                />
                <label htmlFor="destroy-approval-file-input">
                  <Button plain onClick={(e: React.MouseEvent) => e.preventDefault()}>
                    <CloudArrowUpIcon />
                    上传批准文件
                  </Button>
                </label>
              </div>
              {destroyForm.approval_file && (
                <Text className="text-sm text-green-600 mt-1">
                  已选择: {destroyForm.approval_file.name}
                </Text>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                备注
              </label>
              <Textarea
                value={destroyForm.notes}
                onChange={(e) => setDestroyForm({...destroyForm, notes: e.target.value})}
                placeholder="其他说明"
                rows={2}
              />
            </div>

            {/* 样本选择 */}
            {selectedProjectId && (
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
                        <TableHeader>检测类型</TableHeader>
                        <TableHeader>存储位置</TableHeader>
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
                          <TableCell>{sample.test_type}</TableCell>
                          <TableCell className="text-sm text-zinc-600">
                            {`${sample.freezer_id}-${sample.shelf_level}-${sample.rack_position}`}
                          </TableCell>
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
            setIsRequestDialogOpen(false);
            resetForm();
          }}>
            取消
          </Button>
          <Button 
            onClick={handleSubmitRequest}
            disabled={!selectedProjectId || selectedSamples.length === 0 || !destroyForm.reason || !destroyForm.approval_file}
          >
            提交申请
          </Button>
        </DialogActions>
      </Dialog>

      {/* 审批对话框 */}
      <Dialog open={isApprovalDialogOpen} onClose={setIsApprovalDialogOpen} size="lg">
        <DialogTitle>销毁申请审批</DialogTitle>
        <DialogBody>
          {selectedRequest && (
            <div className="space-y-6">
              {/* 申请信息 */}
              <div className="space-y-3">
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
                  <Text className="text-sm text-zinc-600">销毁原因</Text>
                  <Text className="font-medium">{selectedRequest.reason}</Text>
                </div>
              </div>

              {/* 审批流程 */}
              <div>
                <Text className="font-medium mb-3">审批流程</Text>
                <div className="space-y-2">
                  {approvalFlows.map((flow) => (
                    <div key={flow.id} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
                      {flow.status === 'approved' && (
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      )}
                      {flow.status === 'rejected' && (
                        <XCircleIcon className="h-5 w-5 text-red-500" />
                      )}
                      {flow.status === 'pending' && (
                        <ClockIcon className="h-5 w-5 text-zinc-400" />
                      )}
                      <div className="flex-1">
                        <Text className="font-medium">{getRoleLabel(flow.approver.role)}</Text>
                        <Text className="text-sm text-zinc-600">
                          {flow.approver.full_name}
                          {flow.approved_at && ` · ${new Date(flow.approved_at).toLocaleDateString('zh-CN')}`}
                        </Text>
                        {flow.comments && (
                          <Text className="text-sm mt-1">{flow.comments}</Text>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 审批操作 */}
              {['pending', 'test_manager_approved'].includes(selectedRequest.status) && (
                <div className="space-y-3 pt-4 border-t">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      审批操作
                    </label>
                    <Select
                      value={approvalForm.action}
                      onChange={(e) => setApprovalForm({...approvalForm, action: e.target.value})}
                    >
                      <option value="approve">同意</option>
                      <option value="reject">拒绝</option>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      审批意见
                    </label>
                    <Textarea
                      value={approvalForm.comments}
                      onChange={(e) => setApprovalForm({...approvalForm, comments: e.target.value})}
                      placeholder="请输入审批意见"
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => {
            setIsApprovalDialogOpen(false);
            setApprovalForm({ action: 'approve', comments: '' });
          }}>
            {['pending', 'test_manager_approved'].includes(selectedRequest?.status || '') ? '取消' : '关闭'}
          </Button>
          {['pending', 'test_manager_approved'].includes(selectedRequest?.status || '') && (
            <Button 
              onClick={handleApproval}
              color={approvalForm.action === 'approve' ? 'blue' : 'red'}
            >
              {approvalForm.action === 'approve' ? '批准' : '拒绝'}
            </Button>
          )}
          {selectedRequest?.status === 'ready' && (
            <Button
              color="red"
              onClick={() => {
                setIsApprovalDialogOpen(false);
                if (selectedRequest) {
                  handleExecuteDestroy(selectedRequest.id);
                }
              }}
            >
              <TrashIcon className="h-4 w-4 mr-1" />
              执行销毁
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* 电子签名对话框 */}
      <ESignatureDialog
        open={isESignatureOpen}
        onClose={setIsESignatureOpen}
        onConfirm={handleESignatureConfirm}
        title="执行样本销毁"
        description="您即将执行样本销毁操作。此操作不可撤销，所有选定的样本将被永久销毁。"
        requireReason={true}
        reasonLabel="销毁执行说明"
        reasonPlaceholder="请说明销毁执行的具体情况"
        actionType="execute"
      />
    </AppLayout>
  );
}
