var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ArticleReaderPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// src/ArticleView.ts
var import_obsidian2 = require("obsidian");

// src/navigation.ts
var NavigationController = class {
  constructor(onFocusChange) {
    this.elements = [];
    this.currentIndex = -1;
    this.onFocusChange = onFocusChange;
  }
  /**
   * Rebuild the navigable element list from the rendered container.
   * Order: DOM order (top to bottom).
   * Navigable = headings, sentences (.ar-sentence), list items (.ar-list-item).
   */
  rebuild(container) {
    this.elements = Array.from(
      container.querySelectorAll(
        "h1, h2, h3, h4, h5, h6, .ar-sentence, .ar-list-item"
      )
    );
    this.currentIndex = -1;
  }
  get current() {
    var _a;
    return (_a = this.elements[this.currentIndex]) != null ? _a : null;
  }
  focusElement(el, speak) {
    const idx = this.elements.indexOf(el);
    if (idx >= 0) {
      this.currentIndex = idx;
      this.onFocusChange(el, speak);
    }
  }
  // ── Heading-level jump ──
  jumpToHeading(level, reverse) {
    const tag = `H${level}`;
    const start = this.currentIndex;
    if (reverse) {
      for (let i = start - 1; i >= 0; i--) {
        if (this.elements[i].tagName === tag) {
          this.currentIndex = i;
          this.onFocusChange(this.elements[i], true);
          return;
        }
      }
    } else {
      for (let i = start + 1; i < this.elements.length; i++) {
        if (this.elements[i].tagName === tag) {
          this.currentIndex = i;
          this.onFocusChange(this.elements[i], true);
          return;
        }
      }
    }
  }
  // ── Any-heading jump (H / Shift+H) ──
  jumpToAnyHeading(reverse) {
    const start = this.currentIndex;
    if (reverse) {
      for (let i = start - 1; i >= 0; i--) {
        if (/^H[1-6]$/.test(this.elements[i].tagName)) {
          this.currentIndex = i;
          this.onFocusChange(this.elements[i], true);
          return;
        }
      }
    } else {
      for (let i = start + 1; i < this.elements.length; i++) {
        if (/^H[1-6]$/.test(this.elements[i].tagName)) {
          this.currentIndex = i;
          this.onFocusChange(this.elements[i], true);
          return;
        }
      }
    }
  }
  // ── Highlighted element jump (n / Shift+N) ──
  jumpToHighlight(reverse) {
    const start = this.currentIndex;
    if (reverse) {
      for (let i = start - 1; i >= 0; i--) {
        if (this.elements[i].classList.contains("ar-highlighted")) {
          this.currentIndex = i;
          this.onFocusChange(this.elements[i], true);
          return;
        }
      }
    } else {
      for (let i = start + 1; i < this.elements.length; i++) {
        if (this.elements[i].classList.contains("ar-highlighted")) {
          this.currentIndex = i;
          this.onFocusChange(this.elements[i], true);
          return;
        }
      }
    }
  }
  // ── Block navigation (↑ / ↓) ──
  // Moves to the next/previous "block start":
  //   - Any heading
  //   - First sentence of a paragraph (data-sentence-index="0")
  //   - Any list item
  moveBlock(direction) {
    const step = direction === "down" ? 1 : -1;
    let i = this.currentIndex + step;
    while (i >= 0 && i < this.elements.length) {
      const el = this.elements[i];
      if (this.isBlockStart(el)) {
        this.currentIndex = i;
        this.onFocusChange(el, true);
        return;
      }
      i += step;
    }
  }
  isBlockStart(el) {
    if (/^H[1-6]$/.test(el.tagName))
      return true;
    if (el.classList.contains("ar-list-item"))
      return true;
    if (el.classList.contains("ar-sentence") && el.dataset.sentenceIndex === "0") {
      return true;
    }
    return false;
  }
  // ── Sentence navigation (← / →) ──
  // Moves to the next/previous sentence within the same parent paragraph.
  moveSentence(direction) {
    const current = this.current;
    if (!current || !current.classList.contains("ar-sentence")) {
      this.moveBlock(direction === "right" ? "down" : "up");
      return;
    }
    const parent = current.parentElement;
    if (!parent)
      return;
    const step = direction === "right" ? 1 : -1;
    let i = this.currentIndex + step;
    while (i >= 0 && i < this.elements.length) {
      const el = this.elements[i];
      if (el.classList.contains("ar-sentence") && el.parentElement === parent) {
        this.currentIndex = i;
        this.onFocusChange(el, true);
        return;
      }
      if (el.parentElement !== parent)
        return;
      i += step;
    }
  }
  // ── Highlight only (Enter key) ──
  highlightCurrent() {
    if (this.current) {
      this.onFocusChange(this.current, false);
    }
  }
};

// src/tts.ts
var import_obsidian = require("obsidian");
var WebSpeechEngine = class {
  constructor(rate = 1) {
    this.speaking = false;
    this.rate = rate;
  }
  setRate(rate) {
    this.rate = rate;
  }
  speak(text) {
    return new Promise((resolve) => {
      this.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.rate;
      utterance.onend = () => {
        this.speaking = false;
        resolve();
      };
      utterance.onerror = () => {
        this.speaking = false;
        resolve();
      };
      this.speaking = true;
      window.speechSynthesis.speak(utterance);
    });
  }
  cancel() {
    window.speechSynthesis.cancel();
    this.speaking = false;
  }
  isSpeaking() {
    return this.speaking;
  }
};
var ElevenLabsEngine = class {
  constructor(apiKey, voiceId = "21m00Tcm4TlvDq8ikWAM", rate = 1) {
    this.audioContext = null;
    this.sourceNode = null;
    this.speaking = false;
    this.apiKey = apiKey;
    this.voiceId = voiceId;
    this.rate = rate;
  }
  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }
  setVoiceId(voiceId) {
    this.voiceId = voiceId;
  }
  setRate(rate) {
    this.rate = rate;
  }
  async speak(text) {
    this.cancel();
    try {
      const response = await (0, import_obsidian.requestUrl)({
        url: `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`,
        method: "POST",
        headers: {
          "xi-api-key": this.apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg"
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      });
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }
      const audioBuffer = await this.audioContext.decodeAudioData(
        response.arrayBuffer.slice(0)
      );
      this.sourceNode = this.audioContext.createBufferSource();
      this.sourceNode.buffer = audioBuffer;
      this.sourceNode.playbackRate.value = this.rate;
      this.sourceNode.connect(this.audioContext.destination);
      this.speaking = true;
      this.sourceNode.onended = () => {
        this.speaking = false;
        this.sourceNode = null;
      };
      this.sourceNode.start();
    } catch (e) {
      console.error("ElevenLabs TTS error:", e);
      this.speaking = false;
    }
  }
  cancel() {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch (e) {
      }
      this.sourceNode = null;
    }
    this.speaking = false;
  }
  isSpeaking() {
    return this.speaking;
  }
};
function createTTSEngine(apiKey, voiceId, rate) {
  if (apiKey && apiKey.trim().length > 0) {
    return new ElevenLabsEngine(apiKey, voiceId || void 0, rate);
  }
  return new WebSpeechEngine(rate);
}

// src/ArticleView.ts
var ARTICLE_VIEW_TYPE = "article-reader";
var ArticleView = class extends import_obsidian2.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.file = null;
    this.contentEl_ = null;
    this.focusedEl = null;
    this.keyHandler = null;
    this.pendingFocusText = null;
    this.suppressRerender = false;
    this.plugin = plugin;
    this.tts = this.buildTTS();
    this.nav = new NavigationController(
      (el, speak) => this.handleFocusChange(el, speak)
    );
  }
  getViewType() {
    return ARTICLE_VIEW_TYPE;
  }
  getDisplayText() {
    return this.file ? `Article: ${this.file.basename}` : "Article Reader";
  }
  getIcon() {
    return "book-open";
  }
  // ── Lifecycle ──
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("ar-container");
    this.contentEl_ = container.createDiv({ cls: "ar-article" });
    this.keyHandler = (e) => this.onKeyDown(e);
    container.addEventListener("keydown", this.keyHandler);
    container.setAttribute("tabindex", "0");
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof import_obsidian2.TFile && file === this.file) {
          if (this.suppressRerender) {
            this.suppressRerender = false;
            return;
          }
          this.renderArticle();
        }
      })
    );
  }
  async onClose() {
    this.tts.cancel();
    if (this.keyHandler) {
      const container = this.containerEl.children[1];
      container.removeEventListener("keydown", this.keyHandler);
    }
  }
  // ── Public API ──
  async setFile(file) {
    this.file = file;
    await this.renderArticle();
  }
  rebuildTTS() {
    this.tts.cancel();
    this.tts = this.buildTTS();
  }
  buildTTS() {
    const s = this.plugin.settings;
    return createTTSEngine(s.elevenLabsApiKey, s.elevenLabsVoiceId, s.speechRate);
  }
  // ── Render ──
  async renderArticle() {
    if (!this.contentEl_ || !this.file)
      return;
    const content = await this.app.vault.cachedRead(this.file);
    this.contentEl_.empty();
    const s = this.plugin.settings;
    this.contentEl_.style.fontSize = `${s.fontSize}px`;
    this.contentEl_.style.lineHeight = `${s.lineHeight}`;
    await import_obsidian2.MarkdownRenderer.render(
      this.app,
      content,
      this.contentEl_,
      this.file.path,
      this
    );
    this.postProcess(this.contentEl_);
    this.nav.rebuild(this.contentEl_);
    this.contentEl_.addEventListener("click", (e) => {
      const target = e.target;
      const navEl = target.closest(
        "h1, h2, h3, h4, h5, h6, .ar-sentence, .ar-list-item"
      );
      if (navEl) {
        this.nav.focusElement(navEl, true);
      }
    });
    const container = this.containerEl.children[1];
    container.focus();
  }
  // ── Post-processing ──
  postProcess(container) {
    container.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((h) => {
      const level = h.tagName.charAt(1);
      h.dataset.headingLevel = level;
      h.classList.add("ar-navigable");
    });
    container.querySelectorAll("p").forEach((p) => {
      if (this.isNonTextBlock(p))
        return;
      this.wrapSentences(p);
    });
    container.querySelectorAll("mark").forEach((mark) => {
      const parent = mark.closest(
        ".ar-sentence, .ar-list-item, h1, h2, h3, h4, h5, h6"
      );
      if (parent) {
        parent.classList.add("ar-highlighted");
      }
    });
    container.querySelectorAll("li").forEach((li) => {
      var _a;
      const textContent = this.getDirectText(li);
      if (textContent.trim().length === 0)
        return;
      const span = document.createElement("span");
      span.className = "ar-list-item ar-navigable";
      span.textContent = textContent;
      const childNodes = Array.from(li.childNodes);
      let inserted = false;
      for (const node of childNodes) {
        if (node.nodeType === Node.TEXT_NODE && ((_a = node.textContent) == null ? void 0 : _a.trim())) {
          if (!inserted) {
            li.replaceChild(span, node);
            inserted = true;
          } else {
            span.textContent += " " + node.textContent.trim();
            li.removeChild(node);
          }
        }
      }
    });
  }
  isNonTextBlock(p) {
    var _a, _b;
    const text = (_b = (_a = p.textContent) == null ? void 0 : _a.trim()) != null ? _b : "";
    if (text.length === 0)
      return true;
    if (p.querySelector("img, iframe, video, audio, .internal-embed")) {
      if (text.length < 5)
        return true;
    }
    return false;
  }
  wrapSentences(p) {
    var _a, _b, _c;
    if (p.innerHTML.includes("ar-sentence"))
      return;
    const fullText = (_a = p.textContent) != null ? _a : "";
    if (fullText.trim().length === 0)
      return;
    const boundaries = this.getSentenceBoundaries(fullText);
    if (boundaries.length === 0)
      return;
    const chunks = [];
    let cumOffset = 0;
    for (const child of Array.from(p.childNodes)) {
      const t = (_b = child.textContent) != null ? _b : "";
      chunks.push({
        type: child.nodeType === Node.TEXT_NODE ? "text" : "element",
        text: t,
        node: child,
        startOffset: cumOffset
      });
      cumOffset += t.length;
    }
    const sentenceSpans = [];
    for (let i = 0; i < boundaries.length; i++) {
      const sStart = boundaries[i];
      const sEnd = i < boundaries.length - 1 ? boundaries[i + 1] : fullText.length;
      const span = document.createElement("span");
      span.className = "ar-sentence ar-navigable";
      span.dataset.sentenceIndex = String(i);
      for (const chunk of chunks) {
        const cStart = chunk.startOffset;
        const cEnd = cStart + chunk.text.length;
        if (cEnd <= sStart || cStart >= sEnd)
          continue;
        if (chunk.type === "element") {
          if (cStart >= sStart && cEnd <= sEnd) {
            span.appendChild(chunk.node.cloneNode(true));
          } else {
            const overlap = Math.min(cEnd, sEnd) - Math.max(cStart, sStart);
            if (overlap > chunk.text.length / 2) {
              span.appendChild(chunk.node.cloneNode(true));
            }
          }
        } else {
          const localStart = Math.max(0, sStart - cStart);
          const localEnd = Math.min(chunk.text.length, sEnd - cStart);
          const substring = chunk.text.substring(localStart, localEnd);
          if (substring.length > 0) {
            span.appendChild(document.createTextNode(substring));
          }
        }
      }
      if ((_c = span.textContent) == null ? void 0 : _c.trim().length) {
        sentenceSpans.push(span);
      }
    }
    p.innerHTML = "";
    sentenceSpans.forEach((span, idx) => {
      p.appendChild(span);
      if (idx < sentenceSpans.length - 1) {
        p.appendChild(document.createTextNode(" "));
      }
    });
  }
  /**
   * Returns character offsets where each sentence starts.
   * Always includes 0 (start of first sentence).
   */
  getSentenceBoundaries(text) {
    const abbr = /(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|e\.g|i\.e|a\.m|p\.m|Inc|Ltd|Corp|St|Ave|Blvd|Dept|Fig|Vol|No)\./gi;
    const placeholders = [];
    const cleaned = text.replace(abbr, (match, offset) => {
      placeholders.push({ start: offset, end: offset + match.length });
      return "X".repeat(match.length);
    });
    const boundaries = [0];
    const splitPattern = /([.!?])\s+(?=[A-Z])/g;
    let m;
    while ((m = splitPattern.exec(cleaned)) !== null) {
      const pos = m.index + m[1].length + 1;
      let nextStart = pos;
      while (nextStart < text.length && /\s/.test(text[nextStart])) {
        nextStart++;
      }
      if (nextStart < text.length) {
        boundaries.push(nextStart);
      }
    }
    return boundaries;
  }
  /**
   * Build a map: cumulative character offset → text node.
   */
  mapCharPositions(textNodes) {
    var _a, _b;
    const positions = [];
    let cum = 0;
    for (const tn of textNodes) {
      const len = (_b = (_a = tn.textContent) == null ? void 0 : _a.length) != null ? _b : 0;
      positions.push({ cumOffset: cum, node: tn, length: len });
      cum += len;
    }
    return positions;
  }
  /**
   * Find which text node + local offset corresponds to a global char offset.
   */
  findPosition(positions, charOffset) {
    for (let i = positions.length - 1; i >= 0; i--) {
      const p = positions[i];
      if (charOffset >= p.cumOffset) {
        const localOffset = Math.min(charOffset - p.cumOffset, p.length);
        return { node: p.node, offset: localOffset };
      }
    }
    return positions.length > 0 ? { node: positions[0].node, offset: 0 } : null;
  }
  getDirectText(el) {
    let text = "";
    el.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      }
    });
    return text.trim();
  }
  // ── Text cleanup ──
  stripEmojis(text) {
    return text.replace(/[\u{1F600}-\u{1F64F}]/gu, "").replace(/[\u{1F300}-\u{1F5FF}]/gu, "").replace(/[\u{1F680}-\u{1F6FF}]/gu, "").replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "").replace(/[\u{2600}-\u{26FF}]/gu, "").replace(/[\u{2700}-\u{27BF}]/gu, "").replace(/[\u{FE00}-\u{FE0F}]/gu, "").replace(/[\u{200D}]/gu, "").replace(/[\u{1F900}-\u{1F9FF}]/gu, "").replace(/[\u{1FA00}-\u{1FA6F}]/gu, "").replace(/[\u{1FA70}-\u{1FAFF}]/gu, "").replace(/[\u{231A}-\u{23F3}]/gu, "").replace(/[\u{2B50}]/gu, "").replace(/\s{2,}/g, " ").trim();
  }
  // ── Focus & TTS ──
  handleFocusChange(el, speak) {
    var _a, _b;
    if (this.focusedEl) {
      this.focusedEl.classList.remove("ar-focused");
    }
    if (!el) {
      this.focusedEl = null;
      return;
    }
    this.focusedEl = el;
    el.classList.add("ar-focused");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    this.syncEditorScroll(el);
    if (speak) {
      const text = this.stripEmojis((_b = (_a = el.textContent) == null ? void 0 : _a.trim()) != null ? _b : "");
      if (text.length > 0) {
        this.tts.cancel();
        this.tts.speak(text);
      }
    }
  }
  // ── Editor scroll sync ──
  syncEditorScroll(el) {
    var _a, _b;
    if (!this.file)
      return;
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    const editorLeaf = leaves.find((leaf) => {
      var _a2, _b2;
      const view = leaf.view;
      return ((_a2 = view.file) == null ? void 0 : _a2.path) === ((_b2 = this.file) == null ? void 0 : _b2.path);
    });
    if (!editorLeaf)
      return;
    const editorView = editorLeaf.view;
    const editor = editorView.editor;
    if (!editor)
      return;
    const searchText = (_b = (_a = el.textContent) == null ? void 0 : _a.trim()) != null ? _b : "";
    if (searchText.length === 0)
      return;
    const totalLines = editor.lineCount();
    for (let i = 0; i < totalLines; i++) {
      const line = editor.getLine(i);
      if (line.includes(searchText) || line.includes(`==${searchText}==`)) {
        editor.setCursor({ line: i, ch: 0 });
        editor.scrollIntoView(
          { from: { line: i, ch: 0 }, to: { line: i, ch: 0 } },
          true
        );
        break;
      }
    }
  }
  // ── Keyboard ──
  onKeyDown(e) {
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA")
      return;
    const digitMatch = e.code.match(/^Digit([1-6])$/);
    if (digitMatch) {
      e.preventDefault();
      const level = parseInt(digitMatch[1]);
      this.nav.jumpToHeading(level, e.shiftKey);
      return;
    }
    switch (e.key) {
      case "h":
        e.preventDefault();
        this.tts.cancel();
        this.nav.jumpToAnyHeading(false);
        break;
      case "H":
        e.preventDefault();
        this.tts.cancel();
        this.nav.jumpToAnyHeading(true);
        break;
      case "n":
        e.preventDefault();
        this.tts.cancel();
        this.nav.jumpToHighlight(false);
        break;
      case "N":
        e.preventDefault();
        this.tts.cancel();
        this.nav.jumpToHighlight(true);
        break;
      case "ArrowDown":
        e.preventDefault();
        this.tts.cancel();
        this.nav.moveBlock("down");
        break;
      case "ArrowUp":
        e.preventDefault();
        this.tts.cancel();
        this.nav.moveBlock("up");
        break;
      case "ArrowRight":
        e.preventDefault();
        this.tts.cancel();
        this.nav.moveSentence("right");
        break;
      case "ArrowLeft":
        e.preventDefault();
        this.tts.cancel();
        this.nav.moveSentence("left");
        break;
      case "Enter":
        e.preventDefault();
        this.toggleHighlightInFile();
        break;
      case "Escape":
        e.preventDefault();
        this.tts.cancel();
        break;
    }
  }
  // ── Highlight persistence (==text== in source markdown) ──
  async toggleHighlightInFile() {
    var _a;
    const el = this.nav.current;
    if (!el || !this.file)
      return;
    const text = (_a = el.textContent) == null ? void 0 : _a.trim();
    if (!text || text.length === 0)
      return;
    const fileContent = await this.app.vault.read(this.file);
    const highlighted = `==${text}==`;
    let newContent;
    if (fileContent.includes(highlighted)) {
      newContent = fileContent.replace(highlighted, text);
      el.classList.remove("ar-highlighted");
    } else if (fileContent.includes(text)) {
      newContent = fileContent.replace(text, highlighted);
      el.classList.add("ar-highlighted");
    } else {
      return;
    }
    this.suppressRerender = true;
    await this.app.vault.modify(this.file, newContent);
  }
};

