import { api } from '@/lib/api';
import { TaskOverview } from '@/types/api';

export const TasksService = {
  async getTaskOverview(params?: { project_id?: number; limit?: number }) {
    const response = await api.get<TaskOverview>('/tasks', { params });
    return response.data;
  },
};
