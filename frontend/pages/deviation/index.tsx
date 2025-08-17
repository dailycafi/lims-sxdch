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
import { PlusIcon, EyeIcon, CheckIcon, XMarkIcon } from '@heroicons/react/20/solid';

interface Deviation {
  id: number;
  project_id: number;
  project_name: string;
  description: string;
  impact: string;
  cause_analysis: string;
  planned_action: string;
  actual_action?: string;
  status: string;
  reporter_id: number;
  reporter_name: string;
  current_approver?: string;
  created_at: string;
  updated_at: string;
}

const deviationStatuses: Record<string, { label: string; color: any }> = {
  draft: { label: '草稿', color: 'zinc' },
  pending_pm: { label: '待项目负责人审核', color: 'yellow' },
  pending_qa: { label: '待QA审核', color: 'blue' },
  pending_execution: { label: '待执行', color: 'purple' },
  executing: { label: '执行中', color: 'amber' },
  pending_review: { label: '待复核', color: 'indigo' },
  pending_final: { label: '待最终审批', color: 'pink' },
  completed: { label: '已完成', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
};

export default function DeviationPage() {
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDeviation, setSelectedDeviation] = useState<Deviation | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    project_id: '',
    description: '',
    impact: '',
    cause_analysis: '',
    planned_action: '',
  });

  useEffect(() => {
    fetchDeviations();
  }, []);

  const fetchDeviations = async () => {
    try {
      const response = await api.get('/deviations');
      setDeviations(response.data);
    } catch (error) {
      console.error('Failed to fetch deviations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await api.post('/deviations', formData);
      setIsCreateDialogOpen(false);
      setFormData({
        project_id: '',
        description: '',
        impact: '',
        cause_analysis: '',
        planned_action: '',
      });
      fetchDeviations();
    } catch (error) {
      console.error('Failed to create deviation:', error);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await api.post(`/deviations/${id}/approve`);
      fetchDeviations();
    } catch (error) {
      console.error('Failed to approve deviation:', error);
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt('请输入驳回理由：');
    if (!reason) return;
    
    try {
      await api.post(`/deviations/${id}/reject`, { reason });
      fetchDeviations();
    } catch (error) {
      console.error('Failed to reject deviation:', error);
    }
  };

  const openDetailDialog = (deviation: Deviation) => {
    setSelectedDeviation(deviation);
    setIsDetailDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading>偏差管理</Heading>
            <Text className="mt-1 text-zinc-600">管理项目执行过程中的偏差报告和处理</Text>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <PlusIcon />
            报告偏差
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>偏差编号</TableHeader>
                <TableHeader>项目</TableHeader>
                <TableHeader>描述</TableHeader>
                <TableHeader>报告人</TableHeader>
                <TableHeader>状态</TableHeader>
                <TableHeader>报告时间</TableHeader>
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
              ) : deviations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Text>暂无偏差报告</Text>
                  </TableCell>
                </TableRow>
              ) : (
                deviations.map((deviation) => (
                  <TableRow key={deviation.id}>
                    <TableCell className="font-medium">DEV-{deviation.id.toString().padStart(4, '0')}</TableCell>
                    <TableCell>{deviation.project_name}</TableCell>
                    <TableCell className="max-w-xs truncate">{deviation.description}</TableCell>
                    <TableCell>{deviation.reporter_name}</TableCell>
                    <TableCell>
                      <Badge color={deviationStatuses[deviation.status]?.color || 'zinc'}>
                        {deviationStatuses[deviation.status]?.label || deviation.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-zinc-600">
                      {new Date(deviation.created_at).toLocaleDateString('zh-CN')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button plain onClick={() => openDetailDialog(deviation)}>
                          <EyeIcon />
                        </Button>
                        {deviation.current_approver === 'current_user' && (
                          <>
                            <Button plain onClick={() => handleApprove(deviation.id)}>
                              <CheckIcon />
                            </Button>
                            <Button plain onClick={() => handleReject(deviation.id)}>
                              <XMarkIcon />
                            </Button>
                          </>
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

      {/* 创建偏差报告对话框 */}
      <Dialog open={isCreateDialogOpen} onClose={setIsCreateDialogOpen} size="4xl">
        <DialogTitle>报告偏差</DialogTitle>
        <DialogDescription>
          填写偏差报告信息，提交审批流程
        </DialogDescription>
        <DialogBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                项目 <span className="text-red-500">*</span>
              </label>
              <Select
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                required
              >
                <option value="">请选择项目</option>
                {/* 这里应该从API获取项目列表 */}
                <option value="1">L2501 - 某药物I期临床试验</option>
                <option value="2">L2502 - 某药物II期临床试验</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                偏差描述 <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="详细描述偏差情况"
                rows={3}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                影响评估 <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={formData.impact}
                onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
                placeholder="说明偏差对项目和数据质量的影响"
                rows={3}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                原因分析 <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={formData.cause_analysis}
                onChange={(e) => setFormData({ ...formData, cause_analysis: e.target.value })}
                placeholder="分析导致偏差的原因"
                rows={3}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                计划采取措施 <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={formData.planned_action}
                onChange={(e) => setFormData({ ...formData, planned_action: e.target.value })}
                placeholder="说明计划采取的纠正和预防措施"
                rows={3}
                required
              />
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsCreateDialogOpen(false)}>
            取消
          </Button>
          <Button onClick={handleCreate}>
            提交报告
          </Button>
        </DialogActions>
      </Dialog>

      {/* 偏差详情对话框 */}
      <Dialog open={isDetailDialogOpen} onClose={setIsDetailDialogOpen} size="4xl">
        <DialogTitle>偏差详情</DialogTitle>
        <DialogDescription>
          偏差编号：DEV-{selectedDeviation?.id.toString().padStart(4, '0')}
        </DialogDescription>
        <DialogBody>
          {selectedDeviation && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-medium text-zinc-700 mb-2">基本信息</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Text className="text-sm text-zinc-500">项目</Text>
                    <Text className="font-medium">{selectedDeviation.project_name}</Text>
                  </div>
                  <div>
                    <Text className="text-sm text-zinc-500">状态</Text>
                    <Badge color={deviationStatuses[selectedDeviation.status]?.color || 'zinc'}>
                      {deviationStatuses[selectedDeviation.status]?.label || selectedDeviation.status}
                    </Badge>
                  </div>
                  <div>
                    <Text className="text-sm text-zinc-500">报告人</Text>
                    <Text className="font-medium">{selectedDeviation.reporter_name}</Text>
                  </div>
                  <div>
                    <Text className="text-sm text-zinc-500">报告时间</Text>
                    <Text className="font-medium">
                      {new Date(selectedDeviation.created_at).toLocaleString('zh-CN')}
                    </Text>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-zinc-700 mb-2">偏差描述</h4>
                <div className="bg-zinc-50 p-3 rounded-lg">
                  <Text>{selectedDeviation.description}</Text>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-zinc-700 mb-2">影响评估</h4>
                <div className="bg-zinc-50 p-3 rounded-lg">
                  <Text>{selectedDeviation.impact}</Text>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-zinc-700 mb-2">原因分析</h4>
                <div className="bg-zinc-50 p-3 rounded-lg">
                  <Text>{selectedDeviation.cause_analysis}</Text>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-zinc-700 mb-2">计划采取措施</h4>
                <div className="bg-zinc-50 p-3 rounded-lg">
                  <Text>{selectedDeviation.planned_action}</Text>
                </div>
              </div>

              {selectedDeviation.actual_action && (
                <div>
                  <h4 className="text-sm font-medium text-zinc-700 mb-2">实际执行情况</h4>
                  <div className="bg-zinc-50 p-3 rounded-lg">
                    <Text>{selectedDeviation.actual_action}</Text>
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
