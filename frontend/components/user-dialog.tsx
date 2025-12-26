import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Field, Label, ErrorMessage } from '@/components/fieldset';
import { Text } from '@/components/text';
import { Checkbox, CheckboxField } from '@/components/checkbox';
import { UsersService } from '@/services/users.service';
import { RolesService } from '@/services/roles.service';
import { User, Role, UserCreate, UserUpdate } from '@/types/api';
import { extractDetailMessage } from '@/lib/api';

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
  const [passwordRequirements, setPasswordRequirements] = useState<string[]>([]);
  
  // 表单状态
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role_ids: [] as number[],
  });

  // 加载角色列表和密码要求
  useEffect(() => {
    if (open) {
      loadRoles();
      loadPasswordRequirements();
      
      // 如果是编辑模式，填充表单数据
      if (user) {
        setFormData({
          username: user.username,
          full_name: user.full_name,
          email: user.email,
          password: '',
          confirmPassword: '',
          role_ids: user.roles?.map(r => r.id) || [],
        });
      } else {
        // 新建模式，重置表单
        setFormData({
          username: '',
          full_name: '',
          email: '',
          password: '',
          confirmPassword: '',
          role_ids: [],
        });
      }
      
      setError('');
    }
  }, [open, user]);

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

  const loadPasswordRequirements = async () => {
    try {
      const requirements = await UsersService.getPasswordRequirements();
      setPasswordRequirements(requirements);
    } catch (err) {
      console.error('加载密码要求失败:', err);
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
    
    // 新建模式需要验证密码
    if (!isEdit) {
      if (!formData.password) {
        setError('请输入密码');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('两次输入的密码不一致');
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
        };
        await UsersService.updateUser(user!.id, updateData);
      } else {
        // 创建用户
        const createData: UserCreate = {
          username: formData.username,
          full_name: formData.full_name,
          email: formData.email,
          password: formData.password,
          role_ids: formData.role_ids,
        };
        await UsersService.createUser(createData);
      }
      
      onSuccess?.();
      onClose();
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

  return (
    <Dialog open={open} onClose={onClose} size="2xl">
      <DialogTitle>{isEdit ? '编辑用户' : '新建用户'}</DialogTitle>
      <DialogDescription>
        {isEdit ? '修改用户的基本信息和角色' : '创建新用户并分配角色'}
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
          <>
            <Field>
              <Label>密码 *</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="请输入密码"
              />
              {passwordRequirements.length > 0 && (
                <div className="mt-2 text-xs text-zinc-600">
                  <div className="font-medium mb-1">密码要求：</div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {passwordRequirements.map((req, index) => (
                      <li key={index}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Field>

            <Field>
              <Label>确认密码 *</Label>
              <Input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="请再次输入密码"
              />
            </Field>
          </>
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

