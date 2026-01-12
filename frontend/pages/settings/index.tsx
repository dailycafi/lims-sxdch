import { useEffect, useMemo, useState } from 'react';
import { formatDate } from '@/lib/date-utils';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input, InputGroup } from '@/components/input';
import { Select } from '@/components/select';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { UserDialog } from '@/components/user-dialog';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Field, Label } from '@/components/fieldset';
import { Textarea } from '@/components/textarea';
import { Checkbox, CheckboxField } from '@/components/checkbox';
import { Switch, SwitchField } from '@/components/switch';
import { useAuthStore } from '@/store/auth';
import { Tabs } from '@/components/tabs';
import { toast } from 'react-hot-toast';
import { 
  PlusIcon, 
  UserIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  KeyIcon,
  UserGroupIcon,
  TrashIcon,
  Cog6ToothIcon
} from '@heroicons/react/20/solid';
import { AnimatedLoadingState, AnimatedEmptyState, AnimatedTableRow } from '@/components/animated-table';
import { UsersService } from '@/services/users.service';
import { RolesService } from '@/services/roles.service';
import { SettingsService, SystemSetting } from '@/services/settings.service';
import { User, Role, Permission, RoleCreate, RoleUpdate } from '@/types/api';
import { extractDetailMessage } from '@/lib/api';

