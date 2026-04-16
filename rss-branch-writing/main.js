'use strict';

const { Plugin, Notice } = require('obsidian');

const RSS_DATA_PATH = '.obsidian/plugins/rss-dashboard/data.json';
const ITEMS_PER_FEED = 10;

// Matches leading emoji / pictographs + optional variation selectors / ZWJ sequences
// and any whitespace that follows. Keeps CJK and regular letters.
const LEADING_EMOJI_RE = /^(?:[\p{Extended_Pictographic}\u200d\uFE0F]+\s*)+/u;

function stripLeadingEmoji(name) {
  if (!name) return '';
  const cleaned = name.replace(LEADING_EMOJI_RE, '').trim();
  return cleaned || name;
}

function escapeMd(str) {
  if (!str) return '';
  return String(str).replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

// Escape characters that break a wiki link alias
function wikiLink(target, alias) {
  const t = String(target).replace(/[\[\]|]/g, '');
  if (alias && alias !== target) {
    const a = String(alias).replace(/[\[\]|]/g, '');
    return `[[${t}|${a}]]`;
  }
  return `[[${t}]]`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function timestampForFilename(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}${pad(d.getMinutes())}`;
}

// Turn a path like "🫶 Soft Skills/🧠 Think" into ["🫶 Soft Skills", "🧠 Think"]
function splitFolderPath(path) {
  return String(path || 'Uncategorized')
    .split('/')
    .map(s => s.trim())
    .filter(Boolean);
}

function buildMarkdown(data) {
  const lines = ['---', 'branch-writing: true', '---', ''];

  // Build a tree: folder name -> { feeds: [], children: Map }
  const root = { children: new Map(), feeds: [] };
  for (const feed of data.feeds || []) {
    const segments = splitFolderPath(feed.folder);
    let node = root;
    for (const seg of segments) {
      if (!node.children.has(seg)) {
        node.children.set(seg, { children: new Map(), feeds: [] });
      }
      node = node.children.get(seg);
    }
    node.feeds.push(feed);
  }

  // Does this subtree contain at least one feed with items?
  function hasItems(node) {
    for (const feed of node.feeds) {
      if ((feed.items || []).length > 0) return true;
    }
    for (const child of node.children.values()) {
      if (hasItems(child)) return true;
    }
    return false;
  }

  // Render a folder node recursively.
  // `depth` is the heading level (1=#, 2=##, 3=###, 4=####).
  // `sectionPrefix` is the accumulated "1.2.3" string.
  // Returns nothing; mutates `lines`.
  function renderFolder(name, node, depth, sectionPrefix) {
    // Strip emoji from both target and alias. obsidian-icon-folder will
    // render its own icon on the linked note, so we don't want to also
    // include the emoji in the link text (that causes a duplicate icon).
    const linkTarget = stripLeadingEmoji(name);
    const heading = '#'.repeat(Math.min(depth, 6));

    lines.push(`<!--section: ${sectionPrefix}-->`);
    lines.push(`${heading} ${wikiLink(linkTarget)}`);
    lines.push('');

    // Render subfolders first (sorted by name), then feeds in this folder
    const childEntries = Array.from(node.children.entries())
      .filter(([, child]) => hasItems(child))
      .sort((a, b) => a[0].localeCompare(b[0]));

    let subIdx = 0;
    for (const [childName, childNode] of childEntries) {
      subIdx += 1;
      renderFolder(childName, childNode, depth + 1, `${sectionPrefix}.${subIdx}`);
    }

    const feeds = node.feeds
      .filter(f => (f.items || []).length > 0)
      .sort((a, b) => (a.title || '').localeCompare(b.title || ''));

    for (const feed of feeds) {
      subIdx += 1;
      const feedSection = `${sectionPrefix}.${subIdx}`;
      renderFeed(feed, depth + 1, feedSection);
    }
  }

  function renderFeed(feed, depth, sectionPrefix) {
    const heading = '#'.repeat(Math.min(depth, 6));
    const title = feed.title || 'Untitled feed';

    lines.push(`<!--section: ${sectionPrefix}-->`);
    lines.push(`${heading} ${wikiLink(title)}`);
    lines.push('');
    if (feed.iconUrl) {
      lines.push(`![](${feed.iconUrl})`);
      lines.push('');
    }

    const items = (feed.items || [])
      .slice()
      .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0))
      .slice(0, ITEMS_PER_FEED);

    const itemHeading = '#'.repeat(Math.min(depth + 1, 6));
    let itemIdx = 0;
    for (const item of items) {
      itemIdx += 1;
      const itemSection = `${sectionPrefix}.${itemIdx}`;
      lines.push(`<!--section: ${itemSection}-->`);
      lines.push(`${itemHeading} [${escapeMd(item.title || 'Untitled')}](${item.link || ''})`);
      lines.push('');

      const thumb = item.coverImage || item.image;
      if (thumb) {
        lines.push(`![](${thumb})`);
        lines.push('');
      }
    }
  }

  // Top-level folders, sorted, only those that have any items
  const topEntries = Array.from(root.children.entries())
    .filter(([, child]) => hasItems(child))
    .sort((a, b) => a[0].localeCompare(b[0]));

  let folderIdx = 0;
  for (const [name, node] of topEntries) {
    folderIdx += 1;
    renderFolder(name, node, 1, `${folderIdx}`);
  }

  return lines.join('\n');
}

module.exports = class RSSBranchWritingPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: 'generate-rss-branch-writing-note',
      name: 'Generate RSS branch-writing note',
      callback: () => this.generate(),
    });
  }

  async generate() {
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(RSS_DATA_PATH))) {
      new Notice('rss-dashboard data.json not found');
      return;
    }

    let data;
    try {
      const raw = await adapter.read(RSS_DATA_PATH);
      data = JSON.parse(raw);
    } catch (e) {
      new Notice('Failed to read rss-dashboard data: ' + e.message);
      return;
    }

    const md = buildMarkdown(data);
    const stamp = timestampForFilename(new Date());
    const filename = `RSS Feeds ${stamp}.md`;

    await adapter.write(filename, md);
    new Notice(`Generated ${filename}`);

    const file = this.app.vault.getAbstractFileByPath(filename);
    if (file) {
      await this.app.workspace.getLeaf().openFile(file);
    }
  }
};
