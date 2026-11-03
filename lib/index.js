/**
 * dsh-session-delete — Host half.
 *
 * DSH 的持久化 seam 明确没有删除 API（"No deletion or retention API"），归档只往
 * workspace.json 的 archivedSessionIds 里加一个 id。这个插件用一个精确 Fetch 路由
 * （owner 会话可通行）做两件事：
 *
 *   op: 'scan'   只读盘点一个会话散落在磁盘上的全部落点，返回清单给客户端对话框；
 *   op: 'delete' 按选定范围真正删除，并同步清理工作区索引。
 *
 * 落点（实测这台机器的布局）：
 *   1. <root>/<cwd 转写>/<id>/session.vN.jsonl.zstd   —— 会话本体，历史上可能并存多代
 *   2. <DSH_HOME>/storages/session_projcache/sessions/<id>.json[.bak.*]
 *      —— 投影缓存，含逐轮 prompt / response 原文
 *   3. <DSH_HOME>/storages/workspace.json —— 会话列表、置顶、归档三处 id
 *   4. <DSH_HOME>/storages/<plugin domain>/.../<id>.json —— 各插件自己按会话存的数据
 *   5. <DSH_HOME>/attachments/v1/...  —— 内容寻址的附件对象，去重且永不自动删除
 */

import { readdir, stat, lstat, open, unlink, rm, mkdir, appendFile, realpath } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { homedir } from 'node:os'

export const name = 'session-delete'
export const inject = ['connection', 'sessionPersistence', 'workspaceRegistry', 'sessions']

const ROUTE_PATH = '/api/session-delete'
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const SCOPES = new Set(['records', 'standard', 'deep'])
const MODES = new Set(['normal', 'shred'])

/** @returns {string} DSH_HOME，宿主进程一定有，缺失时退回 ~/.dsh。 */
function home() {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

async function isDir(path) {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

async function statSafe(path) {
  try {
    return await stat(path)
  } catch {
    return undefined
  }
}

async function listDir(path) {
  try {
    return await readdir(path, { withFileTypes: true })
  } catch {
    return []
  }
}

/**
 * 递归收集目录下的普通文件及其字节数。
 * @param dir 起始目录。
 * @param depth 剩余递归深度。
 * @returns {{path: string, bytes: number}[]}
 */
async function walkFiles(dir, depth = 4) {
  const out = []
  for (const entry of await listDir(dir)) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (depth > 0) out.push(...(await walkFiles(path, depth - 1)))
      continue
    }
    if (!entry.isFile()) continue
    const info = await statSafe(path)
    out.push({ path, bytes: info?.size ?? 0 })
  }
  return out
}

/**
 * 会话本体目录：持久化后端根目录下、任意项目目录里以该会话 id 命名的目录。
 * 不猜路径转写规则，直接扫一层。
 * @param ctx Host 上下文。
 * @param id 会话 id。
 * @returns {Promise<string[]>}
 */
async function sessionDirs(ctx, id) {
  const roots = []
  const backendRoot = ctx.sessionPersistence?.root
  if (typeof backendRoot === 'string') roots.push(backendRoot)
  roots.push(join(home(), 'sessions'))

  const found = []
  const seen = new Set()
  for (const root of roots) {
    if (seen.has(root)) continue
    seen.add(root)
    if (!(await isDir(root))) continue
    for (const entry of await listDir(root)) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue
      const candidate = join(root, entry.name, id)
      // 用 lstat：`stat` 会跟随目录联接，等于允许别人把删除指到别处。
      try {
        const info = await lstat(candidate)
        if (info.isDirectory() && !info.isSymbolicLink()) found.push(candidate)
      } catch {
        /* 不存在就跳过 */
      }
    }
  }
  return found
}

/**
 * 投影缓存：`session_projcache/sessions/` 下所有以 `<id>.` 开头的文件，
 * 一并带上 `.bak.<时间戳>` 之类的变体。
 */
