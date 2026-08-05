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

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetch(url, options)
  const data = await r.json()
  if (!r.ok) throw new Error(data.error || '请求失败')
  return data as T
}

export const api = {
  getCategories: (): Promise<CategoryL1[]> =>
    request(`${API_BASE}/api/categories`),

  addRecord: (data: { amount: number; categoryId: number; date: string; note?: string }): Promise<{ id: number }> =>
    request(`${API_BASE}/api/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }),

  getRecords: (filters?: { startDate?: string; endDate?: string; categoryId?: number }): Promise<LedgerRecord[]> => {
    const params = new URLSearchParams()
    if (filters?.startDate) params.set('startDate', filters.startDate)
    if (filters?.endDate) params.set('endDate', filters.endDate)
    if (filters?.categoryId) params.set('categoryId', String(filters.categoryId))
    return request(`${API_BASE}/api/records?${params}`)
  },

  deleteRecord: (id: number): Promise<{ success: boolean }> =>
    request(`${API_BASE}/api/records/${id}`, { method: 'DELETE' }),

  // 分类管理
  addCategoryL1: (data: { name: string; icon: string }): Promise<{ id: number }> =>
    request(`${API_BASE}/api/categories/l1`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    }),

  addCategoryL2: (data: { parentId: number; name: string }): Promise<{ id: number }> =>
    request(`${API_BASE}/api/categories/l2`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    }),

  updateCategoryL1: (id: number, name: string): Promise<{ success: boolean }> =>
    request(`${API_BASE}/api/categories/l1/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
    }),

  updateCategoryL2: (id: number, name: string): Promise<{ success: boolean }> =>
    request(`${API_BASE}/api/categories/l2/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
    }),

  deleteCategoryL1: (id: number): Promise<{ success: boolean }> =>
    request(`${API_BASE}/api/categories/l1/${id}`, { method: 'DELETE' }),

  deleteCategoryL2: (id: number): Promise<{ success: boolean }> =>
    request(`${API_BASE}/api/categories/l2/${id}`, { method: 'DELETE' }),

  getSummary: (filters?: { startDate?: string; endDate?: string }): Promise<CategorySummary[]> => {
    const params = new URLSearchParams()
    if (filters?.startDate) params.set('startDate', filters.startDate)
    if (filters?.endDate) params.set('endDate', filters.endDate)
    return request(`${API_BASE}/api/stats?${params}`)
  }
}