// src/settings.ts
var import_obsidian3 = require("obsidian");
var DEFAULT_SETTINGS = {
  elevenLabsApiKey: "",
  elevenLabsVoiceId: "21m00Tcm4TlvDq8ikWAM",
  // Rachel
  speechRate: 1,
  fontSize: 18,
  lineHeight: 1.8
};
var ArticleReaderSettingTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Article Reader Settings" });
    containerEl.createEl("h3", { text: "Text-to-Speech" });
    new import_obsidian3.Setting(containerEl).setName("Speech rate").setDesc("Playback speed (0.5x \u2013 2.0x)").addSlider(
      (slider) => slider.setLimits(0.5, 2, 0.1).setValue(this.plugin.settings.speechRate).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.speechRate = value;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "ElevenLabs (optional)" });
    containerEl.createEl("p", {
      text: "Leave the API key empty to use the built-in Web Speech engine.",
      cls: "setting-item-description"
    });
    new import_obsidian3.Setting(containerEl).setName("API key").setDesc("Your ElevenLabs API key").addText(
      (text) => text.setPlaceholder("Enter API key...").setValue(this.plugin.settings.elevenLabsApiKey).then((t) => t.inputEl.type = "password").onChange(async (value) => {
        this.plugin.settings.elevenLabsApiKey = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Voice ID").setDesc("ElevenLabs voice ID (default: Rachel)").addText(
      (text) => text.setPlaceholder("21m00Tcm4TlvDq8ikWAM").setValue(this.plugin.settings.elevenLabsVoiceId).onChange(async (value) => {
        this.plugin.settings.elevenLabsVoiceId = value;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "Display" });
    new import_obsidian3.Setting(containerEl).setName("Font size").setDesc("Article text size in pixels").addSlider(
      (slider) => slider.setLimits(12, 28, 1).setValue(this.plugin.settings.fontSize).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.fontSize = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Line height").setDesc("Line spacing multiplier").addSlider(
      (slider) => slider.setLimits(1.2, 2.4, 0.1).setValue(this.plugin.settings.lineHeight).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.lineHeight = value;
        await this.plugin.saveSettings();
      })
    );
  }
};

