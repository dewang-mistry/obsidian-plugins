/*
  Branch Writing TTS — companion plugin for the Branch Writing Obsidian plugin.
  Speaks the active card aloud using the Web Speech API (built into Electron).
  Does NOT modify Branch Writing — purely observes its DOM output.
*/

const { Plugin, PluginSettingTab, Setting } = require('obsidian');

const DEFAULT_SETTINGS = {
  enabled: true,
  rate: 1.0,
  voiceURI: '',   // empty = OS default voice
};

class BranchWritingTTS extends Plugin {

  async onload() {
    await this.loadSettings();

    this.observer = null;
    this.lastSpokenText = '';

    this.addSettingTab(new TTSSettingTab(this.app, this));

    // Command to toggle TTS on/off without opening settings
    this.addCommand({
      id: 'toggle-tts',
      name: 'Toggle Branch Writing TTS',
      callback: () => {
        this.settings.enabled = !this.settings.enabled;
        this.saveSettings();
        if (!this.settings.enabled) window.speechSynthesis.cancel();
      },
    });

    // Command to cancel speech immediately (assign a hotkey in Settings → Hotkeys)
    this.addCommand({
      id: 'cancel-tts',
      name: 'Cancel Branch Writing TTS speech',
      callback: () => {
        window.speechSynthesis.cancel();
        this.lastSpokenText = '';
      },
    });

    this.setupObserver();

    // Re-attach observer when layout changes (e.g. new pane opened)
    this.registerEvent(
      this.app.workspace.on('layout-change', () => this.setupObserver())
    );
  }

  onunload() {
    window.speechSynthesis.cancel();
    this.disconnectObserver();
  }

  setupObserver() {
    this.disconnectObserver();

    this.observer = new MutationObserver((mutations) => {
      if (!this.settings.enabled) return;

      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'class'
        ) {
          const el = mutation.target;
          if (
            el.classList.contains('branch-card') &&
            el.classList.contains('active-node')
          ) {
            this.speakCard(el);
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
  }

  disconnectObserver() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  speakCard(cardEl) {
    // Clone so we can strip UI elements without affecting the real DOM
    const clone = cardEl.cloneNode(true);

    // Remove tree index numbers and any button overlays from the spoken text
    clone.querySelectorAll('.tree-index, .tree-index-button, .card-buttons, button').forEach(el => el.remove());

    const raw = (clone.innerText || clone.textContent || '').trim();
    // Strip emojis and Obsidian comment delimiters (%%) from spoken text
    const text = raw.replace(/\p{Emoji}/gu, '').replace(/%/g, '').replace(/\s+/g, ' ').trim();

    // Skip if empty or same card spoken twice (class can fire multiple times)
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
      .setDesc('Speak the active card when navigating in Branch Writing view.')
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

    // Voice picker — voices load asynchronously, so we populate after a tick
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
    // Voices may not be loaded yet; retry when the list changes
    window.speechSynthesis.onvoiceschanged = populateVoices;

    // ── Test button ───────────────────────────────────────────────────────────
    new Setting(containerEl)
      .setName('Test voice')
      .setDesc('Speak a sample sentence using the current voice and rate settings.')
      .addButton(btn =>
        btn
          .setButtonText('▶ Test')
          .onClick(() => {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(
              'Branch Writing text to speech is working correctly.'
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

module.exports = BranchWritingTTS;
