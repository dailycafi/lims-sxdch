import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Textarea } from '@/components/textarea';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Heading } from '@/components/heading';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { api } from '@/lib/api';
import { ArchiveBoxIcon, EyeIcon, LockClosedIcon } from '@heroicons/react/20/solid';

interface Project {
  id: number;
  sponsor_project_no: string;
  lab_project_no: string;
  sponsor_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  archive_info?: {
    reason: string;
    archived_by: string;
    archived_at: string;
    approval_status: string;
  };
}

const archiveStatuses: Record<string, { label: string; color: any }> = {
  pending_manager: { label: '待主管审批', color: 'yellow' },
  pending_qa: { label: '待QA审批', color: 'blue' },
  pending_archive: { label: '待归档', color: 'purple' },
  archived: { label: '已归档', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
};

export default function ArchivePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [archiveReason, setArchiveReason] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await api.get('/projects');
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveRequest = async () => {
    if (!selectedProject) return;
    
    try {
      await api.post(`/projects/${selectedProject.id}/archive`, {
        reason: archiveReason
      });
      setIsArchiveDialogOpen(false);
      setArchiveReason('');
      setSelectedProject(null);
      fetchProjects();
    } catch (error) {
      console.error('Failed to request archive:', error);
    }
  };

  const openArchiveDialog = (project: Project) => {
    setSelectedProject(project);
    setIsArchiveDialogOpen(true);
  };

  const activeProjects = projects.filter(p => !p.is_archived);
  const archivedProjects = projects.filter(p => p.is_archived);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Heading>项目归档管理</Heading>
          <Text className="mt-1 text-zinc-600">管理项目的归档申请和审批流程</Text>
        </div>

        {/* 活跃项目 */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">活跃项目</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>实验室项目编号</TableHeader>
                  <TableHeader>申办者项目编号</TableHeader>
                  <TableHeader>申办者</TableHeader>
                  <TableHeader>项目状态</TableHeader>
                  <TableHeader>创建时间</TableHeader>
                  <TableHeader>操作</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Text>加载中...</Text>
                    </TableCell>
                  </TableRow>
                ) : activeProjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Text>暂无活跃项目</Text>
                    </TableCell>
                  </TableRow>
                ) : (
                  activeProjects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.lab_project_no}</TableCell>
                      <TableCell>{project.sponsor_project_no}</TableCell>
                      <TableCell>{project.sponsor_name}</TableCell>
                      <TableCell>
                        <Badge color="green">活跃</Badge>
                      </TableCell>
                      <TableCell className="text-zinc-600">
                        {new Date(project.created_at).toLocaleDateString('zh-CN')}
                      </TableCell>
                      <TableCell>
                        <Button plain onClick={() => openArchiveDialog(project)}>
                          <ArchiveBoxIcon />
                          申请归档
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* 归档项目 */}
        <div>
          <h2 className="text-lg font-semibold mb-4">归档项目</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>实验室项目编号</TableHeader>
                  <TableHeader>申办者项目编号</TableHeader>
                  <TableHeader>申办者</TableHeader>
                  <TableHeader>归档状态</TableHeader>
                  <TableHeader>归档时间</TableHeader>
                  <TableHeader>归档理由</TableHeader>
                  <TableHeader>操作</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {archivedProjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Text>暂无归档项目</Text>
                    </TableCell>
                  </TableRow>
                ) : (
                  archivedProjects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.lab_project_no}</TableCell>
                      <TableCell>{project.sponsor_project_no}</TableCell>
                      <TableCell>{project.sponsor_name}</TableCell>
                      <TableCell>
                        <Badge color={archiveStatuses[project.archive_info?.approval_status || 'archived']?.color}>
                          {archiveStatuses[project.archive_info?.approval_status || 'archived']?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-zinc-600">
                        {project.archive_info?.archived_at 
                          ? new Date(project.archive_info.archived_at).toLocaleDateString('zh-CN')
                          : '-'
                        }
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {project.archive_info?.reason || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button plain>
                            <EyeIcon />
                          </Button>
                          <Button plain disabled>
                            <LockClosedIcon />
                          </Button>
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

      {/* 申请归档对话框 */}
      <Dialog open={isArchiveDialogOpen} onClose={setIsArchiveDialogOpen}>
        <DialogTitle>申请项目归档</DialogTitle>
        <DialogDescription>
          项目编号：{selectedProject?.lab_project_no}
        </DialogDescription>
        <DialogBody>
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 rounded-lg">
              <Text className="text-sm text-amber-800">
                <strong>注意：</strong>项目归档后将变为只读状态，不可进行任何操作。请确保所有工作已完成。
              </Text>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                归档理由 <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="请说明申请归档的理由，如：项目已完成所有样本检测和数据分析"
                rows={4}
                required
              />
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-medium text-zinc-700 mb-2">审批流程</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-zinc-600">
                <li>项目负责人提交归档申请</li>
                <li>分析测试主管审核</li>
                <li>QA审核</li>
                <li>计算机管理员执行归档</li>
              </ol>
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => {
            setIsArchiveDialogOpen(false);
            setArchiveReason('');
            setSelectedProject(null);
          }}>
            取消
          </Button>
          <Button 
            onClick={handleArchiveRequest}
            disabled={!archiveReason.trim()}
          >
            提交申请
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
