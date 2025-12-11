import axios, { AxiosError, CanceledError } from 'axios';
import { toast } from 'react-hot-toast';
import { tokenManager } from './token-manager';

// 添加全局调试标志
if (typeof window !== 'undefined') {
  (window as any).__DEBUG_API__ = true;
}

// 根据环境自动选择 URL
const getApiUrl = () => {
  // 优先使用环境变量
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // 在开发环境下，直接请求后端，绕过 Next.js 代理
  // 这样可以避免代理过程中 header 丢失或重写问题
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    return 'http://localhost:8002/api/v1';
  }
  
  // 在浏览器端（客户端），始终使用相对路径 '/api/v1'
  // 这会通过 next.config.js 中的 rewrites 代理到后端
  // 从而避免 CORS 问题和端口硬编码问题
  if (typeof window !== 'undefined') {
    return '/api/v1';
  }
  
  // 在服务端渲染 (SSR) 时，必须使用完整的绝对路径
  // 因为 SSR 是在 Node.js 容器内执行，无法像浏览器那样自动推断域名
  return 'http://localhost:8000/api/v1';
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
  paramsSerializer: {
    serialize: (params) => {
      const searchParams = new URLSearchParams();
      for (const key in params) {
        const value = params[key];
        if (Array.isArray(value)) {
          value.forEach((v) => searchParams.append(key, v));
        } else if (value !== undefined && value !== null) {
          searchParams.append(key, value);
        }
      }
      return searchParams.toString();
    }
  }
});

