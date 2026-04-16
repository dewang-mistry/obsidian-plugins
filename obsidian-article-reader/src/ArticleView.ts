import {
	ItemView,
	MarkdownView,
	WorkspaceLeaf,
	MarkdownRenderer,
	TFile,
} from "obsidian";
import type ArticleReaderPlugin from "../main";
import { NavigationController } from "./navigation";
import { createTTSEngine, TTSEngine } from "./tts";

export const ARTICLE_VIEW_TYPE = "article-reader";

export class ArticleView extends ItemView {
	plugin: ArticleReaderPlugin;
	private file: TFile | null = null;
	private contentEl_: HTMLElement | null = null;
	private nav: NavigationController;
	private tts: TTSEngine;
	private focusedEl: HTMLElement | null = null;
	private keyHandler: ((e: KeyboardEvent) => void) | null = null;
	private pendingFocusText: string | null = null;
	private suppressRerender = false;

	constructor(leaf: WorkspaceLeaf, plugin: ArticleReaderPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.tts = this.buildTTS();
		this.nav = new NavigationController((el, speak) =>
			this.handleFocusChange(el, speak)
		);
	}

	getViewType(): string {
		return ARTICLE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.file ? `Article: ${this.file.basename}` : "Article Reader";
	}

	getIcon(): string {
		return "book-open";
	}

	// ── Lifecycle ──

	async onOpen() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("ar-container");

		this.contentEl_ = container.createDiv({ cls: "ar-article" });

		// Key handler
		this.keyHandler = (e: KeyboardEvent) => this.onKeyDown(e);
		container.addEventListener("keydown", this.keyHandler);
		container.setAttribute("tabindex", "0");

