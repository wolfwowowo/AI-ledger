export interface CategoryL1 {
  id: number
  name: string
  icon: string
  children: CategoryL2[]
  isSystem?: boolean
}

export interface CategoryL2 {
  id: number
  name: string
  isSystem?: boolean
}

export interface LedgerRecord {
  id: number
  amount: number
  date: string
  note: string
  category_id: number
  categoryName: string
  parentCategoryName: string
  parentCategoryIcon: string
}

export interface CategorySummary {
  categoryId: number
  categoryName: string
  categoryIcon: string
  total: number
}

const API_BASE = 'http://localhost:3456'

export const api = {
  getCategories: (): Promise<CategoryL1[]> =>
    fetch(`${API_BASE}/api/categories`).then(r => r.json()),

  addRecord: (data: { amount: number; categoryId: number; date: string; note?: string }): Promise<{ id: number }> =>
    fetch(`${API_BASE}/api/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),

  getRecords: (filters?: { startDate?: string; endDate?: string; categoryId?: number }): Promise<LedgerRecord[]> => {
    const params = new URLSearchParams()
    if (filters?.startDate) params.set('startDate', filters.startDate)
    if (filters?.endDate) params.set('endDate', filters.endDate)
    if (filters?.categoryId) params.set('categoryId', String(filters.categoryId))
    return fetch(`${API_BASE}/api/records?${params}`).then(r => r.json())
  },

  deleteRecord: (id: number): Promise<{ success: boolean }> =>
    fetch(`${API_BASE}/api/records/${id}`, { method: 'DELETE' }).then(r => r.json()),

  // 分类管理
  addCategoryL1: (data: { name: string; icon: string }): Promise<{ id: number }> =>
    fetch(`${API_BASE}/api/categories/l1`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    }).then(r => r.json()),

  addCategoryL2: (data: { parentId: number; name: string }): Promise<{ id: number }> =>
    fetch(`${API_BASE}/api/categories/l2`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    }).then(r => r.json()),

  updateCategoryL1: (id: number, name: string): Promise<{ success: boolean }> =>
    fetch(`${API_BASE}/api/categories/l1/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
    }).then(r => r.json()),

  updateCategoryL2: (id: number, name: string): Promise<{ success: boolean }> =>
    fetch(`${API_BASE}/api/categories/l2/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
    }).then(r => r.json()),

  deleteCategoryL1: (id: number): Promise<{ success: boolean }> =>
    fetch(`${API_BASE}/api/categories/l1/${id}`, { method: 'DELETE' }).then(r => r.json()),

  deleteCategoryL2: (id: number): Promise<{ success: boolean }> =>
    fetch(`${API_BASE}/api/categories/l2/${id}`, { method: 'DELETE' }).then(r => r.json()),

  getSummary: (filters?: { startDate?: string; endDate?: string }): Promise<CategorySummary[]> => {
    const params = new URLSearchParams()
    if (filters?.startDate) params.set('startDate', filters.startDate)
    if (filters?.endDate) params.set('endDate', filters.endDate)
    return fetch(`${API_BASE}/api/stats?${params}`).then(r => r.json())
  }
}
