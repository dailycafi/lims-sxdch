import axios, { AxiosError } from 'axios';
import { toast } from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// 创建axios实例
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
let isRedirecting = false; // 防止多次重定向

// 添加一个防止重复错误提示的机制
let lastErrorTime = 0;
let lastErrorMessage = '';
const ERROR_THROTTLE_TIME = 2000; // 2秒内相同错误不重复提示

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<any>) => {
    // 处理 401 错误 - 只显示一次提示
    if (error.response?.status === 401 && !isRedirecting) {
      isRedirecting = true;
      localStorage.removeItem('access_token');
      toast.error('登录已过期，请重新登录');
      setTimeout(() => {
        window.location.href = '/login';
      }, 100);
      // 返回一个不会触发额外错误处理的 rejected promise
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
      localStorage.setItem('access_token', response.data.access_token);
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
