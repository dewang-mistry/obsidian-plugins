/*
  Canvas TTS — speaks canvas card and edge label text aloud when selected.
  Uses the Web Speech API (built into Electron).
  Observes the DOM for Obsidian's `is-focused` class on canvas elements.
*/

const { Plugin, PluginSettingTab, Setting } = require('obsidian');

const DEFAULT_SETTINGS = {
  enabled: true,
  rate: 1.0,
  voiceURI: '',   // empty = OS default voice
};

class CanvasTTS extends Plugin {

  async onload() {
    await this.loadSettings();

    this.observer = null;
    this.lastSpokenText = '';
    this.clickHandler = null;

    this.addSettingTab(new TTSSettingTab(this.app, this));

    this.addCommand({
      id: 'toggle-tts',
      name: 'Toggle Canvas TTS',
      callback: () => {
        this.settings.enabled = !this.settings.enabled;
        this.saveSettings();
        if (!this.settings.enabled) window.speechSynthesis.cancel();
      },
    });

    this.addCommand({
      id: 'cancel-tts',
      name: 'Cancel Canvas TTS speech',
      callback: () => {
        window.speechSynthesis.cancel();
        this.lastSpokenText = '';
      },
    });

    this.setupObserver();

    this.registerEvent(
      this.app.workspace.on('layout-change', () => this.setupObserver())
    );
  }

  onunload() {
    window.speechSynthesis.cancel();
    this.disconnectObserver();
    if (this.clickHandler) {
      document.body.removeEventListener('click', this.clickHandler, true);
      this.clickHandler = null;
    }
  }

  setupObserver() {
    this.disconnectObserver();

    // MutationObserver for card selection and deselection
    this.observer = new MutationObserver((mutations) => {
      if (!this.settings.enabled) return;

      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'class'
        ) {
          const el = mutation.target;
          if (!el.classList.contains('canvas-node')) continue;

          if (el.classList.contains('is-focused')) {
            // Card selected — speak it
            this.speakCard(el);
            break;
          } else {
            // Card deselected — stop speaking
            window.speechSynthesis.cancel();
            this.lastSpokenText = '';
            break;
          }
        }
      }
    });

    this.observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    // Click listener for edge labels (they don't reliably get class mutations)
    if (this.clickHandler) {
      document.body.removeEventListener('click', this.clickHandler, true);
    }
    this.clickHandler = (evt) => {
      if (!this.settings.enabled) return;
      const label = evt.target.closest('.canvas-path-label-wrapper');
      if (label) {
        const text = (label.innerText || label.textContent || '').trim();
        if (text) this.speakText(text);
      }
    };
    document.body.addEventListener('click', this.clickHandler, true);
  }

  disconnectObserver() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  speakCard(cardEl) {
    // Don't speak while the user is editing the card
    if (cardEl.classList.contains('is-editing')) return;
    // Skip web/link embed cards (iframes)
    if (cardEl.querySelector('iframe')) return;

    // Clone so we can strip UI elements without affecting the real DOM
    const clone = cardEl.cloneNode(true);

    // Remove canvas UI chrome from the spoken text
    clone.querySelectorAll('.canvas-node-interaction-layer, button').forEach(el => el.remove());

    const raw = (clone.innerText || clone.textContent || '').trim();

    const text = raw
      // Resolve [[wikilinks|alias]] to alias or target
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) => alias || target)
      // Strip markdown formatting characters
      .replace(/[#*_~`>]/g, '')
      // Strip emojis
      .replace(/\p{Emoji}/gu, '')
      // Strip Obsidian comment delimiters
      .replace(/%/g, '')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim();

    this.speakText(text);
  }

  speakText(text) {
    if (!text || text === this.lastSpokenText) return;
    this.lastSpokenText = text;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.settings.rate;

    if (this.settings.voiceURI) {
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.voiceURI === this.settings.voiceURI);
      if (voice) utterance.voice = voice;
    }

    window.speechSynthesis.speak(utterance);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

// ── Settings tab ──────────────────────────────────────────────────────────────

class TTSSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Enable TTS')
      .setDesc('Speak the selected card or edge label on canvas.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.enabled)
          .onChange(async value => {
            this.plugin.settings.enabled = value;
            if (!value) window.speechSynthesis.cancel();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Speaking rate')
      .setDesc('0.5 = half speed, 1.0 = normal, 2.0 = double speed.')
      .addSlider(slider =>
        slider
          .setLimits(0.5, 2.0, 0.1)
          .setValue(this.plugin.settings.rate)
          .setDynamicTooltip()
          .onChange(async value => {
            this.plugin.settings.rate = value;
            await this.plugin.saveSettings();
          })
      );

    const voiceSetting = new Setting(containerEl)
      .setName('Voice')
      .setDesc('Select a system voice. Leave blank to use the OS default.');

    const populateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;

      voiceSetting.addDropdown(dropdown => {
        dropdown.addOption('', '— OS default —');
        voices.forEach(v => dropdown.addOption(v.voiceURI, `${v.name} (${v.lang})`));
        dropdown.setValue(this.plugin.settings.voiceURI);
        dropdown.onChange(async value => {
          this.plugin.settings.voiceURI = value;
          await this.plugin.saveSettings();
        });
      });
    };

    populateVoices();
    window.speechSynthesis.onvoiceschanged = populateVoices;

    new Setting(containerEl)
      .setName('Test voice')
      .setDesc('Speak a sample sentence using the current voice and rate settings.')
      .addButton(btn =>
        btn
          .setButtonText('▶ Test')
          .onClick(() => {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(
              'Canvas text to speech is working correctly.'
            );
            utterance.rate = this.plugin.settings.rate;
            if (this.plugin.settings.voiceURI) {
              const voices = window.speechSynthesis.getVoices();
              const voice = voices.find(v => v.voiceURI === this.plugin.settings.voiceURI);
              if (voice) utterance.voice = voice;
            }
            window.speechSynthesis.speak(utterance);
          })
      );
  }
}

module.exports = CanvasTTS;
