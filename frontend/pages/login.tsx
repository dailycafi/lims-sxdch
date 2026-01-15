import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { Image } from '@/components/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { backendStatusAPI } from '@/lib/api';
import { ForcePasswordChangeDialog } from '@/components/force-password-change-dialog';

interface LoginForm {
  username: string;
  password: string;
}

// 提升静态 JSX 元素到组件外部，避免每次渲染重新创建
// 参考: React Best Practices - 6.3 Hoist Static JSX Elements
const BackgroundDecoration = (
  <div className="absolute inset-0 overflow-hidden">
    <motion.div 
      className="absolute top-20 left-20 w-32 h-32 opacity-5"
      animate={{ 
        rotate: 360,
        scale: [1, 1.1, 1]
      }}
      transition={{ 
        rotate: { duration: 20, repeat: Infinity, ease: "linear" },
        scale: { duration: 4, repeat: Infinity }
      }}
    >
      {/* 包装 SVG 在 div 中以获得更好的动画性能 */}
      {/* 参考: React Best Practices - 6.1 Animate SVG Wrapper Instead of SVG Element */}
      <svg viewBox="0 0 100 100" className="w-full h-full text-blue-500">
        <circle cx="30" cy="30" r="4" fill="currentColor" />
        <circle cx="70" cy="30" r="4" fill="currentColor" />
        <circle cx="50" cy="70" r="4" fill="currentColor" />
        <line x1="30" y1="30" x2="70" y2="30" stroke="currentColor" strokeWidth="2" />
        <line x1="30" y1="30" x2="50" y2="70" stroke="currentColor" strokeWidth="2" />
        <line x1="70" y1="30" x2="50" y2="70" stroke="currentColor" strokeWidth="2" />
      </svg>
    </motion.div>
    
    <motion.div 
      className="absolute bottom-20 right-20 w-24 h-24 opacity-5 text-blue-500"
      animate={{ 
        y: [0, -10, 0]
      }}
      transition={{ 
        duration: 3, 
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <rect x="40" y="20" width="20" height="60" fill="currentColor" />
        <rect x="20" y="40" width="60" height="20" fill="currentColor" />
      </svg>
    </motion.div>
  </div>
);

// 静态的底部信息组件
const FooterInfo = (
  <motion.div 
    className="mt-6 text-center"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: 0.7, duration: 0.6 }}
  >
    <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <span>安全登录</span>
    </div>
    <div className="mt-2 text-xs text-gray-400">
      <span>© 2025 徐汇区中心医院</span>
    </div>
  </motion.div>
);

// 错误类型枚举
enum ErrorType {
  NETWORK = 'NETWORK',
  SERVER = 'SERVER', 
  AUTH = 'AUTH',
  UNKNOWN = 'UNKNOWN'
}

