import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { Input } from '@/components/input';
import { Button } from '@/components/button';
import { Divider } from '@/components/divider';
import { Badge } from '@/components/badge';
import { Avatar } from '@/components/avatar';
import { DescriptionList, DescriptionTerm, DescriptionDetails } from '@/components/description-list';
import { useAuthStore } from '@/store/auth';
import { UsersService } from '@/services';

const roleLabels: Record<string, string> = {
  SYSTEM_ADMIN: '系统管理员',
  SAMPLE_ADMIN: '样本管理员',
  PROJECT_LEAD: '项目负责人',
  ANALYST: '分析员',
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, checkAuth, logout } = useAuthStore((state) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    checkAuth: state.checkAuth,
    logout: state.logout,
  }));

  const [form, setForm] = useState({
    full_name: '',
    email: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        email: user.email || '',
      });
    }
  }, [user]);

  const roleLabel = useMemo(() => {
    if (!user) return '';
    return roleLabels[user.role] || user.role;
  }, [user]);

  const hasChanges = useMemo(() => {
    if (!user) return false;
    return form.full_name !== (user.full_name || '') || form.email !== (user.email || '');
  }, [form.email, form.full_name, user]);

  const isFormValid = form.full_name.trim() !== '' && form.email.trim() !== '';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;

    if (!isFormValid) {
      toast.error('请填写完整的个人信息');
      return;
    }

    if (!hasChanges) {
      toast('信息未发生变化');
      return;
    }

    try {
      setIsSaving(true);
      await UsersService.updateUser(user.id, {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
      });
      toast.success('个人信息已更新');
      await checkAuth();
    } catch (error) {
      console.error('更新个人信息失败:', error);
      toast.error('更新失败，请稍后重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center">
          <Text>正在加载个人信息…</Text>
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return null;
  }

  const createdAtLabel = user.created_at ? new Date(user.created_at).toLocaleString('zh-CN') : '-';

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <Avatar
              initials={user.full_name?.charAt(0)?.toUpperCase() || user.username.charAt(0).toUpperCase()}
              className="h-14 w-14"
            />
            <div className="flex-1 min-w-0">
              <Heading level={2}>{user.full_name || user.username}</Heading>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
                <Badge color="zinc">{roleLabel}</Badge>
                <Badge color={user.is_active ? 'green' : 'zinc'}>{user.is_active ? '账户已激活' : '已停用'}</Badge>
                <span>用户名：{user.username}</span>
              </div>
            </div>
            <Button plain onClick={handleLogout}>
              退出登录
            </Button>
          </div>

          <Divider className="my-6" />

          <DescriptionList className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <DescriptionTerm>邮箱</DescriptionTerm>
              <DescriptionDetails>{user.email || '-'}</DescriptionDetails>
            </div>
            <div>
              <DescriptionTerm>角色</DescriptionTerm>
              <DescriptionDetails>{roleLabel}</DescriptionDetails>
            </div>
            <div>
              <DescriptionTerm>账户状态</DescriptionTerm>
              <DescriptionDetails>{user.is_active ? '在用' : '停用'}</DescriptionDetails>
            </div>
            <div>
              <DescriptionTerm>创建时间</DescriptionTerm>
              <DescriptionDetails>{createdAtLabel}</DescriptionDetails>
            </div>
          </DescriptionList>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <Heading level={3}>编辑个人信息</Heading>
              <Text className="mt-1 text-sm text-zinc-600">更新姓名和联系邮箱，以便团队成员识别您</Text>
            </div>
            {hasChanges && (
              <Badge color="amber">有未保存更改</Badge>
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <label className="mb-2 block text-sm font-medium text-zinc-700">姓名</label>
              <Input
                value={form.full_name}
                onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
                placeholder="请输入姓名"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="mb-2 block text-sm font-medium text-zinc-700">邮箱</label>
              <Input
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="请输入邮箱"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <Button
              type="button"
              plain
              onClick={() => user && setForm({ full_name: user.full_name || '', email: user.email || '' })}
              disabled={!hasChanges || isSaving}
            >
              取消更改
            </Button>
            <Button
              type="submit"
              color="dark"
              disabled={!hasChanges || !isFormValid || isSaving}
            >
              {isSaving ? '保存中…' : '保存修改'}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
