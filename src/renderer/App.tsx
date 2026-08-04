import { useState, useEffect, useCallback } from 'react'
import { CategoryL1, LedgerRecord, api } from './types'

function App() {
  const [currentTab, setCurrentTab] = useState<'add' | 'list' | 'stats'>('add')

  // 记账表单状态
  const [categories, setCategories] = useState<CategoryL1[]>([])
  const [selectedL1, setSelectedL1] = useState<CategoryL1 | null>(null)
  const [amount, setAmount] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [note, setNote] = useState('')

  // 记录列表状态
  const [records, setRecords] = useState<LedgerRecord[]>([])
  const [filterL1Id, setFilterL1Id] = useState<number | null>(null)

  // 加载分类
  useEffect(() => {
    api.getCategories().then(setCategories)
  }, [])

  // 加载记录
  const loadRecords = useCallback(() => {
    const filters: any = {}
    if (filterL1Id) filters.categoryId = filterL1Id
    api.getRecords(filters).then(setRecords)
  }, [filterL1Id])

  useEffect(() => {
    if (currentTab === 'list') loadRecords()
  }, [currentTab, loadRecords])

  // 提交记录
  const handleSubmit = async () => {
    if (!amount || !selectedCategoryId) return
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) return

    await api.addRecord({
      amount: numAmount,
      categoryId: selectedCategoryId,
      date,
      note
    })

    // 重置表单
    setAmount('')
    setSelectedCategoryId(null)
    setSelectedL1(null)
    setDate(new Date().toISOString().split('T')[0])
    setNote('')
  }

  // 删除记录
  const handleDelete = async (id: number) => {
    await api.deleteRecord(id)
    loadRecords()
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 顶部标题栏 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-lg font-bold text-center text-gray-800">🐴 黑马记账</h1>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Tab 1: 记一笔 */}
        {currentTab === 'add' && (
          <div className="space-y-4 max-w-sm mx-auto">
            {/* 金额输入 */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <label className="text-sm text-gray-500 mb-1 block">金额 (元)</label>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full text-3xl font-bold text-center py-3 border-b-2 border-gray-200 focus:border-blue-500 outline-none bg-transparent"
              />
            </div>

            {/* 分类选择 */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <label className="text-sm text-gray-500 mb-2 block">选择分类</label>
              {/* 一级分类 */}
              <div className="flex flex-wrap gap-2 mb-3">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => { setSelectedL1(cat); setSelectedCategoryId(null) }}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      selectedL1?.id === cat.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </div>
              {/* 二级分类 */}
              {selectedL1 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                  {selectedL1.children.map(child => (
                    <button
                      key={child.id}
                      onClick={() => setSelectedCategoryId(child.id)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        selectedCategoryId === child.id
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {child.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 日期和备注 */}
            <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
              <div>
                <label className="text-sm text-gray-500 mb-1 block">日期</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">备注 (可选)</label>
                <input
                  type="text"
                  placeholder="例如：午饭外卖"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* 提交按钮 */}
            <button
              onClick={handleSubmit}
              disabled={!amount || !selectedCategoryId}
              className={`w-full py-3 rounded-xl font-bold text-white transition-colors ${
                amount && selectedCategoryId
                  ? 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              ✓ 记一笔
            </button>
          </div>
        )}

        {/* Tab 2: 历史记录 */}
        {currentTab === 'list' && (
          <div className="max-w-sm mx-auto space-y-3">
            {/* 分类筛选 */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setFilterL1Id(null)}
                className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
                  filterL1Id === null ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'
                }`}
              >
                全部
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setFilterL1Id(cat.id)}
                  className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
                    filterL1Id === cat.id ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'
                  }`}
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>

            {/* 记录列表 */}
            {records.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                <div className="text-5xl mb-3">📝</div>
                <p>暂无记录</p>
                <p className="text-sm mt-1">点击底部"记一笔"开始吧</p>
              </div>
            ) : (
              records.map(record => (
                <div key={record.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{record.parentCategoryIcon}</div>
                    <div>
                      <div className="text-sm text-gray-500">{record.parentCategoryName} · {record.categoryName}</div>
                      <div className="text-xs text-gray-400">{record.date}</div>
                      {record.note && <div className="text-xs text-gray-400 mt-0.5">{record.note}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-lg text-gray-800">¥{record.amount.toFixed(2)}</span>
                    <button
                      onClick={() => handleDelete(record.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors text-sm"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: 统计 */}
        {currentTab === 'stats' && (
          <StatsView categories={categories} />
        )}
      </div>

      {/* 底部导航 */}
      <div className="bg-white border-t border-gray-200 flex">
        {[
          { key: 'add', label: '记一笔', icon: '✏️' },
          { key: 'list', label: '明细', icon: '📋' },
          { key: 'stats', label: '统计', icon: '📊' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setCurrentTab(tab.key as typeof currentTab)}
            className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors ${
              currentTab === tab.key ? 'text-blue-500' : 'text-gray-400'
            }`}
          >
            <span className="text-lg">{tab.icon}</span>
            <span className="text-xs">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// 统计页面
function StatsView({ categories: _categories }: { categories: CategoryL1[] }) {
  const [summaries, setSummaries] = useState<{ categoryId: number; categoryName: string; categoryIcon: string; total: number }[]>([])

  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    const [year, m] = month.split('-')
    const startDate = `${year}-${m}-01`
    // 计算当月最后一天
    const lastDay = new Date(parseInt(year), parseInt(m), 0).getDate()
    const endDate = `${year}-${m}-${String(lastDay).padStart(2, '0')}`
    api.getSummary({ startDate, endDate }).then(setSummaries)
  }, [month])

  const total = summaries.reduce((sum, s) => sum + s.total, 0)

  return (
    <div className="max-w-sm mx-auto space-y-4">
      {/* 月份选择 */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500"
        />
      </div>

      {/* 总支出 */}
      <div className="bg-white rounded-xl p-4 shadow-sm text-center">
        <div className="text-sm text-gray-500">当月总支出</div>
        <div className="text-3xl font-bold text-gray-800 mt-1">¥{total.toFixed(2)}</div>
      </div>

      {/* 分类统计 */}
      {summaries.filter(s => s.total > 0).length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          <div className="text-5xl mb-3">📊</div>
          <p>本月暂无支出</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          {summaries.filter(s => s.total > 0).map(s => (
            <div key={s.categoryId} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{s.categoryIcon}</span>
                <span className="text-sm text-gray-700">{s.categoryName}</span>
              </div>
              <span className="font-medium text-gray-800">¥{s.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default App