export default function SettingsPage() {
  // 标签页状态
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'system'>('system');
  
  // 系统设置相关状态
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [sessionTimeoutDraft, setSessionTimeoutDraft] = useState<string>('30');

  // 用户相关状态
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const { user: currentUser } = useAuthStore();

  // 用户对话框状态
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // 角色相关状态
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  
  // 角色对话框状态
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleDialogLoading, setRoleDialogLoading] = useState(false);
  const [roleDialogError, setRoleDialogError] = useState('');
  
  // 角色表单状态
  const [roleFormData, setRoleFormData] = useState<{
    name: string;
    description: string;
    permission_ids: number[];
  }>({
    name: '',
    description: '',
    permission_ids: []
  });

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
      // 同时加载角色列表以便角色筛选器显示最新的角色
      fetchRolesForFilter();
    } else if (activeTab === 'roles') {
      fetchRolesData();
    } else if (activeTab === 'system') {
      fetchSettings();
    }
  }, [activeTab]);

  // 为用户标签页的角色筛选器加载角色列表
  const fetchRolesForFilter = async () => {
    try {
      const fetchedRoles = await RolesService.getRoles({ include_inactive: false });
      setRoles(fetchedRoles);
    } catch (error) {
      console.error('加载角色列表失败:', error);
    }
  };

  const sessionTimeoutValue = useMemo(() => {
    const v = settings.find((s) => s.key === 'session_timeout')?.value;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 30;
  }, [settings]);

  const passwordComplexityEnabled = useMemo(() => {
    const v = settings.find((s) => s.key === 'password_complexity_enabled')?.value;
    if (v === undefined || v === null) return true;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return v !== '0' && v.toLowerCase() !== 'false';
    return Boolean(v);
  }, [settings]);

  useEffect(() => {
    // 同步输入框初始值（不在每次输入时回写，避免打断用户输入）
    if (activeTab !== 'system') return;
    setSessionTimeoutDraft(String(sessionTimeoutValue));
  }, [activeTab, sessionTimeoutValue]);

  // 系统设置加载
  const fetchSettings = async () => {
    setSettingsLoading(true);
    try {
      const fetchedSettings = await SettingsService.getSettings();
      setSettings(fetchedSettings);
    } catch (error) {
      console.error('加载系统设置失败:', error);
      toast.error('加载系统设置失败');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleUpdateSetting = async (key: string, value: any) => {
    setSavingSettings(true);
    try {
      await SettingsService.updateSetting(key, value);
      toast.success('设置已更新');
      fetchSettings();
    } catch (error) {
      console.error('更新设置失败:', error);
      toast.error('更新设置失败');
    } finally {
      setSavingSettings(false);
    }
  };

  const commitSessionTimeout = async () => {
    const n = Number(sessionTimeoutDraft);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error('请输入有效的自动登出时间（分钟）');
      setSessionTimeoutDraft(String(sessionTimeoutValue));
      return;
    }
    if (n === sessionTimeoutValue) return;
    await handleUpdateSetting('session_timeout', Math.floor(n));
  };

  // 用户数据加载
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const fetchedUsers = await UsersService.getUsers({ limit: 1000 });
      setUsers(fetchedUsers);
    } catch (error) {
      console.error('加载用户列表失败:', error);
    } finally {
      setUsersLoading(false);
    }
  };
  
  // 角色数据加载
  const fetchRolesData = async () => {
    setRolesLoading(true);
    try {
      const [fetchedRoles, fetchedPermissions, fetchedModules] = await Promise.all([
        RolesService.getRoles({ include_inactive: true }),
        RolesService.getPermissions(),
        RolesService.getPermissionModules()
      ]);
      setRoles(fetchedRoles);
      setPermissions(fetchedPermissions);
      setModules(fetchedModules);
    } catch (error) {
      console.error('加载角色数据失败:', error);
    } finally {
      setRolesLoading(false);
    }
  };

  // 用户操作
  const handleCreateUser = () => {
    setEditingUser(null);
    setUserDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setUserDialogOpen(true);
  };

  const handleUserDialogSuccess = () => {
    fetchUsers();
  };

  const handleResetPassword = async (user: User) => {
    const newPassword = prompt(`为用户 ${user.username} 设置新密码：`);
    if (!newPassword) return;

    try {
      await UsersService.resetPassword(user.id, newPassword);
      toast.success('密码重置成功');
    } catch (error: any) {
      const errorMsg = extractDetailMessage(error.response?.data) || error.message || '重置密码失败';
      toast.error(errorMsg);
    }
  };
  
  // 角色操作
  const handleCreateRole = () => {
    setEditingRole(null);
    setRoleFormData({
      name: '',
      description: '',
      permission_ids: []
    });
    setRoleDialogError('');
    setRoleDialogOpen(true);
  };

  const handleEditRole = async (role: Role) => {
    try {
      const fullRole = await RolesService.getRole(role.id);
      setEditingRole(fullRole);
      setRoleFormData({
        name: fullRole.name,
        description: fullRole.description || '',
        permission_ids: fullRole.permissions?.map(p => p.id) || []
      });
      setRoleDialogError('');
      setRoleDialogOpen(true);
    } catch (error) {
      console.error('加载角色详情失败:', error);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (!confirm(`确定要删除角色"${role.name}"吗？\n\n系统会检查是否有用户正在使用此角色。`)) {
      return;
    }

    try {
      await RolesService.deleteRole(role.id);
      await fetchRolesData();
      toast.success('角色删除成功');
    } catch (error: any) {
      const errorMsg = extractDetailMessage(error.response?.data) || error.message || '删除失败';
      toast.error(errorMsg);
    }
  };

  const handleRoleSubmit = async () => {
    setRoleDialogError('');

    if (!roleFormData.name.trim()) {
      setRoleDialogError('请输入角色名称');
      return;
    }

    setRoleDialogLoading(true);
    try {
      if (editingRole) {
        const updateData: RoleUpdate = {
          name: roleFormData.name,
          description: roleFormData.description,
          permission_ids: roleFormData.permission_ids
        };
        await RolesService.updateRole(editingRole.id, updateData);
      } else {
        const createData: RoleCreate = {
          name: roleFormData.name,
          description: roleFormData.description,
          permission_ids: roleFormData.permission_ids
        };
        await RolesService.createRole(createData);
      }
      
      setRoleDialogOpen(false);
      await fetchRolesData();
    } catch (err: any) {
      const errorMsg = extractDetailMessage(err.response?.data) || err.message || '操作失败';
      setRoleDialogError(errorMsg);
    } finally {
      setRoleDialogLoading(false);
    }
  };

  const togglePermission = (permId: number) => {
    setRoleFormData(prev => {
      const newPermIds = prev.permission_ids.includes(permId)
        ? prev.permission_ids.filter(id => id !== permId)
        : [...prev.permission_ids, permId];
      return { ...prev, permission_ids: newPermIds };
    });
  };

  const toggleModule = (module: string) => {
    const modulePerms = permissions.filter(p => p.module === module).map(p => p.id);
    const allSelected = modulePerms.every(id => roleFormData.permission_ids.includes(id));
    
    setRoleFormData(prev => {
      let newPermIds = [...prev.permission_ids];
      if (allSelected) {
        newPermIds = newPermIds.filter(id => !modulePerms.includes(id));
      } else {
        modulePerms.forEach(id => {
          if (!newPermIds.includes(id)) {
            newPermIds.push(id);
          }
        });
      }
      return { ...prev, permission_ids: newPermIds };
    });
  };
  
  // 模块名称中英文映射
  const getModuleName = (module: string): string => {
    const moduleNameMap: Record<string, string> = {
      'user': '用户管理',
      'role': '角色管理',
      'sample': '样本管理',
      'project': '项目管理',
      'storage': '存储管理',
      'global_params': '全局参数',
      'deviation': '偏差管理',
      'audit': '审计日志',
      'statistics': '统计查询'
    };
    return moduleNameMap[module] || module;
  };

  const getRoleBadges = (user: User) => {
    if (user.roles && user.roles.length > 0) {
      return user.roles.map((role) => (
        <Badge key={role.id} color="purple" className="mr-1">
          {role.name}
        </Badge>
      ));
    }
    return getRoleBadge(user.role);
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

  // 用户筛选
  const filteredUsers = users.filter(user => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        user.username.toLowerCase().includes(query) || 
        user.full_name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query);
        
      if (!matchesSearch) return false;
    }
    
    if (roleFilter !== 'all') {
      const hasRole = user.roles?.some(r => r.code === roleFilter) || user.role === roleFilter;
      if (!hasRole) return false;
    }
    
    return true;
  });
  
  const filteredRoles = roles;

  const isAdmin = currentUser?.is_superuser || currentUser?.roles?.some(r => r.code === 'system_admin');
  
  const canManageRoles = currentUser?.is_superuser || 
    currentUser?.roles?.some(r => r.code === 'system_admin' || r.code === 'lab_director');

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 标签页导航 */}
        <div className="mb-8">
          <Tabs
            tabs={[
              { key: 'system', label: '系统参数', icon: Cog6ToothIcon },
              { key: 'users', label: '用户管理', icon: UserIcon },
              { key: 'roles', label: '角色管理', icon: UserGroupIcon },
            ]}
            activeTab={activeTab}
            onChange={(key) => setActiveTab(key as any)}
            fullWidth
          />
        </div>

        {/* 系统设置标签页 */}
        {activeTab === 'system' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
              <div className="p-6 space-y-8">
                {/* 自动登出时间 */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="max-w-xl">
                    <Text className="font-semibold text-zinc-900">自动登出时间</Text>
                    <Text className="text-sm text-zinc-500 mt-1">用户无操作超过设定时间后将自动退出登录</Text>
                  </div>
                  <div className="w-full sm:w-48 flex-shrink-0">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={sessionTimeoutDraft}
                      onChange={(e) => setSessionTimeoutDraft(e.target.value)}
                      onBlur={commitSessionTimeout}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitSessionTimeout();
                        }
                      }}
                      disabled={savingSettings}
                      className="bg-zinc-50 border-zinc-200 h-11 focus:bg-white transition-all"
                      placeholder="分钟"
                    />
                  </div>
                </div>

                <div className="border-t border-zinc-100 my-6"></div>

                {/* 密码复杂度 */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="max-w-xl">
                    <Text className="font-semibold text-zinc-900">强密码要求</Text>
                    <Text className="text-sm text-zinc-500 mt-1">开启后密码必须包含大小写字母、数字和特殊字符，长度至少8位</Text>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Text className="text-sm text-zinc-600 whitespace-nowrap">
                      {passwordComplexityEnabled ? '已开启' : '已关闭'}
                    </Text>
                    <Switch
                      checked={passwordComplexityEnabled}
                      onChange={(checked) => handleUpdateSetting('password_complexity_enabled', Boolean(checked))}
                      disabled={savingSettings}
                      color="blue"
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 用户标签页内容 */}
        {activeTab === 'users' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Actions */}
            {isAdmin && (
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={handleCreateUser}
                    className="shadow-sm bg-blue-600 hover:bg-blue-700 text-white border-none h-11 px-5"
                  >
                    <PlusIcon className="h-5 w-5 mr-1" />
                    新建用户
                  </Button>
                </motion.div>
              </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 mb-6 p-5">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <InputGroup>
                    <MagnifyingGlassIcon />
                    <Input
                      type="text"
                      placeholder="搜索用户名、姓名或邮箱..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-zinc-50 border-zinc-200 h-11 focus:bg-white transition-all"
                    />
                  </InputGroup>
                </div>
                
                <div className="w-full md:w-56">
                  <Select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="w-full bg-zinc-50 border-zinc-200 h-11 focus:bg-white transition-all"
                  >
                    <option value="all">所有角色</option>
                    {roles.filter(r => r.is_active).map(role => (
                      <option key={role.id} value={role.code}>
                        {role.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
              <Table bleed={true} striped>
                <TableHead className="bg-zinc-50/50">
                  <TableRow>
                    <TableHeader className="pl-6 py-4 text-zinc-600 font-semibold">用户</TableHeader>
                    <TableHeader className="py-4 text-zinc-600 font-semibold">角色</TableHeader>
                    <TableHeader className="py-4 text-zinc-600 font-semibold">邮箱</TableHeader>
                    <TableHeader className="py-4 text-zinc-600 font-semibold">状态</TableHeader>
                    <TableHeader className="py-4 text-zinc-600 font-semibold">创建时间</TableHeader>
                    <TableHeader className="text-right pr-6 py-4 text-zinc-600 font-semibold">操作</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {usersLoading ? (
                    <AnimatedLoadingState colSpan={6} variant="lottie" />
                  ) : filteredUsers.length === 0 ? (
                    <AnimatedEmptyState colSpan={6} text="暂无用户数据" />
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {filteredUsers.map((user, index) => (
                        <AnimatedTableRow key={user.id} index={index}>
                          <TableCell className="pl-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 border border-zinc-200 shadow-sm">
                                <UserIcon className="h-5 w-5 text-zinc-500" />
                              </div>
                              <div>
                                <div className="font-semibold text-zinc-900">{user.full_name}</div>
                                <div className="text-xs text-zinc-500 font-medium">@{user.username}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex flex-wrap gap-1.5">
                              {getRoleBadges(user)}
                            </div>
                          </TableCell>
                          <TableCell className="text-zinc-600 py-4 font-medium">{user.email}</TableCell>
                          <TableCell className="py-4">{getStatusBadge(user.is_active)}</TableCell>
                          <TableCell className="text-zinc-500 py-4 font-medium">
                            {formatDate(user.created_at)}
                          </TableCell>
                          <TableCell className="text-right pr-6 py-4">
                            <div className="flex justify-end gap-1">
                              {isAdmin && (
                                <>
                                  <Button plain onClick={() => handleEditUser(user)} className="text-zinc-600 hover:text-blue-600 hover:bg-blue-50">
                                    <PencilIcon className="h-4 w-4" />
                                    编辑
                                  </Button>
                                  <Button plain onClick={() => handleResetPassword(user)} className="text-zinc-600 hover:text-orange-600 hover:bg-orange-50">
                                    <KeyIcon className="h-4 w-4" />
                                    重置密码
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </AnimatedTableRow>
                      ))}
                    </AnimatePresence>
                  )}
                </TableBody>
              </Table>
            </div>
          </motion.div>
        )}

        {/* 角色标签页内容 */}
        {activeTab === 'roles' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Actions */}
            {canManageRoles && (
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={handleCreateRole}
                    className="shadow-sm bg-blue-600 hover:bg-blue-700 text-white border-none h-11 px-5"
                  >
                    <PlusIcon className="h-5 w-5 mr-1" />
                    新建角色
                  </Button>
                </motion.div>
              </div>
            )}

            {/* Roles Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
              <Table bleed={true} striped>
                <TableHead className="bg-zinc-50/50">
                  <TableRow>
                    <TableHeader className="pl-6 py-4 text-zinc-600 font-semibold">角色名称</TableHeader>
                    <TableHeader className="py-4 text-zinc-600 font-semibold">描述</TableHeader>
                    <TableHeader className="py-4 text-zinc-600 font-semibold">权限数量</TableHeader>
                    <TableHeader className="py-4 text-zinc-600 font-semibold">创建时间</TableHeader>
                    <TableHeader className="text-right pr-6 py-4 text-zinc-600 font-semibold">操作</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rolesLoading ? (
                    <AnimatedLoadingState colSpan={5} variant="lottie" />
                  ) : filteredRoles.length === 0 ? (
                    <AnimatedEmptyState colSpan={5} text="暂无角色数据，请点击右上角新建角色" />
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {filteredRoles.map((role, index) => (
                        <AnimatedTableRow key={role.id} index={index}>
                          <TableCell className="pl-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 border border-blue-100 shadow-sm text-blue-600">
                                <UserGroupIcon className="h-5 w-5" />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-zinc-900">{role.name}</span>
                                {role.is_system && (
                                  <Badge color="blue" title="系统预设角色，不可删除" className="font-medium">预设</Badge>
                                )}
                                {!role.is_active && (
                                  <Badge color="zinc" className="font-medium">已禁用</Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-zinc-600 py-4">
                            {role.description || <span className="text-zinc-400 italic">暂无描述</span>}
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge color="blue" className="bg-blue-50 text-blue-700 border-blue-100">{role.permission_count || 0} 个权限</Badge>
                          </TableCell>
                          <TableCell className="text-zinc-500 py-4 font-medium">
                            {formatDate(role.created_at)}
                          </TableCell>
                          <TableCell className="text-right pr-6 py-4">
                            <div className="flex justify-end gap-1">
                              {canManageRoles && (
                                <>
                                  <Button plain onClick={() => handleEditRole(role)} className="text-zinc-600 hover:text-blue-600 hover:bg-blue-50">
                                    <PencilIcon className="h-4 w-4" />
                                    编辑
                                  </Button>
                                  {!role.is_system && (
                                    <Button plain onClick={() => handleDeleteRole(role)} className="text-zinc-600 hover:text-red-600 hover:bg-red-50">
                                      <TrashIcon className="h-4 w-4" />
                                      删除
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                        </AnimatedTableRow>
                      ))}
                    </AnimatePresence>
                  )}
                </TableBody>
              </Table>
            </div>
          </motion.div>
        )}
      </div>

      {/* 用户对话框 */}
      <UserDialog
        open={userDialogOpen}
        onClose={() => setUserDialogOpen(false)}
        onSuccess={handleUserDialogSuccess}
        user={editingUser}
      />

      {/* 角色对话框 */}
      <Dialog open={roleDialogOpen} onClose={() => setRoleDialogOpen(false)} size="4xl">
        <DialogTitle>{editingRole ? '编辑角色' : '新建角色'}</DialogTitle>
        <DialogDescription>
          {editingRole ? '修改角色信息和权限配置' : '创建新角色并配置权限'}
        </DialogDescription>

        <DialogBody className="space-y-4">
          {roleDialogError && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <Text className="text-sm text-red-800">{roleDialogError}</Text>
            </div>
          )}

          {editingRole && (
            <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500">角色标识：</span>
                <code className="text-zinc-900 font-mono bg-white px-2 py-0.5 rounded border border-zinc-300">
                  {editingRole.code}
                </code>
                <span className="text-zinc-400 text-xs ml-2">（系统自动生成，不可修改）</span>
              </div>
            </div>
          )}

          <Field>
            <Label>角色名称 *</Label>
            <Input
              value={roleFormData.name}
              onChange={(e) => setRoleFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="例如：自定义分析员"
            />
          </Field>

          <Field>
            <Label>角色描述</Label>
            <Textarea
              value={roleFormData.description}
              onChange={(e) => setRoleFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="简要说明该角色的职责和用途"
              rows={2}
            />
          </Field>

          <Field>
            <Label>权限配置</Label>
            <div className="max-h-96 overflow-y-auto border border-zinc-200 rounded-lg p-4 space-y-4">
              {modules.map((module) => {
                const modulePerms = permissions.filter(p => p.module === module);
                const allSelected = modulePerms.every(p => roleFormData.permission_ids.includes(p.id));
                const someSelected = modulePerms.some(p => roleFormData.permission_ids.includes(p.id));
                
                return (
                  <div key={module} className="border-b border-zinc-100 pb-3 last:border-0">
                    <CheckboxField>
                      <Checkbox
                        checked={allSelected}
                        indeterminate={someSelected && !allSelected}
                        onChange={() => toggleModule(module)}
                      />
                      <Label className="cursor-pointer font-semibold text-zinc-900">
                        {getModuleName(module)}
                      </Label>
                    </CheckboxField>
                    
                    <div className="ml-6 mt-2 grid grid-cols-2 gap-2">
                      {modulePerms.map((perm) => (
                        <CheckboxField key={perm.id}>
                          <Checkbox
                            checked={roleFormData.permission_ids.includes(perm.id)}
                            onChange={() => togglePermission(perm.id)}
                          />
                          <Label className="cursor-pointer">
                            <div className="text-sm">{perm.name}</div>
                            {perm.description && (
                              <div className="text-xs text-zinc-500">{perm.description}</div>
                            )}
                          </Label>
                        </CheckboxField>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Field>
        </DialogBody>

        <DialogActions>
          <Button plain onClick={() => setRoleDialogOpen(false)} disabled={roleDialogLoading}>
            取消
          </Button>
          <Button onClick={handleRoleSubmit} disabled={roleDialogLoading}>
            {roleDialogLoading ? '处理中...' : (editingRole ? '保存' : '创建')}
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}

