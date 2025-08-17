import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Heading } from '@/components/heading';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { api } from '@/lib/api';
import { 
  PlusIcon, 
  CheckIcon, 
  BeakerIcon,
  TruckIcon,
  CloudArrowUpIcon,
  QrCodeIcon 
} from '@heroicons/react/20/solid';

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
  status: 'pending' | 'in_progress' | 'completed';
}

export default function SampleReceivePage() {
  const [tasks, setTasks] = useState<ReceiveTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReceiveDialogOpen, setIsReceiveDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [formData, setFormData] = useState({
    clinical_site: '',
    transport_company: '',
    transport_method: '',
    temperature_monitor_id: '',
    sample_count: '',
    sample_status: '',
    storage_location: '',
  });

  useEffect(() => {
    fetchReceiveTasks();
  }, []);

  const fetchReceiveTasks = async () => {
    try {
      const response = await api.get('/samples/receive-tasks');
      setTasks(response.data);
    } catch (error) {
      console.error('Failed to fetch receive tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReceive = async () => {
    try {
      await api.post('/samples/receive', {
        project_id: selectedProject,
        ...formData,
        sample_count: parseInt(formData.sample_count),
      });
      setIsReceiveDialogOpen(false);
      resetForm();
      fetchReceiveTasks();
    } catch (error) {
      console.error('Failed to receive samples:', error);
    }
  };

  const handleStartInventory = async (taskId: number) => {
    // 跳转到清点页面
    window.location.href = `/samples/inventory/${taskId}`;
  };

  const resetForm = () => {
    setSelectedProject('');
    setFormData({
      clinical_site: '',
      transport_company: '',
      transport_method: '',
      temperature_monitor_id: '',
      sample_count: '',
      sample_status: '',
      storage_location: '',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge color="yellow">待清点</Badge>;
      case 'in_progress':
        return <Badge color="blue">清点中</Badge>;
      case 'completed':
        return <Badge color="green">已完成</Badge>;
      default:
        return <Badge color="zinc">{status}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading>样本接收</Heading>
            <Text className="mt-1 text-zinc-600">接收临床试验样本并安排清点入库</Text>
          </div>
          <Button onClick={() => setIsReceiveDialogOpen(true)}>
            <PlusIcon />
            接收样本
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>接收编号</TableHeader>
                <TableHeader>项目</TableHeader>
                <TableHeader>临床机构</TableHeader>
                <TableHeader>样本数量</TableHeader>
                <TableHeader>运输方式</TableHeader>
                <TableHeader>接收人</TableHeader>
                <TableHeader>接收时间</TableHeader>
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
              ) : tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <Text>暂无接收任务</Text>
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">RCV-{task.id.toString().padStart(4, '0')}</TableCell>
                    <TableCell>{task.project_name}</TableCell>
                    <TableCell>{task.clinical_site}</TableCell>
                    <TableCell>{task.sample_count}</TableCell>
                    <TableCell>{task.transport_method}</TableCell>
                    <TableCell>{task.received_by}</TableCell>
                    <TableCell className="text-zinc-600">
                      {new Date(task.received_at).toLocaleString('zh-CN')}
                    </TableCell>
                    <TableCell>{getStatusBadge(task.status)}</TableCell>
                    <TableCell>
                      {task.status === 'pending' && (
                        <Button plain onClick={() => handleStartInventory(task.id)}>
                          <CheckIcon />
                          开始清点
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

      {/* 接收样本对话框 */}
      <Dialog open={isReceiveDialogOpen} onClose={setIsReceiveDialogOpen} size="4xl">
        <DialogTitle>接收样本</DialogTitle>
        <DialogDescription>
          录入样本接收信息，生成清点任务
        </DialogDescription>
        <DialogBody>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  项目 <span className="text-red-500">*</span>
                </label>
                <Select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  required
                >
                  <option value="">请选择项目</option>
                  <option value="1">L2501 - 某药物I期临床试验</option>
                  <option value="2">L2502 - 某药物II期临床试验</option>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  临床机构/分中心 <span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.clinical_site}
                  onChange={(e) => setFormData({ ...formData, clinical_site: e.target.value })}
                  required
                >
                  <option value="">请选择临床机构</option>
                  <option value="site1">上海市第一人民医院</option>
                  <option value="site2">复旦大学附属中山医院</option>
                  <option value="site3">上海交通大学医学院附属瑞金医院</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  运输单位/部门 <span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.transport_company}
                  onChange={(e) => setFormData({ ...formData, transport_company: e.target.value })}
                  required
                >
                  <option value="">请选择运输单位</option>
                  <option value="company1">顺丰冷链</option>
                  <option value="company2">京东物流</option>
                  <option value="company3">专业医药物流公司</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  运输方式 <span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.transport_method}
                  onChange={(e) => setFormData({ ...formData, transport_method: e.target.value })}
                  required
                >
                  <option value="">请选择运输方式</option>
                  <option value="cold_chain">冷链运输（2-8℃）</option>
                  <option value="frozen">冷冻运输（-20℃）</option>
                  <option value="ultra_frozen">超低温运输（-80℃）</option>
                  <option value="room_temp">常温运输</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  温度记录仪编号/序列号 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.temperature_monitor_id}
                  onChange={(e) => setFormData({ ...formData, temperature_monitor_id: e.target.value })}
                  placeholder="输入温度记录仪编号"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  样本数量 <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  value={formData.sample_count}
                  onChange={(e) => setFormData({ ...formData, sample_count: e.target.value })}
                  placeholder="输入样本数量"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  样本状态 <span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.sample_status}
                  onChange={(e) => setFormData({ ...formData, sample_status: e.target.value })}
                  required
                >
                  <option value="">请选择样本状态</option>
                  <option value="good">完好</option>
                  <option value="damaged">包装破损</option>
                  <option value="thawed">疑似解冻</option>
                  <option value="other">其他异常</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  暂存位置
                </label>
                <div className="flex gap-2">
                  <Input
                    value={formData.storage_location}
                    onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                    placeholder="扫描冰箱条码或手动输入"
                  />
                  <Button plain>
                    <QrCodeIcon />
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  温度数据文件
                </label>
                <div className="flex items-center gap-2">
                  <Button plain>
                    <CloudArrowUpIcon />
                    上传温度数据
                  </Button>
                  <Text className="text-sm text-zinc-500">支持 CSV, Excel 格式</Text>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  快递单及其他照片
                </label>
                <div className="flex items-center gap-2">
                  <Button plain>
                    <CloudArrowUpIcon />
                    上传照片
                  </Button>
                  <Text className="text-sm text-zinc-500">支持 JPG, PNG 格式</Text>
                </div>
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => {
            setIsReceiveDialogOpen(false);
            resetForm();
          }}>
            取消
          </Button>
          <Button 
            onClick={handleReceive}
            disabled={!selectedProject || !formData.clinical_site || !formData.sample_count}
          >
            接收完成
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
