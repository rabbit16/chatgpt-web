# 余额兔（Balance Bunny）

常驻桌面的小工具：随时显示账户余额、当日 Token 消耗与本月支出，余额低于阈值时提醒。
客户端只读取你自己的 API Key，不上传任何数据。

## 三个平台

| 平台 | 目录 | 技术栈 | 安装包 |
| --- | --- | --- | --- |
| macOS | `macos/` | Swift（AppKit，原生） | 见站点「开源项目 → 余额兔」 |
| Windows | `windows/` | C# / .NET WinForms | 同上 |
| Linux | `linux/` | Python 3 + PyGObject | 同上 |

## 构建

- macOS：`cd macos && ./build.sh`（产物在 `dist/`）
- Windows：`cd windows && ./build.sh`
- Linux：`cd linux && ./pack.sh`

## 使用

1. 打开客户端，填入 API 地址 `https://www.rabbitj.top/v1` 与自己的 `sk-` 密钥；
2. 托盘/菜单栏会显示当前余额与今日用量；
3. 阈值提醒可在设置里调整。

## 许可

源码开放供学习与二次开发。安装包与站点服务由 rabbitj.top 提供。
