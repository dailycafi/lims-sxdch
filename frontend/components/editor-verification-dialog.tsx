import { useState, useCallback } from 'react';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Input } from '@/components/input';
import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { ShieldCheckIcon, ExclamationTriangleIcon, PencilSquareIcon } from '@heroicons/react/20/solid';
import { api } from '@/lib/api';

interface EditorInfo {
  editor_id: number;
  editor_name: string;
  editor_username: string;
}

interface EditorVerificationDialogProps {
  open: boolean;
  onClose: () => void;
  onVerified: (editorInfo: EditorInfo) => void;
}

export function EditorVerificationDialog({
  open,
  onClose,
  onVerified,
}: EditorVerificationDialogProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = useCallback(async () => {
    if (!username.trim()) {
      setError('请输入用户名');
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

      const response = await api.post<{ success: boolean } & EditorInfo>(
        '/samples/receive/verify-editor',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      if (response.data.success) {
        onVerified({
          editor_id: response.data.editor_id,
          editor_name: response.data.editor_name,
          editor_username: response.data.editor_username
        });
        setUsername('');
        setPassword('');
      }
    } catch (err: any) {
      const message = err?.response?.data?.detail || '验证失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [username, password, onVerified]);

  const handleCancel = useCallback(() => {
    if (!loading) {
      setUsername('');
      setPassword('');
      setError('');
      onClose();
    }
  }, [loading, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && username.trim() && password) {
      handleVerify();
    }
  }, [handleVerify, username, password]);

  return (
    <Dialog open={open} onClose={handleCancel}>
      <DialogTitle>
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="h-5 w-5 text-blue-500" />
          编辑验证
        </div>
      </DialogTitle>
      <DialogDescription>
        修改接收记录需要验证用户身份，请输入您的用户名和密码。
      </DialogDescription>

      <DialogBody>
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-2">
              <PencilSquareIcon className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <Text className="text-sm font-medium text-blue-900">
                  编辑权限要求
                </Text>
                <Text className="text-sm text-blue-700 mt-1">
                  只有样本管理员可以编辑接收记录，所有修改将被记录在审计日志中。
                </Text>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              用户名 <span className="text-red-500">*</span>
            </label>
            <Input
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              onKeyDown={handleKeyDown}
              placeholder="请输入您的用户名"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              密码 <span className="text-red-500">*</span>
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              onKeyDown={handleKeyDown}
              placeholder="请输入您的密码"
              autoComplete="current-password"
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
