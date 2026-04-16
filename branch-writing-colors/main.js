/*
  Branch Writing Colors — companion plugin for the Branch Writing Obsidian plugin.
  Color-codes cards based on:
    1. Emoji rules — heading cards with a matching emoji color their subtree
    2. Heading level rules — single color or rainbow (sequential palette) per h1-h6
  Precedence: emoji > heading level. More specific ancestor wins for children.
*/

const { Plugin, PluginSettingTab, Setting } = require('obsidian');

const HEADING_LEVELS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

const TREATMENT_OPTIONS = {
  'border-left':  'Left border',
  'border-top':   'Top border',
  'outline':      'Outline',
  'background':   'Background tint',
};

const LEVEL_MODE_OPTIONS = {
  'off':     'Off',
  'single':  'Single color',
  'rainbow': 'Rainbow',
};

// Tableau 10 — perceptually distinct, widely used in data visualization
const RAINBOW_PALETTE = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
];

// Default single colors per level (drawn from the same palette)
const LEVEL_DEFAULT_COLORS = {
  h1: '#e15759',
  h2: '#4e79a7',
  h3: '#f28e2b',
  h4: '#76b7b2',
  h5: '#59a14f',
  h6: '#edc948',
};

const DEFAULT_HEADING_LEVEL = (color) => ({ mode: 'off', color });

