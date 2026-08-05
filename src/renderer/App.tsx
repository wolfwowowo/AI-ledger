import { useState, useEffect, useCallback } from 'react'
import { CategoryL1, LedgerRecord, api } from './types'
import SnakeGame from './SnakeGame'

/**
 * 获取今天的日期字符串，格式 YYYY-MM-DD。
 * 提取为工具函数，避免在多处重复 `new Date().toISOString().split('T')[0]`。
 */
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * 黑马记账的主应用组件。
 *
 * 包含 5 个底部 Tab 页面：
 * - 记一笔（添加花销记录）
 * - 明细（查看历史记录，支持按分类筛选）
 * - 统计（按月查看各分类支出汇总）
 * - 设置（管理自定义分类）
 * - 游戏（贪吃蛇小游戏）
 */
function App() {
  const [currentTab, setCurrentTab] = useState<'add' | 'list' | 'stats' | 'settings' | 'game'>('add')

  // 记账表单状态
  const [categories, setCategories] = useState<CategoryL1[]>([])
  const [selectedL1, setSelectedL1] = useState<CategoryL1 | null>(null)
  const [amount, setAmount] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [date, setDate] = useState(getTodayDateString())
  const [note, setNote] = useState('')

  // 记录列表状态
  const [records, setRecords] = useState<LedgerRecord[]>([])
  const [filterL1Id, setFilterL1Id] = useState<number | null>(null)

  // 加载分类：失败时给用户提示
  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {
      alert('加载分类失败，请检查服务是否已启动')
    })
  }, [])

  // 给设置页用的刷新分类函数
  const refreshCategories = useCallback(() => {
    api.getCategories().then(setCategories).catch(() => {
      alert('刷新分类失败')
    })
  }, [])

  // 加载记录
  const loadRecords = useCallback(() => {
    const filters: { categoryId?: number } = {}
    if (filterL1Id) filters.categoryId = filterL1Id
    api.getRecords(filters).then(setRecords).catch(() => {
      alert('加载记录失败')
    })
  }, [filterL1Id])

  useEffect(() => {
    if (currentTab === 'list') loadRecords()
  }, [currentTab, loadRecords])

  // 提交记录：用 try-catch 捕获异常，确保用户知道操作结果
  const handleSubmit = async () => {
    if (!amount || !selectedCategoryId) return
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) return

    try {
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
      setDate(getTodayDateString())
      setNote('')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '未知错误'
      alert('记账失败: ' + message)
    }
  }

  // 删除记录：确认后删除并刷新列表
  const handleDelete = async (id: number) => {
    try {
      await api.deleteRecord(id)
      loadRecords()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '未知错误'
      alert('删除失败: ' + message)
    }
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
          <StatsView />
        )}

        {/* Tab 4: 设置 */}
        {currentTab === 'settings' && (
          <SettingsView categories={categories} onRefresh={refreshCategories} />
        )}

        {/* Tab 5: 贪吃蛇 */}
        {currentTab === 'game' && <SnakeGame />}
      </div>

      {/* 底部导航 */}
      <div className="bg-white border-t border-gray-200 flex">
        {[
          { key: 'add', label: '记一笔', icon: '✏️' },
          { key: 'list', label: '明细', icon: '📋' },
          { key: 'stats', label: '统计', icon: '📊' },
          { key: 'settings', label: '设置', icon: '⚙️' },
          { key: 'game', label: '游戏', icon: '🐍' }
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

/**
 * 统计页面组件。
 *
 * 展示当月各分类的支出汇总数据：
 * - 月份选择器，支持切换查看不同月份
 * - 当月总支出金额
 * - 每个分类的支出金额和占比
 */
function StatsView() {
  const [summaries, setSummaries] = useState<{ categoryId: number; categoryName: string; categoryIcon: string; total: number }[]>([])

  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    const [year, m] = month.split('-')
    const startDate = `${year}-${m}-01`
    // 计算当月最后一天：下个月的第 0 天就是本月最后一天
    const lastDay = new Date(parseInt(year, 10), parseInt(m, 10), 0).getDate()
    const endDate = `${year}-${m}-${String(lastDay).padStart(2, '0')}`
    api.getSummary({ startDate, endDate }).then(setSummaries).catch(() => {
      alert('加载统计数据失败')
    })
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

// ========== 设置页面 ==========

/** 用户可以选择的一级分类 emoji 图标列表 */
const EMOJI_LIST = ['🍽️','🚗','🛍️','🏠','🎮','🏥','📚','💰','📌','🎵','✈️','🐱','💻','🎁','☕','🏃','💄','📱','🎓','💼']

/**
 * 设置页面组件。
 *
 * 管理用户的分类体系：
 * - 系统分类（🔒）：只读，不可改不可删，但可添加二级分类
 * - 我的分类（✏️）：用户自定义的一级分类，可改可删
 * - 支持添加/改名/删除一级和二级分类
 * - 弹窗交互：选择 emoji 图标 + 输入分类名称
 */
function SettingsView({ categories, onRefresh }: { categories: CategoryL1[]; onRefresh: () => void }) {
  const [modal, setModal] = useState<null | { type: 'addL1' } | { type: 'addL2'; parentId: number } | { type: 'editL1'; id: number; name: string } | { type: 'editL2'; id: number; name: string }>(null)
  const [modalName, setModalName] = useState('')
  const [modalIcon, setModalIcon] = useState('📌')
  const [expandedL1, setExpandedL1] = useState<Set<number>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  const systemL1 = categories.filter(c => c.isSystem)
  // 用户自建一级分类 + 系统一级下的用户自建二级分类
  const userL1 = categories.filter(c => !c.isSystem)

  const openAddL1 = () => { setModal({ type: 'addL1' }); setModalName(''); setModalIcon('📌') }
  const openAddL2 = (parentId: number) => { setModal({ type: 'addL2', parentId }); setModalName('') }
  const openEditL1 = (id: number, name: string) => { setModal({ type: 'editL1', id, name }); setModalName(name) }
  const openEditL2 = (id: number, name: string) => { setModal({ type: 'editL2', id, name }); setModalName(name) }

  const handleSubmit = async () => {
    if (!modalName.trim() || submitting) return
    setSubmitting(true)
    try {
      if (modal!.type === 'addL1') await api.addCategoryL1({ name: modalName.trim(), icon: modalIcon })
      else if (modal!.type === 'addL2') await api.addCategoryL2({ parentId: modal!.parentId, name: modalName.trim() })
      else if (modal!.type === 'editL1') await api.updateCategoryL1(modal!.id, modalName.trim())
      else if (modal!.type === 'editL2') await api.updateCategoryL2(modal!.id, modalName.trim())
      setModal(null)
      onRefresh()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '未知错误'
      alert('操作失败: ' + message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteL1 = async (id: number, name: string) => {
    if (!confirm(`确定删除一级分类「${name}」及其所有二级分类吗？\n已记录的账目不受影响。`)) return
    try { await api.deleteCategoryL1(id); onRefresh() }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : '未知错误'
      alert('删除失败: ' + message)
    }
  }

  const handleDeleteL2 = async (id: number, name: string) => {
    if (!confirm(`确定删除二级分类「${name}」吗？`)) return
    try { await api.deleteCategoryL2(id); onRefresh() }
    catch (e: unknown) {
      const message = e instanceof Error ? e.message : '未知错误'
      alert('删除失败: ' + message)
    }
  }

  const toggleExpand = (id: number) => {
    setExpandedL1(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  return (
    <div className="max-w-sm mx-auto space-y-4">
      {/* 系统分类 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
          <span>🔒</span>
          <span className="text-sm font-medium text-gray-600">系统分类</span>
          <span className="text-xs text-gray-400">一级不可改，可添子分类</span>
        </div>
        <div className="divide-y divide-gray-50">
          {systemL1.map(cat => (
            <div key={cat.id}>
              <button
                onClick={() => toggleExpand(cat.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{cat.icon}</span>
                  <span className="text-sm text-gray-700">{cat.name}</span>
                  <span className="text-xs text-gray-300">{cat.children.length}个子分类</span>
                </div>
                <span className="text-gray-300 text-xs">{expandedL1.has(cat.id) ? '▼' : '▶'}</span>
              </button>
              {expandedL1.has(cat.id) && (
                <div className="bg-gray-50/50 px-4 py-2">
                  {cat.children.map(child => (
                    <div key={child.id} className="flex items-center justify-between py-1.5 pl-8">
                      <span className="text-sm text-gray-500">{child.name}</span>
                      {child.isSystem ? (
                        <span className="text-xs text-gray-300">🔒</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEditL2(child.id, child.name)} className="text-blue-400 hover:text-blue-600 text-xs">✏️</button>
                          <button onClick={() => handleDeleteL2(child.id, child.name)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => openAddL2(cat.id)}
                    className="w-full text-center py-1.5 pl-8 text-xs text-blue-500 hover:text-blue-600"
                  >
                    + 添加二级分类
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 我的分类 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-100 flex items-center gap-2">
          <span>✏️</span>
          <span className="text-sm font-medium text-yellow-700">我的分类</span>
          <span className="text-xs text-yellow-500">可编辑</span>
        </div>
        <div className="divide-y divide-gray-50">
          {userL1.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              还没有自定义分类，点击下方按钮添加
            </div>
          ) : (
            userL1.map(cat => (
              <div key={cat.id}>
                <button
                  onClick={() => toggleExpand(cat.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{cat.icon}</span>
                    <span className="text-sm text-gray-700">{cat.name}</span>
                    <span className="text-xs text-gray-300">{cat.children.length}个子分类</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-300 text-xs">{expandedL1.has(cat.id) ? '▼' : '▶'}</span>
                    <button
                      onClick={e => { e.stopPropagation(); openEditL1(cat.id, cat.name) }}
                      className="text-blue-400 hover:text-blue-600 text-sm"
                    >✏️</button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteL1(cat.id, cat.name) }}
                      className="text-red-400 hover:text-red-600 text-sm"
                    >🗑️</button>
                  </div>
                </button>
                {expandedL1.has(cat.id) && (
                  <div className="bg-gray-50/50 px-4 py-2">
                    {cat.children.map(child => (
                      <div key={child.id} className="flex items-center justify-between py-1.5 pl-8">
                        <span className="text-sm text-gray-500">{child.name}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEditL2(child.id, child.name)} className="text-blue-400 hover:text-blue-600 text-xs">✏️</button>
                          <button onClick={() => handleDeleteL2(child.id, child.name)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => openAddL2(cat.id)}
                      className="w-full text-center py-1.5 pl-8 text-xs text-blue-500 hover:text-blue-600"
                    >
                      + 添加二级分类
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 添加一级分类按钮 */}
      <button
        onClick={openAddL1}
        className="w-full py-3 rounded-xl border-2 border-dashed border-blue-300 text-blue-500 font-medium text-sm hover:bg-blue-50 transition-colors"
      >
        + 添加一级分类
      </button>

      {/* ========== 弹窗 ========== */}
      {modal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl p-5 w-72 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-800 mb-4">
              {modal.type === 'addL1' && '添加一级分类'}
              {modal.type === 'addL2' && '添加二级分类'}
              {modal.type === 'editL1' && '修改一级分类名'}
              {modal.type === 'editL2' && '修改二级分类名'}
            </h3>

            {/* Emoji 选择 (仅一级分类) */}
            {(modal.type === 'addL1') && (
              <div className="mb-3">
                <label className="text-xs text-gray-500 mb-1 block">选择图标</label>
                <div className="flex flex-wrap gap-1.5">
                  {EMOJI_LIST.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setModalIcon(emoji)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg ${
                        modalIcon === emoji ? 'bg-blue-100 ring-2 ring-blue-400' : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >{emoji}</button>
                  ))}
                </div>
              </div>
            )}

            {/* 名称输入 */}
            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-1 block">
                {modal.type === 'addL1' || modal.type === 'addL2' ? '分类名称' : '新名称'}
              </label>
              <input
                type="text"
                value={modalName}
                onChange={e => setModalName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                placeholder={modal.type === 'addL1' ? '例如：宠物' : '例如：猫粮'}
                autoFocus
                className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm"
              />
            </div>

            {/* 按钮 */}
            <div className="flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-500 text-sm hover:bg-gray-50">取消</button>
              <button onClick={handleSubmit} disabled={!modalName.trim()} className={`flex-1 py-2 rounded-lg text-white text-sm font-medium ${
                modalName.trim() ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-300 cursor-not-allowed'
              }`}>确定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
