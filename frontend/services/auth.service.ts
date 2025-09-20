import { api } from '@/lib/api';
import { tokenManager } from '@/lib/token-manager';
import { LoginRequest, LoginResponse, User } from '@/types/api';

export class AuthService {
  /**
   * 用户登录
   */
  static async login(data: LoginRequest): Promise<LoginResponse> {
    const formData = new FormData();
    formData.append('username', data.username);
    formData.append('password', data.password);
    
    const response = await api.post<LoginResponse>('/auth/login', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    if (response.data.access_token) {
      tokenManager.setTokens(response.data.access_token, response.data.refresh_token);
    }
    
    return response.data;
  }

  /**
   * 获取当前用户信息
   */
  static async getCurrentUser(): Promise<User> {
    const response = await api.get<User>('/auth/me');
    return response.data;
  }

  /**
   * 退出登录
   */
  static logout(): void {
    const refreshToken = tokenManager.getRefreshToken();
    if (refreshToken) {
      api.post('/auth/logout', { refresh_token: refreshToken }).catch(() => {
        // 无需处理失败，继续清理本地状态
      });
    }
    tokenManager.clearTokens();
  }
}
