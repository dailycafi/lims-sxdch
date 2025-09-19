import axios, { AxiosError, CanceledError } from 'axios';
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

// 统一的认证状态标记（请求/响应拦截器都要用）
let isRedirecting = false;
let hasShownAuthExpiredToast = false;

// 提取后端返回的可读错误信息（兼容 FastAPI/通用后端返回格式）
const extractDetailMessage = (data: any): string | null => {
  if (!data) return null;
  if (typeof data === 'string') return data;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail) && data.detail.length > 0) {
    const first = data.detail[0];
    if (typeof first === 'string') return first;
    if (first?.msg) return first.msg;
    if (first?.message) return first.message;
    if (Array.isArray(first?.loc)) {
      const locStr = first.loc.join('.')
      const text = first.msg || first.message || '';
      return text ? `${locStr}: ${text}` : locStr;
    }
  }
  if (data.message) return data.message;
  if (data.error) return data.error;
  return null;
};

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
      const url = config.url || '';
      const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/me');
      
      if ((window as any).__DEBUG_API__) {
        console.log('[API Debug] Request to:', config.url);
        console.log('[API Debug] Token from localStorage:', token ? token.substring(0, 20) + '...' : 'null');
        console.log('[API Debug] Headers before:', {...config.headers});
      }
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else if (!isAuthEndpoint) {
        // 无 token 的情况下，直接触发登录过期提示并取消请求，避免 401 错误弹出
        if (!hasShownAuthExpiredToast && !isRedirecting) {
          hasShownAuthExpiredToast = true;
          import('@/components/auth-expired-toast')
            .then((m) => m.showAuthExpiredToast())
            .catch(() => {});
        }
        ;(config as any)._suppressErrorToast = true;
        return Promise.reject(new CanceledError('AUTH_REQUIRED'));
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

// 添加一个防止重复错误提示的机制
let lastErrorTime = 0;
let lastErrorMessage = '';
const ERROR_THROTTLE_TIME = 2000; // 2秒内相同错误不重复提示

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<any>) => {
    // 取消的请求不提示错误
    if (axios.isCancel && axios.isCancel(error)) {
      return Promise.reject(error);
    }

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

      // 若请求标记为 _suppressErrorToast，则静默处理（不再 toast.error），避免“先报401再弹登录”
      ;(error as any)._suppressErrorToast = true;
      return Promise.reject(error);
    }
    
    // 处理其他错误 - 但避免重复提示
    if (!isRedirecting) {
      const now = Date.now();
      let errorMessage = '';
      
      const status = error.response?.status;
      if (status === 403) {
        errorMessage = '没有权限执行此操作';
      } else if (status === 404) {
        errorMessage = '资源不存在或已删除';
      } else if (status === 429) {
        errorMessage = '请求过于频繁，请稍后再试';
      } else if (status === 500) {
        // 优先展示后端返回的具体信息
        errorMessage = extractDetailMessage(error.response?.data) || '服务器错误，请稍后重试';
      } else if (status === 400 || status === 422) {
        // 处理参数/验证错误
        errorMessage = extractDetailMessage(error.response?.data) || '数据验证失败';
      } else if (!error.response) {
        // 网络异常或超时
        errorMessage = '网络异常，请检查网络连接或稍后重试';
      }

      // 若仍无明确文案，尝试兜底提取
      if (!errorMessage) {
        errorMessage = extractDetailMessage(error.response?.data) || error.message || '请求失败，请稍后重试';
      }
      
      // 防止重复显示相同的错误
      // 若请求或错误被标记为需要静默（例如未登录触发），则不提示错误
      if ((error as any)?._suppressErrorToast || (error.config as any)?._suppressErrorToast) {
        return Promise.reject(error);
      }
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
