import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

/**
 * 黑马记账 — 数据存储模块
 *
 * 负责所有记账数据的读写和业务逻辑：
 * - 数据持久化到本地 JSON 文件（data/ledger.json）
 * - 分类管理（一级大类 + 二级小类的增删改查）
 * - 记录管理（花销记录的增删查）
 * - 统计汇总（按分类聚合金额）
 *
 * 所有数据在内存中维护一个 data 对象，每次修改后自动写入磁盘，
 * 确保应用关闭再打开时数据不丢失。
 */

// ========== 数据结构 ==========

/** 一级分类（大类），如"餐饮"、"交通"。每个一级分类下包含多个二级分类 */
interface CategoryL1 {
  id: number; name: string; icon: string; sort: number; children: CategoryL2[]; isSystem?: boolean
}
/** 二级分类（小类），如"早餐"、"地铁"。通过 parentId 关联到一级分类 */
interface CategoryL2 {
  id: number; parentId: number; name: string; sort: number; isSystem?: boolean
}
/** 一条花销记录，记录了金额、分类、日期和备注 */
interface Record {
  id: number; amount: number; categoryId: number; date: string; note: string; createdAt: string
}
/** 存储在 data/ledger.json 中的完整数据结构 */
interface StoreData {
  categoriesL1: CategoryL1[]
  categoriesL2: CategoryL2[]
  records: Record[]
  nextId: number // 自增 ID，每添加一条记录就 +1
}

/** 系统预设的 9 个一级分类，每个大类下列出对应的二级小类 */
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

/** 查询记录时最多返回的条数，防止数据量过大导致界面卡顿 */
const MAX_RECORDS = 500

const DATA_DIR = join(process.cwd(), 'data')
const DATA_FILE = join(DATA_DIR, 'ledger.json')

/** 内存中的全部数据，所有读写操作都围绕这个对象进行 */
let data: StoreData

/**
 * 将当前内存数据（data 对象）写入磁盘的 JSON 文件。
 *
 * 写入规则：
 * - 如果 data/ 目录不存在，先自动创建（首次启动时）
 * - JSON 文件格式化输出（缩进 2 空格），方便手动查看和修改
 * - 每次增删改操作后都会调用此函数，保证数据不丢失
 */