// main.ts
var ArticleReaderPlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    this.registerView(ARTICLE_VIEW_TYPE, (leaf) => new ArticleView(leaf, this));
    this.addRibbonIcon("book-open", "Toggle Article Reader", () => {
      this.toggleArticleView();
    });
    this.addCommand({
      id: "toggle-article-reader",
      name: "Toggle Article Reader",
      callback: () => this.toggleArticleView()
    });
    this.addSettingTab(new ArticleReaderSettingTab(this.app, this));
  }
  onunload() {
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.app.workspace.getLeavesOfType(ARTICLE_VIEW_TYPE).forEach((leaf) => {
      leaf.view.rebuildTTS();
    });
  }
  async toggleArticleView() {
    const existing = this.app.workspace.getLeavesOfType(ARTICLE_VIEW_TYPE);
    if (existing.length > 0) {
      existing.forEach((leaf2) => leaf2.detach());
      return;
    }
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile)
      return;
    const leaf = this.app.workspace.getLeaf("split", "vertical");
    await leaf.setViewState({
      type: ARTICLE_VIEW_TYPE,
      active: true
    });
    const view = leaf.view;
    await view.setFile(activeFile);
    this.app.workspace.revealLeaf(leaf);
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyIsICJzcmMvQXJ0aWNsZVZpZXcudHMiLCAic3JjL25hdmlnYXRpb24udHMiLCAic3JjL3R0cy50cyIsICJzcmMvc2V0dGluZ3MudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IFBsdWdpbiwgV29ya3NwYWNlTGVhZiwgVEZpbGUgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IEFydGljbGVWaWV3LCBBUlRJQ0xFX1ZJRVdfVFlQRSB9IGZyb20gXCIuL3NyYy9BcnRpY2xlVmlld1wiO1xuaW1wb3J0IHtcblx0QXJ0aWNsZVJlYWRlclNldHRpbmdzLFxuXHRBcnRpY2xlUmVhZGVyU2V0dGluZ1RhYixcblx0REVGQVVMVF9TRVRUSU5HUyxcbn0gZnJvbSBcIi4vc3JjL3NldHRpbmdzXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEFydGljbGVSZWFkZXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuXHRzZXR0aW5nczogQXJ0aWNsZVJlYWRlclNldHRpbmdzID0gREVGQVVMVF9TRVRUSU5HUztcblxuXHRhc3luYyBvbmxvYWQoKSB7XG5cdFx0YXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcblxuXHRcdC8vIFJlZ2lzdGVyIHRoZSBjdXN0b20gdmlld1xuXHRcdHRoaXMucmVnaXN0ZXJWaWV3KEFSVElDTEVfVklFV19UWVBFLCAobGVhZikgPT4gbmV3IEFydGljbGVWaWV3KGxlYWYsIHRoaXMpKTtcblxuXHRcdC8vIFJpYmJvbiBpY29uXG5cdFx0dGhpcy5hZGRSaWJib25JY29uKFwiYm9vay1vcGVuXCIsIFwiVG9nZ2xlIEFydGljbGUgUmVhZGVyXCIsICgpID0+IHtcblx0XHRcdHRoaXMudG9nZ2xlQXJ0aWNsZVZpZXcoKTtcblx0XHR9KTtcblxuXHRcdC8vIENvbW1hbmRcblx0XHR0aGlzLmFkZENvbW1hbmQoe1xuXHRcdFx0aWQ6IFwidG9nZ2xlLWFydGljbGUtcmVhZGVyXCIsXG5cdFx0XHRuYW1lOiBcIlRvZ2dsZSBBcnRpY2xlIFJlYWRlclwiLFxuXHRcdFx0Y2FsbGJhY2s6ICgpID0+IHRoaXMudG9nZ2xlQXJ0aWNsZVZpZXcoKSxcblx0XHR9KTtcblxuXHRcdC8vIFNldHRpbmdzIHRhYlxuXHRcdHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgQXJ0aWNsZVJlYWRlclNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblx0fVxuXG5cdG9udW5sb2FkKCkge1xuXHRcdC8vIE9ic2lkaWFuIGRldGFjaGVzIHZpZXdzIGF1dG9tYXRpY2FsbHlcblx0fVxuXG5cdGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcblx0XHR0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcblx0fVxuXG5cdGFzeW5jIHNhdmVTZXR0aW5ncygpIHtcblx0XHRhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuXHRcdC8vIFVwZGF0ZSBUVFMgZW5naW5lIGluIGFueSBvcGVuIGFydGljbGUgdmlld3Ncblx0XHR0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKEFSVElDTEVfVklFV19UWVBFKS5mb3JFYWNoKChsZWFmKSA9PiB7XG5cdFx0XHQobGVhZi52aWV3IGFzIEFydGljbGVWaWV3KS5yZWJ1aWxkVFRTKCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHRvZ2dsZUFydGljbGVWaWV3KCkge1xuXHRcdC8vIElmIGFuIGFydGljbGUgcmVhZGVyIHZpZXcgZXhpc3RzLCBjbG9zZSBpdCBhbmQgZ28gYmFjayB0byB0aGUgbm90ZVxuXHRcdGNvbnN0IGV4aXN0aW5nID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShBUlRJQ0xFX1ZJRVdfVFlQRSk7XG5cdFx0aWYgKGV4aXN0aW5nLmxlbmd0aCA+IDApIHtcblx0XHRcdGV4aXN0aW5nLmZvckVhY2goKGxlYWYpID0+IGxlYWYuZGV0YWNoKCkpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIE90aGVyd2lzZSwgb3BlbiBhcnRpY2xlIHJlYWRlclxuXHRcdGNvbnN0IGFjdGl2ZUZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuXHRcdGlmICghYWN0aXZlRmlsZSkgcmV0dXJuO1xuXG5cdFx0Y29uc3QgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKFwic3BsaXRcIiwgXCJ2ZXJ0aWNhbFwiKTtcblxuXHRcdGF3YWl0IGxlYWYuc2V0Vmlld1N0YXRlKHtcblx0XHRcdHR5cGU6IEFSVElDTEVfVklFV19UWVBFLFxuXHRcdFx0YWN0aXZlOiB0cnVlLFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdmlldyA9IGxlYWYudmlldyBhcyBBcnRpY2xlVmlldztcblx0XHRhd2FpdCB2aWV3LnNldEZpbGUoYWN0aXZlRmlsZSk7XG5cblx0XHR0aGlzLmFwcC53b3Jrc3BhY2UucmV2ZWFsTGVhZihsZWFmKTtcblx0fVxufVxuIiwgImltcG9ydCB7XG5cdEl0ZW1WaWV3LFxuXHRNYXJrZG93blZpZXcsXG5cdFdvcmtzcGFjZUxlYWYsXG5cdE1hcmtkb3duUmVuZGVyZXIsXG5cdFRGaWxlLFxufSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIEFydGljbGVSZWFkZXJQbHVnaW4gZnJvbSBcIi4uL21haW5cIjtcbmltcG9ydCB7IE5hdmlnYXRpb25Db250cm9sbGVyIH0gZnJvbSBcIi4vbmF2aWdhdGlvblwiO1xuaW1wb3J0IHsgY3JlYXRlVFRTRW5naW5lLCBUVFNFbmdpbmUgfSBmcm9tIFwiLi90dHNcIjtcblxuZXhwb3J0IGNvbnN0IEFSVElDTEVfVklFV19UWVBFID0gXCJhcnRpY2xlLXJlYWRlclwiO1xuXG5leHBvcnQgY2xhc3MgQXJ0aWNsZVZpZXcgZXh0ZW5kcyBJdGVtVmlldyB7XG5cdHBsdWdpbjogQXJ0aWNsZVJlYWRlclBsdWdpbjtcblx0cHJpdmF0ZSBmaWxlOiBURmlsZSB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGNvbnRlbnRFbF86IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgbmF2OiBOYXZpZ2F0aW9uQ29udHJvbGxlcjtcblx0cHJpdmF0ZSB0dHM6IFRUU0VuZ2luZTtcblx0cHJpdmF0ZSBmb2N1c2VkRWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUga2V5SGFuZGxlcjogKChlOiBLZXlib2FyZEV2ZW50KSA9PiB2b2lkKSB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHBlbmRpbmdGb2N1c1RleHQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHN1cHByZXNzUmVyZW5kZXIgPSBmYWxzZTtcblxuXHRjb25zdHJ1Y3RvcihsZWFmOiBXb3Jrc3BhY2VMZWFmLCBwbHVnaW46IEFydGljbGVSZWFkZXJQbHVnaW4pIHtcblx0XHRzdXBlcihsZWFmKTtcblx0XHR0aGlzLnBsdWdpbiA9IHBsdWdpbjtcblx0XHR0aGlzLnR0cyA9IHRoaXMuYnVpbGRUVFMoKTtcblx0XHR0aGlzLm5hdiA9IG5ldyBOYXZpZ2F0aW9uQ29udHJvbGxlcigoZWwsIHNwZWFrKSA9PlxuXHRcdFx0dGhpcy5oYW5kbGVGb2N1c0NoYW5nZShlbCwgc3BlYWspXG5cdFx0KTtcblx0fVxuXG5cdGdldFZpZXdUeXBlKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIEFSVElDTEVfVklFV19UWVBFO1xuXHR9XG5cblx0Z2V0RGlzcGxheVRleHQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5maWxlID8gYEFydGljbGU6ICR7dGhpcy5maWxlLmJhc2VuYW1lfWAgOiBcIkFydGljbGUgUmVhZGVyXCI7XG5cdH1cblxuXHRnZXRJY29uKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIFwiYm9vay1vcGVuXCI7XG5cdH1cblxuXHQvLyBcdTI1MDBcdTI1MDAgTGlmZWN5Y2xlIFx1MjUwMFx1MjUwMFxuXG5cdGFzeW5jIG9uT3BlbigpIHtcblx0XHRjb25zdCBjb250YWluZXIgPSB0aGlzLmNvbnRhaW5lckVsLmNoaWxkcmVuWzFdIGFzIEhUTUxFbGVtZW50O1xuXHRcdGNvbnRhaW5lci5lbXB0eSgpO1xuXHRcdGNvbnRhaW5lci5hZGRDbGFzcyhcImFyLWNvbnRhaW5lclwiKTtcblxuXHRcdHRoaXMuY29udGVudEVsXyA9IGNvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6IFwiYXItYXJ0aWNsZVwiIH0pO1xuXG5cdFx0Ly8gS2V5IGhhbmRsZXJcblx0XHR0aGlzLmtleUhhbmRsZXIgPSAoZTogS2V5Ym9hcmRFdmVudCkgPT4gdGhpcy5vbktleURvd24oZSk7XG5cdFx0Y29udGFpbmVyLmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIHRoaXMua2V5SGFuZGxlcik7XG5cdFx0Y29udGFpbmVyLnNldEF0dHJpYnV0ZShcInRhYmluZGV4XCIsIFwiMFwiKTtcblxuXHRcdC8vIExpc3RlbiBmb3IgZmlsZSBjaGFuZ2VzXG5cdFx0dGhpcy5yZWdpc3RlckV2ZW50KFxuXHRcdFx0dGhpcy5hcHAudmF1bHQub24oXCJtb2RpZnlcIiwgKGZpbGUpID0+IHtcblx0XHRcdFx0aWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSAmJiBmaWxlID09PSB0aGlzLmZpbGUpIHtcblx0XHRcdFx0XHRpZiAodGhpcy5zdXBwcmVzc1JlcmVuZGVyKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnN1cHByZXNzUmVyZW5kZXIgPSBmYWxzZTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhpcy5yZW5kZXJBcnRpY2xlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0KTtcblx0fVxuXG5cdGFzeW5jIG9uQ2xvc2UoKSB7XG5cdFx0dGhpcy50dHMuY2FuY2VsKCk7XG5cdFx0aWYgKHRoaXMua2V5SGFuZGxlcikge1xuXHRcdFx0Y29uc3QgY29udGFpbmVyID0gdGhpcy5jb250YWluZXJFbC5jaGlsZHJlblsxXSBhcyBIVE1MRWxlbWVudDtcblx0XHRcdGNvbnRhaW5lci5yZW1vdmVFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCB0aGlzLmtleUhhbmRsZXIpO1xuXHRcdH1cblx0fVxuXG5cdC8vIFx1MjUwMFx1MjUwMCBQdWJsaWMgQVBJIFx1MjUwMFx1MjUwMFxuXG5cdGFzeW5jIHNldEZpbGUoZmlsZTogVEZpbGUpIHtcblx0XHR0aGlzLmZpbGUgPSBmaWxlO1xuXHRcdGF3YWl0IHRoaXMucmVuZGVyQXJ0aWNsZSgpO1xuXHR9XG5cblx0cmVidWlsZFRUUygpIHtcblx0XHR0aGlzLnR0cy5jYW5jZWwoKTtcblx0XHR0aGlzLnR0cyA9IHRoaXMuYnVpbGRUVFMoKTtcblx0fVxuXG5cdHByaXZhdGUgYnVpbGRUVFMoKTogVFRTRW5naW5lIHtcblx0XHRjb25zdCBzID0gdGhpcy5wbHVnaW4uc2V0dGluZ3M7XG5cdFx0cmV0dXJuIGNyZWF0ZVRUU0VuZ2luZShzLmVsZXZlbkxhYnNBcGlLZXksIHMuZWxldmVuTGFic1ZvaWNlSWQsIHMuc3BlZWNoUmF0ZSk7XG5cdH1cblxuXHQvLyBcdTI1MDBcdTI1MDAgUmVuZGVyIFx1MjUwMFx1MjUwMFxuXG5cdHByaXZhdGUgYXN5bmMgcmVuZGVyQXJ0aWNsZSgpIHtcblx0XHRpZiAoIXRoaXMuY29udGVudEVsXyB8fCAhdGhpcy5maWxlKSByZXR1cm47XG5cblx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY2FjaGVkUmVhZCh0aGlzLmZpbGUpO1xuXHRcdHRoaXMuY29udGVudEVsXy5lbXB0eSgpO1xuXG5cdFx0Ly8gQXBwbHkgZGlzcGxheSBzZXR0aW5nc1xuXHRcdGNvbnN0IHMgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncztcblx0XHR0aGlzLmNvbnRlbnRFbF8uc3R5bGUuZm9udFNpemUgPSBgJHtzLmZvbnRTaXplfXB4YDtcblx0XHR0aGlzLmNvbnRlbnRFbF8uc3R5bGUubGluZUhlaWdodCA9IGAke3MubGluZUhlaWdodH1gO1xuXG5cdFx0Ly8gUmVuZGVyIG1hcmtkb3duIFx1MjE5MiBIVE1MIHVzaW5nIE9ic2lkaWFuJ3MgcmVuZGVyZXJcblx0XHRhd2FpdCBNYXJrZG93blJlbmRlcmVyLnJlbmRlcihcblx0XHRcdHRoaXMuYXBwLFxuXHRcdFx0Y29udGVudCxcblx0XHRcdHRoaXMuY29udGVudEVsXyxcblx0XHRcdHRoaXMuZmlsZS5wYXRoLFxuXHRcdFx0dGhpc1xuXHRcdCk7XG5cblx0XHQvLyBQb3N0LXByb2Nlc3M6IHdyYXAgc2VudGVuY2VzLCBhbm5vdGF0ZSBoZWFkaW5ncywgd3JhcCBsaXN0IGl0ZW1zXG5cdFx0dGhpcy5wb3N0UHJvY2Vzcyh0aGlzLmNvbnRlbnRFbF8pO1xuXG5cdFx0Ly8gUmVidWlsZCBuYXZpZ2F0aW9uIGluZGV4XG5cdFx0dGhpcy5uYXYucmVidWlsZCh0aGlzLmNvbnRlbnRFbF8pO1xuXG5cdFx0Ly8gQ2xpY2sgaGFuZGxlciBvbiB0aGUgYXJ0aWNsZVxuXHRcdHRoaXMuY29udGVudEVsXy5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcblx0XHRcdGNvbnN0IHRhcmdldCA9IGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50O1xuXHRcdFx0Y29uc3QgbmF2RWwgPSB0YXJnZXQuY2xvc2VzdDxIVE1MRWxlbWVudD4oXG5cdFx0XHRcdFwiaDEsIGgyLCBoMywgaDQsIGg1LCBoNiwgLmFyLXNlbnRlbmNlLCAuYXItbGlzdC1pdGVtXCJcblx0XHRcdCk7XG5cdFx0XHRpZiAobmF2RWwpIHtcblx0XHRcdFx0dGhpcy5uYXYuZm9jdXNFbGVtZW50KG5hdkVsLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdC8vIEZvY3VzIHRoZSBjb250YWluZXIgZm9yIGtleWJvYXJkIGV2ZW50c1xuXHRcdGNvbnN0IGNvbnRhaW5lciA9IHRoaXMuY29udGFpbmVyRWwuY2hpbGRyZW5bMV0gYXMgSFRNTEVsZW1lbnQ7XG5cdFx0Y29udGFpbmVyLmZvY3VzKCk7XG5cdH1cblxuXHQvLyBcdTI1MDBcdTI1MDAgUG9zdC1wcm9jZXNzaW5nIFx1MjUwMFx1MjUwMFxuXG5cdHByaXZhdGUgcG9zdFByb2Nlc3MoY29udGFpbmVyOiBIVE1MRWxlbWVudCkge1xuXHRcdC8vIDEuIEFubm90YXRlIGhlYWRpbmdzIHdpdGggZGF0YSBhdHRyaWJ1dGVcblx0XHRjb250YWluZXIucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXCJoMSwgaDIsIGgzLCBoNCwgaDUsIGg2XCIpLmZvckVhY2goKGgpID0+IHtcblx0XHRcdGNvbnN0IGxldmVsID0gaC50YWdOYW1lLmNoYXJBdCgxKTtcblx0XHRcdGguZGF0YXNldC5oZWFkaW5nTGV2ZWwgPSBsZXZlbDtcblx0XHRcdGguY2xhc3NMaXN0LmFkZChcImFyLW5hdmlnYWJsZVwiKTtcblx0XHR9KTtcblxuXHRcdC8vIDIuIFdyYXAgc2VudGVuY2VzIGluIHBhcmFncmFwaHNcblx0XHRjb250YWluZXIucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXCJwXCIpLmZvckVhY2goKHApID0+IHtcblx0XHRcdC8vIFNraXAgcGFyYWdyYXBocyB0aGF0IGNvbnRhaW4gb25seSBpbWFnZXMgb3IgZW1iZWRzXG5cdFx0XHRpZiAodGhpcy5pc05vblRleHRCbG9jayhwKSkgcmV0dXJuO1xuXHRcdFx0dGhpcy53cmFwU2VudGVuY2VzKHApO1xuXHRcdH0pO1xuXG5cdFx0Ly8gMy4gTWFyayBlbGVtZW50cyBjb250YWluaW5nIDxtYXJrPiAoPT1oaWdobGlnaHQ9PSkgYXMgYXItaGlnaGxpZ2h0ZWRcblx0XHQvLyAgICBSdW4gYWZ0ZXIgc2VudGVuY2Ugd3JhcHBpbmcgc28gLmFyLXNlbnRlbmNlIHNwYW5zIGV4aXN0XG5cdFx0Y29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFwibWFya1wiKS5mb3JFYWNoKChtYXJrKSA9PiB7XG5cdFx0XHRjb25zdCBwYXJlbnQgPSBtYXJrLmNsb3Nlc3Q8SFRNTEVsZW1lbnQ+KFxuXHRcdFx0XHRcIi5hci1zZW50ZW5jZSwgLmFyLWxpc3QtaXRlbSwgaDEsIGgyLCBoMywgaDQsIGg1LCBoNlwiXG5cdFx0XHQpO1xuXHRcdFx0aWYgKHBhcmVudCkge1xuXHRcdFx0XHRwYXJlbnQuY2xhc3NMaXN0LmFkZChcImFyLWhpZ2hsaWdodGVkXCIpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Ly8gNC4gV3JhcCBsaXN0IGl0ZW0gdGV4dCBjb250ZW50XG5cdFx0Y29udGFpbmVyXG5cdFx0XHQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXCJsaVwiKVxuXHRcdFx0LmZvckVhY2goKGxpKSA9PiB7XG5cdFx0XHRcdC8vIE9ubHkgd3JhcCBkaXJlY3QgdGV4dCBjb250ZW50LCBub3QgbmVzdGVkIGxpc3RzXG5cdFx0XHRcdGNvbnN0IHRleHRDb250ZW50ID0gdGhpcy5nZXREaXJlY3RUZXh0KGxpKTtcblx0XHRcdFx0aWYgKHRleHRDb250ZW50LnRyaW0oKS5sZW5ndGggPT09IDApIHJldHVybjtcblxuXHRcdFx0XHQvLyBXcmFwIHRoZSB0ZXh0IGluIGEgc3BhbiBmb3IgY2xpY2svZm9jdXMgdGFyZ2V0aW5nXG5cdFx0XHRcdGNvbnN0IHNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcblx0XHRcdFx0c3Bhbi5jbGFzc05hbWUgPSBcImFyLWxpc3QtaXRlbSBhci1uYXZpZ2FibGVcIjtcblx0XHRcdFx0c3Bhbi50ZXh0Q29udGVudCA9IHRleHRDb250ZW50O1xuXG5cdFx0XHRcdC8vIFJlcGxhY2UgZGlyZWN0IHRleHQgbm9kZXMgd2l0aCB0aGUgc3BhblxuXHRcdFx0XHRjb25zdCBjaGlsZE5vZGVzID0gQXJyYXkuZnJvbShsaS5jaGlsZE5vZGVzKTtcblx0XHRcdFx0bGV0IGluc2VydGVkID0gZmFsc2U7XG5cdFx0XHRcdGZvciAoY29uc3Qgbm9kZSBvZiBjaGlsZE5vZGVzKSB7XG5cdFx0XHRcdFx0aWYgKG5vZGUubm9kZVR5cGUgPT09IE5vZGUuVEVYVF9OT0RFICYmIG5vZGUudGV4dENvbnRlbnQ/LnRyaW0oKSkge1xuXHRcdFx0XHRcdFx0aWYgKCFpbnNlcnRlZCkge1xuXHRcdFx0XHRcdFx0XHRsaS5yZXBsYWNlQ2hpbGQoc3Bhbiwgbm9kZSk7XG5cdFx0XHRcdFx0XHRcdGluc2VydGVkID0gdHJ1ZTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdC8vIEFwcGVuZCBhZGRpdGlvbmFsIHRleHQgdG8gdGhlIHNwYW5cblx0XHRcdFx0XHRcdFx0c3Bhbi50ZXh0Q29udGVudCArPSBcIiBcIiArIG5vZGUudGV4dENvbnRlbnQudHJpbSgpO1xuXHRcdFx0XHRcdFx0XHRsaS5yZW1vdmVDaGlsZChub2RlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBpc05vblRleHRCbG9jayhwOiBIVE1MRWxlbWVudCk6IGJvb2xlYW4ge1xuXHRcdC8vIElmIHBhcmFncmFwaCBoYXMgb25seSBpbWFnZXMsIGlmcmFtZXMsIG9yIGVtYmVkcywgc2tpcCBpdFxuXHRcdGNvbnN0IHRleHQgPSBwLnRleHRDb250ZW50Py50cmltKCkgPz8gXCJcIjtcblx0XHRpZiAodGV4dC5sZW5ndGggPT09IDApIHJldHVybiB0cnVlO1xuXHRcdGlmIChwLnF1ZXJ5U2VsZWN0b3IoXCJpbWcsIGlmcmFtZSwgdmlkZW8sIGF1ZGlvLCAuaW50ZXJuYWwtZW1iZWRcIikpIHtcblx0XHRcdC8vIENoZWNrIGlmIHRoZXJlJ3Mgc3Vic3RhbnRpYWwgdGV4dCBhbG9uZ3NpZGVcblx0XHRcdGlmICh0ZXh0Lmxlbmd0aCA8IDUpIHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIHdyYXBTZW50ZW5jZXMocDogSFRNTEVsZW1lbnQpIHtcblx0XHQvLyBEb24ndCBwcm9jZXNzIGlmIGFscmVhZHkgaGFzIHNlbnRlbmNlIHNwYW5zXG5cdFx0aWYgKHAuaW5uZXJIVE1MLmluY2x1ZGVzKFwiYXItc2VudGVuY2VcIikpIHJldHVybjtcblxuXHRcdGNvbnN0IGZ1bGxUZXh0ID0gcC50ZXh0Q29udGVudCA/PyBcIlwiO1xuXHRcdGlmIChmdWxsVGV4dC50cmltKCkubGVuZ3RoID09PSAwKSByZXR1cm47XG5cblx0XHRjb25zdCBib3VuZGFyaWVzID0gdGhpcy5nZXRTZW50ZW5jZUJvdW5kYXJpZXMoZnVsbFRleHQpO1xuXHRcdGlmIChib3VuZGFyaWVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuXG5cdFx0Ly8gRmxhdHRlbiBhbGwgY2hpbGQgbm9kZXMgaW50byBhIGxpc3Qgb2YgXCJjaHVua3NcIiBcdTIwMTQgZWFjaCBjaHVuayBpcyBlaXRoZXJcblx0XHQvLyBhIHRleHQgc3RyaW5nIG9yIGFuIGVsZW1lbnQgKGxpa2UgPG1hcms+LCA8c3Ryb25nPiwgPGVtPiwgPGE+LCA8Y29kZT4pLlxuXHRcdC8vIFRyYWNrIGN1bXVsYXRpdmUgY2hhcmFjdGVyIG9mZnNldCBmb3IgZWFjaCBjaHVuay5cblx0XHRpbnRlcmZhY2UgQ2h1bmsge1xuXHRcdFx0dHlwZTogXCJ0ZXh0XCIgfCBcImVsZW1lbnRcIjtcblx0XHRcdHRleHQ6IHN0cmluZztcblx0XHRcdG5vZGU6IE5vZGU7XG5cdFx0XHRzdGFydE9mZnNldDogbnVtYmVyO1xuXHRcdH1cblx0XHRjb25zdCBjaHVua3M6IENodW5rW10gPSBbXTtcblx0XHRsZXQgY3VtT2Zmc2V0ID0gMDtcblx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIEFycmF5LmZyb20ocC5jaGlsZE5vZGVzKSkge1xuXHRcdFx0Y29uc3QgdCA9IGNoaWxkLnRleHRDb250ZW50ID8/IFwiXCI7XG5cdFx0XHRjaHVua3MucHVzaCh7XG5cdFx0XHRcdHR5cGU6IGNoaWxkLm5vZGVUeXBlID09PSBOb2RlLlRFWFRfTk9ERSA/IFwidGV4dFwiIDogXCJlbGVtZW50XCIsXG5cdFx0XHRcdHRleHQ6IHQsXG5cdFx0XHRcdG5vZGU6IGNoaWxkLFxuXHRcdFx0XHRzdGFydE9mZnNldDogY3VtT2Zmc2V0LFxuXHRcdFx0fSk7XG5cdFx0XHRjdW1PZmZzZXQgKz0gdC5sZW5ndGg7XG5cdFx0fVxuXG5cdFx0Ly8gRm9yIGVhY2ggc2VudGVuY2UgYm91bmRhcnkgcmFuZ2UsIGNvbGxlY3QgdGhlIGNodW5rcyAob3IgcGFydGlhbCBjaHVua3MpXG5cdFx0Ly8gdGhhdCBmYWxsIHdpdGhpbiBpdC5cblx0XHRjb25zdCBzZW50ZW5jZVNwYW5zOiBIVE1MRWxlbWVudFtdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBib3VuZGFyaWVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBzU3RhcnQgPSBib3VuZGFyaWVzW2ldO1xuXHRcdFx0Y29uc3Qgc0VuZCA9XG5cdFx0XHRcdGkgPCBib3VuZGFyaWVzLmxlbmd0aCAtIDEgPyBib3VuZGFyaWVzW2kgKyAxXSA6IGZ1bGxUZXh0Lmxlbmd0aDtcblxuXHRcdFx0Y29uc3Qgc3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuXHRcdFx0c3Bhbi5jbGFzc05hbWUgPSBcImFyLXNlbnRlbmNlIGFyLW5hdmlnYWJsZVwiO1xuXHRcdFx0c3Bhbi5kYXRhc2V0LnNlbnRlbmNlSW5kZXggPSBTdHJpbmcoaSk7XG5cblx0XHRcdGZvciAoY29uc3QgY2h1bmsgb2YgY2h1bmtzKSB7XG5cdFx0XHRcdGNvbnN0IGNTdGFydCA9IGNodW5rLnN0YXJ0T2Zmc2V0O1xuXHRcdFx0XHRjb25zdCBjRW5kID0gY1N0YXJ0ICsgY2h1bmsudGV4dC5sZW5ndGg7XG5cblx0XHRcdFx0Ly8gTm8gb3ZlcmxhcFxuXHRcdFx0XHRpZiAoY0VuZCA8PSBzU3RhcnQgfHwgY1N0YXJ0ID49IHNFbmQpIGNvbnRpbnVlO1xuXG5cdFx0XHRcdGlmIChjaHVuay50eXBlID09PSBcImVsZW1lbnRcIikge1xuXHRcdFx0XHRcdC8vIElubGluZSBlbGVtZW50IFx1MjAxNCBpZiBpdCBmYWxscyB3aXRoaW4gdGhpcyBzZW50ZW5jZSwgY2xvbmUgaXQgaW5cblx0XHRcdFx0XHRpZiAoY1N0YXJ0ID49IHNTdGFydCAmJiBjRW5kIDw9IHNFbmQpIHtcblx0XHRcdFx0XHRcdHNwYW4uYXBwZW5kQ2hpbGQoY2h1bmsubm9kZS5jbG9uZU5vZGUodHJ1ZSkpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHQvLyBQYXJ0aWFsIG92ZXJsYXAgd2l0aCBhbiBlbGVtZW50IFx1MjAxNCBpbmNsdWRlIGl0IGluIHdoaWNoZXZlclxuXHRcdFx0XHRcdFx0Ly8gc2VudGVuY2UgY29udGFpbnMgdGhlIG1ham9yaXR5XG5cdFx0XHRcdFx0XHRjb25zdCBvdmVybGFwID0gTWF0aC5taW4oY0VuZCwgc0VuZCkgLSBNYXRoLm1heChjU3RhcnQsIHNTdGFydCk7XG5cdFx0XHRcdFx0XHRpZiAob3ZlcmxhcCA+IGNodW5rLnRleHQubGVuZ3RoIC8gMikge1xuXHRcdFx0XHRcdFx0XHRzcGFuLmFwcGVuZENoaWxkKGNodW5rLm5vZGUuY2xvbmVOb2RlKHRydWUpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gVGV4dCBub2RlIFx1MjAxNCB0YWtlIHRoZSBzdWJzdHJpbmcgdGhhdCBmYWxscyB3aXRoaW4gdGhpcyBzZW50ZW5jZVxuXHRcdFx0XHRcdGNvbnN0IGxvY2FsU3RhcnQgPSBNYXRoLm1heCgwLCBzU3RhcnQgLSBjU3RhcnQpO1xuXHRcdFx0XHRcdGNvbnN0IGxvY2FsRW5kID0gTWF0aC5taW4oY2h1bmsudGV4dC5sZW5ndGgsIHNFbmQgLSBjU3RhcnQpO1xuXHRcdFx0XHRcdGNvbnN0IHN1YnN0cmluZyA9IGNodW5rLnRleHQuc3Vic3RyaW5nKGxvY2FsU3RhcnQsIGxvY2FsRW5kKTtcblx0XHRcdFx0XHRpZiAoc3Vic3RyaW5nLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRcdHNwYW4uYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoc3Vic3RyaW5nKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChzcGFuLnRleHRDb250ZW50Py50cmltKCkubGVuZ3RoKSB7XG5cdFx0XHRcdHNlbnRlbmNlU3BhbnMucHVzaChzcGFuKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBSZXBsYWNlIHBhcmFncmFwaCBjb250ZW50cyB3aXRoIHRoZSBzZW50ZW5jZSBzcGFuc1xuXHRcdHAuaW5uZXJIVE1MID0gXCJcIjtcblx0XHRzZW50ZW5jZVNwYW5zLmZvckVhY2goKHNwYW4sIGlkeCkgPT4ge1xuXHRcdFx0cC5hcHBlbmRDaGlsZChzcGFuKTtcblx0XHRcdGlmIChpZHggPCBzZW50ZW5jZVNwYW5zLmxlbmd0aCAtIDEpIHtcblx0XHRcdFx0cC5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShcIiBcIikpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgY2hhcmFjdGVyIG9mZnNldHMgd2hlcmUgZWFjaCBzZW50ZW5jZSBzdGFydHMuXG5cdCAqIEFsd2F5cyBpbmNsdWRlcyAwIChzdGFydCBvZiBmaXJzdCBzZW50ZW5jZSkuXG5cdCAqL1xuXHRwcml2YXRlIGdldFNlbnRlbmNlQm91bmRhcmllcyh0ZXh0OiBzdHJpbmcpOiBudW1iZXJbXSB7XG5cdFx0Y29uc3QgYWJiciA9XG5cdFx0XHQvKD86TXJ8TXJzfE1zfERyfFByb2Z8U3J8SnJ8dnN8ZXRjfGVcXC5nfGlcXC5lfGFcXC5tfHBcXC5tfEluY3xMdGR8Q29ycHxTdHxBdmV8Qmx2ZHxEZXB0fEZpZ3xWb2x8Tm8pXFwuL2dpO1xuXG5cdFx0Ly8gUmVwbGFjZSBhYmJyZXZpYXRpb25zIHdpdGggcGxhY2Vob2xkZXJzIHRvIGF2b2lkIGZhbHNlIHNwbGl0c1xuXHRcdGNvbnN0IHBsYWNlaG9sZGVyczogeyBzdGFydDogbnVtYmVyOyBlbmQ6IG51bWJlciB9W10gPSBbXTtcblx0XHRjb25zdCBjbGVhbmVkID0gdGV4dC5yZXBsYWNlKGFiYnIsIChtYXRjaCwgb2Zmc2V0KSA9PiB7XG5cdFx0XHRwbGFjZWhvbGRlcnMucHVzaCh7IHN0YXJ0OiBvZmZzZXQsIGVuZDogb2Zmc2V0ICsgbWF0Y2gubGVuZ3RoIH0pO1xuXHRcdFx0cmV0dXJuIFwiWFwiLnJlcGVhdChtYXRjaC5sZW5ndGgpOyAvLyBzYW1lIGxlbmd0aCBwbGFjZWhvbGRlclxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgYm91bmRhcmllcyA9IFswXTtcblx0XHRjb25zdCBzcGxpdFBhdHRlcm4gPSAvKFsuIT9dKVxccysoPz1bQS1aXSkvZztcblx0XHRsZXQgbTogUmVnRXhwRXhlY0FycmF5IHwgbnVsbDtcblxuXHRcdHdoaWxlICgobSA9IHNwbGl0UGF0dGVybi5leGVjKGNsZWFuZWQpKSAhPT0gbnVsbCkge1xuXHRcdFx0Y29uc3QgcG9zID0gbS5pbmRleCArIG1bMV0ubGVuZ3RoICsgMTsgLy8gYWZ0ZXIgcHVuY3R1YXRpb24gKyBmaXJzdCBzcGFjZVxuXHRcdFx0Ly8gU2tpcCB0aGUgd2hpdGVzcGFjZSB0byBmaW5kIHRoZSBhY3R1YWwgc3RhcnQgb2YgbmV4dCBzZW50ZW5jZVxuXHRcdFx0bGV0IG5leHRTdGFydCA9IHBvcztcblx0XHRcdHdoaWxlIChuZXh0U3RhcnQgPCB0ZXh0Lmxlbmd0aCAmJiAvXFxzLy50ZXN0KHRleHRbbmV4dFN0YXJ0XSkpIHtcblx0XHRcdFx0bmV4dFN0YXJ0Kys7XG5cdFx0XHR9XG5cdFx0XHRpZiAobmV4dFN0YXJ0IDwgdGV4dC5sZW5ndGgpIHtcblx0XHRcdFx0Ym91bmRhcmllcy5wdXNoKG5leHRTdGFydCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGJvdW5kYXJpZXM7XG5cdH1cblxuXHQvKipcblx0ICogQnVpbGQgYSBtYXA6IGN1bXVsYXRpdmUgY2hhcmFjdGVyIG9mZnNldCBcdTIxOTIgdGV4dCBub2RlLlxuXHQgKi9cblx0cHJpdmF0ZSBtYXBDaGFyUG9zaXRpb25zKFxuXHRcdHRleHROb2RlczogVGV4dFtdXG5cdCk6IHsgY3VtT2Zmc2V0OiBudW1iZXI7IG5vZGU6IFRleHQ7IGxlbmd0aDogbnVtYmVyIH1bXSB7XG5cdFx0Y29uc3QgcG9zaXRpb25zOiB7IGN1bU9mZnNldDogbnVtYmVyOyBub2RlOiBUZXh0OyBsZW5ndGg6IG51bWJlciB9W10gPSBbXTtcblx0XHRsZXQgY3VtID0gMDtcblx0XHRmb3IgKGNvbnN0IHRuIG9mIHRleHROb2Rlcykge1xuXHRcdFx0Y29uc3QgbGVuID0gdG4udGV4dENvbnRlbnQ/Lmxlbmd0aCA/PyAwO1xuXHRcdFx0cG9zaXRpb25zLnB1c2goeyBjdW1PZmZzZXQ6IGN1bSwgbm9kZTogdG4sIGxlbmd0aDogbGVuIH0pO1xuXHRcdFx0Y3VtICs9IGxlbjtcblx0XHR9XG5cdFx0cmV0dXJuIHBvc2l0aW9ucztcblx0fVxuXG5cdC8qKlxuXHQgKiBGaW5kIHdoaWNoIHRleHQgbm9kZSArIGxvY2FsIG9mZnNldCBjb3JyZXNwb25kcyB0byBhIGdsb2JhbCBjaGFyIG9mZnNldC5cblx0ICovXG5cdHByaXZhdGUgZmluZFBvc2l0aW9uKFxuXHRcdHBvc2l0aW9uczogeyBjdW1PZmZzZXQ6IG51bWJlcjsgbm9kZTogVGV4dDsgbGVuZ3RoOiBudW1iZXIgfVtdLFxuXHRcdGNoYXJPZmZzZXQ6IG51bWJlclxuXHQpOiB7IG5vZGU6IFRleHQ7IG9mZnNldDogbnVtYmVyIH0gfCBudWxsIHtcblx0XHRmb3IgKGxldCBpID0gcG9zaXRpb25zLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRjb25zdCBwID0gcG9zaXRpb25zW2ldO1xuXHRcdFx0aWYgKGNoYXJPZmZzZXQgPj0gcC5jdW1PZmZzZXQpIHtcblx0XHRcdFx0Y29uc3QgbG9jYWxPZmZzZXQgPSBNYXRoLm1pbihjaGFyT2Zmc2V0IC0gcC5jdW1PZmZzZXQsIHAubGVuZ3RoKTtcblx0XHRcdFx0cmV0dXJuIHsgbm9kZTogcC5ub2RlLCBvZmZzZXQ6IGxvY2FsT2Zmc2V0IH07XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBwb3NpdGlvbnMubGVuZ3RoID4gMFxuXHRcdFx0PyB7IG5vZGU6IHBvc2l0aW9uc1swXS5ub2RlLCBvZmZzZXQ6IDAgfVxuXHRcdFx0OiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXREaXJlY3RUZXh0KGVsOiBIVE1MRWxlbWVudCk6IHN0cmluZyB7XG5cdFx0bGV0IHRleHQgPSBcIlwiO1xuXHRcdGVsLmNoaWxkTm9kZXMuZm9yRWFjaCgobm9kZSkgPT4ge1xuXHRcdFx0aWYgKG5vZGUubm9kZVR5cGUgPT09IE5vZGUuVEVYVF9OT0RFKSB7XG5cdFx0XHRcdHRleHQgKz0gbm9kZS50ZXh0Q29udGVudDtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRyZXR1cm4gdGV4dC50cmltKCk7XG5cdH1cblxuXHQvLyBcdTI1MDBcdTI1MDAgVGV4dCBjbGVhbnVwIFx1MjUwMFx1MjUwMFxuXG5cdHByaXZhdGUgc3RyaXBFbW9qaXModGV4dDogc3RyaW5nKTogc3RyaW5nIHtcblx0XHQvLyBSZW1vdmUgZW1vamkgY2hhcmFjdGVycyAoVW5pY29kZSBlbW9qaSByYW5nZXMgKyB2YXJpYXRpb24gc2VsZWN0b3JzICsgWldKIHNlcXVlbmNlcylcblx0XHRyZXR1cm4gdGV4dFxuXHRcdFx0LnJlcGxhY2UoL1tcXHV7MUY2MDB9LVxcdXsxRjY0Rn1dL2d1LCBcIlwiKSAgIC8vIGVtb3RpY29uc1xuXHRcdFx0LnJlcGxhY2UoL1tcXHV7MUYzMDB9LVxcdXsxRjVGRn1dL2d1LCBcIlwiKSAgIC8vIHN5bWJvbHMgJiBwaWN0b2dyYXBoc1xuXHRcdFx0LnJlcGxhY2UoL1tcXHV7MUY2ODB9LVxcdXsxRjZGRn1dL2d1LCBcIlwiKSAgIC8vIHRyYW5zcG9ydCAmIG1hcFxuXHRcdFx0LnJlcGxhY2UoL1tcXHV7MUYxRTB9LVxcdXsxRjFGRn1dL2d1LCBcIlwiKSAgIC8vIGZsYWdzXG5cdFx0XHQucmVwbGFjZSgvW1xcdXsyNjAwfS1cXHV7MjZGRn1dL2d1LCBcIlwiKSAgICAgLy8gbWlzYyBzeW1ib2xzXG5cdFx0XHQucmVwbGFjZSgvW1xcdXsyNzAwfS1cXHV7MjdCRn1dL2d1LCBcIlwiKSAgICAgLy8gZGluZ2JhdHNcblx0XHRcdC5yZXBsYWNlKC9bXFx1e0ZFMDB9LVxcdXtGRTBGfV0vZ3UsIFwiXCIpICAgICAvLyB2YXJpYXRpb24gc2VsZWN0b3JzXG5cdFx0XHQucmVwbGFjZSgvW1xcdXsyMDBEfV0vZ3UsIFwiXCIpICAgICAgICAgICAgICAgLy8gemVyby13aWR0aCBqb2luZXJcblx0XHRcdC5yZXBsYWNlKC9bXFx1ezFGOTAwfS1cXHV7MUY5RkZ9XS9ndSwgXCJcIikgICAvLyBzdXBwbGVtZW50YWwgc3ltYm9sc1xuXHRcdFx0LnJlcGxhY2UoL1tcXHV7MUZBMDB9LVxcdXsxRkE2Rn1dL2d1LCBcIlwiKSAgIC8vIGNoZXNzIHN5bWJvbHNcblx0XHRcdC5yZXBsYWNlKC9bXFx1ezFGQTcwfS1cXHV7MUZBRkZ9XS9ndSwgXCJcIikgICAvLyBzeW1ib2xzIGV4dGVuZGVkLUFcblx0XHRcdC5yZXBsYWNlKC9bXFx1ezIzMUF9LVxcdXsyM0YzfV0vZ3UsIFwiXCIpICAgICAvLyBtaXNjIHRlY2huaWNhbFxuXHRcdFx0LnJlcGxhY2UoL1tcXHV7MkI1MH1dL2d1LCBcIlwiKSAgICAgICAgICAgICAgIC8vIHN0YXJcblx0XHRcdC5yZXBsYWNlKC9cXHN7Mix9L2csIFwiIFwiKSAgICAgICAgICAgICAgICAgICAvLyBjb2xsYXBzZSBkb3VibGUgc3BhY2VzIGxlZnQgYmVoaW5kXG5cdFx0XHQudHJpbSgpO1xuXHR9XG5cblx0Ly8gXHUyNTAwXHUyNTAwIEZvY3VzICYgVFRTIFx1MjUwMFx1MjUwMFxuXG5cdHByaXZhdGUgaGFuZGxlRm9jdXNDaGFuZ2UoZWw6IEhUTUxFbGVtZW50IHwgbnVsbCwgc3BlYWs6IGJvb2xlYW4pIHtcblx0XHQvLyBSZW1vdmUgb2xkIGZvY3VzXG5cdFx0aWYgKHRoaXMuZm9jdXNlZEVsKSB7XG5cdFx0XHR0aGlzLmZvY3VzZWRFbC5jbGFzc0xpc3QucmVtb3ZlKFwiYXItZm9jdXNlZFwiKTtcblx0XHR9XG5cblx0XHRpZiAoIWVsKSB7XG5cdFx0XHR0aGlzLmZvY3VzZWRFbCA9IG51bGw7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gU2V0IG5ldyBmb2N1c1xuXHRcdHRoaXMuZm9jdXNlZEVsID0gZWw7XG5cdFx0ZWwuY2xhc3NMaXN0LmFkZChcImFyLWZvY3VzZWRcIik7XG5cdFx0ZWwuc2Nyb2xsSW50b1ZpZXcoeyBiZWhhdmlvcjogXCJzbW9vdGhcIiwgYmxvY2s6IFwiY2VudGVyXCIgfSk7XG5cblx0XHQvLyBTeW5jIHNvdXJjZSBlZGl0b3Igc2Nyb2xsXG5cdFx0dGhpcy5zeW5jRWRpdG9yU2Nyb2xsKGVsKTtcblxuXHRcdGlmIChzcGVhaykge1xuXHRcdFx0Y29uc3QgdGV4dCA9IHRoaXMuc3RyaXBFbW9qaXMoZWwudGV4dENvbnRlbnQ/LnRyaW0oKSA/PyBcIlwiKTtcblx0XHRcdGlmICh0ZXh0Lmxlbmd0aCA+IDApIHtcblx0XHRcdFx0dGhpcy50dHMuY2FuY2VsKCk7XG5cdFx0XHRcdHRoaXMudHRzLnNwZWFrKHRleHQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIFx1MjUwMFx1MjUwMCBFZGl0b3Igc2Nyb2xsIHN5bmMgXHUyNTAwXHUyNTAwXG5cblx0cHJpdmF0ZSBzeW5jRWRpdG9yU2Nyb2xsKGVsOiBIVE1MRWxlbWVudCkge1xuXHRcdGlmICghdGhpcy5maWxlKSByZXR1cm47XG5cblx0XHQvLyBGaW5kIGFuIG9wZW4gbWFya2Rvd24gZWRpdG9yIGZvciB0aGUgc2FtZSBmaWxlXG5cdFx0Y29uc3QgbGVhdmVzID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShcIm1hcmtkb3duXCIpO1xuXHRcdGNvbnN0IGVkaXRvckxlYWYgPSBsZWF2ZXMuZmluZCgobGVhZikgPT4ge1xuXHRcdFx0Y29uc3QgdmlldyA9IGxlYWYudmlldyBhcyBNYXJrZG93blZpZXc7XG5cdFx0XHRyZXR1cm4gdmlldy5maWxlPy5wYXRoID09PSB0aGlzLmZpbGU/LnBhdGg7XG5cdFx0fSk7XG5cdFx0aWYgKCFlZGl0b3JMZWFmKSByZXR1cm47XG5cblx0XHRjb25zdCBlZGl0b3JWaWV3ID0gZWRpdG9yTGVhZi52aWV3IGFzIE1hcmtkb3duVmlldztcblx0XHRjb25zdCBlZGl0b3IgPSBlZGl0b3JWaWV3LmVkaXRvcjtcblx0XHRpZiAoIWVkaXRvcikgcmV0dXJuO1xuXG5cdFx0Ly8gR2V0IHRoZSB0ZXh0IHRvIHNlYXJjaCBmb3IgaW4gdGhlIHNvdXJjZVxuXHRcdGNvbnN0IHNlYXJjaFRleHQgPSBlbC50ZXh0Q29udGVudD8udHJpbSgpID8/IFwiXCI7XG5cdFx0aWYgKHNlYXJjaFRleHQubGVuZ3RoID09PSAwKSByZXR1cm47XG5cblx0XHQvLyBGaW5kIHRoZSBsaW5lIGluIHRoZSBzb3VyY2UgY29udGFpbmluZyB0aGlzIHRleHRcblx0XHRjb25zdCB0b3RhbExpbmVzID0gZWRpdG9yLmxpbmVDb3VudCgpO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdG90YWxMaW5lczsgaSsrKSB7XG5cdFx0XHRjb25zdCBsaW5lID0gZWRpdG9yLmdldExpbmUoaSk7XG5cdFx0XHRpZiAobGluZS5pbmNsdWRlcyhzZWFyY2hUZXh0KSB8fCBsaW5lLmluY2x1ZGVzKGA9PSR7c2VhcmNoVGV4dH09PWApKSB7XG5cdFx0XHRcdC8vIFNjcm9sbCBlZGl0b3IgdG8gdGhpcyBsaW5lIChjZW50ZXIgaXQpXG5cdFx0XHRcdGVkaXRvci5zZXRDdXJzb3IoeyBsaW5lOiBpLCBjaDogMCB9KTtcblx0XHRcdFx0ZWRpdG9yLnNjcm9sbEludG9WaWV3KFxuXHRcdFx0XHRcdHsgZnJvbTogeyBsaW5lOiBpLCBjaDogMCB9LCB0bzogeyBsaW5lOiBpLCBjaDogMCB9IH0sXG5cdFx0XHRcdFx0dHJ1ZVxuXHRcdFx0XHQpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyBcdTI1MDBcdTI1MDAgS2V5Ym9hcmQgXHUyNTAwXHUyNTAwXG5cblx0cHJpdmF0ZSBvbktleURvd24oZTogS2V5Ym9hcmRFdmVudCkge1xuXHRcdC8vIElnbm9yZSBpZiBpbiBhbiBpbnB1dCBmaWVsZFxuXHRcdGNvbnN0IHRhZyA9IChlLnRhcmdldCBhcyBIVE1MRWxlbWVudCkudGFnTmFtZTtcblx0XHRpZiAodGFnID09PSBcIklOUFVUXCIgfHwgdGFnID09PSBcIlRFWFRBUkVBXCIpIHJldHVybjtcblxuXHRcdC8vIE51bWJlciBrZXlzIDEtNjogaGVhZGluZyBqdW1wXG5cdFx0Ly8gVXNlIGUuY29kZSAoRGlnaXQxLURpZ2l0NikgYmVjYXVzZSBTaGlmdCsxIHByb2R1Y2VzIFwiIVwiIG9uIGUua2V5XG5cdFx0Y29uc3QgZGlnaXRNYXRjaCA9IGUuY29kZS5tYXRjaCgvXkRpZ2l0KFsxLTZdKSQvKTtcblx0XHRpZiAoZGlnaXRNYXRjaCkge1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0Y29uc3QgbGV2ZWwgPSBwYXJzZUludChkaWdpdE1hdGNoWzFdKTtcblx0XHRcdHRoaXMubmF2Lmp1bXBUb0hlYWRpbmcobGV2ZWwsIGUuc2hpZnRLZXkpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHN3aXRjaCAoZS5rZXkpIHtcblx0XHRcdC8vIEggLyBTaGlmdCtIOiBuZXh0L3ByZXZpb3VzIGhlYWRpbmcgYXQgYW55IGxldmVsXG5cdFx0XHRjYXNlIFwiaFwiOlxuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHRoaXMudHRzLmNhbmNlbCgpO1xuXHRcdFx0XHR0aGlzLm5hdi5qdW1wVG9BbnlIZWFkaW5nKGZhbHNlKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFwiSFwiOlxuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHRoaXMudHRzLmNhbmNlbCgpO1xuXHRcdFx0XHR0aGlzLm5hdi5qdW1wVG9BbnlIZWFkaW5nKHRydWUpO1xuXHRcdFx0XHRicmVhaztcblxuXHRcdFx0Ly8gbiAvIFNoaWZ0K046IG5leHQvcHJldmlvdXMgaGlnaGxpZ2h0ZWQgc2VudGVuY2Vcblx0XHRcdGNhc2UgXCJuXCI6XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0dGhpcy50dHMuY2FuY2VsKCk7XG5cdFx0XHRcdHRoaXMubmF2Lmp1bXBUb0hpZ2hsaWdodChmYWxzZSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBcIk5cIjpcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR0aGlzLnR0cy5jYW5jZWwoKTtcblx0XHRcdFx0dGhpcy5uYXYuanVtcFRvSGlnaGxpZ2h0KHRydWUpO1xuXHRcdFx0XHRicmVhaztcblxuXHRcdFx0Y2FzZSBcIkFycm93RG93blwiOlxuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHRoaXMudHRzLmNhbmNlbCgpO1xuXHRcdFx0XHR0aGlzLm5hdi5tb3ZlQmxvY2soXCJkb3duXCIpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgXCJBcnJvd1VwXCI6XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0dGhpcy50dHMuY2FuY2VsKCk7XG5cdFx0XHRcdHRoaXMubmF2Lm1vdmVCbG9jayhcInVwXCIpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgXCJBcnJvd1JpZ2h0XCI6XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0dGhpcy50dHMuY2FuY2VsKCk7XG5cdFx0XHRcdHRoaXMubmF2Lm1vdmVTZW50ZW5jZShcInJpZ2h0XCIpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgXCJBcnJvd0xlZnRcIjpcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR0aGlzLnR0cy5jYW5jZWwoKTtcblx0XHRcdFx0dGhpcy5uYXYubW92ZVNlbnRlbmNlKFwibGVmdFwiKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFwiRW50ZXJcIjpcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR0aGlzLnRvZ2dsZUhpZ2hsaWdodEluRmlsZSgpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgXCJFc2NhcGVcIjpcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR0aGlzLnR0cy5jYW5jZWwoKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXHR9XG5cblx0Ly8gXHUyNTAwXHUyNTAwIEhpZ2hsaWdodCBwZXJzaXN0ZW5jZSAoPT10ZXh0PT0gaW4gc291cmNlIG1hcmtkb3duKSBcdTI1MDBcdTI1MDBcblxuXHRwcml2YXRlIGFzeW5jIHRvZ2dsZUhpZ2hsaWdodEluRmlsZSgpIHtcblx0XHRjb25zdCBlbCA9IHRoaXMubmF2LmN1cnJlbnQ7XG5cdFx0aWYgKCFlbCB8fCAhdGhpcy5maWxlKSByZXR1cm47XG5cblx0XHRjb25zdCB0ZXh0ID0gZWwudGV4dENvbnRlbnQ/LnRyaW0oKTtcblx0XHRpZiAoIXRleHQgfHwgdGV4dC5sZW5ndGggPT09IDApIHJldHVybjtcblxuXHRcdGNvbnN0IGZpbGVDb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZCh0aGlzLmZpbGUpO1xuXHRcdGNvbnN0IGhpZ2hsaWdodGVkID0gYD09JHt0ZXh0fT09YDtcblxuXHRcdGxldCBuZXdDb250ZW50OiBzdHJpbmc7XG5cdFx0aWYgKGZpbGVDb250ZW50LmluY2x1ZGVzKGhpZ2hsaWdodGVkKSkge1xuXHRcdFx0Ly8gUmVtb3ZlIGhpZ2hsaWdodCBcdTIwMTQgdW4tdG9nZ2xlXG5cdFx0XHRuZXdDb250ZW50ID0gZmlsZUNvbnRlbnQucmVwbGFjZShoaWdobGlnaHRlZCwgdGV4dCk7XG5cdFx0XHRlbC5jbGFzc0xpc3QucmVtb3ZlKFwiYXItaGlnaGxpZ2h0ZWRcIik7XG5cdFx0fSBlbHNlIGlmIChmaWxlQ29udGVudC5pbmNsdWRlcyh0ZXh0KSkge1xuXHRcdFx0Ly8gQWRkIGhpZ2hsaWdodFxuXHRcdFx0bmV3Q29udGVudCA9IGZpbGVDb250ZW50LnJlcGxhY2UodGV4dCwgaGlnaGxpZ2h0ZWQpO1xuXHRcdFx0ZWwuY2xhc3NMaXN0LmFkZChcImFyLWhpZ2hsaWdodGVkXCIpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBUZXh0IG5vdCBmb3VuZCBpbiBzb3VyY2UgKG1heWJlIGZvcm1hdHRpbmcgZGlmZmVycykgXHUyMDE0IHNraXBcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBTdXBwcmVzcyB0aGUgcmUtcmVuZGVyIHRyaWdnZXJlZCBieSBvdXIgb3duIGZpbGUgbW9kaWZpY2F0aW9uXG5cdFx0dGhpcy5zdXBwcmVzc1JlcmVuZGVyID0gdHJ1ZTtcblx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkodGhpcy5maWxlLCBuZXdDb250ZW50KTtcblx0fVxufVxuIiwgIi8qKlxuICogTmF2aWdhdGlvbiBzdGF0ZSBtYWNoaW5lIGZvciBBcnRpY2xlIFJlYWRlci5cbiAqXG4gKiBNYWludGFpbnMgYSBmbGF0IGxpc3Qgb2YgYWxsIG5hdmlnYWJsZSBlbGVtZW50cyBhbmQgYSBjdXJyZW50IGZvY3VzIGluZGV4LlxuICogSGFuZGxlcyBoZWFkaW5nLWxldmVsIGp1bXBzLCBibG9jayBuYXZpZ2F0aW9uLCBhbmQgc2VudGVuY2UtbGV2ZWwgdHJhdmVyc2FsLlxuICovXG5cbmV4cG9ydCB0eXBlIE5hdkVsZW1lbnQgPSBIVE1MRWxlbWVudDtcblxuZXhwb3J0IGNsYXNzIE5hdmlnYXRpb25Db250cm9sbGVyIHtcblx0cHJpdmF0ZSBlbGVtZW50czogTmF2RWxlbWVudFtdID0gW107XG5cdHByaXZhdGUgY3VycmVudEluZGV4ID0gLTE7XG5cdHByaXZhdGUgb25Gb2N1c0NoYW5nZTogKGVsOiBOYXZFbGVtZW50IHwgbnVsbCwgc3BlYWs6IGJvb2xlYW4pID0+IHZvaWQ7XG5cblx0Y29uc3RydWN0b3Iob25Gb2N1c0NoYW5nZTogKGVsOiBOYXZFbGVtZW50IHwgbnVsbCwgc3BlYWs6IGJvb2xlYW4pID0+IHZvaWQpIHtcblx0XHR0aGlzLm9uRm9jdXNDaGFuZ2UgPSBvbkZvY3VzQ2hhbmdlO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlYnVpbGQgdGhlIG5hdmlnYWJsZSBlbGVtZW50IGxpc3QgZnJvbSB0aGUgcmVuZGVyZWQgY29udGFpbmVyLlxuXHQgKiBPcmRlcjogRE9NIG9yZGVyICh0b3AgdG8gYm90dG9tKS5cblx0ICogTmF2aWdhYmxlID0gaGVhZGluZ3MsIHNlbnRlbmNlcyAoLmFyLXNlbnRlbmNlKSwgbGlzdCBpdGVtcyAoLmFyLWxpc3QtaXRlbSkuXG5cdCAqL1xuXHRyZWJ1aWxkKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpIHtcblx0XHR0aGlzLmVsZW1lbnRzID0gQXJyYXkuZnJvbShcblx0XHRcdGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50Pihcblx0XHRcdFx0XCJoMSwgaDIsIGgzLCBoNCwgaDUsIGg2LCAuYXItc2VudGVuY2UsIC5hci1saXN0LWl0ZW1cIlxuXHRcdFx0KVxuXHRcdCk7XG5cdFx0dGhpcy5jdXJyZW50SW5kZXggPSAtMTtcblx0fVxuXG5cdGdldCBjdXJyZW50KCk6IE5hdkVsZW1lbnQgfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5lbGVtZW50c1t0aGlzLmN1cnJlbnRJbmRleF0gPz8gbnVsbDtcblx0fVxuXG5cdGZvY3VzRWxlbWVudChlbDogTmF2RWxlbWVudCwgc3BlYWs6IGJvb2xlYW4pIHtcblx0XHRjb25zdCBpZHggPSB0aGlzLmVsZW1lbnRzLmluZGV4T2YoZWwpO1xuXHRcdGlmIChpZHggPj0gMCkge1xuXHRcdFx0dGhpcy5jdXJyZW50SW5kZXggPSBpZHg7XG5cdFx0XHR0aGlzLm9uRm9jdXNDaGFuZ2UoZWwsIHNwZWFrKTtcblx0XHR9XG5cdH1cblxuXHQvLyBcdTI1MDBcdTI1MDAgSGVhZGluZy1sZXZlbCBqdW1wIFx1MjUwMFx1MjUwMFxuXG5cdGp1bXBUb0hlYWRpbmcobGV2ZWw6IG51bWJlciwgcmV2ZXJzZTogYm9vbGVhbikge1xuXHRcdGNvbnN0IHRhZyA9IGBIJHtsZXZlbH1gO1xuXHRcdGNvbnN0IHN0YXJ0ID0gdGhpcy5jdXJyZW50SW5kZXg7XG5cblx0XHRpZiAocmV2ZXJzZSkge1xuXHRcdFx0Zm9yIChsZXQgaSA9IHN0YXJ0IC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdFx0aWYgKHRoaXMuZWxlbWVudHNbaV0udGFnTmFtZSA9PT0gdGFnKSB7XG5cdFx0XHRcdFx0dGhpcy5jdXJyZW50SW5kZXggPSBpO1xuXHRcdFx0XHRcdHRoaXMub25Gb2N1c0NoYW5nZSh0aGlzLmVsZW1lbnRzW2ldLCB0cnVlKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Zm9yIChsZXQgaSA9IHN0YXJ0ICsgMTsgaSA8IHRoaXMuZWxlbWVudHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKHRoaXMuZWxlbWVudHNbaV0udGFnTmFtZSA9PT0gdGFnKSB7XG5cdFx0XHRcdFx0dGhpcy5jdXJyZW50SW5kZXggPSBpO1xuXHRcdFx0XHRcdHRoaXMub25Gb2N1c0NoYW5nZSh0aGlzLmVsZW1lbnRzW2ldLCB0cnVlKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyBcdTI1MDBcdTI1MDAgQW55LWhlYWRpbmcganVtcCAoSCAvIFNoaWZ0K0gpIFx1MjUwMFx1MjUwMFxuXG5cdGp1bXBUb0FueUhlYWRpbmcocmV2ZXJzZTogYm9vbGVhbikge1xuXHRcdGNvbnN0IHN0YXJ0ID0gdGhpcy5jdXJyZW50SW5kZXg7XG5cdFx0aWYgKHJldmVyc2UpIHtcblx0XHRcdGZvciAobGV0IGkgPSBzdGFydCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRcdGlmICgvXkhbMS02XSQvLnRlc3QodGhpcy5lbGVtZW50c1tpXS50YWdOYW1lKSkge1xuXHRcdFx0XHRcdHRoaXMuY3VycmVudEluZGV4ID0gaTtcblx0XHRcdFx0XHR0aGlzLm9uRm9jdXNDaGFuZ2UodGhpcy5lbGVtZW50c1tpXSwgdHJ1ZSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGZvciAobGV0IGkgPSBzdGFydCArIDE7IGkgPCB0aGlzLmVsZW1lbnRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmICgvXkhbMS02XSQvLnRlc3QodGhpcy5lbGVtZW50c1tpXS50YWdOYW1lKSkge1xuXHRcdFx0XHRcdHRoaXMuY3VycmVudEluZGV4ID0gaTtcblx0XHRcdFx0XHR0aGlzLm9uRm9jdXNDaGFuZ2UodGhpcy5lbGVtZW50c1tpXSwgdHJ1ZSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gXHUyNTAwXHUyNTAwIEhpZ2hsaWdodGVkIGVsZW1lbnQganVtcCAobiAvIFNoaWZ0K04pIFx1MjUwMFx1MjUwMFxuXG5cdGp1bXBUb0hpZ2hsaWdodChyZXZlcnNlOiBib29sZWFuKSB7XG5cdFx0Y29uc3Qgc3RhcnQgPSB0aGlzLmN1cnJlbnRJbmRleDtcblx0XHRpZiAocmV2ZXJzZSkge1xuXHRcdFx0Zm9yIChsZXQgaSA9IHN0YXJ0IC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdFx0aWYgKHRoaXMuZWxlbWVudHNbaV0uY2xhc3NMaXN0LmNvbnRhaW5zKFwiYXItaGlnaGxpZ2h0ZWRcIikpIHtcblx0XHRcdFx0XHR0aGlzLmN1cnJlbnRJbmRleCA9IGk7XG5cdFx0XHRcdFx0dGhpcy5vbkZvY3VzQ2hhbmdlKHRoaXMuZWxlbWVudHNbaV0sIHRydWUpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRmb3IgKGxldCBpID0gc3RhcnQgKyAxOyBpIDwgdGhpcy5lbGVtZW50cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRpZiAodGhpcy5lbGVtZW50c1tpXS5jbGFzc0xpc3QuY29udGFpbnMoXCJhci1oaWdobGlnaHRlZFwiKSkge1xuXHRcdFx0XHRcdHRoaXMuY3VycmVudEluZGV4ID0gaTtcblx0XHRcdFx0XHR0aGlzLm9uRm9jdXNDaGFuZ2UodGhpcy5lbGVtZW50c1tpXSwgdHJ1ZSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gXHUyNTAwXHUyNTAwIEJsb2NrIG5hdmlnYXRpb24gKFx1MjE5MSAvIFx1MjE5MykgXHUyNTAwXHUyNTAwXG5cdC8vIE1vdmVzIHRvIHRoZSBuZXh0L3ByZXZpb3VzIFwiYmxvY2sgc3RhcnRcIjpcblx0Ly8gICAtIEFueSBoZWFkaW5nXG5cdC8vICAgLSBGaXJzdCBzZW50ZW5jZSBvZiBhIHBhcmFncmFwaCAoZGF0YS1zZW50ZW5jZS1pbmRleD1cIjBcIilcblx0Ly8gICAtIEFueSBsaXN0IGl0ZW1cblxuXHRtb3ZlQmxvY2soZGlyZWN0aW9uOiBcInVwXCIgfCBcImRvd25cIikge1xuXHRcdGNvbnN0IHN0ZXAgPSBkaXJlY3Rpb24gPT09IFwiZG93blwiID8gMSA6IC0xO1xuXHRcdGxldCBpID0gdGhpcy5jdXJyZW50SW5kZXggKyBzdGVwO1xuXG5cdFx0d2hpbGUgKGkgPj0gMCAmJiBpIDwgdGhpcy5lbGVtZW50cy5sZW5ndGgpIHtcblx0XHRcdGNvbnN0IGVsID0gdGhpcy5lbGVtZW50c1tpXTtcblx0XHRcdGlmICh0aGlzLmlzQmxvY2tTdGFydChlbCkpIHtcblx0XHRcdFx0dGhpcy5jdXJyZW50SW5kZXggPSBpO1xuXHRcdFx0XHR0aGlzLm9uRm9jdXNDaGFuZ2UoZWwsIHRydWUpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpICs9IHN0ZXA7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBpc0Jsb2NrU3RhcnQoZWw6IEhUTUxFbGVtZW50KTogYm9vbGVhbiB7XG5cdFx0Ly8gSGVhZGluZ3MgYXJlIGFsd2F5cyBibG9jayBzdGFydHNcblx0XHRpZiAoL15IWzEtNl0kLy50ZXN0KGVsLnRhZ05hbWUpKSByZXR1cm4gdHJ1ZTtcblx0XHQvLyBMaXN0IGl0ZW1zIGFyZSBibG9jayBzdGFydHNcblx0XHRpZiAoZWwuY2xhc3NMaXN0LmNvbnRhaW5zKFwiYXItbGlzdC1pdGVtXCIpKSByZXR1cm4gdHJ1ZTtcblx0XHQvLyBGaXJzdCBzZW50ZW5jZSBvZiBhIHBhcmFncmFwaFxuXHRcdGlmIChcblx0XHRcdGVsLmNsYXNzTGlzdC5jb250YWlucyhcImFyLXNlbnRlbmNlXCIpICYmXG5cdFx0XHRlbC5kYXRhc2V0LnNlbnRlbmNlSW5kZXggPT09IFwiMFwiXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Ly8gXHUyNTAwXHUyNTAwIFNlbnRlbmNlIG5hdmlnYXRpb24gKFx1MjE5MCAvIFx1MjE5MikgXHUyNTAwXHUyNTAwXG5cdC8vIE1vdmVzIHRvIHRoZSBuZXh0L3ByZXZpb3VzIHNlbnRlbmNlIHdpdGhpbiB0aGUgc2FtZSBwYXJlbnQgcGFyYWdyYXBoLlxuXG5cdG1vdmVTZW50ZW5jZShkaXJlY3Rpb246IFwibGVmdFwiIHwgXCJyaWdodFwiKSB7XG5cdFx0Y29uc3QgY3VycmVudCA9IHRoaXMuY3VycmVudDtcblx0XHRpZiAoIWN1cnJlbnQgfHwgIWN1cnJlbnQuY2xhc3NMaXN0LmNvbnRhaW5zKFwiYXItc2VudGVuY2VcIikpIHtcblx0XHRcdC8vIElmIG9uIGEgaGVhZGluZyBvciBsaXN0IGl0ZW0sIHRyZWF0IGxlZnQvcmlnaHQgYXMgYmxvY2sgbmF2XG5cdFx0XHR0aGlzLm1vdmVCbG9jayhkaXJlY3Rpb24gPT09IFwicmlnaHRcIiA/IFwiZG93blwiIDogXCJ1cFwiKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBwYXJlbnQgPSBjdXJyZW50LnBhcmVudEVsZW1lbnQ7XG5cdFx0aWYgKCFwYXJlbnQpIHJldHVybjtcblxuXHRcdGNvbnN0IHN0ZXAgPSBkaXJlY3Rpb24gPT09IFwicmlnaHRcIiA/IDEgOiAtMTtcblx0XHRsZXQgaSA9IHRoaXMuY3VycmVudEluZGV4ICsgc3RlcDtcblxuXHRcdHdoaWxlIChpID49IDAgJiYgaSA8IHRoaXMuZWxlbWVudHMubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCBlbCA9IHRoaXMuZWxlbWVudHNbaV07XG5cdFx0XHQvLyBNdXN0IGJlIGEgc2VudGVuY2UgaW4gdGhlIHNhbWUgcGFyZW50IHBhcmFncmFwaFxuXHRcdFx0aWYgKGVsLmNsYXNzTGlzdC5jb250YWlucyhcImFyLXNlbnRlbmNlXCIpICYmIGVsLnBhcmVudEVsZW1lbnQgPT09IHBhcmVudCkge1xuXHRcdFx0XHR0aGlzLmN1cnJlbnRJbmRleCA9IGk7XG5cdFx0XHRcdHRoaXMub25Gb2N1c0NoYW5nZShlbCwgdHJ1ZSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdC8vIElmIHdlJ3ZlIGxlZnQgdGhpcyBwYXJhZ3JhcGgsIHN0b3Bcblx0XHRcdGlmIChlbC5wYXJlbnRFbGVtZW50ICE9PSBwYXJlbnQpIHJldHVybjtcblx0XHRcdGkgKz0gc3RlcDtcblx0XHR9XG5cdH1cblxuXHQvLyBcdTI1MDBcdTI1MDAgSGlnaGxpZ2h0IG9ubHkgKEVudGVyIGtleSkgXHUyNTAwXHUyNTAwXG5cblx0aGlnaGxpZ2h0Q3VycmVudCgpIHtcblx0XHRpZiAodGhpcy5jdXJyZW50KSB7XG5cdFx0XHR0aGlzLm9uRm9jdXNDaGFuZ2UodGhpcy5jdXJyZW50LCBmYWxzZSk7XG5cdFx0fVxuXHR9XG59XG4iLCAiaW1wb3J0IHsgcmVxdWVzdFVybCB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRUU0VuZ2luZSB7XG5cdHNwZWFrKHRleHQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD47XG5cdGNhbmNlbCgpOiB2b2lkO1xuXHRpc1NwZWFraW5nKCk6IGJvb2xlYW47XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBXZWIgU3BlZWNoIEFQSSAoYnVpbHQtaW4sIG5vIEFQSSBrZXkgbmVlZGVkKSBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGNsYXNzIFdlYlNwZWVjaEVuZ2luZSBpbXBsZW1lbnRzIFRUU0VuZ2luZSB7XG5cdHByaXZhdGUgcmF0ZTogbnVtYmVyO1xuXHRwcml2YXRlIHNwZWFraW5nID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IocmF0ZSA9IDEuMCkge1xuXHRcdHRoaXMucmF0ZSA9IHJhdGU7XG5cdH1cblxuXHRzZXRSYXRlKHJhdGU6IG51bWJlcikge1xuXHRcdHRoaXMucmF0ZSA9IHJhdGU7XG5cdH1cblxuXHRzcGVhayh0ZXh0OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcblx0XHRcdHRoaXMuY2FuY2VsKCk7XG5cdFx0XHRjb25zdCB1dHRlcmFuY2UgPSBuZXcgU3BlZWNoU3ludGhlc2lzVXR0ZXJhbmNlKHRleHQpO1xuXHRcdFx0dXR0ZXJhbmNlLnJhdGUgPSB0aGlzLnJhdGU7XG5cdFx0XHR1dHRlcmFuY2Uub25lbmQgPSAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuc3BlYWtpbmcgPSBmYWxzZTtcblx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0fTtcblx0XHRcdHV0dGVyYW5jZS5vbmVycm9yID0gKCkgPT4ge1xuXHRcdFx0XHR0aGlzLnNwZWFraW5nID0gZmFsc2U7XG5cdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdH07XG5cdFx0XHR0aGlzLnNwZWFraW5nID0gdHJ1ZTtcblx0XHRcdHdpbmRvdy5zcGVlY2hTeW50aGVzaXMuc3BlYWsodXR0ZXJhbmNlKTtcblx0XHR9KTtcblx0fVxuXG5cdGNhbmNlbCgpOiB2b2lkIHtcblx0XHR3aW5kb3cuc3BlZWNoU3ludGhlc2lzLmNhbmNlbCgpO1xuXHRcdHRoaXMuc3BlYWtpbmcgPSBmYWxzZTtcblx0fVxuXG5cdGlzU3BlYWtpbmcoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuc3BlYWtpbmc7XG5cdH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIEVsZXZlbkxhYnMgQVBJIFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgY2xhc3MgRWxldmVuTGFic0VuZ2luZSBpbXBsZW1lbnRzIFRUU0VuZ2luZSB7XG5cdHByaXZhdGUgYXBpS2V5OiBzdHJpbmc7XG5cdHByaXZhdGUgdm9pY2VJZDogc3RyaW5nO1xuXHRwcml2YXRlIHJhdGU6IG51bWJlcjtcblx0cHJpdmF0ZSBhdWRpb0NvbnRleHQ6IEF1ZGlvQ29udGV4dCB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHNvdXJjZU5vZGU6IEF1ZGlvQnVmZmVyU291cmNlTm9kZSB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHNwZWFraW5nID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoYXBpS2V5OiBzdHJpbmcsIHZvaWNlSWQgPSBcIjIxbTAwVGNtNFRsdkRxOGlrV0FNXCIsIHJhdGUgPSAxLjApIHtcblx0XHR0aGlzLmFwaUtleSA9IGFwaUtleTtcblx0XHR0aGlzLnZvaWNlSWQgPSB2b2ljZUlkO1xuXHRcdHRoaXMucmF0ZSA9IHJhdGU7XG5cdH1cblxuXHRzZXRBcGlLZXkoYXBpS2V5OiBzdHJpbmcpIHtcblx0XHR0aGlzLmFwaUtleSA9IGFwaUtleTtcblx0fVxuXG5cdHNldFZvaWNlSWQodm9pY2VJZDogc3RyaW5nKSB7XG5cdFx0dGhpcy52b2ljZUlkID0gdm9pY2VJZDtcblx0fVxuXG5cdHNldFJhdGUocmF0ZTogbnVtYmVyKSB7XG5cdFx0dGhpcy5yYXRlID0gcmF0ZTtcblx0fVxuXG5cdGFzeW5jIHNwZWFrKHRleHQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuY2FuY2VsKCk7XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0VXJsKHtcblx0XHRcdFx0dXJsOiBgaHR0cHM6Ly9hcGkuZWxldmVubGFicy5pby92MS90ZXh0LXRvLXNwZWVjaC8ke3RoaXMudm9pY2VJZH1gLFxuXHRcdFx0XHRtZXRob2Q6IFwiUE9TVFwiLFxuXHRcdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdFx0XCJ4aS1hcGkta2V5XCI6IHRoaXMuYXBpS2V5LFxuXHRcdFx0XHRcdFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxuXHRcdFx0XHRcdEFjY2VwdDogXCJhdWRpby9tcGVnXCIsXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdFx0XHR0ZXh0LFxuXHRcdFx0XHRcdG1vZGVsX2lkOiBcImVsZXZlbl9tb25vbGluZ3VhbF92MVwiLFxuXHRcdFx0XHRcdHZvaWNlX3NldHRpbmdzOiB7XG5cdFx0XHRcdFx0XHRzdGFiaWxpdHk6IDAuNSxcblx0XHRcdFx0XHRcdHNpbWlsYXJpdHlfYm9vc3Q6IDAuNzUsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSksXG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKCF0aGlzLmF1ZGlvQ29udGV4dCkge1xuXHRcdFx0XHR0aGlzLmF1ZGlvQ29udGV4dCA9IG5ldyBBdWRpb0NvbnRleHQoKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgYXVkaW9CdWZmZXIgPSBhd2FpdCB0aGlzLmF1ZGlvQ29udGV4dC5kZWNvZGVBdWRpb0RhdGEoXG5cdFx0XHRcdHJlc3BvbnNlLmFycmF5QnVmZmVyLnNsaWNlKDApXG5cdFx0XHQpO1xuXG5cdFx0XHR0aGlzLnNvdXJjZU5vZGUgPSB0aGlzLmF1ZGlvQ29udGV4dC5jcmVhdGVCdWZmZXJTb3VyY2UoKTtcblx0XHRcdHRoaXMuc291cmNlTm9kZS5idWZmZXIgPSBhdWRpb0J1ZmZlcjtcblx0XHRcdHRoaXMuc291cmNlTm9kZS5wbGF5YmFja1JhdGUudmFsdWUgPSB0aGlzLnJhdGU7XG5cdFx0XHR0aGlzLnNvdXJjZU5vZGUuY29ubmVjdCh0aGlzLmF1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG5cblx0XHRcdHRoaXMuc3BlYWtpbmcgPSB0cnVlO1xuXHRcdFx0dGhpcy5zb3VyY2VOb2RlLm9uZW5kZWQgPSAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuc3BlYWtpbmcgPSBmYWxzZTtcblx0XHRcdFx0dGhpcy5zb3VyY2VOb2RlID0gbnVsbDtcblx0XHRcdH07XG5cdFx0XHR0aGlzLnNvdXJjZU5vZGUuc3RhcnQoKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKFwiRWxldmVuTGFicyBUVFMgZXJyb3I6XCIsIGUpO1xuXHRcdFx0dGhpcy5zcGVha2luZyA9IGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdGNhbmNlbCgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5zb3VyY2VOb2RlKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR0aGlzLnNvdXJjZU5vZGUuc3RvcCgpO1xuXHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdC8vIGFscmVhZHkgc3RvcHBlZFxuXHRcdFx0fVxuXHRcdFx0dGhpcy5zb3VyY2VOb2RlID0gbnVsbDtcblx0XHR9XG5cdFx0dGhpcy5zcGVha2luZyA9IGZhbHNlO1xuXHR9XG5cblx0aXNTcGVha2luZygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5zcGVha2luZztcblx0fVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgRmFjdG9yeSBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVRUU0VuZ2luZShcblx0YXBpS2V5OiBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdHZvaWNlSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCxcblx0cmF0ZTogbnVtYmVyXG4pOiBUVFNFbmdpbmUge1xuXHRpZiAoYXBpS2V5ICYmIGFwaUtleS50cmltKCkubGVuZ3RoID4gMCkge1xuXHRcdHJldHVybiBuZXcgRWxldmVuTGFic0VuZ2luZShhcGlLZXksIHZvaWNlSWQgfHwgdW5kZWZpbmVkLCByYXRlKTtcblx0fVxuXHRyZXR1cm4gbmV3IFdlYlNwZWVjaEVuZ2luZShyYXRlKTtcbn1cbiIsICJpbXBvcnQgeyBBcHAsIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIEFydGljbGVSZWFkZXJQbHVnaW4gZnJvbSBcIi4uL21haW5cIjtcblxuZXhwb3J0IGludGVyZmFjZSBBcnRpY2xlUmVhZGVyU2V0dGluZ3Mge1xuXHRlbGV2ZW5MYWJzQXBpS2V5OiBzdHJpbmc7XG5cdGVsZXZlbkxhYnNWb2ljZUlkOiBzdHJpbmc7XG5cdHNwZWVjaFJhdGU6IG51bWJlcjtcblx0Zm9udFNpemU6IG51bWJlcjtcblx0bGluZUhlaWdodDogbnVtYmVyO1xufVxuXG5leHBvcnQgY29uc3QgREVGQVVMVF9TRVRUSU5HUzogQXJ0aWNsZVJlYWRlclNldHRpbmdzID0ge1xuXHRlbGV2ZW5MYWJzQXBpS2V5OiBcIlwiLFxuXHRlbGV2ZW5MYWJzVm9pY2VJZDogXCIyMW0wMFRjbTRUbHZEcThpa1dBTVwiLCAvLyBSYWNoZWxcblx0c3BlZWNoUmF0ZTogMS4wLFxuXHRmb250U2l6ZTogMTgsXG5cdGxpbmVIZWlnaHQ6IDEuOCxcbn07XG5cbmV4cG9ydCBjbGFzcyBBcnRpY2xlUmVhZGVyU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuXHRwbHVnaW46IEFydGljbGVSZWFkZXJQbHVnaW47XG5cblx0Y29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogQXJ0aWNsZVJlYWRlclBsdWdpbikge1xuXHRcdHN1cGVyKGFwcCwgcGx1Z2luKTtcblx0XHR0aGlzLnBsdWdpbiA9IHBsdWdpbjtcblx0fVxuXG5cdGRpc3BsYXkoKTogdm9pZCB7XG5cdFx0Y29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcblx0XHRjb250YWluZXJFbC5lbXB0eSgpO1xuXG5cdFx0Y29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwiQXJ0aWNsZSBSZWFkZXIgU2V0dGluZ3NcIiB9KTtcblxuXHRcdC8vIFx1MjUwMFx1MjUwMCBUVFMgU2VjdGlvbiBcdTI1MDBcdTI1MDBcblx0XHRjb250YWluZXJFbC5jcmVhdGVFbChcImgzXCIsIHsgdGV4dDogXCJUZXh0LXRvLVNwZWVjaFwiIH0pO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZShcIlNwZWVjaCByYXRlXCIpXG5cdFx0XHQuc2V0RGVzYyhcIlBsYXliYWNrIHNwZWVkICgwLjV4IFx1MjAxMyAyLjB4KVwiKVxuXHRcdFx0LmFkZFNsaWRlcigoc2xpZGVyKSA9PlxuXHRcdFx0XHRzbGlkZXJcblx0XHRcdFx0XHQuc2V0TGltaXRzKDAuNSwgMi4wLCAwLjEpXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnNwZWVjaFJhdGUpXG5cdFx0XHRcdFx0LnNldER5bmFtaWNUb29sdGlwKClcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5zcGVlY2hSYXRlID0gdmFsdWU7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KVxuXHRcdFx0KTtcblxuXHRcdC8vIFx1MjUwMFx1MjUwMCBFbGV2ZW5MYWJzIFNlY3Rpb24gXHUyNTAwXHUyNTAwXG5cdFx0Y29udGFpbmVyRWwuY3JlYXRlRWwoXCJoM1wiLCB7IHRleHQ6IFwiRWxldmVuTGFicyAob3B0aW9uYWwpXCIgfSk7XG5cdFx0Y29udGFpbmVyRWwuY3JlYXRlRWwoXCJwXCIsIHtcblx0XHRcdHRleHQ6IFwiTGVhdmUgdGhlIEFQSSBrZXkgZW1wdHkgdG8gdXNlIHRoZSBidWlsdC1pbiBXZWIgU3BlZWNoIGVuZ2luZS5cIixcblx0XHRcdGNsczogXCJzZXR0aW5nLWl0ZW0tZGVzY3JpcHRpb25cIixcblx0XHR9KTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCJBUEkga2V5XCIpXG5cdFx0XHQuc2V0RGVzYyhcIllvdXIgRWxldmVuTGFicyBBUEkga2V5XCIpXG5cdFx0XHQuYWRkVGV4dCgodGV4dCkgPT5cblx0XHRcdFx0dGV4dFxuXHRcdFx0XHRcdC5zZXRQbGFjZWhvbGRlcihcIkVudGVyIEFQSSBrZXkuLi5cIilcblx0XHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZWxldmVuTGFic0FwaUtleSlcblx0XHRcdFx0XHQudGhlbigodCkgPT4gKHQuaW5wdXRFbC50eXBlID0gXCJwYXNzd29yZFwiKSlcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5lbGV2ZW5MYWJzQXBpS2V5ID0gdmFsdWU7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KVxuXHRcdFx0KTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCJWb2ljZSBJRFwiKVxuXHRcdFx0LnNldERlc2MoXCJFbGV2ZW5MYWJzIHZvaWNlIElEIChkZWZhdWx0OiBSYWNoZWwpXCIpXG5cdFx0XHQuYWRkVGV4dCgodGV4dCkgPT5cblx0XHRcdFx0dGV4dFxuXHRcdFx0XHRcdC5zZXRQbGFjZWhvbGRlcihcIjIxbTAwVGNtNFRsdkRxOGlrV0FNXCIpXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmVsZXZlbkxhYnNWb2ljZUlkKVxuXHRcdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmVsZXZlbkxhYnNWb2ljZUlkID0gdmFsdWU7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KVxuXHRcdFx0KTtcblxuXHRcdC8vIFx1MjUwMFx1MjUwMCBEaXNwbGF5IFNlY3Rpb24gXHUyNTAwXHUyNTAwXG5cdFx0Y29udGFpbmVyRWwuY3JlYXRlRWwoXCJoM1wiLCB7IHRleHQ6IFwiRGlzcGxheVwiIH0pO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZShcIkZvbnQgc2l6ZVwiKVxuXHRcdFx0LnNldERlc2MoXCJBcnRpY2xlIHRleHQgc2l6ZSBpbiBwaXhlbHNcIilcblx0XHRcdC5hZGRTbGlkZXIoKHNsaWRlcikgPT5cblx0XHRcdFx0c2xpZGVyXG5cdFx0XHRcdFx0LnNldExpbWl0cygxMiwgMjgsIDEpXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmZvbnRTaXplKVxuXHRcdFx0XHRcdC5zZXREeW5hbWljVG9vbHRpcCgpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9udFNpemUgPSB2YWx1ZTtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdH0pXG5cdFx0XHQpO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZShcIkxpbmUgaGVpZ2h0XCIpXG5cdFx0XHQuc2V0RGVzYyhcIkxpbmUgc3BhY2luZyBtdWx0aXBsaWVyXCIpXG5cdFx0XHQuYWRkU2xpZGVyKChzbGlkZXIpID0+XG5cdFx0XHRcdHNsaWRlclxuXHRcdFx0XHRcdC5zZXRMaW1pdHMoMS4yLCAyLjQsIDAuMSlcblx0XHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MubGluZUhlaWdodClcblx0XHRcdFx0XHQuc2V0RHluYW1pY1Rvb2x0aXAoKVxuXHRcdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmxpbmVIZWlnaHQgPSB2YWx1ZTtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdH0pXG5cdFx0XHQpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBQUFBLG1CQUE2Qzs7O0FDQTdDLElBQUFDLG1CQU1POzs7QUNHQSxJQUFNLHVCQUFOLE1BQTJCO0FBQUEsRUFLakMsWUFBWSxlQUFnRTtBQUo1RSxTQUFRLFdBQXlCLENBQUM7QUFDbEMsU0FBUSxlQUFlO0FBSXRCLFNBQUssZ0JBQWdCO0FBQUEsRUFDdEI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFPQSxRQUFRLFdBQXdCO0FBQy9CLFNBQUssV0FBVyxNQUFNO0FBQUEsTUFDckIsVUFBVTtBQUFBLFFBQ1Q7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUNBLFNBQUssZUFBZTtBQUFBLEVBQ3JCO0FBQUEsRUFFQSxJQUFJLFVBQTZCO0FBaENsQztBQWlDRSxZQUFPLFVBQUssU0FBUyxLQUFLLFlBQVksTUFBL0IsWUFBb0M7QUFBQSxFQUM1QztBQUFBLEVBRUEsYUFBYSxJQUFnQixPQUFnQjtBQUM1QyxVQUFNLE1BQU0sS0FBSyxTQUFTLFFBQVEsRUFBRTtBQUNwQyxRQUFJLE9BQU8sR0FBRztBQUNiLFdBQUssZUFBZTtBQUNwQixXQUFLLGNBQWMsSUFBSSxLQUFLO0FBQUEsSUFDN0I7QUFBQSxFQUNEO0FBQUE7QUFBQSxFQUlBLGNBQWMsT0FBZSxTQUFrQjtBQUM5QyxVQUFNLE1BQU0sSUFBSTtBQUNoQixVQUFNLFFBQVEsS0FBSztBQUVuQixRQUFJLFNBQVM7QUFDWixlQUFTLElBQUksUUFBUSxHQUFHLEtBQUssR0FBRyxLQUFLO0FBQ3BDLFlBQUksS0FBSyxTQUFTLENBQUMsRUFBRSxZQUFZLEtBQUs7QUFDckMsZUFBSyxlQUFlO0FBQ3BCLGVBQUssY0FBYyxLQUFLLFNBQVMsQ0FBQyxHQUFHLElBQUk7QUFDekM7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0QsT0FBTztBQUNOLGVBQVMsSUFBSSxRQUFRLEdBQUcsSUFBSSxLQUFLLFNBQVMsUUFBUSxLQUFLO0FBQ3RELFlBQUksS0FBSyxTQUFTLENBQUMsRUFBRSxZQUFZLEtBQUs7QUFDckMsZUFBSyxlQUFlO0FBQ3BCLGVBQUssY0FBYyxLQUFLLFNBQVMsQ0FBQyxHQUFHLElBQUk7QUFDekM7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUE7QUFBQSxFQUlBLGlCQUFpQixTQUFrQjtBQUNsQyxVQUFNLFFBQVEsS0FBSztBQUNuQixRQUFJLFNBQVM7QUFDWixlQUFTLElBQUksUUFBUSxHQUFHLEtBQUssR0FBRyxLQUFLO0FBQ3BDLFlBQUksV0FBVyxLQUFLLEtBQUssU0FBUyxDQUFDLEVBQUUsT0FBTyxHQUFHO0FBQzlDLGVBQUssZUFBZTtBQUNwQixlQUFLLGNBQWMsS0FBSyxTQUFTLENBQUMsR0FBRyxJQUFJO0FBQ3pDO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNELE9BQU87QUFDTixlQUFTLElBQUksUUFBUSxHQUFHLElBQUksS0FBSyxTQUFTLFFBQVEsS0FBSztBQUN0RCxZQUFJLFdBQVcsS0FBSyxLQUFLLFNBQVMsQ0FBQyxFQUFFLE9BQU8sR0FBRztBQUM5QyxlQUFLLGVBQWU7QUFDcEIsZUFBSyxjQUFjLEtBQUssU0FBUyxDQUFDLEdBQUcsSUFBSTtBQUN6QztBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQTtBQUFBLEVBSUEsZ0JBQWdCLFNBQWtCO0FBQ2pDLFVBQU0sUUFBUSxLQUFLO0FBQ25CLFFBQUksU0FBUztBQUNaLGVBQVMsSUFBSSxRQUFRLEdBQUcsS0FBSyxHQUFHLEtBQUs7QUFDcEMsWUFBSSxLQUFLLFNBQVMsQ0FBQyxFQUFFLFVBQVUsU0FBUyxnQkFBZ0IsR0FBRztBQUMxRCxlQUFLLGVBQWU7QUFDcEIsZUFBSyxjQUFjLEtBQUssU0FBUyxDQUFDLEdBQUcsSUFBSTtBQUN6QztBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDRCxPQUFPO0FBQ04sZUFBUyxJQUFJLFFBQVEsR0FBRyxJQUFJLEtBQUssU0FBUyxRQUFRLEtBQUs7QUFDdEQsWUFBSSxLQUFLLFNBQVMsQ0FBQyxFQUFFLFVBQVUsU0FBUyxnQkFBZ0IsR0FBRztBQUMxRCxlQUFLLGVBQWU7QUFDcEIsZUFBSyxjQUFjLEtBQUssU0FBUyxDQUFDLEdBQUcsSUFBSTtBQUN6QztBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFRQSxVQUFVLFdBQTBCO0FBQ25DLFVBQU0sT0FBTyxjQUFjLFNBQVMsSUFBSTtBQUN4QyxRQUFJLElBQUksS0FBSyxlQUFlO0FBRTVCLFdBQU8sS0FBSyxLQUFLLElBQUksS0FBSyxTQUFTLFFBQVE7QUFDMUMsWUFBTSxLQUFLLEtBQUssU0FBUyxDQUFDO0FBQzFCLFVBQUksS0FBSyxhQUFhLEVBQUUsR0FBRztBQUMxQixhQUFLLGVBQWU7QUFDcEIsYUFBSyxjQUFjLElBQUksSUFBSTtBQUMzQjtBQUFBLE1BQ0Q7QUFDQSxXQUFLO0FBQUEsSUFDTjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLGFBQWEsSUFBMEI7QUFFOUMsUUFBSSxXQUFXLEtBQUssR0FBRyxPQUFPO0FBQUcsYUFBTztBQUV4QyxRQUFJLEdBQUcsVUFBVSxTQUFTLGNBQWM7QUFBRyxhQUFPO0FBRWxELFFBQ0MsR0FBRyxVQUFVLFNBQVMsYUFBYSxLQUNuQyxHQUFHLFFBQVEsa0JBQWtCLEtBQzVCO0FBQ0QsYUFBTztBQUFBLElBQ1I7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBO0FBQUE7QUFBQSxFQUtBLGFBQWEsV0FBNkI7QUFDekMsVUFBTSxVQUFVLEtBQUs7QUFDckIsUUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLFVBQVUsU0FBUyxhQUFhLEdBQUc7QUFFM0QsV0FBSyxVQUFVLGNBQWMsVUFBVSxTQUFTLElBQUk7QUFDcEQ7QUFBQSxJQUNEO0FBRUEsVUFBTSxTQUFTLFFBQVE7QUFDdkIsUUFBSSxDQUFDO0FBQVE7QUFFYixVQUFNLE9BQU8sY0FBYyxVQUFVLElBQUk7QUFDekMsUUFBSSxJQUFJLEtBQUssZUFBZTtBQUU1QixXQUFPLEtBQUssS0FBSyxJQUFJLEtBQUssU0FBUyxRQUFRO0FBQzFDLFlBQU0sS0FBSyxLQUFLLFNBQVMsQ0FBQztBQUUxQixVQUFJLEdBQUcsVUFBVSxTQUFTLGFBQWEsS0FBSyxHQUFHLGtCQUFrQixRQUFRO0FBQ3hFLGFBQUssZUFBZTtBQUNwQixhQUFLLGNBQWMsSUFBSSxJQUFJO0FBQzNCO0FBQUEsTUFDRDtBQUVBLFVBQUksR0FBRyxrQkFBa0I7QUFBUTtBQUNqQyxXQUFLO0FBQUEsSUFDTjtBQUFBLEVBQ0Q7QUFBQTtBQUFBLEVBSUEsbUJBQW1CO0FBQ2xCLFFBQUksS0FBSyxTQUFTO0FBQ2pCLFdBQUssY0FBYyxLQUFLLFNBQVMsS0FBSztBQUFBLElBQ3ZDO0FBQUEsRUFDRDtBQUNEOzs7QUM3TEEsc0JBQTJCO0FBVXBCLElBQU0sa0JBQU4sTUFBMkM7QUFBQSxFQUlqRCxZQUFZLE9BQU8sR0FBSztBQUZ4QixTQUFRLFdBQVc7QUFHbEIsU0FBSyxPQUFPO0FBQUEsRUFDYjtBQUFBLEVBRUEsUUFBUSxNQUFjO0FBQ3JCLFNBQUssT0FBTztBQUFBLEVBQ2I7QUFBQSxFQUVBLE1BQU0sTUFBNkI7QUFDbEMsV0FBTyxJQUFJLFFBQVEsQ0FBQyxZQUFZO0FBQy9CLFdBQUssT0FBTztBQUNaLFlBQU0sWUFBWSxJQUFJLHlCQUF5QixJQUFJO0FBQ25ELGdCQUFVLE9BQU8sS0FBSztBQUN0QixnQkFBVSxRQUFRLE1BQU07QUFDdkIsYUFBSyxXQUFXO0FBQ2hCLGdCQUFRO0FBQUEsTUFDVDtBQUNBLGdCQUFVLFVBQVUsTUFBTTtBQUN6QixhQUFLLFdBQVc7QUFDaEIsZ0JBQVE7QUFBQSxNQUNUO0FBQ0EsV0FBSyxXQUFXO0FBQ2hCLGFBQU8sZ0JBQWdCLE1BQU0sU0FBUztBQUFBLElBQ3ZDLENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFQSxTQUFlO0FBQ2QsV0FBTyxnQkFBZ0IsT0FBTztBQUM5QixTQUFLLFdBQVc7QUFBQSxFQUNqQjtBQUFBLEVBRUEsYUFBc0I7QUFDckIsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUNEO0FBSU8sSUFBTSxtQkFBTixNQUE0QztBQUFBLEVBUWxELFlBQVksUUFBZ0IsVUFBVSx3QkFBd0IsT0FBTyxHQUFLO0FBSjFFLFNBQVEsZUFBb0M7QUFDNUMsU0FBUSxhQUEyQztBQUNuRCxTQUFRLFdBQVc7QUFHbEIsU0FBSyxTQUFTO0FBQ2QsU0FBSyxVQUFVO0FBQ2YsU0FBSyxPQUFPO0FBQUEsRUFDYjtBQUFBLEVBRUEsVUFBVSxRQUFnQjtBQUN6QixTQUFLLFNBQVM7QUFBQSxFQUNmO0FBQUEsRUFFQSxXQUFXLFNBQWlCO0FBQzNCLFNBQUssVUFBVTtBQUFBLEVBQ2hCO0FBQUEsRUFFQSxRQUFRLE1BQWM7QUFDckIsU0FBSyxPQUFPO0FBQUEsRUFDYjtBQUFBLEVBRUEsTUFBTSxNQUFNLE1BQTZCO0FBQ3hDLFNBQUssT0FBTztBQUVaLFFBQUk7QUFDSCxZQUFNLFdBQVcsVUFBTSw0QkFBVztBQUFBLFFBQ2pDLEtBQUssK0NBQStDLEtBQUs7QUFBQSxRQUN6RCxRQUFRO0FBQUEsUUFDUixTQUFTO0FBQUEsVUFDUixjQUFjLEtBQUs7QUFBQSxVQUNuQixnQkFBZ0I7QUFBQSxVQUNoQixRQUFRO0FBQUEsUUFDVDtBQUFBLFFBQ0EsTUFBTSxLQUFLLFVBQVU7QUFBQSxVQUNwQjtBQUFBLFVBQ0EsVUFBVTtBQUFBLFVBQ1YsZ0JBQWdCO0FBQUEsWUFDZixXQUFXO0FBQUEsWUFDWCxrQkFBa0I7QUFBQSxVQUNuQjtBQUFBLFFBQ0QsQ0FBQztBQUFBLE1BQ0YsQ0FBQztBQUVELFVBQUksQ0FBQyxLQUFLLGNBQWM7QUFDdkIsYUFBSyxlQUFlLElBQUksYUFBYTtBQUFBLE1BQ3RDO0FBRUEsWUFBTSxjQUFjLE1BQU0sS0FBSyxhQUFhO0FBQUEsUUFDM0MsU0FBUyxZQUFZLE1BQU0sQ0FBQztBQUFBLE1BQzdCO0FBRUEsV0FBSyxhQUFhLEtBQUssYUFBYSxtQkFBbUI7QUFDdkQsV0FBSyxXQUFXLFNBQVM7QUFDekIsV0FBSyxXQUFXLGFBQWEsUUFBUSxLQUFLO0FBQzFDLFdBQUssV0FBVyxRQUFRLEtBQUssYUFBYSxXQUFXO0FBRXJELFdBQUssV0FBVztBQUNoQixXQUFLLFdBQVcsVUFBVSxNQUFNO0FBQy9CLGFBQUssV0FBVztBQUNoQixhQUFLLGFBQWE7QUFBQSxNQUNuQjtBQUNBLFdBQUssV0FBVyxNQUFNO0FBQUEsSUFDdkIsU0FBUyxHQUFQO0FBQ0QsY0FBUSxNQUFNLHlCQUF5QixDQUFDO0FBQ3hDLFdBQUssV0FBVztBQUFBLElBQ2pCO0FBQUEsRUFDRDtBQUFBLEVBRUEsU0FBZTtBQUNkLFFBQUksS0FBSyxZQUFZO0FBQ3BCLFVBQUk7QUFDSCxhQUFLLFdBQVcsS0FBSztBQUFBLE1BQ3RCLFNBQVEsR0FBTjtBQUFBLE1BRUY7QUFDQSxXQUFLLGFBQWE7QUFBQSxJQUNuQjtBQUNBLFNBQUssV0FBVztBQUFBLEVBQ2pCO0FBQUEsRUFFQSxhQUFzQjtBQUNyQixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQ0Q7QUFJTyxTQUFTLGdCQUNmLFFBQ0EsU0FDQSxNQUNZO0FBQ1osTUFBSSxVQUFVLE9BQU8sS0FBSyxFQUFFLFNBQVMsR0FBRztBQUN2QyxXQUFPLElBQUksaUJBQWlCLFFBQVEsV0FBVyxRQUFXLElBQUk7QUFBQSxFQUMvRDtBQUNBLFNBQU8sSUFBSSxnQkFBZ0IsSUFBSTtBQUNoQzs7O0FGOUlPLElBQU0sb0JBQW9CO0FBRTFCLElBQU0sY0FBTixjQUEwQiwwQkFBUztBQUFBLEVBV3pDLFlBQVksTUFBcUIsUUFBNkI7QUFDN0QsVUFBTSxJQUFJO0FBVlgsU0FBUSxPQUFxQjtBQUM3QixTQUFRLGFBQWlDO0FBR3pDLFNBQVEsWUFBZ0M7QUFDeEMsU0FBUSxhQUFrRDtBQUMxRCxTQUFRLG1CQUFrQztBQUMxQyxTQUFRLG1CQUFtQjtBQUkxQixTQUFLLFNBQVM7QUFDZCxTQUFLLE1BQU0sS0FBSyxTQUFTO0FBQ3pCLFNBQUssTUFBTSxJQUFJO0FBQUEsTUFBcUIsQ0FBQyxJQUFJLFVBQ3hDLEtBQUssa0JBQWtCLElBQUksS0FBSztBQUFBLElBQ2pDO0FBQUEsRUFDRDtBQUFBLEVBRUEsY0FBc0I7QUFDckIsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLGlCQUF5QjtBQUN4QixXQUFPLEtBQUssT0FBTyxZQUFZLEtBQUssS0FBSyxhQUFhO0FBQUEsRUFDdkQ7QUFBQSxFQUVBLFVBQWtCO0FBQ2pCLFdBQU87QUFBQSxFQUNSO0FBQUE7QUFBQSxFQUlBLE1BQU0sU0FBUztBQUNkLFVBQU0sWUFBWSxLQUFLLFlBQVksU0FBUyxDQUFDO0FBQzdDLGNBQVUsTUFBTTtBQUNoQixjQUFVLFNBQVMsY0FBYztBQUVqQyxTQUFLLGFBQWEsVUFBVSxVQUFVLEVBQUUsS0FBSyxhQUFhLENBQUM7QUFHM0QsU0FBSyxhQUFhLENBQUMsTUFBcUIsS0FBSyxVQUFVLENBQUM7QUFDeEQsY0FBVSxpQkFBaUIsV0FBVyxLQUFLLFVBQVU7QUFDckQsY0FBVSxhQUFhLFlBQVksR0FBRztBQUd0QyxTQUFLO0FBQUEsTUFDSixLQUFLLElBQUksTUFBTSxHQUFHLFVBQVUsQ0FBQyxTQUFTO0FBQ3JDLFlBQUksZ0JBQWdCLDBCQUFTLFNBQVMsS0FBSyxNQUFNO0FBQ2hELGNBQUksS0FBSyxrQkFBa0I7QUFDMUIsaUJBQUssbUJBQW1CO0FBQ3hCO0FBQUEsVUFDRDtBQUNBLGVBQUssY0FBYztBQUFBLFFBQ3BCO0FBQUEsTUFDRCxDQUFDO0FBQUEsSUFDRjtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQU0sVUFBVTtBQUNmLFNBQUssSUFBSSxPQUFPO0FBQ2hCLFFBQUksS0FBSyxZQUFZO0FBQ3BCLFlBQU0sWUFBWSxLQUFLLFlBQVksU0FBUyxDQUFDO0FBQzdDLGdCQUFVLG9CQUFvQixXQUFXLEtBQUssVUFBVTtBQUFBLElBQ3pEO0FBQUEsRUFDRDtBQUFBO0FBQUEsRUFJQSxNQUFNLFFBQVEsTUFBYTtBQUMxQixTQUFLLE9BQU87QUFDWixVQUFNLEtBQUssY0FBYztBQUFBLEVBQzFCO0FBQUEsRUFFQSxhQUFhO0FBQ1osU0FBSyxJQUFJLE9BQU87QUFDaEIsU0FBSyxNQUFNLEtBQUssU0FBUztBQUFBLEVBQzFCO0FBQUEsRUFFUSxXQUFzQjtBQUM3QixVQUFNLElBQUksS0FBSyxPQUFPO0FBQ3RCLFdBQU8sZ0JBQWdCLEVBQUUsa0JBQWtCLEVBQUUsbUJBQW1CLEVBQUUsVUFBVTtBQUFBLEVBQzdFO0FBQUE7QUFBQSxFQUlBLE1BQWMsZ0JBQWdCO0FBQzdCLFFBQUksQ0FBQyxLQUFLLGNBQWMsQ0FBQyxLQUFLO0FBQU07QUFFcEMsVUFBTSxVQUFVLE1BQU0sS0FBSyxJQUFJLE1BQU0sV0FBVyxLQUFLLElBQUk7QUFDekQsU0FBSyxXQUFXLE1BQU07QUFHdEIsVUFBTSxJQUFJLEtBQUssT0FBTztBQUN0QixTQUFLLFdBQVcsTUFBTSxXQUFXLEdBQUcsRUFBRTtBQUN0QyxTQUFLLFdBQVcsTUFBTSxhQUFhLEdBQUcsRUFBRTtBQUd4QyxVQUFNLGtDQUFpQjtBQUFBLE1BQ3RCLEtBQUs7QUFBQSxNQUNMO0FBQUEsTUFDQSxLQUFLO0FBQUEsTUFDTCxLQUFLLEtBQUs7QUFBQSxNQUNWO0FBQUEsSUFDRDtBQUdBLFNBQUssWUFBWSxLQUFLLFVBQVU7QUFHaEMsU0FBSyxJQUFJLFFBQVEsS0FBSyxVQUFVO0FBR2hDLFNBQUssV0FBVyxpQkFBaUIsU0FBUyxDQUFDLE1BQU07QUFDaEQsWUFBTSxTQUFTLEVBQUU7QUFDakIsWUFBTSxRQUFRLE9BQU87QUFBQSxRQUNwQjtBQUFBLE1BQ0Q7QUFDQSxVQUFJLE9BQU87QUFDVixhQUFLLElBQUksYUFBYSxPQUFPLElBQUk7QUFBQSxNQUNsQztBQUFBLElBQ0QsQ0FBQztBQUdELFVBQU0sWUFBWSxLQUFLLFlBQVksU0FBUyxDQUFDO0FBQzdDLGNBQVUsTUFBTTtBQUFBLEVBQ2pCO0FBQUE7QUFBQSxFQUlRLFlBQVksV0FBd0I7QUFFM0MsY0FBVSxpQkFBOEIsd0JBQXdCLEVBQUUsUUFBUSxDQUFDLE1BQU07QUFDaEYsWUFBTSxRQUFRLEVBQUUsUUFBUSxPQUFPLENBQUM7QUFDaEMsUUFBRSxRQUFRLGVBQWU7QUFDekIsUUFBRSxVQUFVLElBQUksY0FBYztBQUFBLElBQy9CLENBQUM7QUFHRCxjQUFVLGlCQUE4QixHQUFHLEVBQUUsUUFBUSxDQUFDLE1BQU07QUFFM0QsVUFBSSxLQUFLLGVBQWUsQ0FBQztBQUFHO0FBQzVCLFdBQUssY0FBYyxDQUFDO0FBQUEsSUFDckIsQ0FBQztBQUlELGNBQVUsaUJBQThCLE1BQU0sRUFBRSxRQUFRLENBQUMsU0FBUztBQUNqRSxZQUFNLFNBQVMsS0FBSztBQUFBLFFBQ25CO0FBQUEsTUFDRDtBQUNBLFVBQUksUUFBUTtBQUNYLGVBQU8sVUFBVSxJQUFJLGdCQUFnQjtBQUFBLE1BQ3RDO0FBQUEsSUFDRCxDQUFDO0FBR0QsY0FDRSxpQkFBOEIsSUFBSSxFQUNsQyxRQUFRLENBQUMsT0FBTztBQTdLcEI7QUErS0ksWUFBTSxjQUFjLEtBQUssY0FBYyxFQUFFO0FBQ3pDLFVBQUksWUFBWSxLQUFLLEVBQUUsV0FBVztBQUFHO0FBR3JDLFlBQU0sT0FBTyxTQUFTLGNBQWMsTUFBTTtBQUMxQyxXQUFLLFlBQVk7QUFDakIsV0FBSyxjQUFjO0FBR25CLFlBQU0sYUFBYSxNQUFNLEtBQUssR0FBRyxVQUFVO0FBQzNDLFVBQUksV0FBVztBQUNmLGlCQUFXLFFBQVEsWUFBWTtBQUM5QixZQUFJLEtBQUssYUFBYSxLQUFLLGVBQWEsVUFBSyxnQkFBTCxtQkFBa0IsU0FBUTtBQUNqRSxjQUFJLENBQUMsVUFBVTtBQUNkLGVBQUcsYUFBYSxNQUFNLElBQUk7QUFDMUIsdUJBQVc7QUFBQSxVQUNaLE9BQU87QUFFTixpQkFBSyxlQUFlLE1BQU0sS0FBSyxZQUFZLEtBQUs7QUFDaEQsZUFBRyxZQUFZLElBQUk7QUFBQSxVQUNwQjtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDSDtBQUFBLEVBRVEsZUFBZSxHQUF5QjtBQXpNakQ7QUEyTUUsVUFBTSxRQUFPLGFBQUUsZ0JBQUYsbUJBQWUsV0FBZixZQUF5QjtBQUN0QyxRQUFJLEtBQUssV0FBVztBQUFHLGFBQU87QUFDOUIsUUFBSSxFQUFFLGNBQWMsNENBQTRDLEdBQUc7QUFFbEUsVUFBSSxLQUFLLFNBQVM7QUFBRyxlQUFPO0FBQUEsSUFDN0I7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsY0FBYyxHQUFnQjtBQXBOdkM7QUFzTkUsUUFBSSxFQUFFLFVBQVUsU0FBUyxhQUFhO0FBQUc7QUFFekMsVUFBTSxZQUFXLE9BQUUsZ0JBQUYsWUFBaUI7QUFDbEMsUUFBSSxTQUFTLEtBQUssRUFBRSxXQUFXO0FBQUc7QUFFbEMsVUFBTSxhQUFhLEtBQUssc0JBQXNCLFFBQVE7QUFDdEQsUUFBSSxXQUFXLFdBQVc7QUFBRztBQVc3QixVQUFNLFNBQWtCLENBQUM7QUFDekIsUUFBSSxZQUFZO0FBQ2hCLGVBQVcsU0FBUyxNQUFNLEtBQUssRUFBRSxVQUFVLEdBQUc7QUFDN0MsWUFBTSxLQUFJLFdBQU0sZ0JBQU4sWUFBcUI7QUFDL0IsYUFBTyxLQUFLO0FBQUEsUUFDWCxNQUFNLE1BQU0sYUFBYSxLQUFLLFlBQVksU0FBUztBQUFBLFFBQ25ELE1BQU07QUFBQSxRQUNOLE1BQU07QUFBQSxRQUNOLGFBQWE7QUFBQSxNQUNkLENBQUM7QUFDRCxtQkFBYSxFQUFFO0FBQUEsSUFDaEI7QUFJQSxVQUFNLGdCQUErQixDQUFDO0FBQ3RDLGFBQVMsSUFBSSxHQUFHLElBQUksV0FBVyxRQUFRLEtBQUs7QUFDM0MsWUFBTSxTQUFTLFdBQVcsQ0FBQztBQUMzQixZQUFNLE9BQ0wsSUFBSSxXQUFXLFNBQVMsSUFBSSxXQUFXLElBQUksQ0FBQyxJQUFJLFNBQVM7QUFFMUQsWUFBTSxPQUFPLFNBQVMsY0FBYyxNQUFNO0FBQzFDLFdBQUssWUFBWTtBQUNqQixXQUFLLFFBQVEsZ0JBQWdCLE9BQU8sQ0FBQztBQUVyQyxpQkFBVyxTQUFTLFFBQVE7QUFDM0IsY0FBTSxTQUFTLE1BQU07QUFDckIsY0FBTSxPQUFPLFNBQVMsTUFBTSxLQUFLO0FBR2pDLFlBQUksUUFBUSxVQUFVLFVBQVU7QUFBTTtBQUV0QyxZQUFJLE1BQU0sU0FBUyxXQUFXO0FBRTdCLGNBQUksVUFBVSxVQUFVLFFBQVEsTUFBTTtBQUNyQyxpQkFBSyxZQUFZLE1BQU0sS0FBSyxVQUFVLElBQUksQ0FBQztBQUFBLFVBQzVDLE9BQU87QUFHTixrQkFBTSxVQUFVLEtBQUssSUFBSSxNQUFNLElBQUksSUFBSSxLQUFLLElBQUksUUFBUSxNQUFNO0FBQzlELGdCQUFJLFVBQVUsTUFBTSxLQUFLLFNBQVMsR0FBRztBQUNwQyxtQkFBSyxZQUFZLE1BQU0sS0FBSyxVQUFVLElBQUksQ0FBQztBQUFBLFlBQzVDO0FBQUEsVUFDRDtBQUFBLFFBQ0QsT0FBTztBQUVOLGdCQUFNLGFBQWEsS0FBSyxJQUFJLEdBQUcsU0FBUyxNQUFNO0FBQzlDLGdCQUFNLFdBQVcsS0FBSyxJQUFJLE1BQU0sS0FBSyxRQUFRLE9BQU8sTUFBTTtBQUMxRCxnQkFBTSxZQUFZLE1BQU0sS0FBSyxVQUFVLFlBQVksUUFBUTtBQUMzRCxjQUFJLFVBQVUsU0FBUyxHQUFHO0FBQ3pCLGlCQUFLLFlBQVksU0FBUyxlQUFlLFNBQVMsQ0FBQztBQUFBLFVBQ3BEO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFFQSxXQUFJLFVBQUssZ0JBQUwsbUJBQWtCLE9BQU8sUUFBUTtBQUNwQyxzQkFBYyxLQUFLLElBQUk7QUFBQSxNQUN4QjtBQUFBLElBQ0Q7QUFHQSxNQUFFLFlBQVk7QUFDZCxrQkFBYyxRQUFRLENBQUMsTUFBTSxRQUFRO0FBQ3BDLFFBQUUsWUFBWSxJQUFJO0FBQ2xCLFVBQUksTUFBTSxjQUFjLFNBQVMsR0FBRztBQUNuQyxVQUFFLFlBQVksU0FBUyxlQUFlLEdBQUcsQ0FBQztBQUFBLE1BQzNDO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFNUSxzQkFBc0IsTUFBd0I7QUFDckQsVUFBTSxPQUNMO0FBR0QsVUFBTSxlQUFpRCxDQUFDO0FBQ3hELFVBQU0sVUFBVSxLQUFLLFFBQVEsTUFBTSxDQUFDLE9BQU8sV0FBVztBQUNyRCxtQkFBYSxLQUFLLEVBQUUsT0FBTyxRQUFRLEtBQUssU0FBUyxNQUFNLE9BQU8sQ0FBQztBQUMvRCxhQUFPLElBQUksT0FBTyxNQUFNLE1BQU07QUFBQSxJQUMvQixDQUFDO0FBRUQsVUFBTSxhQUFhLENBQUMsQ0FBQztBQUNyQixVQUFNLGVBQWU7QUFDckIsUUFBSTtBQUVKLFlBQVEsSUFBSSxhQUFhLEtBQUssT0FBTyxPQUFPLE1BQU07QUFDakQsWUFBTSxNQUFNLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxTQUFTO0FBRXBDLFVBQUksWUFBWTtBQUNoQixhQUFPLFlBQVksS0FBSyxVQUFVLEtBQUssS0FBSyxLQUFLLFNBQVMsQ0FBQyxHQUFHO0FBQzdEO0FBQUEsTUFDRDtBQUNBLFVBQUksWUFBWSxLQUFLLFFBQVE7QUFDNUIsbUJBQVcsS0FBSyxTQUFTO0FBQUEsTUFDMUI7QUFBQSxJQUNEO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtRLGlCQUNQLFdBQ3NEO0FBcFZ4RDtBQXFWRSxVQUFNLFlBQWlFLENBQUM7QUFDeEUsUUFBSSxNQUFNO0FBQ1YsZUFBVyxNQUFNLFdBQVc7QUFDM0IsWUFBTSxPQUFNLGNBQUcsZ0JBQUgsbUJBQWdCLFdBQWhCLFlBQTBCO0FBQ3RDLGdCQUFVLEtBQUssRUFBRSxXQUFXLEtBQUssTUFBTSxJQUFJLFFBQVEsSUFBSSxDQUFDO0FBQ3hELGFBQU87QUFBQSxJQUNSO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtRLGFBQ1AsV0FDQSxZQUN3QztBQUN4QyxhQUFTLElBQUksVUFBVSxTQUFTLEdBQUcsS0FBSyxHQUFHLEtBQUs7QUFDL0MsWUFBTSxJQUFJLFVBQVUsQ0FBQztBQUNyQixVQUFJLGNBQWMsRUFBRSxXQUFXO0FBQzlCLGNBQU0sY0FBYyxLQUFLLElBQUksYUFBYSxFQUFFLFdBQVcsRUFBRSxNQUFNO0FBQy9ELGVBQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxRQUFRLFlBQVk7QUFBQSxNQUM1QztBQUFBLElBQ0Q7QUFDQSxXQUFPLFVBQVUsU0FBUyxJQUN2QixFQUFFLE1BQU0sVUFBVSxDQUFDLEVBQUUsTUFBTSxRQUFRLEVBQUUsSUFDckM7QUFBQSxFQUNKO0FBQUEsRUFFUSxjQUFjLElBQXlCO0FBQzlDLFFBQUksT0FBTztBQUNYLE9BQUcsV0FBVyxRQUFRLENBQUMsU0FBUztBQUMvQixVQUFJLEtBQUssYUFBYSxLQUFLLFdBQVc7QUFDckMsZ0JBQVEsS0FBSztBQUFBLE1BQ2Q7QUFBQSxJQUNELENBQUM7QUFDRCxXQUFPLEtBQUssS0FBSztBQUFBLEVBQ2xCO0FBQUE7QUFBQSxFQUlRLFlBQVksTUFBc0I7QUFFekMsV0FBTyxLQUNMLFFBQVEsMkJBQTJCLEVBQUUsRUFDckMsUUFBUSwyQkFBMkIsRUFBRSxFQUNyQyxRQUFRLDJCQUEyQixFQUFFLEVBQ3JDLFFBQVEsMkJBQTJCLEVBQUUsRUFDckMsUUFBUSx5QkFBeUIsRUFBRSxFQUNuQyxRQUFRLHlCQUF5QixFQUFFLEVBQ25DLFFBQVEseUJBQXlCLEVBQUUsRUFDbkMsUUFBUSxnQkFBZ0IsRUFBRSxFQUMxQixRQUFRLDJCQUEyQixFQUFFLEVBQ3JDLFFBQVEsMkJBQTJCLEVBQUUsRUFDckMsUUFBUSwyQkFBMkIsRUFBRSxFQUNyQyxRQUFRLHlCQUF5QixFQUFFLEVBQ25DLFFBQVEsZ0JBQWdCLEVBQUUsRUFDMUIsUUFBUSxXQUFXLEdBQUcsRUFDdEIsS0FBSztBQUFBLEVBQ1I7QUFBQTtBQUFBLEVBSVEsa0JBQWtCLElBQXdCLE9BQWdCO0FBcFpuRTtBQXNaRSxRQUFJLEtBQUssV0FBVztBQUNuQixXQUFLLFVBQVUsVUFBVSxPQUFPLFlBQVk7QUFBQSxJQUM3QztBQUVBLFFBQUksQ0FBQyxJQUFJO0FBQ1IsV0FBSyxZQUFZO0FBQ2pCO0FBQUEsSUFDRDtBQUdBLFNBQUssWUFBWTtBQUNqQixPQUFHLFVBQVUsSUFBSSxZQUFZO0FBQzdCLE9BQUcsZUFBZSxFQUFFLFVBQVUsVUFBVSxPQUFPLFNBQVMsQ0FBQztBQUd6RCxTQUFLLGlCQUFpQixFQUFFO0FBRXhCLFFBQUksT0FBTztBQUNWLFlBQU0sT0FBTyxLQUFLLGFBQVksY0FBRyxnQkFBSCxtQkFBZ0IsV0FBaEIsWUFBMEIsRUFBRTtBQUMxRCxVQUFJLEtBQUssU0FBUyxHQUFHO0FBQ3BCLGFBQUssSUFBSSxPQUFPO0FBQ2hCLGFBQUssSUFBSSxNQUFNLElBQUk7QUFBQSxNQUNwQjtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUE7QUFBQSxFQUlRLGlCQUFpQixJQUFpQjtBQWxiM0M7QUFtYkUsUUFBSSxDQUFDLEtBQUs7QUFBTTtBQUdoQixVQUFNLFNBQVMsS0FBSyxJQUFJLFVBQVUsZ0JBQWdCLFVBQVU7QUFDNUQsVUFBTSxhQUFhLE9BQU8sS0FBSyxDQUFDLFNBQVM7QUF2YjNDLFVBQUFDLEtBQUFDO0FBd2JHLFlBQU0sT0FBTyxLQUFLO0FBQ2xCLGVBQU9ELE1BQUEsS0FBSyxTQUFMLGdCQUFBQSxJQUFXLFlBQVNDLE1BQUEsS0FBSyxTQUFMLGdCQUFBQSxJQUFXO0FBQUEsSUFDdkMsQ0FBQztBQUNELFFBQUksQ0FBQztBQUFZO0FBRWpCLFVBQU0sYUFBYSxXQUFXO0FBQzlCLFVBQU0sU0FBUyxXQUFXO0FBQzFCLFFBQUksQ0FBQztBQUFRO0FBR2IsVUFBTSxjQUFhLGNBQUcsZ0JBQUgsbUJBQWdCLFdBQWhCLFlBQTBCO0FBQzdDLFFBQUksV0FBVyxXQUFXO0FBQUc7QUFHN0IsVUFBTSxhQUFhLE9BQU8sVUFBVTtBQUNwQyxhQUFTLElBQUksR0FBRyxJQUFJLFlBQVksS0FBSztBQUNwQyxZQUFNLE9BQU8sT0FBTyxRQUFRLENBQUM7QUFDN0IsVUFBSSxLQUFLLFNBQVMsVUFBVSxLQUFLLEtBQUssU0FBUyxLQUFLLGNBQWMsR0FBRztBQUVwRSxlQUFPLFVBQVUsRUFBRSxNQUFNLEdBQUcsSUFBSSxFQUFFLENBQUM7QUFDbkMsZUFBTztBQUFBLFVBQ04sRUFBRSxNQUFNLEVBQUUsTUFBTSxHQUFHLElBQUksRUFBRSxHQUFHLElBQUksRUFBRSxNQUFNLEdBQUcsSUFBSSxFQUFFLEVBQUU7QUFBQSxVQUNuRDtBQUFBLFFBQ0Q7QUFDQTtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBO0FBQUEsRUFJUSxVQUFVLEdBQWtCO0FBRW5DLFVBQU0sTUFBTyxFQUFFLE9BQXVCO0FBQ3RDLFFBQUksUUFBUSxXQUFXLFFBQVE7QUFBWTtBQUkzQyxVQUFNLGFBQWEsRUFBRSxLQUFLLE1BQU0sZ0JBQWdCO0FBQ2hELFFBQUksWUFBWTtBQUNmLFFBQUUsZUFBZTtBQUNqQixZQUFNLFFBQVEsU0FBUyxXQUFXLENBQUMsQ0FBQztBQUNwQyxXQUFLLElBQUksY0FBYyxPQUFPLEVBQUUsUUFBUTtBQUN4QztBQUFBLElBQ0Q7QUFFQSxZQUFRLEVBQUUsS0FBSztBQUFBLE1BRWQsS0FBSztBQUNKLFVBQUUsZUFBZTtBQUNqQixhQUFLLElBQUksT0FBTztBQUNoQixhQUFLLElBQUksaUJBQWlCLEtBQUs7QUFDL0I7QUFBQSxNQUNELEtBQUs7QUFDSixVQUFFLGVBQWU7QUFDakIsYUFBSyxJQUFJLE9BQU87QUFDaEIsYUFBSyxJQUFJLGlCQUFpQixJQUFJO0FBQzlCO0FBQUEsTUFHRCxLQUFLO0FBQ0osVUFBRSxlQUFlO0FBQ2pCLGFBQUssSUFBSSxPQUFPO0FBQ2hCLGFBQUssSUFBSSxnQkFBZ0IsS0FBSztBQUM5QjtBQUFBLE1BQ0QsS0FBSztBQUNKLFVBQUUsZUFBZTtBQUNqQixhQUFLLElBQUksT0FBTztBQUNoQixhQUFLLElBQUksZ0JBQWdCLElBQUk7QUFDN0I7QUFBQSxNQUVELEtBQUs7QUFDSixVQUFFLGVBQWU7QUFDakIsYUFBSyxJQUFJLE9BQU87QUFDaEIsYUFBSyxJQUFJLFVBQVUsTUFBTTtBQUN6QjtBQUFBLE1BQ0QsS0FBSztBQUNKLFVBQUUsZUFBZTtBQUNqQixhQUFLLElBQUksT0FBTztBQUNoQixhQUFLLElBQUksVUFBVSxJQUFJO0FBQ3ZCO0FBQUEsTUFDRCxLQUFLO0FBQ0osVUFBRSxlQUFlO0FBQ2pCLGFBQUssSUFBSSxPQUFPO0FBQ2hCLGFBQUssSUFBSSxhQUFhLE9BQU87QUFDN0I7QUFBQSxNQUNELEtBQUs7QUFDSixVQUFFLGVBQWU7QUFDakIsYUFBSyxJQUFJLE9BQU87QUFDaEIsYUFBSyxJQUFJLGFBQWEsTUFBTTtBQUM1QjtBQUFBLE1BQ0QsS0FBSztBQUNKLFVBQUUsZUFBZTtBQUNqQixhQUFLLHNCQUFzQjtBQUMzQjtBQUFBLE1BQ0QsS0FBSztBQUNKLFVBQUUsZUFBZTtBQUNqQixhQUFLLElBQUksT0FBTztBQUNoQjtBQUFBLElBQ0Y7QUFBQSxFQUNEO0FBQUE7QUFBQSxFQUlBLE1BQWMsd0JBQXdCO0FBaGlCdkM7QUFpaUJFLFVBQU0sS0FBSyxLQUFLLElBQUk7QUFDcEIsUUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLO0FBQU07QUFFdkIsVUFBTSxRQUFPLFFBQUcsZ0JBQUgsbUJBQWdCO0FBQzdCLFFBQUksQ0FBQyxRQUFRLEtBQUssV0FBVztBQUFHO0FBRWhDLFVBQU0sY0FBYyxNQUFNLEtBQUssSUFBSSxNQUFNLEtBQUssS0FBSyxJQUFJO0FBQ3ZELFVBQU0sY0FBYyxLQUFLO0FBRXpCLFFBQUk7QUFDSixRQUFJLFlBQVksU0FBUyxXQUFXLEdBQUc7QUFFdEMsbUJBQWEsWUFBWSxRQUFRLGFBQWEsSUFBSTtBQUNsRCxTQUFHLFVBQVUsT0FBTyxnQkFBZ0I7QUFBQSxJQUNyQyxXQUFXLFlBQVksU0FBUyxJQUFJLEdBQUc7QUFFdEMsbUJBQWEsWUFBWSxRQUFRLE1BQU0sV0FBVztBQUNsRCxTQUFHLFVBQVUsSUFBSSxnQkFBZ0I7QUFBQSxJQUNsQyxPQUFPO0FBRU47QUFBQSxJQUNEO0FBR0EsU0FBSyxtQkFBbUI7QUFDeEIsVUFBTSxLQUFLLElBQUksTUFBTSxPQUFPLEtBQUssTUFBTSxVQUFVO0FBQUEsRUFDbEQ7QUFDRDs7O0FHNWpCQSxJQUFBQyxtQkFBK0M7QUFXeEMsSUFBTSxtQkFBMEM7QUFBQSxFQUN0RCxrQkFBa0I7QUFBQSxFQUNsQixtQkFBbUI7QUFBQTtBQUFBLEVBQ25CLFlBQVk7QUFBQSxFQUNaLFVBQVU7QUFBQSxFQUNWLFlBQVk7QUFDYjtBQUVPLElBQU0sMEJBQU4sY0FBc0Msa0NBQWlCO0FBQUEsRUFHN0QsWUFBWSxLQUFVLFFBQTZCO0FBQ2xELFVBQU0sS0FBSyxNQUFNO0FBQ2pCLFNBQUssU0FBUztBQUFBLEVBQ2Y7QUFBQSxFQUVBLFVBQWdCO0FBQ2YsVUFBTSxFQUFFLFlBQVksSUFBSTtBQUN4QixnQkFBWSxNQUFNO0FBRWxCLGdCQUFZLFNBQVMsTUFBTSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFHOUQsZ0JBQVksU0FBUyxNQUFNLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUVyRCxRQUFJLHlCQUFRLFdBQVcsRUFDckIsUUFBUSxhQUFhLEVBQ3JCLFFBQVEsbUNBQThCLEVBQ3RDO0FBQUEsTUFBVSxDQUFDLFdBQ1gsT0FDRSxVQUFVLEtBQUssR0FBSyxHQUFHLEVBQ3ZCLFNBQVMsS0FBSyxPQUFPLFNBQVMsVUFBVSxFQUN4QyxrQkFBa0IsRUFDbEIsU0FBUyxPQUFPLFVBQVU7QUFDMUIsYUFBSyxPQUFPLFNBQVMsYUFBYTtBQUNsQyxjQUFNLEtBQUssT0FBTyxhQUFhO0FBQUEsTUFDaEMsQ0FBQztBQUFBLElBQ0g7QUFHRCxnQkFBWSxTQUFTLE1BQU0sRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQzVELGdCQUFZLFNBQVMsS0FBSztBQUFBLE1BQ3pCLE1BQU07QUFBQSxNQUNOLEtBQUs7QUFBQSxJQUNOLENBQUM7QUFFRCxRQUFJLHlCQUFRLFdBQVcsRUFDckIsUUFBUSxTQUFTLEVBQ2pCLFFBQVEseUJBQXlCLEVBQ2pDO0FBQUEsTUFBUSxDQUFDLFNBQ1QsS0FDRSxlQUFlLGtCQUFrQixFQUNqQyxTQUFTLEtBQUssT0FBTyxTQUFTLGdCQUFnQixFQUM5QyxLQUFLLENBQUMsTUFBTyxFQUFFLFFBQVEsT0FBTyxVQUFXLEVBQ3pDLFNBQVMsT0FBTyxVQUFVO0FBQzFCLGFBQUssT0FBTyxTQUFTLG1CQUFtQjtBQUN4QyxjQUFNLEtBQUssT0FBTyxhQUFhO0FBQUEsTUFDaEMsQ0FBQztBQUFBLElBQ0g7QUFFRCxRQUFJLHlCQUFRLFdBQVcsRUFDckIsUUFBUSxVQUFVLEVBQ2xCLFFBQVEsdUNBQXVDLEVBQy9DO0FBQUEsTUFBUSxDQUFDLFNBQ1QsS0FDRSxlQUFlLHNCQUFzQixFQUNyQyxTQUFTLEtBQUssT0FBTyxTQUFTLGlCQUFpQixFQUMvQyxTQUFTLE9BQU8sVUFBVTtBQUMxQixhQUFLLE9BQU8sU0FBUyxvQkFBb0I7QUFDekMsY0FBTSxLQUFLLE9BQU8sYUFBYTtBQUFBLE1BQ2hDLENBQUM7QUFBQSxJQUNIO0FBR0QsZ0JBQVksU0FBUyxNQUFNLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFFOUMsUUFBSSx5QkFBUSxXQUFXLEVBQ3JCLFFBQVEsV0FBVyxFQUNuQixRQUFRLDZCQUE2QixFQUNyQztBQUFBLE1BQVUsQ0FBQyxXQUNYLE9BQ0UsVUFBVSxJQUFJLElBQUksQ0FBQyxFQUNuQixTQUFTLEtBQUssT0FBTyxTQUFTLFFBQVEsRUFDdEMsa0JBQWtCLEVBQ2xCLFNBQVMsT0FBTyxVQUFVO0FBQzFCLGFBQUssT0FBTyxTQUFTLFdBQVc7QUFDaEMsY0FBTSxLQUFLLE9BQU8sYUFBYTtBQUFBLE1BQ2hDLENBQUM7QUFBQSxJQUNIO0FBRUQsUUFBSSx5QkFBUSxXQUFXLEVBQ3JCLFFBQVEsYUFBYSxFQUNyQixRQUFRLHlCQUF5QixFQUNqQztBQUFBLE1BQVUsQ0FBQyxXQUNYLE9BQ0UsVUFBVSxLQUFLLEtBQUssR0FBRyxFQUN2QixTQUFTLEtBQUssT0FBTyxTQUFTLFVBQVUsRUFDeEMsa0JBQWtCLEVBQ2xCLFNBQVMsT0FBTyxVQUFVO0FBQzFCLGFBQUssT0FBTyxTQUFTLGFBQWE7QUFDbEMsY0FBTSxLQUFLLE9BQU8sYUFBYTtBQUFBLE1BQ2hDLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRjtBQUNEOzs7QUozR0EsSUFBcUIsc0JBQXJCLGNBQWlELHdCQUFPO0FBQUEsRUFBeEQ7QUFBQTtBQUNDLG9CQUFrQztBQUFBO0FBQUEsRUFFbEMsTUFBTSxTQUFTO0FBQ2QsVUFBTSxLQUFLLGFBQWE7QUFHeEIsU0FBSyxhQUFhLG1CQUFtQixDQUFDLFNBQVMsSUFBSSxZQUFZLE1BQU0sSUFBSSxDQUFDO0FBRzFFLFNBQUssY0FBYyxhQUFhLHlCQUF5QixNQUFNO0FBQzlELFdBQUssa0JBQWtCO0FBQUEsSUFDeEIsQ0FBQztBQUdELFNBQUssV0FBVztBQUFBLE1BQ2YsSUFBSTtBQUFBLE1BQ0osTUFBTTtBQUFBLE1BQ04sVUFBVSxNQUFNLEtBQUssa0JBQWtCO0FBQUEsSUFDeEMsQ0FBQztBQUdELFNBQUssY0FBYyxJQUFJLHdCQUF3QixLQUFLLEtBQUssSUFBSSxDQUFDO0FBQUEsRUFDL0Q7QUFBQSxFQUVBLFdBQVc7QUFBQSxFQUVYO0FBQUEsRUFFQSxNQUFNLGVBQWU7QUFDcEIsU0FBSyxXQUFXLE9BQU8sT0FBTyxDQUFDLEdBQUcsa0JBQWtCLE1BQU0sS0FBSyxTQUFTLENBQUM7QUFBQSxFQUMxRTtBQUFBLEVBRUEsTUFBTSxlQUFlO0FBQ3BCLFVBQU0sS0FBSyxTQUFTLEtBQUssUUFBUTtBQUVqQyxTQUFLLElBQUksVUFBVSxnQkFBZ0IsaUJBQWlCLEVBQUUsUUFBUSxDQUFDLFNBQVM7QUFDdkUsTUFBQyxLQUFLLEtBQXFCLFdBQVc7QUFBQSxJQUN2QyxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsTUFBYyxvQkFBb0I7QUFFakMsVUFBTSxXQUFXLEtBQUssSUFBSSxVQUFVLGdCQUFnQixpQkFBaUI7QUFDckUsUUFBSSxTQUFTLFNBQVMsR0FBRztBQUN4QixlQUFTLFFBQVEsQ0FBQ0MsVUFBU0EsTUFBSyxPQUFPLENBQUM7QUFDeEM7QUFBQSxJQUNEO0FBR0EsVUFBTSxhQUFhLEtBQUssSUFBSSxVQUFVLGNBQWM7QUFDcEQsUUFBSSxDQUFDO0FBQVk7QUFFakIsVUFBTSxPQUFPLEtBQUssSUFBSSxVQUFVLFFBQVEsU0FBUyxVQUFVO0FBRTNELFVBQU0sS0FBSyxhQUFhO0FBQUEsTUFDdkIsTUFBTTtBQUFBLE1BQ04sUUFBUTtBQUFBLElBQ1QsQ0FBQztBQUVELFVBQU0sT0FBTyxLQUFLO0FBQ2xCLFVBQU0sS0FBSyxRQUFRLFVBQVU7QUFFN0IsU0FBSyxJQUFJLFVBQVUsV0FBVyxJQUFJO0FBQUEsRUFDbkM7QUFDRDsiLAogICJuYW1lcyI6IFsiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJfYSIsICJfYiIsICJpbXBvcnRfb2JzaWRpYW4iLCAibGVhZiJdCn0K