// 后端状态检测功能
export const backendStatusAPI = {
  /**
   * 检测后端服务器是否可用
   * @returns Promise<boolean> true表示后端可用，false表示不可用
   */
  checkStatus: async (): Promise<boolean> => {
    try {
      console.log('[Backend Status] 开始检测后端服务器状态...');
      
      // 创建独立的 axios 实例，不使用拦截器
      const statusChecker = axios.create({
        baseURL: API_URL,
        timeout: 3000,
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      // 尝试访问一个简单的接口
      const response = await statusChecker.get('/auth/me', {
        validateStatus: (status) => {
          // 401 表示服务器正常但未认证，这也算连接成功
          console.log('[Backend Status] 收到响应状态码:', status);
          return status < 500;
        }
      });
      
      console.log('[Backend Status] 后端服务器连接成功');
      return true;
    } catch (err: any) {
      console.log('[Backend Status] 后端服务器连接失败:', err);
      console.log('[Backend Status] 错误代码:', err.code);
      console.log('[Backend Status] 错误消息:', err.message);
      console.log('[Backend Status] 错误名称:', err.name);
      
      // 检查各种网络错误情况
      const isNetworkError = (
        err.code === 'ECONNREFUSED' ||
        err.code === 'ERR_NETWORK' ||
        err.code === 'NETWORK_ERROR' ||
        err.code === 'ECONNABORTED' ||
        err.code === 'ETIMEDOUT' ||
        err.message?.includes('Network Error') ||
        err.message?.includes('timeout') ||
        !err.response
      );
      
      if (isNetworkError) {
        console.log('[Backend Status] 确认为网络连接错误');
        return false;
      }
      
      // 其他错误也认为服务器不可用
      console.log('[Backend Status] 其他错误，认为服务器不可用');
      return false;
    }
  }
};

// 统一的认证状态标记（请求/响应拦截器都要用）
let isRedirecting = false;
let hasShownAuthExpiredToast = false;
let loginCooldownUntil = 0; // 登录后的冷却期，防止立即显示 auth expired toast

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (error: any) => void;
  config: any;
};

let isRefreshing = false;
const pendingRequests: PendingRequest[] = [];

// 这些端点不需要认证，或者认证失败时不应尝试刷新 token
const AUTH_ENDPOINTS = ['/auth/login', '/auth/refresh'];

const triggerAuthExpired = () => {
  // 检查是否已经在登录页面，如果是则不显示弹窗
  if (typeof window !== 'undefined' && window.location.pathname === '/login') {
    return;
  }
  
  // 检查是否在登录冷却期内（登录成功后 3 秒内不显示 toast）
  if (Date.now() < loginCooldownUntil) {
    console.log('[API] Skipping auth expired toast - in login cooldown period');
    return;
  }
  
  if (!hasShownAuthExpiredToast && !isRedirecting) {
    hasShownAuthExpiredToast = true;
    import('@/components/auth-expired-toast')
      .then((m) => m.showAuthExpiredToast())
      .catch(() => {});
  }
};

const addPendingRequest = (config: any, resolve: (value: any) => void, reject: (error: any) => void) => {
  config._retry = true;
  pendingRequests.push({ config, resolve, reject });
};

const processPendingRequests = () => {
  while (pendingRequests.length > 0) {
    const { config, resolve, reject } = pendingRequests.shift()!;
    api.request(config).then(resolve).catch(reject);
  }
};

const clearPendingRequests = (error: any) => {
  while (pendingRequests.length > 0) {
    const { reject } = pendingRequests.shift()!;
    reject(error);
  }
};

const refreshTokenAPI = {
  refresh: async (refreshToken: string) => {
    // 修改：发送 JSON 数据而不是 FormData
    const response = await api.post('/auth/refresh', {
      refresh_token: refreshToken,
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
      _skipAuth: true,
    } as any);
    
    if (response.data.access_token) {
      tokenManager.setTokens(response.data.access_token, response.data.refresh_token || refreshToken);
    }
    
    return response.data;
  },
};

// 处理 401 错误的辅助函数
const handle401Error = (error: AxiosError<any>) => {
  // 如果在登录页面，直接返回错误，不触发认证过期处理
  if (typeof window !== 'undefined' && window.location.pathname === '/login') {
    return Promise.reject(error);
  }
  
  // 触发认证过期处理
  triggerAuthExpired();
  
  // 返回一个静默的认证错误，不显示错误提示
  return Promise.reject(createSilentAuthError(error));
};

const createSilentAuthError = (error: AxiosError<any>) => ({
  name: 'AuthenticationExpired',
  message: 'Authentication expired',
  isAuthError: true,
  response: error.response,
  config: error.config,
  _suppressErrorToast: true,
  _isSilent: true,
  code: error.code,
  request: error.request,
});

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
      const url = config.url || '';
      const isAuthEndpoint = AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
      const skipAuth = Boolean((config as any)._skipAuth);
      
      if (!skipAuth && !isAuthEndpoint) {
        const currentToken = tokenManager.getToken();
        if (currentToken) {
          config.headers = config.headers || {};
          config.headers['Authorization'] = `Bearer ${currentToken}`;
          console.log(`[API Request] ${url} - Token added (${currentToken.substring(0, 20)}...)`);
        } else {
          console.warn(`[API Request] ${url} - No token available!`);
        }
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
      // 设置 3 秒冷却期，防止登录后立即显示 auth expired toast
      loginCooldownUntil = Date.now() + 3000;
      hasShownAuthExpiredToast = false;
      // 登录成功后，强制移除可能存在的认证过期 toast
      toast.remove('auth-expired');
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

    // 处理 401 错误 - 优先尝试 refresh token
    if (error.response?.status === 401) {
      const originalRequest: any = error.config || {};
      const url: string = originalRequest.url || '';
      const isAuthEndpoint = AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
      const skipAuth = Boolean(originalRequest._skipAuth);
      const refreshToken = typeof window !== 'undefined' ? tokenManager.getRefreshToken() : null;

      if (!skipAuth && refreshToken && !isAuthEndpoint && !originalRequest._retry) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            addPendingRequest(originalRequest, resolve, reject);
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        return refreshTokenAPI.refresh(refreshToken)
          .then(() => {
            isRefreshing = false;
            processPendingRequests();
            return api.request(originalRequest);
          })
          .catch((refreshError) => {
            isRefreshing = false;
            clearPendingRequests(refreshError);
            return handle401Error(error);
          });
      } else {
        return handle401Error(error);
      }
    }

    // 其他错误处理
    const suppressErrorToast = Boolean((error as any)._suppressErrorToast);
    
    if (!suppressErrorToast && error.response && typeof window !== 'undefined') {
      const currentTime = Date.now();
      const detailMessage = extractDetailMessage(error.response.data);
      const displayMessage = detailMessage || `请求失败 (${error.response.status})`;
      
      // 防止重复错误提示
      if (currentTime - lastErrorTime > ERROR_THROTTLE_TIME || lastErrorMessage !== displayMessage) {
        lastErrorTime = currentTime;
        lastErrorMessage = displayMessage;
        
        toast.error(displayMessage, {
          duration: 4000,
          position: 'top-right',
        });
      }
    }

    return Promise.reject(error);
  }
);

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
      tokenManager.setTokens(response.data.access_token, response.data.refresh_token);
    }
    
    return response.data;
  },

  refresh: async (refreshToken: string) => {
    return refreshTokenAPI.refresh(refreshToken);
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  logout: async () => {
    const refreshToken = tokenManager.getRefreshToken();
    if (refreshToken) {
      try {
        await api.post('/auth/logout', { refresh_token: refreshToken });
      } catch (error) {
        // 忽略退出登录的错误
        console.warn('Logout request failed:', error);
      }
    }
    tokenManager.clearTokens();
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
