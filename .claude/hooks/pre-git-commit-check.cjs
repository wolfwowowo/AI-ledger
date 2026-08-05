/**
 * Git Commit 拦截 Hook (PreToolUse on Bash)
 *
 * 拦截 git commit 命令，检查标记文件：
 * - .claude/.test-result.json
 * - .claude/.quality-result.json
 */

const fs = require('fs');
const path = require('path');

// === 读取 stdin ===
let rawInput = '';
if (!process.stdin.isTTY) {
  rawInput = fs.readFileSync(0, 'utf8').trim();
}

let toolInput = {};
try { toolInput = JSON.parse(rawInput || '{}'); } catch (_) {}

// 兼容 argv[2]（方便手动 pipe 测试）
if (!toolInput.tool_name && process.argv[2]) {
  try {
    const arg = JSON.parse(process.argv[2]);
    if (arg.command) toolInput = { tool_name: 'Bash', tool_input: arg };
  } catch (_) {}
}

const command = ((toolInput.tool_input || {}).command || '').trim();

// 只拦截 git commit
if (!/git commit\b/.test(command)) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// === 获取项目信息 ===
const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const { execSync } = require('child_process');

let currentHead;
try {
  currentHead = execSync('git rev-parse HEAD', { cwd: projectRoot, encoding: 'utf8' }).trim();
} catch (_) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// === 读取标记文件 ===
const testFile = path.join(projectRoot, '.claude', '.test-result.json');
const qualityFile = path.join(projectRoot, '.claude', '.quality-result.json');

let testResult = null, qualityResult = null;
try { if (fs.existsSync(testFile)) testResult = JSON.parse(fs.readFileSync(testFile, 'utf8')); } catch (_) {}
try { if (fs.existsSync(qualityFile)) qualityResult = JSON.parse(fs.readFileSync(qualityFile, 'utf8')); } catch (_) {}

function deny(reason) {
  console.log(JSON.stringify({
    continue: false,
    stopReason: reason,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

// === 检查 1: 标记文件存在 ===
if (!testResult || !qualityResult) {
  const missing = [];
  if (!testResult) missing.push('单元测试标记 (.test-result.json)');
  if (!qualityResult) missing.push('质量检查标记 (.quality-result.json)');
  deny([
    '⛔ 提交被拦截：缺少检查标记文件',
    '',
    '原因：',
    ...missing.map(f => '  ✗ 找不到 ' + f),
    '',
    '📋 怎么办？',
    '  在对话框中输入 提交代码，我会自动：',
    '    ① 并行运行单元测试 + 代码质量检查',
    '    ② 全部通过后自动帮你 commit + push',
    '',
    '⚡ 快捷操作：直接说"提交代码"即可。',
  ].join('\n'));
}

// === 检查 2: 标记未过期 ===
if (testResult.gitHead !== currentHead || qualityResult.gitHead !== currentHead) {
  deny([
    '⛔ 提交被拦截：检查标记已过期',
    '',
    '原因：上次检查通过后代码又有新的改动，旧标记自动失效。',
    '',
    '📋 怎么办？',
    '  输入 提交代码，重新运行测试+质量检查，通过后自动提交。',
  ].join('\n'));
}

// === 检查 3: 测试通过 ===
if (!testResult.passed) {
  const fails = (testResult.failures || []).map(f => '  ✗ ' + f.name);
  deny([
    '⛔ 提交被拦截：单元测试未通过',
    '',
    `  ✅ 通过: ${testResult.passedCount} 项`,
    `  ❌ 失败: ${testResult.failed} 项`,
    ...(fails.length ? ['', '失败详情：', ...fails] : []),
    '',
    '📋 怎么办？',
    '  1. 根据上面的失败详情修复代码',
    '  2. 输入 提交代码 重新检查，通过后自动提交',
  ].join('\n'));
}

// === 检查 4: 质量达标 ===
if (!qualityResult.passed) {
  const qReasons = [];
  if (qualityResult.score < 6) qReasons.push(`  总分 ${qualityResult.score}/10（需要 ≥ 6 分）`);
  if (qualityResult.highRiskCount > 0) qReasons.push(`  高危安全问题 ${qualityResult.highRiskCount} 个（需要 0 个）`);
  deny([
    '⛔ 提交被拦截：质量检查未达标',
    '',
    ...qReasons,
    '',
    '📋 怎么办？',
    '  1. 根据质量报告修复问题',
    '  2. 输入 提交代码 重新检查，通过后自动提交',
  ].join('\n'));
}

// === 全部通过 ===
console.log(JSON.stringify({
  continue: true,
  systemMessage: `✅ 测试通过，质量达标 (score: ${qualityResult.score}/10)`,
}));
