/**
 * Git Commit 拦截 Hook
 *
 * 在每次 git commit 命令执行前检查：
 * 1. .claude/.test-result.json — 单元测试是否通过
 * 2. .claude/.quality-result.json — 质量检查是否通过
 *
 * 输出 JSON 到 stdout，由 Claude Code hook 系统解析：
 * - { "decision": "allow" } → 放行，继续执行 git commit
 * - { "decision": "deny", "reason": "..." } → 拦截，向用户显示 reason
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// --- 读取 tool input ---
const toolInput = JSON.parse(process.argv[2] || '{}');
const command = (toolInput.command || '').trim();

// --- 只拦截 git commit（不拦 git add / push / status 等） ---
if (!/^git commit\b/.test(command)) {
  console.log(JSON.stringify({ decision: 'allow' }));
  process.exit(0);
}

// --- 获取项目根目录和当前 HEAD ---
const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();

let currentHead;
try {
  currentHead = execSync('git rev-parse HEAD', { cwd: projectRoot, encoding: 'utf8' }).trim();
} catch {
  // 如果没有 commit 记录（全新仓库），跳过检查
  console.log(JSON.stringify({
    decision: 'allow',
    reason: '（仓库尚无 commit 记录，跳过检查）',
  }));
  process.exit(0);
}

// --- 读取标记文件 ---
const testResultPath = path.join(projectRoot, '.claude', '.test-result.json');
const qualityResultPath = path.join(projectRoot, '.claude', '.quality-result.json');

let testResult = null;
let qualityResult = null;

try {
  if (fs.existsSync(testResultPath)) {
    testResult = JSON.parse(fs.readFileSync(testResultPath, 'utf8'));
  }
} catch {
  // 文件损坏，当作不存在处理
}

try {
  if (fs.existsSync(qualityResultPath)) {
    qualityResult = JSON.parse(fs.readFileSync(qualityResultPath, 'utf8'));
  }
} catch {
  // 文件损坏，当作不存在处理
}

// --- 检查 1：标记文件是否存在 ---
if (!testResult || !qualityResult) {
  const missing = [];
  if (!testResult) missing.push('单元测试标记 (.claude/.test-result.json)');
  if (!qualityResult) missing.push('质量检查标记 (.claude/.quality-result.json)');

  console.log(JSON.stringify({
    decision: 'deny',
    reason: [
      '⛔ 提交被拦截：缺少检查标记文件',
      '',
      '以下标记文件不存在：',
      ...missing.map(f => `  ✗ ${f}`),
      '',
      '请通过 gitcommit-agent 生成检查标记：',
      '  在 Claude Code 中输入 "提交代码" 或 "gitcommit-agent"',
      '  → agent 会并行运行测试和质量检查',
      '  → 全部通过后自动提交',
    ].join('\n'),
  }));
  process.exit(0);
}

// --- 检查 2：标记是否过期（代码已变更） ---
if (testResult.gitHead !== currentHead || qualityResult.gitHead !== currentHead) {
  console.log(JSON.stringify({
    decision: 'deny',
    reason: [
      '⛔ 提交被拦截：检查标记已过期',
      '',
      '当前代码与生成标记时的代码不一致，旧标记自动失效。',
      '',
      `  标记时的 HEAD: ${testResult.gitHead.slice(0, 8)}...`,
      `  当前 HEAD:     ${currentHead.slice(0, 8)}...`,
      '',
      '请重新运行 gitcommit-agent 生成新的检查标记。',
    ].join('\n'),
  }));
  process.exit(0);
}

// --- 检查 3：测试是否通过 ---
if (!testResult.passed) {
  const failureLines = (testResult.failures || []).map(
    f => `  ✗ ${f.name}: 期望 ${f.expected}，实际 ${f.actual}`
  );

  console.log(JSON.stringify({
    decision: 'deny',
    reason: [
      '⛔ 提交被拦截：单元测试未通过',
      '',
      `  通过: ${testResult.passedCount}/${testResult.total}`,
      `  失败: ${testResult.failed}/${testResult.total}`,
      '',
      '失败测试：',
      ...(failureLines.length > 0 ? failureLines : ['  （无详情）']),
      '',
      '请修复失败的测试后重新运行 gitcommit-agent。',
    ].join('\n'),
  }));
  process.exit(0);
}

// --- 检查 4：质量是否达标 ---
if (!qualityResult.passed) {
  const reasons = [];
  if (qualityResult.score < 6) {
    reasons.push(`  总分 ${qualityResult.score}/10（需要 ≥ 6）`);
  }
  if (qualityResult.highRiskCount > 0) {
    reasons.push(`  高危安全问题 ${qualityResult.highRiskCount} 个（需要 0 个）`);
  }

  console.log(JSON.stringify({
    decision: 'deny',
    reason: [
      '⛔ 提交被拦截：质量检查未达标',
      '',
      `  总分: ${qualityResult.score}/10`,
      `  高危安全问题: ${qualityResult.highRiskCount} 个`,
      '',
      '不达标原因：',
      ...reasons,
      '',
      '请修复质量问题后重新运行 gitcommit-agent。',
    ].join('\n'),
  }));
  process.exit(0);
}

// --- 全部通过 → 放行 ---
console.log(JSON.stringify({
  decision: 'allow',
  reason: '✅ 测试通过 (passed: true)，质量达标 (score: ' + qualityResult.score + '/10, highRisk: 0)',
}));