		// Listen for file changes
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file instanceof TFile && file === this.file) {
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
			const container = this.containerEl.children[1] as HTMLElement;
			container.removeEventListener("keydown", this.keyHandler);
		}
	}

	// ── Public API ──

	async setFile(file: TFile) {
		this.file = file;
		await this.renderArticle();
	}

	rebuildTTS() {
		this.tts.cancel();
		this.tts = this.buildTTS();
	}

	private buildTTS(): TTSEngine {
		const s = this.plugin.settings;
		return createTTSEngine(s.elevenLabsApiKey, s.elevenLabsVoiceId, s.speechRate);
	}

	// ── Render ──

	private async renderArticle() {
		if (!this.contentEl_ || !this.file) return;

		const content = await this.app.vault.cachedRead(this.file);
		this.contentEl_.empty();

		// Apply display settings
		const s = this.plugin.settings;
		this.contentEl_.style.fontSize = `${s.fontSize}px`;
		this.contentEl_.style.lineHeight = `${s.lineHeight}`;

		// Render markdown → HTML using Obsidian's renderer
		await MarkdownRenderer.render(
			this.app,
			content,
			this.contentEl_,
			this.file.path,
			this
		);

		// Post-process: wrap sentences, annotate headings, wrap list items
		this.postProcess(this.contentEl_);

		// Rebuild navigation index
		this.nav.rebuild(this.contentEl_);

		// Click handler on the article
		this.contentEl_.addEventListener("click", (e) => {
			const target = e.target as HTMLElement;
			const navEl = target.closest<HTMLElement>(
				"h1, h2, h3, h4, h5, h6, .ar-sentence, .ar-list-item"
			);
			if (navEl) {
				this.nav.focusElement(navEl, true);
			}
		});

		// Focus the container for keyboard events
		const container = this.containerEl.children[1] as HTMLElement;
		container.focus();
	}

	// ── Post-processing ──

	private postProcess(container: HTMLElement) {
		// 1. Annotate headings with data attribute
		container.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6").forEach((h) => {
			const level = h.tagName.charAt(1);
			h.dataset.headingLevel = level;
			h.classList.add("ar-navigable");
		});

		// 2. Wrap sentences in paragraphs
		container.querySelectorAll<HTMLElement>("p").forEach((p) => {
			// Skip paragraphs that contain only images or embeds
			if (this.isNonTextBlock(p)) return;
			this.wrapSentences(p);
		});

		// 3. Mark elements containing <mark> (==highlight==) as ar-highlighted
		//    Run after sentence wrapping so .ar-sentence spans exist
		container.querySelectorAll<HTMLElement>("mark").forEach((mark) => {
			const parent = mark.closest<HTMLElement>(
				".ar-sentence, .ar-list-item, h1, h2, h3, h4, h5, h6"
			);
			if (parent) {
				parent.classList.add("ar-highlighted");
			}
		});

		// 4. Wrap list item text content
		container
			.querySelectorAll<HTMLElement>("li")
			.forEach((li) => {
				// Only wrap direct text content, not nested lists
				const textContent = this.getDirectText(li);
				if (textContent.trim().length === 0) return;

				// Wrap the text in a span for click/focus targeting
				const span = document.createElement("span");
				span.className = "ar-list-item ar-navigable";
				span.textContent = textContent;

				// Replace direct text nodes with the span
				const childNodes = Array.from(li.childNodes);
				let inserted = false;
				for (const node of childNodes) {
					if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
						if (!inserted) {
							li.replaceChild(span, node);
							inserted = true;
						} else {
							// Append additional text to the span
							span.textContent += " " + node.textContent.trim();
							li.removeChild(node);
						}
					}
				}
			});
	}

	private isNonTextBlock(p: HTMLElement): boolean {
		// If paragraph has only images, iframes, or embeds, skip it
		const text = p.textContent?.trim() ?? "";
		if (text.length === 0) return true;
		if (p.querySelector("img, iframe, video, audio, .internal-embed")) {
			// Check if there's substantial text alongside
			if (text.length < 5) return true;
		}
		return false;
	}

	private wrapSentences(p: HTMLElement) {
		// Don't process if already has sentence spans
		if (p.innerHTML.includes("ar-sentence")) return;

		const fullText = p.textContent ?? "";
		if (fullText.trim().length === 0) return;

		const boundaries = this.getSentenceBoundaries(fullText);
		if (boundaries.length === 0) return;

		// Flatten all child nodes into a list of "chunks" — each chunk is either
		// a text string or an element (like <mark>, <strong>, <em>, <a>, <code>).
		// Track cumulative character offset for each chunk.
		interface Chunk {
			type: "text" | "element";
			text: string;
			node: Node;
			startOffset: number;
		}
		const chunks: Chunk[] = [];
		let cumOffset = 0;
		for (const child of Array.from(p.childNodes)) {
			const t = child.textContent ?? "";
			chunks.push({
				type: child.nodeType === Node.TEXT_NODE ? "text" : "element",
				text: t,
				node: child,
				startOffset: cumOffset,
			});
			cumOffset += t.length;
		}

		// For each sentence boundary range, collect the chunks (or partial chunks)
		// that fall within it.
		const sentenceSpans: HTMLElement[] = [];
		for (let i = 0; i < boundaries.length; i++) {
			const sStart = boundaries[i];
			const sEnd =
				i < boundaries.length - 1 ? boundaries[i + 1] : fullText.length;

			const span = document.createElement("span");
			span.className = "ar-sentence ar-navigable";
			span.dataset.sentenceIndex = String(i);

			for (const chunk of chunks) {
				const cStart = chunk.startOffset;
				const cEnd = cStart + chunk.text.length;

				// No overlap
				if (cEnd <= sStart || cStart >= sEnd) continue;

				if (chunk.type === "element") {
					// Inline element — if it falls within this sentence, clone it in
					if (cStart >= sStart && cEnd <= sEnd) {
						span.appendChild(chunk.node.cloneNode(true));
					} else {
						// Partial overlap with an element — include it in whichever
						// sentence contains the majority
						const overlap = Math.min(cEnd, sEnd) - Math.max(cStart, sStart);
						if (overlap > chunk.text.length / 2) {
							span.appendChild(chunk.node.cloneNode(true));
						}
					}
				} else {
					// Text node — take the substring that falls within this sentence
					const localStart = Math.max(0, sStart - cStart);
					const localEnd = Math.min(chunk.text.length, sEnd - cStart);
					const substring = chunk.text.substring(localStart, localEnd);
					if (substring.length > 0) {
						span.appendChild(document.createTextNode(substring));
					}
				}
			}

			if (span.textContent?.trim().length) {
				sentenceSpans.push(span);
			}
		}

		// Replace paragraph contents with the sentence spans
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
	private getSentenceBoundaries(text: string): number[] {
		const abbr =
			/(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|e\.g|i\.e|a\.m|p\.m|Inc|Ltd|Corp|St|Ave|Blvd|Dept|Fig|Vol|No)\./gi;

		// Replace abbreviations with placeholders to avoid false splits
		const placeholders: { start: number; end: number }[] = [];
		const cleaned = text.replace(abbr, (match, offset) => {
			placeholders.push({ start: offset, end: offset + match.length });
			return "X".repeat(match.length); // same length placeholder
		});

		const boundaries = [0];
		const splitPattern = /([.!?])\s+(?=[A-Z])/g;
		let m: RegExpExecArray | null;

		while ((m = splitPattern.exec(cleaned)) !== null) {
			const pos = m.index + m[1].length + 1; // after punctuation + first space
			// Skip the whitespace to find the actual start of next sentence
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
	private mapCharPositions(
		textNodes: Text[]
	): { cumOffset: number; node: Text; length: number }[] {
		const positions: { cumOffset: number; node: Text; length: number }[] = [];
		let cum = 0;
		for (const tn of textNodes) {
			const len = tn.textContent?.length ?? 0;
			positions.push({ cumOffset: cum, node: tn, length: len });
			cum += len;
		}
		return positions;
	}

	/**
	 * Find which text node + local offset corresponds to a global char offset.
	 */
	private findPosition(
		positions: { cumOffset: number; node: Text; length: number }[],
		charOffset: number
	): { node: Text; offset: number } | null {
		for (let i = positions.length - 1; i >= 0; i--) {
			const p = positions[i];
			if (charOffset >= p.cumOffset) {
				const localOffset = Math.min(charOffset - p.cumOffset, p.length);
				return { node: p.node, offset: localOffset };
			}
		}
		return positions.length > 0
			? { node: positions[0].node, offset: 0 }
			: null;
	}

	private getDirectText(el: HTMLElement): string {
		let text = "";
		el.childNodes.forEach((node) => {
			if (node.nodeType === Node.TEXT_NODE) {
				text += node.textContent;
			}
		});
		return text.trim();
	}

	// ── Text cleanup ──

	private stripEmojis(text: string): string {
		// Remove emoji characters (Unicode emoji ranges + variation selectors + ZWJ sequences)
		return text
			.replace(/[\u{1F600}-\u{1F64F}]/gu, "")   // emoticons
			.replace(/[\u{1F300}-\u{1F5FF}]/gu, "")   // symbols & pictographs
			.replace(/[\u{1F680}-\u{1F6FF}]/gu, "")   // transport & map
			.replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "")   // flags
			.replace(/[\u{2600}-\u{26FF}]/gu, "")     // misc symbols
			.replace(/[\u{2700}-\u{27BF}]/gu, "")     // dingbats
			.replace(/[\u{FE00}-\u{FE0F}]/gu, "")     // variation selectors
			.replace(/[\u{200D}]/gu, "")               // zero-width joiner
			.replace(/[\u{1F900}-\u{1F9FF}]/gu, "")   // supplemental symbols
			.replace(/[\u{1FA00}-\u{1FA6F}]/gu, "")   // chess symbols
			.replace(/[\u{1FA70}-\u{1FAFF}]/gu, "")   // symbols extended-A
			.replace(/[\u{231A}-\u{23F3}]/gu, "")     // misc technical
			.replace(/[\u{2B50}]/gu, "")               // star
			.replace(/\s{2,}/g, " ")                   // collapse double spaces left behind
			.trim();
	}

	// ── Focus & TTS ──

	private handleFocusChange(el: HTMLElement | null, speak: boolean) {
		// Remove old focus
		if (this.focusedEl) {
			this.focusedEl.classList.remove("ar-focused");
		}

		if (!el) {
			this.focusedEl = null;
			return;
		}

		// Set new focus
		this.focusedEl = el;
		el.classList.add("ar-focused");
		el.scrollIntoView({ behavior: "smooth", block: "center" });

		// Sync source editor scroll
		this.syncEditorScroll(el);

		if (speak) {
			const text = this.stripEmojis(el.textContent?.trim() ?? "");
			if (text.length > 0) {
				this.tts.cancel();
				this.tts.speak(text);
			}
		}
	}

	// ── Editor scroll sync ──

	private syncEditorScroll(el: HTMLElement) {
		if (!this.file) return;

		// Find an open markdown editor for the same file
		const leaves = this.app.workspace.getLeavesOfType("markdown");
		const editorLeaf = leaves.find((leaf) => {
			const view = leaf.view as MarkdownView;
			return view.file?.path === this.file?.path;
		});
		if (!editorLeaf) return;

		const editorView = editorLeaf.view as MarkdownView;
		const editor = editorView.editor;
		if (!editor) return;

		// Get the text to search for in the source
		const searchText = el.textContent?.trim() ?? "";
		if (searchText.length === 0) return;

		// Find the line in the source containing this text
		const totalLines = editor.lineCount();
		for (let i = 0; i < totalLines; i++) {
			const line = editor.getLine(i);
			if (line.includes(searchText) || line.includes(`==${searchText}==`)) {
				// Scroll editor to this line (center it)
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

	private onKeyDown(e: KeyboardEvent) {
		// Ignore if in an input field
		const tag = (e.target as HTMLElement).tagName;
		if (tag === "INPUT" || tag === "TEXTAREA") return;

		// Number keys 1-6: heading jump
		// Use e.code (Digit1-Digit6) because Shift+1 produces "!" on e.key
		const digitMatch = e.code.match(/^Digit([1-6])$/);
		if (digitMatch) {
			e.preventDefault();
			const level = parseInt(digitMatch[1]);
			this.nav.jumpToHeading(level, e.shiftKey);
			return;
		}

		switch (e.key) {
			// H / Shift+H: next/previous heading at any level
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

			// n / Shift+N: next/previous highlighted sentence
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

	private async toggleHighlightInFile() {
		const el = this.nav.current;
		if (!el || !this.file) return;

		const text = el.textContent?.trim();
		if (!text || text.length === 0) return;

		const fileContent = await this.app.vault.read(this.file);
		const highlighted = `==${text}==`;

		let newContent: string;
		if (fileContent.includes(highlighted)) {
			// Remove highlight — un-toggle
			newContent = fileContent.replace(highlighted, text);
			el.classList.remove("ar-highlighted");
		} else if (fileContent.includes(text)) {
			// Add highlight
			newContent = fileContent.replace(text, highlighted);
			el.classList.add("ar-highlighted");
		} else {
			// Text not found in source (maybe formatting differs) — skip
			return;
		}

		// Suppress the re-render triggered by our own file modification
		this.suppressRerender = true;
		await this.app.vault.modify(this.file, newContent);
	}
}
