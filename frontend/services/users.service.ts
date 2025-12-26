import { api } from '@/lib/api';
import { User, UserCreate, UserUpdate } from '@/types/api';

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
   * 修改密码
   */
  static async changePassword(
    id: number,
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    await api.post(`/users/${id}/change-password`, {
      old_password: oldPassword,
      new_password: newPassword
    });
  }

  /**
   * 重置用户密码（管理员操作）
   */
  static async resetPassword(id: number, newPassword: string): Promise<void> {
    await api.post(`/users/${id}/reset-password`, { new_password: newPassword });
  }

  /**
   * 获取密码要求
   */
  static async getPasswordRequirements(): Promise<string[]> {
    const response = await api.get<{ requirements: string[] }>('/users/password-requirements/info');
    return response.data.requirements;
  }

  /**
   * 删除用户
   */
  static async deleteUser(id: number): Promise<void> {
    await api.delete(`/users/${id}`);
  }
}
