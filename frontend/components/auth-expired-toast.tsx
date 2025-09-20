import React from 'react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/auth';

function AuthExpiredToast({ t }: { t: any }) {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  const onConfirm = async () => {
    toast.dismiss(t.id);
    await logout();
    router.push('/login');
  };

  return (
    <div className="pointer-events-auto w-[280px] rounded-md bg-white shadow-lg ring-1 ring-zinc-200">
      <div className="px-4 py-3">
        <div className="text-sm font-medium text-zinc-900">登录已过期</div>
        <div className="mt-1 text-xs text-zinc-600">请重新登录以继续使用系统</div>
        <button
          onClick={onConfirm}
          className="mt-3 w-full rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
        >
          重新登录
        </button>
      </div>
    </div>
  );
}

export function showAuthExpiredToast() {
  return toast.custom((t) => <AuthExpiredToast t={t} />, {
    duration: Infinity,
    id: 'auth-expired',
  });
}
