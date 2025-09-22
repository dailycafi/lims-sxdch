import { api } from '@/lib/api';

export interface AccessRecord {
  path: string;
  title: string;
  icon?: string;
  access_count: number;
  last_accessed_at?: string;
}

export class UserAccessService {
  /**
   * 记录用户访问页面
   */
  static async trackAccess(path: string, title: string, icon?: string): Promise<void> {
    try {
      await api.post('/user-access/track', null, {
        params: { path, title, icon }
      });
    } catch (error) {
      // 访问记录失败不应该影响用户体验，静默处理
      console.warn('Failed to track user access:', error);
    }
  }

  /**
   * 获取用户最常访问的页面
   */
  static async getFrequentAccess(limit: number = 6): Promise<AccessRecord[]> {
    try {
      const response = await api.get<AccessRecord[]>('/user-access/frequent', {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get frequent access:', error);
      return [];
    }
  }

  /**
   * 获取用户最近访问的页面
   */
  static async getRecentAccess(limit: number = 6): Promise<AccessRecord[]> {
    try {
      const response = await api.get<AccessRecord[]>('/user-access/recent', {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get recent access:', error);
      return [];
    }
  }
}
