import express from 'express'
import cors from 'cors'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { initStore, getCategories, addRecord, getRecords, deleteRecord, getSummary } from './store'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = 3456

app.use(cors())
app.use(express.json())

// 初始化数据存储
initStore()

// ========== API 路由 ==========

// 获取分类
app.get('/api/categories', (_req, res) => {
  res.json(getCategories())
})

// 添加记录
app.post('/api/records', (req, res) => {
  const { amount, categoryId, date, note } = req.body
  if (!amount || !categoryId || !date) {
    return res.status(400).json({ error: '缺少必要参数' })
  }
  const result = addRecord({ amount, categoryId, date, note })
  res.json(result)
})

// 获取记录列表
app.get('/api/records', (req, res) => {
  const { startDate, endDate, categoryId } = req.query
  const filters: any = {}
  if (startDate) filters.startDate = startDate as string
  if (endDate) filters.endDate = endDate as string
  if (categoryId) filters.categoryId = parseInt(categoryId as string)
  res.json(getRecords(filters))
})

// 删除记录
app.delete('/api/records/:id', (req, res) => {
  deleteRecord(parseInt(req.params.id))
  res.json({ success: true })
})

// 统计
app.get('/api/stats', (req, res) => {
  const { startDate, endDate } = req.query
  const filters: any = {}
  if (startDate) filters.startDate = startDate as string
  if (endDate) filters.endDate = endDate as string
  res.json(getSummary(filters))
})

// 生产环境：托管前端静态文件
const distPath = join(__dirname, '../out/renderer')
app.use(express.static(distPath))
app.use((_req, res) => {
  res.sendFile(join(distPath, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`🐴 黑马记账 服务已启动: http://localhost:${PORT}`)
})
