import { api } from '../lib/api';

export interface SystemSetting {
  key: string;
  value: any;
  description?: string;
  updated_at?: string;
}

export const SettingsService = {
  async getSettings(): Promise<SystemSetting[]> {
    const response = await api.get<SystemSetting[]>('/global-params/settings');
    return response.data;
  },

  async getSetting(key: string): Promise<SystemSetting> {
    const response = await api.get<SystemSetting>(`/global-params/settings/${key}`);
    return response.data;
  },

  async updateSetting(key: string, value: any): Promise<SystemSetting> {
    const response = await api.put<SystemSetting>(`/global-params/settings/${key}`, { value });
    return response.data;
  }
};