async function projectionCacheFiles(id) {
  const dir = join(home(), 'storages', 'session_projcache', 'sessions')
  const out = []
  for (const entry of await listDir(dir)) {
    if (!entry.isFile()) continue
    if (entry.name !== id && !entry.name.startsWith(`${id}.`)) continue
    const path = join(dir, entry.name)
    const info = await statSafe(path)
    out.push({ path, bytes: info?.size ?? 0 })
  }
  return out
}

/**
 * 插件 sidecar：storages 下除了投影缓存之外，任何目录里以该 id 命名的记录文件。
 * 插件域是开放的（每个插件自带 domain），所以有限深度地扫，而不是硬编码名字。
 */
async function sidecarFiles(id) {
  const root = join(home(), 'storages')
  const out = []
  const skip = join(root, 'session_projcache')

  async function walk(dir, depth) {
    for (const entry of await listDir(dir)) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (depth > 0 && path !== skip && !path.startsWith(`${skip}\\`) && !path.startsWith(`${skip}/`)) {
          await walk(path, depth - 1)
        }
        continue
      }
      if (!entry.isFile()) continue
      if (entry.name !== id && !entry.name.startsWith(`${id}.`)) continue
      const info = await statSafe(path)
      out.push({ path, bytes: info?.size ?? 0 })
    }
  }

  await walk(root, 3)
  return out
}

/** 从会话事件里收集附件对象摘要；读的是持久化 seam，不碰压缩帧。 */
async function attachmentDigests(ctx, id) {
  const backend = ctx.sessionPersistence
  if (backend === undefined) return new Set()
  let reader
  try {
    reader = await backend.open(id, 'read')
    const { events } = await reader.read()
    const text = JSON.stringify(events)
    const digests = new Set()
    const matches = text.match(/sha256:[0-9a-f]{64}/gi) ?? []
    for (const match of matches) digests.add(match.slice(7).toLowerCase())
    return digests
  } catch {
    return new Set()
  } finally {
    try {
      await reader?.close()
    } catch {
      /* 只读句柄关闭失败不影响删除 */
    }
  }
}

/** 附件在磁盘上的三个落点；`files/` 下的引用是硬链接，只删对象不会释放字节。 */
function attachmentPaths(digest) {
  const base = join(home(), 'attachments', 'v1')
  const prefix = digest.slice(0, 2)
  return {
    object: join(base, 'objects', prefix, digest),
    fileObject: join(base, 'file-objects', prefix, digest),
    filesDir: join(base, 'files', prefix, digest)
  }
}

/** 其他会话是否还引用这些摘要——只有"彻底"档才会付出这个读全量的代价。 */
async function digestsInUseElsewhere(ctx, digests, exceptId) {
  const inUse = new Set()
  if (digests.size === 0) return inUse
  const backend = ctx.sessionPersistence
  if (backend === undefined) return inUse

  let records = []
  try {
    records = await backend.list()
  } catch {
    return inUse
  }

  const wanted = [...digests]
  for (const record of records) {
    const otherId = record?.header?.id
    if (typeof otherId !== 'string' || otherId === exceptId) continue
    let reader
    try {
      reader = await backend.open(otherId, 'read')
      const { events } = await reader.read()
      const text = JSON.stringify(events)
      for (const digest of wanted) {
        if (text.includes(digest)) inUse.add(digest)
      }
    } catch {
      /* 读不了的历史就当成"可能还在用"，宁可不删 */
      for (const digest of wanted) inUse.add(digest)
    } finally {
      try {
        await reader?.close()
      } catch {
        /* ignore */
      }
    }
    if (inUse.size === wanted.length) break
  }
  return inUse
}

function sumBytes(items) {
  let bytes = 0
  for (const item of items) bytes += item.bytes
  return bytes
}

