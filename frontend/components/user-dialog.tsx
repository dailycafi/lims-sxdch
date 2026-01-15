import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Field, Label, ErrorMessage } from '@/components/fieldset';
import { Text } from '@/components/text';
import { Textarea } from '@/components/textarea';
import { Checkbox, CheckboxField } from '@/components/checkbox';
import { UsersService } from '@/services/users.service';
import { RolesService } from '@/services/roles.service';
import { useAuthStore } from '@/store/auth';
import { User, Role, UserCreate, UserUpdate, UserCreateResponse } from '@/types/api';
import { extractDetailMessage } from '@/lib/api';
import { ClipboardIcon, CheckIcon, KeyIcon } from '@heroicons/react/20/solid';

interface UserDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  user?: User | null;  // null表示新建，有值表示编辑
}

export function UserDialog({ open, onClose, onSuccess, user }: UserDialogProps) {
  const isEdit = !!user;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const { user: currentUser } = useAuthStore();
  
  // 创建成功后显示密码的状态
  const [createdUser, setCreatedUser] = useState<UserCreateResponse | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);
  
  // 表单状态
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    email: '',
    role_ids: [] as number[],
    is_active: true,
    // 审计字段（编辑时使用）
    audit_reason: '',
    audit_username: '',
    audit_password: '',
  });

  // 加载角色列表
  useEffect(() => {
    if (open) {
      loadRoles();
      setCreatedUser(null);
      setPasswordCopied(false);
      
      // 如果是编辑模式，填充表单数据
      if (user) {
        setFormData({
          username: user.username,
          full_name: user.full_name,
          email: user.email,
          role_ids: user.roles?.map(r => r.id) || [],
          is_active: user.is_active,
          audit_reason: '',
          audit_username: currentUser?.username || '',
          audit_password: '',
        });
      } else {
        // 新建模式，重置表单
        setFormData({
          username: '',
          full_name: '',
          email: '',
          role_ids: [],
          is_active: true,
          audit_reason: '',
          audit_username: '',
          audit_password: '',
        });
      }
      
      setError('');
    }
  }, [open, user, currentUser]);

  const loadRoles = async () => {
    setRolesLoading(true);
    try {
      const fetchedRoles = await RolesService.getRoles({ include_inactive: false });
      setRoles(fetchedRoles);
    } catch (err) {
      console.error('加载角色列表失败:', err);
    } finally {
      setRolesLoading(false);
    }
  };

  const copyPassword = async () => {
    if (createdUser?.initial_password) {
      try {
        await navigator.clipboard.writeText(createdUser.initial_password);
        setPasswordCopied(true);
        setTimeout(() => setPasswordCopied(false), 2000);
      } catch (err) {
        console.error('复制密码失败:', err);
      }
    }
  };

  const handleSubmit = async () => {
    setError('');
    
    // 验证必填项
    if (!formData.username.trim()) {
      setError('请输入用户名');
      return;
    }
    if (!formData.full_name.trim()) {
      setError('请输入姓名');
      return;
    }
    if (!formData.email.trim()) {
      setError('请输入邮箱');
      return;
    }
    if (formData.role_ids.length === 0) {
      setError('请至少选择一个角色');
      return;
    }
    
    // 编辑模式需要验证审计信息
    if (isEdit) {
      if (!formData.audit_reason.trim()) {
        setError('请填写修改理由');
        return;
      }
      if (!formData.audit_username.trim()) {
        setError('请输入您的用户名进行验证');
        return;
      }
      if (!formData.audit_password.trim()) {
        setError('请输入您的密码进行验证');
        return;
      }
    }

    setLoading(true);
    try {
      if (isEdit) {
        // 编辑用户
        const updateData: UserUpdate = {
          full_name: formData.full_name,
          email: formData.email,
          role_ids: formData.role_ids,
          is_active: formData.is_active,
          audit_reason: formData.audit_reason,
          audit_username: formData.audit_username,
          audit_password: formData.audit_password,
        };
        await UsersService.updateUser(user!.id, updateData);
        onSuccess?.();
        onClose();
      } else {
        // 创建用户（密码由系统生成）
        const createData: UserCreate = {
          username: formData.username,
          full_name: formData.full_name,
          email: formData.email,
          role_ids: formData.role_ids,
        };
        const result = await UsersService.createUser(createData);
        // 创建成功，显示初始密码
        setCreatedUser(result);
        onSuccess?.();
      }
    } catch (err: any) {
      const errorMsg = extractDetailMessage(err.response?.data) || err.message || '操作失败';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = (roleId: number) => {
    setFormData(prev => {
      const newRoleIds = prev.role_ids.includes(roleId)
        ? prev.role_ids.filter(id => id !== roleId)
        : [...prev.role_ids, roleId];
      return { ...prev, role_ids: newRoleIds };
    });
  };

  // 如果创建成功，显示密码
  if (createdUser) {
    return (
      <Dialog open={open} onClose={onClose} size="lg">
        <DialogTitle>
          <div className="flex items-center gap-2 text-green-600">
            <CheckIcon className="h-6 w-6" />
            用户创建成功
          </div>
        </DialogTitle>
        <DialogDescription>
          请将以下初始密码告知用户，用户首次登录时需要修改密码。
        </DialogDescription>

        <DialogBody className="space-y-4">
          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Text className="text-sm font-medium text-zinc-700">用户名</Text>
                <Text className="font-mono text-zinc-900">{createdUser.username}</Text>
              </div>
              <div className="flex items-center justify-between">
                <Text className="text-sm font-medium text-zinc-700">姓名</Text>
                <Text className="text-zinc-900">{createdUser.full_name}</Text>
              </div>
              <div className="border-t border-green-200 pt-3">
                <div className="flex items-center justify-between">
                  <Text className="text-sm font-medium text-zinc-700">初始密码</Text>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-lg bg-white px-3 py-1 rounded border border-green-300 text-green-700">
                      {createdUser.initial_password}
                    </code>
                    <Button
                      plain
                      onClick={copyPassword}
                      className="text-green-600 hover:text-green-800"
                    >
                      {passwordCopied ? (
                        <CheckIcon className="h-5 w-5" />
                      ) : (
                        <ClipboardIcon className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <div className="flex items-start gap-2">
              <KeyIcon className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <Text className="text-sm font-medium text-amber-900">安全提示</Text>
                <Text className="text-sm text-amber-700 mt-1">
                  此密码仅显示一次，请妥善保管并告知用户。用户首次登录时系统将强制要求修改密码。
                </Text>
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogActions>
          <Button onClick={onClose}>
            完成
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} size="2xl">
      <DialogTitle>{isEdit ? '编辑用户' : '新建用户'}</DialogTitle>
      <DialogDescription>
        {isEdit ? '修改用户信息需要验证您的身份并说明修改理由' : '创建新用户，系统将自动生成初始密码'}
      </DialogDescription>

      <DialogBody className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3">
            <Text className="text-sm text-red-800">{error}</Text>
          </div>
        )}

        <Field>
          <Label>用户名 *</Label>
          <Input
            value={formData.username}
            onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
            disabled={isEdit}  // 编辑模式下不允许修改用户名
            placeholder="请输入用户名"
          />
          {isEdit && (
            <Text className="text-xs text-zinc-500 mt-1">用户名不可修改</Text>
          )}
        </Field>

        <Field>
          <Label>姓名 *</Label>
          <Input
            value={formData.full_name}
            onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
            placeholder="请输入姓名"
          />
        </Field>

        <Field>
          <Label>邮箱 *</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            placeholder="请输入邮箱地址"
          />
        </Field>

        {!isEdit && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
            <div className="flex items-start gap-2">
              <KeyIcon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <Text className="text-sm font-medium text-blue-900">密码由系统自动生成</Text>
                <Text className="text-sm text-blue-700 mt-1">
                  用户创建成功后将显示初始密码，用户首次登录时需要修改密码。
                </Text>
              </div>
            </div>
          </div>
        )}

        {isEdit && (
          <Field>
            <Label>用户状态</Label>
            <div className="flex items-center gap-4 mt-2">
              <CheckboxField>
                <Checkbox
                  checked={formData.is_active}
                  onChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label className="cursor-pointer">启用此用户</Label>
              </CheckboxField>
              {!formData.is_active && (
                <Text className="text-xs text-amber-600">禁用后用户将无法登录系统</Text>
              )}
            </div>
          </Field>
        )}

        <Field>
          <Label>角色分配 *</Label>
          <Text className="text-xs text-zinc-500 mb-2">至少选择一个角色</Text>
          <div className="space-y-2 max-h-60 overflow-y-auto border border-zinc-200 rounded-lg p-3">
            {rolesLoading ? (
              <Text className="text-sm text-zinc-500 italic">加载角色中...</Text>
            ) : roles.length === 0 ? (
              <Text className="text-sm text-red-500 italic text-center py-4">未找到可用角色，请先在角色管理中创建角色。</Text>
            ) : (
              <>
                {/* 预设角色 */}
                {roles.filter(role => role.is_system).length > 0 && (
                  <>
                    <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                      预设角色
                    </div>
                    {roles.filter(role => role.is_system).map((role) => (
                      <CheckboxField key={role.id}>
                        <Checkbox
                          checked={formData.role_ids.includes(role.id)}
                          onChange={() => toggleRole(role.id)}
                        />
                        <Label className="cursor-pointer">
                          <div className="font-medium">{role.name}</div>
                          {role.description && (
                            <div className="text-xs text-zinc-500">{role.description}</div>
                          )}
                        </Label>
                      </CheckboxField>
                    ))}
                  </>
                )}
                
                {/* 自定义角色 */}
                {roles.filter(role => !role.is_system).length > 0 && (
                  <>
                    {roles.filter(role => role.is_system).length > 0 && (
                      <div className="border-t border-zinc-200 my-3" />
                    )}
                    <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                      自定义角色
                    </div>
                    {roles.filter(role => !role.is_system).map((role) => (
                      <CheckboxField key={role.id}>
                        <Checkbox
                          checked={formData.role_ids.includes(role.id)}
                          onChange={() => toggleRole(role.id)}
                        />
                        <Label className="cursor-pointer">
                          <div className="font-medium">{role.name}</div>
                          {role.description && (
                            <div className="text-xs text-zinc-500">{role.description}</div>
                          )}
                        </Label>
                      </CheckboxField>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </Field>

        {/* 编辑模式：审计验证区域 */}
        {isEdit && (
          <div className="border-t border-zinc-200 pt-4 mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <KeyIcon className="h-5 w-5 text-zinc-500" />
              <Text className="font-medium text-zinc-900">身份验证</Text>
            </div>
            <Text className="text-sm text-zinc-500">
              修改用户信息需要验证您的身份并说明修改理由（将记入审计日志）
            </Text>

            <Field>
              <Label>修改理由 *</Label>
              <Textarea
                value={formData.audit_reason}
                onChange={(e) => setFormData(prev => ({ ...prev, audit_reason: e.target.value }))}
                placeholder="请说明修改此用户信息的原因"
                rows={2}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label>您的用户名 *</Label>
                <Input
                  value={formData.audit_username}
                  onChange={(e) => setFormData(prev => ({ ...prev, audit_username: e.target.value }))}
                  placeholder="请输入您的用户名"
                />
              </Field>

              <Field>
                <Label>您的密码 *</Label>
                <Input
                  type="password"
                  value={formData.audit_password}
                  onChange={(e) => setFormData(prev => ({ ...prev, audit_password: e.target.value }))}
                  placeholder="请输入您的密码"
                />
              </Field>
            </div>
          </div>
        )}
      </DialogBody>

      <DialogActions>
        <Button plain onClick={onClose} disabled={loading}>
          取消
        </Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? '处理中...' : (isEdit ? '保存' : '创建')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

