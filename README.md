# dsh-session-delete

**给 [DeepSeek Harness](https://github.com/deepseek-ai) 加一个真正的「删除会话」。**

> DSH 只提供「归档」：给 `workspace.json` 的 `archivedSessionIds` 加一个 id，侧栏过滤掉，磁盘上一个字节没动。
> 这不是猜测，是官方文档明写的限制：
>
> - `dsh-session-persistence` — **No deletion or retention API**
> - `dsh-session-persistence-jsonl` — **Nothing deletes session files**
> - `dsh-client-ui-workspace` — **No Session deletion**
>
> 这个插件补上这一块，并且把「删干净」当成一等目标。

---

## Why

A DSH session is not one file. Removing only the log directory leaves the conversation body behind in a projection cache, a dangling row in the workspace index, per-plugin sidecar files, and every image attachment. This plugin enumerates all of those, shows the list to the user with sizes and reasons, and only then deletes — with three scopes and an optional overwrite-before-delete mode.

Local deletion cannot recall content already sent to a model provider. See [Known limits](#known-limits).

---

## 它删什么

一个会话在 DSH 里不是"一个文件"，是散在好几个地方的一堆东西。插件按落点逐层清理：

| 落点 | 位置 | 为什么必须处理 |
| --- | --- | --- |
| 会话记录 | `<DSH_HOME>/sessions/<工作区>/<id>/session.vN.jsonl.zstd` | **每一代都要删**。只删最新代，旧代会在下次读取时顶上来，会话"复活" |
| 投影缓存 | `<DSH_HOME>/storages/session_projcache/sessions/<id>.json[.bak.*]` | 含标题与**逐轮 prompt / response 原文**；列表读取走它时是零 IO 的，删不干净会留下正文 |
| 工作区索引 | `<DSH_HOME>/storages/workspace.json` | 会话顺序、置顶、归档三处 id；不清会留一个指向空数据的行 |
| 插件数据 | `<DSH_HOME>/storages/<任意插件域>/.../<id>.json` | 插件域是开放的（例如 `vision_router_session_policy/policies/<id>.json`），有限深度扫描，不硬编码名字 |
| 附件对象 | `<DSH_HOME>/attachments/v1/...` | 内容寻址、去重、**永不自动删除**。只有"彻底"档才动，且先读遍其他会话确认没人再引用 |

明确**不删**（对话框里也写着原因）：

- 工作区里由命令产生的文件——无法可靠归属到单个会话，不猜。
- 运行日志、会话日志导出——没有到会话的映射，删了会牵连别的会话。
- spill 溢出文件——在系统临时目录，按时间自清。

## 三档删除范围

| 档位 | 内容 |
| --- | --- |
| 仅对话记录 | 会话记录 + 投影缓存 + 工作区索引 |
| 记录 + 插件数据 | 再加各插件按会话存的数据 |
| 彻底（含附件） | 再删仅被本会话引用的附件对象 |

**工作区索引在任何档位都会清**，否则侧栏会留一个指向已删数据的行。

## 两种擦除方式

- **普通删除**：直接解除链接，快。数据块仍在，恢复工具可能捞回。
- **覆盖擦除**：先把文件内容写零并 `fsync` 再删。抬高恢复门槛；对 SSD 磨损均衡 / CoW 文件系统**不是物理保证**。

## 交互

会话行 `...` 菜单 → **删除会话**。弹窗先只读扫描一遍，把每一层"删什么、多大、哪些不删、为什么"列出来，然后三组必选、无默认值：

- 删除范围
- 擦除方式
- 我已知晓：删除后无法恢复

三项齐了，删除按钮才可点；缺哪项，按钮旁边直接写出来。

- 正在运行的会话会被拒绝删除（`AgentHandle` 的 disposer 只有创建者持有，插件无法安全 teardown 别人的 agent）。
- 删的是当前打开的会话时，完成后会重载页面；否则侧栏那一行**当场消失**，不刷新。

## 安全边界

删文件的插件必须先把边界说清楚。

**它保证了什么**

- **零第三方依赖**：宿主半边只用 `node:fs/promises`、`node:path`、`node:os`；没有 `fetch`/`http`/`net`，不取也不发任何网络数据。
- **没有安装脚本**：`package.json` 没有 `scripts` 字段，安装过程不执行任何代码。
- **唯一入口是 owner 路由**：一个精确 Fetch 路由 `/api/session-delete`，宿主在派发前强制校验调用者 principal 为 owner（由 DSH 连接层负责，不是插件自觉）。
- **三道路径闸**：待删路径必须①字符串上落在 `sessions/`、`storages/`、`attachments/` 三个根内；②不是符号链接或目录联接；③`realpath` 解析后仍落在根内——最后这条专门挡「路径写着在根内、物理上指向别处」。
- **不跟随联接**：会话目录本身是联接时视为不存在；目录内出现联接时既不采集也不递归删除。
- **会话 id 白名单**：`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$` 且拒绝 `..`。
- **审计留痕**：每次真正删除追加一行 `<DSH_HOME>/logs/session-delete-audit.jsonl`。
- **删之前必须先看清单**：扫描 → 三组必选 → 勾选确认。

**它保证不了什么**

- **装了就等于交出进程权限**。DSH 的 Host 插件在宿主进程内、沙箱之外运行（官方原文：installed Host code executes in-process outside the workspace sandbox）。这条对任何带 Host 半边的插件都一样，只能靠"作者可信 + 代码可读"。本插件的宿主代码 `lib/index.js` 约 650 行，零依赖，建议读一遍再装。
- **误删不可逆**。没有回收站；审计日志只能告诉你删了什么。
- **覆盖擦除在 SSD 上不是物理级不可逆**。

## 安装

任选一种。装完**重开 DSH**（客户端 boot 图谱在启动时组装）。

**A. 从本地目录安装（推荐，便于审计）**

在 Web 端 **设置 → 插件** 里选本地目录安装，或手动三处一起改：

```text
1. profile/node_modules/ 里放入本包（或建一个指向源码目录的联接）
2. profile/package.json:
   "dependencies": { "dsh-session-delete": "file:<绝对路径>/dsh-session-delete" }
   "dsh.profile.bundles": [ ..., "dsh-session-delete" ]
```

**B. 从 Git 安装并锁 commit**

```text
"dsh-session-delete": "github:<user>/dsh-session-delete#<commit-sha>"
```

**C. npm**

```bash
pnpm add dsh-session-delete
```

然后把 `dsh-session-delete` 追加进 `dsh.profile.bundles`。

> 不要改 profile 的 `cordis.patch.yml` 去插 `session-delete` 这一行——bundle 自带 patch，两边都写会重复插入同一个 id。

**卸载**：用 `plugin_manager` 的 `remove_bundle`；或手动清三处（`dependencies`、`bundles`、`node_modules` 里的包）。只删目录会留下解析不到的名字，下次启动报错。

**排障**：挂载成功会往 `<DSH_HOME>/logs/session-delete.log` 写一行 `mounted …`；每次删除记到 `session-delete-audit.jsonl`。

## 已知边界（Known limits）

- **删不掉已经上传出去的内容**。`dsh-session-log-deepseek` 默认开启，每次官方模型请求都会把会话日志增量作为 `dsh_session_log` 字段发给 DeepSeek（单次上限 8 MiB）。开关在 设置 → 通用 →「在使用官方模型 API 时上传 Session Log」。本地删除不能撤回服务端已经收到的请求体。
- 活会话的日志被删后，进程内的 session 仍在；再追加事件会重建一个没有文件头的残档——所以插件在删前 `flush`，并拒绝删除正在运行的会话。
- 覆盖擦除对 SSD 磨损均衡、NTFS 日志、CoW 文件系统只能尽力而为。
- 只处理"会话自身的数据"；不追踪、不删除工作区里由 shell 命令产生的文件。

## 自测

零依赖，不需要 `npm install`：

```bash
node test/selftest.mjs     # Host：临时 DSH_HOME 夹具，断言逐层盘点/删除、路径闸门、联接防护、审计
node test/client-test.mjs  # Client：假 React 加载真 bundle，断言槽位、菜单项、三项门控、store 摘行
```

CI 在 Node 20/22/24 × Ubuntu/Windows 上跑这两个脚本（见 `.github/workflows/ci.yml`）。

## 兼容性

- 针对 DSH `0.2.1-rc.x` 的存储布局；会话格式升级到 v5 时，日志文件名规则需要复核。
- 依赖的运行期接口：`ctx.sessionPersistence`、`ctx.workspaceRegistry`、`ctx.sessions`、`ctx.connection.fetch`、客户端 `slots` / `locale` / `sessions`。

## 许可

[MIT](LICENSE)
