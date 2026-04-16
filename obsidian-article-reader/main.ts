import { Plugin, WorkspaceLeaf, TFile } from "obsidian";
import { ArticleView, ARTICLE_VIEW_TYPE } from "./src/ArticleView";
import {
	ArticleReaderSettings,
	ArticleReaderSettingTab,
	DEFAULT_SETTINGS,
} from "./src/settings";

export default class ArticleReaderPlugin extends Plugin {
	settings: ArticleReaderSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		// Register the custom view
		this.registerView(ARTICLE_VIEW_TYPE, (leaf) => new ArticleView(leaf, this));

		// Ribbon icon
		this.addRibbonIcon("book-open", "Toggle Article Reader", () => {
			this.toggleArticleView();
		});

		// Command
		this.addCommand({
			id: "toggle-article-reader",
			name: "Toggle Article Reader",
			callback: () => this.toggleArticleView(),
		});

		// Settings tab
		this.addSettingTab(new ArticleReaderSettingTab(this.app, this));
	}

	onunload() {
		// Obsidian detaches views automatically
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// Update TTS engine in any open article views
		this.app.workspace.getLeavesOfType(ARTICLE_VIEW_TYPE).forEach((leaf) => {
			(leaf.view as ArticleView).rebuildTTS();
		});
	}

	private async toggleArticleView() {
		// If an article reader view exists, close it and go back to the note
		const existing = this.app.workspace.getLeavesOfType(ARTICLE_VIEW_TYPE);
		if (existing.length > 0) {
			existing.forEach((leaf) => leaf.detach());
			return;
		}

		// Otherwise, open article reader
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) return;

		const leaf = this.app.workspace.getLeaf("split", "vertical");

		await leaf.setViewState({
			type: ARTICLE_VIEW_TYPE,
			active: true,
		});

		const view = leaf.view as ArticleView;
		await view.setFile(activeFile);

		this.app.workspace.revealLeaf(leaf);
	}
}
