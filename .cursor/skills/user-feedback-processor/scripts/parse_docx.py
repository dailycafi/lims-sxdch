#!/usr/bin/env python3
"""
解析 docx 文件，提取文字内容和嵌入的图片

用法: python parse_docx.py <docx文件路径>

输出:
- 控制台输出文档的文字内容（Markdown 格式）
- 图片保存到 feedback-docs/images/ 目录

依赖: pip install docx2python
"""

import sys
import os
from pathlib import Path


def install_dependency():
    """安装依赖"""
    print("正在安装 docx2python...")
    os.system(f"{sys.executable} -m pip install docx2python -q")


def parse_docx(file_path: str):
    """解析 docx 文件"""
    try:
        from docx2python import docx2python
    except ImportError:
        install_dependency()
        from docx2python import docx2python

    file_path = Path(file_path)
    if not file_path.exists():
        print(f"错误: 文件不存在 - {file_path}")
        sys.exit(1)

    if file_path.suffix.lower() == '.doc':
        print("# 注意: .doc 格式文件\n")
        print("检测到旧版 Word 格式 (.doc)。建议：")
        print("1. 请用户将文件另存为 .docx 格式")
        print("2. 或使用在线工具转换为 .docx")
        sys.exit(1)

    # 创建图片输出目录
    image_dir = Path("feedback-docs/images")
    image_dir.mkdir(parents=True, exist_ok=True)

    # 解析文档
    with docx2python(str(file_path), image_folder=str(image_dir)) as doc:
        print(f"# 用户反馈文档解析结果\n")
        print(f"**源文件**: {file_path.name}\n")
        print("---\n")

        # 输出文档属性（如有）
        if doc.properties:
            props = doc.properties
            if props.get('title') or props.get('author'):
                print("## 文档属性\n")
                if props.get('title'):
                    print(f"- **标题**: {props['title']}")
                if props.get('author'):
                    print(f"- **作者**: {props['author']}")
                if props.get('modified'):
                    print(f"- **修改时间**: {props['modified']}")
                print()

        # 输出正文内容
        print("## 文档内容\n")
        
        # docx2python 返回嵌套列表结构
        # 结构: [[[paragraph, paragraph], [paragraph]], ...]
        # 表示: [[[单元格内容], [单元格内容]], ...] 或普通段落
        
        def extract_text(content, level=0):
            """递归提取文本内容"""
            result = []
            if isinstance(content, str):
                if content.strip():
                    result.append(content.strip())
            elif isinstance(content, list):
                for item in content:
                    result.extend(extract_text(item, level + 1))
            return result

        text_content = extract_text(doc.body)
        for para in text_content:
            # 处理图片占位符
            if para.startswith("----") and para.endswith("----"):
                # 这是图片占位符，格式如 ----image1.png----
                img_name = para.strip("-")
                print(f"\n![{img_name}](feedback-docs/images/{img_name})\n")
            else:
                print(para)
                print()

        # 输出页眉页脚（如有）
        header_text = extract_text(doc.header)
        footer_text = extract_text(doc.footer)
        
        if header_text:
            print("\n## 页眉内容\n")
            for text in header_text:
                print(f"- {text}")

        if footer_text:
            print("\n## 页脚内容\n")
            for text in footer_text:
                print(f"- {text}")

        # 列出提取的图片
        images = list(image_dir.glob("*"))
        if images:
            print("\n---\n")
            print("## 提取的图片\n")
            print(f"共提取 {len(images)} 张图片，保存在 `{image_dir}` 目录:\n")
            for img in sorted(images):
                print(f"- `{img.name}`")
            print("\n**提示**: 请查看这些图片以了解用户标注的问题区域。")
            print("可以使用 Read 工具读取图片进行分析。")


def main():
    if len(sys.argv) < 2:
        print("用法: python parse_docx.py <文档路径>")
        print()
        print("支持的格式: .docx")
        print()
        print("示例:")
        print("  python parse_docx.py feedback-docs/用户反馈.docx")
        print('  python parse_docx.py "feedback-docs/反馈 2024-01.docx"')
        sys.exit(1)

    file_path = sys.argv[1]
    parse_docx(file_path)


if __name__ == "__main__":
    main()
