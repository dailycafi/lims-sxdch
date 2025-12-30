import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  UserMinusIcon,
  CheckCircleIcon,
  XCircleIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/button';
import { Heading } from '@/components/heading';
import { Input } from '@/components/input';
import { Dialog, DialogTitle, DialogDescription, DialogActions, DialogBody } from '@/components/dialog';
import { UsersService } from '@/services/users.service';
import { RolesService } from '@/services/roles.service';
import { User, UserCreate, UserUpdate, Role } from '@/types/api';
import { toast } from 'react-hot-toast';
import { AnimatedTable, AnimatedLoadingState } from '@/components/animated-table';

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 表单数据
  const [formData, setFormData] = useState<UserCreate>({
    username: '',
    email: '',
    full_name: '',
    password: '',
    role_ids: [],
  });

  const [editData, setEditData] = useState<UserUpdate>({
    email: '',
    full_name: '',
    role_ids: [],
    is_active: true,
  });

  const [newPassword, setNewPassword] = useState('');
  const [passwordRequirements, setPasswordRequirements] = useState<string[]>([]);

  useEffect(() => {
    loadUsers();
    loadRoles();
    loadPasswordRequirements();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await UsersService.getUsers();
      setUsers(data);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const data = await RolesService.getRoles();
      setRoles(data.filter(r => r.is_active));
    } catch (error: any) {
      toast.error('加载角色列表失败');
    }
  };

  const loadPasswordRequirements = async () => {
    try {
      const requirements = await UsersService.getPasswordRequirements();
      setPasswordRequirements(requirements);
    } catch (error) {
      console.error('Failed to load password requirements', error);
    }
  };

  const handleCreateUser = async () => {
    if (!formData.username || !formData.email || !formData.full_name || !formData.password) {
      toast.error('请填写所有必填字段');
      return;
    }

    if (formData.role_ids.length === 0) {
      toast.error('请至少选择一个角色');
      return;
    }

    try {
      setSubmitting(true);
      await UsersService.createUser(formData);
      toast.success('用户创建成功');
      setShowCreateDialog(false);
      resetFormData();
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '创建用户失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    if (editData.role_ids && editData.role_ids.length === 0) {
      toast.error('请至少选择一个角色');
      return;
    }

    try {
      setSubmitting(true);
      await UsersService.updateUser(selectedUser.id, editData);
      toast.success('用户更新成功');
      setShowEditDialog(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '更新用户失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await UsersService.updateUser(user.id, { is_active: !user.is_active });
      toast.success(user.is_active ? '用户已停用' : '用户已启用');
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '操作失败');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      setSubmitting(true);
      await UsersService.deleteUser(selectedUser.id);
      toast.success('用户已删除');
      setShowDeleteDialog(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '删除用户失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) {
      toast.error('请输入新密码');
      return;
    }

    try {
      setSubmitting(true);
      await UsersService.resetPassword(selectedUser.id, newPassword);
      toast.success('密码重置成功');
      setShowResetPasswordDialog(false);
      setSelectedUser(null);
      setNewPassword('');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '重置密码失败');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setEditData({
      email: user.email,
      full_name: user.full_name,
      role_ids: user.roles?.map(r => r.id) || [],
      is_active: user.is_active,
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  const openResetPasswordDialog = (user: User) => {
    setSelectedUser(user);
    setNewPassword('');
    setShowResetPasswordDialog(true);
  };

  const resetFormData = () => {
    setFormData({
      username: '',
      email: '',
      full_name: '',
      password: '',
      role_ids: [],
    });
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleNames = (user: User) => {
    if (user.roles && user.roles.length > 0) {
      return user.roles.map(r => r.name).join(', ');
    }
    return user.role || '无角色';
  };

  return (
    <>
      <Head>
        <title>用户管理 - LIMS</title>
      </Head>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Heading>用户管理</Heading>
          <Button color="blue" onClick={() => setShowCreateDialog(true)}>
            <PlusIcon className="h-5 w-5" />
            新建用户
          </Button>
        </div>

        {/* 搜索框 */}
        <div className="mb-6">
          <Input
            type="text"
            placeholder="搜索用户名、姓名或邮箱..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* 用户列表 */}
        <AnimatedTable>
          <thead>
            <tr>
              <th>用户名</th>
              <th>姓名</th>
              <th>邮箱</th>
              <th>角色</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <AnimatedLoadingState colSpan={7} variant="lottie" text="加载用户列表中..." />
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-500">
                  没有找到用户
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td className="font-medium">{user.username}</td>
                  <td>{user.full_name}</td>
                  <td>{user.email}</td>
                  <td>
                    <div className="text-sm text-gray-600">
                      {getRoleNames(user)}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                        user.is_active
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {user.is_active ? (
                        <>
                          <CheckCircleIcon className="h-4 w-4" />
                          启用
                        </>
                      ) : (
                        <>
                          <XCircleIcon className="h-4 w-4" />
                          停用
                        </>
                      )}
                    </span>
                  </td>
                  <td className="text-sm text-gray-600">
                    {new Date(user.created_at).toLocaleString('zh-CN')}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Button
                        color="zinc"
                        outline
                        onClick={() => openEditDialog(user)}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        color={user.is_active ? 'red' : 'green'}
                        outline
                        onClick={() => handleToggleActive(user)}
                      >
                        {user.is_active ? (
                          <UserMinusIcon className="h-4 w-4" />
                        ) : (
                          <CheckCircleIcon className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        color="blue"
                        outline
                        onClick={() => openResetPasswordDialog(user)}
                      >
                        <KeyIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        color="red"
                        outline
                        onClick={() => openDeleteDialog(user)}
                      >
                        <TrashIcon className="h-4 w-4" />
                        </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </AnimatedTable>
      </div>

      {/* 创建用户对话框 */}
      <Dialog open={showCreateDialog} onClose={setShowCreateDialog}>
        <DialogTitle>新建用户</DialogTitle>
        <DialogDescription>
          请填写用户信息
        </DialogDescription>
        <DialogBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                用户名 <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="请输入用户名"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                姓名 <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="请输入姓名"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                邮箱 <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="请输入邮箱"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                密码 <span className="text-red-500">*</span>
              </label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="请输入密码"
              />
              {passwordRequirements.length > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  <div className="font-medium mb-1">密码要求：</div>
                  <ul className="list-disc list-inside space-y-1">
                    {passwordRequirements.map((req, idx) => (
                      <li key={idx}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                角色 <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-md p-2">
                {roles.map((role) => (
                  <label key={role.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.role_ids.includes(role.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            role_ids: [...formData.role_ids, role.id],
                          });
                        } else {
                          setFormData({
                            ...formData,
                            role_ids: formData.role_ids.filter(id => id !== role.id),
                          });
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{role.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button color="zinc" onClick={() => {
            setShowCreateDialog(false);
            resetFormData();
          }}>
            取消
          </Button>
          <Button color="blue" onClick={handleCreateUser} disabled={submitting}>
            {submitting ? '创建中...' : '创建'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 编辑用户对话框 */}
      <Dialog open={showEditDialog} onClose={setShowEditDialog}>
        <DialogTitle>编辑用户</DialogTitle>
        <DialogDescription>
          编辑用户：{selectedUser?.username}
        </DialogDescription>
        <DialogBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                姓名
              </label>
              <Input
                type="text"
                value={editData.full_name || ''}
                onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                邮箱
              </label>
              <Input
                type="email"
                value={editData.email || ''}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                角色
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-md p-2">
                {roles.map((role) => (
                  <label key={role.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={editData.role_ids?.includes(role.id) || false}
                      onChange={(e) => {
                        const currentRoles = editData.role_ids || [];
                        if (e.target.checked) {
                          setEditData({
                            ...editData,
                            role_ids: [...currentRoles, role.id],
                          });
                        } else {
                          setEditData({
                            ...editData,
                            role_ids: currentRoles.filter(id => id !== role.id),
                          });
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{role.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={editData.is_active}
                  onChange={(e) => setEditData({ ...editData, is_active: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">启用用户</span>
              </label>
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button color="zinc" onClick={() => setShowEditDialog(false)}>
            取消
          </Button>
          <Button color="blue" onClick={handleEditUser} disabled={submitting}>
            {submitting ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 删除用户对话框 */}
      <Dialog open={showDeleteDialog} onClose={setShowDeleteDialog}>
        <DialogTitle>删除用户</DialogTitle>
        <DialogDescription>
          确定要删除用户 <strong>{selectedUser?.username}</strong> 吗？此操作无法撤销。
        </DialogDescription>
        <DialogActions>
          <Button color="zinc" onClick={() => setShowDeleteDialog(false)}>
            取消
          </Button>
          <Button color="red" onClick={handleDeleteUser} disabled={submitting}>
            {submitting ? '删除中...' : '删除'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 重置密码对话框 */}
      <Dialog open={showResetPasswordDialog} onClose={setShowResetPasswordDialog}>
        <DialogTitle>重置密码</DialogTitle>
        <DialogDescription>
          为用户 <strong>{selectedUser?.username}</strong> 重置密码
        </DialogDescription>
        <DialogBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                新密码 <span className="text-red-500">*</span>
              </label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="请输入新密码"
              />
              {passwordRequirements.length > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  <div className="font-medium mb-1">密码要求：</div>
                  <ul className="list-disc list-inside space-y-1">
                    {passwordRequirements.map((req, idx) => (
                      <li key={idx}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button color="zinc" onClick={() => setShowResetPasswordDialog(false)}>
            取消
          </Button>
          <Button color="blue" onClick={handleResetPassword} disabled={submitting}>
            {submitting ? '重置中...' : '重置密码'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