/** 工作区索引里这个会话的三种身份。 */
function indexState(ctx, id) {
  const registry = ctx.workspaceRegistry
  const workspaces = []
  let member = false
  try {
    for (const workspace of registry.list()) {
      const ids = workspace.sessionIds ?? []
      if (!ids.includes(id)) continue
      member = true
      workspaces.push({ id: workspace.id, title: workspace.title ?? workspace.path ?? '' })
    }
  } catch {
    /* 注册表还没就绪时只报未命中 */
  }
  const archived = registry.archivedSessionIds?.includes(id) ?? false
  const pinned = registry.pinnedSessionIds?.includes(id) ?? false
  return { member, workspaces, archived, pinned }
}

/**
 * 盘点清单。只读，不产生任何副作用，客户端对话框拿它渲染"删什么、多大、哪些不删"。
 * @param ctx Host 上下文。
 * @param id 会话 id。
 * @param deep 是否核对附件是否还被其他会话引用。
 */
async function scan(ctx, id, deep) {
  const dirs = await sessionDirs(ctx, id)
  const logFiles = []
  for (const dir of dirs) logFiles.push(...(await walkFiles(dir)))
  const cache = await projectionCacheFiles(id)
  const sidecars = await sidecarFiles(id)

  const digests = await attachmentDigests(ctx, id)
  const inUse = deep ? await digestsInUseElsewhere(ctx, digests, id) : new Set()
  const orphanDigests = deep ? [...digests].filter((digest) => !inUse.has(digest)) : []

  const attachmentSizes = []
  for (const digest of orphanDigests) {
    const paths = attachmentPaths(digest)
    for (const path of [paths.object, paths.fileObject]) {
      const info = await statSafe(path)
      if (info?.isFile()) attachmentSizes.push({ path, bytes: info.size })
    }
    for (const file of await walkFiles(paths.filesDir, 2)) attachmentSizes.push(file)
  }

  const index = indexState(ctx, id)
  const live = ctx.sessions.get(id) !== undefined
  let running = false
  try {
    running = ctx.get('agents')?.get(id)?.status === 'running'
  } catch {
    running = false
  }

  return {
    sessionId: id,
    live,
    running,
    exists: dirs.length > 0 || cache.length > 0 || sidecars.length > 0,
    groups: [
      {
        key: 'records',
        label: '会话记录',
        bytes: sumBytes(logFiles),
        count: logFiles.length,
        note: dirs.length > 1 ? `${dirs.length} 个存储目录 · 含全部历史格式代` : '含全部历史格式代',
        paths: logFiles.map((file) => file.path)
      },
      {
        key: 'cache',
        label: '投影缓存',
        bytes: sumBytes(cache),
        count: cache.length,
        note: cache.length > 0 ? '含标题与逐轮摘要原文' : '无',
        paths: cache.map((file) => file.path)
      },
      {
        key: 'sidecars',
        label: '插件数据',
        bytes: sumBytes(sidecars),
        count: sidecars.length,
        note: sidecars.length > 0 ? '各插件按会话存的数据' : '无',
        paths: sidecars.map((file) => file.path)
      },
      {
        key: 'index',
        label: '工作区索引',
        bytes: 0,
        count: (index.member ? 1 : 0) + (index.archived ? 1 : 0) + (index.pinned ? 1 : 0),
        note: [
          index.member ? `会话列表${index.workspaces.length > 1 ? ` ×${index.workspaces.length}` : ''}` : '',
          index.pinned ? '置顶' : '',
          index.archived ? '归档' : ''
        ].filter(Boolean).join(' / ') || '未登记',
        paths: []
      },
      {
        key: 'attachments',
        label: '附件对象',
        bytes: sumBytes(attachmentSizes),
        count: digests.size,
        note: deep
          ? `共 ${digests.size} 个，其中 ${orphanDigests.length} 个仅本会话引用`
          : `共 ${digests.size} 个，彻底档才核对是否仍被引用`,
        paths: attachmentSizes.map((file) => file.path)
      }
    ],
    skipped: [
      { label: '工作区里产出的文件', reason: '命令产生的文件无法归属到单个会话，不做猜测' },
      { label: '会话日志导出与运行日志', reason: '没有到会话的映射，删了会牵连其他会话' },
      { label: 'spill 溢出文件', reason: '位于系统临时目录，按时间自行清理' }
    ]
  }
}

