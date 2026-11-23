if(window.MBLPlatformConfig?.releaseEnabled!==false){
(function(){
"use strict";
function mblChatError(code, message) {
  const e = new Error(typeof message === "string" ? message.slice(0, 180) : "聊天请求失败，请稍后重试");
  e.code = Number(code) || 0;
  return e;
}
function mblChatEnsure(res) {
  if (!res || Number(res.code) !== 200) throw mblChatError(res?.code, res?.message || "聊天请求失败，请稍后重试");
  return res;
}
function mblChatPage(res) {
  let data = res.data;
  for (let depth = 0; depth < 4 && data && typeof data === "object"; depth++) {
    if (Array.isArray(data.list)) return;
    data = data.result && typeof data.result === "object" ? data.result : data.data;
  }
  throw mblChatError(500, "聊天列表数据异常，请稍后刷新。");
}
async function mblChatDeadline(promise) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => timer = setTimeout(() => reject(mblChatError(408, "请求超时，已暂停自动刷新；发送结果请先刷新核对。")), 12e3))]);
  } finally {
    clearTimeout(timer);
  }
}
function mblChatAvatar(value) {
  if (typeof value !== "string" || value.length > 2048) return "";
  try {
    const u = new URL(value.startsWith("//") ? "https:" + value : value);
    if (u.protocol !== "https:" || u.username || u.password || u.port || !["hupu.com", "hoopchina.com.cn", "gdc.hupucdn.com"].some((d) => u.hostname === d || u.hostname.endsWith("." + d))) return "";
    if ([...u.searchParams.keys()].some((k) => /token|ticket|secret|credential|authorization/i.test(k))) return "";
    u.hash = "";
    return u.href;
  } catch {
    return "";
  }
}
async function mblChatUser() {
  if (typeof window.ColorboxAI?.auth?.getUserInfo !== "function") throw mblChatError(0, "请在虎扑 App 内登录后使用聊天室。");
  const res = await mblChatDeadline(window.ColorboxAI?.auth?.getUserInfo());
  if (Number(res?.code) === 401) return null;
  mblChatEnsure(res);
  if (!res.data || ![1, true].includes(res.data.islogin)) return null;
  const info = res.data;
  if(!['string','number'].includes(typeof info.puid)||!String(info.puid).trim()||String(info.puid).length>128)throw mblChatError(500,'账号资料尚未就绪，请重新登录后刷新。');
  return { userId: String(info.puid || ""), nickname: typeof info.nickname === "string" ? info.nickname.trim().slice(0, 80) : "虎扑球迷", avatarUrl: mblChatAvatar(info.avatar || info.userHeadUrl) };
}
function mblChatFeedback(owner, text, tone = "quiet") {
  owner.feedback.textContent = text;
  owner.feedback.dataset.tone = tone;
}
function mblChatStop(owner, error) {
  owner.failures = (owner.failures || 0) + 1;
  if ([401, 403, 404, 408, 429, 503].includes(error.code) || !error.code || owner.failures >= 3) owner.paused = true;
  if (error.code === 403) owner.unavailable = true;
  const message = !error.code ? "聊天连接失败，请在虎扑 App 内打开后刷新。" : error.code === 403 ? "当前环境或账号不支持聊天，请在虎扑 App 内重试。" : error.message;
  mblChatFeedback(owner, message + (owner.paused ? " 自动刷新已停止，点击刷新可重试。" : ""), "error");
}
function mblChatControls(owner) {
  owner.sendButton.disabled = !!owner.sendBusy || !!owner.unavailable;
  owner.textarea.disabled = !!owner.sendBusy || !!owner.unavailable;
}
function mblChatTeamText(content){return {content};}
function mblChatTeamWire(content){return content;}
function mblChatReadCursor(raw, id) {
  if (typeof id !== "string" || !/^\d{1,40}$/.test(id)) return null;
  const value = ["createdAt", "created_at", "createTime", "create_time", "postdate", "time"].map((k) => raw[k]).find((v) => v !== null && v !== void 0);
  let at;
  if (typeof value === "number" || typeof value === "string" && /^\d+(\.\d+)?$/.test(value)) {
    at = Number(value);
    if (at < 1e10) at *= 1e3;
  } else if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}[T ]/.test(value)) at = Date.parse(value);
  return Number.isFinite(at) && at > 0 && at <= Date.now() + 6e4 ? { at: Math.floor(at), id: id.replace(/^0+(?=\d)/, "") } : null;
}
const chatRowsR96 = /* @__PURE__ */ new WeakMap();
const failedAvatarsR96 = /* @__PURE__ */ new Map();
function avatarAvailableR96(url) {
  if (!url) return false;
  const failed = failedAvatarsR96.get(url);
  return !failed || failed.failures < 3 && Date.now() >= failed.until;
}
function avatarFailedR96(url) {
  const previous = failedAvatarsR96.get(url), now = Date.now();
  if (previous && now < previous.until) return;
  const failures = (previous?.failures || 0) + 1;
  failedAvatarsR96.delete(url);
  failedAvatarsR96.set(url, { failures, until: now + (failures === 1 ? 6e4 : 3e5) });
  if (failedAvatarsR96.size > 256) failedAvatarsR96.delete(failedAvatarsR96.keys().next().value);
}
function reconcileChatR96(owner, render, formatTime) {
  const previous = chatRowsR96.get(owner) || /* @__PURE__ */ new Map(), next = /* @__PURE__ */ new Map();
  let cursor = owner.list.firstChild;
  for (const message of owner.messages) {
    const key = message.id || message.localId;
    const fingerprint = JSON.stringify([message, owner.currentUser?.userId]);
    let row = previous.get(key);
    const retry = row && message.avatarUrl && !row.node.querySelector("img") && avatarAvailableR96(message.avatarUrl);
    if (!row || row.fingerprint !== fingerprint || retry) row = { fingerprint, node: render(message) };
    const time = row.node.querySelector("time"), label = formatTime(message.createdAt);
    if (time && time.textContent !== label) time.textContent = label;
    if (row.node === cursor) cursor = cursor.nextSibling;
    else owner.list.insertBefore(row.node, cursor);
    next.set(key, row);
  }
  while (cursor) {
    const following = cursor.nextSibling;
    cursor.remove();
    cursor = following;
  }
  chatRowsR96.set(owner, next);
}
var MBLChatChannels = (function(e) {
  Object.defineProperty(e, Symbol.toStringTag, { value: `Module` });
  function t(e2) {
    "@babel/helpers - typeof";
    return t = typeof Symbol == `function` && typeof Symbol.iterator == `symbol` ? function(e3) {
      return typeof e3;
    } : function(e3) {
      return e3 && typeof Symbol == `function` && e3.constructor === Symbol && e3 !== Symbol.prototype ? `symbol` : typeof e3;
    }, t(e2);
  }
  function n(e2, n2) {
    if (t(e2) != `object` || !e2) return e2;
    var r2 = e2[Symbol.toPrimitive];
    if (r2 !== void 0) {
      var i2 = r2.call(e2, n2 || `default`);
      if (t(i2) != `object`) return i2;
      throw TypeError(`@@toPrimitive must return a primitive value.`);
    }
    return (n2 === `string` ? String : Number)(e2);
  }
  function r(e2) {
    var r2 = n(e2, `string`);
    return t(r2) == `symbol` ? r2 : r2 + ``;
  }
  function i(e2, t2, n2) {
    return (t2 = r(t2)) in e2 ? Object.defineProperty(e2, t2, { value: n2, enumerable: true, configurable: true, writable: true }) : e2[t2] = n2, e2;
  }
  var a = class extends Error {
    constructor(e2, t2) {
      super(t2), i(this, `code`, void 0), this.name = `VaSdkError`, this.code = e2;
    }
  };
  async function u() {
    return mblChatUser();
  }
  async function d() {
  }
  let f = `643472687`, p = [{ id: f, name: `人生聊天室`, short: `大厅`, hint: `聊聊你的篮球人生…` }], m = `mbl-chat-channel-v1`;
  function h(e2) {
    return p.some((t2) => t2.id === e2) ? e2 : f;
  }
  function g(e2) {
    return e2 === `642115011` ? _ : _ + `:` + e2;
  }
  let _ = `mbl-chat-last-seen-v1`, v = `mbl-chat-pending-v1`;
  function y(e2) {
    return typeof e2 == `object` && e2 ? e2 : null;
  }
  function b(e2, t2) {
    for (let n2 of t2) {
      let t3 = e2[n2];
      if (t3 != null) return t3;
    }
  }
  function x(e2, t2) {
    let n2 = b(e2, t2);
    return typeof n2 == `string` ? n2.trim() : typeof n2 == `number` && Number.isFinite(n2) ? String(n2) : ``;
  }
  function S(e2, t2) {
    let n2 = x(e2, t2);
    return n2.startsWith(`//`) ? `https:${n2}` : n2;
  }
  function C(e2) {
    return e2.replace(/<br\s*\/?>/gi, `
`).replace(/<[^>]+>/g, ``).replace(/&nbsp;/gi, ` `).replace(/&amp;/gi, `&`).replace(/&lt;/gi, `<`).replace(/&gt;/gi, `>`).replace(/&quot;/gi, `"`).replace(/&#0*39;/gi, `'`).replace(/\n{3,}/g, `

`).trim();
  }
  function w(e2) {
    if (typeof e2 == `number` && Number.isFinite(e2)) return e2 < 1e10 ? e2 * 1e3 : e2;
    if (typeof e2 == `string` && e2.trim()) {
      if (/^\d+$/.test(e2.trim())) return w(Number(e2));
      let t2 = Date.parse(e2);
      if (Number.isFinite(t2)) return t2;
    }
    return Date.now();
  }
  function T(e2) {
    for (let t2 of [`user`, `author`, `userInfo`, `member`]) {
      let n2 = y(e2[t2]);
      if (n2) return n2;
    }
    return e2;
  }
  function E(e2, t2 = 0) {
    let n2 = y(e2);
    if (!n2) return null;
    let r2 = T(n2), i2 = C(x(n2, [`content`, `contentHtml`, `body`, `text`, `togglecontent`]));
    if (!i2) return null;
    let a2 = w(b(n2, [`createdAt`, `created_at`, `createTime`, `create_time`, `postdate`, `time`])), o = x(n2, [`pid`, `postId`, `id`, `replyId`]) || `reply-${a2}-${t2}`, s = x(n2, [`puid`, `authorId`, `userId`, `uid`]) || x(r2, [`puid`, `authorId`, `userId`, `uid`, `id`]), c = x(n2, [`authorName`, `username`, `nickname`, `puname`, `userName`]) || x(r2, [`username`, `nickname`, `nickName`, `puname`, `userName`, `name`]), l = S(n2, [`avatar`, `avatar_url`, `header`, `userHeader`, `avatarUrl`, `userImg`]) || S(r2, [`avatar`, `avatar_url`, `header`, `userHeader`, `avatarUrl`, `userImg`, `headImg`, `headUrl`]);
    return { id: o, authorId: s, authorName: c || `虎扑JR`, avatarUrl: l, content: i2, createdAt: a2, status: `published`, readCursor: mblChatReadCursor(n2, o) };
  }
  function D(e2) {
    let t2 = y(e2);
    if (!t2) return false;
    let n2 = b(t2, [`pid`, `postId`, `id`, `replyId`]), r2 = b(t2, [`content`, `contentHtml`, `body`, `text`, `togglecontent`]);
    return n2 != null && r2 != null;
  }
  function O(e2) {
    let t2 = y(e2), n2 = t2 ? y(t2.data) : null;
    if (Array.isArray(n2?.list)) return n2.list;
    let r2 = n2 ? y(n2.result) : null;
    if (Array.isArray(r2?.list)) return r2.list;
    let i2 = [], a2 = 0, o = /* @__PURE__ */ new Set(), s = (e3, t3) => {
      if (!(!e3 || t3 > 6 || typeof e3 != `object` || o.has(e3))) {
        if (o.add(e3), Array.isArray(e3)) {
          let n3 = e3.filter(D).length;
          n3 > 0 && n3 >= Math.ceil(e3.length / 3) && (n3 > a2 || n3 === a2 && e3.length > i2.length) && (i2 = e3, a2 = n3);
          for (let n4 of e3) s(n4, t3 + 1);
          return;
        }
        for (let n3 of Object.values(e3)) s(n3, t3 + 1);
      }
    };
    return s(e2, 0), i2;
  }
  function k(e2) {
    let t2 = y(e2), n2 = t2 ? y(t2.data) : null, r2 = n2 ? y(n2.result) : null, i2 = b(n2 ?? {}, [`all_page`, `allPage`, `total_page`, `totalPages`]) ?? b(r2 ?? {}, [`all_page`, `allPage`, `total_page`, `totalPages`]), a2 = Number(i2);
    return Number.isFinite(a2) && a2 >= 1 ? Math.floor(a2) : null;
  }
  function A(e2, t2 = 1) {
    let n2 = O(e2);
    return { messages: n2.map((e3, t3) => E(e3, t3)).filter((e3) => !!e3), rawCount: n2.length, page: t2, totalPages: k(e2) };
  }
  function j() {
    return window.ColorboxAI?.request?.bbs ?? null;
  }
  function M(e2) {
    let t2 = y(e2);
    return !!(t2 && Number(t2.code) === 200);
  }
  async function N(e2, t2 = f) {
    if (typeof window.ColorboxAI?.request?.bbs?.getsThreadPostList !== `function`) throw mblChatError(0, `聊天能力暂未就绪`);
    const r2 = await mblChatDeadline(window.ColorboxAI?.request?.bbs?.getsThreadPostList({ tid: h(t2), fid: `0`, page: e2, sort: 1, order: `desc` }));
    mblChatEnsure(r2);
    mblChatPage(r2);
    return A(r2, e2);
  }
  async function P(e2 = f) {
    let t2 = await N(1, e2);
    if (t2.totalPages === null || t2.totalPages <= 1) return { ...t2, olderPageStep: 1 };
    let n2 = await N(t2.totalPages, e2), r2 = V(t2.messages) ?? 0;
    return (V(n2.messages) ?? 0) > r2 ? { ...n2, olderPageStep: -1 } : { ...t2, olderPageStep: 1 };
  }
  async function F(content, t2 = f) {
    const res = await mblChatDeadline(window.ColorboxAI?.request?.bbs?.replyPost({ tid: h(t2), content }));
    mblChatEnsure(res);
    return res;
  }
  function I(e2, t2) {
    return t2 !== null && e2.some((e3) => e3.status === `published` && e3.createdAt > t2);
  }
  function L(e2) {
    return e2.hasBlockingModal;
  }
  function R(e2) {
    let t2 = y(e2), n2 = t2?.side === `left` ? `left` : `right`, r2 = t2?.yRatio === null || t2?.yRatio === void 0 ? null : Number(t2.yRatio);
    return { hidden: t2?.hidden === true, side: n2, yRatio: r2 !== null && Number.isFinite(r2) ? Math.max(0, Math.min(1, r2)) : null };
  }
  const memory = /* @__PURE__ */ new Map();
  function z(key) {
    return memory.get(key) || null;
  }
  function B(key, value) {
    memory.set(key, value);
  }
  function V(e2) {
    let t2 = e2.filter((e3) => e3.status === `published`).map((e3) => e3.createdAt);
    return t2.length ? Math.max(...t2) : null;
  }
  function H(e2) {
    let t2 = new Date(e2), n2 = /* @__PURE__ */ new Date();
    return t2.toDateString() === n2.toDateString() ? t2.toLocaleTimeString(`zh-CN`, { hour: `2-digit`, minute: `2-digit`, hour12: false }) : t2.toLocaleDateString(`zh-CN`, { month: `numeric`, day: `numeric` });
  }
  function U(e2) {
    return e2.trim().slice(0, 1).toUpperCase() || `J`;
  }
  function W() {
    return [];
  }
  var G = class {
    constructor(e2 = {}) {
      i(this, `threadId`, h(z(m))), i(this, `generation`, 0), i(this, `drafts`, {}), i(this, `host`, void 0), i(this, `entryDock`, void 0), i(this, `entry`, void 0), i(this, `dismissEntryButton`, void 0), i(this, `unreadDot`, void 0), i(this, `hideConfirm`, void 0), i(this, `drawer`, void 0), i(this, `list`, void 0), i(this, `loadEarlierButton`, void 0), i(this, `refreshButton`, void 0), i(this, `feedback`, void 0), i(this, `textarea`, void 0), i(this, `counter`, void 0), i(this, `sendButton`, void 0), i(this, `messages`, []), i(this, `pendingMessages`, W()), i(this, `open`, false), i(this, `suppressed`, false), i(this, `loading`, false), i(this, `page`, 1), i(this, `totalPages`, null), i(this, `olderPageStep`, 1), i(this, `loadedPageCount`, 0), i(this, `hasMore`, true), i(this, `timer`, null), i(this, `currentUser`, null), i(this, `preference`, void 0), i(this, `onPreferenceChange`, void 0), i(this, `activePointerId`, null), i(this, `pointerStartX`, 0), i(this, `pointerStartY`, 0), i(this, `dockStartX`, 0), i(this, `dockStartY`, 0), i(this, `draggingEntry`, false), i(this, `suppressEntryClick`, false), i(this, `longPressTimer`, null), i(this, `entryToolsTimer`, null), this.preference = R(e2.preference), this.onPreferenceChange = e2.onPreferenceChange, this.host = document.createElement(`div`), this.host.className = `parallel-chat`, Object.assign(this.host, { __dreamTeamChat: { open: () => this.show(), close: () => this.close(), getPreference: () => ({ ...this.preference }), isSuppressed: () => this.suppressed, setVisibility: (e3) => this.setVisibility(e3) } }), this.host.innerHTML = `
      <div class="parallel-chat__entry-dock">
        <button class="parallel-chat__entry" type="button" aria-label="打开人生聊天室">
          <span class="parallel-chat__entry-icon"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/></svg></span>
          <i aria-hidden="true"></i>
        </button>
        <button class="parallel-chat__entry-dismiss" type="button" data-chat-action="dismiss-entry" aria-label="隐藏本档聊天室入口"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17"/></svg></button>
      </div>
      <div class="parallel-chat__backdrop" hidden></div>
      <section class="parallel-chat__drawer" role="dialog" aria-modal="true" aria-labelledby="parallel-chat-title" hidden>
        <span class="parallel-chat__handle" aria-hidden="true"></span>
        <header class="parallel-chat__header">
          <div><h2 id="parallel-chat-title">球员生涯</h2><p>平行时空聊天室</p></div>
          <div class="parallel-chat__header-actions">
            <button type="button" data-chat-action="refresh" aria-label="刷新聊天"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.35 5.65"/><path d="M20 4v7h-7"/></svg></button>
            <button type="button" data-chat-action="close" aria-label="关闭聊天室"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
          </div>
        </header>
        <div class="parallel-chat__rooms">
          <nav class="parallel-chat__channels" role="tablist" aria-label="聊天频道" aria-orientation="vertical">
            ${p.map((e3, t2) => `<button type="button" role="tab" id="chat-tab-${e3.id}" aria-label="${e3.name}" aria-controls="chat-room" aria-selected="false" data-chat-channel="${e3.id}"><span aria-hidden="true">0${t2 + 1}</span><b>人生聊天室</b></button>`).join(``)}
          </nav>
        <div class="parallel-chat__room-content"><span class="parallel-chat__notice" hidden></span>
        <div id="chat-room" role="tabpanel" class="parallel-chat__timeline">
          <button class="parallel-chat__earlier" type="button" data-chat-action="earlier">再往前翻一页</button>
          <div class="parallel-chat__messages" aria-live="polite"></div>
        </div>
        </div>
        </div>
        <footer class="parallel-chat__composer">
          <p class="parallel-chat__feedback" role="status"></p>
          <div class="parallel-chat__input-row">
            <textarea rows="1" maxlength="180" placeholder="说说你在这段生涯里遇见了谁……" aria-label="聊天内容"></textarea>
            <button type="button" data-chat-action="send" aria-label="发送"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 14-7-5 14-2.5-5.5Z"/><path d="m11.5 13.5 3-3"/></svg></button>
          </div>
          <div class="parallel-chat__composer-meta"><span aria-hidden="true"></span><b hidden>0/180</b></div>
        </footer>
      </section>
      <div class="parallel-chat__hide-confirm" role="dialog" aria-modal="true" aria-labelledby="parallel-chat-hide-title" hidden>
        <section>
          <span class="parallel-chat__confirm-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 6.5h14M9 6.5V4h6v2.5M8 9.5v7M12 9.5v7M16 9.5v7M7 6.5l1 13h8l1-13"/></svg></span>
          <h3 id="parallel-chat-hide-title">这档不再显示聊天室？</h3>
          <p>确认后，这段生涯里不会再出现入口。</p>
          <div><button type="button" data-chat-action="keep-entry">保留入口</button><button type="button" data-chat-action="confirm-dismiss-entry">这档隐藏</button></div>
        </section>
      </div>`, document.body.appendChild(this.host), this.entryDock = this.requireElement(`.parallel-chat__entry-dock`), this.entry = this.requireElement(`.parallel-chat__entry`), this.dismissEntryButton = this.requireElement(`.parallel-chat__entry-dismiss`), this.unreadDot = this.requireElement(`.parallel-chat__entry i`), this.hideConfirm = this.requireElement(`.parallel-chat__hide-confirm`), this.drawer = this.requireElement(`.parallel-chat__drawer`), this.list = this.requireElement(`.parallel-chat__messages`), this.loadEarlierButton = this.requireElement(`.parallel-chat__earlier`), this.refreshButton = this.requireElement(`[data-chat-action="refresh"]`), this.feedback = this.requireElement(`.parallel-chat__feedback`), this.textarea = this.requireElement(`textarea`), this.counter = this.requireElement(`.parallel-chat__composer-meta b`), this.sendButton = this.requireElement(`[data-chat-action="send"]`), this.updateChannelUI(), this.messages = this.pendingMessages.filter((e3) => e3.threadId === this.threadId), this.applyPreference(), this.bindEvents(), this.renderMessages(), this.setUnread(false), this.schedule();
    }
    setVisibility(e2) {
      e2.preference && (this.preference = R(e2.preference), this.applyPreference()), this.suppressed = L(e2), this.host.classList.toggle(`parallel-chat--suppressed`, this.suppressed), this.suppressed && this.open ? this.close() : this.schedule();
    }
    updateChannelUI() {
      const notice = this.requireElement(".parallel-chat__notice");
      notice.hidden = this.threadId !== "642338075";
      notice.open = false;
      let e2 = p.find((e3) => e3.id === this.threadId);
      this.requireElement(`#parallel-chat-title`).textContent = e2.name, this.textarea.placeholder = e2.hint, this.requireElement(`#chat-room`).setAttribute(`aria-labelledby`, `chat-tab-` + e2.id), this.host.querySelectorAll(`[data-chat-channel]`).forEach((e3) => {
        let t2 = e3.dataset.chatChannel === this.threadId;
        e3.setAttribute(`aria-selected`, String(t2)), e3.tabIndex = t2 ? 0 : -1;
      });
    }
    switchChannel(e2) {
      e2 === this.threadId || !p.some((t2) => t2.id === e2) || (this.markSeen(), this.drafts[this.threadId] = this.textarea.value, this.threadId = e2, this.generation += 1, this.clearTimer(), this.loading = false, B(m, e2), this.page = 1, this.totalPages = null, this.loadedPageCount = 0, this.olderPageStep = 1, this.hasMore = true, this.messages = this.pendingMessages.filter((t2) => t2.threadId === e2), this.textarea.value = this.drafts[e2] || ``, this.counter.textContent = this.textarea.value.length + `/180`, this.counter.hidden = this.textarea.value.length < 140, this.feedback.textContent = ``, this.updateChannelUI(), this.renderMessages(), this.requireElement(`.parallel-chat__timeline`).scrollTop = 0, this.refresh(true));
    }
    requireElement(e2) {
      let t2 = this.host.querySelector(e2);
      if (!t2) throw Error(`Missing chat element: ${e2}`);
      return t2;
    }
    bindEvents() {
      this.host.querySelectorAll(`[data-chat-channel]`).forEach((e2) => {
        e2.addEventListener(`click`, () => this.switchChannel(e2.dataset.chatChannel)), e2.addEventListener(`keydown`, (t2) => {
          if (![`ArrowUp`, `ArrowDown`, `Home`, `End`].includes(t2.key)) return;
          t2.preventDefault();
          let n2 = [...this.host.querySelectorAll(`[data-chat-channel]`)], r2 = n2.indexOf(e2), i2 = t2.key === `Home` ? 0 : t2.key === `End` ? n2.length - 1 : (r2 + (t2.key === `ArrowDown` ? 1 : -1) + n2.length) % n2.length;
          n2[i2].click(), n2[i2].focus();
        });
      }), this.entry.addEventListener(`click`, () => {
        if (this.suppressEntryClick) {
          this.suppressEntryClick = false;
          return;
        }
        this.hideEntryTools(), this.show();
      }), this.entry.addEventListener(`pointerdown`, (e2) => this.startEntryDrag(e2)), window.addEventListener(`pointermove`, (e2) => this.moveEntryDrag(e2)), window.addEventListener(`pointerup`, (e2) => this.endEntryDrag(e2)), window.addEventListener(`pointercancel`, (e2) => this.cancelEntryDrag(e2)), this.host.querySelector(`.parallel-chat__backdrop`)?.addEventListener(`click`, () => this.close()), this.host.addEventListener(`click`, (e2) => {
        let t2 = e2.target instanceof Element ? e2.target.closest(`[data-chat-action]`) : null;
        t2 && (t2.dataset.chatAction === `close` ? this.close() : t2.dataset.chatAction === `refresh` ? (failedAvatarsR96.clear(), this.refresh(true, true)) : t2.dataset.chatAction === `earlier` ? this.loadEarlier() : t2.dataset.chatAction === `send` ? this.send() : t2.dataset.chatAction === `retry` ? this.retry(t2.dataset.localId ?? ``) : t2.dataset.chatAction === `dismiss-entry` ? this.openHideConfirmation() : t2.dataset.chatAction === `keep-entry` ? this.closeHideConfirmation() : t2.dataset.chatAction === `confirm-dismiss-entry` && this.confirmHideForSave());
      }), this.textarea.addEventListener(`input`, () => {
        this.counter.textContent = `${this.textarea.value.length}/180`, this.counter.hidden = this.textarea.value.length === 0, this.textarea.style.height = `auto`, this.textarea.style.height = `${Math.min(this.textarea.scrollHeight, 96)}px`;
      }), this.textarea.addEventListener(`keydown`, (e2) => {
        e2.key === `Enter` && !e2.shiftKey && (e2.preventDefault(), this.send());
      }), document.addEventListener(`visibilitychange`, () => {
        document.hidden ? this.clearTimer() : this.schedule(250);
      }), document.addEventListener(`keydown`, (e2) => {
        e2.key === `Escape` && this.open && this.close();
      }), window.addEventListener(`resize`, () => this.applyPreference()), window.addEventListener(`pagehide`, () => {
        this.clearTimer(), this.clearEntryGestureTimers();
      });
    }
    startEntryDrag() {
    }
    moveEntryDrag(e2) {
      if (this.activePointerId !== e2.pointerId) return;
      let t2 = e2.clientX - this.pointerStartX, n2 = e2.clientY - this.pointerStartY;
      if (!this.draggingEntry && Math.hypot(t2, n2) < 6) return;
      this.draggingEntry = true, this.suppressEntryClick = true, this.clearLongPressTimer(), this.hideEntryTools();
      let r2 = this.entryDock.getBoundingClientRect(), i2 = Math.max(10, window.innerWidth - r2.width - 10), a2 = Math.max(10, window.innerHeight - r2.height - 10), o = Math.max(10, Math.min(i2, this.dockStartX + t2)), s = Math.max(10, Math.min(a2, this.dockStartY + n2));
      this.entryDock.style.left = `${o}px`, this.entryDock.style.right = `auto`, this.entryDock.style.top = `${s}px`, this.entryDock.style.bottom = `auto`, this.entryDock.classList.add(`is-dragging`);
    }
    endEntryDrag(e2) {
      if (this.activePointerId !== e2.pointerId || (this.clearLongPressTimer(), typeof this.entry.hasPointerCapture == `function` && this.entry.hasPointerCapture(e2.pointerId) && this.entry.releasePointerCapture(e2.pointerId), this.activePointerId = null, this.entryDock.classList.remove(`is-dragging`), !this.draggingEntry)) return;
      this.draggingEntry = false;
      let t2 = this.entryDock.getBoundingClientRect(), n2 = t2.left + t2.width / 2 < window.innerWidth / 2 ? `left` : `right`, r2 = Math.max(1, window.innerHeight - t2.height - 20), i2 = Math.max(0, Math.min(1, (t2.top - 10) / r2));
      this.savePreference({ ...this.preference, side: n2, yRatio: i2 }), this.showEntryTools();
    }
    cancelEntryDrag(e2) {
      this.activePointerId === e2.pointerId && (this.activePointerId = null, this.draggingEntry = false, this.entryDock.classList.remove(`is-dragging`), this.clearLongPressTimer(), this.applyPreference());
    }
    applyPreference() {
      this.preference.hidden = false;
      this.preference.side = "right";
      this.host.classList.remove("parallel-chat--dismissed");
      const height = this.entryDock.offsetHeight || 52;
      const top = innerHeight - height - 100;
      this.entryDock.style.top = Math.max(100, Math.min(innerHeight - height - 10, top)) + "px";
      this.entryDock.style.bottom = "auto";
      this.entryDock.style.left = "auto";
      this.entryDock.style.right = "12px";
      this.entryDock.dataset.side = "right";
    }
    savePreference(e2) {
      this.preference = R(e2), this.applyPreference(), this.onPreferenceChange?.({ ...this.preference });
    }
    showEntryTools() {
    }
    hideEntryTools() {
      this.entryToolsTimer !== null && window.clearTimeout(this.entryToolsTimer), this.entryToolsTimer = null, this.entryDock.classList.remove(`show-tools`), this.dismissEntryButton.tabIndex = -1;
    }
    clearLongPressTimer() {
      this.longPressTimer !== null && window.clearTimeout(this.longPressTimer), this.longPressTimer = null;
    }
    clearEntryGestureTimers() {
      this.clearLongPressTimer(), this.entryToolsTimer !== null && window.clearTimeout(this.entryToolsTimer), this.entryToolsTimer = null;
    }
    openHideConfirmation() {
      this.hideEntryTools(), this.hideConfirm.hidden = false, document.body.classList.add(`parallel-chat-lock`), requestAnimationFrame(() => this.hideConfirm.classList.add(`is-open`));
    }
    closeHideConfirmation() {
      this.hideConfirm.classList.remove(`is-open`), window.setTimeout(() => {
        this.hideConfirm.classList.contains(`is-open`) || (this.hideConfirm.hidden = true);
      }, 180), this.open || document.body.classList.remove(`parallel-chat-lock`);
    }
    confirmHideForSave() {
      this.closeHideConfirmation(), this.savePreference({ ...this.preference, hidden: true }), this.clearTimer();
    }
    show() {
      if (this.open || this.suppressed) return;
      this.returnFocus = document.activeElement;
      this.open = true;
      this.generation++;
      this.loading = false;
      this.failures = 0;
      this.rounds = 0;
      this.paused = false;
      this.unavailable = false;
      for (const pending of this.pendingMessages) if (pending.status === "sending") pending.status = "unknown";
      this.drawer.hidden = false;
      this.host.querySelector(".parallel-chat__backdrop").hidden = false;
      this.host.classList.add("parallel-chat--open");
      document.body.classList.add("parallel-chat-lock");
      this.inertSiblings = [];
      for (const node of document.body.children) if (node !== this.host && !["SCRIPT", "STYLE", "LINK"].includes(node.tagName)) {
        this.inertSiblings.push([node, node.inert]);
        node.inert = true;
      }
      this.setUnread(false);
      mblChatControls(this);
      this.refreshButton.focus();
      void this.loadCurrentUser();
      void this.refresh(true, true);
    }
    close() {
      if (!this.open) return;
      this.markSeen();
      this.open = false;
      this.generation++;
      this.clearTimer();
      this.loading = false;
      this.refreshButton.disabled = false;
      this.refreshButton.classList.remove("is-loading");
      for (const pending of this.pendingMessages) if (pending.status === "sending") pending.status = "unknown";
      this.host.classList.remove("parallel-chat--open");
      document.body.classList.remove("parallel-chat-lock");
      this.drawer.hidden = true;
      this.host.querySelector(".parallel-chat__backdrop").hidden = true;
      for (const [node, inert] of this.inertSiblings || []) node.inert = inert;
      this.inertSiblings = [];
      const focus = this.returnFocus?.getClientRects().length ? this.returnFocus : document.getElementById("moreBtn");
      focus?.focus();
    }
    schedule(delay = 1e4) {
      this.clearTimer();
      if (!this.open || document.hidden || this.suppressed || this.paused || this.unavailable) return;
      if ((this.rounds || 0) >= 60) {
        this.paused = true;
        mblChatFeedback(this, "已暂停自动刷新，点击刷新聊天继续。");
        return;
      }
      this.timer = setTimeout(() => void this.refresh(false), delay);
    }
    clearTimer() {
      this.timer !== null && window.clearTimeout(this.timer), this.timer = null;
    }
    async refresh(initial, manual = false) {
      if (this.loading || !this.open || document.hidden || this.suppressed) return;
      if (manual) {
        this.failures = 0;
        this.rounds = 0;
        this.paused = false;
        this.unavailable = false;
      } else if (this.paused || this.unavailable) return;
      const epoch = this.generation, thread = this.threadId;
      this.loading = true;
      this.rounds = (this.rounds || 0) + 1;
      this.refreshButton.disabled = true;
      this.refreshButton.classList.add("is-loading");
      const timeline = this.host.querySelector(".parallel-chat__timeline");
      const nearBottom = !timeline || timeline.scrollHeight - timeline.scrollTop - timeline.clientHeight < 70;
      const oldNewest = V(this.messages) || 0;
      if (initial || manual) mblChatFeedback(this, "正在读取帖子回复…");
      try {
        const result = await P(thread);
        if (epoch !== this.generation || !this.open) return;
        this.failures = 0;
        this.hasLoaded = true;
        this.page = result.page;
        this.totalPages = result.totalPages;
        this.olderPageStep = result.olderPageStep;
        this.loadedPageCount = 1;
        this.hasMore = this.canLoadEarlier(result.rawCount);
        this.mergeRemote(result.messages, true);
        const pending = this.pendingMessages.filter((m2) => m2.threadId === thread && m2.status !== "failed");
        mblChatFeedback(this, pending.length ? "已提交的消息正在等待回复列表确认，请勿重复发送。" : manual ? "已刷新帖子回复" : "");
        if (nearBottom || initial) this.scrollToLatest(true);
        else if (result.messages.some((m2) => m2.createdAt > oldNewest)) this.newMessageButton.hidden = false;
        this.markSeen();
      } catch (error) {
        if (epoch === this.generation && this.open) mblChatStop(this, error);
      } finally {
        if (epoch === this.generation) {
          this.loading = false;
          this.refreshButton.disabled = false;
          this.refreshButton.classList.remove("is-loading");
          this.renderMessages();
          mblChatControls(this);
          this.schedule();
        }
      }
    }
    async loadEarlier() {
      if (this.loading || !this.open || this.unavailable || !this.hasMore || this.loadedPageCount >= 5) return;
      const epoch = this.generation, thread = this.threadId, next = this.page + this.olderPageStep;
      if (next < 1 || this.totalPages !== null && next > this.totalPages) {
        this.hasMore = false;
        return;
      }
      const timeline = this.host.querySelector(".parallel-chat__timeline"), height = timeline.scrollHeight, top = timeline.scrollTop;
      this.loading = true;
      this.clearTimer();
      this.loadEarlierButton.disabled = true;
      try {
        const result = await N(next, thread);
        if (epoch !== this.generation || !this.open) return;
        this.page = next;
        this.totalPages = result.totalPages ?? this.totalPages;
        this.loadedPageCount++;
        this.hasMore = this.canLoadEarlier(result.rawCount);
        this.mergeRemote(result.messages, false);
        timeline.scrollTop = top + timeline.scrollHeight - height;
        mblChatFeedback(this, "");
      } catch (error) {
        if (epoch === this.generation) mblChatStop(this, error);
      } finally {
        if (epoch === this.generation) {
          this.loading = false;
          this.renderMessages();
          this.schedule();
        }
      }
    }
    canLoadEarlier(e2) {
      if (e2 === 0 || this.loadedPageCount >= 5) return false;
      let t2 = this.page + this.olderPageStep;
      return t2 < 1 ? false : this.totalPages === null || t2 <= this.totalPages;
    }
    mergeRemote(remote, replace) {
      const incoming = remote.map((message) => ({ ...message, avatarUrl: mblChatAvatar(message.avatarUrl), content: message.content.slice(0, 4e3) }));
      const mapped = new Map(incoming.map((m2) => [m2.id, m2]));
      if (!replace) {
        for (const message of this.messages.filter((m2) => m2.status === "published")) if (!mapped.has(message.id)) mapped.set(message.id, message);
      }
      this.pendingMessages = this.pendingMessages.filter((pending) => {
        if (pending.threadId !== this.threadId || pending.status === "failed") return true;
        if (pending.serverId && incoming.some((m2) => m2.id === pending.serverId)) return false;
        const matches = incoming.filter((m2) => pending.authorId && m2.authorId === pending.authorId && m2.content === pending.content && Math.abs(m2.createdAt - pending.createdAt) < 12e4);
        const pendingMatches = this.pendingMessages.filter((m2) => m2.threadId === pending.threadId && m2.authorId === pending.authorId && m2.content === pending.content && m2.status !== "failed");
        return !(matches.length === 1 && pendingMatches.length === 1);
      });
      this.messages = [...mapped.values(), ...this.pendingMessages.filter((m2) => m2.threadId === this.threadId)].sort((a2, b2) => a2.createdAt - b2.createdAt || a2.id.localeCompare(b2.id)).slice(-250);
      this.renderMessages();
    }
    renderMessages() {
      this.renderOriginalMessages();
      const empty = this.list.querySelector(".parallel-chat__empty");
      if (empty) {
        empty.querySelector("strong").textContent = this.hasLoaded ? "还没有公开回复" : "尚未读取聊天消息";
        empty.querySelector("span").textContent = this.hasLoaded ? "这里与“我的篮球人生聊天室”帖子互通。" : "请在虎扑 App 内打开后刷新。";
      }
    }
    renderOriginalMessages() {
      if (this.messages.length === 0) {
        this.list.replaceChildren();
        let e2 = document.createElement(`div`);
        e2.className = `parallel-chat__empty`, e2.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 19.5V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8Z"/><path d="m4 19.5 4-2.5M8 8h8M8 12h5"/></svg><strong>第一句话还在等人。</strong><span>聊聊你这一生的选择与故事。</span>`, this.list.appendChild(e2);
      } else reconcileChatR96(this, (message) => this.renderMessage(message), H);
      this.loadEarlierButton.hidden = !this.hasMore || this.loadedPageCount >= 5 || this.messages.length === 0, this.loadEarlierButton.disabled = false, this.loadEarlierButton.textContent = this.loadedPageCount >= 5 ? `已经翻到很久以前` : `再往前翻一页`;
    }
    renderMessage(message) {
      const tagged = mblChatTeamText(message.content);
      const row = this.renderOriginalMessage({ ...message, content: tagged.content, avatarUrl: mblChatAvatar(message.avatarUrl) });
      const label = row.querySelector(".parallel-chat__message-status");
      if (label) {
        const retry = label.querySelector("button");
        label.replaceChildren(document.createTextNode({ sending: "正在提交…", submitted: "已提交，待列表确认", unknown: "发送结果待确认，请先刷新核对", failed: "未提交成功" }[message.status] || "等待确认"));
        if (retry) {
          retry.textContent = "重新编辑";
          label.append(" · ", retry);
        }
      }
      return row;
    }
    renderOriginalMessage(e2) {
      let t2 = document.createElement(`article`);
      t2.className = `parallel-chat__message`;
      let n2 = e2.status !== `published` || !!(this.currentUser?.userId && e2.authorId === this.currentUser.userId);
      t2.classList.toggle(`parallel-chat__message--self`, n2), t2.dataset.status = e2.status;
      let r2 = document.createElement(avatarAvailableR96(e2.avatarUrl) ? `img` : `span`);
      r2.className = `parallel-chat__avatar`, r2 instanceof HTMLImageElement ? (r2.src = e2.avatarUrl, r2.alt = `${e2.authorName}的头像`, r2.referrerPolicy = `no-referrer`, r2.addEventListener(`error`, () => {
        avatarFailedR96(e2.avatarUrl);
        let t3 = document.createElement(`span`);
        t3.className = `parallel-chat__avatar`, t3.textContent = U(e2.authorName), t3.setAttribute(`aria-hidden`, `true`), r2.replaceWith(t3);
      }, { once: true })) : (r2.textContent = U(e2.authorName), r2.setAttribute(`aria-hidden`, `true`));
      let i2 = document.createElement(`div`);
      i2.className = `parallel-chat__message-body`;
      let a2 = document.createElement(`div`);
      a2.className = `parallel-chat__message-meta`;
      let o = document.createElement(`strong`);
      o.textContent = e2.authorName;
      let s = document.createElement(`time`);
      s.dateTime = new Date(e2.createdAt).toISOString(), s.textContent = H(e2.createdAt), a2.append(o, s);
      let c = document.createElement(`p`);
      if (c.textContent = e2.content, i2.append(a2, c), e2.status !== `published`) {
        let t3 = document.createElement(`small`);
        if (t3.className = `parallel-chat__message-status`, t3.textContent = e2.status === `sending` ? `正在送往这片时空` : e2.status === `audit` ? `已经送出` : `没有送达`, e2.status === `failed` && e2.localId) {
          let n3 = document.createElement(`button`);
          n3.type = `button`, n3.dataset.chatAction = `retry`, n3.dataset.localId = e2.localId, n3.textContent = `重试`, t3.append(` · `, n3);
        }
        i2.appendChild(t3);
      }
      return t2.append(r2, i2), t2;
    }
    async send() {
      if (this.sendBusy || this.sendButton.disabled || !this.open) return;
      const content = this.textarea.value.trim(), epoch = this.generation;
      const wireContent = mblChatTeamWire(content);
      if (!content || content.length > 180) {
        mblChatFeedback(this, content ? "最多输入 180 个字符。" : "先写一句话再发送。", "error");
        return;
      }
      if (this.pendingMessages.filter((m2) => m2.status !== "failed").length >= 20) {
        mblChatFeedback(this, "待确认消息较多，请先刷新核对。", "error");
        return;
      }
      this.sendBusy = true;
      mblChatControls(this);
      mblChatFeedback(this, "正在检查登录与内容…");
      try {
        const user = await this.loadCurrentUser();
        if (epoch !== this.generation || !this.open || document.hidden) return;
        if (!user) {
          mblChatFeedback(this, "请先登录虎扑，再回来发送。", "error");
          return;
        }
        if (this.pendingMessages.some((m2) => m2.content === wireContent && m2.status !== "failed")) {
          mblChatFeedback(this, "这条消息已提交或结果待确认，请先刷新核对。", "error");
          return;
        }
        const review = await mblChatDeadline(window.ColorboxAI?.security?.checkAudit(wireContent));
        mblChatEnsure(review);
        if (review.data !== true) throw mblChatError(422, "内容未通过安全检测，请修改后再发。");
        if (epoch !== this.generation || !this.open || document.hidden) return;
        const current = await u();
        if (epoch !== this.generation || !this.open || document.hidden) return;
        if (!current || current.userId !== user.userId) throw mblChatError(401, "账号已变化，请确认登录后重新发送。");
        this.currentUser = current;
        const pending = this.createPendingMessage(wireContent, current);
        this.pendingMessages.push(pending);
        this.messages.push(pending);
        this.renderMessages();
        this.textarea.value = "";
        this.counter.textContent = "0/180";
        this.counter.hidden = true;
        this.scrollToLatest(true);
        await this.submitPending(pending.localId);
      } catch (error) {
        if (epoch === this.generation && this.open) {
          mblChatFeedback(this, error.code ? error.message : "暂时无法检测内容或读取登录状态，请稍后再试。", "error");
          if ([408, 429, 503].includes(error.code)) {
            this.paused = true;
            this.clearTimer();
          }
        }
      } finally {
        this.sendBusy = false;
        mblChatControls(this);
      }
    }
    createPendingMessage(e2, t2) {
      let n2 = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return { id: n2, localId: n2, threadId: this.threadId, authorId: t2.userId, authorName: t2.nickname, avatarUrl: t2.avatarUrl, content: e2, createdAt: Date.now(), status: `sending` };
    }
    async loadCurrentUser() {
      const epoch = this.generation;
      try {
        const user = await u();
        if (epoch !== this.generation) return null;
        if (this.currentUser?.userId !== user?.userId) {
          this.pendingMessages = [];
          this.messages = this.messages.filter((m2) => m2.status === "published");
        }
        this.currentUser = user;
        this.renderMessages();
        return user;
      } catch (error) {
        if (epoch === this.generation) mblChatFeedback(this, error.message, "error");
        return null;
      }
    }
    async submitPending(localId) {
      const pending = this.pendingMessages.find((m2) => m2.localId === localId), epoch = this.generation;
      if (!pending) return;
      pending.status = "sending";
      this.renderMessages();
      try {
        const result = await F(pending.content, pending.threadId);
        if (epoch !== this.generation) return;
        pending.status = "submitted";
        const data = result.data || {};
        const id = data.pid || data.postId || data.replyId;
        if (id) pending.serverId = String(id);
        mblChatFeedback(this, "已提交到公开帖子，等待回复列表确认。");
      } catch (error) {
        if (epoch !== this.generation) return;
        pending.status = [400, 401, 403, 404, 422, 429].includes(error.code) ? "failed" : "unknown";
        mblChatFeedback(this, pending.status === "unknown" ? "发送结果待确认。请先刷新查看，避免重复回帖。" : error.message, "error");
        if ([403, 408, 429, 503].includes(error.code)) {
          this.paused = true;
          this.clearTimer();
        }
      } finally {
        if (epoch === this.generation) this.renderMessages();
      }
    }
    async retry(localId) {
      const pending = this.pendingMessages.find((m2) => m2.localId === localId);
      if (!pending || pending.status !== "failed" || this.sendBusy) return;
      if (this.textarea.value.trim()) {
        mblChatFeedback(this, "请先处理输入框中的草稿，再重新编辑失败消息。", "error");
        return;
      }
      const user = await this.loadCurrentUser();
      if (!user || user.userId !== pending.authorId) {
        mblChatFeedback(this, "请用原账号重新编辑，或直接填写新的消息。", "error");
        return;
      }
      const draft = mblChatTeamText(pending.content).content;
      this.textarea.value = draft;
      this.counter.textContent = draft.length + "/180";
      this.counter.hidden = false;
      this.pendingMessages = this.pendingMessages.filter((m2) => m2 !== pending);
      this.messages = this.messages.filter((m2) => m2 !== pending);
      this.renderMessages();
      this.textarea.focus();
      mblChatFeedback(this, "已放回输入框；点击发送会重新检测内容。");
    }
    savePendingMessages() {
    }
    async peekLatest() { return P(this.threadId); }
    readLastSeen() {
      let e2 = Number(z(g(this.threadId)));
      return Number.isFinite(e2) && e2 > 0 ? e2 : null;
    }
    writeLastSeen(e2) {
      B(g(this.threadId), String(e2));
    }
    markSeen() {
      let e2 = V(this.messages);
      e2 !== null && this.writeLastSeen(e2), this.setUnread(false);
    }
    setUnread(e2) {
      this.unreadDot.hidden = !e2, this.entry.setAttribute(`aria-label`, e2 ? `打开人生聊天室，有新消息` : `打开人生聊天室`);
    }
    scrollToLatest(force = false) {
      if (!force) return;
      requestAnimationFrame(() => {
        if (!this.open) return;
        const timeline = this.host.querySelector(".parallel-chat__timeline");
        timeline.scrollTop = timeline.scrollHeight;
        if (this.newMessageButton) this.newMessageButton.hidden = true;
      });
    }
  };
  let K = null;
  function q(e2 = {}) {
    K || typeof document > `u` || (K = new G(e2));
  }
  function J(e2) {
    K?.setVisibility(e2);
  }
  return e.COMMUNITY_CHANNELS = p, e.COMMUNITY_MESSAGE_LIMIT = 180, e.COMMUNITY_THREAD_ID = f, e.CommunityChatController = G, e.fetchCommunityThreadPage = N, e.fetchLatestCommunityThreadPage = P, e.hasCommunityUnread = I, e.initializeCommunityChat = q, e.normalizeCommunityChatPreference = R, e.normalizeCommunityPage = A, e.normalizeCommunityReply = E, e.shouldSuppressCommunityChat = L, e.submitCommunityReply = F, e.syncCommunityChatVisibility = J, e;
})({});

