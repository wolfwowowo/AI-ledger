const { app, BrowserWindow } = require('electron')
const { fork } = require('child_process')
const path = require('path')

let mainWindow = null
let serverProcess = null

function startServer() {
  const tsxPath = path.join(__dirname, '..', 'node_modules', '.bin', 'tsx')
  const serverPath = path.join(__dirname, '..', 'server', 'index.ts')

  serverProcess = fork(tsxPath, [serverPath], {
    stdio: 'pipe',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 700,
    minWidth: 360,
    minHeight: 500,
    title: '黑马记账',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  const isDev = !app.isPackaged
  const url = isDev ? 'http://localhost:5173' : 'http://localhost:3456'

  // 开发模式下 Vite 可能还没就绪，加重试逻辑
  loadURLWithRetry(url, isDev ? 10 : 1)
}

async function loadURLWithRetry(url, maxRetries) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await mainWindow.loadURL(url)
      console.log(`✅ 页面加载成功: ${url}`)
      return
    } catch (err) {
      if (i < maxRetries - 1) {
        console.log(`⏳ 等待 Vite 就绪... (${i + 1}/${maxRetries})`)
        await new Promise(r => setTimeout(r, 1000))
      } else {
        console.error(`❌ 无法连接到 ${url}`, err.message)
      }
    }
  }
}

app.whenReady().then(() => {
  // 生产模式下需要自己启动服务器
  if (app.isPackaged) {
    startServer()
    // 等服务器就绪再开窗口
    setTimeout(() => createWindow(), 1500)
  } else {
    createWindow()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill()
})