/** 把文件内容用零覆盖后再解除链接；对 COW/SSD 只是抬高了恢复门槛。 */
async function shredFile(path, bytes) {
  const handle = await open(path, 'r+')
  try {
    const chunk = Buffer.alloc(Math.min(1024 * 1024, Math.max(bytes, 1)))
    let written = 0
    while (written < bytes) {
      const size = Math.min(chunk.length, bytes - written)
      await handle.write(chunk, 0, size, written)
      written += size
    }
    await handle.sync()
  } finally {
    await handle.close()
  }
}

/**
 * 路径必须落在给定的根目录内。
 *
 * 这是整个插件最重要的一道闸：所有删除都先过它。即使上游的逻辑出错、或者
 * `sessions/` 下有人放了指向别处的目录联接，也不可能删到根目录之外。
 * Windows 路径大小写不敏感，比较前统一小写。
 * @param root 允许的根目录。
 * @param path 待删路径。
 * @returns 是否在根内。
 */
function within(root, path) {
  const base = resolve(root)
  const target = resolve(path)
  const a = base.toLowerCase()
  const b = target.toLowerCase()
  return b === a || b.startsWith(a.endsWith(sep) ? a : a + sep)
}

/** 允许被删除的三个根：会话日志、键值存储、附件。 */
function allowedRoots(ctx) {
  const roots = []
  const backendRoot = ctx.sessionPersistence?.root
  if (typeof backendRoot === 'string') roots.push(backendRoot)
  roots.push(join(home(), 'sessions'), join(home(), 'storages'), join(home(), 'attachments'))
  return roots
}

/**
 * 删除一组文件。目录删除一律逐文件处理，这样覆盖擦除才有意义，
 * 单文件失败不阻断其余文件，最后把失败项报回去。
 *
 * 每个文件先过三关：在允许的根内、不是符号链接/目录联接、确实是普通文件。
 */
async function removeFiles(files, mode, report, roots) {
  for (const file of files) {
    try {
      if (!roots.some((root) => within(root, file.path))) {
        report.blocked.push({ path: file.path, code: 'OUTSIDE_ROOT' })
        continue
      }
      const info = await lstat(file.path)
      if (info.isSymbolicLink() || !info.isFile()) {
        report.blocked.push({ path: file.path, code: info.isSymbolicLink() ? 'SYMLINK' : 'NOT_A_FILE' })
        continue
      }
      // 字符串比较挡不住目录联接：路径写着在根内，物理上可能指到别处。
      // realpath 解析后必须仍然落在某个允许的根里。
      const real = await realpath(file.path)
      if (!roots.some((root) => within(root, real))) {
        report.blocked.push({ path: file.path, code: 'OUTSIDE_ROOT_REAL' })
        continue
      }
      if (mode === 'shred' && file.bytes > 0) await shredFile(file.path, file.bytes)
      await unlink(file.path)
      report.files += 1
      report.bytes += file.bytes
    } catch (error) {
      if (error?.code === 'ENOENT') continue
      report.failed.push({ path: file.path, code: error?.code ?? 'ERROR' })
    }
  }
}

/**
 * 清空会话目录骨架（文件已逐个删完，剩下的空目录与锁文件）。
 * 同样拒绝对符号链接/联接做递归删除——那会顺着链接删到别处。
 */
