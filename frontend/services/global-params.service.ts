import { api } from '@/lib/api';
import { 
  Organization, 
  OrganizationCreate, 
  OrganizationUpdate,
  SampleType,
  SampleTypeCreate,
  SampleTypeUpdate
} from '@/types/api';

export class GlobalParamsService {
  // 组织管理
  /**
   * 获取组织列表
   */
  static async getOrganizations(orgType?: 'internal' | 'external'): Promise<Organization[]> {
    const params = orgType ? { org_type: orgType } : undefined;
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
