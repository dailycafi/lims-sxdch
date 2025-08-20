import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Textarea } from '@/components/textarea';
import { Select } from '@/components/select';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Heading } from '@/components/heading';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { DescriptionList, DescriptionTerm, DescriptionDetails } from '@/components/description-list';
import { api } from '@/lib/api';
import { 
  ExclamationTriangleIcon,
  DocumentTextIcon,
  ClipboardDocumentCheckIcon,
  UserGroupIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ClockIcon
} from '@heroicons/react/20/solid';

interface Deviation {
  id: number;
  deviation_code: string;
  title: string;
  severity: string;
  category: string;
  project?: {
    id: number;
    lab_project_code: string;
  };
  reporter?: {
    full_name: string;
  };
  status: string;
  current_step?: number;
  created_at: string;
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

const STEP_NAMES = [
  '偏差报告',
  '项目负责人审核',
  'QA初审',
  '项目负责人指定执行人',
  '执行人填写执行情况',
  '项目负责人确认',
  '分析测试主管审核',
  'QA最终审核',
  '实验室主任批准'
];

export default function DeviationCompletePage() {
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeviation, setSelectedDeviation] = useState<DeviationDetail | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'my_pending' | 'all'>('my_pending');
  const [users, setUsers] = useState<any[]>([]);
  const [approvalForm, setApprovalForm] = useState({
    action: 'approve',
    comments: '',
    designated_executor_id: '',
    executed_actions: '',
    root_cause: '',
    corrective_action: '',
    preventive_action: ''
  });

  useEffect(() => {
    fetchDeviations();
    fetchUsers();
  }, [activeTab]);

