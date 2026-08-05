import express from 'express'
import cors from 'cors'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { initStore, getCategories, addCategoryL1, addCategoryL2, updateCategoryName, deleteCategory, addRecord, getRecords, deleteRecord, getSummary } from './store'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()

/**
 * 服务器端口号。
 * 优先使用环境变量 PORT（方便在不同机器上使用不同端口），
 * 未设置时默认 3456（"三思五虑"的谐音梗）。
 */
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3456

/**
 * CORS 配置：仅允许本地来源访问 API。
 *
 * 限制原因：虽然这是本地桌面应用，但如果用户在同一台机器上访问了恶意网页，
 * 该页面可能尝试向 localhost:3456 发请求读取记账数据。
 * 限制来源后，只有本应用的页面（localhost 端口或 Electron file:// 协议）能访问。
 */
app.use(cors({ origin: [/^http:\/\/localhost:/, /^file:\/\//] }))
app.use(express.json())

// 初始化数据存储
initStore()

/**
 * 路由错误包装器：统一捕获路由中的异常并返回 400。
 *
 * 项目中多个路由有相同的 try-catch 模式，
 * 抽取出这个高阶函数避免重复代码。
 *
 * @param handler - 实际的路由处理函数
 * @returns 包装后的 Express 中间件，自动处理异常
 */
function wrapRoute(handler: (req: express.Request, res: express.Response) => void | Promise<void>) {
  return (req: express.Request, res: express.Response) => {
    try {
      const result = handler(req, res)
      // 处理 async handler 返回的 Promise 拒绝
      if (result instanceof Promise) {
        result.catch((e: unknown) => {
          const message = e instanceof Error ? e.message : '服务器内部错误'
          res.status(400).json({ error: message })
        })
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '服务器内部错误'
      res.status(400).json({ error: message })
    }
  }
}

// ========== API 路由 ==========

// 获取分类
app.get('/api/categories', wrapRoute((_req, res) => {
  res.json(getCategories())
}))

// 添加一级分类
app.post('/api/categories/l1', wrapRoute((req, res) => {
  const { name, icon } = req.body
  if (!name || !icon) { res.status(400).json({ error: '缺少名称或图标' }); return }
  res.json(addCategoryL1(name, icon))
}))

// 添加二级分类
app.post('/api/categories/l2', wrapRoute((req, res) => {
  const { parentId, name } = req.body
  if (!parentId || !name) { res.status(400).json({ error: '缺少父分类或名称' }); return }
  res.json(addCategoryL2(parentId, name))
}))

// 修改一级分类名
app.put('/api/categories/l1/:id', wrapRoute((req, res) => {
  const { name } = req.body
  if (!name || !name.trim()) { res.status(400).json({ error: '缺少分类名称' }); return }
  updateCategoryName(1, parseInt(req.params.id, 10), name.trim())
  res.json({ success: true })
}))

// 修改二级分类名
app.put('/api/categories/l2/:id', wrapRoute((req, res) => {
  const { name } = req.body
  if (!name || !name.trim()) { res.status(400).json({ error: '缺少分类名称' }); return }
  updateCategoryName(2, parseInt(req.params.id, 10), name.trim())
  res.json({ success: true })
}))

// 删除一级分类（含其二级）
app.delete('/api/categories/l1/:id', wrapRoute((req, res) => {
  deleteCategory(1, parseInt(req.params.id, 10))
  res.json({ success: true })
}))

// 删除二级分类
app.delete('/api/categories/l2/:id', wrapRoute((req, res) => {
  deleteCategory(2, parseInt(req.params.id, 10))
  res.json({ success: true })
}))

/** 查询记录和统计时，可选的筛选参数 */
interface RecordFilters {
  startDate?: string
  endDate?: string
  categoryId?: number
}

// 添加记录
app.post('/api/records', wrapRoute((req, res) => {
  const { amount, categoryId, date, note } = req.body
  if (!amount || !categoryId || !date) {
    res.status(400).json({ error: '缺少必要参数' })
    return
  }
  const result = addRecord({ amount, categoryId, date, note })
  res.json(result)
}))

// 获取记录列表
app.get('/api/records', wrapRoute((req, res) => {
  const { startDate, endDate, categoryId } = req.query
  const filters: RecordFilters = {}
  if (startDate) filters.startDate = startDate as string
  if (endDate) filters.endDate = endDate as string
  if (categoryId) filters.categoryId = parseInt(categoryId as string, 10)
  res.json(getRecords(filters))
}))

// 删除记录
app.delete('/api/records/:id', wrapRoute((req, res) => {
  deleteRecord(parseInt(req.params.id, 10))
  res.json({ success: true })
}))

// 统计
app.get('/api/stats', wrapRoute((req, res) => {
  const { startDate, endDate } = req.query
  const filters: RecordFilters = {}
  if (startDate) filters.startDate = startDate as string
  if (endDate) filters.endDate = endDate as string
  res.json(getSummary(filters))
}))

// 生产环境：托管前端静态文件
const distPath = join(__dirname, '../out/renderer')
app.use(express.static(distPath))
app.use((_req, res) => {
  res.sendFile(join(distPath, 'index.html'))
})

// 导出 app 供测试使用
export { app }

// 测试环境不启动服务器（避免端口冲突）
if (!process.env.VITEST) {
  app.listen(PORT, () => {
    console.log(`🐴 黑马记账 服务已启动: http://localhost:${PORT}`)
  })
}
