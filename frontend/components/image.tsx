import NextImage, { ImageProps } from 'next/image';
import { forwardRef } from 'react';

// 自定义 Image 组件，过滤掉 fetchPriority 属性以避免 React 警告
export const Image = forwardRef<HTMLImageElement, ImageProps>(
  (props, ref) => {
    // 解构时直接排除 fetchPriority，确保它不会传递到 DOM
    const { fetchPriority, ...imageProps } = props as any;
    
    // 额外确保没有 fetchPriority 属性
    if ('fetchPriority' in imageProps) {
      delete imageProps.fetchPriority;
    }
    
    return <NextImage ref={ref} {...imageProps} />;
  }
);

Image.displayName = 'Image';
