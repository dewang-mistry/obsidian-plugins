'use strict';

const { Plugin, MarkdownRenderChild } = require('obsidian');

const RSS_DATA_PATH = '.obsidian/plugins/rss-dashboard/data.json';

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseBlockOptions(source) {
  const opts = { limit: 50, sort: 'newest' };
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([a-zA-Z_]+)\s*:\s*(.+)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'limit') {
      const n = parseInt(val, 10);
      if (!isNaN(n) && n > 0) opts.limit = n;
    } else if (key === 'sort') {
      opts.sort = val.toLowerCase();
    }
  }
  return opts;
}

function findFeed(data, fm) {
  if (!fm) return null;
  const feeds = data.feeds || [];

  // 1. Exact feed_url match
  if (fm.feed_url) {
    const hit = feeds.find(f => f.url === fm.feed_url);
    if (hit) return hit;
  }

  // 2. channel_id match — either embedded in feed.url or feed.title equality
  if (fm.channel_id) {
    const target = `channel_id=${fm.channel_id}`;
    const hit = feeds.find(f => f.url && f.url.includes(target));
    if (hit) return hit;
  }

  // 3. Title fallback
  if (fm.title) {
    const lower = String(fm.title).toLowerCase();
    const hit = feeds.find(f => (f.title || '').toLowerCase() === lower);
    if (hit) return hit;
  }

  return null;
}

function renderMessage(container, message) {
  container.empty();
  const el = container.createEl('div', { cls: 'rss-channel-view-message' });
  el.setText(message);
  el.style.padding = '12px';
  el.style.border = '1px dashed var(--background-modifier-border)';
  el.style.borderRadius = '6px';
  el.style.color = 'var(--text-muted)';
}

function renderTable(container, feed, opts) {
  container.empty();

  const wrap = container.createEl('div', { cls: 'rss-channel-view' });

  const header = wrap.createEl('div', { cls: 'rss-channel-view-header' });
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.marginBottom = '8px';

  const titleEl = header.createEl('div');
  titleEl.createEl('strong', { text: feed.title || 'Feed' });

  const items = (feed.items || [])
    .slice()
    .sort((a, b) => {
      const da = new Date(a.pubDate || 0).getTime();
      const db = new Date(b.pubDate || 0).getTime();
      return opts.sort === 'oldest' ? da - db : db - da;
    })
    .slice(0, opts.limit);

  const meta = header.createEl('div', { cls: 'rss-channel-view-meta' });
  meta.style.color = 'var(--text-muted)';
  meta.style.fontSize = '0.85em';
  meta.setText(`${items.length} of ${(feed.items || []).length} videos`);

  if (items.length === 0) {
    const empty = wrap.createEl('div');
    empty.style.color = 'var(--text-muted)';
    empty.setText('No videos synced yet for this feed.');
    return;
  }

  const table = wrap.createEl('table', { cls: 'rss-channel-view-table' });
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';

  const thead = table.createEl('thead');
  const headRow = thead.createEl('tr');
  for (const label of ['', 'Title', 'Published']) {
    const th = headRow.createEl('th', { text: label });
    th.style.textAlign = 'left';
    th.style.borderBottom = '1px solid var(--background-modifier-border)';
    th.style.padding = '6px 8px';
    th.style.fontWeight = '600';
  }

  const tbody = table.createEl('tbody');
  for (const item of items) {
    const row = tbody.createEl('tr');

    const thumbCell = row.createEl('td');
    thumbCell.style.padding = '6px 8px';
    thumbCell.style.verticalAlign = 'top';
    thumbCell.style.width = '140px';
    const thumb = item.coverImage || item.image;
    if (thumb) {
      const img = thumbCell.createEl('img');
      img.src = thumb;
      img.style.width = '130px';
      img.style.height = 'auto';
      img.style.borderRadius = '4px';
      img.style.display = 'block';
    }

    const titleCell = row.createEl('td');
    titleCell.style.padding = '6px 8px';
    titleCell.style.verticalAlign = 'top';
    const link = titleCell.createEl('a', {
      href: item.link || '#',
    });
    link.setAttr('target', '_blank');
    link.setAttr('rel', 'noopener');
    link.style.fontWeight = '500';
    // Make the title navigable + readable by the Article Reader plugin.
    // Article Reader's NavigationController picks up any element with
    // class `ar-list-item`, and TTS reads its textContent on focus.
    const titleSpan = link.createEl('span', {
      cls: 'ar-list-item ar-navigable',
      text: item.title || 'Untitled',
    });
    titleSpan.setAttr('data-rss-channel-view-title', '1');

    const dateCell = row.createEl('td');
    dateCell.style.padding = '6px 8px';
    dateCell.style.verticalAlign = 'top';
    dateCell.style.whiteSpace = 'nowrap';
    dateCell.style.color = 'var(--text-muted)';
    dateCell.style.fontSize = '0.9em';
    dateCell.setText(formatDate(item.pubDate));

    for (const td of [thumbCell, titleCell, dateCell]) {
      td.style.borderBottom = '1px solid var(--background-modifier-border)';
    }
  }
}

module.exports = class RSSChannelViewPlugin extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor('rss-videos', async (source, el, ctx) => {
      const opts = parseBlockOptions(source);

      const adapter = this.app.vault.adapter;
      if (!(await adapter.exists(RSS_DATA_PATH))) {
        renderMessage(el, 'rss-dashboard data.json not found.');
        return;
      }

      let data;
      try {
        const raw = await adapter.read(RSS_DATA_PATH);
        data = JSON.parse(raw);
      } catch (e) {
        renderMessage(el, 'Failed to read rss-dashboard data: ' + e.message);
        return;
      }

      // Get the current note's frontmatter via the source path
      let fm = null;
      const sourcePath = ctx.sourcePath;
      if (sourcePath) {
        const file = this.app.vault.getAbstractFileByPath(sourcePath);
        if (file) {
          const cache = this.app.metadataCache.getFileCache(file);
          fm = cache && cache.frontmatter ? cache.frontmatter : null;
        }
      }

      // Fallback: try note basename as title
      if (!fm || (!fm.feed_url && !fm.channel_id && !fm.title)) {
        if (sourcePath) {
          const base = sourcePath.split('/').pop().replace(/\.md$/, '');
          fm = fm ? { ...fm, title: fm.title || base } : { title: base };
        }
      }

      const feed = findFeed(data, fm);
      if (!feed) {
        renderMessage(el, 'No feed found for this channel.');
        return;
      }

      renderTable(el, feed, opts);
    });
  }
};
