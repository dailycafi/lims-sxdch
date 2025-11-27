import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Heading } from '@/components/heading';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { useAuthStore } from '@/store/auth';
import { 
  PlusIcon, 
  UserIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/20/solid';
import { AnimatedLoadingState, AnimatedEmptyState, AnimatedTableRow } from '@/components/animated-table';
import { UsersService } from '@/services/users.service';
import { User } from '@/types/api';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const { user: currentUser } = useAuthStore();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch all users (limit can be increased or pagination added later)
      const fetchedUsers = await UsersService.getUsers({ limit: 1000 });
      setUsers(fetchedUsers);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const config: Record<string, { color: 'zinc' | 'red' | 'orange' | 'green' | 'blue' | 'purple' | 'cyan' | 'teal' | 'lime' | 'pink', text: string }> = {
      system_admin: { color: 'purple', text: '系统管理员' },
      sample_admin: { color: 'blue', text: '样本管理员' },
      lab_director: { color: 'red', text: '实验室主任' },
      test_manager: { color: 'orange', text: '检验科主任' },
      qa: { color: 'pink', text: '质量管理员' },
      project_lead: { color: 'green', text: '项目负责人' },
      analyst: { color: 'cyan', text: '分析员' },
    };
    
    const { color, text } = config[role] || { color: 'zinc', text: role };
    return <Badge color={color}>{text}</Badge>;
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? 
      <Badge color="green">启用</Badge> : 
      <Badge color="zinc">禁用</Badge>;
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        user.username.toLowerCase().includes(query) || 
        user.full_name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query);
        
      if (!matchesSearch) return false;
    }
    
    // Role filter
    if (roleFilter !== 'all' && user.role !== roleFilter) {
      return false;
    }
    
    return true;
  });

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Heading>用户管理</Heading>
            <Text className="mt-1 text-zinc-600">管理系统用户及其权限</Text>
          </div>
          {currentUser && (currentUser.role === 'system_admin') && (
            <Button>
              <PlusIcon className="h-4 w-4" />
              新建用户
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="搜索用户名、姓名或邮箱..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            
            <div className="w-full sm:w-48">
              <Select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full"
              >
                <option value="all">所有角色</option>
                <option value="system_admin">系统管理员</option>
                <option value="sample_admin">样本管理员</option>
                <option value="lab_director">实验室主任</option>
                <option value="test_manager">检验科主任</option>
                <option value="qa">质量管理员</option>
                <option value="project_lead">项目负责人</option>
                <option value="analyst">分析员</option>
              </Select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <Table bleed={true} striped>
            <TableHead>
              <TableRow>
                <TableHeader className="pl-6">用户</TableHeader>
                <TableHeader>角色</TableHeader>
                <TableHeader>邮箱</TableHeader>
                <TableHeader>状态</TableHeader>
                <TableHeader>创建时间</TableHeader>
                <TableHeader className="text-right pr-6">操作</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <AnimatedLoadingState colSpan={6} variant="skeleton" />
              ) : filteredUsers.length === 0 ? (
                <AnimatedEmptyState colSpan={6} text="暂无用户数据" />
              ) : (
                <AnimatePresence>
                  {filteredUsers.map((user, index) => (
                    <AnimatedTableRow key={user.id} index={index}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100">
                            <UserIcon className="h-4 w-4 text-zinc-500" />
                          </div>
                          <div>
                            <div className="font-medium text-zinc-900">{user.full_name}</div>
                            <div className="text-xs text-zinc-500">@{user.username}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell className="text-zinc-500">{user.email}</TableCell>
                      <TableCell>{getStatusBadge(user.is_active)}</TableCell>
                      <TableCell className="text-zinc-500">
                        {new Date(user.created_at).toLocaleDateString('zh-CN')}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button plain>编辑</Button>
                      </TableCell>
                    </AnimatedTableRow>
                  ))}
                </AnimatePresence>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}

