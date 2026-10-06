/* Article Reader — clean reading view with speak-on-navigate TTS.
 *
 * Implements the spec in "Article Reader with TTS & Keyboard Navigation":
 * click any sentence / heading / list item to hear it; arrows move by block and
 * sentence; 1–6 jump by heading level; Space reads straight through; Enter
 * highlights (==marks== written back to the note); Esc stops.
 *
 * The reading engine is ported from the Notational app's mdtts.js (itself the
 * descendant of this spec) — including the Kokoro integration with a rolling
 * look-ahead synthesis buffer. Kokoro runs on the always-on Mac mini and is
 * reached over Tailscale, so the iPhone and iPad read in the same voices as the
 * Mac. Falls back to system Web Speech voices whenever the server is unreachable.
 */
'use strict';

const { Plugin, ItemView, PluginSettingTab, Setting, MarkdownRenderer, Notice, Platform, requestUrl } = require('obsidian');

const VIEW_TYPE = 'article-reader-view';
// Kokoro lives on the always-on Mac mini, bound to its Tailscale address. The
// MagicDNS name rather than 100.x.y.z: the mini's tailnet IP has changed before.
const DEFAULT_TTS_URL = 'http://dewangs-mac-mini:8788';
const K_LOOKAHEAD = 3;
// iOS refuses a play() that isn't inside a user gesture, and awaiting a
// synthesis request loses the gesture — so the <audio> element is unlocked with
// a silent clip during the first tap instead, and stays unlocked afterwards.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
const NAV_SEL = 'h1,h2,h3,h4,h5,h6,.ar-sentence,.ar-list-item,.ar-cell';
// Voice is stored per device class: the vault (and this settings file) syncs to
// iPhone/iPad via iCloud, and each device's system voices are a different list,
// so both ends keep their own choice without clobbering the other's. Kokoro is
// now offered on both, since the server answers on the tailnet rather than
// loopback. The server URL and token are shared — same server from anywhere.
const DEFAULTS = { desktopVoice: '', mobileVoice: '', rate: 1.0, ttsUrl: DEFAULT_TTS_URL, ttsToken: '' };

// ---------- sentence splitting (ported) ----------
function getSentenceBoundaries(text) {
  const abbr = /(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|e\.g|i\.e|a\.m|p\.m|Inc|Ltd|Corp|St|Ave|Blvd|Dept|Fig|Vol|No)\./gi;
  const cleaned = text.replace(abbr, (m) => 'X'.repeat(m.length));
  const boundaries = [0];
  const pattern = /([.!?])\s+(?=[A-Z])/g;
  let m;
  while ((m = pattern.exec(cleaned)) !== null) {
    let next = m.index + m[1].length + 1;
    while (next < text.length && /\s/.test(text[next])) next++;
    if (next < text.length) boundaries.push(next);
  }
  return boundaries;
}

function wrapSentences(p) {
  if (p.querySelector('.ar-sentence')) return;
  const fullText = p.textContent ?? '';
  if (!fullText.trim()) return;
  const boundaries = getSentenceBoundaries(fullText);
  if (!boundaries.length) return;

  const chunks = [];
  let cum = 0;
  for (const child of Array.from(p.childNodes)) {
    const t = child.textContent ?? '';
    chunks.push({ type: child.nodeType === Node.TEXT_NODE ? 'text' : 'element', text: t, node: child, start: cum });
    cum += t.length;
  }
  const spans = [];
  for (let i = 0; i < boundaries.length; i++) {
    const sStart = boundaries[i];
    const sEnd = i < boundaries.length - 1 ? boundaries[i + 1] : fullText.length;
    const span = document.createElement('span');
    span.className = 'ar-sentence ar-navigable';
    span.dataset.sentenceIndex = String(i);
    for (const chunk of chunks) {
      const cStart = chunk.start;
      const cEnd = cStart + chunk.text.length;
      if (cEnd <= sStart || cStart >= sEnd) continue;
      if (chunk.type === 'element') {
        if (cStart >= sStart && cEnd <= sEnd) span.appendChild(chunk.node.cloneNode(true));
        else {
          const overlap = Math.min(cEnd, sEnd) - Math.max(cStart, sStart);
          if (overlap > chunk.text.length / 2) span.appendChild(chunk.node.cloneNode(true));
        }
      } else {
        const sub = chunk.text.substring(Math.max(0, sStart - cStart), Math.min(chunk.text.length, sEnd - cStart));
        if (sub.length) span.appendChild(document.createTextNode(sub));
      }
    }
    if (span.textContent?.trim().length) spans.push(span);
  }
  p.innerHTML = '';
  spans.forEach((span, idx) => {
    p.appendChild(span);
    if (idx < spans.length - 1) p.appendChild(document.createTextNode(' '));
  });
}

