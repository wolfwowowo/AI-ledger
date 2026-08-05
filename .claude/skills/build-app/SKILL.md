---
name: build-app
description: 将黑马记账项目打包为桌面应用安装包。当用户要求打包、构建、发布、生成安装包时使用。
allowed-tools: Bash
argument-hint: <mac|win>
---

# 打包黑马记账

将项目打包为可安装的桌面应用（Windows .exe 或 macOS .dmg）。

## 步骤

### 1. 检查依赖
```bash
if [ ! -d "node_modules" ]; then
  echo "首次运行，正在安装依赖..."
  npm install
fi
```

### 2. 确定目标平台

如果用户未指定平台，自动检测当前系统：
```bash
case "$(uname -s)" in
  Darwin)  TARGET=mac ;;
  Linux)   TARGET=win ;;  # Linux 通常交叉打包 Windows
  *)       TARGET=win ;;
esac
```

如果用户指定了 `$ARGUMENTS`（如 `/build-app mac` 或 `/build-app win`），则按用户指定的来。

### 3. 执行打包

**macOS 打包：**
```bash
npm run package:mac
```

**Windows 打包：**
```bash
npm run package:win
```

### 4. 输出位置

打包完成后，安装包生成在 `dist/` 目录下。

## 打包命令说明

| 命令 | 做的事 |
|------|--------|
| `npm run build` | 仅构建前端（Vite 打包到 dist/） |
| `npm run package:mac` | 构建前端 + 打包为 macOS .dmg |
| `npm run package:win` | 构建前端 + 打包为 Windows .exe |

## 注意事项

- 打包需要较长时间（首次需下载 Electron 二进制文件）
- macOS 用户只能打包 Mac 版本，Windows 用户只能打包 Win 版本
- 如需跨平台打包，需要额外的 CI 环境支持
