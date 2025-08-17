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
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
      toast.error('登录已过期，请重新登录');
    } else if (error.response?.status === 403) {
      toast.error('没有权限执行此操作');
    } else if (error.response?.data && typeof error.response.data === 'object' && 'detail' in error.response.data) {
      toast.error(error.response.data.detail as string);
    } else {
      toast.error('操作失败，请稍后重试');
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