/* Account-scoped read positions through the official cloud-save SDK. */
function mblChatUnread(owner){
 'use strict';
 const key='mbl.chat.read.v1.'+owner.threadId,deadline=mblChatDeadline;
 const dot=document.createElement('span');dot.className='mbl-chat-header-unread';dot.hidden=true;dot.setAttribute('aria-hidden','true');owner.host.querySelector('h2').append(dot);
 const status=document.createElement('p');status.className='mbl-chat-read-status';status.hidden=true;status.setAttribute('role','status');owner.host.querySelector('.parallel-chat__header').after(status);
 const original={setUnread:owner.setUnread.bind(owner),show:owner.show.bind(owner),close:owner.close.bind(owner),merge:owner.mergeRemote.bind(owner)};
 let session=null,epoch=0,checking=null,timer=null,readFrame=null,rounds=0,stopped=false,ended=false;
 const valid=s=>!ended&&s===session&&s.epoch===epoch;
 function cursor(v){return v&&Number.isSafeInteger(v.at)&&v.at>0&&v.at<=Date.now()+60000&&typeof v.id==='string'&&/^[1-9]\d{0,39}$/.test(v.id)?{at:v.at,id:v.id}:null;}
 function compare(a,b){if(!a)return b?-1:0;if(!b)return 1;if(a.at!==b.at)return a.at>b.at?1:-1;return a.id.length!==b.id.length?a.id.length>b.id.length?1:-1:a.id===b.id?0:a.id>b.id?1:-1;}
 const max=(a,b)=>compare(a,b)>=0?a:b;
 function latest(messages,foreign=false){let found=null;for(const m of messages||[])if(m.status==='published'&&(!foreign||m.authorId!==session?.userId))found=max(found,cursor(m.readCursor));return found;}
 function bottom(){const t=owner.host.querySelector('.parallel-chat__timeline');return !!t&&t.scrollHeight-t.scrollTop-t.clientHeight<70;}
 function readable(){return owner.open&&!owner.preference.hidden&&!document.hidden&&!owner.drawer.hidden&&!owner.suppressed&&!window.MBLPassAccess?.isOpen?.();}
 function render(){const unread=!!(session?.ready&&compare(session.newest,session.seen)>0);original.setUnread(unread);dot.hidden=!unread;if(owner.newMessageButton&&owner.open)owner.newMessageButton.hidden=!unread||bottom();}
 function failure(error){status.textContent='未读状态同步失败：'+(error?.message||'请稍后刷新重试。');status.hidden=false;}
 function clearStatus(){status.textContent='';status.hidden=true;}
 function sdk(){const c=window.ColorboxAI?.cloudSave;if(typeof c?.getValue!=='function'||typeof c?.setValue!=='function')throw mblChatError(0,'当前客户端暂不支持，请更新虎扑后重试。');return c;}
 function parse(result){mblChatEnsure(result);if(result.data===null)return null;if(typeof result.data!=='string'||result.data.length>1000)throw mblChatError(500,'已读记录格式异常，请刷新重试。');let value;try{value=JSON.parse(result.data);}catch{throw mblChatError(500,'已读记录格式异常，请刷新重试。');}if(value?.v!==1||value.threadId!==owner.threadId||!cursor(value.seen))throw mblChatError(500,'已读记录格式异常，请刷新重试。');return cursor(value.seen);}
 async function sameUser(s){const user=await mblChatUser();if(!valid(s))return false;if(user?.userId!==s.userId){invalidate();void sync(true);return false;}return true;}
 function scheduleWrite(s){if(!valid(s)||!s.ready||s.writePaused||s.writing||compare(s.seen,s.confirmed)<=0||s.writeTimer!==null)return;s.writeTimer=setTimeout(()=>{s.writeTimer=null;void flush(s);},500);}
 async function flush(s){
  if(!valid(s)||!s.ready||s.writing||s.writePaused||compare(s.seen,s.confirmed)<=0)return;
  s.writing=true;
  try{
   if(!await sameUser(s))return;
   const bridge=sdk(),remote=parse(await deadline(bridge.getValue({key})));if(!valid(s))return;
   s.seen=max(s.seen,remote);s.confirmed=remote;
   if(compare(s.seen,remote)>0){if(!await sameUser(s))return;const sent=s.seen;const result=await deadline(bridge.setValue({key,value:JSON.stringify({v:1,threadId:owner.threadId,seen:sent})}));if(!valid(s))return;mblChatEnsure(result);s.confirmed=max(s.confirmed,sent);}
   clearStatus();render();
  }catch(error){if(valid(s)){s.writePaused=true;failure(error);}}
  finally{if(valid(s)){s.writing=false;scheduleWrite(s);}}
 }
 function markSeen(){
  if(readFrame!==null)return;
  readFrame=requestAnimationFrame(()=>{readFrame=null;const s=session;if(!s?.ready||!valid(s)||!readable()||!owner.hasLoaded||!bottom()){render();return;}s.seen=max(s.seen,latest(owner.messages));render();scheduleWrite(s);});
 }
 function clearTimer(){if(timer!==null)clearTimeout(timer);timer=null;}
 function invalidate(){epoch++;clearTimer();if(session?.writeTimer!==null)clearTimeout(session?.writeTimer);session=null;checking=null;rounds=0;stopped=false;clearStatus();render();}
 function schedule(){clearTimer();if(ended||stopped||document.hidden||owner.open||owner.preference.hidden||rounds>=20)return;timer=setTimeout(()=>{timer=null;void sync();},30000);}
 async function sync(manual=false){
  if(ended||document.hidden||owner.preference.hidden)return;
  if(manual){stopped=false;rounds=0;if(session)session.writePaused=false;}
  if(checking)return checking;
  if(stopped||rounds>=20)return;
  clearTimer();const ticket=epoch;rounds++;
  const work=(async()=>{
   try{
    const user=await mblChatUser();if(ticket!==epoch||ended)return;
    if(!user){invalidate();return;}
    if(session?.userId!==user.userId){if(session?.writeTimer!==null)clearTimeout(session?.writeTimer);session={userId:user.userId,epoch,seen:null,confirmed:null,newest:null,ready:false,writing:false,writeTimer:null,writePaused:false};render();}
    const s=session;
    // The normal open-chat refresh already fetches messages. Closed probes reuse its normalizer.
    const result=await Promise.allSettled([deadline(sdk().getValue({key})),owner.open?Promise.resolve(null):owner.peekLatest()]);
    if(!valid(s))return;
    if(result[0].status==='fulfilled'){const remote=parse(result[0].value);s.seen=max(s.seen,remote);s.confirmed=remote;s.ready=true;s.writePaused=false;clearStatus();}
    else throw result[0].reason;
    if(result[1].status==='rejected')throw result[1].reason;
    if(result[1].value)s.newest=latest(result[1].value.messages,true);else if(owner.hasLoaded)s.newest=latest(owner.messages,true);
    render();if(owner.open)markSeen();else scheduleWrite(s);
   }catch(error){if(ticket===epoch&&!ended){stopped=true;clearTimer();failure(error);render();}}
  })();
  checking=work;try{await work;}finally{if(checking===work){checking=null;schedule();}}
 }
 owner.setUnread=()=>render();owner.markSeen=markSeen;
 owner.readLastSeen=()=>session?.seen?.at||null;
 owner.mergeRemote=(...args)=>{original.merge(...args);if(session)session.newest=latest(owner.messages,true);render();};
 owner.show=()=>{original.show();if(owner.open){clearTimer();void sync(true);}};
 owner.close=()=>{original.close();if(session){if(session.writeTimer!==null){clearTimeout(session.writeTimer);session.writeTimer=null;}void flush(session);}void sync(true);};
 owner.host.querySelector('.parallel-chat__timeline').addEventListener('scroll',markSeen,{passive:true});
 owner.refreshButton.addEventListener('click',()=>void sync(true));
 window.addEventListener('mbl:pass-account-change',invalidate);
 window.addEventListener('mbl:account-ready',()=>{invalidate();void sync(true);});
 window.addEventListener('mbl:chat-preference-change',()=>{clearTimer();if(!owner.preference.hidden)void sync(true);});
 document.addEventListener('visibilitychange',()=>{clearTimer();if(!document.hidden)void sync(true);});
 window.addEventListener('pagehide',()=>{ended=true;epoch++;clearTimer();if(session?.writeTimer!==null)clearTimeout(session?.writeTimer);if(readFrame!==null)cancelAnimationFrame(readFrame);});
 void sync();
 return {refresh:()=>sync(true)};
}

