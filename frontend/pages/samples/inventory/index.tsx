import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { Button } from '@/components/button';
import { Select } from '@/components/select';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Badge } from '@/components/badge';
import { api } from '@/lib/api';

interface ReceiveTask {
  id: number;
  project_id: number;
  project_name: string;
  clinical_site: string;
  transport_company: string;
  transport_method: string;
  temperature_monitor_id: string;
  sample_count: number;
  sample_status: string;
  received_by: string;
  received_at: string;
  status: string;
}

const statusLabel: Record<string, string> = {
  pending: '待清点',
  in_progress: '清点中',
  completed: '已完成'
};

export default function PendingInventoryListPage() {
  const [tasks, setTasks] = useState<ReceiveTask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [status, setStatus] = useState<string>('pending');

  useEffect(() => {
    fetchTasks();
  }, [status]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/samples/receive-records', {
        params: { status: status !== 'all' ? status : undefined }
      });
      setTasks(res.data || []);
    } catch (e) {
      console.error('Failed to load receive records:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Heading>待清点任务列表</Heading>
            <Text className="mt-1 text-zinc-600">显示所有项目的接收记录，可进入清点流程</Text>
          </div>
          <div className="flex gap-3">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="pending">待清点</option>
              <option value="in_progress">清点中</option>
              <option value="completed">已完成</option>
              <option value="all">全部</option>
            </Select>
            <Button onClick={fetchTasks}>刷新</Button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden">
          <Table bleed striped>
            <TableHead>
              <TableRow>
                <TableHeader className="pl-6">序号</TableHeader>
                <TableHeader>项目编号</TableHeader>
                <TableHeader>样本数量</TableHeader>
                <TableHeader>接收人</TableHeader>
                <TableHeader>接收时间</TableHeader>
                <TableHeader>状态</TableHeader>
                <TableHeader className="pr-6">操作</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-zinc-500">加载中...</TableCell>
                </TableRow>
              ) : tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-zinc-500">暂无待清点任务</TableCell>
                </TableRow>
              ) : (
                tasks.map((task, index) => (
                  <TableRow key={task.id}>
                    <TableCell className="pl-6">{index + 1}</TableCell>
                    <TableCell>{task.project_name || '-'}</TableCell>
                    <TableCell>{task.sample_count}</TableCell>
                    <TableCell>{task.received_by || '-'}</TableCell>
                    <TableCell>{new Date(task.received_at).toLocaleString('zh-CN')}</TableCell>
                    <TableCell>
                      <Badge color={task.status === 'completed' ? 'green' : task.status === 'pending' ? 'yellow' : 'blue'}>
                        {statusLabel[task.status] || task.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-6">
                      <Link href={`/samples/inventory/${task.id}`}>
                        <Button size="small">开始清点</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}