  const fetchDeviations = async () => {
    try {
      const params = activeTab === 'my_pending' ? { my_pending: true } : {};
      const response = await api.get('/deviations', { params });
      setDeviations(response.data);
    } catch (error) {
      console.error('Failed to fetch deviations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchDeviationDetail = async (id: number) => {
    try {
      const response = await api.get(`/deviations/${id}`);
      setSelectedDeviation(response.data);
      setIsDetailDialogOpen(true);
    } catch (error) {
      console.error('Failed to fetch deviation detail:', error);
    }
  };

  const handleApproval = async () => {
    if (!selectedDeviation) return;

    try {
      await api.post(`/deviations/${selectedDeviation.id}/approve`, approvalForm);
      alert('处理成功');
      setIsApprovalDialogOpen(false);
      resetApprovalForm();
      fetchDeviations();
    } catch (error) {
      console.error('Failed to process approval:', error);
      alert('处理失败');
    }
  };

  const resetApprovalForm = () => {
    setApprovalForm({
      action: 'approve',
      comments: '',
      designated_executor_id: '',
      executed_actions: '',
      root_cause: '',
      corrective_action: '',
      preventive_action: ''
    });
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      minor: 'yellow',
      major: 'orange',
      critical: 'red'
    };
    return <Badge color={colors[severity] || 'zinc'}>{severity}</Badge>;
  };

  const getCategoryBadge = (category: string) => {
    const categoryMap = {
      temperature: '温度',
      operation: '操作',
      equipment: '设备',
      sample: '样本',
      process: '流程',
      other: '其他'
    };
    return <Badge color="blue">{categoryMap[category] || category}</Badge>;
  };

  const getStepIcon = (step: number) => {
    if (step <= 2) return <DocumentTextIcon className="h-5 w-5" />;
    if (step <= 4) return <UserGroupIcon className="h-5 w-5" />;
    if (step <= 6) return <ClipboardDocumentCheckIcon className="h-5 w-5" />;
    return <CheckCircleIcon className="h-5 w-5" />;
  };

  const canUserApprove = (deviation: DeviationDetail) => {
    // TODO: 根据当前用户角色和偏差当前步骤判断是否可以审批
    return deviation.current_step && deviation.current_step <= 9;
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading>偏差管理（完整流程）</Heading>
            <Text className="mt-1 text-zinc-600">8步审批流程管理</Text>
          </div>
        </div>

        {/* 标签页 */}
        <div className="flex space-x-1 border-b border-zinc-200 mb-6">
          <button
            onClick={() => setActiveTab('my_pending')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'my_pending'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
          >
            待我处理
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'all'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
          >
            全部偏差
          </button>
        </div>

        {/* 偏差列表 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>偏差编号</TableHeader>
                <TableHeader>标题</TableHeader>
                <TableHeader>严重程度</TableHeader>
                <TableHeader>类别</TableHeader>
                <TableHeader>项目</TableHeader>
                <TableHeader>报告人</TableHeader>
                <TableHeader>当前步骤</TableHeader>
                <TableHeader>创建时间</TableHeader>
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
              ) : deviations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <Text>暂无数据</Text>
                  </TableCell>
                </TableRow>
              ) : (
                deviations.map((deviation) => (
                  <TableRow key={deviation.id}>
                    <TableCell className="font-medium">{deviation.deviation_code}</TableCell>
                    <TableCell>{deviation.title}</TableCell>
                    <TableCell>{getSeverityBadge(deviation.severity)}</TableCell>
                    <TableCell>{getCategoryBadge(deviation.category)}</TableCell>
                    <TableCell>{deviation.project?.lab_project_code || '-'}</TableCell>
                    <TableCell>{deviation.reporter?.full_name || '-'}</TableCell>
                    <TableCell>
                      {deviation.current_step ? (
                        <div className="flex items-center gap-1">
                          {getStepIcon(deviation.current_step)}
                          <Text className="text-sm">
                            步骤{deviation.current_step}: {STEP_NAMES[deviation.current_step - 1]}
                          </Text>
                        </div>
                      ) : (
                        <Badge color="green">已完成</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-zinc-600">
                      {new Date(deviation.created_at).toLocaleDateString('zh-CN')}
                    </TableCell>
                    <TableCell>
                      <Button 
                        plain
                        size="small"
                        onClick={() => fetchDeviationDetail(deviation.id)}
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
      </div>

      {/* 详情对话框 */}
      <Dialog open={isDetailDialogOpen} onClose={setIsDetailDialogOpen} size="xl">
        <DialogTitle>偏差详情</DialogTitle>
        <DialogBody>
          {selectedDeviation && (
            <div className="space-y-6">
              {/* 基本信息 */}
              <div>
                <h3 className="text-lg font-medium mb-3">基本信息</h3>
                <DescriptionList>
                  <div>
                    <DescriptionTerm>偏差编号</DescriptionTerm>
                    <DescriptionDetails>{selectedDeviation.deviation_code}</DescriptionDetails>
                  </div>
                  <div>
                    <DescriptionTerm>标题</DescriptionTerm>
                    <DescriptionDetails>{selectedDeviation.title}</DescriptionDetails>
                  </div>
                  <div>
                    <DescriptionTerm>严重程度</DescriptionTerm>
                    <DescriptionDetails>{getSeverityBadge(selectedDeviation.severity)}</DescriptionDetails>
                  </div>
                  <div>
                    <DescriptionTerm>类别</DescriptionTerm>
                    <DescriptionDetails>{getCategoryBadge(selectedDeviation.category)}</DescriptionDetails>
                  </div>
                </DescriptionList>
              </div>

              {/* 偏差内容 */}
              <div>
                <h3 className="text-lg font-medium mb-3">偏差内容</h3>
                <div className="space-y-3">
                  <div>
                    <Text className="font-medium text-zinc-700">偏差描述</Text>
                    <Text className="mt-1">{selectedDeviation.description}</Text>
                  </div>
                  <div>
                    <Text className="font-medium text-zinc-700">影响评估</Text>
                    <Text className="mt-1">{selectedDeviation.impact_assessment}</Text>
                  </div>
                  {selectedDeviation.immediate_action && (
                    <div>
                      <Text className="font-medium text-zinc-700">立即采取的措施</Text>
                      <Text className="mt-1">{selectedDeviation.immediate_action}</Text>
                    </div>
                  )}
                </div>
              </div>

              {/* 处理方案 */}
              {(selectedDeviation.root_cause || selectedDeviation.corrective_action || selectedDeviation.preventive_action) && (
                <div>
                  <h3 className="text-lg font-medium mb-3">处理方案</h3>
                  <div className="space-y-3">
                    {selectedDeviation.root_cause && (
                      <div>
                        <Text className="font-medium text-zinc-700">根本原因</Text>
                        <Text className="mt-1">{selectedDeviation.root_cause}</Text>
                      </div>
                    )}
                    {selectedDeviation.corrective_action && (
                      <div>
                        <Text className="font-medium text-zinc-700">纠正措施</Text>
                        <Text className="mt-1">{selectedDeviation.corrective_action}</Text>
                      </div>
                    )}
                    {selectedDeviation.preventive_action && (
                      <div>
                        <Text className="font-medium text-zinc-700">预防措施</Text>
                        <Text className="mt-1">{selectedDeviation.preventive_action}</Text>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 审批流程 */}
              <div>
                <h3 className="text-lg font-medium mb-3">审批流程</h3>
                <div className="space-y-2">
                  {selectedDeviation.approvals.map((approval, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                      <div className="flex-shrink-0">
                        {approval.user ? (
                          approval.action === 'approve' ? (
                            <CheckCircleIcon className="h-5 w-5 text-green-500" />
                          ) : approval.action === 'reject' ? (
                            <XCircleIcon className="h-5 w-5 text-red-500" />
                          ) : (
                            <ArrowPathIcon className="h-5 w-5 text-blue-500" />
                          )
                        ) : (
                          <ClockIcon className="h-5 w-5 text-zinc-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <Text className="font-medium">
                          步骤{approval.step}: {approval.step_name}
                        </Text>
                        {approval.user && (
                          <div className="mt-1 space-y-1">
                            <Text className="text-sm text-zinc-600">
                              处理人：{approval.user.full_name}
                            </Text>
                            {approval.comments && (
                              <Text className="text-sm text-zinc-600">
                                意见：{approval.comments}
                              </Text>
                            )}
                            {approval.executed_actions && (
                              <Text className="text-sm text-zinc-600">
                                执行情况：{approval.executed_actions}
                              </Text>
                            )}
                            <Text className="text-sm text-zinc-500">
                              {new Date(approval.processed_at!).toLocaleString('zh-CN')}
                            </Text>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsDetailDialogOpen(false)}>
            关闭
          </Button>
          {selectedDeviation && canUserApprove(selectedDeviation) && (
            <Button onClick={() => {
              setIsDetailDialogOpen(false);
              setIsApprovalDialogOpen(true);
            }}>
              处理
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* 审批对话框 */}
      <Dialog open={isApprovalDialogOpen} onClose={setIsApprovalDialogOpen} size="lg">
        <DialogTitle>处理偏差</DialogTitle>
        <DialogBody>
          {selectedDeviation && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <Text className="font-medium text-blue-900">
                  当前步骤：{selectedDeviation.current_step ? STEP_NAMES[selectedDeviation.current_step - 1] : ''}
                </Text>
              </div>

              {/* 根据不同步骤显示不同的表单 */}
              {selectedDeviation.current_step === 3 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      根本原因分析
                    </label>
                    <Textarea
                      value={approvalForm.root_cause}
                      onChange={(e) => setApprovalForm({...approvalForm, root_cause: e.target.value})}
                      rows={3}
                      placeholder="请分析偏差的根本原因"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      纠正措施
                    </label>
                    <Textarea
                      value={approvalForm.corrective_action}
                      onChange={(e) => setApprovalForm({...approvalForm, corrective_action: e.target.value})}
                      rows={3}
                      placeholder="请填写纠正措施"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      预防措施
                    </label>
                    <Textarea
                      value={approvalForm.preventive_action}
                      onChange={(e) => setApprovalForm({...approvalForm, preventive_action: e.target.value})}
                      rows={3}
                      placeholder="请填写预防措施"
                    />
                  </div>
                </>
              )}

              {selectedDeviation.current_step === 4 && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    指定执行人 <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={approvalForm.designated_executor_id}
                    onChange={(e) => setApprovalForm({...approvalForm, designated_executor_id: e.target.value})}
                    required
                  >
                    <option value="">请选择执行人</option>
                    {users.filter(u => ['ANALYST', 'SAMPLE_ADMIN'].includes(u.role)).map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name} ({user.username})
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {selectedDeviation.current_step === 5 && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    实际执行情况 <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    value={approvalForm.executed_actions}
                    onChange={(e) => setApprovalForm({...approvalForm, executed_actions: e.target.value})}
                    rows={4}
                    placeholder="请详细填写实际执行情况"
                    required
                  />
                </div>
              )}

              {/* 通用字段 */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  操作 <span className="text-red-500">*</span>
                </label>
                <Select
                  value={approvalForm.action}
                  onChange={(e) => setApprovalForm({...approvalForm, action: e.target.value})}
                >
                  <option value="approve">批准</option>
                  <option value="reject">拒绝</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  处理意见 <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={approvalForm.comments}
                  onChange={(e) => setApprovalForm({...approvalForm, comments: e.target.value})}
                  rows={3}
                  placeholder="请填写处理意见"
                  required
                />
              </div>
            </div>
          )}
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => {
            setIsApprovalDialogOpen(false);
            resetApprovalForm();
          }}>
            取消
          </Button>
          <Button 
            onClick={handleApproval}
            color={approvalForm.action === 'approve' ? 'blue' : 'red'}
          >
            {approvalForm.action === 'approve' ? '批准' : '拒绝'}
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