function postProcess(container) {
  container.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => h.classList.add('ar-navigable'));
  container.querySelectorAll('p').forEach((p) => {
    const text = p.textContent?.trim() ?? '';
    if (!text.length) return;
    if (p.querySelector('img,iframe,video,audio') && text.length < 5) return; // embeds render, not spoken
    wrapSentences(p);
  });
  container.querySelectorAll('li').forEach((li) => {
    if (li.querySelector(':scope > p')) return;
    const children = Array.from(li.childNodes);
    const nested = children.filter((n) => n.nodeType === Node.ELEMENT_NODE && /^(UL|OL)$/.test(n.tagName));
    const inline = children.filter((n) => !nested.includes(n));
    if (!inline.some((n) => (n.textContent || '').trim())) return;
    const span = document.createElement('span');
    span.className = 'ar-list-item ar-navigable';
    inline.forEach((n) => span.appendChild(n));
    li.insertBefore(span, li.firstChild);
  });
  container.querySelectorAll('td, th').forEach((c) => {
    if (c.textContent.trim()) c.classList.add('ar-cell', 'ar-navigable');
  });
}

const stripFrontmatter = (s) => s.replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');

// ---------- the view ----------
class ArticleView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.file = null;
    this.navEls = [];
    this.curIdx = -1;
    this.focusedEl = null;
    this.mode = 'idle'; // idle | manual | continuous | paused
    this.kAudio = new Audio();
    this.kCache = new Map();
    this.audioUnlocked = false;
    this.selfWrite = false;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return this.file ? `Reader: ${this.file.basename}` : 'Article Reader'; }
  getIcon() { return 'audio-lines'; }

  async onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass('article-reader');
    this.toolbarEl = root.createDiv({ cls: 'ar-toolbar' });
    this.articleEl = root.createDiv({ cls: 'ar-article' });
    this.articleEl.tabIndex = 0;
    this.buildToolbar();
    this.registerDomEvent(this.articleEl, 'keydown', (e) => { this.unlockAudio(); this.onKey(e); });
    this.registerDomEvent(this.articleEl, 'click', (e) => {
      this.unlockAudio();
      if (e.target.closest('input, a, button')) return;
      const el = e.target.closest(NAV_SEL);
      if (el) { const i = this.navEls.indexOf(el); if (i >= 0) this.manualGo(i); }
    });
    // Follow the active note; re-render on external edits to the open one.
    this.registerEvent(this.app.workspace.on('file-open', (f) => {
      if (f && f.extension === 'md') this.setFile(f);
    }));
    this.registerEvent(this.app.vault.on('modify', (f) => {
      if (this.file && f.path === this.file.path) {
        if (this.selfWrite) { this.selfWrite = false; return; }
        this.render();
      }
    }));
    const f = this.app.workspace.getActiveFile();
    if (f && f.extension === 'md') await this.setFile(f);
  }

  async onClose() { this.stop(); }

  buildToolbar() {
    const tb = this.toolbarEl;
    tb.empty();
    const btn = (label, title, fn) => {
      const b = tb.createEl('button', { text: label, cls: 'ar-btn', attr: { title } });
      b.addEventListener('click', fn);
      return b;
    };
    btn('⏮', 'Previous block (↑)', () => this.moveBlock(-1));
    this.playBtn = btn('▶', 'Play / pause (Space)', () => this.playPause());
    btn('⏭', 'Next block (↓)', () => this.moveBlock(1));
    btn('⏹', 'Stop (Esc)', () => this.stop());
    this.posEl = tb.createSpan({ cls: 'ar-pos' });
    tb.createSpan({ cls: 'ar-hint', text: 'click a line · ↑↓ ←→ · Space read · 1–6/h headings · Enter highlight' });
  }

  async setFile(file) {
    this.file = file;
    await this.render();
  }

  async render() {
    this.stop();
    if (!this.file) return;
    const raw = await this.app.vault.cachedRead(this.file);
    this.articleEl.empty();
    await MarkdownRenderer.render(this.app, stripFrontmatter(raw), this.articleEl, this.file.path, this);
    postProcess(this.articleEl);
    this.navEls = [...this.articleEl.querySelectorAll(NAV_SEL)];
    this.curIdx = -1;
    this.focusedEl = null;
    this.kClearCache();
    this.kPrefetch(0);
    this.updateUI();
    this.leaf.updateHeader();
  }

  // ---------- speech engines ----------
  // Kokoro is available wherever the tailnet is, phone included.
  activeVoice() { return this.plugin.activeVoice(); }
  isKokoro() { return this.activeVoice().startsWith('kokoro:'); }

  // Play a silent clip inside the tap that started reading, so the later
  // programmatic play() — after a network round trip — isn't blocked on iOS.
  unlockAudio() {
    if (this.audioUnlocked) return;
    this.audioUnlocked = true;
    try {
      this.kAudio.src = SILENT_WAV;
      const p = this.kAudio.play();
      if (p) p.then(() => this.kAudio.pause()).catch(() => {});
    } catch { /* desktop never needed unlocking */ }
  }

  kFetch(text) {
    const voice = this.activeVoice().slice('kokoro:'.length);
    // m4a rather than the raw float32 WAV: ~96 KB per second of audio is fine
    // over loopback and miserable over a network. The server caches the encode.
    return this.plugin.ttsRequest('/speak?format=m4a', { text, voice }).then((r) => {
      if (r.status !== 200) throw new Error('tts ' + r.status);
      return URL.createObjectURL(new Blob([r.arrayBuffer], { type: 'audio/mp4' }));
    });
  }
  kUrlFor(idx) {
    const el = this.navEls[idx];
    if (!el) return Promise.resolve(null);
    if (!this.kCache.has(idx)) this.kCache.set(idx, this.kFetch(el.textContent.trim()).catch(() => null));
    return this.kCache.get(idx);
  }
  kPrefetch(idx) {
    if (!this.isKokoro()) return;
    for (let i = idx; i < Math.min(this.navEls.length, idx + K_LOOKAHEAD); i++) this.kUrlFor(i);
  }
  kEvictBefore(idx) {
    for (const [i, p] of this.kCache) {
      if (i < idx) { Promise.resolve(p).then((u) => u && URL.revokeObjectURL(u)); this.kCache.delete(i); }
    }
  }
  kClearCache() {
    for (const p of this.kCache.values()) Promise.resolve(p).then((u) => u && URL.revokeObjectURL(u));
    this.kCache.clear();
  }

  cancelSpeech() {
    window.speechSynthesis?.cancel();
    this.kAudio.pause();
    this.kAudio.onended = null;
    this.kAudio.removeAttribute('src');
  }

  afterSpeak(advance) {
    if (advance && this.mode === 'continuous') {
      if (this.curIdx < this.navEls.length - 1) { this.setFocus(this.curIdx + 1); this.speakCurrent(true); }
      else { this.mode = 'idle'; this.updateUI(); }
    } else if (this.mode === 'manual') {
      this.mode = 'idle';
      this.updateUI();
    }
  }

  speakCurrent(advance) {
    const el = this.navEls[this.curIdx];
    this.cancelSpeech(); // rapid arrows cancel the previous utterance immediately
    if (!el) { this.stop(); return; }
    this.updateUI();
    if (this.isKokoro()) this.speakKokoro(advance);
    else this.speakWeb(el.textContent.trim(), advance);
  }

  speakWeb(text, advance) {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = this.plugin.settings.rate;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find((x) => x.voiceURI === this.activeVoice()) || voices.find((x) => x.default);
    if (v) u.voice = v;
    u.onend = () => this.afterSpeak(advance);
    window.speechSynthesis.speak(u);
  }

  async speakKokoro(advance) {
    const idx = this.curIdx;
    this.kEvictBefore(idx);
    const urlP = this.kUrlFor(idx);
    this.kPrefetch(idx + 1);
    try {
      const url = await urlP;
      if (this.curIdx !== idx || this.mode === 'idle') return;
      if (!url) throw new Error('synthesis failed');
      this.kAudio.src = url;
      this.kAudio.playbackRate = this.plugin.settings.rate;
      this.kAudio.onended = () => this.afterSpeak(advance);
      await this.kAudio.play();
    } catch {
      // Kokoro unreachable (Mac mini asleep, app not running, off the tailnet,
      // bad token) → keep reading with the system voice instead of stopping.
      // One notice per session.
      if (!this.plugin.kokoroWarned) {
        this.plugin.kokoroWarned = true;
        new Notice('Kokoro on the Mac mini isn’t reachable — falling back to the system voice.');
      }
      const el = this.navEls[this.curIdx];
      if (el && this.mode !== 'idle') this.speakWeb(el.textContent.trim(), advance);
    }
  }

  // ---------- navigation ----------
  setFocus(i) {
    if (i < 0 || i >= this.navEls.length) return;
    if (this.focusedEl) this.focusedEl.classList.remove('ar-focused');
    this.curIdx = i;
    this.focusedEl = this.navEls[i];
    this.focusedEl.classList.add('ar-focused');
    this.focusedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.kPrefetch(i);
  }
  manualGo(i) {
    if (i < 0 || i >= this.navEls.length) return;
    this.setFocus(i);
    this.mode = 'manual';
    this.speakCurrent(false);
  }
  playPause() {
    if (this.mode === 'continuous') { this.isKokoro() ? this.kAudio.pause() : window.speechSynthesis.pause(); this.mode = 'paused'; }
    else if (this.mode === 'paused') { this.isKokoro() ? this.kAudio.play() : window.speechSynthesis.resume(); this.mode = 'continuous'; }
    else { this.setFocus(Math.max(0, this.curIdx)); this.mode = 'continuous'; this.speakCurrent(true); }
    this.updateUI();
  }
  stop() {
    this.cancelSpeech();
    this.mode = 'idle';
    if (this.focusedEl) this.focusedEl.classList.remove('ar-focused');
    this.updateUI();
  }

  isBlockStart(el) {
    return /^H[1-6]$/.test(el.tagName) ||
      el.classList.contains('ar-list-item') ||
      el.classList.contains('ar-cell') ||
      (el.classList.contains('ar-sentence') && el.dataset.sentenceIndex === '0');
  }
  moveBlock(step) {
    for (let i = this.curIdx + step; i >= 0 && i < this.navEls.length; i += step) {
      if (this.isBlockStart(this.navEls[i])) { this.manualGo(i); return; }
    }
  }
  moveSentence(step) {
    const cur = this.navEls[this.curIdx];
    if (!cur || !cur.classList.contains('ar-sentence')) { this.moveBlock(step); return; }
    const parent = cur.parentElement;
    for (let i = this.curIdx + step; i >= 0 && i < this.navEls.length; i += step) {
      const el = this.navEls[i];
      if (el.classList.contains('ar-sentence') && el.parentElement === parent) { this.manualGo(i); return; }
      if (el.parentElement !== parent) return;
    }
  }
  jumpHeading(level, reverse) {
    const step = reverse ? -1 : 1;
    for (let i = this.curIdx + step; i >= 0 && i < this.navEls.length; i += step) {
      const el = this.navEls[i];
      if (level ? el.tagName === 'H' + level : /^H[1-6]$/.test(el.tagName)) { this.manualGo(i); return; }
    }
  }

  // Enter → toggle ==highlight== on the focused unit, written back to the note.
  async toggleHighlight() {
    if (!this.focusedEl || !this.file) return;
    const text = this.focusedEl.textContent.trim();
    if (!text) return;
    this.selfWrite = true;
    let changed = false;
    await this.app.vault.process(this.file, (raw) => {
      const marked = `==${text}==`;
      if (raw.includes(marked)) { changed = true; return raw.replace(marked, text); }
      if (raw.includes(text)) { changed = true; return raw.replace(text, marked); }
      return raw;
    });
    if (!changed) { this.selfWrite = false; new Notice('Can’t highlight formatted text'); return; }
    const keep = this.curIdx;
    await this.render();
    if (keep >= 0 && keep < this.navEls.length) this.setFocus(keep);
  }

  onKey(e) {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const digit = e.code?.match(/^Digit([1-6])$/);
    if (digit) { e.preventDefault(); this.jumpHeading(+digit[1], e.shiftKey); return; }
    switch (e.key) {
      case ' ': e.preventDefault(); this.playPause(); break;
      case 'ArrowDown': e.preventDefault(); this.moveBlock(1); break;
      case 'ArrowUp': e.preventDefault(); this.moveBlock(-1); break;
      case 'ArrowRight': e.preventDefault(); this.moveSentence(1); break;
      case 'ArrowLeft': e.preventDefault(); this.moveSentence(-1); break;
      case 'h': e.preventDefault(); this.jumpHeading(0, false); break;
      case 'H': e.preventDefault(); this.jumpHeading(0, true); break;
      case 'Enter': e.preventDefault(); this.toggleHighlight(); break;
      case 'Escape': e.preventDefault(); this.stop(); break;
    }
  }

  updateUI() {
    if (!this.playBtn) return;
    const playing = this.mode === 'continuous';
    this.playBtn.setText(playing ? '⏸' : '▶');
    this.playBtn.classList.toggle('playing', playing);
    this.posEl.setText(this.navEls.length && this.curIdx >= 0 ? `${this.curIdx + 1} / ${this.navEls.length}` : '');
  }
}

