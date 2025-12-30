import { api } from '@/lib/api';
import { 
  Organization, 
  OrganizationCreate, 
  OrganizationUpdate,
  OrganizationType,
  OrganizationTypeCreate,
  OrganizationTypeUpdate,
  SampleType,
  SampleTypeCreate,
  SampleTypeUpdate
} from '@/types/api';

export class GlobalParamsService {
  // 组织类型管理
  /**
   * 获取组织类型列表
   */
  static async getOrganizationTypes(): Promise<OrganizationType[]> {
    const response = await api.get<OrganizationType[]>('/global-params/organization-types');
    return response.data;
  }

  /**
   * 创建组织类型
   */
  static async createOrganizationType(data: OrganizationTypeCreate): Promise<OrganizationType> {
    const response = await api.post<OrganizationType>('/global-params/organization-types', data);
    return response.data;
  }

  /**
   * 更新组织类型
   */
  static async updateOrganizationType(id: number, data: OrganizationTypeUpdate): Promise<OrganizationType> {
    const response = await api.put<OrganizationType>(`/global-params/organization-types/${id}`, data);
    return response.data;
  }

  /**
   * 删除组织类型
   */
  static async deleteOrganizationType(id: number): Promise<void> {
    await api.delete(`/global-params/organization-types/${id}`);
  }

  // 组织管理
  /**
   * 获取组织列表
   */
  static async getOrganizations(params?: { org_type?: string; q?: string }): Promise<Organization[]> {
    const response = await api.get<Organization[]>('/global-params/organizations', { params });
    return response.data;
  }

  /**
   * 创建组织
   */
  static async createOrganization(data: OrganizationCreate): Promise<Organization> {
    const response = await api.post<Organization>('/global-params/organizations', data);
    return response.data;
  }

  /**
   * 更新组织
   */
  static async updateOrganization(id: number, data: OrganizationUpdate): Promise<Organization> {
    const response = await api.put<Organization>(`/global-params/organizations/${id}`, data);
    return response.data;
  }

  /**
   * 删除组织
   */
  static async deleteOrganization(id: number): Promise<void> {
    await api.delete(`/global-params/organizations/${id}`);
  }

  // 样本类型管理
  /**
   * 获取样本类型列表
   */
  static async getSampleTypes(): Promise<SampleType[]> {
    const response = await api.get<SampleType[]>('/global-params/sample-types');
    return response.data;
  }

  /**
   * 创建样本类型
   */
  static async createSampleType(data: SampleTypeCreate): Promise<SampleType> {
    const response = await api.post<SampleType>('/global-params/sample-types', data);
    return response.data;
  }

  /**
   * 更新样本类型
   */
  static async updateSampleType(id: number, data: SampleTypeUpdate): Promise<SampleType> {
    const response = await api.put<SampleType>(`/global-params/sample-types/${id}`, data);
    return response.data;
  }

  /**
   * 删除样本类型
   */
  static async deleteSampleType(id: number): Promise<void> {
    await api.delete(`/global-params/sample-types/${id}`);
  }
}
