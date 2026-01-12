import { useState, useEffect } from 'react';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Textarea } from '@/components/textarea';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { Tabs } from '@/components/tabs';
import { AnimatedLoadingState, AnimatedEmptyState, AnimatedTableRow } from '@/components/animated-table';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { 
  ExclamationTriangleIcon,
  PlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  UserGroupIcon,
  ArrowPathIcon,
  FunnelIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/20/solid';
import { DeviationsService, ProjectsService, SamplesService } from '@/services';
import type { Deviation as APIDeviation } from '@/types/api';

// Extend the API type to include the additional fields your UI needs
interface Deviation extends APIDeviation {
  reporter?: {
    full_name?: string;
  };
  project?: {
    id: number;
    lab_project_code: string;
  };
  current_step?: {
    step: number;
    name: string;
    role: string;
  };
}

interface DeviationDetail extends Deviation {
  description: string;
  impact_assessment: string;
  immediate_action?: string;
  root_cause?: string;
  corrective_action?: string;
  preventive_action?: string;
  samples: Array<{
    id: number;
    sample_code: string;
  }>;
  approvals: Array<{
    step: number;
    step_name: string;
    user?: {
      full_name: string;
    };
    action?: string;
    comments?: string;
    executed_actions?: string;
    processed_at?: string;
  }>;
}

export default function DeviationManagement() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [selectedDeviation, setSelectedDeviation] = useState<DeviationDetail | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [samples, setSamples] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>('pending');
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  
  // Update the filters interface to match what's actually being used
  const [filters, setFilters] = useState({
    project_id: 'all',
    severity: 'all',
    category: 'all',
    reporter: '',
    status: 'all',  // Add this
    type: 'all'     // Add this
  });
  
  // Update the reportForm to match DeviationCreate type
  const [reportForm, setReportForm] = useState({
    title: '',
    severity: 'minor' as 'minor' | 'major' | 'critical',
    category: '',
    description: '',
    impact_assessment: '',
    immediate_action: '',
    project_id: null as number | null,
    sample_ids: [] as number[],
    type: ''  // Add this required field
  });

  // Add the missing resetReportForm function
  const resetReportForm = () => {
    setReportForm({
      title: '',
      severity: 'minor',
      category: '',
      description: '',
      impact_assessment: '',
      immediate_action: '',
      project_id: null,
      sample_ids: [],
      type: ''
    });
  };

  const [approvalForm, setApprovalForm] = useState({
    action: 'approve' as 'approve' | 'reject' | 'execute',
    comments: '',
    designated_executor_id: null as number | null,
    executed_actions: '',
    root_cause: '',
    corrective_action: '',
    preventive_action: ''
  });

  useEffect(() => {
    fetchDeviations();
    fetchProjects();
    fetchSamples();
  }, [activeTab]);

  const fetchDeviations = async () => {
    setLoading(true);
    try {
      const params = {
        status: filters.status !== 'all' ? filters.status : undefined,
      };
      const deviations = await DeviationsService.getDeviations(params);
      setDeviations(deviations);
    } catch (error) {
      console.error('Failed to fetch deviations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const projects = await ProjectsService.getProjects();
      setProjects(projects);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const fetchSamples = async () => {
    try {
      const samples = await SamplesService.getSamples();
      setSamples(samples);
    } catch (error) {
      console.error('Failed to fetch samples:', error);
    }
  };

  const handleCreateDeviation = async () => {
    try {
      // Ensure data matches backend DeviationCreate schema
      const { type, ...rest } = reportForm;
      await DeviationsService.createDeviation({
        ...rest,
        project_id: reportForm.project_id
      });
      setIsReportDialogOpen(false);
      resetReportForm();
      fetchDeviations();
    } catch (error) {
      console.error('Failed to create deviation:', error);
    }
  };

  const handleViewDetail = async (deviation: Deviation) => {
    try {
      const response = await api.get(`/deviations/${deviation.id}`);
      setSelectedDeviation(response.data);
      setIsDetailDialogOpen(true);
    } catch (error) {
      console.error('Failed to fetch deviation detail:', error);
    }
  };

  const handleApprovalAction = async () => {
    if (!selectedDeviation) return;
    
    try {
      await api.post(`/deviations/${selectedDeviation.id}/approve`, approvalForm);
      setIsApprovalDialogOpen(false);
      setIsDetailDialogOpen(false);
      fetchDeviations();
      setApprovalForm({
        action: 'approve',
        comments: '',
        designated_executor_id: null,
        executed_actions: '',
        root_cause: '',
        corrective_action: '',
        preventive_action: ''
      });
    } catch (error) {
      console.error('Failed to process deviation:', error);
    }
  };

  const getSeverityBadge = (severity: string) => {
    const config = {
      minor: { color: 'yellow' as const, text: '轻微' },
      major: { color: 'purple' as const, text: '重大' },
      critical: { color: 'red' as const, text: '严重' }
    };
    const { color, text } = config[severity as keyof typeof config] || { color: 'zinc' as const, text: severity };
    return <Badge color={color}>{text}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const config = {
      pending_action: { color: 'yellow' as const, text: '待处理' },
      in_progress: { color: 'blue' as const, text: '处理中' },
      completed: { color: 'green' as const, text: '已完成' },
      rejected: { color: 'red' as const, text: '已驳回' }
    };
    const { color, text } = config[status as keyof typeof config] || { color: 'zinc' as const, text: status };
    return <Badge color={color}>{text}</Badge>;
  };

  // 筛选偏差记录
  const filteredDeviations = deviations.filter(deviation => {
    if (searchQuery && !deviation.deviation_code.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !deviation.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filters.project_id !== 'all' && deviation.project?.id !== parseInt(filters.project_id)) {
      return false;
    }
    if (filters.severity !== 'all' && deviation.severity !== filters.severity) {
      return false;
    }
    if (filters.category !== 'all' && deviation.category !== filters.category) {
      return false;
    }
    if (
      filters.reporter &&
      !(deviation.reporter?.full_name || '')
        .toLowerCase()
        .includes(filters.reporter.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const activeFilterCount = Object.values(filters).filter(v => v && v !== 'all').length;

  const categories = ['温度偏差', '操作偏差', '设备偏差', '样本偏差', '流程偏差', '其他'];

  const canProcessDeviation = (deviation: DeviationDetail) => {
    if (!deviation.current_step || !user) return false;
    
    // 检查用户角色是否匹配当前步骤要求的角色
    const requiredRole = deviation.current_step.role;
    return user.role === requiredRole;
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-6 flex items-center justify-between">
          <Text className="text-zinc-600">管理和跟踪实验室偏差事件</Text>
          <Button onClick={() => setIsReportDialogOpen(true)}>
            <PlusIcon className="h-4 w-4" />
            报告偏差
          </Button>
        </div>

        {/* 筛选区域 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
          {/* 筛选标题栏 */}
          <div 
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
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
                      placeholder="搜索偏差编号或标题..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full max-w-md h-11"
                    />
                  </div>

                  {/* 筛选器行 */}
                  <div className="grid grid-cols-4 gap-4 items-end">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">项目</label>
                      <Select
                        value={filters.project_id}
                        onChange={(e) => setFilters({...filters, project_id: e.target.value})}
                        className="w-full h-11 custom-select"
                      >
                        <option value="all">全部项目</option>
                        {projects.map(project => (
                          <option key={project.id} value={project.id}>
                            {project.lab_project_code}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">严重程度</label>
                      <Select
                        value={filters.severity}
                        onChange={(e) => setFilters({...filters, severity: e.target.value})}
                        className="w-full h-11 custom-select"
                      >
                        <option value="all">全部等级</option>
                        <option value="minor">轻微</option>
                        <option value="major">重大</option>
                        <option value="critical">严重</option>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">分类</label>
                      <Select
                        value={filters.category}
                        onChange={(e) => setFilters({...filters, category: e.target.value})}
                        className="w-full h-11 custom-select"
                      >
                        <option value="all">全部分类</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">报告人</label>
                      <Input
                        type="text"
                        value={filters.reporter}
                        onChange={(e) => setFilters({...filters, reporter: e.target.value})}
                        placeholder="输入报告人姓名"
                        className="w-full h-11"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Tabs 和内容区域 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Tabs 栏 */}
          <div className="border-b border-gray-200 px-4 py-3">
            <Tabs
              tabs={[
                { key: 'pending', label: '待处理' },
                { key: 'in_progress', label: '处理中' },
                { key: 'completed', label: '已完成' },
                { key: 'all', label: '全部' }
              ]}
              activeTab={activeTab}
              onChange={setActiveTab}
            />
          </div>

          {/* 内容区域 */}
          <div>
            <Table bleed={true} striped>
              <TableHead>
                <TableRow>
                  <TableHeader className="pl-6">偏差编号</TableHeader>
                  <TableHeader>标题</TableHeader>
                  <TableHeader>严重程度</TableHeader>
                  <TableHeader>分类</TableHeader>
                  <TableHeader>项目</TableHeader>
                  <TableHeader>报告人</TableHeader>
                  <TableHeader>状态</TableHeader>
                  <TableHeader>当前步骤</TableHeader>
                  <TableHeader>报告时间</TableHeader>
                  <TableHeader className="text-right pr-6">操作</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <AnimatedLoadingState colSpan={10} variant="skeleton" />
                ) : filteredDeviations.length === 0 ? (
                  <AnimatedEmptyState colSpan={10} text="暂无偏差记录" />
                ) : (
                  <AnimatePresence>
                    {filteredDeviations.map((deviation, index) => (
                      <AnimatedTableRow key={deviation.id} index={index}>
                        <TableCell className="font-medium pl-6">{deviation.deviation_code}</TableCell>
                        <TableCell>{deviation.title}</TableCell>
                        <TableCell>{getSeverityBadge(deviation.severity)}</TableCell>
                        <TableCell>{deviation.category}</TableCell>
                        <TableCell>{deviation.project?.lab_project_code || '-'}</TableCell>
                        <TableCell>{deviation.reporter?.full_name || '-'}</TableCell>
                        <TableCell>{getStatusBadge(deviation.status)}</TableCell>
                        <TableCell>
                          {deviation.current_step ? (
                            <Text className="text-sm">
                              {deviation.current_step.name}
                              <br />
                              <span className="text-zinc-500">({deviation.current_step.role})</span>
                            </Text>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{formatDate(deviation.created_at)}</TableCell>
                        <TableCell className="text-right pr-6">
                          <Button plain onClick={() => handleViewDetail(deviation)}>
                            查看详情
                          </Button>
                        </TableCell>
                      </AnimatedTableRow>
                    ))}
                  </AnimatePresence>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* 报告偏差对话框 */}
        <Dialog open={isReportDialogOpen} onClose={setIsReportDialogOpen} size="2xl">
          <DialogTitle>报告偏差</DialogTitle>
          <DialogBody>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  偏差标题 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={reportForm.title}
                  onChange={(e) => setReportForm({...reportForm, title: e.target.value})}
                  placeholder="简要描述偏差事件"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    严重程度 <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={reportForm.severity}
                    onChange={(e) => setReportForm({...reportForm, severity: e.target.value as any})}
                  >
                    <option value="minor">轻微</option>
                    <option value="major">重大</option>
                    <option value="critical">严重</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    偏差类别 <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={reportForm.category}
                    onChange={(e) => setReportForm({...reportForm, category: e.target.value})}
                    required
                  >
                    <option value="">请选择</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  关联项目
                </label>
                <Select
                  value={reportForm.project_id || ''}
                  onChange={(e) => setReportForm({...reportForm, project_id: e.target.value ? Number(e.target.value) : null})}
                >
                  <option value="">不涉及特定项目</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.lab_project_code} - {project.sponsor_project_code}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  偏差描述 <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={reportForm.description}
                  onChange={(e) => setReportForm({...reportForm, description: e.target.value})}
                  placeholder="详细描述偏差的具体情况、发现时间、地点等"
                  rows={4}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  影响评估 <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={reportForm.impact_assessment}
                  onChange={(e) => setReportForm({...reportForm, impact_assessment: e.target.value})}
                  placeholder="评估此偏差对样本、数据或流程的潜在影响"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  立即采取的措施
                </label>
                <Textarea
                  value={reportForm.immediate_action}
                  onChange={(e) => setReportForm({...reportForm, immediate_action: e.target.value})}
                  placeholder="描述已经或即将采取的紧急措施"
                  rows={2}
                />
              </div>
            </div>
          </DialogBody>
          <DialogActions>
            <Button plain onClick={() => setIsReportDialogOpen(false)}>
              取消
            </Button>
            <Button color="dark" onClick={handleCreateDeviation}>
              提交报告
            </Button>
          </DialogActions>
        </Dialog>

        {/* 偏差详情对话框 */}
        <Dialog open={isDetailDialogOpen} onClose={setIsDetailDialogOpen} size="3xl">
          {selectedDeviation && (
            <>
              <DialogTitle>偏差详情 - {selectedDeviation.deviation_code}</DialogTitle>
              <DialogBody>
                <div className="space-y-6">
                  {/* 基本信息 */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-medium mb-3">基本信息</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-zinc-600">偏差标题：</span>
                        <p className="font-medium">{selectedDeviation.title}</p>
                      </div>
                      <div>
                        <span className="text-sm text-zinc-600">严重程度：</span>
                        <p>{getSeverityBadge(selectedDeviation.severity)}</p>
                      </div>
                      <div>
                        <span className="text-sm text-zinc-600">分类：</span>
                        <p className="font-medium">{selectedDeviation.category}</p>
                      </div>
                      <div>
                        <span className="text-sm text-zinc-600">状态：</span>
                        <p>{getStatusBadge(selectedDeviation.status)}</p>
                      </div>
                      <div>
                        <span className="text-sm text-zinc-600">报告人：</span>
                        <p className="font-medium">{selectedDeviation.reporter?.full_name || '-'}</p>
                      </div>
                      <div>
                        <span className="text-sm text-zinc-600">报告时间：</span>
                        <p className="font-medium">{formatDateTime(selectedDeviation.created_at)}</p>
                      </div>
                    </div>
                  </div>

                  {/* 偏差描述 */}
                  <div>
                    <h3 className="text-lg font-medium mb-2">偏差描述</h3>
                    <p className="text-zinc-700">{selectedDeviation.description}</p>
                  </div>

                  {/* 影响评估 */}
                  <div>
                    <h3 className="text-lg font-medium mb-2">影响评估</h3>
                    <p className="text-zinc-700">{selectedDeviation.impact_assessment}</p>
                  </div>

                  {/* 立即措施 */}
                  {selectedDeviation.immediate_action && (
                    <div>
                      <h3 className="text-lg font-medium mb-2">立即采取的措施</h3>
                      <p className="text-zinc-700">{selectedDeviation.immediate_action}</p>
                    </div>
                  )}

                  {/* 审批流程 */}
                  <div>
                    <h3 className="text-lg font-medium mb-3">审批流程</h3>
                    <div className="space-y-3">
                      {selectedDeviation.approvals.map((approval) => (
                        <div key={approval.step} className="border rounded-lg p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{approval.step_name}</p>
                              {approval.user && (
                                <p className="text-sm text-zinc-600">处理人：{approval.user.full_name}</p>
                              )}
                            </div>
                            {approval.action && (
                              <Badge color={approval.action === 'approve' ? 'green' : 'red'}>
                                {approval.action === 'approve' ? '已批准' : '已驳回'}
                              </Badge>
                            )}
                          </div>
                          {approval.comments && (
                            <p className="mt-2 text-sm text-zinc-700">意见：{approval.comments}</p>
                          )}
                          {approval.processed_at && (
                            <p className="mt-1 text-sm text-zinc-500">
                              处理时间：{formatDateTime(approval.processed_at)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </DialogBody>
              <DialogActions>
                <Button plain onClick={() => setIsDetailDialogOpen(false)}>
                  关闭
                </Button>
                {canProcessDeviation(selectedDeviation) && (
                  <Button color="dark" onClick={() => {
                    setIsDetailDialogOpen(false);
                    setIsApprovalDialogOpen(true);
                  }}>
                    处理偏差
                  </Button>
                )}
              </DialogActions>
            </>
          )}
        </Dialog>

        {/* 处理偏差对话框 */}
        <Dialog open={isApprovalDialogOpen} onClose={setIsApprovalDialogOpen} size="xl">
          <DialogTitle>处理偏差</DialogTitle>
          <DialogBody>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  处理意见 <span className="text-red-500">*</span>
                </label>
                <Select
                  value={approvalForm.action}
                  onChange={(e) => setApprovalForm({...approvalForm, action: e.target.value as any})}
                >
                  <option value="approve">批准</option>
                  <option value="reject">驳回</option>
                  <option value="execute">执行纠正措施</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  处理意见说明 <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={approvalForm.comments}
                  onChange={(e) => setApprovalForm({...approvalForm, comments: e.target.value})}
                  placeholder="请输入您的处理意见"
                  rows={3}
                  required
                />
              </div>

              {approvalForm.action === 'execute' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      执行的纠正措施
                    </label>
                    <Textarea
                      value={approvalForm.executed_actions}
                      onChange={(e) => setApprovalForm({...approvalForm, executed_actions: e.target.value})}
                      placeholder="描述已执行的纠正措施"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      根本原因分析
                    </label>
                    <Textarea
                      value={approvalForm.root_cause}
                      onChange={(e) => setApprovalForm({...approvalForm, root_cause: e.target.value})}
                      placeholder="分析导致偏差的根本原因"
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>
          </DialogBody>
          <DialogActions>
            <Button plain onClick={() => setIsApprovalDialogOpen(false)}>
              取消
            </Button>
            <Button color="dark" onClick={handleApprovalAction}>
              确认处理
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </AppLayout>
  );
}