interface LoginError {
  type: ErrorType;
  title: string;
  message: string;
  suggestion: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showTestAccounts, setShowTestAccounts] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const login = useAuthStore((state) => state.login);
  
  // 强制修改密码对话框状态
  const [forcePasswordChangeOpen, setForcePasswordChangeOpen] = useState(false);
  const [passwordExpired, setPasswordExpired] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>();

  // 进入登录页面时，清除可能存在的认证过期 toast
  useEffect(() => {
    // 使用 remove 强制移除，而不是 dismiss（dismiss 可能对 custom toast 无效）
    toast.remove('auth-expired');
  }, []);

  // 页面加载时检查服务器状态，并定期检查（用于状态指示器）
  useEffect(() => {
    const checkStatus = async () => {
      console.log('[Status Indicator] 检测后端服务器状态...');
      setServerStatus('checking');
      const isOnline = await backendStatusAPI.checkStatus();
      console.log('[Status Indicator] 检测结果:', isOnline ? 'online' : 'offline');
      setServerStatus(isOnline ? 'online' : 'offline');
    };
    
    // 立即检查一次
    checkStatus();
    
    // 每10秒检查一次服务器状态（用于状态指示器）
    const interval = setInterval(() => {
      console.log('[Status Indicator] 定时检查服务器状态...');
      checkStatus();
    }, 10000); // 从30秒改为10秒
    
    return () => {
      console.log('[Status Indicator] 清理定时器');
      clearInterval(interval);
    };
  }, []);

  // 自动关闭错误提示
  useEffect(() => {
    if (showErrorToast) {
      const timer = setTimeout(() => {
        setShowErrorToast(false);
        setError(null);
      }, 5000); // 5秒后自动关闭
      
      return () => clearTimeout(timer);
    }
  }, [showErrorToast]);

  // 解析错误类型
  const parseError = (error: any): LoginError => {
    console.error('Login error details:', error);
    
    // 网络连接错误
    if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error') || error.name === 'AbortError') {
      return {
        type: ErrorType.NETWORK,
        title: '网络连接失败',
        message: '无法连接到后端服务器',
        suggestion: '请确认后端服务已启动'
      };
    }
    
    // 服务器错误
    if (error.response?.status >= 500) {
      return {
        type: ErrorType.SERVER,
        title: '服务器错误',
        message: '后端服务器暂时不可用',
        suggestion: '请稍后重试'
      };
    }
    
    // 认证错误
    if (error.response?.status === 401 || error.response?.status === 422) {
      return {
        type: ErrorType.AUTH,
        title: '登录失败',
        message: '用户名或密码错误',
        suggestion: '请检查用户名和密码'
      };
    }
    
    // 其他错误
    return {
      type: ErrorType.UNKNOWN,
      title: '登录失败',
      message: error.message || '发生未知错误',
      suggestion: '请重试'
    };
  };

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);
    setShowErrorToast(false);
    
    try {
      // 点击登录时再次检查后端服务器状态
      console.log('[Login] 登录前检查后端服务器状态...');
      const isBackendOnline = await backendStatusAPI.checkStatus();
      
      if (!isBackendOnline) {
        // 后端服务器不可用，显示错误提示
        const networkError: LoginError = {
          type: ErrorType.NETWORK,
          title: '后端服务不可用',
          message: '无法连接到后端服务器',
          suggestion: '请确认后端服务已启动'
        };
        setError(networkError);
        setShowErrorToast(true);
        setServerStatus('offline');
        return;
      }
      
      console.log('[Login] 后端服务正常，开始登录...');
      const result = await login(data.username, data.password);
      
      if (result.success) {
        setServerStatus('online');
        // 确保清除认证过期 toast（使用 remove 强制移除）
        toast.remove('auth-expired');
        
        // 检查是否需要强制修改密码
        if (result.mustChangePassword) {
          setPasswordExpired(result.passwordExpired || false);
          setForcePasswordChangeOpen(true);
          return;
        }
        
        // 等待一小段时间确保 token 完全同步到 axios 后再跳转
        await new Promise(resolve => setTimeout(resolve, 100));
        router.push('/');
      } else {
        // 处理登录失败
        const loginError: LoginError = {
          type: result.error?.type === 'network' ? ErrorType.NETWORK :
                result.error?.type === 'auth' ? ErrorType.AUTH :
                result.error?.type === 'server' ? ErrorType.SERVER :
                ErrorType.UNKNOWN,
          title: result.error?.type === 'network' ? '网络连接失败' :
                 result.error?.type === 'auth' ? '登录失败' :
                 result.error?.type === 'server' ? '服务器错误' :
                 '登录失败',
          message: result.error?.message || '发生未知错误',
          suggestion: result.error?.type === 'network' ? '请确认后端服务已启动' :
                      result.error?.type === 'auth' ? '请检查用户名和密码' :
                      result.error?.type === 'server' ? '请稍后重试' :
                      '请重试'
        };
        setError(loginError);
        setShowErrorToast(true);
        
        // 根据错误类型更新状态指示器
        if (result.error?.type === 'network' || result.error?.type === 'server') {
          setServerStatus('offline');
        } else {
          setServerStatus('online');
        }
      }
    } catch (err) {
      // 兜底处理意外错误
      const loginError = parseError(err);
      setError(loginError);
      setShowErrorToast(true);
      
      if (loginError.type === ErrorType.NETWORK || loginError.type === ErrorType.SERVER) {
        setServerStatus('offline');
      } else {
        setServerStatus('online');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 关闭错误提示
  const closeErrorToast = () => {
    setShowErrorToast(false);
    setError(null);
  };

  // 获取状态指示器
  const getStatusIndicator = () => {
    switch (serverStatus) {
      case 'online':
        return {
          color: 'bg-green-400',
          text: '后端服务正常',
          animate: { scale: [1, 1.2, 1] }
        };
      case 'offline':
        return {
          color: 'bg-red-400',
          text: '后端服务连接失败',
          animate: { scale: [1, 1.1, 1] }
        };
      case 'checking':
        return {
          color: 'bg-yellow-400',
          text: '检测后端服务状态...',
          animate: { scale: [1, 1.2, 1] }
        };
    }
  };

  const statusInfo = getStatusIndicator();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      {/* 背景装饰 - 使用提升的静态 JSX */}
      {BackgroundDecoration}

      {/* 右上角错误提示 */}
      <AnimatePresence>
        {showErrorToast && error && (
          <motion.div
            className="fixed top-4 right-4 z-50 max-w-sm"
            initial={{ opacity: 0, x: 100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.8 }}
            transition={{ type: "spring", duration: 0.4 }}
          >
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    error.type === ErrorType.NETWORK ? 'bg-red-100' :
                    error.type === ErrorType.AUTH ? 'bg-yellow-100' : 'bg-red-100'
                  }`}>
                    <svg className={`w-4 h-4 ${
                      error.type === ErrorType.NETWORK ? 'text-red-600' :
                      error.type === ErrorType.AUTH ? 'text-yellow-600' : 'text-red-600'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-3 flex-1">
                  <h4 className="text-sm font-medium text-gray-900">
                    {error.title}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {error.message}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {error.suggestion}
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <button
                    onClick={closeErrorToast}
                    className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 主登录卡片 */}
      <motion.div 
        className="w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* 头部信息 */}
        <motion.div 
          className="text-center mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <motion.div 
            className="flex justify-center mb-6"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <div className="relative">
              <motion.div 
                className="absolute inset-0 bg-blue-200 rounded-2xl blur-xl opacity-30"
                animate={{ opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <div className="relative bg-white p-4 rounded-2xl shadow-lg border border-gray-100">
                <Image
                  src="/logo.png"
                  alt="徐汇区中心医院"
                  width={64}
                  height={64}
                  className="rounded-xl"
                  priority
                />
              </div>
            </div>
          </motion.div>
          
          <Heading level={1} className="text-gray-900 text-2xl font-bold mb-2">
            徐汇区中心医院
          </Heading>
          <Text className="text-gray-600 mb-4">
            实验室信息管理系统
          </Text>
          {/* 实时状态指示器 */}
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
            <motion.div 
              className={`w-2 h-2 ${statusInfo.color} rounded-full`}
              animate={statusInfo.animate}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="font-mono text-xs">{statusInfo.text}</span>
          </div>
        </motion.div>

        {/* 登录表单 */}
        <motion.div 
          className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <motion.div 
              className="space-y-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  用户名
                </label>
                <div className="relative">
                  <Input
                    id="username"
                    type="text"
                    autoComplete="username"
                    required
                    placeholder="请输入用户名"
                    {...register('username', { required: '请输入用户名' })}
                  />
                </div>
                {errors.username && (
                  <motion.p 
                    className="mt-2 text-sm text-red-600"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    {errors.username.message}
                  </motion.p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  密码
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    placeholder="请输入密码"
                    {...register('password', { required: '请输入密码' })}
                  />
                </div>
                {errors.password && (
                  <motion.p 
                    className="mt-2 text-sm text-red-600"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    {errors.password.message}
                  </motion.p>
                )}
              </div>
            </motion.div>

            <motion.div 
              className="pt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Button
                  type="submit"
                  disabled={isLoading}
                  color="dark"
                  className="w-full h-12 text-base font-medium"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <motion.div
                        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      <span>登录中...</span>
                    </div>
                  ) : (
                    '登录'
                  )}
                </Button>
              </motion.div>
            </motion.div>
          </form>

          {/* 测试账号 */}
          <motion.div 
            className="mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center">
                <motion.button
                  type="button"
                  onClick={() => setShowTestAccounts(!showTestAccounts)}
                  className="bg-white px-4 py-1 text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200 rounded-full border border-gray-200 hover:border-gray-300"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {showTestAccounts ? '隐藏' : '显示'}测试账号
                </motion.button>
              </div>
            </div>

            <AnimatePresence>
              {showTestAccounts && (
                <motion.div 
                  className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    测试账号
                  </h4>
                  <div className="space-y-2 text-sm">
                    <motion.div 
                      className="flex justify-between items-center p-3 bg-white rounded-lg border"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <div>
                        <div className="font-medium text-gray-800">项目负责人</div>
                        <div className="text-gray-600 font-mono text-xs">project_lead / project123</div>
                      </div>
                    </motion.div>
                    <motion.div 
                      className="flex justify-between items-center p-3 bg-white rounded-lg border"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <div>
                        <div className="font-medium text-gray-800">分析测试主管</div>
                        <div className="text-gray-600 font-mono text-xs">test_manager / test123</div>
                      </div>
                    </motion.div>
                    <motion.div 
                      className="flex justify-between items-center p-3 bg-white rounded-lg border"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <div>
                        <div className="font-medium text-gray-800">研究室主任</div>
                        <div className="text-gray-600 font-mono text-xs">lab_director / director123</div>
                      </div>
                    </motion.div>
                    <motion.div 
                      className="flex justify-between items-center p-3 bg-white rounded-lg border"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <div>
                        <div className="font-medium text-gray-800">样本管理员</div>
                        <div className="text-gray-600 font-mono text-xs">sample_admin / sample123</div>
                      </div>
                    </motion.div>
                    <motion.div 
                      className="flex justify-between items-center p-3 bg-white rounded-lg border"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 }}
                    >
                      <div>
                        <div className="font-medium text-gray-800">分析员 (实验人员)</div>
                        <div className="text-gray-600 font-mono text-xs">analyst / analyst123</div>
                      </div>
                    </motion.div>
                    <motion.div 
                      className="flex justify-between items-center p-3 bg-white rounded-lg border"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 }}
                    >
                      <div>
                        <div className="font-medium text-gray-800">系统管理员</div>
                        <div className="text-gray-600 font-mono text-xs">admin / admin123</div>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>

        {/* 底部信息 - 使用提升的静态 JSX */}
        {FooterInfo}
      </motion.div>

      {/* 强制修改密码对话框 */}
      <ForcePasswordChangeDialog
        open={forcePasswordChangeOpen}
        onClose={() => setForcePasswordChangeOpen(false)}
        onSuccess={async () => {
          setForcePasswordChangeOpen(false);
          toast.success('密码修改成功');
          // 等待一小段时间确保状态更新
          await new Promise(resolve => setTimeout(resolve, 100));
          router.push('/');
        }}
        passwordExpired={passwordExpired}
      />
    </div>
  );
}