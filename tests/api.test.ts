import { describe, it, expect, beforeEach, vi } from 'vitest'

// 直接测试 api 对象（纯 fetch 封装，无需 mock 文件系统）
import { api } from '../src/renderer/types'
import type { CategoryL1, LedgerRecord, CategorySummary } from '../src/renderer/types'

// ========== Mock 全局 fetch ==========

beforeEach(() => {
  vi.restoreAllMocks()
})

function mockFetch(response: any, ok = true) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    json: () => Promise.resolve(response),
  } as Response)
}

// ========== API 客户端测试 ==========

describe('api — 前端 API 封装', () => {
  const API_BASE = 'http://localhost:3456'

  // ========== 分类 ==========
  describe('getCategories()', () => {
    it('应请求正确的 URL', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, json: () => Promise.resolve([]),
      } as any)

      await api.getCategories()
      expect(spy).toHaveBeenCalledWith(`${API_BASE}/api/categories`, undefined)
    })

    it('正常返回分类数据', async () => {
      const mockData: CategoryL1[] = [
        { id: 1, name: '餐饮', icon: '🍽️', children: [{ id: 2, name: '早餐' }], isSystem: true },
      ]
      mockFetch(mockData)
      const result = await api.getCategories()
      expect(result).toEqual(mockData)
    })

    it('服务器返回错误时应抛出异常', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: '服务器内部错误' }),
      } as Response)

      await expect(api.getCategories()).rejects.toThrow('服务器内部错误')
    })
  })

  // ========== 记一笔 ==========
  describe('addRecord()', () => {
    it('应发送 POST 请求并携带 JSON body', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, json: () => Promise.resolve({ id: 42 }),
      } as any)

      const input = { amount: 99, categoryId: 2, date: '2026-08-05', note: '测试' }
      await api.addRecord(input)

      expect(spy).toHaveBeenCalledWith(
        `${API_BASE}/api/records`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
      )
    })

    it('note 可选不传', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, json: () => Promise.resolve({ id: 1 }),
      } as any)

      await api.addRecord({ amount: 50, categoryId: 1, date: '2026-08-01' })
      expect(spy).toHaveBeenCalled()
    })
  })

  // ========== 查询记录 ==========
  describe('getRecords()', () => {
    it('无筛选条件时不带查询参数', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, json: () => Promise.resolve([]),
      } as any)

      await api.getRecords()
      expect(spy).toHaveBeenCalledWith(`${API_BASE}/api/records?`, undefined)
    })

    it('带筛选条件时拼接查询参数', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, json: () => Promise.resolve([]),
      } as any)

      await api.getRecords({ startDate: '2026-08-01', endDate: '2026-08-31', categoryId: 1 })
      const url = spy.mock.calls[0][0] as string
      expect(url).toContain('startDate=2026-08-01')
      expect(url).toContain('endDate=2026-08-31')
      expect(url).toContain('categoryId=1')
    })

    it('返回类型正确', async () => {
      const mockRecords: LedgerRecord[] = [
        {
          id: 1, amount: 100, date: '2026-08-05', note: '',
          category_id: 2, categoryName: '早餐', parentCategoryName: '餐饮', parentCategoryIcon: '🍽️',
        },
      ]
      mockFetch(mockRecords)
      const result = await api.getRecords()
      expect(result[0].amount).toBe(100)
      expect(result[0].parentCategoryName).toBe('餐饮')
    })
  })

  // ========== 删除记录 ==========
  describe('deleteRecord()', () => {
    it('应发送 DELETE 请求', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, json: () => Promise.resolve({ success: true }),
      } as any)

      await api.deleteRecord(42)
      expect(spy).toHaveBeenCalledWith(
        `${API_BASE}/api/records/42`,
        { method: 'DELETE' }
      )
    })
  })

  // ========== 分类管理 ==========
  describe('addCategoryL1()', () => {
    it('应发送分类名和图标', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, json: () => Promise.resolve({ id: 100 }),
      } as any)

      await api.addCategoryL1({ name: '宠物', icon: '🐶' })
      expect(spy).toHaveBeenCalledWith(
        `${API_BASE}/api/categories/l1`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: '宠物', icon: '🐶' }),
        })
      )
    })
  })

  describe('updateCategoryL1()', () => {
    it('应发送 PUT 请求', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, json: () => Promise.resolve({ success: true }),
      } as any)

      await api.updateCategoryL1(1, '新名字')
      expect(spy).toHaveBeenCalledWith(
        `${API_BASE}/api/categories/l1/1`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ name: '新名字' }),
        })
      )
    })
  })

  describe('deleteCategoryL1()', () => {
    it('应发送 DELETE 请求', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, json: () => Promise.resolve({ success: true }),
      } as any)

      await api.deleteCategoryL1(100)
      expect(spy).toHaveBeenCalledWith(
        `${API_BASE}/api/categories/l1/100`,
        { method: 'DELETE' }
      )
    })
  })

  // ========== 统计 ==========
  describe('getSummary()', () => {
    it('返回分类汇总', async () => {
      const mockSummary: CategorySummary[] = [
        { categoryId: 1, categoryName: '餐饮', categoryIcon: '🍽️', total: 500 },
      ]
      mockFetch(mockSummary)
      const result = await api.getSummary()
      expect(result[0].total).toBe(500)
    })

    it('支持按月份筛选', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, json: () => Promise.resolve([]),
      } as any)

      await api.getSummary({ startDate: '2026-08-01', endDate: '2026-08-31' })
      const url = spy.mock.calls[0][0] as string
      expect(url).toContain('startDate=2026-08-01')
      expect(url).toContain('endDate=2026-08-31')
    })
  })
})
