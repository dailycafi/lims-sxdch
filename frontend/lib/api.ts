import axios, { AxiosError } from 'axios';
import { toast } from 'react-hot-toast';
import { tokenManager } from './token-manager';

// 添加全局调试标志
if (typeof window !== 'undefined') {
  (window as any).__DEBUG_API__ = true;
}

// 根据环境自动选择 URL
const getApiUrl = () => {
  // 生产环境：使用相对路径（通过 nginx 或其他反向代理）
  if (process.env.NODE_ENV === 'production') {
    return process.env.NEXT_PUBLIC_API_URL || '/api/v1';
  }
  
  // 开发环境：直接调用后端（绕过有问题的 rewrites）
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
};

const API_URL = getApiUrl();

console.log('[API Module] Environment:', process.env.NODE_ENV);
console.log('[API Module] API URL:', API_URL);

// 创建axios实例
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 初始化时设置已存在的 token（仅在客户端）
if (typeof window !== 'undefined') {
  const existingToken = tokenManager.getToken();
  if (existingToken) {
    api.defaults.headers.common['Authorization'] = `Bearer ${existingToken}`;
    console.log('[API Init] Token set on module load');
  }
}

// 请求拦截器 - 确保每次请求都有最新的 token
api.interceptors.request.use(
  (config) => {
    // 强制从 localStorage 获取最新 token
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      
      if ((window as any).__DEBUG_API__) {
        console.log('[API Debug] Request to:', config.url);
        console.log('[API Debug] Token from localStorage:', token ? token.substring(0, 20) + '...' : 'null');
        console.log('[API Debug] Headers before:', {...config.headers});
      }
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      if ((window as any).__DEBUG_API__) {
        console.log('[API Debug] Headers after:', {...config.headers});
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 监听 token 变化，自动更新请求头
if (typeof window !== 'undefined') {
  tokenManager.addListener((token) => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      console.log('[API] Token updated via listener');
    } else {
      delete api.defaults.headers.common['Authorization'];
      console.log('[API] Token removed via listener');
    }
  });
}

// 响应拦截器
let isRedirecting = false; // 防止多次重定向（兼容保留）
let hasShownAuthExpiredToast = false; // 防止重复弹出

// 添加一个防止重复错误提示的机制
let lastErrorTime = 0;
let lastErrorMessage = '';
const ERROR_THROTTLE_TIME = 2000; // 2秒内相同错误不重复提示

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<any>) => {
    // 处理 401 错误 - 显示“登录已过期”，点击后登出并回登录页
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/me');

      if (!isAuthEndpoint && !hasShownAuthExpiredToast && !isRedirecting) {
        hasShownAuthExpiredToast = true;
        // 动态引入，避免潜在循环依赖
        import('@/components/auth-expired-toast')
          .then((m) => m.showAuthExpiredToast())
          .catch(() => {});
      }

      // 不向下传播该错误，避免页面出现“程序错误”或重复提示
      return new Promise(() => {});
    }
    
    // 处理其他错误 - 但避免重复提示
    if (!isRedirecting) {
      const now = Date.now();
      let errorMessage = '';
      
      if (error.response?.status === 403) {
        errorMessage = '没有权限执行此操作';
      } else if (error.response?.status === 500) {
        errorMessage = '服务器错误，请稍后重试';
      } else if (error.response?.status === 422) {
        // 处理验证错误
        const validationErrors = (error.response?.data as any)?.detail;
        if (Array.isArray(validationErrors) && validationErrors.length > 0) {
          // 只显示第一个验证错误
          errorMessage = validationErrors[0]?.msg || '数据验证失败';
        } else if (typeof validationErrors === 'string') {
          errorMessage = validationErrors;
        } else {
          errorMessage = '数据验证失败';
        }
      }
      
      // 防止重复显示相同的错误
      if (errorMessage && (errorMessage !== lastErrorMessage || now - lastErrorTime > ERROR_THROTTLE_TIME)) {
        toast.error(errorMessage);
        lastErrorMessage = errorMessage;
        lastErrorTime = now;
      }
    }
    
    return Promise.reject(error);
  }
);

// API 方法
export const authAPI = {
  login: async (username: string, password: string) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    
    const response = await api.post('/auth/login', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    if (response.data.access_token) {
      tokenManager.setToken(response.data.access_token);
    }
    
    return response.data;
  },
  
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

export const usersAPI = {
  getUsers: async () => {
    const response = await api.get('/users');
    return response.data;
  },
  
  createUser: async (userData: any) => {
    const response = await api.post('/users', userData);
    return response.data;
  },
  
  updateUser: async (userId: number, userData: any) => {
    const response = await api.patch(`/users/${userId}`, userData);
    return response.data;
  },
};

export const projectsAPI = {
  getProjects: async () => {
    const response = await api.get('/projects');
    return response.data;
  },
  
  createProject: async (projectData: any) => {
    const response = await api.post('/projects', projectData);
    return response.data;
  },
  
  getProject: async (projectId: number) => {
    const response = await api.get(`/projects/${projectId}`);
    return response.data;
  },
};

export const samplesAPI = {
  getSamples: async (params?: any) => {
    const response = await api.get('/samples', { params });
    return response.data;
  },
  
  createSamplesBatch: async (samples: any[]) => {
    const response = await api.post('/samples/batch', samples);
    return response.data;
  },
  
  updateSample: async (sampleId: number, data: any) => {
    const response = await api.patch(`/samples/${sampleId}`, data);
    return response.data;
  },
};
