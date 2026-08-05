---
name: security-audit
description: 对项目代码进行安全审查，检查敏感信息泄露、注入漏洞、配置安全等隐患。当用户要求"安全检查"、"安全审查"、"代码审计"、"security audit"、"查漏洞"时使用。
allowed-tools: Read, Bash, Glob, Grep
argument-hint: <目标文件或目录>
---

# 安全审查

对项目代码进行全面的安全漏洞扫描，按照 4 大类别逐项检查并输出报告。

> **重要**：本审查只读不写，绝不修改任何代码。发现问题时只报告，由用户决定是否修复。

---

## 审查流程

### 第一步：确定审查范围

- 用户指定了文件/目录（`$ARGUMENTS`）→ 审查该范围
- 用户没指定 → 审查最近修改的代码，或询问要审查什么

### 第二步：逐维度检查

---

## 检查清单

### 🔴 类别一：敏感信息泄露

**检查目标**：代码中是否直接写入了密码、密钥、Token 等敏感信息。

**扫描规则**：
```
搜索关键字：
- password、passwd、pwd、secret、token、api_key、apikey
- private_key、privateKey、access_key、accessKey
- 硬编码的 JWT、Bearer Token、Session Secret
- 数据库连接字符串中的用户名密码
- 邮箱账号密码、第三方服务密钥
```

**检查方法**：
1. 用 Bash 搜索代码中的敏感关键字：
   ```bash
   grep -rn -i "password\|passwd\|secret\|token\|api_key\|apikey\|private.key\|access.key" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.cjs" --include="*.mjs"
   ```
2. 逐一判断是否为硬编码的真实凭证还是变量引用

**判定标准**：
| 情况 | 判定 |
|------|------|
| `const password = "abc123"` | 🔴 硬编码密码 |
| `const password = process.env.DB_PASS` | 🟢 使用环境变量，安全 |
| `const API_KEY = "sk-xxxx"` | 🔴 硬编码密钥 |
| JSON 配置中有明文密码 | 🔴 配置文件泄露 |
| `.env` 文件已加入 `.gitignore` | 🟢 已防护 |

---

### 🔴 类别二：注入漏洞

**检查目标**：用户输入是否被安全处理，是否存在注入风险。

**扫描规则**：
```
风险模式：
- SQL 拼接：字符串拼接构造 SQL 语句
- 命令注入：child_process.exec() 拼接用户输入
- 路径遍历：文件路径直接拼接用户输入，未做 ../ 过滤
- XSS：直接将用户输入插入 HTML（innerHTML、dangerouslySetInnerHTML）
- eval：使用 eval()、new Function() 执行动态代码
```

**检查方法**：
1. 搜索 SQL 拼接相关的代码模式
2. 搜索 `exec(`、`eval(`、`dangerouslySetInnerHTML`、`innerHTML` 的使用
3. 检查文件路径操作是否有 `../` 穿越风险
4. 检查 API 路由的输入验证是否完整

**判定标准**：
```typescript
// 🔴 SQL 注入风险
const query = `SELECT * FROM users WHERE name = '${userInput}'`

// 🟢 参数化查询，安全
const query = 'SELECT * FROM users WHERE name = ?'

// 🔴 命令注入风险
exec(`ls ${userInput}`)

// 🔴 XSS 风险
element.innerHTML = userInput

// 🔴 路径遍历风险
fs.readFile(`./data/${userInput}.json`)
```

---

### 🟡 类别三：配置文件安全

**检查目标**：配置文件中是否存在明文敏感信息，安全配置是否到位。

**扫描规则**：
- 检查 `package.json`、`tsconfig.json`、`.env` 等配置文件
- 检查是否暴露了内部端口、数据库地址、第三方服务凭证
- 检查 CORS 配置是否过于宽松（`*` 来源）
- 检查依赖中是否有已知漏洞的版本
- 检查 `.gitignore` 是否排除了 `.env`、`data/` 等敏感路径

**检查方法**：
1. 读取配置文件，逐项检查敏感字段
2. 检查 `.gitignore` 覆盖范围
3. 用 `npm audit` 检查依赖漏洞

---

### 🟠 类别四：其它安全隐患

以下额外风险项也纳入审查：

| 风险类型 | 检查内容 |
|----------|----------|
| **不安全的随机数** | 是否用 `Math.random()` 生成 Token 或密码（应用 `crypto.randomBytes`） |
| **无速率限制** | API 是否缺少请求频率限制（暴力破解风险） |
| **错误信息泄露** | 错误返回是否暴露了内部路径、数据库结构、堆栈信息 |
| **不安全的文件上传** | 文件类型、大小是否做了校验 |
| **HTTP 而非 HTTPS** | 生产环境是否使用 HTTP 明文传输 |
| **缺少 CSP 头** | 是否配置了 Content-Security-Policy 安全头 |
| **不安全的反序列化** | 是否直接解析用户提供的 JSON/序列化数据而不校验 |
| **原型污染** | 对象合并/拷贝时是否过滤了 `__proto__`、`constructor` 等危险属性 |

---

## 输出格式

审查完成后，按以下格式输出：

```
## 🔒 安全审查报告

### 📊 总览
| 风险等级 | 数量 |
|----------|------|
| 🔴 高危 | X 个 |
| 🟡 中危 | X 个 |
| 🟢 低危 | X 个 |

---

### 🔴 高危风险（需立即修复）

#### 1. [风险标题]
- **文件**：path/to/file.ts:42
- **问题**：具体描述发现了什么
- **风险**：说明可能被如何利用
- **修复**：给出具体的修复代码示例

---

### 🟡 中危风险（建议修复）

#### 1. [风险标题]
- **文件**：path
- **问题**：...
- **修复**：...

---

### 🟢 低危/建议（可选修复）

---

### ✅ 审查总结
- 共扫描 X 个文件
- 发现 X 个安全问题
- 其中 X 个高危需立即处理
```

---

## 审查原则

1. **宁多报不少报**：不确定是否为风险时，标记为"待确认"并说明原因
2. **给出修复方案**：每个问题必须附带具体的修复代码，不只是说"有风险"
3. **区分真实风险**：变量名含 `password` 但值是 `process.env.X` 的不算泄露
4. **关注项目实际风险**：本项目是个人记账桌面应用，远程攻击面小，重点关注数据安全和本地文件安全
