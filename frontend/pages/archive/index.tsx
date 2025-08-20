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
import { DescriptionList, DescriptionTerm, DescriptionDetails } from '@/components/description-list';
import { api } from '@/lib/api';
import { 
  ArchiveBoxIcon,
  LockClosedIcon,
  DocumentCheckIcon,
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/20/solid';

interface ArchiveRequest {
  id: number;
  project: {
    id: number;
    lab_project_code: string;
    sponsor_project_code: string;
    status: string;
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
  }, [activeTab]);

  const fetchActiveProjects = async () => {
    try {
      const response = await api.get('/projects', {
        params: { status: 'active' }
      });
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingRequests = async () => {
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
    try {
      const response = await api.get('/archive/archived');
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch archived projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectSummary = async (projectId: number) => {
    try {
      const response = await api.get(`/projects/${projectId}/archive-summary`);
      setProjectSummary(response.data);
    } catch (error) {
      console.error('Failed to fetch project summary:', error);
    }
  };

  const handleRequestArchive = async () => {
    try {
      await api.post('/archive/request', archiveForm);
      setIsRequestDialogOpen(false);
      resetForm();
      alert('归档申请已提交');
      setActiveTab('pending');
    } catch (error) {
      console.error('Failed to request archive:', error);
      alert('归档申请失败');
    }
  };

  const handleApprove = async (requestId: number) => {
    if (!confirm('确定要批准此归档申请吗？项目归档后将被锁定，无法进行任何操作。')) return;

    try {
      await api.post(`/archive/request/${requestId}/approve`);
      fetchPendingRequests();
      alert('归档申请已批准');
    } catch (error) {
      console.error('Failed to approve archive:', error);
      alert('批准失败');
    }
  };

  const handleReject = async (requestId: number) => {
    const reason = prompt('请输入拒绝原因：');
    if (!reason) return;

    try {
      await api.post(`/archive/request/${requestId}/reject`, { reason });
      fetchPendingRequests();
      alert('归档申请已拒绝');
    } catch (error) {
      console.error('Failed to reject archive:', error);
      alert('拒绝失败');
    }
  };

  const resetForm = () => {
    setArchiveForm({
      project_id: '',
      reason: '',
      completion_summary: '',
      final_report_path: ''
    });
    setProjectSummary(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge color="green">进行中</Badge>;
      case 'pending_archive':
        return <Badge color="yellow">待归档</Badge>;
      case 'archived':
        return <Badge color="zinc">已归档</Badge>;
      case 'locked':
        return <Badge color="red">已锁定</Badge>;
      default:
        return <Badge color="zinc">{status}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading>项目归档管理</Heading>
            <Text className="mt-1 text-zinc-600">管理项目的归档申请和审批</Text>
          </div>
          {activeTab === 'active' && (
            <Button onClick={() => setIsRequestDialogOpen(true)}>
              <ArchiveBoxIcon />
              申请归档
            </Button>
          )}
        </div>

        {/* 标签页 */}
        <div className="flex space-x-1 border-b border-zinc-200 mb-6">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'active'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
          >
            进行中项目
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
          >
            待审批
          </button>
          <button
            onClick={() => setActiveTab('archived')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'archived'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
          >
            已归档
          </button>
        </div>

        {/* 内容区域 */}
        {activeTab === 'active' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>项目编号</TableHeader>
                  <TableHeader>申办方编号</TableHeader>
                  <TableHeader>申办者</TableHeader>
                  <TableHeader>临床机构</TableHeader>
                  <TableHeader>开始时间</TableHeader>
                  <TableHeader>状态</TableHeader>
                  <TableHeader>操作</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Text>加载中...</Text>
                    </TableCell>
                  </TableRow>
                ) : projects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Text>暂无进行中的项目</Text>
                    </TableCell>
                  </TableRow>
                ) : (
                  projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.lab_project_code}</TableCell>
                      <TableCell>{project.sponsor_project_code}</TableCell>
                      <TableCell>{project.sponsor?.name || '-'}</TableCell>
                      <TableCell>{project.clinical_org?.name || '-'}</TableCell>
                      <TableCell className="text-zinc-600">
                        {new Date(project.created_at).toLocaleDateString('zh-CN')}
                      </TableCell>
                      <TableCell>{getStatusBadge(project.status)}</TableCell>
                      <TableCell>
                        <Button 
                          plain
                          size="small"
                          onClick={() => {
                            setSelectedProject(project);
                            fetchProjectSummary(project.id);
                            setIsDetailDialogOpen(true);
                          }}
                        >
                          查看详情
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {activeTab === 'pending' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>项目编号</TableHeader>
                  <TableHeader>申办方编号</TableHeader>
                  <TableHeader>申请人</TableHeader>
                  <TableHeader>申请原因</TableHeader>
                  <TableHeader>申请时间</TableHeader>
                  <TableHeader>状态</TableHeader>
                  <TableHeader>操作</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Text>加载中...</Text>
                    </TableCell>
                  </TableRow>
                ) : requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Text>暂无待审批的归档申请</Text>
                    </TableCell>
                  </TableRow>
                ) : (
                  requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">{request.project.lab_project_code}</TableCell>
                      <TableCell>{request.project.sponsor_project_code}</TableCell>
                      <TableCell>{request.requested_by.full_name}</TableCell>
                      <TableCell className="max-w-xs truncate">{request.reason}</TableCell>
                      <TableCell className="text-zinc-600">
                        {new Date(request.created_at).toLocaleDateString('zh-CN')}
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            plain
                            size="small"
                            onClick={() => handleApprove(request.id)}
                          >
                            <CheckCircleIcon />
                            批准
                          </Button>
                          <Button 
                            plain
                            size="small"
                            color="red"
                            onClick={() => handleReject(request.id)}
                          >
                            <XCircleIcon />
                            拒绝
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {activeTab === 'archived' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>项目编号</TableHeader>
                  <TableHeader>申办方编号</TableHeader>
                  <TableHeader>申办者</TableHeader>
                  <TableHeader>临床机构</TableHeader>
                  <TableHeader>归档时间</TableHeader>
                  <TableHeader>状态</TableHeader>
                  <TableHeader>操作</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Text>加载中...</Text>
                    </TableCell>
                  </TableRow>
                ) : projects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Text>暂无已归档的项目</Text>
                    </TableCell>
                  </TableRow>
                ) : (
                  projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.lab_project_code}</TableCell>
                      <TableCell>{project.sponsor_project_code}</TableCell>
                      <TableCell>{project.sponsor?.name || '-'}</TableCell>
                      <TableCell>{project.clinical_org?.name || '-'}</TableCell>
                      <TableCell className="text-zinc-600">
                        {project.archived_at ? new Date(project.archived_at).toLocaleDateString('zh-CN') : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <LockClosedIcon className="h-4 w-4 text-red-500" />
                          {getStatusBadge('locked')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button 
                          plain
                          size="small"
                          onClick={() => {
                            setSelectedProject(project);
                            setIsDetailDialogOpen(true);
                          }}
                        >
                          查看
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* 申请归档对话框 */}
      <Dialog open={isRequestDialogOpen} onClose={setIsRequestDialogOpen} size="lg">
        <DialogTitle>申请项目归档</DialogTitle>
        <DialogDescription>
          项目归档后将被锁定，无法进行任何操作
        </DialogDescription>
        <DialogBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                选择项目 <span className="text-red-500">*</span>
              </label>
              <Select
                value={archiveForm.project_id}
                onChange={(e) => {
                  setArchiveForm({...archiveForm, project_id: e.target.value});
                  if (e.target.value) {
                    fetchProjectSummary(parseInt(e.target.value));
                  }
                }}
                required
              >
                <option value="">请选择要归档的项目</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.lab_project_code} - {project.sponsor_project_code}
                  </option>
                ))}
              </Select>
            </div>

            {projectSummary && (
              <div className="p-4 bg-amber-50 rounded-lg">
                <div className="flex items-start gap-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div className="text-sm">
                    <Text className="font-medium text-amber-900">项目状态检查</Text>
                    <div className="mt-2 space-y-1 text-amber-700">
                      <div>样本总数：{projectSummary.total_samples}</div>
                      <div>已销毁样本：{projectSummary.destroyed_samples}</div>
                      {projectSummary.unreturned_samples > 0 && (
                        <div className="text-red-600">
                          ⚠️ 还有 {projectSummary.unreturned_samples} 个样本未归还
                        </div>
                      )}
                      {projectSummary.pending_transfers > 0 && (
                        <div className="text-red-600">
                          ⚠️ 还有 {projectSummary.pending_transfers} 个转移未完成
                        </div>
                      )}
                      {projectSummary.active_deviations > 0 && (
                        <div className="text-red-600">
                          ⚠️ 还有 {projectSummary.active_deviations} 个偏差未关闭
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                归档原因 <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={archiveForm.reason}
                onChange={(e) => setArchiveForm({...archiveForm, reason: e.target.value})}
                placeholder="请说明项目归档的原因"
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
                placeholder="项目执行情况总结"
                rows={4}
              />
            </div>
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
            onClick={handleRequestArchive}
            disabled={!archiveForm.project_id || !archiveForm.reason}
          >
            提交申请
          </Button>
        </DialogActions>
      </Dialog>

      {/* 项目详情对话框 */}
      <Dialog open={isDetailDialogOpen} onClose={setIsDetailDialogOpen} size="lg">
        <DialogTitle>项目详情</DialogTitle>
        <DialogBody>
          {selectedProject && (
            <div className="space-y-4">
              <DescriptionList>
                <div>
                  <DescriptionTerm>项目编号</DescriptionTerm>
                  <DescriptionDetails>{selectedProject.lab_project_code}</DescriptionDetails>
                </div>
                <div>
                  <DescriptionTerm>申办方编号</DescriptionTerm>
                  <DescriptionDetails>{selectedProject.sponsor_project_code}</DescriptionDetails>
                </div>
                <div>
                  <DescriptionTerm>申办者</DescriptionTerm>
                  <DescriptionDetails>{selectedProject.sponsor?.name || '-'}</DescriptionDetails>
                </div>
                <div>
                  <DescriptionTerm>临床机构</DescriptionTerm>
                  <DescriptionDetails>{selectedProject.clinical_org?.name || '-'}</DescriptionDetails>
                </div>
                <div>
                  <DescriptionTerm>状态</DescriptionTerm>
                  <DescriptionDetails>{getStatusBadge(selectedProject.status)}</DescriptionDetails>
                </div>
                {selectedProject.archived_at && (
                  <div>
                    <DescriptionTerm>归档时间</DescriptionTerm>
                    <DescriptionDetails>
                      {new Date(selectedProject.archived_at).toLocaleString('zh-CN')}
                    </DescriptionDetails>
                  </div>
                )}
              </DescriptionList>

              {selectedProject.status === 'archived' && (
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <LockClosedIcon className="h-5 w-5 text-red-500" />
                    <Text className="font-medium text-red-900">
                      项目已锁定，无法进行任何操作
                    </Text>
                  </div>
                </div>
              )}
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