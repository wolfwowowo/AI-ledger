import { app, BrowserWindow } from 'electron'
import { fork } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

let mainWindow = null
let serverProcess = null

function startServer() {
  serverProcess = fork(
    join(__dirname, '..', 'node_modules', '.bin', 'tsx'),
    [join(__dirname, '..', 'server', 'index.ts')],
    { stdio: 'pipe', env: { ...process.env } }
  )
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

  mainWindow.loadURL('http://localhost:3456')
}

app.whenReady().then(() => {
  startServer()
  setTimeout(() => createWindow(), 1500)

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
