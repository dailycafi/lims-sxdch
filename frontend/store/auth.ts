import { create } from 'zustand';
import { authAPI } from '@/lib/api';
import { tokenManager } from '@/lib/token-manager';

interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  is_superuser: boolean;
  created_at?: string;
  updated_at?: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  
  login: async (username: string, password: string) => {
    try {
      const loginResponse = await authAPI.login(username, password);
      
      // 确保 token 已经保存
      if (!loginResponse.access_token) {
        throw new Error('登录失败：未收到访问令牌');
      }
      
      // token 已经通过 tokenManager 保存，并自动更新到 axios
      // 直接获取用户信息
      const user = await authAPI.getCurrentUser();
      set({ user, isAuthenticated: true });
    } catch (error: any) {
      // 增强错误信息
      if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
        const networkError = new Error('服务器连接失败');
        networkError.name = 'NetworkError';
        (networkError as any).code = 'NETWORK_ERROR';
        throw networkError;
      }
      
      if (error.response?.status === 401) {
        const authError = new Error('用户名或密码错误');
        authError.name = 'AuthError';
        (authError as any).response = error.response;
        throw authError;
      }
      
      if (error.response?.status >= 500) {
        const serverError = new Error('服务器内部错误');
        serverError.name = 'ServerError';
        (serverError as any).response = error.response;
        throw serverError;
      }
      
      // 重新抛出原始错误
      throw error;
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
