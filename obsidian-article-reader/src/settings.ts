import { App, PluginSettingTab, Setting } from "obsidian";
import type ArticleReaderPlugin from "../main";

export interface ArticleReaderSettings {
	elevenLabsApiKey: string;
	elevenLabsVoiceId: string;
	speechRate: number;
	fontSize: number;
	lineHeight: number;
}

export const DEFAULT_SETTINGS: ArticleReaderSettings = {
	elevenLabsApiKey: "",
	elevenLabsVoiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel
	speechRate: 1.0,
	fontSize: 18,
	lineHeight: 1.8,
};

export class ArticleReaderSettingTab extends PluginSettingTab {
	plugin: ArticleReaderPlugin;

	constructor(app: App, plugin: ArticleReaderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Article Reader Settings" });

		// ── TTS Section ──
		containerEl.createEl("h3", { text: "Text-to-Speech" });

		new Setting(containerEl)
			.setName("Speech rate")
			.setDesc("Playback speed (0.5x – 2.0x)")
			.addSlider((slider) =>
				slider
					.setLimits(0.5, 2.0, 0.1)
					.setValue(this.plugin.settings.speechRate)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.speechRate = value;
						await this.plugin.saveSettings();
					})
			);

		// ── ElevenLabs Section ──
		containerEl.createEl("h3", { text: "ElevenLabs (optional)" });
		containerEl.createEl("p", {
			text: "Leave the API key empty to use the built-in Web Speech engine.",
			cls: "setting-item-description",
		});

		new Setting(containerEl)
			.setName("API key")
			.setDesc("Your ElevenLabs API key")
			.addText((text) =>
				text
					.setPlaceholder("Enter API key...")
					.setValue(this.plugin.settings.elevenLabsApiKey)
					.then((t) => (t.inputEl.type = "password"))
					.onChange(async (value) => {
						this.plugin.settings.elevenLabsApiKey = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Voice ID")
			.setDesc("ElevenLabs voice ID (default: Rachel)")
			.addText((text) =>
				text
					.setPlaceholder("21m00Tcm4TlvDq8ikWAM")
					.setValue(this.plugin.settings.elevenLabsVoiceId)
					.onChange(async (value) => {
						this.plugin.settings.elevenLabsVoiceId = value;
						await this.plugin.saveSettings();
					})
			);

		// ── Display Section ──
		containerEl.createEl("h3", { text: "Display" });

		new Setting(containerEl)
			.setName("Font size")
			.setDesc("Article text size in pixels")
			.addSlider((slider) =>
				slider
					.setLimits(12, 28, 1)
					.setValue(this.plugin.settings.fontSize)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.fontSize = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Line height")
			.setDesc("Line spacing multiplier")
			.addSlider((slider) =>
				slider
					.setLimits(1.2, 2.4, 0.1)
					.setValue(this.plugin.settings.lineHeight)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.lineHeight = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
