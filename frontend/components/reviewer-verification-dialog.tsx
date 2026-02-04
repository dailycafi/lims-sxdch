import { useState, useCallback } from 'react';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Input } from '@/components/input';
import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { ShieldCheckIcon, ExclamationTriangleIcon, UserCircleIcon } from '@heroicons/react/20/solid';
import { api } from '@/lib/api';

interface ReviewerInfo {
  reviewer_id: number;
  reviewer_name: string;
  reviewer_username: string;
}

interface ReviewerVerificationDialogProps {
  open: boolean;
  onClose: (open: boolean) => void;
  onVerified: (reviewerInfo: ReviewerInfo) => void;
  currentUserName?: string;
}

export function ReviewerVerificationDialog({
  open,
  onClose,
  onVerified,
  currentUserName
}: ReviewerVerificationDialogProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = useCallback(async () => {
    if (!username.trim()) {
      setError('请输入复核人用户名');
      return;
    }

    if (!password) {
      setError('请输入密码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('username', username.trim());
      formData.append('password', password);

      const response = await api.post<{ success: boolean } & ReviewerInfo>(
        '/samples/receive/verify-reviewer',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      if (response.data.success) {
        onVerified({
          reviewer_id: response.data.reviewer_id,
          reviewer_name: response.data.reviewer_name,
          reviewer_username: response.data.reviewer_username
        });
        setUsername('');
        setPassword('');
        onClose(false);
      }
    } catch (err: any) {
      const message = err?.response?.data?.detail || '验证失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [username, password, onVerified, onClose]);

  const handleCancel = useCallback(() => {
    if (!loading) {
      setUsername('');
      setPassword('');
      setError('');
      onClose(false);
    }
  }, [loading, onClose]);

  return (
    <Dialog open={open} onClose={handleCancel}>
      <DialogTitle>
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="h-5 w-5 text-blue-500" />
          复核人验证
        </div>
      </DialogTitle>
      <DialogDescription>
        样本接收需要另一位样本管理员进行复核确认。
      </DialogDescription>

      <DialogBody>
        <div className="space-y-4">
          {currentUserName && (
            <div className="p-3 bg-zinc-50 rounded-lg">
              <div className="flex items-center gap-2">
                <UserCircleIcon className="h-5 w-5 text-zinc-500" />
                <div>
                  <Text className="text-sm text-zinc-600">当前操作人</Text>
                  <Text className="text-sm font-medium text-zinc-900">{currentUserName}</Text>
                </div>
              </div>
            </div>
          )}

          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-2">
              <ShieldCheckIcon className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <Text className="text-sm font-medium text-blue-900">
                  双人复核要求
                </Text>
                <Text className="text-sm text-blue-700 mt-1">
                  复核人必须是样本管理员，且不能与当前操作人相同。
                </Text>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              复核人用户名 <span className="text-red-500">*</span>
            </label>
            <Input
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              placeholder="请输入复核人的用户名"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              复核人密码 <span className="text-red-500">*</span>
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="请输入复核人的密码"
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 rounded-lg">
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                <Text className="text-sm text-red-700">{error}</Text>
              </div>
            </div>
          )}
        </div>
      </DialogBody>

      <DialogActions>
        <Button plain onClick={handleCancel} disabled={loading}>
          取消
        </Button>
        <Button
          onClick={handleVerify}
          disabled={loading || !username.trim() || !password}
        >
          {loading ? '验证中...' : '确认验证'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
