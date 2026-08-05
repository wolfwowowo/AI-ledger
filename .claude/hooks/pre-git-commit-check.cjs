/**
 * Git Commit 拦截 Hook (PreToolUse on Bash)
 *
 * 拦截 git commit 命令，检查标记文件：
 * - .claude/.test-result.json
 * - .claude/.quality-result.json
 *
 * stdin 输入格式: { "tool_name": "Bash", "tool_input": { "command": "..." } }
 * stdout 输出格式: { "continue": false, "hookSpecificOutput": { "permissionDecision": "deny" } }
 */

const fs = require('fs');
const path = require('path');

// === 同步读取 stdin ===
// stdin 可能是 pipe（hook 调用）或 TTY（手动测试），判断后再读
let rawInput = '';
if (!process.stdin.isTTY) {
  rawInput = fs.readFileSync(0, 'utf8').trim();
}

let toolInput = {};
try { toolInput = JSON.parse(rawInput || '{}'); } catch (_) {}

// 兼容：也支持 argv[2]（方便手动 pipe 测试）
if (!toolInput.tool_name && process.argv[2]) {
  try {
    const arg = JSON.parse(process.argv[2]);
    if (arg.command) toolInput = { tool_name: 'Bash', tool_input: arg };
  } catch (_) {}
}

const command = ((toolInput.tool_input || {}).command || '').trim();

// 只拦截 git commit
if (!/^git commit\b/.test(command)) {
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
    ...missing.map(f => '  ✗ ' + f),
    '',
    '请通过 gitcommit-agent 生成检查标记：',
    '  输入 "提交代码" 自动运行测试+质量检查',
  ].join('\n'));
}

// === 检查 2: 标记未过期 ===
if (testResult.gitHead !== currentHead || qualityResult.gitHead !== currentHead) {
  deny('⛔ 提交被拦截：检查标记已过期\n\n代码已变更，旧标记失效。请重新运行 gitcommit-agent。');
}

// === 检查 3: 测试通过 ===
if (!testResult.passed) {
  const fails = (testResult.failures || []).map(f => '  ✗ ' + f.name);
  deny([
    '⛔ 提交被拦截：单元测试未通过',
    '',
    `  通过: ${testResult.passedCount}/${testResult.total}  失败: ${testResult.failed}/${testResult.total}`,
    ...fails,
    '',
    '请修复后重新运行 gitcommit-agent。',
  ].join('\n'));
}

// === 检查 4: 质量达标 ===
if (!qualityResult.passed) {
  deny([
    '⛔ 提交被拦截：质量检查未达标',
    '',
    `  总分: ${qualityResult.score}/10（需 ≥ 6）`,
    `  高危: ${qualityResult.highRiskCount} 个（需 0 个）`,
    '',
    '请修复后重新运行 gitcommit-agent。',
  ].join('\n'));
}

// === 全部通过 ===
console.log(JSON.stringify({
  continue: true,
  systemMessage: `✅ 测试通过，质量达标 (score: ${qualityResult.score}/10)`,
}));