async function pruneDirs(dirs, report, roots) {
  for (const dir of dirs) {
    try {
      if (!roots.some((root) => within(root, dir))) {
        report.blocked.push({ path: dir, code: 'OUTSIDE_ROOT' })
        continue
      }
      const info = await lstat(dir)
      if (info.isSymbolicLink()) {
        // 只删链接本身，绝不跟进
        await unlink(dir)
        report.blocked.push({ path: dir, code: 'SYMLINK_UNLINKED' })
        continue
      }
      await rm(dir, { recursive: true, force: true })
    } catch (error) {
      if (error?.code === 'ENOENT') continue
      report.failed.push({ path: dir, code: error?.code ?? 'ERROR' })
    }
  }
}

/**
 * 审计日志：每次真正执行删除都追加一行 JSON。
 *
 * 删是不可逆的，至少要留下"什么时候、删了哪个 id、哪个范围、多少文件"的记录，
 * 用户能事后核对，也能在出事时定位。
 */
async function audit(entry) {
  try {
    await mkdir(join(home(), 'logs'), { recursive: true })
    const line = JSON.stringify({ at: new Date().toISOString(), ...entry })
    await appendFile(join(home(), 'logs', 'session-delete-audit.jsonl'), `${line}\n`, 'utf8')
  } catch {
    /* 审计写不了不阻断删除 */
  }
}

/** 从工作区索引里摘掉这个 id：会话顺序、置顶、归档三处。 */
async function detachIndex(ctx, id, report) {
  const registry = ctx.workspaceRegistry
  try {
    for (const workspace of registry.list()) {
      if (!(workspace.sessionIds ?? []).includes(id)) continue
      await workspace.detachSession(id)
      report.index.push(`列表 · ${workspace.title ?? workspace.path ?? workspace.id}`)
    }
  } catch (error) {
    report.failed.push({ path: 'workspace.json#sessionIds', code: error?.code ?? 'ERROR' })
  }
  try {
    if (registry.pinnedSessionIds?.includes(id)) {
      await registry.unpinSession(id)
      report.index.push('置顶')
    }
  } catch (error) {
    report.failed.push({ path: 'workspace.json#pinnedSessionIds', code: error?.code ?? 'ERROR' })
  }
  try {
    if (registry.archivedSessionIds?.includes(id)) {
      await registry.unarchiveSession(id)
      report.index.push('归档')
    }
  } catch (error) {
    report.failed.push({ path: 'workspace.json#archivedSessionIds', code: error?.code ?? 'ERROR' })
  }
}

/**
 * 执行删除。范围只影响"删到哪一层"，索引清理在任何范围里都做——
 * 否则侧栏会留下一个指向已删数据的行。
 */
async function perform(ctx, id, scope, mode) {
  const before = await scan(ctx, id, scope === 'deep')
  if (before.running) {
    return { ok: false, code: 'SESSION_RUNNING', scan: before }
  }
  if (!before.exists) {
    return { ok: false, code: 'SESSION_NOT_FOUND', scan: before }
  }

  const report = { files: 0, bytes: 0, index: [], failed: [], blocked: [] }
  const roots = allowedRoots(ctx)

  // 活会话先落一次盘，避免删完又被内存里的缓冲写回来。
  const live = ctx.sessions.get(id)
  if (live !== undefined) {
    try {
      await ctx.sessions.flush(live)
    } catch {
      /* 落盘失败也算继续：删的是磁盘上的东西 */
    }
  }

  await detachIndex(ctx, id, report)

  const files = []
  const dirs = await sessionDirs(ctx, id)
  for (const dir of dirs) files.push(...(await walkFiles(dir)))
  const cache = await projectionCacheFiles(id)
  files.push(...cache)
  if (scope !== 'records') files.push(...(await sidecarFiles(id)))
  if (scope === 'deep') {
    const digests = await attachmentDigests(ctx, id)
    const inUse = await digestsInUseElsewhere(ctx, digests, id)
    for (const digest of digests) {
      if (inUse.has(digest)) continue
      const paths = attachmentPaths(digest)
      for (const path of [paths.object, paths.fileObject]) {
        const info = await statSafe(path)
        if (info?.isFile()) files.push({ path, bytes: info.size })
      }
      files.push(...(await walkFiles(paths.filesDir, 2)))
    }
  }

  await removeFiles(files, mode, report, roots)
  await pruneDirs(dirs, report, roots)

  await audit({ sessionId: id, scope, mode, files: report.files, bytes: report.bytes, index: report.index, failed: report.failed.length, blocked: report.blocked.length })

  return {
    ok: true,
    removed: report,
    scope,
    mode,
    live: before.live
  }
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, no-store'
    }
  })
}

