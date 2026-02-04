import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { Heading } from '@/components/heading';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { api } from '@/lib/api';
import {
  ClipboardDocumentListIcon,
  PencilSquareIcon,
  EyeIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/20/solid';
import { AnimatedLoadingState, AnimatedEmptyState, AnimatedTableRow } from '@/components/animated-table';
import { useTabState } from '@/hooks/useTabState';
import { EditorVerificationDialog } from '@/components/editor-verification-dialog';
import { ReceiveRecordEditDialog } from '@/components/receive-record-edit-dialog';
import type { TabContentProps } from '@/types/tabs';
import { toast } from 'react-hot-toast';

interface ReceiveTask {
  id: number;
  project_id: number;
  project_name: string;
  clinical_site: string;
  transport_company: string;
  transport_method: string;
  temperature_monitor_id: string;
  is_over_temperature: boolean;
  sample_count: number;
  sample_status: string;
  received_by: string;
  received_at: string;
  status: string;
}

interface EditorInfo {
  editor_id: number;
  editor_name: string;
  editor_username: string;
}

const statusColors: Record<string, any> = {
  pending: 'yellow',
  in_progress: 'blue',
  completed: 'green',
};

const statusLabels: Record<string, string> = {
  pending: '待清点',
  in_progress: '进行中',
  completed: '已完成',
};

const defaultTabState = {
  selectedTaskId: null as number | null,
  viewMode: 'all' as 'all' | 'pending' | 'completed',
};

export default function InventoryPage({ tabId, isActive }: Partial<TabContentProps> = {}) {
  const isTabMode = !!tabId;
  const tabState = useTabState(tabId || 'standalone', defaultTabState);

  const [localSelectedTaskId, setLocalSelectedTaskId] = useState<number | null>(null);
  const [localViewMode, setLocalViewMode] = useState<'all' | 'pending' | 'completed'>('all');

  const selectedTaskId = isTabMode ? tabState.state.selectedTaskId : localSelectedTaskId;
  const viewMode = isTabMode ? tabState.state.viewMode : localViewMode;

  const setSelectedTaskId = isTabMode
    ? (id: number | null) => tabState.setState({ selectedTaskId: id })
    : setLocalSelectedTaskId;
  const setViewMode = isTabMode
    ? (mode: 'all' | 'pending' | 'completed') => tabState.setState({ viewMode: mode })
    : setLocalViewMode;

  const [tasks, setTasks] = useState<ReceiveTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<ReceiveTask | null>(null);
  const [editorInfo, setEditorInfo] = useState<EditorInfo | null>(null);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get<ReceiveTask[]>('/samples/receive-tasks');
      setTasks(response.data);
    } catch (error: any) {
      if (error?.response?.status !== 401 && !error?.isAuthError) {
        toast.error('加载接收任务失败');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const filteredTasks = tasks.filter(task => {
    if (viewMode === 'all') return true;
    if (viewMode === 'pending') return task.status === 'pending' || task.status === 'in_progress';
    if (viewMode === 'completed') return task.status === 'completed';
    return true;
  });

  const handleEditClick = (task: ReceiveTask) => {
    setTaskToEdit(task);
    setVerificationDialogOpen(true);
  };

  const handleEditorVerified = (info: EditorInfo) => {
    setEditorInfo(info);
    setVerificationDialogOpen(false);
    setEditDialogOpen(true);
  };

  const handleEditComplete = () => {
    setEditDialogOpen(false);
    setTaskToEdit(null);
    setEditorInfo(null);
    fetchTasks();
    toast.success('接收记录更新成功');
  };

  const handleEditCancel = () => {
    setEditDialogOpen(false);
    setTaskToEdit(null);
    setEditorInfo(null);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const content = (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Heading level={2}>清点入库</Heading>
        <Text className="text-zinc-600 mt-1">
          对已接收的样本进行清点确认和入库管理
        </Text>
      </div>

      {/* 视图模式切换 */}
      <div className="mb-4 flex gap-2">
        {viewMode === 'all' ? (
          <Button color="blue" onClick={() => setViewMode('all')}>
            全部 ({tasks.length})
          </Button>
        ) : (
          <Button plain onClick={() => setViewMode('all')}>
            全部 ({tasks.length})
          </Button>
        )}
        {viewMode === 'pending' ? (
          <Button color="blue" onClick={() => setViewMode('pending')}>
            待清点 ({tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length})
          </Button>
        ) : (
          <Button plain onClick={() => setViewMode('pending')}>
            待清点 ({tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length})
          </Button>
        )}
        {viewMode === 'completed' ? (
          <Button color="blue" onClick={() => setViewMode('completed')}>
            已完成 ({tasks.filter(t => t.status === 'completed').length})
          </Button>
        ) : (
          <Button plain onClick={() => setViewMode('completed')}>
            已完成 ({tasks.filter(t => t.status === 'completed').length})
          </Button>
        )}
      </div>

      {/* 任务列表 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-xl shadow-lg overflow-hidden"
      >
        <div className="overflow-x-auto">
          <Table bleed={true} striped>
            <TableHead>
              <TableRow>
                <TableHeader className="pl-6">项目编号</TableHeader>
                <TableHeader>临床机构</TableHeader>
                <TableHeader>运输单位</TableHeader>
                <TableHeader>运输方式</TableHeader>
                <TableHeader>温度记录仪</TableHeader>
                <TableHeader>样本数量</TableHeader>
                <TableHeader>样本状态</TableHeader>
                <TableHeader>接收人</TableHeader>
                <TableHeader>接收时间</TableHeader>
                <TableHeader>清点状态</TableHeader>
                <TableHeader className="pr-6">操作</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              <AnimatePresence>
                {isLoading ? (
                  <AnimatedLoadingState
                    key="loading"
                    colSpan={11}
                    variant="skeleton"
                  />
                ) : filteredTasks.length === 0 ? (
                  <AnimatedEmptyState
                    key="empty"
                    colSpan={11}
                    icon={ClipboardDocumentListIcon}
                    text={viewMode === 'pending' ? '暂无待清点任务' : '暂无接收记录'}
                  />
                ) : (
                  filteredTasks.map((task, index) => (
                    <AnimatedTableRow key={task.id} index={index}>
                      <TableCell className="font-medium pl-6">{task.project_name}</TableCell>
                      <TableCell>{task.clinical_site}</TableCell>
                      <TableCell>{task.transport_company}</TableCell>
                      <TableCell>{task.transport_method}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {task.temperature_monitor_id}
                          {task.is_over_temperature && (
                            <ExclamationTriangleIcon className="h-4 w-4 text-red-500" title="存在超温情况" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{task.sample_count}</TableCell>
                      <TableCell>{task.sample_status}</TableCell>
                      <TableCell>{task.received_by}</TableCell>
                      <TableCell>{formatDate(task.received_at)}</TableCell>
                      <TableCell>
                        <Badge color={statusColors[task.status] || 'zinc'}>
                          <span className="flex items-center gap-1">
                            {task.status === 'pending' && <ClockIcon className="h-3 w-3" />}
                            {task.status === 'in_progress' && <ClipboardDocumentListIcon className="h-3 w-3" />}
                            {task.status === 'completed' && <CheckCircleIcon className="h-3 w-3" />}
                            {statusLabels[task.status] || task.status}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-6">
                        <div className="flex items-center gap-2">
                          <Button
                            plain
                            onClick={() => handleEditClick(task)}
                            title="编辑"
                          >
                            <PencilSquareIcon className="h-4 w-4 text-blue-600" />
                          </Button>
                          {task.status !== 'completed' && (
                            <Button
                              color="blue"
                              onClick={() => {
                                window.location.href = `/samples/inventory/${task.id}`;
                              }}
                            >
                              清点
                            </Button>
                          )}
                          {task.status === 'completed' && (
                            <Button
                              plain
                              onClick={() => {
                                window.location.href = `/samples/inventory/${task.id}`;
                              }}
                              title="查看详情"
                            >
                              <EyeIcon className="h-4 w-4 text-zinc-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </AnimatedTableRow>
                  ))
                )}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      </motion.div>

      {/* 编辑者验证对话框 */}
      <EditorVerificationDialog
        open={verificationDialogOpen}
        onClose={() => {
          setVerificationDialogOpen(false);
          setTaskToEdit(null);
        }}
        onVerified={handleEditorVerified}
      />

      {/* 编辑对话框 */}
      {taskToEdit && editorInfo && (
        <ReceiveRecordEditDialog
          open={editDialogOpen}
          onClose={handleEditCancel}
          onSave={handleEditComplete}
          task={taskToEdit}
          editorInfo={editorInfo}
        />
      )}
    </div>
  );

  if (isTabMode) {
    return content;
  }

  return <AppLayout>{content}</AppLayout>;
}
