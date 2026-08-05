import { useState, useEffect, useRef, useCallback } from 'react'

const GRID = 20        // 20x20 网格
const CELL = 16        // 每格像素
const SIZE = GRID * CELL // 画布大小 320px
const SPEED = 140      // 蛇移动间隔(毫秒)

type Pos = { x: number; y: number }
type Dir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

const DIR_MAP: Record<string, Dir> = {
  ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
  w: 'UP', s: 'DOWN', a: 'LEFT', d: 'RIGHT',
}

const OPPOSITE: Record<Dir, Dir> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' }

function randomFood(snake: Pos[]): Pos {
  let pos: Pos
  do {
    pos = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) }
  } while (snake.some(s => s.x === pos.x && s.y === pos.y))
  return pos
}

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 用 ref 存可变游戏状态，避免频繁重渲染
  const snakeRef = useRef<Pos[]>([{ x: 10, y: 10 }])
  const foodRef = useRef<Pos>(randomFood([{ x: 10, y: 10 }]))
  const dirRef = useRef<Dir>('RIGHT')
  const nextDirRef = useRef<Dir>('RIGHT')
  const scoreRef = useRef(0)
  const runningRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 仅用于触发 UI 更新的状态
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [started, setStarted] = useState(false)

  // 绘制画布
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 背景
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 0, SIZE, SIZE)

    // 网格线
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= GRID; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, SIZE); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(SIZE, i * CELL); ctx.stroke()
    }

    // 食物
    const food = foodRef.current
    ctx.fillStyle = '#f43f5e'
    ctx.beginPath()
    ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 - 1, 0, Math.PI * 2)
    ctx.fill()

    // 蛇身
    const snake = snakeRef.current
    snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? '#10b981' : '#34d399'
      const r = i === 0 ? 3 : 2
      ctx.beginPath()
      ctx.roundRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2, r)
      ctx.fill()
    })
  }, [])

  // 游戏主循环
  const tick = useCallback(() => {
    dirRef.current = nextDirRef.current
    const snake = snakeRef.current
    const head = snake[0]
    const dir = dirRef.current

    const newHead: Pos = {
      x: head.x + (dir === 'LEFT' ? -1 : dir === 'RIGHT' ? 1 : 0),
      y: head.y + (dir === 'UP' ? -1 : dir === 'DOWN' ? 1 : 0),
    }

    // 撞墙
    if (newHead.x < 0 || newHead.x >= GRID || newHead.y < 0 || newHead.y >= GRID) {
      endGame()
      return
    }

    // 撞自己
    if (snake.some(s => s.x === newHead.x && s.y === newHead.y)) {
      endGame()
      return
    }

    const newSnake = [newHead, ...snake]

    // 吃到食物
    if (newHead.x === foodRef.current.x && newHead.y === foodRef.current.y) {
      scoreRef.current += 10
      setScore(scoreRef.current)
      foodRef.current = randomFood(newSnake)
    } else {
      newSnake.pop()
    }

    snakeRef.current = newSnake
    draw()
  }, [draw])

  const endGame = () => {
    runningRef.current = false
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setGameOver(true)
  }

  const startGame = useCallback(() => {
    const initialSnake = [{ x: 10, y: 10 }]
    snakeRef.current = initialSnake
    foodRef.current = randomFood(initialSnake)
    dirRef.current = 'RIGHT'
    nextDirRef.current = 'RIGHT'
    scoreRef.current = 0
    setScore(0)
    setGameOver(false)
    setStarted(true)

    draw() // 先画初始画面
    runningRef.current = true
    timerRef.current = setInterval(tick, SPEED)
  }, [tick, draw])

  // 键盘控制
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const newDir = DIR_MAP[e.key]
      if (!newDir) return
      e.preventDefault()

      // 不能掉头
      if (newDir !== OPPOSITE[dirRef.current]) {
        nextDirRef.current = newDir
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // 清理定时器
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  return (
    <div className="max-w-sm mx-auto space-y-4">
      {/* 分数 */}
      <div className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between">
        <span className="text-sm text-gray-500">得分</span>
        <span className="text-xl font-bold text-gray-800">{score}</span>
      </div>

      {/* 游戏画布 */}
      <div className="bg-white rounded-xl p-3 shadow-sm flex justify-center">
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          className="rounded-lg"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      {/* 操作说明 / 开始按钮 */}
      {!started && !gameOver && (
        <button
          onClick={startGame}
          className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold transition-colors"
        >
          🎮 开始游戏
        </button>
      )}

      {/* 游戏结束 */}
      {gameOver && (
        <div className="bg-white rounded-xl p-5 shadow-sm text-center space-y-3">
          <div className="text-4xl">💀</div>
          <div className="text-lg font-bold text-gray-800">游戏结束</div>
          <div className="text-sm text-gray-500">最终得分：{score}</div>
          <button
            onClick={startGame}
            className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-bold transition-colors"
          >
            🔄 再来一局
          </button>
        </div>
      )}

      {/* 操作提示 */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-medium text-gray-500 mb-2">操作方式</h3>
        <div className="text-xs text-gray-400 space-y-1">
          <p>⌨️ 方向键 ↑↓←→ 或 W A S D 控制蛇的方向</p>
          <p>🍎 吃到红色食物 +10 分</p>
          <p>💀 撞墙或撞到自己则游戏结束</p>
        </div>
      </div>
    </div>
  )
}
