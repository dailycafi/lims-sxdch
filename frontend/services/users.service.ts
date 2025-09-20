import { api } from '@/lib/api';
import { User } from '@/types/api';

export interface UserCreate {
  username: string;
  full_name: string;
  email: string;
  role: string;
  password: string;
}

export interface UserUpdate {
  full_name?: string;
  email?: string;
  role?: string;
  is_active?: boolean;
}

export class UsersService {
  /**
   * 获取用户列表
   */
  static async getUsers(params?: {
    skip?: number;
    limit?: number;
  }): Promise<User[]> {
    const response = await api.get<User[]>('/users', { params });
    return response.data;
  }

  /**
   * 获取单个用户详情
   */
  static async getUser(id: number): Promise<User> {
    const response = await api.get<User>(`/users/${id}`);
    return response.data;
  }

  /**
   * 创建新用户
   */
  static async createUser(data: UserCreate): Promise<User> {
    const response = await api.post<User>('/users', data);
    return response.data;
  }

  /**
   * 更新用户
   */
  static async updateUser(id: number, data: UserUpdate): Promise<User> {
    const response = await api.patch<User>(`/users/${id}`, data);
    return response.data;
  }

  /**
   * 重置用户密码
   */
  static async resetPassword(id: number, newPassword: string): Promise<void> {
    await api.post(`/users/${id}/reset-password`, { new_password: newPassword });
  }
}
