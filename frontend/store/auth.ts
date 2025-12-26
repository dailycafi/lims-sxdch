import { create } from 'zustand';
import { toast } from 'react-hot-toast';
import { authAPI } from '@/lib/api';
import { tokenManager } from '@/lib/token-manager';
import type { RoleSimple } from '@/types/api';

interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
  roles?: RoleSimple[];
  is_active: boolean;
  is_superuser: boolean;
  created_at?: string;
  updated_at?: string;
}

interface LoginResult {
  success: boolean;
  error?: {
    type: 'network' | 'auth' | 'server' | 'unknown';
    message: string;
    status?: number;
  };
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  
  login: async (username: string, password: string): Promise<LoginResult> => {
    try {
      const loginResponse = await authAPI.login(username, password);
      
      // 确保 token 已经保存
      if (!loginResponse.access_token) {
        return {
          success: false,
          error: {
            type: 'unknown',
            message: '登录失败：未收到访问令牌'
          }
        };
      }
      
      // token 已经通过 tokenManager 保存，并自动更新到 axios
      // 直接获取用户信息
      const user = await authAPI.getCurrentUser();
      set({ user, isAuthenticated: true });
      
      // 登录成功后，强制移除可能存在的 auth-expired toast
      toast.remove('auth-expired');
      
      return { success: true };
    } catch (error: any) {
      // 返回错误对象而不是抛出，避免 Next.js 开发模式的错误覆盖层
      if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
        return {
          success: false,
          error: {
            type: 'network',
            message: '无法连接到服务器'
          }
        };
      }
      
      if (error.response?.status === 401 || error.response?.status === 422) {
        return {
          success: false,
          error: {
            type: 'auth',
            message: '用户名或密码错误',
            status: error.response.status
          }
        };
      }
      
      if (error.response?.status >= 500) {
        return {
          success: false,
          error: {
            type: 'server',
            message: '服务器内部错误',
            status: error.response.status
          }
        };
      }
      
      return {
        success: false,
        error: {
          type: 'unknown',
          message: error.message || '发生未知错误'
        }
      };
    }
  },
  
  logout: async () => {
    await authAPI.logout();
    set({ user: null, isAuthenticated: false });
  },
  
  checkAuth: async () => {
    try {
      const token = tokenManager.getToken();
      if (!token) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }
      
      const user = await authAPI.getCurrentUser();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
  
  setUser: (user: User | null) => {
    set({ user, isAuthenticated: Boolean(user) });
  },
}));
