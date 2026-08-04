import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

// ========== 数据结构 ==========

interface CategoryL1 {
  id: number; name: string; icon: string; sort: number; children: CategoryL2[]
}
interface CategoryL2 {
  id: number; parentId: number; name: string; sort: number
}
interface Record {
  id: number; amount: number; categoryId: number; date: string; note: string; createdAt: string
}
interface StoreData {
  categoriesL1: CategoryL1[]
  categoriesL2: CategoryL2[]
  records: Record[]
  nextId: number
}

const DEFAULT_CATEGORIES = [
  { name: '餐饮', icon: '🍽️', children: ['早餐', '午餐', '晚餐', '零食', '饮料', '聚餐'] },
  { name: '交通', icon: '🚗', children: ['公交', '地铁', '出租车', '加油', '停车', '火车飞机'] },
  { name: '购物', icon: '🛍️', children: ['衣物', '电子产品', '日用品', '化妆品', '书籍'] },
  { name: '居住', icon: '🏠', children: ['房租', '水电', '物业', '维修', '家具'] },
  { name: '娱乐', icon: '🎮', children: ['电影', '游戏', '旅游', '运动', 'KTV'] },
  { name: '医疗', icon: '🏥', children: ['门诊', '药品', '体检', '住院'] },
  { name: '教育', icon: '📚', children: ['学费', '培训', '书本', '考试'] },
  { name: '金融', icon: '💰', children: ['保险', '理财', '贷款', '手续费'] },
  { name: '其他', icon: '📌', children: ['礼品', '捐赠', '宠物', '其他杂项'] }
]

const DATA_DIR = join(process.cwd(), 'data')
const DATA_FILE = join(DATA_DIR, 'ledger.json')

let data: StoreData

function saveToDisk(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

function seedCategories(): void {
  let l1Id = 1; let l2Id = 1
  for (const cat of DEFAULT_CATEGORIES) {
    data.categoriesL1.push({ id: l1Id, name: cat.name, icon: cat.icon, sort: l1Id, children: [] })
    for (const childName of cat.children) {
      data.categoriesL2.push({ id: l2Id, parentId: l1Id, name: childName, sort: l2Id })
      l2Id++
    }
    l1Id++
  }
}

export function initStore(): void {
  if (existsSync(DATA_FILE)) {
    data = JSON.parse(readFileSync(DATA_FILE, 'utf-8'))
  } else {
    data = { categoriesL1: [], categoriesL2: [], records: [], nextId: 1 }
    seedCategories()
    saveToDisk()
  }
}

export function getCategories() {
  const map = new Map<number, { id: number; name: string; icon: string; children: { id: number; name: string }[] }>()
  for (const l1 of data.categoriesL1) {
    map.set(l1.id, { id: l1.id, name: l1.name, icon: l1.icon, children: [] })
  }
  for (const l2 of data.categoriesL2) {
    const parent = map.get(l2.parentId)
    if (parent) parent.children.push({ id: l2.id, name: l2.name })
  }
  return Array.from(map.values())
}

export function addRecord(record: { amount: number; categoryId: number; date: string; note?: string }) {
  const id = data.nextId++
  data.records.push({
    id, amount: record.amount, categoryId: record.categoryId,
    date: record.date, note: record.note || '', createdAt: new Date().toISOString()
  })
  saveToDisk()
  return { id }
}

export function getRecords(filters?: { startDate?: string; endDate?: string; categoryId?: number }) {
  const l2Map = new Map<number, { name: string; parentId: number }>()
  for (const l2 of data.categoriesL2) l2Map.set(l2.id, { name: l2.name, parentId: l2.parentId })
  const l1Map = new Map<number, { name: string; icon: string }>()
  for (const l1 of data.categoriesL1) l1Map.set(l1.id, { name: l1.name, icon: l1.icon })

  let filtered = [...data.records]
  if (filters?.startDate) filtered = filtered.filter(r => r.date >= filters.startDate!)
  if (filters?.endDate) filtered = filtered.filter(r => r.date <= filters.endDate!)
  if (filters?.categoryId) {
    const l2Ids = data.categoriesL2.filter(l2 => l2.parentId === filters.categoryId).map(l2 => l2.id)
    filtered = filtered.filter(r => l2Ids.includes(r.categoryId))
  }
  filtered.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  filtered = filtered.slice(0, 500)

  return filtered.map(r => {
    const l2 = l2Map.get(r.categoryId)
    const l1 = l2 ? l1Map.get(l2.parentId) : null
    return {
      id: r.id, amount: r.amount, date: r.date, note: r.note, category_id: r.categoryId,
      categoryName: l2?.name || '', parentCategoryName: l1?.name || '', parentCategoryIcon: l1?.icon || ''
    }
  })
}

export function deleteRecord(id: number): void {
  data.records = data.records.filter(r => r.id !== id)
  saveToDisk()
}

export function getSummary(filters?: { startDate?: string; endDate?: string }) {
  const l2ToL1 = new Map<number, { id: number; name: string; icon: string }>()
  for (const l2 of data.categoriesL2) {
    const l1 = data.categoriesL1.find(c => c.id === l2.parentId)
    if (l1) l2ToL1.set(l2.id, { id: l1.id, name: l1.name, icon: l1.icon })
  }
  const summary = new Map<number, { categoryId: number; categoryName: string; categoryIcon: string; total: number }>()
  for (const l1 of data.categoriesL1) {
    summary.set(l1.id, { categoryId: l1.id, categoryName: l1.name, categoryIcon: l1.icon, total: 0 })
  }
  for (const r of data.records) {
    if (filters?.startDate && r.date < filters.startDate) continue
    if (filters?.endDate && r.date > filters.endDate) continue
    const l1 = l2ToL1.get(r.categoryId)
    if (l1 && summary.has(l1.id)) summary.get(l1.id)!.total += r.amount
  }
  return Array.from(summary.values()).sort((a, b) => b.total - a.total)
}
