import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Heading } from '@/components/heading';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/dialog';
import { api } from '@/lib/api';
import { 
  DocumentMagnifyingGlassIcon,
  ShieldCheckIcon,
  CalendarIcon,
  UserIcon,
  LockClosedIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/20/solid';
import { AnimatedLoadingState, AnimatedEmptyState, AnimatedTableRow } from '@/components/animated-table';
import { AnimatePresence } from 'framer-motion';

interface AuditLog {
  id: number;
  user: {
    full_name: string;
    username: string;
    role: string;
  };
  entity_type: string;
  entity_id: number;
  action: string;
  details: any;
  reason?: string;
  timestamp: string;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    entity_type: '',
    action: '',
    user_id: '',
    start_date: '',
    end_date: '',
    entity_id: ''
  });
  const [users, setUsers] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    fetchLogs();
    fetchUsers();
  }, [filters, currentPage]);

  const fetchLogs = async () => {
    try {
      // 过滤掉空值参数
      const cleanedFilters = Object.entries(filters).reduce((acc, [key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      const params = {
        ...cleanedFilters,
        skip: (currentPage - 1) * pageSize,
        limit: pageSize
      };

      const response = await api.get('/audit/logs', { params });
      setLogs(response.data.items);
      setTotalCount(response.data.total);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
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

  const handleExport = async () => {
    try {
      // 过滤掉空值参数
      const cleanedFilters = Object.entries(filters).reduce((acc, [key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      const response = await api.get('/audit/export', {
        params: cleanedFilters,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export audit logs:', error);
    }
  };

  const getEntityTypeBadge = (type: string) => {
    const typeMap: { [key: string]: { label: string; color: string } } = {
      'project': { label: '项目', color: 'blue' },
      'sample': { label: '样本', color: 'green' },
      'sample_receive': { label: '样本接收', color: 'cyan' },
      'sample_inventory': { label: '样本入库', color: 'purple' },
      'sample_borrow': { label: '样本领用', color: 'amber' },
      'sample_return': { label: '样本归还', color: 'lime' },
      'sample_transfer': { label: '样本转移', color: 'orange' },
      'sample_destroy': { label: '样本销毁', color: 'red' },
      'deviation': { label: '偏差', color: 'pink' },
      'organization': { label: '组织', color: 'indigo' },
      'sample_type': { label: '样本类型', color: 'violet' },
      'user': { label: '用户', color: 'zinc' }
    };
    
    const config = typeMap[type] || { label: type, color: 'zinc' };
    return <Badge color={config.color as any}>{config.label}</Badge>;
  };

  const getActionBadge = (action: string) => {
    const actionMap: { [key: string]: { label: string; color: string } } = {
      'create': { label: '创建', color: 'green' },
      'update': { label: '更新', color: 'blue' },
      'delete': { label: '删除', color: 'red' },
      'approve': { label: '批准', color: 'purple' },
      'reject': { label: '拒绝', color: 'orange' },
      'execute': { label: '执行', color: 'cyan' },
      'complete': { label: '完成', color: 'lime' },
      'login': { label: '登录', color: 'indigo' },
      'logout': { label: '登出', color: 'zinc' }
    };
    
    const config = actionMap[action] || { label: action, color: 'zinc' };
    return <Badge color={config.color as any}>{config.label}</Badge>;
  };

  const formatDetails = (details: any) => {
    if (!details) return '-';
    if (typeof details === 'string') return details;
    
    // 提取关键信息
    const keys = Object.keys(details).slice(0, 3);
    const summary = keys.map(key => `${key}: ${details[key]}`).join(', ');
    
    return summary.length > 50 ? summary.substring(0, 50) + '...' : summary;
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading>审计日志</Heading>
            <Text className="mt-1 text-zinc-600">查看系统所有操作记录，记录不可删除</Text>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-3 py-1.5 bg-red-100 rounded-lg">
              <LockClosedIcon className="h-4 w-4 text-red-600" />
              <Text className="text-sm font-medium text-red-700">记录永久保存</Text>
            </div>
            <Button onClick={handleExport}>
              <ArrowDownTrayIcon />
              导出日志
            </Button>
          </div>
        </div>

        {/* 筛选条件 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                实体类型
              </label>
              <Select
                value={filters.entity_type}
                onChange={(e) => setFilters({...filters, entity_type: e.target.value})}
              >
                <option value="">全部类型</option>
                <option value="project">项目</option>
                <option value="sample">样本</option>
                <option value="sample_receive">样本接收</option>
                <option value="sample_inventory">样本入库</option>
                <option value="sample_borrow">样本领用</option>
                <option value="sample_transfer">样本转移</option>
                <option value="sample_destroy">样本销毁</option>
                <option value="deviation">偏差</option>
                <option value="organization">组织</option>
                <option value="user">用户</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                操作类型
              </label>
              <Select
                value={filters.action}
                onChange={(e) => setFilters({...filters, action: e.target.value})}
              >
                <option value="">全部操作</option>
                <option value="create">创建</option>
                <option value="update">更新</option>
                <option value="delete">删除</option>
                <option value="approve">批准</option>
                <option value="reject">拒绝</option>
                <option value="execute">执行</option>
                <option value="complete">完成</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                操作人
              </label>
              <Select
                value={filters.user_id}
                onChange={(e) => setFilters({...filters, user_id: e.target.value})}
              >
                <option value="">全部用户</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} ({user.username})
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                开始时间
              </label>
              <Input
                type="datetime-local"
                value={filters.start_date}
                onChange={(e) => setFilters({...filters, start_date: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                结束时间
              </label>
              <Input
                type="datetime-local"
                value={filters.end_date}
                onChange={(e) => setFilters({...filters, end_date: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                实体ID
              </label>
              <Input
                value={filters.entity_id}
                onChange={(e) => setFilters({...filters, entity_id: e.target.value})}
                placeholder="输入实体ID"
              />
            </div>
          </div>
        </div>

        {/* 日志列表 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>ID</TableHeader>
                <TableHeader>时间</TableHeader>
                <TableHeader>操作人</TableHeader>
                <TableHeader>实体类型</TableHeader>
                <TableHeader>实体ID</TableHeader>
                <TableHeader>操作</TableHeader>
                <TableHeader>详情</TableHeader>
                <TableHeader>原因</TableHeader>
                <TableHeader>查看</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <AnimatedLoadingState colSpan={9} variant="skeleton" />
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <Text>暂无日志记录</Text>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-sm">{log.id}</TableCell>
                    <TableCell className="text-zinc-600 text-sm">
                      {new Date(log.timestamp).toLocaleString('zh-CN')}
                    </TableCell>
                    <TableCell>
                      <div>
                        <Text className="font-medium">{log.user.full_name}</Text>
                        <Text className="text-xs text-zinc-500">{log.user.role}</Text>
                      </div>
                    </TableCell>
                    <TableCell>{getEntityTypeBadge(log.entity_type)}</TableCell>
                    <TableCell className="font-mono">{log.entity_id}</TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm">
                      {formatDetails(log.details)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm">
                      {log.reason || '-'}
                    </TableCell>
                    <TableCell>
                      <Button 
                        plain
                        onClick={() => {
                          setSelectedLog(log);
                          setIsDetailDialogOpen(true);
                        }}
                      >
                        <DocumentMagnifyingGlassIcon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t">
              <Text className="text-sm text-zinc-600">
                共 {totalCount} 条记录，第 {currentPage} / {totalPages} 页
              </Text>
              <div className="flex gap-2">
                <Button
                  plain
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  上一页
                </Button>
                <Button
                  plain
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 安全提示 */}
        <div className="mt-6 p-4 bg-amber-50 rounded-lg">
          <div className="flex items-start gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <Text className="font-medium text-amber-900">审计追踪安全说明</Text>
              <Text className="text-sm text-amber-700 mt-1">
                所有审计日志记录都是不可变的，一旦生成就无法修改或删除。这确保了系统操作的完整追溯性，符合GMP和数据完整性要求。
              </Text>
            </div>
          </div>
        </div>
      </div>

      {/* 详情对话框 */}
      <Dialog open={isDetailDialogOpen} onClose={setIsDetailDialogOpen} size="lg">
        <DialogTitle>审计日志详情</DialogTitle>
        <DialogBody>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Text className="text-sm text-zinc-600">日志ID</Text>
                  <Text className="font-mono">{selectedLog.id}</Text>
                </div>
                <div>
                  <Text className="text-sm text-zinc-600">时间戳</Text>
                  <Text>{new Date(selectedLog.timestamp).toLocaleString('zh-CN')}</Text>
                </div>
                <div>
                  <Text className="text-sm text-zinc-600">操作人</Text>
                  <Text>{selectedLog.user.full_name} ({selectedLog.user.username})</Text>
                </div>
                <div>
                  <Text className="text-sm text-zinc-600">用户角色</Text>
                  <Text>{selectedLog.user.role}</Text>
                </div>
                <div>
                  <Text className="text-sm text-zinc-600">实体类型</Text>
                  {getEntityTypeBadge(selectedLog.entity_type)}
                </div>
                <div>
                  <Text className="text-sm text-zinc-600">实体ID</Text>
                  <Text className="font-mono">{selectedLog.entity_id}</Text>
                </div>
                <div>
                  <Text className="text-sm text-zinc-600">操作类型</Text>
                  {getActionBadge(selectedLog.action)}
                </div>
              </div>

              {selectedLog.reason && (
                <div>
                  <Text className="text-sm text-zinc-600 mb-1">操作原因</Text>
                  <div className="p-3 bg-zinc-50 rounded-lg">
                    <Text>{selectedLog.reason}</Text>
                  </div>
                </div>
              )}

              <div>
                <Text className="text-sm text-zinc-600 mb-1">操作详情</Text>
                <div className="p-3 bg-zinc-50 rounded-lg">
                  <pre className="text-sm whitespace-pre-wrap">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
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
