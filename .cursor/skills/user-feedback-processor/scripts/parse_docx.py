#!/usr/bin/env python3
"""
解析 docx 文件，提取文字内容和嵌入的图片

用法: python parse_docx.py <docx文件路径>

依赖: pip install docx2python
"""

import sys
import os
from pathlib import Path


def parse_docx(file_path: str):
    """解析 docx 文件"""
    try:
        from docx2python import docx2python
    except ImportError:
        print("正在安装 docx2python...")
        os.system(f"{sys.executable} -m pip install docx2python -q")
        from docx2python import docx2python

    file_path = Path(file_path)
    if not file_path.exists():
        print(f"错误: 文件不存在 - {file_path}")
        sys.exit(1)

    if file_path.suffix.lower() == '.doc':
        print("# 注意: .doc 格式\n")
        print("请将文件另存为 .docx 格式后重试。")
        sys.exit(1)

    # 创建图片输出目录
    image_dir = Path("feedback-docs/images")
    image_dir.mkdir(parents=True, exist_ok=True)

    # 解析文档
    with docx2python(str(file_path), image_folder=str(image_dir)) as doc:
        print(f"# 用户反馈文档\n")
        print(f"**文件**: {file_path.name}\n")
        print("---\n")

        # 提取文本
        def extract_text(content):
            """递归提取文本"""
            result = []
            if isinstance(content, str):
                text = content.strip()
                if text:
                    # 处理图片占位符
                    if "----media/" in text:
                        # 提取图片文件名
                        import re
                        match = re.search(r'media/(image\d+\.\w+)', text)
                        if match:
                            img_name = match.group(1)
                            result.append(f"\n![{img_name}](feedback-docs/images/{img_name})\n")
                    else:
                        result.append(text)
            elif isinstance(content, list):
                for item in content:
                    result.extend(extract_text(item))
            return result

        text_content = extract_text(doc.body)
        for para in text_content:
            print(para)
            if not para.startswith("!["):
                print()

        # 列出图片
        images = sorted(image_dir.glob("image*.png")) + sorted(image_dir.glob("image*.jpg"))
        if images:
            print("\n---\n")
            print(f"## 图片列表 ({len(images)} 张)\n")
            for img in images:
                print(f"- `{img}`")
            print("\n**提示**: 使用 Read 工具查看图片了解用户标注的问题。")


def main():
    if len(sys.argv) < 2:
        print("用法: python parse_docx.py <文档路径>")
        print("\n示例:")
        print("  python parse_docx.py feedback-docs/用户反馈.docx")
        sys.exit(1)

    parse_docx(sys.argv[1])


if __name__ == "__main__":
    main()
