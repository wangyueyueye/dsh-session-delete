/**
 * 客户端半边自测：用假 React / 假 primitives 加载真实的 client.js bundle，
 * 断言槽位注册、菜单项行为、对话框的三项必选门控。
 *
 *   node test/client-test.mjs
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

/* ---------- 假 React ---------- */
const FakeReact = {
  createElement(type, props, ...children) {
    const flat = children.length === 0 ? undefined : children.length === 1 ? children[0] : children
    return { type, props: { ...(props ?? {}), ...(flat === undefined ? {} : { children: flat }) }, children: flat }
  },
  useState(initial) {
    return [typeof initial === 'function' ? initial() : initial, () => {}]
  },
  useEffect(effect) {
    effect()
  }
}

/* ---------- 假 primitives ---------- */
const primitives = {
  Modal: function Modal() {},
  Button: function Button() {},
  MenuItemButton: function MenuItemButton() {},
  IconTrashOutlineRegular: function IconTrashOutlineRegular() {}
}

/* ---------- 假 document / fetch ---------- */
const appended = []
globalThis.document = {
  getElementById: () => null,
  createElement: () => ({ id: '', textContent: '' }),
  head: { appendChild: (node) => appended.push(node) }
}

const scanPayload = {
  ok: true,
  scan: {
    sessionId: 'session-abc',
    live: false,
    running: false,
    exists: true,
    groups: [
      { key: 'records', label: '会话记录', bytes: 1835008, count: 1, note: '含全部历史格式代', paths: [] },
      { key: 'cache', label: '投影缓存', bytes: 12000, count: 2, note: '含标题与逐轮摘要原文', paths: [] },
      { key: 'sidecars', label: '插件数据', bytes: 0, count: 0, note: '无', paths: [] },
      { key: 'index', label: '工作区索引', bytes: 0, count: 2, note: '会话列表 / 置顶', paths: [] },
      { key: 'attachments', label: '附件对象', bytes: 0, count: 6, note: '共 6 个，彻底档才核对是否仍被引用', paths: [] }
    ],
    skipped: [{ label: '工作区里产出的文件', reason: '无法归属' }]
  }
}

globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body)
  if (body.op === 'delete') {
    return {
      ok: true,
      json: async () => ({ ok: true, removed: { files: 5, bytes: 1847008, index: ['列表 · ws'], failed: [] }, live: false })
    }
  }
  return { ok: true, json: async () => scanPayload }
}

/* ---------- 加载 bundle ---------- */
let factory
globalThis.window = {
  __ModuleLoader__: {
    load: (entry) => {
      factory = entry.factory
    }
  }
}
new Function(source)()
assert.equal(typeof factory, 'function', 'bundle 必须注册到 __ModuleLoader__')

const exports = factory((specifier) => {
  if (specifier === 'react') return FakeReact
  if (specifier === '@deepseek-ai/dsh-client-ui-primitives') return primitives
  throw new Error(`unexpected require: ${specifier}`)
})

assert.deepEqual(exports.inject, ['slots', 'locale'])

/* ---------- 假 ctx，收集槽位注册 ---------- */
const registrations = []
let dictionaries = {}
const ctx = {
  effect: (fn) => fn(),
  locale: {
    register: (ns, dicts) => {
      dictionaries = dicts
      return { ns, dicts }
    }
  },
  slots: {
    inject: (name, factoryFn) => factoryFn(),
    register: (options, component) => {
      registrations.push({ options, component })
      return () => {}
    }
  }
}
exports.apply(ctx)

assert.equal(registrations.length, 2, '菜单项 + 对话框两个槽位')
const menu = registrations.find((item) => item.options.name === 'sidebar.workspaces.session.menu.item')
const overlay = registrations.find((item) => item.options.name === 'shell.overlay')
assert.ok(menu && overlay)
assert.equal(menu.options.order, 410, '排在归档 400 之后、复制 id 450 之前')

/* ---------- 菜单项：点了要能打开并要求扫描 ---------- */
const opened = []
const menuProps = {
  sessionId: 'session-abc',
  displayTitle: '测试会话',
  useMenuOpenState: () => [true, (value) => opened.push(value)],
  ...menu.options.inject(),
  t: (key) => key
}
const menuNode = menu.component(menuProps)
assert.equal(menuNode.type, primitives.MenuItemButton)
assert.ok(menuNode.props.icon, '要有图标')
menuNode.props.onSelect()
assert.deepEqual(opened, [false], '点完菜单要关')
await new Promise((resolve) => setTimeout(resolve, 0))

const request = exports.__debug.store.request
assert.equal(request.phase, 'ready', '扫描完成后进入可选状态')
assert.equal(request.scope, null)
assert.equal(request.mode, null)
assert.equal(request.ack, false)
assert.equal(request.scan.groups.length, 5)

/* ---------- 对话框：三项没选前按钮必须点不了 ---------- */
const dict = dictionaries.zh
const t = (key) => dict[key] ?? key
const render = () => overlay.component({ t })

const PRIMITIVE_TYPES = new Set(Object.values(primitives))

