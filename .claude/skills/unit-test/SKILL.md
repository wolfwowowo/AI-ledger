---
name: unit-test
description: 为项目代码创建单元测试、执行测试、并生成测试报告。当用户要求"写测试"、"加单元测试"、"跑测试"、"测试报告"、"测试覆盖率"、"检查这段代码有没有问题"时使用。
allowed-tools: Read, Write, Edit, Bash
argument-hint: <目标文件或模块>
---

# 单元测试

> **重要：本技能必须通过 `tester` 子代理执行。** 收到任何测试相关需求时，使用 Agent 工具派出 `tester` 子代理（subagent_type: tester），不要自己直接执行。子代理会按照下面的工作流完成任务。

本技能为黑马记账项目提供完整的单元测试工作流：**写测试 → 跑测试 → 出报告**。

## 技术环境

- **测试框架**: Vitest（与项目 Vite 同体系，零额外配置）
- **配置文件**: `vitest.config.ts`
- **测试目录**: `tests/`
- **命名规范**: `tests/<模块名>.test.ts`
- **Mock 方式**: `vi.mock('fs')` 模拟文件系统，避免污染真实数据

## 工作流

### 第一步：了解要测什么

1. 如果用户指定了文件（`$ARGUMENTS`），先读取该文件
2. 如果用户没指定，询问要测哪个文件
3. 分析文件中的函数/方法，确定：
   - **正常路径**（Happy Path）：正常输入 → 期望输出
   - **边界情况**（Edge Case）：空值、0、负数、超长字符串等
   - **错误处理**（Error Path）：非法输入时是否正确报错

### 第二步：编写测试

参考 `tests/store.test.ts` 的写法（这是现有的示例测试，格式一致）：

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('模块名 — 功能领域', () => {
  beforeEach(() => {
    // 每个测试前重置状态
  })

  it('应该 xxx（正常情况）', () => {
    const result = someFunction(validInput)
    expect(result).toEqual(expectedOutput)
  })

  it('输入非法时应报错（异常情况）', () => {
    expect(() => someFunction(invalidInput)).toThrow('错误信息')
  })
})
```

**关键原则**:
- 测试文件放在 `tests/` 目录，文件名对应源文件名
- 每个 `it(...)` 只测一件事
- 测试名称用中文描述"测什么 + 期望什么"
- 用 `vi.mock()` 模拟外部依赖（文件系统、网络请求等）

### 第三步：执行测试

```bash
npx vitest run
```

如果只想跑某个测试文件：
```bash
npx vitest run tests/<文件名>
```

### 第四步：生成测试报告

**覆盖率报告**（含 HTML 可视化）：
```bash
npx vitest run --coverage
```

**持续监视模式**（边改代码边自动重跑）：
```bash
npx vitest
```

**可视化界面**（浏览器打开）：
```bash
npx vitest --ui
```

## 报告解读

执行完成后，向用户汇报以下内容：

| 指标 | 含义 | 好/坏标准 |
|------|------|-----------|
| Tests | 测试项总数 | — |
| Passed | 通过的测试 | 越多越好 |
| Failed | 失败的测试 | 应为 0 |
| % Stmts | 语句覆盖率 | >70% 合格，>90% 优秀 |
| % Branch | 分支覆盖率 | 每个 if/else 是否都测到 |
| % Funcs | 函数覆盖率 | 有多少函数被测到了 |

如果测试失败，逐条报告：
- 哪个测试失败了
- 期望值 vs 实际值
- 可能的原因和修复建议

## 可用的 npm 脚本

| 命令 | 作用 |
|------|------|
| `npm test` | 运行全部测试（单次） |
| `npm run test:watch` | 监视模式 |
| `npm run test:ui` | 可视化界面 |
| `npm run test:coverage` | 测试 + 覆盖率报告 |
