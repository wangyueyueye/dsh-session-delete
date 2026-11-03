/**
 * 自测：在临时 DSH_HOME 里搭一个完整的“会话残留”夹具，跑 scan / perform，
 * 断言每一层都被正确盘点与删除。不需要启动 Harness。
 *
 *   node test/selftest.mjs
 */

import { mkdtemp, mkdir, writeFile, readFile, symlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const HOME = await mkdtemp(join(tmpdir(), 'dsh-delete-test-'))
process.env.DSH_HOME = HOME

const { __internals } = await import('../lib/index.js')
const { scan, perform } = __internals

const ID = 'session-11111111-2222-3333-4444-555555555555'
const OTHER = 'session-99999999-8888-7777-6666-555555555555'
const SHARED = 'a'.repeat(64)
const ORPHAN = 'b'.repeat(64)

await mkdir(join(HOME, 'sessions', '--D-ws--', ID), { recursive: true })
await mkdir(join(HOME, 'sessions', '--D-ws--', OTHER), { recursive: true })
await writeFile(join(HOME, 'sessions', '--D-ws--', ID, 'session.v4.jsonl.zstd'), 'x'.repeat(2048))
await writeFile(join(HOME, 'sessions', '--D-ws--', ID, 'session.v3.jsonl.zstd'), 'y'.repeat(1024))
await writeFile(join(HOME, 'sessions', '--D-ws--', OTHER, 'session.v4.jsonl.zstd'), 'z'.repeat(64))

await mkdir(join(HOME, 'storages', 'session_projcache', 'sessions'), { recursive: true })
await writeFile(join(HOME, 'storages', 'session_projcache', 'sessions', `${ID}.json`), '{"version":7}')
await writeFile(join(HOME, 'storages', 'session_projcache', 'sessions', `${ID}.json.bak.1700000000000`), '{"version":6}')
await writeFile(join(HOME, 'storages', 'session_projcache', 'sessions', `${OTHER}.json`), '{"version":7}')

await mkdir(join(HOME, 'storages', 'vision_router_session_policy', 'policies'), { recursive: true })
await writeFile(join(HOME, 'storages', 'vision_router_session_policy', 'policies', `${ID}.json`), '{"version":1}')

for (const digest of [SHARED, ORPHAN]) {
  await mkdir(join(HOME, 'attachments', 'v1', 'objects', digest.slice(0, 2)), { recursive: true })
  await writeFile(join(HOME, 'attachments', 'v1', 'objects', digest.slice(0, 2), digest), 'img'.repeat(500))
}

const workspace = {
  id: 'ws-1',
  title: 'deepseek harness workspace',
  sessionIds: [ID, OTHER],
  async detachSession(sessionId) {
    this.sessionIds = this.sessionIds.filter((value) => value !== sessionId)
  }
}

const registry = {
  archivedSessionIds: [ID],
  pinnedSessionIds: [ID],
  list() {
    return [workspace]
  },
  async unpinSession(id) {
    registry.pinnedSessionIds = registry.pinnedSessionIds.filter((value) => value !== id)
  },
  async unarchiveSession(id) {
    registry.archivedSessionIds = registry.archivedSessionIds.filter((value) => value !== id)
  }
}

const eventsFor = {
  [ID]: [{ type: 'user/message', data: { text: 'hi', files: [{ id: `sha256:${SHARED}` }, { id: `sha256:${ORPHAN}` }] } }],
  [OTHER]: [{ type: 'user/message', data: { text: 'yo', files: [{ id: `sha256:${SHARED}` }] } }]
}

const ctx = {
  sessionPersistence: {
    root: join(HOME, 'sessions'),
    async list() {
      return Object.keys(eventsFor).map((id) => ({ header: { id } }))
    },
    async open(id) {
      return {
        async read() {
          return { events: eventsFor[id] ?? [] }
        },
        async close() {}
      }
    }
  },
  workspaceRegistry: registry,
  sessions: { get: () => undefined, flush: async () => {} },
  get: (name) => (name === 'agents' ? { get: () => undefined } : undefined),
  connection: { fetch: { register: () => () => {} } },
  effect: (fn) => fn()
}

const group = (result, key) => result.groups.find((item) => item.key === key)

const level1 = await scan(ctx, ID, false)
assert.equal(level1.exists, true)
assert.equal(group(level1, 'records').count, 2, '两代日志都要被盘点')
assert.equal(group(level1, 'cache').count, 2, '缓存要带上 .bak 变体')
assert.equal(group(level1, 'sidecars').count, 1, '插件 sidecar 要被发现')
assert.ok(group(level1, 'index').note.includes('置顶'), '置顶身份要显示')
assert.ok(group(level1, 'index').note.includes('归档'), '归档身份要显示')

const deep = await scan(ctx, ID, true)
assert.equal(group(deep, 'attachments').count, 2)
assert.ok(group(deep, 'attachments').note.includes('1 个仅本会话引用'), '只应把 ORPHAN 判为孤儿')

const result = await perform(ctx, ID, 'standard', 'normal')
assert.equal(result.ok, true)
assert.equal(existsSync(join(HOME, 'sessions', '--D-ws--', ID)), false, '会话目录必须整体消失')
assert.equal(existsSync(join(HOME, 'storages', 'session_projcache', 'sessions', `${ID}.json`)), false)
assert.equal(existsSync(join(HOME, 'storages', 'session_projcache', 'sessions', `${ID}.json.bak.1700000000000`)), false)
assert.equal(existsSync(join(HOME, 'storages', 'vision_router_session_policy', 'policies', `${ID}.json`)), false)
assert.deepEqual(workspace.sessionIds, [OTHER], '工作区成员关系要摘掉')
assert.deepEqual(registry.pinnedSessionIds, [], '置顶要摘掉')
assert.deepEqual(registry.archivedSessionIds, [], '归档要摘掉')
assert.ok(existsSync(join(HOME, 'attachments', 'v1', 'objects', SHARED.slice(0, 2), SHARED)), 'standard 档不能碰附件')

const missing = await perform(ctx, ID, 'standard', 'normal')
assert.equal(missing.code, 'SESSION_NOT_FOUND')

// 重建一份，验证彻底档只删孤儿附件
await mkdir(join(HOME, 'sessions', '--D-ws--', ID), { recursive: true })
await writeFile(join(HOME, 'sessions', '--D-ws--', ID, 'session.v4.jsonl.zstd'), 'q'.repeat(4096))
await writeFile(join(HOME, 'storages', 'session_projcache', 'sessions', `${ID}.json`), '{"version":7}')
const deepResult = await perform(ctx, ID, 'deep', 'normal')
assert.equal(deepResult.ok, true)
assert.equal(existsSync(join(HOME, 'attachments', 'v1', 'objects', ORPHAN.slice(0, 2), ORPHAN)), false, '孤儿附件要删')
assert.ok(existsSync(join(HOME, 'attachments', 'v1', 'objects', SHARED.slice(0, 2), SHARED)), '共享附件必须留下')

// 覆盖擦除
await mkdir(join(HOME, 'sessions', '--D-ws--', ID), { recursive: true })
const shredTarget = join(HOME, 'sessions', '--D-ws--', ID, 'session.v4.jsonl.zstd')
await writeFile(shredTarget, 'SECRET'.repeat(400))
const shredded = await perform(ctx, ID, 'records', 'shred')
assert.equal(shredded.ok, true)
assert.equal(existsSync(shredTarget), false)
assert.equal(shredded.removed.bytes > 0, true, '要统计释放的字节数')

/* ---------- 硬化：路径闸门 ---------- */
const { within } = __internals
const SESSIONS = join(HOME, 'sessions')
assert.equal(within(SESSIONS, join(SESSIONS, '--D-ws--', ID, 'session.v4.jsonl.zstd')), true, '根内文件应放行')
assert.equal(within(SESSIONS, join(SESSIONS, '..', 'storages', 'x.json')), false, '父目录穿越必须拦住')
assert.equal(within(SESSIONS, 'C:\\Windows\\System32\\drivers\\etc\\hosts'), false, '系统路径必须拦住')
assert.equal(within(SESSIONS, SESSIONS), true, '根本身放行')

/* ---------- 硬化：符号链接不跟进 ---------- */
const outside = join(HOME, 'outside-precious.txt')
await writeFile(outside, 'must survive')
let symlinkSupported = true
try {
  await mkdir(join(HOME, 'sessions', '--D-ws--', ID), { recursive: true })
  await symlink(outside, join(HOME, 'sessions', '--D-ws--', ID, 'link.txt'))
} catch {
  symlinkSupported = false
}
if (symlinkSupported) {
  const withLink = await perform(ctx, ID, 'records', 'normal')
  assert.equal(withLink.ok, true)
  assert.equal(existsSync(outside), true, '符号链接的目标绝不能删')
  assert.ok(
    withLink.removed.blocked.some((item) => item.code === 'SYMLINK'),
    '符号链接要被拦下并记录'
  )
} else {
  console.log('（跳过符号链接用例：当前环境无权限创建符号链接）')
}

/* ---------- 审计日志 ---------- */
const auditFile = join(HOME, 'logs', 'session-delete-audit.jsonl')
assert.equal(existsSync(auditFile), true, '每次删除都要留审计记录')
const auditLines = (await readFile(auditFile, 'utf8')).trim().split('\n')
assert.ok(auditLines.length >= 3, '审计行数要与删除次数匹配')
const lastAudit = JSON.parse(auditLines.at(-1))
assert.equal(lastAudit.sessionId, ID)
assert.equal(lastAudit.scope, 'records')

/* ---------- 硬化：目录联接不能被顺着删出去 ---------- */
const outsideDir = join(HOME, 'outside-dir')
await mkdir(outsideDir, { recursive: true })
await writeFile(join(outsideDir, 'keep.txt'), 'must survive')
const sessionDir = join(HOME, 'sessions', '--D-ws--', ID)
await mkdir(sessionDir, { recursive: true })
await writeFile(join(sessionDir, 'session.v4.jsonl.zstd'), 'x'.repeat(100))
let junctionSupported = true
try {
  await symlink(outsideDir, join(sessionDir, 'junction-away'), 'junction')
} catch {
  junctionSupported = false
}
if (junctionSupported) {
  const withJunction = await perform(ctx, ID, 'records', 'normal')
  assert.equal(withJunction.ok, true)
  assert.equal(existsSync(join(outsideDir, 'keep.txt')), true, '联接目标里的文件绝不能被删')
  assert.ok(
    withJunction.removed.blocked.some((item) => item.code === 'SYMLINK'),
    '目录联接要被拦下并记账'
  )
  console.log('（已测：会话目录里的联接没有被顺着删出去，且被拦下记账）')
} else {
  console.log('（跳过联接用例：当前环境无权限创建联接）')
}

/* ---------- 硬化：会话目录本身就是联接时，不认它 ---------- */
const fakeId = 'session-junction0000-0000-0000-000000000000'
const junctionSession = join(HOME, 'sessions', '--D-ws--', fakeId)
if (junctionSupported) {
  await symlink(outsideDir, junctionSession, 'junction')
  const asJunction = await perform(ctx, fakeId, 'records', 'normal')
  assert.equal(asJunction.code, 'SESSION_NOT_FOUND', '联接形式的会话目录要当作不存在')
  assert.equal(existsSync(join(outsideDir, 'keep.txt')), true, '更不能顺着它删')
}

console.log('self-test ok:', {
  groups: level1.groups.map((item) => `${item.key}=${item.count}`).join(' '),
  removedFiles: result.removed.files,
  removedBytes: result.removed.bytes,
  auditLines: auditLines.length
})
