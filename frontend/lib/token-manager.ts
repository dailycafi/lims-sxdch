/**
 * Token 管理器
 * 集中管理 token 的存储和获取，确保一致性
 */

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

class TokenManager {
  private static instance: TokenManager;
  private listeners: Set<(token: string | null) => void> = new Set();

  private constructor() {}

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * 设置 token
   */
  setToken(token: string): void {
    this.setTokens(token);
  }

  /**
   * 同步设置 access/refresh token
   */
  setTokens(accessToken: string, refreshToken?: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
    // 通知所有监听器
    this.notifyListeners(accessToken);
  }

  /**
   * 获取 token
   */
  getToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  /**
   * 获取 refresh token
   */
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  /**
   * 移除 token
   */
  removeToken(): void {
    this.clearTokens();
  }

  /**
   * 清理 access/refresh token
   */
  clearTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    // 通知所有监听器
    this.notifyListeners(null);
  }

  /**
   * 添加 token 变化监听器
   */
  addListener(listener: (token: string | null) => void): () => void {
    this.listeners.add(listener);
    // 返回取消监听的函数
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(token: string | null): void {
    this.listeners.forEach(listener => {
      listener(token);
    });
  }
}

export const tokenManager = TokenManager.getInstance();