function saveToDisk(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * 根据 DEFAULT_CATEGORIES 生成初始的分类数据。
 *
 * 只在首次启动时调用（数据文件不存在时）。
 * 生成的分类 id 从 1 开始自增，一级和二级分类共享 id 计数器。
 * 所有预设分类标记为 isSystem: true（系统分类不可改名或删除）。
 */
function seedCategories(): void {
  let l1Id = 1; let l2Id = 1
  for (const cat of DEFAULT_CATEGORIES) {
    data.categoriesL1.push({ id: l1Id, name: cat.name, icon: cat.icon, sort: l1Id, children: [], isSystem: true })
    for (const childName of cat.children) {
      data.categoriesL2.push({ id: l2Id, parentId: l1Id, name: childName, sort: l2Id, isSystem: true })
      l2Id++
    }
    l1Id++
  }
}

/**
 * 初始化数据存储 —— 应用启动时第一个调用的函数。
 *
 * 逻辑：
 * 1. 如果 data/ledger.json 已存在 → 读取并恢复上次的数据
 * 2. 如果文件不存在 → 用 seedCategories() 生成初始分类，创建空记录列表
 *
 * 向后兼容：读取旧数据时，自动为分类补充 isSystem 标记（旧版没有这个字段）。
 */
export function initStore(): void {
  if (existsSync(DATA_FILE)) {
    data = JSON.parse(readFileSync(DATA_FILE, 'utf-8'))
    // 旧数据迁移：补上 isSystem 标记
    let migrated = false
    for (const cat of data.categoriesL1) {
      if (cat.isSystem === undefined) { cat.isSystem = true; migrated = true }
    }
    for (const cat of data.categoriesL2) {
      if (cat.isSystem === undefined) { cat.isSystem = true; migrated = true }
    }
    if (migrated) saveToDisk()
  } else {
    data = { categoriesL1: [], categoriesL2: [], records: [], nextId: 1 }
    seedCategories()
    saveToDisk()
  }
}

/**
 * 获取所有分类，返回树形结构。
 *
 * 合并逻辑：将平铺的 categoriesL1（大类）和 categoriesL2（小类）组装成嵌套树。
 * 每个一级分类的 children 数组包含它下面的所有二级分类。
 *
 * 返回值示例：
 * [{ id: 1, name: '餐饮', icon: '🍽️', children: [{ id: 2, name: '早餐' }, ...] }, ...]
 */
export function getCategories() {
  const map = new Map<number, { id: number; name: string; icon: string; children: { id: number; name: string; isSystem?: boolean }[]; isSystem?: boolean }>()
  for (const l1 of data.categoriesL1) {
    map.set(l1.id, { id: l1.id, name: l1.name, icon: l1.icon, children: [], isSystem: l1.isSystem })
  }
  for (const l2 of data.categoriesL2) {
    const parent = map.get(l2.parentId)
    if (parent) parent.children.push({ id: l2.id, name: l2.name, isSystem: l2.isSystem })
  }
  return Array.from(map.values())
}

// ========== 分类管理 ==========
// 分类分为两级：一级（大类）和二级（小类）。
// 用户可以添加、改名、删除自定义分类，但不能操作系统预设分类（isSystem: true）。

/**
 * 添加一个自定义一级分类。
 *
 * @param name - 分类名称，如"宠物"
 * @param icon - 分类图标（emoji），如"🐶"
 * @returns 包含新分类的 id，前端用来确认添加成功
 *
 * 新分类的 isSystem 为 false，表示是用户自定义的，可以改名或删除。
 */
export function addCategoryL1(name: string, icon: string) {
  const id = data.categoriesL1.length > 0 ? Math.max(...data.categoriesL1.map(c => c.id)) + 1 : 1
  data.categoriesL1.push({ id, name, icon, sort: id, children: [], isSystem: false })
  saveToDisk()
  return { id }
}

/**
 * 在一个一级分类下添加二级分类。
 *
 * @param parentId - 所属一级分类的 id
 * @param name - 二级分类名称，如"猫粮"
 * @throws 如果 parentId 对应的一级分类不存在，抛出错误
 */
export function addCategoryL2(parentId: number, name: string) {
  const parent = data.categoriesL1.find(c => c.id === parentId)
  if (!parent) throw new Error('一级分类不存在')
  const id = data.categoriesL2.length > 0 ? Math.max(...data.categoriesL2.map(c => c.id)) + 1 : 1
  data.categoriesL2.push({ id, parentId, name, sort: id, isSystem: false })
  saveToDisk()
  return { id }
}

/**
 * 修改分类名称（一级或二级通用）。
 *
 * @param level - 1 表示修改一级分类，2 表示修改二级分类
 * @param id - 要修改的分类 id
 * @param name - 新的分类名称
 * @throws 分类不存在、或尝试修改系统分类时抛出错误
 *
 * 安全限制：系统预设分类（isSystem: true）不允许改名，防止误操作。
 */
export function updateCategoryName(level: 1 | 2, id: number, name: string) {
  if (level === 1) {
    const cat = data.categoriesL1.find(c => c.id === id)
    if (!cat) throw new Error('分类不存在')
    if (cat.isSystem) throw new Error('不能修改系统分类')
    cat.name = name
  } else {
    const cat = data.categoriesL2.find(c => c.id === id)
    if (!cat) throw new Error('分类不存在')
    if (cat.isSystem) throw new Error('不能修改系统分类')
    cat.name = name
  }
  saveToDisk()
}

/**
 * 删除分类（一级或二级通用）。
 *
 * @param level - 1 表示删除一级分类，2 表示删除二级分类
 * @param id - 要删除的分类 id
 * @throws 分类不存在、或尝试删除系统分类时抛出错误
 *
 * 注意：删除一级分类时会同时删除其下所有二级分类（级联删除）。
 * 已记录的账目不受影响——记录中保留了快照数据，不会因为分类被删而消失。
 */
export function deleteCategory(level: 1 | 2, id: number) {
  if (level === 1) {
    const cat = data.categoriesL1.find(c => c.id === id)
    if (!cat) throw new Error('分类不存在')
    if (cat.isSystem) throw new Error('不能删除系统分类')
    data.categoriesL1 = data.categoriesL1.filter(c => c.id !== id)
    data.categoriesL2 = data.categoriesL2.filter(c => c.parentId !== id)
  } else {
    const cat = data.categoriesL2.find(c => c.id === id)
    if (!cat) throw new Error('分类不存在')
    if (cat.isSystem) throw new Error('不能删除系统分类')
    data.categoriesL2 = data.categoriesL2.filter(c => c.id !== id)
  }
  saveToDisk()
}

/**
 * 添加一条花销记录（"记一笔"的核心操作）。
 *
 * @param record.amount - 金额（元），如 25.5
 * @param record.categoryId - 二级分类的 id（记一笔选的是小类）
 * @param record.date - 日期，格式 "YYYY-MM-DD"，如 "2026-08-05"
 * @param record.note - 备注（可选），如"午饭外卖"
 * @returns 包含新记录的 id
 *
 * 每次添加记录时 nextId 自增，确保每条记录有唯一 id。
 * note 不传时默认为空字符串。
 */
export function addRecord(record: { amount: number; categoryId: number; date: string; note?: string }) {
  const id = data.nextId++
  data.records.push({
    id, amount: record.amount, categoryId: record.categoryId,
    date: record.date, note: record.note || '', createdAt: new Date().toISOString()
  })
  saveToDisk()
  return { id }
}

/**
 * 查询花销记录列表，支持按日期范围和分类筛选。
 *
 * @param filters.startDate - 起始日期（可选），格式 "YYYY-MM-DD"
 * @param filters.endDate - 结束日期（可选）
 * @param filters.categoryId - 一级分类 id（可选），筛选该大类下所有二级分类的记录
 * @returns 记录列表，按日期倒序排列（最新的在前），最多返回 MAX_RECORDS 条
 *
 * 筛选逻辑：
 * - 不传筛选条件 → 返回全部记录
 * - 传 categoryId → 找到该一级分类下的所有二级分类 id，筛选匹配的记录
 * - 日期范围两端都包含（闭区间）
 *
 * 每条返回记录额外附带 categoryName、parentCategoryName、parentCategoryIcon，
 * 即使分类后来被删了也能显示当时的快照信息。
 */
export function getRecords(filters?: { startDate?: string; endDate?: string; categoryId?: number }) {
  // 构建二级分类 → 名称的快速查找表
  const l2Map = new Map<number, { name: string; parentId: number }>()
  for (const l2 of data.categoriesL2) l2Map.set(l2.id, { name: l2.name, parentId: l2.parentId })
  const l1Map = new Map<number, { name: string; icon: string }>()
  for (const l1 of data.categoriesL1) l1Map.set(l1.id, { name: l1.name, icon: l1.icon })

  let filtered = [...data.records]
  if (filters?.startDate) filtered = filtered.filter(r => r.date >= filters.startDate!)
  if (filters?.endDate) filtered = filtered.filter(r => r.date <= filters.endDate!)
  if (filters?.categoryId) {
    // 找到该一级分类下的所有二级分类 id
    const l2Ids = data.categoriesL2.filter(l2 => l2.parentId === filters.categoryId).map(l2 => l2.id)
    filtered = filtered.filter(r => l2Ids.includes(r.categoryId))
  }
  // 按日期倒序，同一天按 id 倒序（后添加的先显示）
  filtered.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  // 最多返回 MAX_RECORDS 条，防止数据量过大
  filtered = filtered.slice(0, MAX_RECORDS)

  return filtered.map(r => {
    const l2 = l2Map.get(r.categoryId)
    const l1 = l2 ? l1Map.get(l2.parentId) : null
    return {
      id: r.id, amount: r.amount, date: r.date, note: r.note, category_id: r.categoryId,
      categoryName: l2?.name || '(已删除)', parentCategoryName: l1?.name || '(已删除)', parentCategoryIcon: l1?.icon || '🗑️'
    }
  })
}

/**
 * 删除一条花销记录。
 *
 * @param id - 要删除的记录 id
 *
 * 删除不存在的记录不会报错（静默忽略）。
 * 删除操作不可撤销——前端会弹出确认框后再调用此函数。
 */
export function deleteRecord(id: number): void {
  data.records = data.records.filter(r => r.id !== id)
  saveToDisk()
}

/**
 * 按分类统计支出金额（"统计"页面的数据来源）。
 *
 * @param filters.startDate - 统计起始日期（可选）
 * @param filters.endDate - 统计结束日期（可选）
 * @returns 每个一级分类的合计金额，按金额从高到低排列，金额为 0 的分类不出现
 *
 * 统计逻辑：
 * 1. 为每个一级分类建立一个"桶"，初始金额为 0
 * 2. 额外建立一个"兜底桶"（id=-1），存放已删除分类的记录
 * 3. 遍历所有记录，根据二级分类找到对应的一级"桶"，累加金额
 * 4. 过滤掉金额为 0 的桶（该分类本月无支出），按金额降序返回
 */
export function getSummary(filters?: { startDate?: string; endDate?: string }) {
  // 构建二级分类 id → 一级分类信息的映射（用于快速查找）
  const l2ToL1 = new Map<number, { id: number; name: string; icon: string }>()
  for (const l2 of data.categoriesL2) {
    const l1 = data.categoriesL1.find(c => c.id === l2.parentId)
    if (l1) l2ToL1.set(l2.id, { id: l1.id, name: l1.name, icon: l1.icon })
  }
  const summary = new Map<number, { categoryId: number; categoryName: string; categoryIcon: string; total: number }>()
  // 为所有一级分类建立初始金额为 0 的桶
  for (const l1 of data.categoriesL1) {
    summary.set(l1.id, { categoryId: l1.id, categoryName: l1.name, categoryIcon: l1.icon, total: 0 })
  }
  // 兜底桶：已删除分类的记录统一归到这里
  summary.set(-1, { categoryId: -1, categoryName: '已删除', categoryIcon: '🗑️', total: 0 })
  for (const r of data.records) {
    if (filters?.startDate && r.date < filters.startDate) continue
    if (filters?.endDate && r.date > filters.endDate) continue
    const l1 = l2ToL1.get(r.categoryId)
    if (l1) {
      if (summary.has(l1.id)) summary.get(l1.id)!.total += r.amount
    } else {
      // 已删除分类的记录归入兜底桶
      const bucket = summary.get(-1)!
      bucket.total += r.amount
    }
  }
  // 只返回有支出的分类，按金额从高到低排列
  return Array.from(summary.values()).filter(s => s.total > 0).sort((a, b) => b.total - a.total)
}