function expand(node) {
  if (node === null || node === undefined || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map(expand)
  if (typeof node.type === 'function' && !PRIMITIVE_TYPES.has(node.type)) return expand(node.type(node.props))
  return node
}

function parts(node) {
  const tree = expand(node)
  if (tree === null || tree === undefined || typeof tree !== 'object' || Array.isArray(tree)) return [tree]
  return [tree.props?.children ?? tree.children, tree.props?.footer]
}

function findDangerButton(node) {
  const tree = expand(node)
  if (tree === null || tree === undefined || typeof tree !== 'object') return undefined
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const hit = findDangerButton(child)
      if (hit !== undefined) return hit
    }
    return undefined
  }
  if (tree.props?.className === 'dsd-danger') return tree
  for (const part of parts(tree)) {
    const hit = findDangerButton(part)
    if (hit !== undefined) return hit
  }
  return undefined
}

function countClass(node, className, total = 0) {
  const tree = expand(node)
  if (tree === null || tree === undefined || typeof tree !== 'object') return total
  if (Array.isArray(tree)) {
    for (const child of tree) total = countClass(child, className, total)
    return total
  }
  if (tree.props?.className === className) total += 1
  for (const part of parts(tree)) total = countClass(part, className, total)
  return total
}

function collectText(node, out = []) {  const tree = expand(node)
  if (tree === null || tree === undefined) return out
  if (typeof tree === 'string' || typeof tree === 'number') {
    out.push(String(tree))
    return out
  }
  if (Array.isArray(tree)) {
    for (const child of tree) collectText(child, out)
    return out
  }
  for (const part of parts(tree)) collectText(part, out)
  return out
}

const first = render()
const firstText = collectText(first).join(' ')
assert.ok(firstText.includes('删除范围'), '要有删除范围一栏')
assert.ok(firstText.includes('擦除方式'), '要有擦除方式一栏')
assert.ok(firstText.includes('1.75 MB'), '体积要格式化：' + firstText)
assert.ok(firstText.includes('还差：范围'), '缺项要直接提示：' + firstText)
assert.ok(firstText.includes('工作区里的文件'), '不清理的内容要说明')
assert.equal(countClass(first, 'dsd-scope'), 3, '三个范围横排卡片')
assert.equal(countClass(first, 'dsd-ack'), 1, '确认勾选在底部操作栏')
assert.equal(countClass(first, 'dsd-lines'), 3, '每张范围卡都要有明细')
assert.ok(firstText.includes('对话日志'), '卡片要写清删的是什么')
assert.ok(firstText.includes('只属于它的附件'), '第三档要写清附件')
assert.ok(!firstText.includes('以上全部'), '不许用「以上全部」这种糊弄写法')
assert.ok(!firstText.includes('附件不动'), '不许用「留…」这种反向写法')
assert.ok(firstText.includes('普通删除只是把文件'), '两种擦除方式要先有一句人话解释')

const firstModal = expand(first)
assert.ok(firstModal.props.footer, '底部操作栏必须通过 Modal footer 固定，不能随内容滚走')
assert.equal(firstModal.props.className, 'dsd-modal', '要靠 className 覆盖官方 Modal 的固定宽度')

let danger = findDangerButton(first)
assert.ok(danger, '要有删除按钮')
assert.equal(danger.props.disabled, true, '没选选项时按钮必须禁用')

/* 只选一个仍禁用 */
exports.__debug.publish({ ...request, scope: 'standard' })
danger = findDangerButton(render())
assert.equal(danger.props.disabled, true, '只选范围还不够')

exports.__debug.publish({ ...exports.__debug.store.request, mode: 'normal' })
danger = findDangerButton(render())
assert.equal(danger.props.disabled, true, '还差确认勾选')

exports.__debug.publish({ ...exports.__debug.store.request, ack: true })
danger = findDangerButton(render())
assert.equal(danger.props.disabled, false, '三项齐了才可点')

/* 点下去：发 delete，进入完成态 */
danger.props.onClick()
await new Promise((resolve) => setTimeout(resolve, 0))
assert.equal(exports.__debug.store.request.phase, 'done')
assert.equal(exports.__debug.store.request.result.removed.files, 5)
const doneText = collectText(render()).join(' ')
assert.ok(doneText.includes('5'), '完成页要报删除文件数')

/* 完成：就地摘掉 store 里那一行，不许重载页面 */
const sessionStore = {
  state: {
    ids: ['session-xxx', 'session-abc'],
    byId: { 'session-xxx': { id: 'session-xxx' }, 'session-abc': { id: 'session-abc' } },
    phase: 'ready'
  },
  getSnapshot() {
    return this.state
  },
  set(next) {
    this.state = next
  }
}
ctx.get = (name) => (name === 'sessions' ? { list: sessionStore } : undefined)

let reloads = 0
globalThis.location = {
  reload() {
    reloads += 1
  }
}

assert.equal(exports.__debug.dropSessionRow('session-abc'), true, 'store 存在时要就地摘掉')
assert.equal(sessionStore.state.byId['session-abc'], undefined, '摘要必须从 byId 里消失')
assert.deepEqual(sessionStore.state.ids, ['session-xxx'], 'ids 里也要去掉')
assert.equal(sessionStore.state.byId['session-xxx'] !== undefined, true, '别的会话不受影响')

exports.__debug.finish({ sessionId: 'session-abc', result: { live: false } })
assert.equal(reloads, 0, '非活会话不该重载页面')
assert.equal(exports.__debug.store.request, null, '关掉对话框')

/* 摘不掉时回退整页刷新 */
exports.__debug.finish({ sessionId: 'session-abc', result: { live: true } })
assert.equal(reloads, 1, '活会话必须重载')

console.log('client-test ok:', {
  text: firstText.slice(0, 90).replace(/\s+/g, ' ')
})
