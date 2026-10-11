#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把若干 PNG 打包成一个多尺寸 .ico（Vista+ 支持内嵌 PNG，无需 PIL）。

用法: python3 png2ico.py out.ico 16.png 32.png 48.png ...
"""
import struct
import sys


def read_size(data):
    """从 PNG 的 IHDR 读宽高（PNG 头: 8 字节签名 + 4 长度 + 4 类型 + 宽 + 高）。"""
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('不是 PNG 数据')
    w, h = struct.unpack('>II', data[16:24])
    return w, h


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1

    out = sys.argv[1]
    entries = []
    for path in sys.argv[2:]:
        with open(path, 'rb') as f:
            data = f.read()
        w, h = read_size(data)
        entries.append((w, h, data))
    entries.sort(key=lambda e: e[0])

    header = struct.pack('<HHH', 0, 1, len(entries))     # reserved, type=icon, count
    offset = 6 + 16 * len(entries)
    dirs, body = b'', b''
    for w, h, data in entries:
        dirs += struct.pack('<BBBBHHII',
                            0 if w >= 256 else w,            # 0 表示 256
                            0 if h >= 256 else h,
                            0, 0,                            # 调色板数 / 保留
                            1, 32,                           # 色彩平面 / 位深
                            len(data), offset)
        body += data
        offset += len(data)

    with open(out, 'wb') as f:
        f.write(header + dirs + body)
    print('wrote %s (%d 个尺寸: %s)' % (out, len(entries), ', '.join(str(e[0]) for e in entries)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
