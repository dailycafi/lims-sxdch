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
  ExclamationTriangleIcon,
  PlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  UserGroupIcon
} from '@heroicons/react/20/solid';

interface Deviation {
  id: number;
  deviation_code: string;
  title: string;
  severity: 'minor' | 'major' | 'critical';
  category: string;
  reported_by: {
    full_name: string;
  };
  project?: {
    lab_project_code: string;
  };
  status: string;
  created_at: string;
  closed_at?: string;
}

interface DeviationDetail {
  id: number;
  deviation_code: string;
  title: string;
  severity: string;
  category: string;
  description: string;
  impact_assessment: string;
  immediate_action?: string;
  root_cause?: string;
  corrective_action?: string;
  preventive_action?: string;
  status: string;
  reported_by: any;
  approved_by?: any;
  closed_by?: any;
  created_at: string;
  approved_at?: string;
  closed_at?: string;
  samples?: any[];
  attachments?: any[];
  tracking_items?: any[];
}

export default function DeviationPage() {
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'in_progress' | 'closed'>('pending');
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedDeviation, setSelectedDeviation] = useState<DeviationDetail | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [reportForm, setReportForm] = useState({
    title: '',
    severity: 'minor',
    category: '',
    project_id: '',
    description: '',
    impact_assessment: '',
    immediate_action: '',
    sample_codes: [] as string[]
  });

  useEffect(() => {
    fetchDeviations();
    fetchProjects();
  }, [activeTab]);

  const fetchDeviations = async () => {
    try {
      const response = await api.get('/deviations', {
        params: { status: activeTab }
      });
      setDeviations(response.data);
    } catch (error) {
      console.error('Failed to fetch deviations:', error);
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

  const fetchDeviationDetail = async (id: number) => {
    try {
      const response = await api.get(`/deviations/${id}`);
      setSelectedDeviation(response.data);
    } catch (error) {
      console.error('Failed to fetch deviation detail:', error);
    }
  };

  const handleReport = async () => {
    try {
      await api.post('/deviations', reportForm);
      setIsReportDialogOpen(false);
      resetForm();
      fetchDeviations();
    } catch (error) {
      console.error('Failed to report deviation:', error);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await api.post(`/deviations/${id}/approve`, {
        root_cause: selectedDeviation?.root_cause,
        corrective_action: selectedDeviation?.corrective_action,
        preventive_action: selectedDeviation?.preventive_action
      });
      fetchDeviations();
      setIsDetailDialogOpen(false);
    } catch (error) {
      console.error('Failed to approve deviation:', error);
    }
  };

  const handleClose = async (id: number) => {
    if (!confirm('确定要关闭此偏差吗？')) return;

    try {
      await api.post(`/deviations/${id}/close`);
      fetchDeviations();
    } catch (error) {
      console.error('Failed to close deviation:', error);
    }
  };

  const resetForm = () => {
    setReportForm({
      title: '',
      severity: 'minor',
      category: '',
      project_id: '',
      description: '',
      impact_assessment: '',
      immediate_action: '',
      sample_codes: []
    });
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'minor':
        return <Badge color="yellow">轻微</Badge>;
      case 'major':
        return <Badge color="orange">重大</Badge>;
      case 'critical':
        return <Badge color="red">严重</Badge>;
      default:
        return <Badge color="zinc">{severity}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'reported':
        return <Badge color="blue">已报告</Badge>;
      case 'approved':
        return <Badge color="purple">已批准</Badge>;
      case 'in_progress':
        return <Badge color="amber">执行中</Badge>;
      case 'closed':
        return <Badge color="green">已关闭</Badge>;
      default:
        return <Badge color="zinc">{status}</Badge>;
    }
  };

  const getCategoryLabel = (category: string) => {
    const categoryMap: { [key: string]: string } = {
      'temperature': '温度偏差',
      'operation': '操作偏差',
      'equipment': '设备异常',
      'sample': '样本异常',
      'process': '流程偏差',
      'other': '其他'
    };
    return categoryMap[category] || category;
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading>偏差管理</Heading>
            <Text className="mt-1 text-zinc-600">记录、追踪和处理实验室偏差事件</Text>
          </div>
          <Button onClick={() => setIsReportDialogOpen(true)}>
            <PlusIcon />
            报告偏差
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
            待处理
          </button>
          <button
            onClick={() => setActiveTab('in_progress')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'in_progress'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
          >
            执行中
          </button>
          <button
            onClick={() => setActiveTab('closed')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'closed'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
          >
            已关闭
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
                <TableHeader>报告时间</TableHeader>
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
                    <TableCell className="max-w-xs truncate">{deviation.title}</TableCell>
                    <TableCell>{getSeverityBadge(deviation.severity)}</TableCell>
                    <TableCell>{getCategoryLabel(deviation.category)}</TableCell>
                    <TableCell>{deviation.project?.lab_project_code || '-'}</TableCell>
                    <TableCell>{deviation.reported_by.full_name}</TableCell>
                    <TableCell className="text-zinc-600">
                      {new Date(deviation.created_at).toLocaleDateString('zh-CN')}
                    </TableCell>
                    <TableCell>{getStatusBadge(deviation.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          plain
                          size="small"
                          onClick={() => {
                            fetchDeviationDetail(deviation.id);
                            setIsDetailDialogOpen(true);
                          }}
                        >
                          查看
                        </Button>
                        {deviation.status === 'reported' && (
                          <Button
                            plain
                            size="small"
                            onClick={() => handleApprove(deviation.id)}
                          >
                            批准
                          </Button>
                        )}
                        {deviation.status === 'in_progress' && (
                          <Button
                            plain
                            size="small"
                            onClick={() => handleClose(deviation.id)}
                          >
                            关闭
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

      {/* 报告偏差对话框 */}
      <Dialog open={isReportDialogOpen} onClose={setIsReportDialogOpen} size="4xl">
        <DialogTitle>报告偏差</DialogTitle>
        <DialogDescription>
          记录发现的偏差事件并进行初步评估
        </DialogDescription>
        <DialogBody>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  偏差标题 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={reportForm.title}
                  onChange={(e) => setReportForm({...reportForm, title: e.target.value})}
                  placeholder="简要描述偏差"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  严重程度 <span className="text-red-500">*</span>
                </label>
                <Select
                  value={reportForm.severity}
                  onChange={(e) => setReportForm({...reportForm, severity: e.target.value})}
                  required
                >
                  <option value="minor">轻微 - 不影响数据完整性</option>
                  <option value="major">重大 - 可能影响数据质量</option>
                  <option value="critical">严重 - 影响数据完整性或产品质量</option>
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
                  <option value="">请选择类别</option>
                  <option value="temperature">温度偏差</option>
                  <option value="operation">操作偏差</option>
                  <option value="equipment">设备异常</option>
                  <option value="sample">样本异常</option>
                  <option value="process">流程偏差</option>
                  <option value="other">其他</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  相关项目
                </label>
                <Select
                  value={reportForm.project_id}
                  onChange={(e) => setReportForm({...reportForm, project_id: e.target.value})}
                >
                  <option value="">不涉及特定项目</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.lab_project_code} - {project.sponsor_project_code}
                    </option>
                  ))}
                </Select>
              </div>
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

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                涉及样本（可选）
              </label>
              <Textarea
                placeholder="输入受影响的样本编号，每行一个"
                onChange={(e) => {
                  const codes = e.target.value.split('\n').filter(code => code.trim());
                  setReportForm({...reportForm, sample_codes: codes});
                }}
                rows={3}
              />
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => {
            setIsReportDialogOpen(false);
            resetForm();
          }}>
            取消
          </Button>
          <Button 
            onClick={handleReport}
            disabled={!reportForm.title || !reportForm.category || !reportForm.description || !reportForm.impact_assessment}
          >
            提交报告
          </Button>
        </DialogActions>
      </Dialog>

      {/* 偏差详情对话框 */}
      <Dialog open={isDetailDialogOpen} onClose={setIsDetailDialogOpen} size="4xl">
        <DialogTitle>偏差详情</DialogTitle>
        <DialogBody>
          {selectedDeviation && (
            <div className="space-y-6">
              {/* 基本信息 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <Text className="font-medium text-lg">基本信息</Text>
                  <div className="flex gap-2">
                    {getSeverityBadge(selectedDeviation.severity)}
                    {getStatusBadge(selectedDeviation.status)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Text className="text-sm text-zinc-600">偏差编号</Text>
                    <Text className="font-medium">{selectedDeviation.deviation_code}</Text>
                  </div>
                  <div>
                    <Text className="text-sm text-zinc-600">类别</Text>
                    <Text className="font-medium">{getCategoryLabel(selectedDeviation.category)}</Text>
                  </div>
                  <div>
                    <Text className="text-sm text-zinc-600">报告人</Text>
                    <Text className="font-medium">{selectedDeviation.reported_by?.full_name}</Text>
                  </div>
                  <div>
                    <Text className="text-sm text-zinc-600">报告时间</Text>
                    <Text className="font-medium">
                      {new Date(selectedDeviation.created_at).toLocaleString('zh-CN')}
                    </Text>
                  </div>
                </div>
              </div>

              {/* 偏差内容 */}
              <div>
                <Text className="font-medium mb-2">偏差描述</Text>
                <div className="p-4 bg-zinc-50 rounded-lg">
                  <Text>{selectedDeviation.description}</Text>
                </div>
              </div>

              <div>
                <Text className="font-medium mb-2">影响评估</Text>
                <div className="p-4 bg-zinc-50 rounded-lg">
                  <Text>{selectedDeviation.impact_assessment}</Text>
                </div>
              </div>

              {selectedDeviation.immediate_action && (
                <div>
                  <Text className="font-medium mb-2">立即采取的措施</Text>
                  <div className="p-4 bg-zinc-50 rounded-lg">
                    <Text>{selectedDeviation.immediate_action}</Text>
                  </div>
                </div>
              )}

              {/* 处理方案 */}
              {selectedDeviation.status !== 'reported' && (
                <div className="border-t pt-4">
                  <Text className="font-medium text-lg mb-4">处理方案</Text>
                  <div className="space-y-3">
                    {selectedDeviation.root_cause && (
                      <div>
                        <Text className="text-sm text-zinc-600">根本原因</Text>
                        <Text className="mt-1">{selectedDeviation.root_cause}</Text>
                      </div>
                    )}
                    {selectedDeviation.corrective_action && (
                      <div>
                        <Text className="text-sm text-zinc-600">纠正措施</Text>
                        <Text className="mt-1">{selectedDeviation.corrective_action}</Text>
                      </div>
                    )}
                    {selectedDeviation.preventive_action && (
                      <div>
                        <Text className="text-sm text-zinc-600">预防措施</Text>
                        <Text className="mt-1">{selectedDeviation.preventive_action}</Text>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 执行跟踪 */}
              {selectedDeviation.tracking_items && selectedDeviation.tracking_items.length > 0 && (
                <div className="border-t pt-4">
                  <Text className="font-medium text-lg mb-4">执行跟踪</Text>
                  <div className="space-y-2">
                    {selectedDeviation.tracking_items.map((item: any) => (
                      <div key={item.id} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
                        {item.completed ? (
                          <CheckCircleIcon className="h-5 w-5 text-green-500" />
                        ) : (
                          <ClockIcon className="h-5 w-5 text-zinc-400" />
                        )}
                        <div className="flex-1">
                          <Text>{item.action}</Text>
                          <Text className="text-sm text-zinc-600">
                            负责人：{item.assignee} · 期限：{new Date(item.due_date).toLocaleDateString('zh-CN')}
                          </Text>
                        </div>
                      </div>
                    ))}
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