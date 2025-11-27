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
import { AnimatedLoadingState, AnimatedEmptyState, AnimatedTableRow } from '@/components/animated-table';
import { DescriptionList, DescriptionTerm, DescriptionDetails } from '@/components/description-list';
import { api } from '@/lib/api';
import { 
  ArchiveBoxIcon,
  LockClosedIcon,
  DocumentCheckIcon,
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon,
  FunnelIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  CloudArrowUpIcon
} from '@heroicons/react/20/solid';

interface ArchiveRequest {
  id: number;
  project: {
    id: number;
    lab_project_code: string;
    sponsor_project_code: string;
    status: string;
    sponsor?: string;
  };
  requested_by: {
    full_name: string;
  };
  reason: string;
  status: string;
  created_at: string;
  approved_at?: string;
  archived_at?: string;
}

interface ProjectSummary {
  total_samples: number;
  destroyed_samples: number;
  active_deviations: number;
  pending_transfers: number;
  unreturned_samples: number;
}

export default function ArchivePage() {
  const [requests, setRequests] = useState<ArchiveRequest[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'pending' | 'archived'>('active');
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [projectSummary, setProjectSummary] = useState<ProjectSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  
  const [filters, setFilters] = useState({
    sponsor: 'all',
    status: 'all',
    start_date: '',
    end_date: ''
  });

  const [archiveForm, setArchiveForm] = useState({
    project_id: '',
    reason: '',
    completion_summary: '',
    final_report_path: ''
  });

  useEffect(() => {
    if (activeTab === 'active') {
      fetchActiveProjects();
    } else if (activeTab === 'pending') {
      fetchPendingRequests();
    } else {
      fetchArchivedProjects();
    }
  }, [activeTab, filters]);

  const fetchActiveProjects = async () => {
    setLoading(true);
    try {
      const params: any = { status: 'active' };
      if (filters.sponsor !== 'all') params.sponsor = filters.sponsor;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      
      const response = await api.get('/projects', { params });
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingRequests = async () => {
    setLoading(true);
    try {
      const response = await api.get('/archive/requests', {
        params: { status: 'pending' }
      });
      setRequests(response.data);
    } catch (error) {
      console.error('Failed to fetch archive requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchArchivedProjects = async () => {
    setLoading(true);
    try {
      const params: any = { status: 'archived' };
      if (filters.sponsor !== 'all') params.sponsor = filters.sponsor;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      
      const response = await api.get('/projects', { params });
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch archived projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestArchive = async () => {
    try {
      const response = await api.post('/archive/request', archiveForm);
      setRequests([response.data, ...requests]);
      setIsRequestDialogOpen(false);
      setArchiveForm({
        project_id: '',
        reason: '',
        completion_summary: '',
        final_report_path: ''
      });
    } catch (error) {
      console.error('Failed to request archive:', error);
    }
  };

  const handleApproveRequest = async (requestId: number) => {
    try {
      await api.post(`/archive/approve/${requestId}`);
      fetchPendingRequests();
    } catch (error) {
      console.error('Failed to approve request:', error);
    }
  };

  const handleRejectRequest = async (requestId: number) => {
    try {
      await api.post(`/archive/reject/${requestId}`);
      fetchPendingRequests();
    } catch (error) {
      console.error('Failed to reject request:', error);
    }
  };

  const handleViewProjectDetail = async (project: any) => {
    try {
      const response = await api.get(`/archive/project-summary/${project.id}`);
      setProjectSummary(response.data);
      setSelectedProject(project);
      setIsDetailDialogOpen(true);
    } catch (error) {
      console.error('Failed to fetch project summary:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      active: { color: 'green' as const, text: '进行中' },
      pending: { color: 'yellow' as const, text: '待归档' },
      archived: { color: 'zinc' as const, text: '已归档' },
      approved: { color: 'blue' as const, text: '已批准' },
      rejected: { color: 'red' as const, text: '已驳回' }
    };
    const { color, text } = config[status as keyof typeof config] || { color: 'zinc' as const, text: status };
    return <Badge color={color}>{text}</Badge>;
  };

  // 筛选数据
  const filteredProjects = projects.filter(project => {
    if (searchQuery && !project.lab_project_code.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !project.sponsor_project_code?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const filteredRequests = requests.filter(request => {
    if (searchQuery && !request.project.lab_project_code.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !request.project.sponsor_project_code?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const activeFilterCount = Object.values(filters).filter(v => v && v !== 'all').length;

  // 获取唯一的申办方列表
  const sponsors = Array.from(new Set(projects.map(p => p.sponsor))).filter(Boolean);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Heading>项目归档</Heading>
            <Text className="mt-1 text-zinc-600">管理项目完成后的归档流程</Text>
          </div>
          {activeTab === 'active' && (
            <Button onClick={() => setIsRequestDialogOpen(true)}>
              <ArchiveBoxIcon className="h-4 w-4" />
              申请归档
            </Button>
          )}
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
                      placeholder="搜索项目编号..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full max-w-md h-11"
                    />
                  </div>

                  {/* 筛选器行 */}
                  <div className="grid grid-cols-4 gap-4 items-end">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">申办方</label>
                      <Select
                        value={filters.sponsor}
                        onChange={(e) => setFilters({...filters, sponsor: e.target.value})}
                        className="w-full h-11 custom-select"
                      >
                        <option value="all">全部申办方</option>
                        {sponsors.map(sponsor => (
                          <option key={sponsor} value={sponsor}>{sponsor}</option>
                        ))}
                      </Select>
                    </div>

                    {activeTab === 'active' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">项目状态</label>
                        <Select
                          value={filters.status}
                          onChange={(e) => setFilters({...filters, status: e.target.value})}
                          className="w-full h-11 custom-select"
                        >
                          <option value="all">全部状态</option>
                          <option value="active">进行中</option>
                          <option value="closing">即将结束</option>
                        </Select>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">开始日期</label>
                      <Input
                        type="date"
                        value={filters.start_date}
                        onChange={(e) => setFilters({...filters, start_date: e.target.value})}
                        className="w-full h-11"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">结束日期</label>
                      <Input
                        type="date"
                        value={filters.end_date}
                        onChange={(e) => setFilters({...filters, end_date: e.target.value})}
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
                { key: 'active', label: '进行中项目' },
                { key: 'pending', label: '待归档' },
                { key: 'archived', label: '已归档' }
              ]}
              activeTab={activeTab}
              onChange={(key) => setActiveTab(key as any)}
            />
          </div>

          {/* 内容区域 */}
          {activeTab === 'active' && (
            <div>
              <Table bleed={true} striped>
                <TableHead>
                  <TableRow>
                    <TableHeader className="pl-6">实验室项目编号</TableHeader>
                    <TableHeader>申办方项目编号</TableHeader>
                    <TableHeader>申办方</TableHeader>
                    <TableHeader>状态</TableHeader>
                    <TableHeader>开始时间</TableHeader>
                    <TableHeader>样本数量</TableHeader>
                    <TableHeader className="text-right pr-6">操作</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <AnimatedLoadingState colSpan={7} variant="skeleton" />
                  ) : filteredProjects.length === 0 ? (
                    <AnimatedEmptyState colSpan={7} text="暂无进行中的项目" />
                  ) : (
                    <AnimatePresence>
                      {filteredProjects.map((project, index) => (
                        <AnimatedTableRow key={project.id} index={index}>
                          <TableCell className="font-medium pl-6">{project.lab_project_code}</TableCell>
                          <TableCell>{project.sponsor_project_code || '-'}</TableCell>
                          <TableCell>{project.sponsor || '-'}</TableCell>
                          <TableCell>{getStatusBadge(project.status)}</TableCell>
                          <TableCell>{new Date(project.created_at).toLocaleDateString('zh-CN')}</TableCell>
                          <TableCell>{project.sample_count || 0}</TableCell>
                          <TableCell className="text-right pr-6">
                            <Button plain onClick={() => handleViewProjectDetail(project)}>
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
          )}

          {activeTab === 'pending' && (
            <div>
              <Table bleed={true} striped>
                <TableHead>
                  <TableRow>
                    <TableHeader className="pl-6">实验室项目编号</TableHeader>
                    <TableHeader>申办方项目编号</TableHeader>
                    <TableHeader>申请人</TableHeader>
                    <TableHeader>申请原因</TableHeader>
                    <TableHeader>申请时间</TableHeader>
                    <TableHeader>状态</TableHeader>
                    <TableHeader className="text-right pr-6">操作</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <AnimatedLoadingState colSpan={7} variant="skeleton" />
                  ) : filteredRequests.length === 0 ? (
                    <AnimatedEmptyState colSpan={7} text="暂无待归档申请" />
                  ) : (
                    <AnimatePresence>
                      {filteredRequests.map((request, index) => (
                        <AnimatedTableRow key={request.id} index={index}>
                          <TableCell className="font-medium pl-6">{request.project.lab_project_code}</TableCell>
                          <TableCell>{request.project.sponsor_project_code || '-'}</TableCell>
                          <TableCell>{request.requested_by.full_name}</TableCell>
                          <TableCell>{request.reason}</TableCell>
                          <TableCell>{new Date(request.created_at).toLocaleDateString('zh-CN')}</TableCell>
                          <TableCell>{getStatusBadge(request.status)}</TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end gap-2">
                              <Button plain onClick={() => handleApproveRequest(request.id)}>
                                批准
                              </Button>
                              <Button plain onClick={() => handleRejectRequest(request.id)}>
                                驳回
                              </Button>
                            </div>
                          </TableCell>
                        </AnimatedTableRow>
                      ))}
                    </AnimatePresence>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {activeTab === 'archived' && (
            <div>
              <Table bleed={true} striped>
                <TableHead>
                  <TableRow>
                    <TableHeader className="pl-6">实验室项目编号</TableHeader>
                    <TableHeader>申办方项目编号</TableHeader>
                    <TableHeader>申办方</TableHeader>
                    <TableHeader>归档时间</TableHeader>
                    <TableHeader>样本总数</TableHeader>
                    <TableHeader>销毁样本数</TableHeader>
                    <TableHeader className="text-right pr-6">操作</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <AnimatedLoadingState colSpan={7} variant="skeleton" />
                  ) : filteredProjects.length === 0 ? (
                    <AnimatedEmptyState colSpan={7} text="暂无已归档项目" />
                  ) : (
                    <AnimatePresence>
                      {filteredProjects.map((project, index) => (
                        <AnimatedTableRow key={project.id} index={index}>
                          <TableCell className="font-medium pl-6">{project.lab_project_code}</TableCell>
                          <TableCell>{project.sponsor_project_code || '-'}</TableCell>
                          <TableCell>{project.sponsor || '-'}</TableCell>
                          <TableCell>{project.archived_at ? new Date(project.archived_at).toLocaleDateString('zh-CN') : '-'}</TableCell>
                          <TableCell>{project.total_samples || 0}</TableCell>
                          <TableCell>{project.destroyed_samples || 0}</TableCell>
                          <TableCell className="text-right pr-6">
                            <Button plain onClick={() => handleViewProjectDetail(project)}>
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
          )}
        </div>

        {/* 申请归档对话框 */}
        <Dialog open={isRequestDialogOpen} onClose={setIsRequestDialogOpen} size="xl">
          <DialogTitle>申请项目归档</DialogTitle>
          <DialogBody>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  选择项目 <span className="text-red-500">*</span>
                </label>
                <Select
                  value={archiveForm.project_id}
                  onChange={(e) => setArchiveForm({...archiveForm, project_id: e.target.value})}
                  required
                >
                  <option value="">请选择项目</option>
                  {projects.filter(p => p.status === 'active').map(project => (
                    <option key={project.id} value={project.id}>
                      {project.lab_project_code} - {project.sponsor_project_code}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  归档原因 <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={archiveForm.reason}
                  onChange={(e) => setArchiveForm({...archiveForm, reason: e.target.value})}
                  placeholder="请说明申请归档的原因"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  项目完成总结
                </label>
                <Textarea
                  value={archiveForm.completion_summary}
                  onChange={(e) => setArchiveForm({...archiveForm, completion_summary: e.target.value})}
                  placeholder="请对项目完成情况进行总结"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  最终报告
                </label>
                <div className="flex items-center gap-3">
                  <Input
                    type="text"
                    value={archiveForm.final_report_path}
                    onChange={(e) => setArchiveForm({...archiveForm, final_report_path: e.target.value})}
                    placeholder="最终报告文件路径"
                    className="flex-1"
                  />
                  <Button plain>
                    <CloudArrowUpIcon className="h-4 w-4" />
                    上传文件
                  </Button>
                </div>
              </div>
            </div>
          </DialogBody>
          <DialogActions>
            <Button plain onClick={() => setIsRequestDialogOpen(false)}>
              取消
            </Button>
            <Button color="dark" onClick={handleRequestArchive}>
              提交申请
            </Button>
          </DialogActions>
        </Dialog>

        {/* 项目详情对话框 */}
        <Dialog open={isDetailDialogOpen} onClose={setIsDetailDialogOpen} size="2xl">
          {selectedProject && (
            <>
              <DialogTitle>项目详情 - {selectedProject.lab_project_code}</DialogTitle>
              <DialogBody>
                <div className="space-y-6">
                  {/* 项目基本信息 */}
                  <div>
                    <h3 className="text-lg font-medium mb-3">项目基本信息</h3>
                    <DescriptionList>
                      <DescriptionTerm>实验室项目编号</DescriptionTerm>
                      <DescriptionDetails>{selectedProject.lab_project_code}</DescriptionDetails>
                      
                      <DescriptionTerm>申办方项目编号</DescriptionTerm>
                      <DescriptionDetails>{selectedProject.sponsor_project_code || '-'}</DescriptionDetails>
                      
                      <DescriptionTerm>申办方</DescriptionTerm>
                      <DescriptionDetails>{selectedProject.sponsor || '-'}</DescriptionDetails>
                      
                      <DescriptionTerm>项目状态</DescriptionTerm>
                      <DescriptionDetails>{getStatusBadge(selectedProject.status)}</DescriptionDetails>
                      
                      <DescriptionTerm>开始时间</DescriptionTerm>
                      <DescriptionDetails>{new Date(selectedProject.created_at).toLocaleDateString('zh-CN')}</DescriptionDetails>
                    </DescriptionList>
                  </div>

                  {/* 项目统计信息 */}
                  {projectSummary && (
                    <div>
                      <h3 className="text-lg font-medium mb-3">项目统计</h3>
                      <DescriptionList>
                        <DescriptionTerm>样本总数</DescriptionTerm>
                        <DescriptionDetails>
                          <Badge color="zinc">{projectSummary.total_samples}</Badge>
                        </DescriptionDetails>
                        
                        <DescriptionTerm>已销毁样本</DescriptionTerm>
                        <DescriptionDetails>
                          <Badge color="red">{projectSummary.destroyed_samples}</Badge>
                        </DescriptionDetails>
                        
                        <DescriptionTerm>活跃偏差</DescriptionTerm>
                        <DescriptionDetails>
                          <Badge color={projectSummary.active_deviations > 0 ? 'yellow' : 'green'}>
                            {projectSummary.active_deviations}
                          </Badge>
                        </DescriptionDetails>
                        
                        <DescriptionTerm>待转移样本</DescriptionTerm>
                        <DescriptionDetails>
                          <Badge color={projectSummary.pending_transfers > 0 ? 'purple' : 'green'}>
                            {projectSummary.pending_transfers}
                          </Badge>
                        </DescriptionDetails>
                        
                        <DescriptionTerm>未归还样本</DescriptionTerm>
                        <DescriptionDetails>
                          <Badge color={projectSummary.unreturned_samples > 0 ? 'yellow' : 'green'}>
                            {projectSummary.unreturned_samples}
                          </Badge>
                        </DescriptionDetails>
                      </DescriptionList>
                    </div>
                  )}

                  {/* 归档检查项 */}
                  {selectedProject.status === 'active' && projectSummary && (
                    <div>
                      <h3 className="text-lg font-medium mb-3">归档检查项</h3>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {projectSummary.active_deviations === 0 ? (
                            <CheckCircleIcon className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircleIcon className="h-5 w-5 text-red-500" />
                          )}
                          <span>所有偏差已处理完毕</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {projectSummary.pending_transfers === 0 ? (
                            <CheckCircleIcon className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircleIcon className="h-5 w-5 text-red-500" />
                          )}
                          <span>所有转移已完成</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {projectSummary.unreturned_samples === 0 ? (
                            <CheckCircleIcon className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircleIcon className="h-5 w-5 text-red-500" />
                          )}
                          <span>所有借用样本已归还</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </DialogBody>
              <DialogActions>
                <Button plain onClick={() => setIsDetailDialogOpen(false)}>
                  关闭
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>
      </div>
    </AppLayout>
  );
}