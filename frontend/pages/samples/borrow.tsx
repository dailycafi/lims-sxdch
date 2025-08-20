import { useState, useEffect } from 'react';
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
import { api } from '@/lib/api';
import { 
  PlusIcon,
  BeakerIcon,
  ArrowUpOnSquareIcon,
  ArrowDownOnSquareIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon
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
  const [activeTab, setActiveTab] = useState<'pending' | 'borrowed' | 'history'>('pending');
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<BorrowRequest | null>(null);
  const [selectedProject, setSelectedProject] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [availableSamples, setAvailableSamples] = useState<Sample[]>([]);
  const [selectedSamples, setSelectedSamples] = useState<string[]>([]);
  const [borrowForm, setBorrowForm] = useState({
    purpose: '',
    target_location: '',
    target_date: '',
    notes: ''
  });

  useEffect(() => {
    fetchRequests();
    fetchProjects();
  }, [activeTab]);

  const fetchRequests = async () => {
    try {
      const response = await api.get('/samples/borrow-requests', {
        params: { status: activeTab }
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

  const handleExecuteBorrow = async (requestId: number) => {
    // 跳转到领用执行页面
    window.location.href = `/samples/borrow/execute/${requestId}`;
  };

  const handleReturnSamples = async (requestId: number) => {
    // 跳转到归还页面
    window.location.href = `/samples/return/${requestId}`;
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

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading>样本领用管理</Heading>
            <Text className="mt-1 text-zinc-600">管理样本领用申请和归还流程</Text>
          </div>
          <Button onClick={() => setIsRequestDialogOpen(true)}>
            <PlusIcon />
            申请领用
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
            onClick={() => setActiveTab('borrowed')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'borrowed'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
          >
            已领用
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
          >
            历史记录
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
                <TableHeader>用途</TableHeader>
                <TableHeader>目标位置</TableHeader>
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
                    <TableCell>
                      {request.project.lab_project_code}
                    </TableCell>
                    <TableCell>{request.requested_by.full_name}</TableCell>
                    <TableCell>{request.sample_count}</TableCell>
                    <TableCell>{getPurposeLabel(request.purpose)}</TableCell>
                    <TableCell>{request.target_location}</TableCell>
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
                            setIsDetailDialogOpen(true);
                          }}
                        >
                          查看
                        </Button>
                        {request.status === 'pending' && (
                          <Button
                            plain
                            size="small"
                            onClick={() => handleApproveBorrow(request.id)}
                          >
                            <CheckCircleIcon />
                            批准
                          </Button>
                        )}
                        {request.status === 'approved' && (
                          <Button
                            plain
                            size="small"
                            onClick={() => handleExecuteBorrow(request.id)}
                          >
                            <ArrowUpOnSquareIcon />
                            执行领用
                          </Button>
                        )}
                        {request.status === 'borrowed' && (
                          <Button
                            plain
                            size="small"
                            onClick={() => handleReturnSamples(request.id)}
                          >
                            <ArrowDownOnSquareIcon />
                            归还
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
                  <Button plain size="small" onClick={handleSelectAll}>
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
