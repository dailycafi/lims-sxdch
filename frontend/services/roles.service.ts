import { api } from '@/lib/api';
import { Role, RoleCreate, RoleUpdate, Permission } from '@/types/api';

export class RolesService {
  /**
   * 获取角色列表
   */
  static async getRoles(params?: {
    include_inactive?: boolean;
  }): Promise<Role[]> {
    const response = await api.get<Role[]>('/roles/roles', { params });
    return response.data;
  }

  /**
   * 获取单个角色详情
   */
  static async getRole(id: number): Promise<Role> {
    const response = await api.get<Role>(`/roles/roles/${id}`);
    return response.data;
  }

  /**
   * 创建新角色
   */
  static async createRole(data: RoleCreate): Promise<Role> {
    const response = await api.post<Role>('/roles/roles', data);
    return response.data;
  }

  /**
   * 更新角色
   */
  static async updateRole(id: number, data: RoleUpdate): Promise<Role> {
    const response = await api.patch<Role>(`/roles/roles/${id}`, data);
    return response.data;
  }

  /**
   * 删除角色
   */
  static async deleteRole(id: number): Promise<void> {
    await api.delete(`/roles/roles/${id}`);
  }

  /**
   * 获取权限列表
   */
  static async getPermissions(params?: {
    module?: string;
  }): Promise<Permission[]> {
    const response = await api.get<Permission[]>('/roles/permissions', { params });
    return response.data;
  }

  /**
   * 创建权限
   */
  static async createPermission(data: {
    code: string;
    name: string;
    description?: string;
    module: string;
  }): Promise<Permission> {
    const response = await api.post<Permission>('/roles/permissions', data);
    return response.data;
  }

  /**
   * 获取所有权限模块
   */
  static async getPermissionModules(): Promise<string[]> {
    const response = await api.get<{ modules: string[] }>('/roles/permissions/modules');
    return response.data.modules;
  }
}

