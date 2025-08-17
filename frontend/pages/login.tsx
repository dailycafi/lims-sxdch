import { useState } from 'react';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';

interface LoginForm {
  username: string;
  password: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showTestAccounts, setShowTestAccounts] = useState(false);
  const login = useAuthStore((state) => state.login);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    try {
      setIsLoading(true);
      await login(data.username, data.password);
      router.push('/');
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      {/* 背景装饰 */}
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
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
            <motion.div 
              className="w-2 h-2 bg-green-400 rounded-full"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="font-mono text-xs">系统运行正常</span>
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
                  color="blue"
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
                      <div className="font-medium text-gray-800">管理员</div>
                      <div className="text-gray-600 font-mono text-xs">admin / admin123</div>
                    </div>
                  </motion.div>
                  <motion.div 
                    className="flex justify-between items-center p-3 bg-white rounded-lg border"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div>
                      <div className="font-medium text-gray-800">样本管理员</div>
                      <div className="text-gray-600 font-mono text-xs">sample_admin / sample123</div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>

        {/* 底部信息 */}
        <motion.div 
          className="mt-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
        >
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>数据传输加密保护</span>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            <span>© 2024 徐汇区中心医院</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
