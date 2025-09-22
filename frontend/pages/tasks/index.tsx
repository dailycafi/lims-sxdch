import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { Button } from '@/components/button';
import { Tabs } from '@/components/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/table';
import { Badge } from '@/components/badge';
import { AnimatedLoadingState } from '@/components/animated-table';
import { ArrowPathIcon, ArrowTopRightOnSquareIcon, ExclamationCircleIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';
import { toast } from 'react-hot-toast';

import { TasksService } from '@/services';
import { TaskCategory, TaskItem, TaskOverview } from '@/types/api';
import { useProjectStore } from '@/store/project';

type TaskTabKey = 'all' | TaskCategory;

const categoryLabels: Record<TaskCategory, string> = {
   borrow: '申请领用',
   return: '样本归还',
   transfer: '样本转移',
   destroy: '样本销毁',
 };

const statusColors: Record<string, 'yellow' | 'blue' | 'orange' | 'green' | 'rose' | 'purple' | 'zinc'> = {
   pending: 'yellow',
   approved: 'blue',
   borrowed: 'orange',
   returned: 'green',
   completed: 'green',
   partial_returned: 'yellow',
   rejected: 'rose',
   in_transit: 'orange',
   test_manager_approved: 'blue',
   director_approved: 'purple',
 };

const tabConfig: { key: TaskTabKey; label: string }[] = [
   { key: 'all', label: '全部任务' },
   { key: 'borrow', label: '申请领用' },
   { key: 'return', label: '样本归还' },
   { key: 'transfer', label: '样本转移' },
   { key: 'destroy', label: '样本销毁' },
 ];

export default function TaskCenterPage() {
   const router = useRouter();
   const { selectedProjectId, setSelectedProject } = useProjectStore();
   const [overview, setOverview] = useState<TaskOverview | null>(null);
   const [loading, setLoading] = useState(false);
   const [activeTab, setActiveTab] = useState<TaskTabKey>('all');

   const fetchTasks = async () => {
     setLoading(true);
     try {
       const data = await TasksService.getTaskOverview({
         project_id: selectedProjectId ?? undefined,
         limit: 50,
       });
       setOverview(data);
     } catch (error: any) {
       console.error('Failed to fetch tasks overview:', error);
       toast.error('获取任务列表失败');
     } finally {
       setLoading(false);
     }
   };

   useEffect(() => {
     fetchTasks();
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [selectedProjectId]);

   const allTasks = useMemo(() => {
     if (!overview) return [] as TaskItem[];
     return [
       ...overview.borrow,
       ...overview.return,
       ...overview.transfer,
       ...overview.destroy,
     ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
   }, [overview]);

  const tasksForTab: TaskItem[] = useMemo(() => {
    if (!overview) return [];
    if (activeTab === 'all') {
      return allTasks;
    }
    const key = activeTab as Exclude<TaskTabKey, 'all'>;
    return overview[key] ?? [];
  }, [overview, activeTab, allTasks]);

   const handleNavigate = (task: TaskItem) => {
     setSelectedProject(task.project_id);
     const params = new URLSearchParams({
       taskId: String(task.id),
       taskType: task.category,
     });

     switch (task.category) {
       case 'borrow':
         router.push(`/samples/borrow?${params.toString()}`);
         break;
       case 'return':
         params.set('view', 'borrowed');
         router.push(`/samples/borrow?${params.toString()}`);
         break;
      case 'transfer':
        if (task.metadata?.transfer_type) {
          params.set('transferType', task.metadata.transfer_type);
        }
        router.push(`/samples/transfer?${params.toString()}`);
        break;
       case 'destroy':
         router.push(`/samples/destroy?${params.toString()}`);
         break;
       default:
         break;
     }
   };

   return (
     <AppLayout>
       <div className="max-w-7xl mx-auto">
         <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
           <div>
             <Heading>任务中心</Heading>
             <Text className="mt-1 text-zinc-600">
               查看当前项目下的样本相关任务，点击任务可快速跳转到对应流程页面
             </Text>
           </div>
           <div className="flex items-center gap-2">
             <Button outline onClick={fetchTasks} disabled={loading}>
               <ArrowPathIcon className={clsx('h-4 w-4', loading && 'animate-spin')} />
               刷新
             </Button>
           </div>
         </div>

         <div className="mb-4 rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm">
           <Text className="text-sm text-zinc-500">
             当前筛选项目：{selectedProjectId ? `#${selectedProjectId}` : '全部项目'}
           </Text>
         </div>

         <div className="mb-4 rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm">
           <Tabs
             tabs={tabConfig.map(({ key, label }) => ({ key, label }))}
             activeTab={activeTab}
             onChange={(key) => setActiveTab(key as TaskTabKey)}
           />
         </div>

         <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow">
           <Table bleed>
             <TableHead>
               <TableRow>
                 <TableHeader>任务</TableHeader>
                 <TableHeader>项目</TableHeader>
                 <TableHeader>状态</TableHeader>
                 <TableHeader>数量</TableHeader>
                 <TableHeader>创建时间</TableHeader>
                 <TableHeader>操作</TableHeader>
               </TableRow>
             </TableHead>
             <TableBody>
               {loading ? (
                 <AnimatedLoadingState colSpan={6} variant="skeleton" />
               ) : tasksForTab.length === 0 ? (
                 <TableRow>
                   <TableCell colSpan={6} className="py-12 text-center">
                     <div className="flex flex-col items-center gap-3 text-zinc-500">
                       <ExclamationCircleIcon className="h-12 w-12 text-zinc-300" />
                       <span>当前没有相关任务</span>
                     </div>
                   </TableCell>
                 </TableRow>
               ) : (
                 tasksForTab.map((task) => (
                   <TableRow key={`${task.category}-${task.id}`} className="cursor-pointer" onClick={() => handleNavigate(task)}>
                     <TableCell>
                       <div className="flex flex-col">
                         <span className="font-medium text-zinc-900">{task.title}</span>
                         <span className="text-xs text-zinc-500">{categoryLabels[task.category]}</span>
                       </div>
                     </TableCell>
                     <TableCell>
                       <div>
                         <div className="font-medium text-zinc-900">{task.project_code || '-'}</div>
                         {task.sponsor_project_code && (
                           <div className="text-xs text-zinc-500">{task.sponsor_project_code}</div>
                         )}
                       </div>
                     </TableCell>
                     <TableCell>
                       <div className="flex items-center gap-2">
                         <Badge color={statusColors[task.status] || 'zinc'}>{task.status}</Badge>
                         {task.action_required && (
                           <Badge color="rose" size="sm">需处理</Badge>
                         )}
                       </div>
                     </TableCell>
                     <TableCell>
                       {task.sample_count ?? (task.metadata?.pending_samples ?? '-')}
                     </TableCell>
                     <TableCell>
                       <div className="flex flex-col">
                         <span>{new Date(task.created_at).toLocaleString('zh-CN')}</span>
                         {task.due_at && (
                           <span className="text-xs text-zinc-500">截止：{new Date(task.due_at).toLocaleString('zh-CN')}</span>
                         )}
                       </div>
                     </TableCell>
                     <TableCell>
                       <div className="flex items-center gap-2 text-blue-600">
                         <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                         <span>跳转</span>
                       </div>
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
