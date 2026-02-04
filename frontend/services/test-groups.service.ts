import { api } from '@/lib/api';

export interface CollectionPointItem {
  code: string;
  name: string;
}

export interface DetectionConfigItem {
  test_type: string;
  sample_type?: string;
  primary_sets: number;
  backup_sets: number;
  collection_points?: CollectionPointItem[];  // 该检测类型对应的采集点列表
}

export interface TestGroup {
  id: number;
  project_id: number;
  name?: string;  // 可选的试验组名称
  cycle?: string;
  dosage?: string;
  planned_count: number;
  backup_count: number;
  subject_prefix?: string;
  subject_start_number: number;
  // 多检测类型配置
  detection_configs?: DetectionConfigItem[];
  collection_points?: CollectionPointItem[];
  is_confirmed: boolean;
  confirmed_at?: string;
  confirmed_by?: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at?: string;
  created_by?: number;
  generated_subjects?: string[];
}

export interface TestGroupCreate {
  project_id: number;
  name?: string;  // 可选的试验组名称
  cycle?: string;
  dosage?: string;
  planned_count?: number;
  backup_count?: number;
  subject_prefix?: string;
  subject_start_number?: number;
  // 多检测类型配置
  detection_configs?: DetectionConfigItem[];
  collection_points?: CollectionPointItem[];
  display_order?: number;
}

export interface TestGroupUpdate {
  name?: string;  // 可选的试验组名称
  cycle?: string;
  dosage?: string;
  planned_count?: number;
  backup_count?: number;
  subject_prefix?: string;
  subject_start_number?: number;
  // 多检测类型配置
  detection_configs?: DetectionConfigItem[];
  collection_points?: CollectionPointItem[];
  display_order?: number;
  audit_reason?: string;
}

export interface CollectionPoint {
  id: number;
  project_id?: number;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at?: string;
}

export const testGroupsAPI = {
  // 获取项目的试验组列表
  getTestGroups: async (projectId: number): Promise<TestGroup[]> => {
    const response = await api.get(`/projects/${projectId}/test-groups`);
    return response.data;
  },

  // 获取单个试验组
  getTestGroup: async (testGroupId: number): Promise<TestGroup> => {
    const response = await api.get(`/test-groups/${testGroupId}`);
    return response.data;
  },

  // 创建试验组
  createTestGroup: async (data: TestGroupCreate): Promise<TestGroup> => {
    const response = await api.post('/test-groups', data);
    return response.data;
  },

  // 更新试验组
  updateTestGroup: async (testGroupId: number, data: TestGroupUpdate): Promise<TestGroup> => {
    const response = await api.put(`/test-groups/${testGroupId}`, data);
    return response.data;
  },

  // 删除试验组
  deleteTestGroup: async (testGroupId: number): Promise<void> => {
    await api.delete(`/test-groups/${testGroupId}`);
  },

  // 确认试验组
  confirmTestGroup: async (testGroupId: number, password: string, reason?: string): Promise<TestGroup> => {
    const response = await api.post(`/test-groups/${testGroupId}/confirm`, { password, reason });
    return response.data;
  },

  // 复制试验组
  copyTestGroup: async (sourceId: number): Promise<TestGroup> => {
    const response = await api.post('/test-groups/copy', { source_id: sourceId });
    return response.data;
  },

  // 复制试验组并覆盖数据
  copyTestGroupWithData: async (sourceId: number, overrideData: Partial<TestGroupCreate>): Promise<TestGroup> => {
    const response = await api.post('/test-groups/copy', {
      source_id: sourceId,
      ...overrideData
    });
    return response.data;
  },

  // 获取项目的采集点列表
  getCollectionPoints: async (projectId: number): Promise<CollectionPoint[]> => {
    const response = await api.get(`/projects/${projectId}/collection-points`);
    return response.data;
  },

  // 创建采集点
  createCollectionPoint: async (data: { project_id?: number; code: string; name: string; description?: string; display_order?: number }): Promise<CollectionPoint> => {
    const response = await api.post('/collection-points', data);
    return response.data;
  },

  // 更新采集点
  updateCollectionPoint: async (pointId: number, data: { code?: string; name?: string; description?: string; display_order?: number; audit_reason: string }): Promise<CollectionPoint> => {
    const response = await api.put(`/collection-points/${pointId}`, data);
    return response.data;
  },

  // 删除采集点
  deleteCollectionPoint: async (pointId: number): Promise<void> => {
    await api.delete(`/collection-points/${pointId}`);
  },
};