async function handle(ctx, request) {
  let body
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, code: 'BAD_REQUEST', message: '请求体不是 JSON' }, 400)
  }

  const id = typeof body?.sessionId === 'string' ? body.sessionId : ''
  if (!SAFE_ID.test(id) || id.includes('..')) {
    return json({ ok: false, code: 'BAD_SESSION_ID', message: '会话 id 不合法' }, 400)
  }

  const op = body?.op
  if (op === 'scan') {
    return json({ ok: true, scan: await scan(ctx, id, body?.deep === true) })
  }
  if (op === 'delete') {
    const scope = SCOPES.has(body?.scope) ? body.scope : undefined
    const mode = MODES.has(body?.mode) ? body.mode : undefined
    if (scope === undefined || mode === undefined) {
      return json({ ok: false, code: 'BAD_OPTIONS', message: '删除范围与擦除方式都必须选择' }, 400)
    }
    const result = await perform(ctx, id, scope, mode)
    return json(result, result.ok ? 200 : result.code === 'SESSION_RUNNING' ? 409 : 404)
  }
  return json({ ok: false, code: 'BAD_OP', message: '未知操作' }, 400)
}

export function apply(ctx) {
  ctx.effect(() => ctx.connection.fetch.register({
    path: ROUTE_PATH,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: (request) => handle(ctx, request)
  }), 'session-delete: exact Fetch route')

  // 一行挂载记录：排障时唯一能确认 Host 半边真的挂上了的证据。
  void note(`mounted ${new Date().toISOString()} home=${home()}`)
  void reportInventory(ctx)
}

/**
 * 排障快照：把「内存里活着的会话」「磁盘上持久化的会话」「工作区索引里的会话」
 * 三份清单各写一行。侧栏出现"已删除的会话"时，靠它判断是哪一份还在。
 */
async function reportInventory(ctx) {
  try {
    const live = (ctx.sessions.list?.() ?? []).map((session) => session.id)
    const persisted = []
    try {
      for (const record of await ctx.sessionPersistence.list()) {
        if (typeof record?.header?.id === 'string') persisted.push(record.header.id)
      }
    } catch {
      /* 盘点失败就不报 */
    }
    const indexed = []
    for (const workspace of ctx.workspaceRegistry.list()) {
      for (const id of workspace.sessionIds ?? []) indexed.push(id)
    }
    const ghostLive = live.filter((id) => !persisted.includes(id))
    const ghostIndex = indexed.filter((id) => !persisted.includes(id) && !live.includes(id))
    await note(`inventory live=${live.length} persisted=${persisted.length} indexed=${indexed.length}`)
    if (ghostLive.length > 0) await note(`  live-only: ${ghostLive.join(',')}`)
    if (ghostIndex.length > 0) await note(`  index-only: ${ghostIndex.join(',')}`)
  } catch {
    /* 只是诊断，失败不影响插件 */
  }
}

async function note(line) {
  try {
    await mkdir(join(home(), 'logs'), { recursive: true })
    await appendFile(join(home(), 'logs', 'session-delete.log'), `${line}\n`, 'utf8')
  } catch {
    /* 日志写不了不影响插件 */
  }
}

/** 只给自测脚本用的内部入口。 */
export const __internals = { scan, perform, attachmentPaths, home, SAFE_ID, within }
