import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/date-utils';
import { useRouter } from 'next/router';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { Button } from '@/components/button';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Badge } from '@/components/badge';
import { api } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/dialog';
import { Alert, AlertTitle, AlertDescription, AlertActions } from '@/components/alert';
import { Textarea } from '@/components/textarea';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/20/solid';

interface SampleArchiveRequest {
  id: number;
  request_code: string;
  project_id: number;
  project_name?: string; // Backend needs to return this or we fetch it
  requested_by: number;
  requester_name?: string;
  reason: string;
  status: string;
  created_at: string;
}

export default function SampleArchivePage() {
  const router = useRouter();
  const [requests, setRequests] = useState<SampleArchiveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [selectedSamples, setSelectedSamples] = useState<string[]>([]); // Sample codes
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingArchiveId, setPendingArchiveId] = useState<number | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get('/samples/archive-requests');
      setRequests(res.data);
    } catch (e) {
      console.error('Failed to fetch archive requests', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async () => {
    try {
      // Hardcoded project_id 1 for demo, should come from context or selection
      await api.post('/samples/archive-request', {
        project_id: 1, 
        sample_codes: selectedSamples,
        reason: archiveReason
      });
      setIsRequestDialogOpen(false);
      setArchiveReason('');
      fetchRequests();
      toast.success('归档申请已提交');
    } catch (e) {
      console.error('Failed to create request', e);
      toast.error('申请失败');
    }
  };

  const handleExecuteArchive = async (id: number) => {
    setPendingArchiveId(id);
    setIsConfirmOpen(true);
  };

  const executeArchive = async () => {
    if (!pendingArchiveId) return;
    try {
      await api.post(`/samples/archive-request/${pendingArchiveId}/execute`);
      fetchRequests();
      toast.success('归档已执行');
    } catch (e) {
      console.error('Failed to execute archive', e);
      toast.error('执行失败');
    } finally {
      setIsConfirmOpen(false);
      setPendingArchiveId(null);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading>样本归档</Heading>
            <Text className="mt-1 text-zinc-600">管理样本归档申请与执行</Text>
          </div>
          <Button onClick={() => setIsRequestDialogOpen(true)}>
            申请归档
          </Button>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <Table bleed striped>
            <TableHead>
              <TableRow>
                <TableHeader>申请编号</TableHeader>
                <TableHeader>项目</TableHeader>
                <TableHeader>申请人</TableHeader>
                <TableHeader>原因</TableHeader>
                <TableHeader>状态</TableHeader>
                <TableHeader>申请时间</TableHeader>
                <TableHeader className="text-right">操作</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">加载中...</TableCell></TableRow>
              ) : requests.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-zinc-500">暂无申请</TableCell></TableRow>
              ) : (
                requests.map(req => (
                  <TableRow key={req.id}>
                    <TableCell className="font-mono">{req.request_code}</TableCell>
                    <TableCell>{req.project_name || req.project_id}</TableCell>
                    <TableCell>{req.requester_name || req.requested_by}</TableCell>
                    <TableCell className="max-w-xs truncate">{req.reason}</TableCell>
                    <TableCell>
                      <Badge color={req.status === 'completed' ? 'green' : 'yellow'}>
                        {req.status === 'completed' ? '已归档' : '待处理'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(req.created_at)}</TableCell>
                    <TableCell className="text-right">
                      {req.status !== 'completed' && (
                        <Button plain onClick={() => handleExecuteArchive(req.id)}>
                          执行归档
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={isCreateDialogOpen} onClose={setIsRequestDialogOpen}>
        <DialogTitle>申请样本归档</DialogTitle>
        <DialogBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">归档原因</label>
              <Textarea 
                value={archiveReason}
                onChange={e => setArchiveReason(e.target.value)}
                placeholder="请输入归档原因"
              />
            </div>
            <div>
              <Text className="text-sm text-zinc-500">
                * 演示模式：默认选择项目ID 1，且未集成样本选择器。
              </Text>
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsRequestDialogOpen(false)}>取消</Button>
          <Button onClick={handleCreateRequest}>提交申请</Button>
        </DialogActions>
      </Dialog>

      <Alert open={isConfirmOpen} onClose={setIsConfirmOpen}>
        <AlertTitle>确认执行归档</AlertTitle>
        <AlertDescription>
          确认执行归档操作吗？样本状态将被更新为“已归档”，此操作不可撤销。
        </AlertDescription>
        <AlertActions>
          <Button plain onClick={() => setIsConfirmOpen(false)}>取消</Button>
          <Button color="dark/zinc" onClick={executeArchive}>确认归档</Button>
        </AlertActions>
      </Alert>
    </AppLayout>
  );
}


