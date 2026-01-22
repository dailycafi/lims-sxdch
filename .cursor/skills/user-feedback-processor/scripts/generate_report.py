#!/usr/bin/env python3
"""
生成用户反馈修改报告 PDF
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

def check_dependencies():
    """检查并安装依赖"""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate
        from PIL import Image
        return True
    except ImportError:
        print("正在安装依赖...")
        os.system(f"{sys.executable} -m pip install reportlab pillow -q")
        return True

def generate_pdf_report(title: str, date: str, doc: str, items: list, output: str, files: list = None):
    """生成 PDF 报告"""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    
    # 尝试注册中文字体
    font_name = 'Helvetica'
    chinese_font_paths = [
        '/System/Library/Fonts/PingFang.ttc',
        '/System/Library/Fonts/STHeiti Light.ttc',
        '/Library/Fonts/Arial Unicode.ttf',
    ]
    
    for font_path in chinese_font_paths:
        if os.path.exists(font_path):
            try:
                pdfmetrics.registerFont(TTFont('ChineseFont', font_path))
                font_name = 'ChineseFont'
                break
            except:
                continue
    
    # 创建文档
    doc_pdf = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=20*mm,
        leftMargin=20*mm,
        topMargin=20*mm,
        bottomMargin=20*mm
    )
    
    # 样式
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontName=font_name,
        fontSize=18,
        spaceAfter=10*mm,
        alignment=1,  # 居中
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontName=font_name,
        fontSize=12,
        spaceBefore=5*mm,
        spaceAfter=3*mm,
        textColor=colors.HexColor('#333333'),
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=10,
        spaceAfter=2*mm,
    )
    
    meta_style = ParagraphStyle(
        'Meta',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=9,
        textColor=colors.HexColor('#666666'),
        spaceAfter=1*mm,
    )
    
    # 构建内容
    story = []
    
    # 标题
    story.append(Paragraph(title, title_style))
    story.append(Spacer(1, 5*mm))
    
    # 元信息
    story.append(Paragraph(f"<b>日期:</b> {date}", meta_style))
    story.append(Paragraph(f"<b>反馈文档:</b> {doc}", meta_style))
    story.append(Paragraph(f"<b>状态:</b> 已完成", meta_style))
    story.append(Spacer(1, 8*mm))
    
    # 分隔线
    story.append(Table([['']], colWidths=[170*mm], style=TableStyle([
        ('LINEABOVE', (0, 0), (-1, 0), 1, colors.HexColor('#CCCCCC')),
    ])))
    story.append(Spacer(1, 5*mm))
    
    # 报告目录
    reports_dir = Path(output).parent
    
    # 修改项
    for item in items:
        item_id = item.get('id', '')
        desc = item.get('desc', '')
        status = item.get('status', 'completed')
        image = item.get('image', '')
        
        status_mark = '✓' if status == 'completed' else ('!' if status == 'partial' else '✗')
        status_color = '#22c55e' if status == 'completed' else ('#f59e0b' if status == 'partial' else '#ef4444')
        
        # 修改项标题
        story.append(Paragraph(
            f"<font color='{status_color}'><b>{status_mark}</b></font> "
            f"<b>{item_id}. {desc}</b>",
            heading_style
        ))
        
        # 截图
        if image:
            image_path = reports_dir / image if not os.path.isabs(image) else Path(image)
            if image_path.exists():
                try:
                    from PIL import Image as PILImage
                    img = PILImage.open(image_path)
                    img_width, img_height = img.size
                    
                    # 计算合适的尺寸，最大宽度 160mm
                    max_width = 160 * mm
                    max_height = 100 * mm
                    
                    aspect = img_height / img_width
                    width = min(max_width, img_width * 0.264583)  # px to mm
                    height = width * aspect
                    
                    if height > max_height:
                        height = max_height
                        width = height / aspect
                    
                    story.append(RLImage(str(image_path), width=width, height=height))
                    story.append(Spacer(1, 3*mm))
                except Exception as e:
                    story.append(Paragraph(f"<i>[图片加载失败: {image}]</i>", normal_style))
            else:
                story.append(Paragraph(f"<i>[图片未找到: {image}]</i>", normal_style))
        
        story.append(Spacer(1, 5*mm))
    
    # 修改文件列表
    if files:
        story.append(Spacer(1, 5*mm))
        story.append(Table([['']], colWidths=[170*mm], style=TableStyle([
            ('LINEABOVE', (0, 0), (-1, 0), 1, colors.HexColor('#CCCCCC')),
        ])))
        story.append(Spacer(1, 3*mm))
        
        story.append(Paragraph("<b>修改文件:</b>", heading_style))
        for f in files:
            story.append(Paragraph(f"• {f}", normal_style))
    
    # 生成 PDF
    doc_pdf.build(story)
    print(f"PDF 报告已生成: {output}")


def main():
    parser = argparse.ArgumentParser(description='生成用户反馈修改报告 PDF')
    parser.add_argument('--title', required=True, help='报告标题')
    parser.add_argument('--date', required=True, help='日期')
    parser.add_argument('--doc', required=True, help='反馈文档名称')
    parser.add_argument('--output', required=True, help='输出 PDF 路径')
    parser.add_argument('--items', required=True, help='修改项 JSON 数组')
    parser.add_argument('--files', help='修改文件列表 JSON 数组')
    
    args = parser.parse_args()
    
    check_dependencies()
    
    items = json.loads(args.items)
    files = json.loads(args.files) if args.files else None
    
    generate_pdf_report(
        title=args.title,
        date=args.date,
        doc=args.doc,
        items=items,
        output=args.output,
        files=files
    )


if __name__ == '__main__':
    main()
