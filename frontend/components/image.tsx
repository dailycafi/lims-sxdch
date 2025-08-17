import NextImage, { ImageProps } from 'next/image';
import { forwardRef } from 'react';

// 自定义 Image 组件，过滤掉 fetchPriority 属性以避免 React 警告
export const Image = forwardRef<HTMLImageElement, ImageProps>(
  (props, ref) => {
    // 过滤掉可能导致警告的属性
    const { ...imageProps } = props;
    
    // 删除 fetchPriority 属性（如果存在）
    if ('fetchPriority' in imageProps) {
      delete (imageProps as any).fetchPriority;
    }
    
    return <NextImage ref={ref} {...imageProps} />;
  }
);

Image.displayName = 'Image';
