window.__ModuleLoader__.load({
  id: "dsh-session-delete",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    const React = require("react");
    const primitives = require("@deepseek-ai/dsh-client-ui-primitives");

    const h = React.createElement;
    const NS = "dsh-session-delete";

    /* ------------------------------------------------------------------ */
    /* 文案                                                                */
    /* ------------------------------------------------------------------ */

    const zh = {
      action: "删除会话",
      title: "删除会话",
      cancel: "取消",
      close: "关闭",
      confirm: "删除会话",
      done: "完成",
      scanning: "正在扫描这个会话留下的全部痕迹…",
      deleting: "正在删除…",
      retry: "重试",
      manifest: "清理清单",
      lead: "这个会话在本机的记录、缓存和索引会一起清理，删完没法撤回。",
      still: "工作区里的文件、运行日志、临时溢出文件都不动",
      scope: "删除范围",
      mode: "擦除方式",
      ack: "我已知晓：删除后无法恢复",
      skipped: "不在范围",
      scopeRecords: "仅对话记录",
      scopeRecordsHint:
        "删掉这个会话的对话日志（含全部历史格式代）、摘要缓存（标题和每轮摘要）、侧栏里的列表 / 置顶 / 归档记录。附件和插件数据不动。",
      scopeStandard: "记录 + 插件数据",
      scopeStandardHint:
        "删掉这个会话的对话日志、摘要缓存、侧栏记录，以及各插件为它单独存的数据，比如识图插件按会话记的策略文件。附件不动。",
      scopeDeep: "彻底（含附件）",
      scopeDeepHint:
        "删掉这个会话的对话日志、摘要缓存、侧栏记录、插件会话数据，以及只属于它的附件文件；别处也在用的图片会保留。",
      markDel: "删",
      lineLogs: "对话日志",
      lineCache: "摘要缓存",
      lineSidebar: "侧栏记录",
      linePlugin: "插件会话数据",
      lineAttach: "只属于它的附件",
      modeNormal: "普通删除",
      modeShred: "覆盖擦除",
      modeDefaultHint: "普通删除只是把文件从目录里抹掉；覆盖擦除会先把内容清零再删。",
      modeNormalHint:
        "直接把文件从磁盘删掉，快。删完以后，普通的文件恢复工具仍可能把内容捞回来。",
      modeShredHint:
        "先把文件内容整个写成 0 并落盘，再删除。恢复工具基本捞不回来；代价是每个文件要多写一遍，大文件明显变慢，SSD 上也不能保证物理彻底。",
      needScope: "还需选择删除范围",
      needMode: "还需选择擦除方式",
      needAck: "还需勾选确认",
      hint: "还差：",
      needScopeShort: "范围",
      needModeShort: "方式",
      needAckShort: "确认",
      ready: "可以删除",
      running: "这个会话正在运行，先停止再删。",
      failed: "删除失败",
      resultTitle: "已删除",
      resultFiles: "删除文件",
      resultBytes: "释放空间",
      resultIndex: "索引已清理",
      resultFailed: "未能删除",
      resultBlocked: "已拦下",
      resultBlockedNote: "安全闸门拒绝删除（不在允许目录 / 是链接）",
      resultLive: "这个会话正开着。点“完成”会把你切到别的会话，并把它从侧栏摘掉；如果那行还在，重开 DSH 就会彻底消失。",
      notFound: "没有找到这个会话的任何落点。",
      empty: "无"
    };

    const en = {
      action: "Delete session",
      title: "Delete session",
      cancel: "Cancel",
      close: "Close",
      confirm: "Delete session",
      done: "Done",
      scanning: "Scanning everything this session left behind…",
      deleting: "Deleting…",
      retry: "Retry",
      manifest: "What will be removed",
      lead: "This session's logs, cache and index are cleared from this machine. It cannot be undone.",
      still: "Workspace files, run logs and temp spill files stay",
      scope: "Scope",
      mode: "Erase mode",
      ack: "I understand this cannot be undone",
      skipped: "Out of scope",
      scopeRecords: "Records only",
      scopeRecordsHint:
        "Removes this session's conversation log (every historical format generation), its summary cache (title and per-turn digest), and its sidebar entry in list / pin / archive. Attachments and plugin data stay.",
      scopeStandard: "Records + plugin data",
      scopeStandardHint:
        "Removes this session's conversation log, summary cache, sidebar entry, plus whatever each plugin stored for it alone, such as an image plugin's per-session policy file. Attachments stay.",
      scopeDeep: "Everything",
      scopeDeepHint:
        "Removes this session's conversation log, summary cache, sidebar entry, plugin session data, and the attachment files only it uses; images shared elsewhere stay.",
      markDel: "Del",
      lineLogs: "Conversation log",
      lineCache: "Summary cache",
      lineSidebar: "Sidebar entry",
      linePlugin: "Per-session plugin data",
      lineAttach: "Attachments only it uses",
      modeNormal: "Normal delete",
      modeShred: "Overwrite then delete",
      modeDefaultHint: "Normal delete just unlinks the files; overwrite zeroes their content first.",
      modeNormalHint:
        "Removes the files from disk right away, fast. Afterwards an ordinary recovery tool may still pull the content back.",
      modeShredHint:
        "Writes zeros over the whole file, flushes, then deletes. Recovery tools get little back; the cost is rewriting every file, so large logs take longer, and SSDs still give no physical guarantee.",
      needScope: "Pick a scope",
      needMode: "Pick an erase mode",
      needAck: "Tick the confirmation",
      hint: "Missing: ",
      needScopeShort: "scope",
      needModeShort: "mode",
      needAckShort: "confirm",
      ready: "Ready",
      running: "This session is running. Stop it first.",
      failed: "Delete failed",
      resultTitle: "Deleted",
      resultFiles: "Files removed",
      resultBytes: "Space freed",
      resultIndex: "Index cleaned",
      resultFailed: "Could not remove",
      resultBlocked: "Blocked",
      resultBlockedNote: "Refused by the safety gate (outside allowed roots / a link)",
      resultLive: "This session is still open. “Done” switches you to another session and removes the row; if it lingers, restart DSH.",
      notFound: "Nothing on disk belongs to this session.",
      empty: "None"
    };

    /* ------------------------------------------------------------------ */
    /* 样式：沿用 设置 → 插件 那套 token                                   */
    /* ------------------------------------------------------------------ */

    const CSS = `
.dsd-wrap{display:flex;flex-direction:column;gap:10px;min-width:0;max-height:min(62vh,520px);overflow-y:auto;padding-right:2px}
.dsd-sub{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);word-break:break-all;margin-top:-2px}
.dsd-lead{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.dsd-card{background:var(--dsw-alias-settings-card-fill);border:1px solid var(--dsw-alias-settings-card-stroke);border-radius:10px;overflow:hidden}
.dsd-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px}
.dsd-row+.dsd-row{border-top:1px solid var(--dsw-alias-border-l2)}
.dsd-row-label{font-size:12.5px;line-height:18px;color:var(--dsw-alias-label-primary);white-space:nowrap}
.dsd-row-value{font-size:12.5px;line-height:18px;color:var(--dsw-alias-label-secondary);text-align:right;font-variant-numeric:tabular-nums;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsd-row-value.dsd-good{color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary))}
.dsd-row-value.dsd-warn{color:var(--dsw-alias-state-warn-primary)}
.dsd-row-value.dsd-muted{color:var(--dsw-alias-label-tertiary)}
.dsd-still{padding:7px 12px;font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-tertiary);border-top:1px solid var(--dsw-alias-border-l2);background:transparent}
.dsd-still b{font-weight:500;color:var(--dsw-alias-label-secondary)}
.dsd-section{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);margin-bottom:-2px}
.dsd-mode-desc{border-left:2px solid var(--dsw-alias-border-l2);padding-left:8px;margin-top:-2px}
.dsd-scopes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.dsd-scope{display:flex;flex-direction:column;gap:4px;min-width:0;padding:10px 11px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);background:transparent;cursor:pointer;text-align:left;font:inherit;color:inherit}
.dsd-scope:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsd-scope[data-on="1"]{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-interactive-bg-hover-accent)}
.dsd-scope-head{display:flex;align-items:center;gap:6px;min-width:0}
.dsd-dot{flex:none;width:12px;height:12px;border-radius:50%;border:1.5px solid var(--dsw-alias-border-l3);display:flex;align-items:center;justify-content:center}
.dsd-scope[data-on="1"] .dsd-dot{border-color:var(--dsw-alias-brand-primary)}
.dsd-scope[data-on="1"] .dsd-dot::after{content:"";width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-brand-primary)}
.dsd-scope-title{font-size:12.5px;line-height:18px;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsd-lines{display:flex;flex-direction:column;gap:2px;padding-left:18px;margin-top:1px}
.dsd-line{display:flex;gap:4px;font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary);min-width:0}
.dsd-line b{flex:none;font-weight:400;color:var(--dsw-alias-label-secondary)}
.dsd-line span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsd-modes{display:flex;gap:6px}
.dsd-mode{flex:1;height:30px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:transparent;cursor:pointer;font:inherit;font-size:12px;color:var(--dsw-alias-label-secondary)}
.dsd-mode:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsd-mode[data-on="1"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover-accent)}
.dsd-note{font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-tertiary)}
.dsd-foot{display:flex;flex-direction:column;gap:8px;width:100%;min-width:0}
.dsd-foot-row{display:flex;align-items:center;gap:8px;width:100%;min-width:0}
.dsd-ack{display:flex;align-items:center;gap:7px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);cursor:pointer;user-select:none;min-width:0}
.dsd-ack span.dsd-ack-text{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsd-box{flex:none;width:15px;height:15px;border-radius:4px;border:1.5px solid var(--dsw-alias-border-l3);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;line-height:1}
.dsd-ack input{position:absolute;opacity:0;pointer-events:none;width:0;height:0}
.dsd-ack[data-on="1"] .dsd-box{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}
.dsd-spacer{flex:1;min-width:8px}
.dsd-hint{font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.dsd-danger{height:30px;padding:0 14px;border-radius:8px;border:none;cursor:pointer;font:inherit;font-size:12.5px;color:#fff;background:var(--dsw-alias-state-error-primary);white-space:nowrap}
.dsd-danger:hover:not(:disabled){filter:brightness(1.08)}
.dsd-danger:disabled{cursor:not-allowed;opacity:.4}
.dsd-error{font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary);white-space:pre-wrap;word-break:break-word}
.dsd-modal.dsd-modal{width:min(92vw,760px);max-width:min(92vw,760px)}
.dsd-spin{color:var(--dsw-alias-label-tertiary);font-size:12.5px;line-height:20px;padding:4px 0}
`;

    function ensureStyle() {
      if (typeof document === "undefined") return;
      if (document.getElementById("dsh-session-delete-style") !== null) return;
      const style = document.createElement("style");
      style.id = "dsh-session-delete-style";
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    /* ------------------------------------------------------------------ */
    /* 极简 store：菜单项打开请求，overlay 里的对话框订阅它                 */
    /* ------------------------------------------------------------------ */

    const store = { request: null, listeners: new Set() };

    function publish(next) {
      store.request = next;
      for (const listener of [...store.listeners]) listener();
    }

    function useRequest() {
      const [, force] = React.useState(0);
      React.useEffect(() => {
        const listener = () => force((value) => value + 1);
        store.listeners.add(listener);
        return () => store.listeners.delete(listener);
      }, []);
      return store.request;
    }

    /* ------------------------------------------------------------------ */
    /* Host 调用                                                            */
    /* ------------------------------------------------------------------ */

    async function callHost(payload) {
      const response = await fetch("/api/session-delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      let body;
      try {
        body = await response.json();
      } catch {
        throw new Error("Host 返回了无法解析的响应");
      }
      if (body?.ok === false) return body;
      if (!response.ok) throw new Error(body?.message ?? `HTTP ${response.status}`);
      return body;
    }

    /* ------------------------------------------------------------------ */
    /* 格式化                                                              */
    /* ------------------------------------------------------------------ */

    function bytesText(bytes) {
      if (!bytes) return "0 B";
      if (bytes < 1024) return `${bytes} B`;
      const kb = bytes / 1024;
      if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
      const mb = kb / 1024;
      return `${mb.toFixed(mb < 10 ? 2 : 1)} MB`;
    }

    /* ------------------------------------------------------------------ */
    /* 对话框                                                              */
    /* ------------------------------------------------------------------ */

    function dialogState(sessionId, title) {
      publish({ sessionId, title, phase: "loading" });
      callHost({ op: "scan", sessionId, deep: false })
        .then((result) => {
          if (store.request?.sessionId !== sessionId) return;
          publish({
            sessionId,
            title,
            phase: "ready",
            scan: result.scan,
            scope: null,
            mode: null,
            ack: false
          });
        })
        .catch((error) => {
          publish({ sessionId, title, phase: "error", message: String(error?.message ?? error) });
        });
    }

    function closeDialog() {
      publish(null);
    }

    function Row({ label, value, tone }) {
      return h(
        "div",
        { className: "dsd-row" },
        h("div", { className: "dsd-row-label" }, label),
        h("div", { className: `dsd-row-value${tone ? ` dsd-${tone}` : ""}` }, value)
      );
    }

    function Option({ on, title, lines, hint, onPick }) {
      return h(
        "button",
        { type: "button", className: "dsd-scope", "data-on": on ? "1" : "0", onClick: onPick, title: hint },
        h(
          "span",
          { className: "dsd-scope-head" },
          h("span", { className: "dsd-dot" }),
          h("span", { className: "dsd-scope-title" }, title)
        ),
        h(
          "span",
          { className: "dsd-lines" },
          (lines ?? []).map((line, index) =>
            h("span", { key: index, className: "dsd-line" }, h("b", null, line[0]), h("span", null, line[1]))
          )
        )
      );
    }

    function Manifest({ scan, t }) {
      const groups = scan.groups ?? [];
      const valueFor = (group) => {
        if (group.key === "index") return group.count > 0 ? `1 处 · ${group.note}` : t("empty");
        if (group.key === "attachments") {
          if (group.count === 0) return t("empty");
          return group.bytes > 0 ? `${group.count} 个 · ${bytesText(group.bytes)}` : `${group.count} 个`;
        }
        if (group.count === 0) return t("empty");
        return `${group.count} 项 · ${bytesText(group.bytes)}`;
      };
      const toneFor = (group) => {
        if (group.key === "index" || group.key === "attachments") return group.count > 0 ? "muted" : "muted";
        return group.bytes > 0 ? "good" : "muted";
      };
      const skipped = scan.skipped ?? [];
      return h(
        "div",
        null,
        h(
          "div",
          { className: "dsd-card" },
          groups.map((group) => h(Row, { key: group.key, label: group.label, value: valueFor(group), tone: toneFor(group) })),
          h("div", { className: "dsd-still" }, t("still"))
        )
      );
    }

    function DeleteDialog({ t }) {
      const request = useRequest();
      if (request === null) return null;

      const close = () => {
        if (request.phase === "working") return;
        closeDialog();
      };

      const body = [];
      let footer = null;
      if (request.phase === "loading") {
        body.push(h("div", { key: "l", className: "dsd-spin" }, t("scanning")));
        footer = h(
          "div",
          { className: "dsd-foot" },
          h("span", { className: "dsd-spacer" }),
          h(primitives.Button, { variant: "outline", onClick: close }, t("cancel"))
        );
      } else if (request.phase === "error") {
        const text = request.code === "SESSION_RUNNING"
          ? t("running")
          : request.code === "SESSION_NOT_FOUND"
            ? t("notFound")
            : request.message ?? t("failed");
        body.push(h("div", { key: "e", className: "dsd-error" }, text));
        footer = h(
          "div",
          { className: "dsd-foot" },
          h("span", { className: "dsd-spacer" }),
          h(primitives.Button, { variant: "outline", onClick: close }, t("cancel")),
          h(
            primitives.Button,
            { variant: "primary", onClick: () => dialogState(request.sessionId, request.title) },
            t("retry")
          )
        );
      } else if (request.phase === "working") {
        body.push(h("div", { key: "w", className: "dsd-spin" }, t("deleting")));
      } else if (request.phase === "done") {
        const removed = request.result.removed ?? { files: 0, bytes: 0, index: [], failed: [] };
        body.push(
          h(
            "div",
            { key: "d", className: "dsd-card" },
            h(Row, { label: t("resultFiles"), value: String(removed.files), tone: "good" }),
            h(Row, { label: t("resultBytes"), value: bytesText(removed.bytes), tone: "good" }),
            h(Row, {
              label: t("resultIndex"),
              value: removed.index.length > 0 ? removed.index.join(" / ") : t("empty"),
              tone: removed.index.length > 0 ? "good" : "muted"
            }),
            removed.failed.length > 0
              ? h(Row, { label: t("resultFailed"), value: `${removed.failed.length} 项`, tone: "warn" })
              : null,
            (removed.blocked?.length ?? 0) > 0
              ? h(Row, { label: t("resultBlocked"), value: `${removed.blocked.length} 项`, tone: "warn" })
              : null
          )
        );
        if (request.result.live) body.push(h("div", { key: "n", className: "dsd-note" }, t("resultLive")));
        if ((removed.blocked?.length ?? 0) > 0) {
          body.push(
            h(
              "div",
              { key: "b", className: "dsd-note" },
              `${t("resultBlockedNote")}：${removed.blocked
                .slice(0, 3)
                .map((item) => item.code)
                .join(" / ")}`
            )
          );
        }
        if (removed.failed.length > 0) {
          body.push(
            h(
              "div",
              { key: "f", className: "dsd-error" },
              removed.failed.slice(0, 6).map((item) => `${item.code} · ${item.path}`).join("\n")
            )
          );
        }
        footer = h(
          "div",
          { className: "dsd-foot" },
          h("span", { className: "dsd-spacer" }),
          h(
            primitives.Button,
            { variant: "primary", onClick: () => finish(request) },
            t("done")
          )
        );
      } else {
        const scan = request.scan ?? { groups: [], skipped: [] };
        const ready = request.scope !== null && request.mode !== null && request.ack === true;
        const missing = [];
        if (request.scope === null) missing.push(t("needScopeShort"));
        if (request.mode === null) missing.push(t("needModeShort"));
        if (!request.ack) missing.push(t("needAckShort"));

        body.push(h("div", { key: "s", className: "dsd-sub" }, `「${request.title || request.sessionId}」`));
        body.push(h("div", { key: "lead", className: "dsd-lead" }, t("lead")));
        if (scan.running) body.push(h("div", { key: "run", className: "dsd-error" }, t("running")));

        body.push(h("div", { key: "mh", className: "dsd-section" }, t("manifest")));
        body.push(h(Manifest, { key: "m", scan, t }));

        body.push(h("div", { key: "sh", className: "dsd-section" }, t("scope")));
        body.push(
          h(
            "div",
            { key: "so", className: "dsd-scopes" },
            h(Option, {
              on: request.scope === "records",
              title: t("scopeRecords"),
              hint: t("scopeRecordsHint"),
              lines: [
                [t("markDel"), t("lineLogs")],
                [t("markDel"), t("lineCache")],
                [t("markDel"), t("lineSidebar")]
              ],
              onPick: () => publish({ ...request, scope: "records" })
            }),
            h(Option, {
              on: request.scope === "standard",
              title: t("scopeStandard"),
              hint: t("scopeStandardHint"),
              lines: [
                [t("markDel"), t("lineLogs")],
                [t("markDel"), t("lineCache")],
                [t("markDel"), t("lineSidebar")],
                [t("markDel"), t("linePlugin")]
              ],
              onPick: () => publish({ ...request, scope: "standard" })
            }),
            h(Option, {
              on: request.scope === "deep",
              title: t("scopeDeep"),
              hint: t("scopeDeepHint"),
              lines: [
                [t("markDel"), t("lineLogs")],
                [t("markDel"), t("lineCache")],
                [t("markDel"), t("lineSidebar")],
                [t("markDel"), t("linePlugin")],
                [t("markDel"), t("lineAttach")]
              ],
              onPick: () => publish({ ...request, scope: "deep" })
            })
          )
        );

        body.push(h("div", { key: "mh2", className: "dsd-section" }, t("mode")));
        body.push(
          h(
            "div",
            { key: "mo", className: "dsd-modes" },
            h(
              "button",
              {
                type: "button",
                className: "dsd-mode",
                "data-on": request.mode === "normal" ? "1" : "0",
                title: t("modeNormalHint"),
                onClick: () => publish({ ...request, mode: "normal" })
              },
              t("modeNormal")
            ),
            h(
              "button",
              {
                type: "button",
                className: "dsd-mode",
                "data-on": request.mode === "shred" ? "1" : "0",
                title: t("modeShredHint"),
                onClick: () => publish({ ...request, mode: "shred" })
              },
              t("modeShred")
            )
          )
        );
        body.push(
          h(
            "div",
            { key: "sn", className: "dsd-note dsd-mode-desc" },
            request.mode === "normal"
              ? t("modeNormalHint")
              : request.mode === "shred"
                ? t("modeShredHint")
                : t("modeDefaultHint")
          )
        );

        footer = h(
          "div",
          { className: "dsd-foot" },
          h(
            "div",
            { className: "dsd-foot-row" },
            h(
              "label",
              {
                className: "dsd-ack",
                "data-on": request.ack ? "1" : "0",
                onClick: (event) => {
                  event.preventDefault();
                  publish({ ...request, ack: !request.ack });
                }
              },
              h("input", { type: "checkbox", checked: request.ack, readOnly: true, tabIndex: -1 }),
              h("span", { className: "dsd-box" }, request.ack ? "✓" : ""),
              h("span", { className: "dsd-ack-text" }, t("ack"))
            ),
            h("span", { className: "dsd-spacer" }),
            request.ack
              ? null
              : h("span", { className: "dsd-hint" }, `${t("hint")}${missing.join(" / ")}`)
          ),
          h(
            "div",
            { className: "dsd-foot-row" },
            h("span", { className: "dsd-spacer" }),
            h(primitives.Button, { variant: "outline", onClick: close }, t("cancel")),
            h(
              "button",
              {
                type: "button",
                className: "dsd-danger",
                disabled: !ready || scan.running === true,
                onClick: () => runDelete(request)
              },
              t("confirm")
            )
          )
        );
      }

      return h(
        primitives.Modal,
        {
          open: true,
          onClose: close,
          closeLabel: t("close"),
          title: t("title"),
          className: "dsd-modal",
          footer,
          children: h("div", { className: "dsd-wrap" }, body.filter(Boolean))
        }
      );
    }

    function runDelete(request) {
      publish({ ...request, phase: "working" });
      callHost({ op: "delete", sessionId: request.sessionId, scope: request.scope, mode: request.mode })
        .then((result) => {
          reportDebug({
            step: "delete",
            sessionId: request.sessionId,
            ok: result?.ok,
            code: result?.code ?? null,
            files: result?.removed?.files ?? null,
            blocked: result?.removed?.blocked?.length ?? null,
            live: result?.live ?? null
          });
          if (result?.ok === false) {
            publish({ ...request, phase: "error", code: result.code, message: result.message });
            return;
          }
          publish({ ...request, phase: "done", result });
        })
        .catch((error) => {
          reportDebug({ step: "delete-error", message: String(error?.message ?? error) });
          publish({ ...request, phase: "error", message: String(error?.message ?? error) });
        });
    }

    /**
     * 从客户端会话 store 里就地摘掉这一行。
     *
     * 宿主只有"新增 / 更新"摘要的通道，没有"已经没了"的信号；把工作区归属摘掉之后，
     * 客户端内存里那条旧摘要会从分组里掉出来、挂进「未分组」，看起来像没删干净。
     * 所以这里直接把摘要从 store 里删掉——不重载页面，那一行当场消失。
     * @returns 是否成功（失败时调用方回退到整页刷新）
     */
    function dropSessionRow(sessionId) {
      try {
        const service = clientContext?.sessions ?? clientContext?.get?.("sessions");
        const store = service?.list;
        if (store === undefined || typeof store.getSnapshot !== "function" || typeof store.set !== "function") {
          return false;
        }
        const state = store.getSnapshot();
        if (state === undefined || state === null || typeof state.byId !== "object") return false;
        if (state.byId[sessionId] === undefined) return true;
        const byId = { ...state.byId };
        delete byId[sessionId];
        const ids = Array.isArray(state.ids) ? state.ids.filter((id) => id !== sessionId) : state.ids;
        store.set({ ...state, ids, byId });
        return true;
      } catch {
        return false;
      }
    }

    /** 把客户端这一侧发生的事写进宿主日志，排障用。 */
    function reportDebug(data) {
      try {
        void fetch("/api/session-delete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ op: "debug", data })
        }).catch(() => {});
      } catch {
        /* 记不上就算了，不能影响主流程 */
      }
    }

    /**
     * 把主视图从这个会话上切走。
     *
     * 宿主那边只有 AgentHandle 的持有者才能 teardown 一个会话，第三方插件拿不到；
     * 但**客户端释放引用之后**，会话控制器会自己把它下庄，此后 list 里就没有它了。
     * 这是"删的就是当前正开着的那个会话"时唯一能让那一行真正消失的办法。
     * @returns 是否成功切走
     */
    function leaveSession(sessionId) {
      try {
        const ui = clientContext?.uiWorkspace ?? clientContext?.get?.("uiWorkspace");
        const sessions = clientContext?.sessions ?? clientContext?.get?.("sessions");
        const state = sessions?.list?.getSnapshot?.();
        const ids = Array.isArray(state?.ids) ? state.ids : [];
        const other = ids.find((id) => id !== sessionId && state?.byId?.[id] !== undefined);
        reportDebug({
          step: "leave",
          ui: ui === undefined ? "missing" : typeof ui.openSession,
          ids: ids.length,
          other: other ?? null,
          known: state?.byId?.[sessionId] !== undefined
        });
        if (ui === undefined || typeof ui.openSession !== "function" || other === undefined) return false;
        ui.openSession(other);
        return true;
      } catch (error) {
        reportDebug({ step: "leave-error", message: String(error?.message ?? error) });
        return false;
      }
    }

    function finish(request) {
      const sessionId = request?.sessionId;
      const live = request?.result?.live === true;
      closeDialog();

      // 先切走再摘行：切走之后宿主才可能把这个会话下庄，摘掉的行才不会又被投影回来。
      const left = live ? leaveSession(sessionId) : false;

      const dropped = dropSessionRow(sessionId);
      const service = clientContext?.sessions ?? clientContext?.get?.("sessions");
      const state = service?.list?.getSnapshot?.();
      reportDebug({
        step: "finish",
        sessionId,
        live,
        left,
        dropped,
        stillThere: state?.byId?.[sessionId] !== undefined,
        ids: Array.isArray(state?.ids) ? state.ids.length : null,
        store: service?.list === undefined ? "missing" : "ok"
      });

      // 延迟补两次：宿主的下庄和 store 的重新投影都可能在下一帧才发生。
      if (live) {
        setTimeout(() => {
          const again = dropSessionRow(sessionId);
          const now = (clientContext?.sessions ?? clientContext?.get?.("sessions"))?.list?.getSnapshot?.();
          reportDebug({ step: "retry-300", dropped: again, stillThere: now?.byId?.[sessionId] !== undefined });
        }, 300);
        setTimeout(() => {
          const again = dropSessionRow(sessionId);
          const now = (clientContext?.sessions ?? clientContext?.get?.("sessions"))?.list?.getSnapshot?.();
          const still = now?.byId?.[sessionId] !== undefined;
          reportDebug({ step: "retry-1200", dropped: again, stillThere: still });
          // 行还在，说明这个会话仍活在进程里、每次投影都会把它加回来。
          // 用 DSH 自己的"归档"把它从侧栏收起来——数据已经删了，这只是一个隐藏标记。
          if (still) {
            void callHost({ op: "hide", sessionId })
              .then((out) => reportDebug({ step: "hide", ok: out?.ok === true, code: out?.code ?? null }))
              .catch(() => {});
          }
        }, 1200);
      }
      // 这个 Electron 窗口里 location.reload() 会被静默吞掉，只作为最后兜底，不依赖它。
      if (!dropped && !live) {
        try {
          location.reload();
        } catch {
          /* 刷新被禁用就到此为止 */
        }
      }
    }

    /* ------------------------------------------------------------------ */
    /* 菜单项                                                              */
    /* ------------------------------------------------------------------ */

    function DeleteMenuItem({ sessionId, displayTitle, useMenuOpenState, openDelete, t }) {
      const [, setMenuOpen] = useMenuOpenState();
      return h(
        primitives.MenuItemButton,
        {
          icon: h(primitives.IconTrashOutlineRegular, { size: 14 }),
          onSelect: () => {
            setMenuOpen(false);
            openDelete(sessionId, displayTitle);
          }
        },
        t("action")
      );
    }

    /* ------------------------------------------------------------------ */
    /* 插件入口                                                            */
    /* ------------------------------------------------------------------ */

    let clientContext = null;

    const inject = ["slots", "locale"];

    function apply(ctx) {
      clientContext = ctx;
      ensureStyle();
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-session-delete: dictionaries");

      ctx.slots.inject("sidebar.workspaces.session.menu.item", () =>
        ctx.slots.register(
          {
            name: "sidebar.workspaces.session.menu.item",
            id: "dsh.session-delete",
            order: 410,
            locale: NS,
            inject: () => ({ openDelete: dialogState })
          },
          DeleteMenuItem
        )
      );

      ctx.slots.inject("shell.overlay", () =>
        ctx.slots.register({ name: "shell.overlay", id: "dsh.session-delete-dialog", locale: NS }, DeleteDialog)
      );
    }

    exports.name = "session-delete";
    exports.apply = apply;
    exports.inject = inject;
    exports.__debug = { publish, store, bytesText, finish, dropSessionRow };
    return module.exports;
  }
});
