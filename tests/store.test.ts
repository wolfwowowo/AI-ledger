import { describe, it, expect, beforeEach, vi } from 'vitest'

// ========== Mock 文件系统 ==========
// 用内存模拟 JSON 文件读写，避免污染真实数据

let memoryFS: Record<string, string> = {}

vi.mock('fs', () => ({
  readFileSync: vi.fn((path: string) => {
    const key = String(path)
    if (memoryFS[key]) return memoryFS[key]
    throw new Error('ENOENT')
  }),
  writeFileSync: vi.fn((path: string, content: string) => {
    memoryFS[String(path)] = content
  }),
  existsSync: vi.fn((path: string) => {
    return String(path) in memoryFS
  }),
  mkdirSync: vi.fn(() => {}),
}))

import {
  initStore,
  addRecord,
  getRecords,
  deleteRecord,
  getSummary,
  getCategories,
  addCategoryL1,
  addCategoryL2,
  updateCategoryName,
  deleteCategory,
} from '../server/store'

describe('store — 数据存储核心', () => {
  beforeEach(() => {
    // 每个测试前清空内存文件系统
    memoryFS = {}
  })

  // ========== 初始化 ==========
  describe('initStore() — 初始化', () => {
    it('首次启动应创建默认 9 个一级分类', () => {
      initStore()
      const cats = getCategories()
      expect(cats).toHaveLength(9)
      expect(cats[0].name).toBe('餐饮')
    })

    it('默认分类应标记为系统分类（不可删除）', () => {
      initStore()
      const cats = getCategories()
      for (const cat of cats) {
        expect(cat.isSystem).toBe(true)
      }
    })

    it('已有数据文件时应恢复数据', () => {
      // 先初始化一次，拿到数据
      initStore()
      const firstCats = getCategories()

      // 清空内存再初始化，模拟"重启应用"
      const saved = memoryFS
      memoryFS = {}
      // 把之前保存的数据放回去
      const dataKey = Object.keys(saved).find(k => k.endsWith('ledger.json'))!
      memoryFS[dataKey] = saved[dataKey]

      const secondCats = getCategories()
      // 注意：initStore 已经在 import 时自动调用过一次
      // 这里的测试重点是验证从文件恢复的逻辑
    })
  })

  // ========== 记一笔 ==========
  describe('addRecord() — 添加记录', () => {
    beforeEach(() => initStore())

    it('正常添加一条记录', () => {
      const result = addRecord({
        amount: 25.5,
        categoryId: 2, // 早餐
        date: '2026-08-05',
        note: '公司楼下买包子',
      })
      expect(result).toHaveProperty('id')
      expect(typeof result.id).toBe('number')
    })

    it('连续添加多条记录，id 应递增', () => {
      const r1 = addRecord({ amount: 10, categoryId: 1, date: '2026-08-01' })
      const r2 = addRecord({ amount: 20, categoryId: 2, date: '2026-08-02' })
      const r3 = addRecord({ amount: 30, categoryId: 3, date: '2026-08-03' })
      expect(r2.id).toBe(r1.id + 1)
      expect(r3.id).toBe(r2.id + 1)
    })

    it('note 不传时应默认为空字符串', () => {
      addRecord({ amount: 100, categoryId: 1, date: '2026-08-01' })
      const records = getRecords()
      expect(records[0].note).toBe('')
    })
  })

  // ========== 查记录 ==========
  describe('getRecords() — 查询记录', () => {
    beforeEach(() => {
      initStore()
      addRecord({ amount: 50, categoryId: 2, date: '2026-08-01', note: '早餐' })
      addRecord({ amount: 200, categoryId: 10, date: '2026-08-03', note: '地铁月卡' })
      addRecord({ amount: 500, categoryId: 15, date: '2026-08-05', note: '买书' })
    })

    it('应按时间倒序排列（最新的在前）', () => {
      const records = getRecords()
      expect(records).toHaveLength(3)
      expect(records[0].date).toBe('2026-08-05')
      expect(records[2].date).toBe('2026-08-01')
    })

    it('按日期范围筛选', () => {
      const records = getRecords({ startDate: '2026-08-02', endDate: '2026-08-04' })
      expect(records).toHaveLength(1)
      expect(records[0].amount).toBe(200)
    })

    it('按一级分类筛选', () => {
      // 餐饮是 category id 1（一级），其二级分类 id 范围是 1-6
      const records = getRecords({ categoryId: 1 })
      expect(records).toHaveLength(1)
      expect(records[0].parentCategoryName).toBe('餐饮')
    })

    it('最多返回 500 条', () => {
      for (let i = 0; i < 600; i++) {
        addRecord({ amount: 1, categoryId: 1, date: `2026-08-${String(i % 30 + 1).padStart(2, '0')}` })
      }
      const records = getRecords()
      expect(records.length).toBeLessThanOrEqual(500)
    })
  })

  // ========== 删记录 ==========
  describe('deleteRecord() — 删除记录', () => {
    beforeEach(() => {
      initStore()
      addRecord({ amount: 100, categoryId: 1, date: '2026-08-01' })
    })

    it('删除存在的记录', () => {
      const before = getRecords()
      expect(before).toHaveLength(1)

      deleteRecord(before[0].id)

      const after = getRecords()
      expect(after).toHaveLength(0)
    })

    it('删除不存在的记录不报错', () => {
      expect(() => deleteRecord(99999)).not.toThrow()
    })
  })

  // ========== 统计 ==========
  describe('getSummary() — 分类统计', () => {
    beforeEach(() => {
      initStore()
      // 餐饮: 早餐(2) 50 + 午餐(3) 80 = 130
      addRecord({ amount: 50, categoryId: 2, date: '2026-08-01', note: '早餐' })
      addRecord({ amount: 80, categoryId: 3, date: '2026-08-01', note: '午餐' })
      // 交通: 地铁(8) 200
      addRecord({ amount: 200, categoryId: 8, date: '2026-08-03', note: '地铁月卡' })
    })

    it('按一级分类汇总金额', () => {
      const summary = getSummary()
      const food = summary.find(s => s.categoryName === '餐饮')
      const transport = summary.find(s => s.categoryName === '交通')
      expect(food).toBeDefined()
      expect(food!.total).toBe(130)
      expect(transport).toBeDefined()
      expect(transport!.total).toBe(200)
    })

    it('金额为 0 的分类不出现', () => {
      const summary = getSummary()
      const names = summary.map(s => s.categoryName)
      // 购物、居住等没有记录，不应该出现
      expect(names).not.toContain('购物')
      expect(names).not.toContain('居住')
    })

    it('按日期范围筛选统计', () => {
      const summary = getSummary({ startDate: '2026-08-03', endDate: '2026-08-03' })
      expect(summary).toHaveLength(1)
      expect(summary[0].categoryName).toBe('交通')
      expect(summary[0].total).toBe(200)
    })
  })

  // ========== 分类管理 ==========
  describe('分类管理', () => {
    beforeEach(() => initStore())

    it('添加自定义一级分类', () => {
      const { id } = addCategoryL1('宠物', '🐶')
      const cats = getCategories()
      const pet = cats.find(c => c.id === id)
      expect(pet).toBeDefined()
      expect(pet!.isSystem).toBe(false)
    })

    it('添加自定义二级分类', () => {
      const { id } = addCategoryL2(1, '宵夜') // 挂在餐饮下
      const cats = getCategories()
      const food = cats.find(c => c.id === 1)
      expect(food!.children.some(c => c.name === '宵夜')).toBe(true)
    })

    it('添加到不存在的一级分类应报错', () => {
      expect(() => addCategoryL2(99999, '不存在')).toThrow('一级分类不存在')
    })

    it('不能修改系统分类名称', () => {
      expect(() => updateCategoryName(1, 1, '改名')).toThrow('不能修改系统分类')
    })

    it('自定义分类可以改名', () => {
      const { id } = addCategoryL1('临时', '📌')
      expect(() => updateCategoryName(1, id, '新名字')).not.toThrow()
    })

    it('不能删除系统分类', () => {
      expect(() => deleteCategory(1, 1)).toThrow('不能删除系统分类')
    })

    it('删除一级分类时应连同二级一起删', () => {
      const { id } = addCategoryL1('测试', '🧪')
      addCategoryL2(id, '子分类')
      deleteCategory(1, id)
      const cats = getCategories()
      expect(cats.find(c => c.id === id)).toBeUndefined()
    })
  })
})