/* Local presentation preferences only. Gameplay continues to use its existing cloud save. */
function mblChatDock(owner){
 'use strict';
 const normalize=MBLChatChannels.normalizeCommunityChatPreference;
 const defaults=()=>({hidden:false,side:'right',yRatio:null});
 const appId=window.MBLPlatformConfig?.appId;
 let key='',identity='',epoch=0,edited=false,storageWarned=false,ended=false,frame=null,toastTimer=null,settingsFocus=null;
 const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
 const button=(text,cls)=>{const el=make('button',cls,text);el.type='button';return el;};
 const toast=make('div','mbl-chat-toast'),toastText=make('span'),undo=button('撤销');toast.hidden=true;toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');toast.append(toastText,undo);owner.host.append(toast);
 function notify(text,canUndo=false){clearTimeout(toastTimer);toastText.textContent=text;undo.hidden=!canUndo;toast.hidden=false;toastTimer=setTimeout(()=>{toast.hidden=true;},canUndo?5000:2600);}
 function persist(){
  edited=true;if(!key)return;
  try{const p=owner.preference;window.localStorage.setItem(key,JSON.stringify({v:1,hidden:p.hidden,side:p.side,yRatio:p.yRatio}));}
  catch{if(!storageWarned){storageWarned=true;notify('暂时无法记住设置，本次操作仍有效。');}}
 }
 function read(raw){
  if(raw===null||typeof raw!=='string'||raw.length>512)return defaults();
  try{const p=JSON.parse(raw);if(p?.v!==1||typeof p.hidden!=='boolean'||!['left','right'].includes(p.side)||(p.yRatio!==null&&(!Number.isFinite(p.yRatio)||p.yRatio<0||p.yRatio>1)))return defaults();return normalize(p);}catch{return defaults();}
 }
 function bounds(){
  const v=window.visualViewport,width=v?.width||innerWidth,height=v?.height||innerHeight,left=v?.offsetLeft||0,top=v?.offsetTop||0;
  const size=owner.entry.offsetHeight||48;
  return {left:left+12,right:Math.max(left+12,left+width-size-12),top:top+Math.min(96,height/4),bottom:Math.max(top+Math.min(96,height/4),top+height-size-180),size};
 }
 owner.applyPreference=function(){
  const p=normalize(this.preference),b=bounds(),compact=(window.visualViewport?.height||innerHeight)<480,side=p.yRatio===null&&compact?"left":p.side;this.preference=p;
  this.host.classList.toggle('parallel-chat--dismissed',p.hidden);
  this.entryDock.dataset.side=side;
  this.entryDock.style.left=(side==='left'?b.left:b.right)+'px';this.entryDock.style.right='auto';
  this.entryDock.style.top=(p.yRatio===null?Math.max(b.top,b.bottom-(compact?0:72)):b.top+(b.bottom-b.top)*p.yRatio)+'px';this.entryDock.style.bottom='auto';
 };
 owner.hideEntryTools=function(){clearTimeout(this.entryToolsTimer);this.entryToolsTimer=null;this.entryDock.classList.remove('show-tools');this.dismissEntryButton.hidden=true;this.entry.setAttribute('aria-expanded','false');};
 owner.showEntryTools=function(){if(this.preference.hidden||this.open||this.suppressed)return;this.dismissEntryButton.hidden=false;this.entryDock.classList.add('show-tools');this.entry.setAttribute('aria-expanded','true');clearTimeout(this.entryToolsTimer);this.entryToolsTimer=setTimeout(()=>this.hideEntryTools(),5000);};
 owner.startEntryDrag=function(event){
  if(event.button!==0||this.activePointerId!==null||this.suppressed)return;
  this.hideEntryTools();this.clearLongPressTimer();const r=this.entryDock.getBoundingClientRect();
  this.activePointerId=event.pointerId;this.pointerStartX=event.clientX;this.pointerStartY=event.clientY;this.dockStartX=r.left;this.dockStartY=r.top;this.draggingEntry=false;this.suppressEntryClick=false;
  this.entry.setPointerCapture?.(event.pointerId);
  this.longPressTimer=setTimeout(()=>{if(this.activePointerId!==null&&!this.draggingEntry){this.suppressEntryClick=true;this.showEntryTools();}},520);
 };
 owner.moveEntryDrag=function(event){
  if(this.activePointerId!==event.pointerId)return;const dx=event.clientX-this.pointerStartX,dy=event.clientY-this.pointerStartY;
  if(!this.draggingEntry&&Math.hypot(dx,dy)<6)return;
  this.draggingEntry=true;this.suppressEntryClick=true;this.clearLongPressTimer();this.hideEntryTools();
  const b=bounds();this.entryDock.classList.add('is-dragging');this.entryDock.style.left=Math.max(b.left,Math.min(b.right,this.dockStartX+dx))+'px';this.entryDock.style.top=Math.max(b.top,Math.min(b.bottom,this.dockStartY+dy))+'px';if(event.cancelable)event.preventDefault();
 };
 owner.endEntryDrag=function(event){
  if(this.activePointerId!==event.pointerId)return;this.clearLongPressTimer();const moved=this.draggingEntry;
  this.activePointerId=null;this.draggingEntry=false;if(this.entry.hasPointerCapture?.(event.pointerId))this.entry.releasePointerCapture(event.pointerId);this.entryDock.classList.remove('is-dragging');
  if(moved){const b=bounds(),x=parseFloat(this.entryDock.style.left),y=parseFloat(this.entryDock.style.top);this.savePreference({...this.preference,side:x<(b.left+b.right)/2?'left':'right',yRatio:b.bottom===b.top?0:Math.max(0,Math.min(1,(y-b.top)/(b.bottom-b.top)))});}
  if(this.suppressEntryClick)setTimeout(()=>{this.suppressEntryClick=false;},0);
 };
 owner.cancelEntryDrag=function(event){if(this.activePointerId!==event.pointerId)return;this.activePointerId=null;this.draggingEntry=false;this.suppressEntryClick=false;this.clearLongPressTimer();this.entryDock.classList.remove('is-dragging');this.applyPreference();};
 owner.dismissEntryButton.hidden=true;owner.dismissEntryButton.removeAttribute('tabindex');owner.dismissEntryButton.setAttribute('aria-label','隐藏聊天室');owner.dismissEntryButton.replaceChildren(document.createTextNode('隐藏聊天室'));
 owner.entry.addEventListener('contextmenu',event=>{event.preventDefault();owner.clearLongPressTimer();owner.showEntryTools();});
 owner.entry.addEventListener('keydown',event=>{if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){event.preventDefault();owner.showEntryTools();owner.dismissEntryButton.focus();}else if(event.key==='Escape')owner.hideEntryTools();});
 const more=button('⋯','mbl-chat-more'),menu=make('div','mbl-chat-menu'),hide=button('隐藏聊天室入口');more.setAttribute('aria-label','聊天室更多选项');more.setAttribute('aria-expanded','false');menu.hidden=true;menu.append(hide);owner.drawer.append(menu);owner.host.querySelector('.parallel-chat__header-actions').prepend(more);
 function closeMenu(){menu.hidden=true;more.setAttribute('aria-expanded','false');}
 more.onclick=()=>{menu.hidden=!menu.hidden;more.setAttribute('aria-expanded',String(!menu.hidden));};
 function hideEntry(){owner.hideEntryTools();closeMenu();if(owner.open)owner.close();owner.savePreference({...owner.preference,hidden:true});notify('聊天室已隐藏，可从设置恢复',true);settingsButton.focus();}
 hide.onclick=hideEntry;owner.openHideConfirmation=hideEntry;
 undo.onclick=()=>{toast.hidden=true;owner.savePreference({...owner.preference,hidden:false});owner.entry.focus();};
 const close=owner.host.querySelector('[data-chat-action="close"]');close.setAttribute('aria-label','收起聊天室');close.querySelector('svg').replaceChildren();const minus=document.createElementNS('http://www.w3.org/2000/svg','path');minus.setAttribute('d','M5 12h14');close.querySelector('svg').append(minus);
 const oldShow=owner.show.bind(owner),oldClose=owner.close.bind(owner);
 owner.show=function(){if(this.preference.hidden)return;closeMenu();oldShow();};
 owner.close=function(){closeMenu();oldClose();};
 const dialog=make('dialog','mbl-chat-settings'),head=make('header'),title=make('h2','','游戏设置'),dismiss=button('关闭'),row=make('label','mbl-chat-setting-row'),copy=make('span'),rowTitle=make('strong','','显示聊天室'),description=make('small','','隐藏后，可在这里重新开启'),toggle=make('input'),note=make('p','mbl-chat-setting-note','在本机记住选择，换人生也保持');
 title.id='mbl-chat-settings-title';dialog.setAttribute('aria-labelledby',title.id);dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.hidden=true;toggle.type='checkbox';toggle.setAttribute('role','switch');toggle.setAttribute('aria-label','显示聊天室');copy.append(rowTitle,description);row.append(copy,toggle);head.append(title,dismiss);dialog.append(head,row,note);document.body.append(dialog);
 const settingsButton=button('','mbl-chat-settings-button');settingsButton.setAttribute('aria-label','游戏设置');
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','M4 7h9m4 0h3M4 17h3m4 0h9');svg.append(path);for(const[cx,cy]of [[15,7],[9,17]]){const circle=document.createElementNS(svg.namespaceURI,'circle');circle.setAttribute('cx',cx);circle.setAttribute('cy',cy);circle.setAttribute('r','2');svg.append(circle);}settingsButton.append(svg,make('span','','设置'));
 function showSettings(){if(mblChatOtherDialog(owner.host))return;owner.hideEntryTools();if(owner.open)owner.close();settingsFocus=document.activeElement;toggle.checked=!owner.preference.hidden;dialog.hidden=false;dialog.showModal();window.MBLHost?.setChatOpen(true);dismiss.focus();}
 settingsButton.onclick=showSettings;dismiss.onclick=()=>dialog.close();dialog.addEventListener('close',()=>{dialog.hidden=true;window.MBLHost?.setChatOpen(false);if(settingsFocus?.isConnected)settingsFocus.focus();});
 toggle.onchange=()=>owner.savePreference({...owner.preference,hidden:!toggle.checked});
 function mount(){
  const target=document.querySelector('main.home .topbar .topright');if(target&&!target.contains(settingsButton))target.append(settingsButton);
  for(const gameMenu of document.querySelectorAll('#app .menu[role="menu"]')){
   let item=gameMenu.querySelector('[data-chat-preference-toggle]');if(!item){item=button('','mbl-chat-menu-toggle');item.dataset.chatPreferenceToggle='';item.setAttribute('role','menuitemcheckbox');item.append(make('span','','显示聊天室'),make('span','mstate'));item.onclick=event=>{event.stopPropagation();owner.savePreference({...owner.preference,hidden:!owner.preference.hidden});};gameMenu.append(item);}
   const checked=String(!owner.preference.hidden);if(item.getAttribute('aria-checked')!==checked)item.setAttribute('aria-checked',checked);const text=owner.preference.hidden?'关':'开';if(item.lastChild.textContent!==text)item.lastChild.textContent=text;
  }
 }
 owner.onPreferenceChange=()=>{persist();toggle.checked=!owner.preference.hidden;mount();window.dispatchEvent(new Event('mbl:chat-preference-change'));};
 async function connect(){
  const ticket=++epoch;
  try{
   const user=await mblChatUser();if(ended||ticket!==epoch)return;if(!user){key='';identity='';return;}
   if(identity===user.userId&&key)return;
   if(identity&&identity!==user.userId){edited=false;owner.preference=defaults();owner.applyPreference();}
   identity=user.userId;if(typeof appId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(appId)||!window.crypto?.subtle)return;
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(appId+':'+user.userId));if(ended||ticket!==epoch)return;
   key='mbl.chat.ui.v1:'+appId+':'+Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
   if(edited)persist();else{let raw=null;try{raw=window.localStorage.getItem(key);}catch{}owner.preference=read(raw);owner.applyPreference();toggle.checked=!owner.preference.hidden;mount();window.dispatchEvent(new Event('mbl:chat-preference-change'));}
  }catch{/* Missing identity or storage leaves this page's preferences usable. */}
 }
 function accountChanged(){epoch++;key='';identity='';edited=false;storageWarned=false;owner.clearEntryGestureTimers();owner.activePointerId=null;owner.draggingEntry=false;owner.suppressEntryClick=false;owner.entryDock.classList.remove('is-dragging');owner.hideEntryTools();closeMenu();if(owner.open)owner.close();if(dialog.open)dialog.close();owner.preference=defaults();owner.applyPreference();toast.hidden=true;mount();void connect();}
 window.addEventListener('mbl:pass-account-change',accountChanged);window.addEventListener('mbl:account-ready',()=>void connect());
 window.addEventListener('storage',event=>{if(key&&event.key===key&&!edited){owner.preference=read(event.newValue);owner.applyPreference();toggle.checked=!owner.preference.hidden;mount();}});
 document.addEventListener('pointerdown',event=>{if(!owner.entryDock.contains(event.target))owner.hideEntryTools();if(!menu.contains(event.target)&&!more.contains(event.target))closeMenu();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){owner.hideEntryTools();closeMenu();}});
 const app=document.getElementById('app');if(app)new MutationObserver(()=>{if(frame!==null||ended)return;frame=requestAnimationFrame(()=>{frame=null;mount();});}).observe(app,{childList:true,subtree:true});
 window.visualViewport?.addEventListener('resize',()=>{if(owner.activePointerId===null)owner.applyPreference();},{passive:true});window.visualViewport?.addEventListener('scroll',()=>{if(owner.activePointerId===null)owner.applyPreference();},{passive:true});
 window.addEventListener('pagehide',()=>{ended=true;epoch++;clearTimeout(toastTimer);if(frame!==null)cancelAnimationFrame(frame);});
 owner.applyPreference();mount();void connect();return {showSettings};
}

