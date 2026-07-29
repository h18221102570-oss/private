#!/usr/bin/env python3
"""
PaddleOCR 文本识别脚本
用法: python ocr.py <文件路径> [--lang ch]
支持: PDF、PNG、JPG 等格式
输出: JSON 格式的识别结果
"""

import sys
import os
import json
import argparse
import tempfile
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description='PaddleOCR 文字识别')
    parser.add_argument('file', help='要识别的文件路径')
    parser.add_argument('--lang', default='ch', help='语言 (ch/en)')
    parser.add_argument('--output', default=None, help='输出文件路径')
    args = parser.parse_args()

    file_path = args.file
    if not os.path.exists(file_path):
        print(json.dumps({'success': False, 'error': '文件不存在'}))
        sys.exit(1)

    ext = Path(file_path).suffix.lower()

    try:
        import fitz  # PyMuPDF
        from paddleocr import PaddleOCR

        # 初始化 OCR (只加载一次)
        ocr = PaddleOCR(lang=args.lang, use_gpu=False, show_log=False)

        # PDF 转图片
        images = []
        if ext == '.pdf':
            doc = fitz.open(file_path)
            for page_num in range(len(doc)):
                page = doc[page_num]
                # 渲染为高分辨率图片
                mat = fitz.Matrix(2.0, 2.0)  # 2x 放大
                pix = page.get_pixmap(matrix=mat)
                img_path = os.path.join(tempfile.gettempdir(), f'ocr_page_{page_num}.png')
                pix.save(img_path)
                images.append((page_num + 1, img_path))
            doc.close()
        else:
            images = [(1, file_path)]

        # 逐页 OCR
        results = []
        all_text = []

        for page_num, img_path in images:
            ocr_result = ocr.ocr(img_path)
            page_lines = []

            if ocr_result and ocr_result[0]:
                for line in ocr_result[0]:
                    text = line[1][0]
                    confidence = round(float(line[1][1]), 3)
                    bbox = [[int(x), int(y)] for x, y in line[0]]
                    page_lines.append({
                        'text': text,
                        'confidence': confidence,
                        'bbox': bbox,
                    })

            page_text = '\n'.join([l['text'] for l in page_lines])
            all_text.append(page_text)
            results.append({
                'page': page_num,
                'lines': page_lines,
                'text': page_text,
            })

            # 清理临时文件
            if ext == '.pdf' and os.path.exists(img_path):
                os.remove(img_path)

        full_text = '\n\n'.join(all_text)

        output = {
            'success': True,
            'fileName': os.path.basename(file_path),
            'pages': len(results),
            'totalLines': sum(len(r['lines']) for r in results),
            'fullText': full_text,
            'pages': results,
        }

        print(json.dumps(output, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'OCR 识别失败: {str(e)}',
        }, ensure_ascii=False))
        sys.exit(1)


if __name__ == '__main__':
    main()
