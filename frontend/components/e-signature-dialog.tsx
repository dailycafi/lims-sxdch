import { useState } from 'react';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Input } from '@/components/input';
import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { ShieldCheckIcon, ExclamationTriangleIcon } from '@heroicons/react/20/solid';

interface ESignatureDialogProps {
  open: boolean;
  onClose: (open: boolean) => void;
  onConfirm: (password: string, reason: string) => Promise<void>;
  title?: string;
  description?: string;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  actionType?: 'approve' | 'execute' | 'delete' | 'archive' | 'default';
}

export function ESignatureDialog({
  open,
  onClose,
  onConfirm,
  title = '电子签名确认',
  description = '此操作需要您的电子签名确认。请输入您的密码进行身份验证。',
  requireReason = true,
  reasonLabel = '操作原因',
  reasonPlaceholder = '请说明执行此操作的原因',
  actionType = 'default'
}: ESignatureDialogProps) {
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!password) {
      setError('请输入密码');
      return;
    }

    if (requireReason && !reason) {
      setError('请输入操作原因');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onConfirm(password, reason);
      // 清空表单
      setPassword('');
      setReason('');
      onClose(false);
    } catch (err: any) {
      setError(err.message || '密码验证失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setPassword('');
      setReason('');
      setError('');
      onClose(false);
    }
  };

  const getActionColor = () => {
    switch (actionType) {
      case 'approve':
        return 'blue';
      case 'execute':
        return 'green';
      case 'delete':
        return 'red';
      case 'archive':
        return 'amber';
      default:
        return 'zinc';
    }
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="h-5 w-5 text-blue-500" />
          {title}
        </div>
      </DialogTitle>
      <DialogDescription>{description}</DialogDescription>
      
      <DialogBody>
        <div className="space-y-4">
          {/* 安全提示 */}
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-2">
              <ShieldCheckIcon className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <Text className="text-sm font-medium text-blue-900">
                  21 CFR Part 11 合规性要求
                </Text>
                <Text className="text-sm text-blue-700 mt-1">
                  您的电子签名与手写签名具有同等法律效力。此操作将被永久记录在审计日志中。
                </Text>
              </div>
            </div>
          </div>

          {/* 密码输入 */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              用户密码 <span className="text-red-500">*</span>
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="请输入您的账户密码"
              autoFocus
              autoComplete="new-password"
            />
          </div>

          {/* 操作原因 */}
          {requireReason && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                {reasonLabel} <span className="text-red-500">*</span>
              </label>
              <Input
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setError('');
                }}
                placeholder={reasonPlaceholder}
              />
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="p-3 bg-red-50 rounded-lg">
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                <Text className="text-sm text-red-700">{error}</Text>
              </div>
            </div>
          )}

          {/* 签名声明 */}
          <div className="p-3 bg-zinc-50 rounded-lg">
            <Text className="text-sm text-zinc-600">
              点击"确认签名"即表示您理解并同意：
            </Text>
            <ul className="mt-2 space-y-1 text-sm text-zinc-600">
              <li>• 此电子签名具有法律约束力</li>
              <li>• 您对此操作承担全部责任</li>
              <li>• 此操作将被永久记录且不可撤销</li>
            </ul>
          </div>
        </div>
      </DialogBody>
      
      <DialogActions>
        <Button plain onClick={handleClose} disabled={loading}>
          取消
        </Button>
        <Button
          color={getActionColor() as any}
          onClick={handleConfirm}
          disabled={loading || !password || (requireReason && !reason)}
        >
          {loading ? '验证中...' : '确认签名'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
