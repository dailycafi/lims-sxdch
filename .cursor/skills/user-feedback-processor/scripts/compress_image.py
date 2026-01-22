#!/usr/bin/env python3
"""
压缩截图图片，降低分辨率和文件大小

用法: 
  python compress_image.py <图片路径> [--max-width 1200] [--quality 75] [--output <输出路径>]

示例:
  python compress_image.py screenshot.png
  python compress_image.py screenshot.png --max-width 1000 --quality 70
  python compress_image.py screenshot.png --output compressed.jpg
"""

import sys
import os
import argparse
from pathlib import Path


def check_dependencies():
    """检查并安装依赖"""
    try:
        from PIL import Image
        return True
    except ImportError:
        print("正在安装 Pillow...")
        os.system(f"{sys.executable} -m pip install Pillow -q")
        return True


def compress_image(
    input_path: str,
    output_path: str = None,
    max_width: int = 1200,
    max_height: int = 800,
    quality: int = 75,
    convert_to_jpeg: bool = True
):
    """
    压缩图片
    
    Args:
        input_path: 输入图片路径
        output_path: 输出图片路径（默认覆盖原文件或生成新文件）
        max_width: 最大宽度（像素）
        max_height: 最大高度（像素）
        quality: JPEG 质量 (1-95, 越低越小)
        convert_to_jpeg: 是否转换为 JPEG 格式（更小的文件）
    
    Returns:
        输出文件路径
    """
    from PIL import Image
    
    input_path = Path(input_path)
    if not input_path.exists():
        print(f"错误: 文件不存在 - {input_path}")
        sys.exit(1)
    
    # 打开图片
    img = Image.open(input_path)
    original_size = input_path.stat().st_size
    original_width, original_height = img.size
    
    print(f"原始图片: {original_width}x{original_height}, {original_size / 1024:.1f} KB")
    
    # 计算新尺寸，保持宽高比
    ratio = min(max_width / original_width, max_height / original_height)
    
    if ratio < 1:
        new_width = int(original_width * ratio)
        new_height = int(original_height * ratio)
        img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        print(f"调整尺寸: {new_width}x{new_height}")
    else:
        new_width, new_height = original_width, original_height
        print("尺寸未变（已小于最大限制）")
    
    # 确定输出路径和格式
    if output_path:
        output_path = Path(output_path)
    else:
        if convert_to_jpeg and input_path.suffix.lower() == '.png':
            output_path = input_path.with_suffix('.jpg')
        else:
            output_path = input_path
    
    # 保存图片
    if output_path.suffix.lower() in ['.jpg', '.jpeg']:
        # 转换为 RGB（JPEG 不支持 alpha 通道）
        if img.mode in ('RGBA', 'LA', 'P'):
            # 创建白色背景
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        img.save(output_path, 'JPEG', optimize=True, quality=quality)
    else:
        img.save(output_path, optimize=True, compress_level=9)
    
    # 输出结果
    new_size = output_path.stat().st_size
    reduction = (1 - new_size / original_size) * 100
    
    print(f"压缩后: {new_size / 1024:.1f} KB (减少 {reduction:.1f}%)")
    print(f"输出: {output_path}")
    
    return str(output_path)


def compress_all_in_directory(
    directory: str,
    max_width: int = 1200,
    max_height: int = 800,
    quality: int = 75
):
    """压缩目录下的所有图片"""
    from PIL import Image
    
    directory = Path(directory)
    if not directory.exists():
        print(f"错误: 目录不存在 - {directory}")
        sys.exit(1)
    
    patterns = ['*.png', '*.jpg', '*.jpeg', '*.PNG', '*.JPG', '*.JPEG']
    images = []
    for pattern in patterns:
        images.extend(directory.glob(pattern))
    
    if not images:
        print(f"目录中没有找到图片: {directory}")
        return
    
    print(f"找到 {len(images)} 张图片\n")
    
    total_original = 0
    total_compressed = 0
    
    for img_path in images:
        original_size = img_path.stat().st_size
        total_original += original_size
        
        compress_image(
            str(img_path),
            max_width=max_width,
            max_height=max_height,
            quality=quality,
            convert_to_jpeg=True
        )
        
        # 检查输出文件（可能已转换为 jpg）
        output_path = img_path.with_suffix('.jpg') if img_path.suffix.lower() == '.png' else img_path
        if output_path.exists():
            total_compressed += output_path.stat().st_size
        
        print()
    
    print(f"总计: {total_original / 1024:.1f} KB -> {total_compressed / 1024:.1f} KB")
    print(f"总共减少: {(1 - total_compressed / total_original) * 100:.1f}%")


def main():
    parser = argparse.ArgumentParser(description='压缩截图图片')
    parser.add_argument('input', help='输入图片路径或目录')
    parser.add_argument('--max-width', type=int, default=1200, help='最大宽度（默认 1200）')
    parser.add_argument('--max-height', type=int, default=800, help='最大高度（默认 800）')
    parser.add_argument('--quality', type=int, default=75, help='JPEG 质量 1-95（默认 75）')
    parser.add_argument('--output', '-o', help='输出路径（默认覆盖原文件）')
    parser.add_argument('--keep-png', action='store_true', help='保持 PNG 格式不转换')
    parser.add_argument('--all', '-a', action='store_true', help='处理目录下所有图片')
    
    args = parser.parse_args()
    
    check_dependencies()
    
    input_path = Path(args.input)
    
    if args.all or input_path.is_dir():
        compress_all_in_directory(
            args.input,
            max_width=args.max_width,
            max_height=args.max_height,
            quality=args.quality
        )
    else:
        compress_image(
            args.input,
            output_path=args.output,
            max_width=args.max_width,
            max_height=args.max_height,
            quality=args.quality,
            convert_to_jpeg=not args.keep_png
        )


if __name__ == '__main__':
    main()