/* Presentation and lifecycle hooks for the current game; reference read/send logic stays in the controller. */
const mblChatProto=MBLChatChannels.CommunityChatController.prototype;
const mblChatShow=mblChatProto.show,mblChatClose=mblChatProto.close;
function mblChatOtherDialog(host){
  return [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].some(el=>!host?.contains(el)&&el.getClientRects().length>0&&!el.closest('[hidden]'));
}
mblChatProto.show=function(){
  if(this.open||mblChatOtherDialog(this.host))return;
  mblChatShow.call(this);
  if(this.open)window.MBLHost?.setChatOpen(true);
};
mblChatProto.close=function(){
  mblChatClose.call(this);
  window.MBLHost?.setChatOpen(false);
};
const mblChat=new MBLChatChannels.CommunityChatController();
mblChat.host.id='mbl-chat';
const mblChatPreferences=mblChatDock(mblChat);
mblChat.host.querySelector('.parallel-chat__header p').textContent='我的篮球人生 · 公开帖子互通';
mblChat.host.querySelector('.parallel-chat__composer-meta span').textContent='发送即公开回帖，使用当前虎扑头像昵称。';
mblChat.host.querySelector('.parallel-chat__composer-meta span').removeAttribute('aria-hidden');
mblChat.entry.setAttribute('aria-label','打开人生聊天室');
const mblChatNew=document.createElement('button');mblChatNew.type='button';mblChatNew.className='parallel-chat__new';mblChatNew.hidden=true;mblChatNew.textContent='有新消息 ↓';
mblChatNew.addEventListener('click',()=>mblChat.scrollToLatest(true));mblChat.drawer.append(mblChatNew);mblChat.newMessageButton=mblChatNew;
const mblChatReadSync=mblChatUnread(mblChat);
mblChat.textarea.addEventListener('compositionstart',()=>{mblChat.composing=true;});
mblChat.textarea.addEventListener('compositionend',()=>{mblChat.composing=false;});
mblChat.textarea.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.isComposing||mblChat.composing))event.stopImmediatePropagation();},true);
mblChat.host.addEventListener('keydown',event=>{
  event.stopPropagation();
  if(event.key==='Escape'){event.preventDefault();mblChat.close();return;}
  if(event.key==='Tab'){
    const items=[...mblChat.drawer.querySelectorAll('button,textarea,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length&&!el.closest('[hidden]'));
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&(document.activeElement===first||!mblChat.drawer.contains(document.activeElement))){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
});
function mblChatViewport(){
  const viewport=window.visualViewport;
  document.documentElement.style.setProperty('--mbl-chat-height',Math.max(180,(viewport?.height||innerHeight)-24)+'px');
  document.documentElement.style.setProperty('--mbl-chat-keyboard',Math.max(0,innerHeight-(viewport?.height||innerHeight)-(viewport?.offsetTop||0))+'px');
}
window.visualViewport?.addEventListener('resize',mblChatViewport,{passive:true});
window.visualViewport?.addEventListener('scroll',mblChatViewport,{passive:true});
window.addEventListener('resize',mblChatViewport,{passive:true});mblChatViewport();
let mblChatFrame=null;
function mblChatSyncDialog(){
  if(mblChatFrame!==null)return;
  mblChatFrame=requestAnimationFrame(()=>{
    mblChatFrame=null;const blocked=mblChatOtherDialog(mblChat.host);
    if(mblChat.suppressed!==blocked)mblChat.setVisibility({hasBlockingModal:blocked});
  });
}
new MutationObserver(mblChatSyncDialog).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class','aria-modal']});
mblChatSyncDialog();
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&mblChat.open)void mblChat.loadCurrentUser();});
window.MBLChat=Object.freeze({show:()=>mblChat.show(),close:()=>mblChat.close(),showSettings:()=>mblChatPreferences.showSettings(),get open(){return mblChat.open;}});

})();

}