// ---------- settings ----------
class ArticleReaderSettings extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }

  async display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Kokoro server')
      .setDesc('The Local TTS app on the Mac mini, over Tailscale. Use the MagicDNS name rather than 100.x.y.z — the mini’s tailnet address has changed before.')
      .addText((t) => t
        .setPlaceholder(DEFAULT_TTS_URL)
        .setValue(this.plugin.settings.ttsUrl)
        .onChange(async (val) => { this.plugin.settings.ttsUrl = val.trim(); await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Access token')
      .setDesc('TTS_TOKEN from the server’s ~/.config/chapterly-tts/env. Set it once here: these settings travel with the vault, so the phone and iPad pick it up on their own.')
      .addText((t) => {
        t.inputEl.type = 'password';
        t.setPlaceholder('required')
          .setValue(this.plugin.settings.ttsToken)
          .onChange(async (val) => { this.plugin.settings.ttsToken = val.trim(); await this.plugin.saveSettings(); });
      });

    // Ask the server what it has. This is also the connection test — a reachable
    // server means the whole path (tailnet, URL, token) works from this device.
    let kokoro = [];
    let status;
    try {
      const r = await this.plugin.ttsRequest('/voices');
      if (r.status === 200) {
        kokoro = r.json.filter((v) => v.language === 'en-us');
        status = `Connected · ${kokoro.length} English voices.`;
      } else if (r.status === 401) {
        status = 'Reached the server, but it rejected the token.';
      } else {
        status = `The server answered ${r.status}.`;
      }
    } catch {
      status = 'No answer. Check that this device is on the tailnet and the Local TTS app is running on the Mac mini.';
    }

    new Setting(containerEl)
      .setName('Connection')
      .setDesc(status)
      .addButton((b) => b.setButtonText('Test again').onClick(() => this.display()));

    // Voice for THIS device class: both ends can use Kokoro now, but their
    // system-voice lists differ, so each device remembers its own pick.
    const mobile = Platform.isMobileApp;
    const system = (window.speechSynthesis?.getVoices() || []).filter((v) => v.lang.replace('_', '-').startsWith('en-'));
    const key = mobile ? 'mobileVoice' : 'desktopVoice';

    new Setting(containerEl)
      .setName(mobile ? 'Voice (this phone or iPad)' : 'Voice (this Mac)')
      .setDesc(kokoro.length
        ? 'Kokoro voices are synthesized on the Mac mini. If it stops answering mid-article, reading carries on in the system voice.'
        : 'System voices only until the server above is reachable.')
      .addDropdown((dd) => {
        dd.addOption('', 'System default');
        for (const v of kokoro) dd.addOption('kokoro:' + v.id, `Kokoro · ${v.name} (grade ${v.grade})`);
        for (const v of system) dd.addOption(v.voiceURI, `System · ${v.name}`);
        dd.setValue(this.plugin.settings[key]);
        dd.onChange(async (val) => {
          this.plugin.settings[key] = val;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Speed')
      .setDesc('Reading rate (0.5–2×)')
      .addSlider((s) => s.setLimits(0.5, 2, 0.1).setValue(this.plugin.settings.rate).setDynamicTooltip()
        .onChange(async (val) => { this.plugin.settings.rate = val; await this.plugin.saveSettings(); }));
  }
}

// ---------- plugin ----------
module.exports = class ArticleReaderPlugin extends Plugin {
  async onload() {
    const data = (await this.loadData()) || {};
    // Migrate v0.1's single voiceURI to the per-device fields.
    if (data.voiceURI !== undefined && data.desktopVoice === undefined) {
      data.desktopVoice = data.voiceURI;
      delete data.voiceURI;
    }
    // A loopback URL only ever worked on the machine running Kokoro.
    if (/127\.0\.0\.1|localhost/.test(data.ttsUrl || '')) delete data.ttsUrl;
    this.settings = Object.assign({}, DEFAULTS, data);
    this.kokoroWarned = false;
    this.registerView(VIEW_TYPE, (leaf) => new ArticleView(leaf, this));
    this.addRibbonIcon('audio-lines', 'Open Article Reader', () => this.openReader());
    this.addCommand({ id: 'open-article-reader', name: 'Open reader for current note', callback: () => this.openReader() });
    this.addSettingTab(new ArticleReaderSettings(this.app, this));
  }

  async openReader() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    const leaf = existing.length ? existing[0] : this.app.workspace.getLeaf('split', 'vertical');
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
    const view = leaf.view;
    if (view instanceof ArticleView) {
      const f = this.app.workspace.getActiveFile();
      if (f && f.extension === 'md') await view.setFile(f);
      view.articleEl?.focus();
    }
  }

  activeVoice() {
    return (Platform.isMobileApp ? this.settings.mobileVoice : this.settings.desktopVoice) || '';
  }

  ttsBase() { return (this.settings.ttsUrl || DEFAULT_TTS_URL).replace(/\/+$/, ''); }

  // The one place that knows how to reach the Mac mini. requestUrl, not fetch:
  // it uses Obsidian's native networking, so a plain-HTTP tailnet call is exempt
  // from the webview's mixed-content and CORS rules — and the server's CORS
  // allow-list doesn't cover the Authorization header anyway.
  ttsRequest(path, body) {
    const headers = {};
    if (this.settings.ttsToken) headers.authorization = `Bearer ${this.settings.ttsToken}`;
    if (body) headers['content-type'] = 'application/json';
    return requestUrl({
      url: this.ttsBase() + path,
      method: body ? 'POST' : 'GET',
      headers,
      body: body ? JSON.stringify(body) : undefined,
      throw: false,
    });
  }

  async saveSettings() { await this.saveData(this.settings); }

  onunload() {}
};
