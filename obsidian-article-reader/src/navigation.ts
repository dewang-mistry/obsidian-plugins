/**
 * Navigation state machine for Article Reader.
 *
 * Maintains a flat list of all navigable elements and a current focus index.
 * Handles heading-level jumps, block navigation, and sentence-level traversal.
 */

export type NavElement = HTMLElement;

export class NavigationController {
	private elements: NavElement[] = [];
	private currentIndex = -1;
	private onFocusChange: (el: NavElement | null, speak: boolean) => void;

	constructor(onFocusChange: (el: NavElement | null, speak: boolean) => void) {
		this.onFocusChange = onFocusChange;
	}

	/**
	 * Rebuild the navigable element list from the rendered container.
	 * Order: DOM order (top to bottom).
	 * Navigable = headings, sentences (.ar-sentence), list items (.ar-list-item).
	 */
	rebuild(container: HTMLElement) {
		this.elements = Array.from(
			container.querySelectorAll<HTMLElement>(
				"h1, h2, h3, h4, h5, h6, .ar-sentence, .ar-list-item"
			)
		);
		this.currentIndex = -1;
	}

	get current(): NavElement | null {
		return this.elements[this.currentIndex] ?? null;
	}

	focusElement(el: NavElement, speak: boolean) {
		const idx = this.elements.indexOf(el);
		if (idx >= 0) {
			this.currentIndex = idx;
			this.onFocusChange(el, speak);
		}
	}

	// ── Heading-level jump ──

	jumpToHeading(level: number, reverse: boolean) {
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

	jumpToAnyHeading(reverse: boolean) {
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

	jumpToHighlight(reverse: boolean) {
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

	moveBlock(direction: "up" | "down") {
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

	private isBlockStart(el: HTMLElement): boolean {
		// Headings are always block starts
		if (/^H[1-6]$/.test(el.tagName)) return true;
		// List items are block starts
		if (el.classList.contains("ar-list-item")) return true;
		// First sentence of a paragraph
		if (
			el.classList.contains("ar-sentence") &&
			el.dataset.sentenceIndex === "0"
		) {
			return true;
		}
		return false;
	}

	// ── Sentence navigation (← / →) ──
	// Moves to the next/previous sentence within the same parent paragraph.

	moveSentence(direction: "left" | "right") {
		const current = this.current;
		if (!current || !current.classList.contains("ar-sentence")) {
			// If on a heading or list item, treat left/right as block nav
			this.moveBlock(direction === "right" ? "down" : "up");
			return;
		}

		const parent = current.parentElement;
		if (!parent) return;

		const step = direction === "right" ? 1 : -1;
		let i = this.currentIndex + step;

		while (i >= 0 && i < this.elements.length) {
			const el = this.elements[i];
			// Must be a sentence in the same parent paragraph
			if (el.classList.contains("ar-sentence") && el.parentElement === parent) {
				this.currentIndex = i;
				this.onFocusChange(el, true);
				return;
			}
			// If we've left this paragraph, stop
			if (el.parentElement !== parent) return;
			i += step;
		}
	}

	// ── Highlight only (Enter key) ──

	highlightCurrent() {
		if (this.current) {
			this.onFocusChange(this.current, false);
		}
	}
}
