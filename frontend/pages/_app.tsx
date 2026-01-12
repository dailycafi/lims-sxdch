import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { usePageTracking } from '@/hooks/usePageTracking';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App({ Component, pageProps }: AppProps) {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const { isAuthenticated } = useAuthStore();

  // 启用页面访问追踪
  usePageTracking();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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
