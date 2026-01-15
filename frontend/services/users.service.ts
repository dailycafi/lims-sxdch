import { api } from '@/lib/api';
import { User, UserCreate, UserUpdate, UserDelete, UserCreateResponse } from '@/types/api';

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
   * 密码由系统自动生成，返回包含初始密码
   */
  static async createUser(data: UserCreate): Promise<UserCreateResponse> {
    const response = await api.post<UserCreateResponse>('/users', data);
    return response.data;
  }

  /**
   * 更新用户
   * 编辑其他用户时需要提供审计信息（理由、用户名、密码）
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
   * 需要提供审计信息（理由、用户名、密码）
   */
  static async deleteUser(id: number, data: UserDelete): Promise<void> {
    await api.delete(`/users/${id}`, { data });
  }
}
