import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 测试环境：server 端用 node，前端组件用 jsdom（如需要）
    environment: 'node',
    // 测试文件位置
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'tests/**/*.spec.ts'],
    // 覆盖率配置
    coverage: {
      provider: 'v8',
      include: ['server/**/*.ts', 'src/renderer/**/*.{ts,tsx}'],
      reporter: ['text', 'text-summary', 'html'],
      reportsDirectory: 'tests/coverage',
      thresholds: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },
    // 测试报告
    reporters: ['verbose'],
    // 全局设置
    globals: false,
  },
})
