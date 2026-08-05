// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

// ========== Mock API 模块 ==========
// vi.mock 会被 vitest hoist 到最顶部，不能引用外部变量

vi.mock('../src/renderer/types', () => ({
  api: {
    getCategories: () => Promise.resolve([
      { id: 1, name: '餐饮', icon: '🍽️', children: [{ id: 2, name: '早餐', isSystem: true }], isSystem: true },
      { id: 2, name: '交通', icon: '🚗', children: [{ id: 8, name: '地铁', isSystem: true }], isSystem: true },
    ]),
    addRecord: () => Promise.resolve({ id: 1 }),
    getRecords: () => Promise.resolve([
      {
        id: 1, amount: 25, date: '2026-08-05', note: '包子',
        category_id: 2, categoryName: '早餐', parentCategoryName: '餐饮', parentCategoryIcon: '🍽️',
      },
    ]),
    deleteRecord: () => Promise.resolve({ success: true }),
    getSummary: () => Promise.resolve([
      { categoryId: 1, categoryName: '餐饮', categoryIcon: '🍽️', total: 300 },
    ]),
    addCategoryL1: () => Promise.resolve({ id: 100 }),
    addCategoryL2: () => Promise.resolve({ id: 200 }),
    updateCategoryL1: () => Promise.resolve({ success: true }),
    updateCategoryL2: () => Promise.resolve({ success: true }),
    deleteCategoryL1: () => Promise.resolve({ success: true }),
    deleteCategoryL2: () => Promise.resolve({ success: true }),
  },
}))

// Mock 贪吃蛇组件（依赖 canvas，jsdom 不支持）
vi.mock('../src/renderer/SnakeGame', () => ({
  default: () => null,
}))

import App from '../src/renderer/App'

// ========== React 组件测试 ==========

describe('App — 主界面', () => {
  afterEach(() => {
    cleanup()
  })

  // ========== 渲染 ==========
  describe('基础渲染', () => {
    it('应渲染标题和 5 个底部导航', async () => {
      render(<App />)

      // 标题
      expect(screen.getByText('🐴 黑马记账')).toBeTruthy()

      // 底部导航
      await waitFor(() => {
        expect(screen.getByText('记一笔')).toBeTruthy()
        expect(screen.getByText('明细')).toBeTruthy()
        expect(screen.getByText('统计')).toBeTruthy()
        expect(screen.getByText('设置')).toBeTruthy()
        expect(screen.getByText('游戏')).toBeTruthy()
      })
    })

    it('默认显示"记一笔"页面', () => {
      render(<App />)
      expect(screen.getByText('金额 (元)')).toBeTruthy()
    })
  })

  // ========== Tab 切换 ==========
  describe('导航切换', () => {
    it('点击"明细"应切换到记录列表', async () => {
      render(<App />)
      fireEvent.click(screen.getByText('明细'))

      await waitFor(() => {
        // 应显示全部筛选按钮
        expect(screen.getByText('全部')).toBeTruthy()
      })
    })

    it('点击"统计"应切换到统计页', async () => {
      render(<App />)
      fireEvent.click(screen.getByText('统计'))

      await waitFor(() => {
        expect(screen.getByText('当月总支出')).toBeTruthy()
      })
    })

    it('点击"设置"应切换到设置页', async () => {
      render(<App />)
      fireEvent.click(screen.getByText('设置'))

      await waitFor(() => {
        expect(screen.getByText('系统分类')).toBeTruthy()
        expect(screen.getByText('我的分类')).toBeTruthy()
      })
    })

    it('点击"游戏"应切换到贪吃蛇页面', async () => {
      render(<App />)
      fireEvent.click(screen.getByText('游戏'))
      // SnakeGame 被 mock 为空，只要不报错即可
    })
  })

  // ========== 记一笔表单 ==========
  describe('记一笔 — 表单验证', () => {
    it('金额为空且未选分类时，提交按钮应禁用', () => {
      render(<App />)
      const btn = screen.getByText('✓ 记一笔')
      expect((btn as HTMLButtonElement).disabled).toBe(true)
    })

    it('选择分类后可以看到二级分类', async () => {
      render(<App />)

      await waitFor(() => {
        const foodBtn = screen.getByText('🍽️ 餐饮')
        expect(foodBtn).toBeTruthy()
      })

      fireEvent.click(screen.getByText('🍽️ 餐饮'))

      await waitFor(() => {
        expect(screen.getByText('早餐')).toBeTruthy()
      })
    })
  })

  // ========== 记录列表 ==========
  describe('明细 — 记录列表', () => {
    it('有记录时显示金额和分类', async () => {
      render(<App />)
      fireEvent.click(screen.getByText('明细'))

      await waitFor(() => {
        expect(screen.getByText('¥25.00')).toBeTruthy()
        expect(screen.getByText('餐饮 · 早餐')).toBeTruthy()
      })
    })

    it('显示分类筛选按钮', async () => {
      render(<App />)
      fireEvent.click(screen.getByText('明细'))

      await waitFor(() => {
        expect(screen.getByText('全部')).toBeTruthy()
        expect(screen.getByText('🍽️ 餐饮')).toBeTruthy()
        expect(screen.getByText('🚗 交通')).toBeTruthy()
      })
    })
  })

  // ========== 统计页 ==========
  describe('统计 — 支出汇总', () => {
    it('显示当月支出金额', async () => {
      render(<App />)
      fireEvent.click(screen.getByText('统计'))

      await waitFor(() => {
        // ¥300.00 在总支出和分类明细中各出现一次，用 getAllByText
        const amounts = screen.getAllByText('¥300.00')
        expect(amounts.length).toBeGreaterThanOrEqual(2)
        expect(screen.getByText('餐饮')).toBeTruthy()
        expect(screen.getByText('当月总支出')).toBeTruthy()
      })
    })
  })
})
