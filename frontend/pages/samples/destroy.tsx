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
import { ESignatureDialog } from '@/components/e-signature-dialog';
import { 
  TrashIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/20/solid';

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
  const [requests, setRequests] = useState<DestroyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'completed'>('pending');
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DestroyRequest | null>(null);
  const [approvalFlows, setApprovalFlows] = useState<ApprovalFlow[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedSamples, setSelectedSamples] = useState<string[]>([]);
  const [availableSamples, setAvailableSamples] = useState<any[]>([]);
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

  useEffect(() => {
    fetchRequests();
    fetchProjects();
  }, [activeTab]);

  const fetchRequests = async () => {
    try {
      const response = await api.get('/samples/destroy-requests', {
        params: { status: activeTab }
      });
      setRequests(response.data);
    } catch (error) {
      console.error('Failed to fetch destroy requests:', error);
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
      setAvailableSamples(response.data);
    } catch (error) {
      console.error('Failed to fetch samples:', error);
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
    try {
      const formData = new FormData();
      formData.append('project_id', selectedProject);
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
    setSelectedProject('');
    setSelectedSamples([]);
    setDestroyForm({
      reason: '',
      approval_file: null,
      notes: ''
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge color="yellow">待审批</Badge>;
      case 'test_manager_approved':
        return <Badge color="blue">主管已批准</Badge>;
      case 'director_approved':
        return <Badge color="purple">主任已批准</Badge>;
      case 'ready':
        return <Badge color="orange">待执行</Badge>;
      case 'completed':
        return <Badge color="green">已销毁</Badge>;
      case 'rejected':
        return <Badge color="red">已拒绝</Badge>;
      default:
        return <Badge color="zinc">{status}</Badge>;
    }
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

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading>样本销毁管理</Heading>
            <Text className="mt-1 text-zinc-600">管理样本销毁申请和审批流程</Text>
          </div>
          <Button onClick={() => setIsRequestDialogOpen(true)} color="red">
            <TrashIcon />
            申请销毁
          </Button>
        </div>

        {/* 标签页 */}
        <div className="flex space-x-1 border-b border-zinc-200 mb-6">
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
            onClick={() => setActiveTab('approved')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'approved'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
          >
            已批准
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'completed'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
          >
            已完成
          </button>
        </div>

        {/* 请求列表 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>申请编号</TableHeader>
                <TableHeader>项目</TableHeader>
                <TableHeader>申请人</TableHeader>
                <TableHeader>样本数量</TableHeader>
                <TableHeader>销毁原因</TableHeader>
                <TableHeader>当前审批</TableHeader>
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
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <Text>暂无数据</Text>
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.request_code}</TableCell>
                    <TableCell>{request.project.lab_project_code}</TableCell>
                    <TableCell>{request.requested_by.full_name}</TableCell>
                    <TableCell>{request.sample_count}</TableCell>
                    <TableCell className="max-w-xs truncate">{request.reason}</TableCell>
                    <TableCell>{request.current_approver || '-'}</TableCell>
                    <TableCell className="text-zinc-600">
                      {new Date(request.created_at).toLocaleDateString('zh-CN')}
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          plain
                          size="small"
                          onClick={() => {
                            setSelectedRequest(request);
                            fetchApprovalFlow(request.id);
                            setIsApprovalDialogOpen(true);
                          }}
                        >
                          查看
                        </Button>
                        {['pending', 'test_manager_approved'].includes(request.status) && (
                          <Button
                            plain
                            size="small"
                            onClick={() => {
                              setSelectedRequest(request);
                              setIsApprovalDialogOpen(true);
                            }}
                          >
                            审批
                          </Button>
                        )}
                        {request.status === 'ready' && (
                          <Button
                            plain
                            size="small"
                            color="red"
                            onClick={() => handleExecuteDestroy(request.id)}
                          >
                            执行销毁
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
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setDestroyForm({...destroyForm, approval_file: e.target.files[0]});
                    }
                  }}
                  className="hidden"
                />
                <Button as="span" plain>
                  <CloudArrowUpIcon />
                  上传批准文件
                </Button>
              </label>
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
            color="red"
            onClick={handleSubmitRequest}
            disabled={!selectedProject || selectedSamples.length === 0 || !destroyForm.reason || !destroyForm.approval_file}
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
