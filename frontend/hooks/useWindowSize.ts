import { useState, useEffect } from 'react';

interface WindowSize {
  width: number | undefined;
  height: number | undefined;
}

export function useWindowSize(): WindowSize {
  // 初始状态为undefined，这样服务器端渲染时不会出错
  const [windowSize, setWindowSize] = useState<WindowSize>({
    width: undefined,
    height: undefined,
  });

  useEffect(() => {
    // 只在客户端执行
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    // 添加事件监听
    window.addEventListener('resize', handleResize);

    // 首次调用以设置初始值
    handleResize();

    // 清理函数
    return () => window.removeEventListener('resize', handleResize);
  }, []); // 空依赖数组，表示只在组件挂载和卸载时执行

  return windowSize;
}

