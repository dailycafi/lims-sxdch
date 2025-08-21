/**
 * Token 管理器
 * 集中管理 token 的存储和获取，确保一致性
 */

const TOKEN_KEY = 'access_token';

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
    localStorage.setItem(TOKEN_KEY, token);
    // 通知所有监听器
    this.notifyListeners(token);
  }

  /**
   * 获取 token
   */
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * 移除 token
   */
  removeToken(): void {
    localStorage.removeItem(TOKEN_KEY);
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
