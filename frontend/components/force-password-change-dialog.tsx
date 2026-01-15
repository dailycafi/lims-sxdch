import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Field, Label } from '@/components/fieldset';
import { Text } from '@/components/text';
import { UsersService } from '@/services/users.service';
import { useAuthStore } from '@/store/auth';
import { extractDetailMessage } from '@/lib/api';
import { ShieldExclamationIcon, KeyIcon, ExclamationTriangleIcon } from '@heroicons/react/20/solid';

interface ForcePasswordChangeDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  passwordExpired?: boolean;  // 是否因密码过期（90天）而需要修改
}

export function ForcePasswordChangeDialog({ 
  open, 
  onClose, 
  onSuccess, 
  passwordExpired = false 
}: ForcePasswordChangeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordRequirements, setPasswordRequirements] = useState<string[]>([]);
  const { user } = useAuthStore();
  
  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (open) {
      loadPasswordRequirements();
      setFormData({
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setError('');
    }
  }, [open]);

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

    if (!formData.oldPassword) {
      setError('请输入当前密码');
      return;
    }
    if (!formData.newPassword) {
      setError('请输入新密码');
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    if (formData.oldPassword === formData.newPassword) {
      setError('新密码不能与当前密码相同');
      return;
    }

    setLoading(true);
    try {
      if (!user?.id) {
        setError('用户信息获取失败，请重新登录');
        return;
      }
      
      await UsersService.changePassword(user.id, formData.oldPassword, formData.newPassword);
      onSuccess();
    } catch (err: any) {
      const errorMsg = extractDetailMessage(err.response?.data) || err.message || '修改密码失败';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => {}} size="lg">
      <DialogTitle>
        <div className="flex items-center gap-2 text-amber-600">
          <ShieldExclamationIcon className="h-6 w-6" />
          {passwordExpired ? '密码已过期' : '首次登录修改密码'}
        </div>
      </DialogTitle>
      <DialogDescription>
        {passwordExpired 
          ? '您的密码已超过 90 天未修改，根据系统安全策略，需要立即修改密码。'
          : '这是您首次登录系统，为了账户安全，请立即修改密码。'
        }
      </DialogDescription>

      <DialogBody className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
              <Text className="text-sm text-red-800">{error}</Text>
            </div>
          </div>
        )}

        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
          <div className="flex items-start gap-3">
            <KeyIcon className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <Text className="text-sm font-medium text-amber-900">安全提示</Text>
              <Text className="text-sm text-amber-700 mt-1">
                修改密码后，此次登录会话将继续有效。请妥善保管您的新密码。
              </Text>
            </div>
          </div>
        </div>

        <Field>
          <Label>当前密码 *</Label>
          <Input
            type="password"
            value={formData.oldPassword}
            onChange={(e) => setFormData(prev => ({ ...prev, oldPassword: e.target.value }))}
            placeholder="请输入当前密码"
            autoComplete="current-password"
          />
        </Field>

        <Field>
          <Label>新密码 *</Label>
          <Input
            type="password"
            value={formData.newPassword}
            onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
            placeholder="请输入新密码"
            autoComplete="new-password"
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
          <Label>确认新密码 *</Label>
          <Input
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
            placeholder="请再次输入新密码"
            autoComplete="new-password"
          />
        </Field>
      </DialogBody>

      <DialogActions>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? '修改中...' : '确认修改'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
