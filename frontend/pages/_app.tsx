import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { usePageTracking } from '@/hooks/usePageTracking';

// 使用懒初始化创建 QueryClient，确保每个浏览器会话只创建一次
// 参考: React Best Practices - 5.5 Use Lazy State Initialization
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
        // 在 SSR 时禁用重试，避免瀑布请求
        staleTime: 60 * 1000, // 1 分钟内数据不会过期
      },
    },
  });
}

// 浏览器端的 QueryClient 单例
let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // 服务端: 每次创建新的 QueryClient
    return makeQueryClient();
  } else {
    // 浏览器端: 复用已有的 QueryClient
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

export default function App({ Component, pageProps }: AppProps) {
  // 使用懒初始化获取 QueryClient
  const [queryClient] = useState(getQueryClient);
  
  // 启用页面访问追踪
  usePageTracking();

  // 应用启动时检查认证状态
  useEffect(() => {
    useAuthStore.getState().checkAuth();
  }, []); // 空依赖数组，只在挂载时执行一次

  return (
    <QueryClientProvider client={queryClient}>
      <Component {...pageProps} />
      <Toaster
        position="top-right"
        reverseOrder={false}
        gutter={8}
        toastOptions={{
          duration: 4000,
          style: {
            background: '#ffffff',
            color: '#18181b', // zinc-900
            borderRadius: '12px',
            border: '1px solid rgba(228, 228, 231, 0.5)', // zinc-200/50
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            fontSize: '14px',
            fontWeight: '500',
            padding: '12px 16px',
          },
          success: {
            duration: 4000,
            iconTheme: {
              primary: '#10b981', // emerald-500
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444', // red-500
              secondary: '#fff',
            },
          },
        }}
      />
    </QueryClientProvider>
  );
}
