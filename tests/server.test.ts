import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import http from 'http'

// ========== Mock store 模块 ==========
// 在导入 index.ts 之前 Mock，vitest 会自动 hoist

// vi.mock 工厂不能引用外部变量（hoist 机制），必须全部内联
vi.mock('../server/store', () => ({
  initStore: () => {},
  getCategories: () => [
    { id: 1, name: '餐饮', icon: '🍽️', children: [{ id: 2, name: '早餐', isSystem: true }], isSystem: true },
  ],
  addRecord: () => ({ id: 1 }),
  getRecords: () => [
    {
      id: 1, amount: 25, date: '2026-08-05', note: '包子',
      category_id: 2, categoryName: '早餐', parentCategoryName: '餐饮', parentCategoryIcon: '🍽️',
    },
  ],
  deleteRecord: () => {},
  getSummary: () => [
    { categoryId: 1, categoryName: '餐饮', categoryIcon: '🍽️', total: 300 },
  ],
  addCategoryL1: () => ({ id: 100 }),
  addCategoryL2: () => ({ id: 200 }),
  updateCategoryName: () => {},
  deleteCategory: () => {},
}))

// 现在可以安全导入（app.listen 在 VITEST 环境被跳过）
import { app } from '../server/index'

let server: http.Server
const PORT = 0 // 随机端口

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(PORT, resolve)
  })
})

afterAll(() => {
  server?.close()
})

function url(path: string): string {
  const addr = server.address() as any
  return `http://localhost:${addr.port}${path}`
}

// ========== API 路由测试 ==========

describe('Express API — 路由层', () => {
  // ========== 分类接口 ==========
  describe('GET /api/categories', () => {
    it('应返回分类列表', async () => {
      const r = await fetch(url('/api/categories'))
      expect(r.status).toBe(200)
      const data = await r.json()
      expect(Array.isArray(data)).toBe(true)
      expect(data[0].name).toBe('餐饮')
    })
  })

  describe('POST /api/categories/l1', () => {
    it('正常添加一级分类', async () => {
      const r = await fetch(url('/api/categories/l1'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '宠物', icon: '🐶' }),
      })
      expect(r.status).toBe(200)
      expect(await r.json()).toEqual({ id: 100 })
    })

    it('缺少名称应返回 400', async () => {
      const r = await fetch(url('/api/categories/l1'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icon: '🐶' }),
      })
      expect(r.status).toBe(400)
    })
  })

  describe('POST /api/categories/l2', () => {
    it('正常添加二级分类', async () => {
      const r = await fetch(url('/api/categories/l2'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: 1, name: '宵夜' }),
      })
      expect(r.status).toBe(200)
    })

    it('缺少父分类应返回 400', async () => {
      const r = await fetch(url('/api/categories/l2'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '无父分类' }),
      })
      expect(r.status).toBe(400)
    })
  })

  describe('PUT /api/categories/l1/:id', () => {
    it('空名称应返回 400', async () => {
      const r = await fetch(url('/api/categories/l1/1'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      })
      expect(r.status).toBe(400)
    })
  })

  describe('DELETE /api/categories/l1/:id', () => {
    it('应返回成功', async () => {
      const r = await fetch(url('/api/categories/l1/100'), { method: 'DELETE' })
      expect(r.status).toBe(200)
      expect(await r.json()).toEqual({ success: true })
    })
  })

  // ========== 记录接口 ==========
  describe('POST /api/records', () => {
    it('正常添加记录', async () => {
      const r = await fetch(url('/api/records'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 25, categoryId: 2, date: '2026-08-05', note: '包子' }),
      })
      expect(r.status).toBe(200)
      expect(await r.json()).toEqual({ id: 1 })
    })

    it('缺少必填字段应返回 400', async () => {
      const r = await fetch(url('/api/records'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 25 }),
      })
      expect(r.status).toBe(400)
    })
  })

  describe('GET /api/records', () => {
    it('正常返回记录列表', async () => {
      const r = await fetch(url('/api/records'))
      expect(r.status).toBe(200)
      const data = await r.json()
      expect(data[0].amount).toBe(25)
    })

    it('支持分类筛选参数', async () => {
      const r = await fetch(url('/api/records?categoryId=1'))
      expect(r.status).toBe(200)
    })
  })

  describe('DELETE /api/records/:id', () => {
    it('应返回成功', async () => {
      const r = await fetch(url('/api/records/1'), { method: 'DELETE' })
      expect(r.status).toBe(200)
    })
  })

  // ========== 统计接口 ==========
  describe('GET /api/stats', () => {
    it('返回分类统计', async () => {
      const r = await fetch(url('/api/stats'))
      expect(r.status).toBe(200)
      const data = await r.json()
      expect(data[0].categoryName).toBe('餐饮')
      expect(data[0].total).toBe(300)
    })

    it('支持日期范围参数', async () => {
      const r = await fetch(url('/api/stats?startDate=2026-08-01&endDate=2026-08-31'))
      expect(r.status).toBe(200)
    })
  })
})