const DEFAULT_SETTINGS = {
  treatment: 'border-left',
  rules: [],
  headingLevels: Object.fromEntries(
    HEADING_LEVELS.map(h => [h, DEFAULT_HEADING_LEVEL(LEVEL_DEFAULT_COLORS[h])])
  ),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractEmojis(text) {
  const matches = text.match(/\p{Emoji_Presentation}|\p{Extended_Pictographic}|[^\w\s]/gu);
  return matches ? [...new Set(matches)] : [];
}

function applyTreatment(treatment, color) {
  switch (treatment) {
    case 'border-left':  return `border-left: 4px solid ${color} !important;`;
    case 'border-top':   return `border-top: 4px solid ${color} !important;`;
    case 'outline':      return `outline: 2px solid ${color} !important; outline-offset: -2px;`;
    case 'background':   return `background-color: ${color}33 !important;`;
    default:             return `border-left: 4px solid ${color} !important;`;
  }
}

function compareSections(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// ── Core section-number detection ────────────────────────────────────────────

function getSectionNumber(card) {
  const dataSection = card.getAttribute('data-section') ||
                      card.closest('[data-section]')?.getAttribute('data-section');
  if (dataSection && /^\d+(?:\.\d+)*$/.test(dataSection)) return dataSection;

  const indexEl = card.querySelector('.tree-index');
  if (!indexEl) return '';
  const text = (indexEl.textContent || '').trim();
  if (/^h\d+$/i.test(text)) {
    const ariaLabel = indexEl.querySelector('span')?.getAttribute('aria-label') || '';
    if (/^\d+(?:\.\d+)*$/.test(ariaLabel)) return ariaLabel;
    const groupSection = card.closest('[data-section]')?.getAttribute('data-section');
    if (groupSection) return groupSection;
    return '';
  }
  const match = text.match(/\d+(?:\.\d+)*/);
  return match ? match[0] : '';
}

// ── Core coloring logic ───────────────────────────────────────────────────────

function colorizeCards(rules, headingLevels, treatment) {
  const hasEmojiRules = rules.some(r => r.emoji && r.color);
  const hasLevelRules = HEADING_LEVELS.some(h => headingLevels[h]?.mode !== 'off');
  if (!hasEmojiRules && !hasLevelRules) return;

  const emojiMap = {};
  for (const rule of rules) {
    if (rule.emoji && rule.color) emojiMap[rule.emoji] = rule.color;
  }

  const cards = Array.from(document.querySelectorAll('.branch-card'));
  if (!cards.length) return;

  // Collect section numbers and heading elements once
  const cardData = cards
    .map(card => ({
      card,
      sectionNum: getSectionNumber(card),
      headingEl: card.querySelector('h1, h2, h3, h4, h5, h6'),
    }))
    .filter(d => d.sectionNum);

  // colorRules: [{prefix, color}] — most specific prefix wins; emoji rules added first so
  // they appear earlier in the stable sort and take precedence at equal specificity.
  const colorRules = [];

  // Pass 1a — emoji rules (highest precedence)
  if (hasEmojiRules) {
    for (const d of cardData) {
      if (!d.headingEl) continue;
      const emojis = extractEmojis(d.headingEl.textContent);
      for (const emoji of emojis) {
        if (emojiMap[emoji]) {
          colorRules.push({ prefix: d.sectionNum, color: emojiMap[emoji] });
          break;
        }
      }
    }
  }

  // Pass 1b — heading-level rules (lower precedence)
  if (hasLevelRules) {
    for (const level of HEADING_LEVELS) {
      const ls = headingLevels[level];
      if (!ls || ls.mode === 'off') continue;

      const levelCards = cardData
        .filter(d => d.headingEl?.tagName.toLowerCase() === level)
        .sort((a, b) => compareSections(a.sectionNum, b.sectionNum));

      if (ls.mode === 'rainbow') {
        levelCards.forEach((d, i) => {
          colorRules.push({ prefix: d.sectionNum, color: RAINBOW_PALETTE[i % RAINBOW_PALETTE.length] });
        });
      } else if (ls.mode === 'single' && ls.color) {
        for (const d of levelCards) {
          colorRules.push({ prefix: d.sectionNum, color: ls.color });
        }
      }
    }
  }

  if (!colorRules.length) return;

  // Sort by prefix length descending — most specific rule wins
  colorRules.sort((a, b) => b.prefix.length - a.prefix.length);

  // Pass 2 — apply to every card
  clearColors();

  for (const d of cardData) {
    const { card, sectionNum } = d;
    let matchedColor = null;
    for (const rule of colorRules) {
      if (sectionNum === rule.prefix || sectionNum.startsWith(rule.prefix + '.')) {
        matchedColor = rule.color;
        break;
      }
    }
    if (matchedColor) {
      const css = applyTreatment(treatment, matchedColor);
      const tempEl = document.createElement('div');
      tempEl.setAttribute('style', css);
      for (const prop of tempEl.style) {
        card.style.setProperty(prop, tempEl.style.getPropertyValue(prop), 'important');
      }
    }
  }
}

function clearColors() {
  for (const card of document.querySelectorAll('.branch-card')) {
    card.style.removeProperty('border-left');
    card.style.removeProperty('border-top');
    card.style.removeProperty('outline');
    card.style.removeProperty('background-color');
  }
}

// ── Plugin ────────────────────────────────────────────────────────────────────

class BranchWritingColors extends Plugin {

  async onload() {
    await this.loadSettings();
    this.observer = null;
    this.addSettingTab(new ColorsSettingTab(this.app, this));
    this.setupObserver();
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        this.setupObserver();
        this.applyColors();
      })
    );
  }

  onunload() {
    clearColors();
    this.disconnectObserver();
  }

  applyColors() {
    colorizeCards(this.settings.rules, this.settings.headingLevels, this.settings.treatment);
  }

  setupObserver() {
    this.disconnectObserver();
    let debounceTimer = null;
    this.observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => this.applyColors(), 150);
    });
    this.observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  disconnectObserver() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  async loadSettings() {
    const saved = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
    if (!Array.isArray(this.settings.rules)) this.settings.rules = [];

    // Migrate old headingLevelRules format → new headingLevels format
    if (saved?.headingLevelRules && !saved?.headingLevels) {
      this.settings.headingLevels = {};
      for (const h of HEADING_LEVELS) {
        const oldColor = saved.headingLevelRules[h];
        this.settings.headingLevels[h] = {
          mode: oldColor ? 'single' : 'off',
          color: oldColor || LEVEL_DEFAULT_COLORS[h],
        };
      }
    }

    // Ensure all levels are present with valid structure
    if (!this.settings.headingLevels || typeof this.settings.headingLevels !== 'object') {
      this.settings.headingLevels = DEFAULT_SETTINGS.headingLevels;
    }
    for (const h of HEADING_LEVELS) {
      if (!this.settings.headingLevels[h] || typeof this.settings.headingLevels[h] !== 'object') {
        this.settings.headingLevels[h] = DEFAULT_HEADING_LEVEL(LEVEL_DEFAULT_COLORS[h]);
      }
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.applyColors();
  }
}

// ── Settings tab ──────────────────────────────────────────────────────────────

class ColorsSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    // ── Visual treatment ──────────────────────────────────────────────────────
    new Setting(containerEl)
      .setName('Visual treatment')
      .setDesc('How the color is applied to matching cards.')
      .addDropdown(drop => {
        for (const [value, label] of Object.entries(TREATMENT_OPTIONS)) {
          drop.addOption(value, label);
        }
        drop.setValue(this.plugin.settings.treatment);
        drop.onChange(async value => {
          this.plugin.settings.treatment = value;
          await this.plugin.saveSettings();
        });
      });

    // ── Heading level colors ──────────────────────────────────────────────────
    containerEl.createEl('h3', { text: 'Heading level colors' });
    containerEl.createEl('p', {
      text: 'Single color: all cards of that level share one color. Rainbow: each card of that level gets a distinct color from the Tableau 10 palette, cycling if needed. Children inherit the color of their nearest colored ancestor. Emoji rules take precedence.',
      cls: 'setting-item-description',
    });

    for (const level of HEADING_LEVELS) {
      const ls = this.plugin.settings.headingLevels[level];

      const setting = new Setting(containerEl)
        .setName(level.toUpperCase());

      // Mode dropdown
      setting.addDropdown(drop => {
        for (const [value, label] of Object.entries(LEVEL_MODE_OPTIONS)) {
          drop.addOption(value, label);
        }
        drop.setValue(ls.mode);
        drop.onChange(async value => {
          ls.mode = value;
          await this.plugin.saveSettings();
          this.display();
        });
      });

      // Color picker — only shown in single mode
      if (ls.mode === 'single') {
        setting.addColorPicker(picker =>
          picker
            .setValue(ls.color || LEVEL_DEFAULT_COLORS[level])
            .onChange(async value => {
              ls.color = value;
              await this.plugin.saveSettings();
            })
        );
      }

      // Rainbow preview swatches — shown in rainbow mode
      if (ls.mode === 'rainbow') {
        const swatchRow = setting.controlEl.createDiv({ cls: 'bwc-swatches' });
        swatchRow.style.cssText = 'display:flex;gap:4px;align-items:center;margin-left:8px;';
        for (const color of RAINBOW_PALETTE) {
          const swatch = swatchRow.createDiv();
          swatch.style.cssText = `width:14px;height:14px;border-radius:3px;background:${color};flex-shrink:0;`;
        }
      }
    }

    // ── Emoji → color rules ───────────────────────────────────────────────────
    containerEl.createEl('h3', { text: 'Emoji color rules' });
    containerEl.createEl('p', {
      text: 'Each rule maps an emoji (used in a heading) to a color. All cards under that heading inherit the color. Emoji rules override heading level colors.',
      cls: 'setting-item-description',
    });

    const rulesContainer = containerEl.createDiv();
    this.renderRules(rulesContainer);

    new Setting(containerEl)
      .addButton(btn =>
        btn
          .setButtonText('+ Add rule')
          .setCta()
          .onClick(async () => {
            this.plugin.settings.rules.push({ emoji: '', color: '#4a90d9' });
            await this.plugin.saveSettings();
            rulesContainer.empty();
            this.renderRules(rulesContainer);
          })
      );
  }

  renderRules(container) {
    const rules = this.plugin.settings.rules;

    if (!rules.length) {
      container.createEl('p', {
        text: 'No rules yet. Click "+ Add rule" to create one.',
        cls: 'setting-item-description',
      });
      return;
    }

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];

      const setting = new Setting(container)
        .setName(`Rule ${i + 1}`);

      setting.addText(text =>
        text
          .setPlaceholder('Emoji e.g. 💡')
          .setValue(rule.emoji)
          .onChange(async value => {
            rules[i].emoji = value.trim();
            await this.plugin.saveSettings();
          })
      );

      setting.addColorPicker(picker =>
        picker
          .setValue(rule.color || '#4a90d9')
          .onChange(async value => {
            rules[i].color = value;
            await this.plugin.saveSettings();
          })
      );

      setting.addButton(btn =>
        btn
          .setIcon('trash')
          .setTooltip('Delete rule')
          .onClick(async () => {
            rules.splice(i, 1);
            await this.plugin.saveSettings();
            container.empty();
            this.renderRules(container);
          })
      );
    }
  }
}

module.exports = BranchWritingColors;
