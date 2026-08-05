---
name: run-app
description: 启动黑马记账应用的开发模式。当用户要求运行、启动、打开项目或预览应用时使用。
allowed-tools: Bash
---

# 启动黑马记账

启动项目开发模式（Express 后端 + Vite 前端 + Electron 桌面窗口）：

## 步骤

### 1. 检查依赖
```bash
if [ ! -d "node_modules" ]; then
  echo "首次运行，正在安装依赖..."
  npm install
fi
```

### 2. 启动开发模式
```bash
npm run dev
```

这会同时启动：
- **Express 后端** — `tsx server/index.ts`，处理 API 请求和数据读写
- **Vite 前端** — 开发服务器，默认端口 5173
- **Electron 窗口** — 桌面应用窗口

## 注意事项

- 脚本已包含 `env -u ELECTRON_RUN_AS_NODE`，无需手动处理环境变量
- 浏览器可直接访问 http://localhost:5173
- 用 `Ctrl+C` 停止所有服务
