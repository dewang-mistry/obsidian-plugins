/*
  Branch Writing Convert — Obsidian plugin
  Ports the branch-writing-convert Python script to JavaScript.
  Converts the active note to Branch Writing plugin format.
  Safe to re-run: strips existing <!--section:--> comments before re-numbering.
*/

const { Plugin, Notice } = require('obsidian');

// ── Text processing (direct port of convert.py) ───────────────────────────────

function getHeadingLevel(block) {
  const m = block.trimStart().match(/^(#{1,6})\s/);
  return m ? m[1].length : 0;
}

function stripSectionComments(text) {
  return text.replace(/<!--section:[^>]+-->\s*\n?/g, '');
}

function parseFrontmatter(content) {
  const m = content.match(/^(---\n[\s\S]*?\n---\n)/);
  if (m) return { frontmatter: m[1], body: content.slice(m[0].length) };
  return { frontmatter: null, body: content };
}

function ensureBranchWriting(frontmatter) {
  if (frontmatter.includes('branch-writing')) return frontmatter;
  return frontmatter.replace(/\n---\n$/, '\nbranch-writing: true\n---\n');
}

function removeBranchWriting(frontmatter) {
  return frontmatter.replace(/\nbranch-writing:[^\n]*/, '');
}

function strip(content) {
  content = stripSectionComments(content);
  let { frontmatter, body } = parseFrontmatter(content);
  if (frontmatter) frontmatter = removeBranchWriting(frontmatter);
  return (frontmatter ?? '') + body;
}

// Returns true if a line starts a new list item (bullet or ordered)
function isListItemStart(line) {
  return /^(\s*[-*+]\s|\s*\d+[.)]\s)/.test(line);
}

// Returns true if a line is a continuation of the previous list item
// (indented content, or blank line within a tight list — we treat blank as separator)
function isListContinuation(line) {
  return /^\s{2,}/.test(line) && line.trim() !== '';
}

function splitBlocks(text) {
  const blocks = [];
  let current = [];
  let inFence = false;
  let inList = false;

  const flush = () => {
    if (current.length) {
      blocks.push(current.join('\n'));
      current = [];
    }
  };

  for (const line of text.split('\n')) {
    // Track fenced code blocks — never split inside them
    if (/^(`{3,}|~{3,})/.test(line)) {
      inFence = !inFence;
      current.push(line);
      inList = false;
      continue;
    }

    if (inFence) {
      current.push(line);
      continue;
    }

    // Blank line — end current block
    if (line.trim() === '') {
      flush();
      inList = false;
      continue;
    }

    if (isListItemStart(line)) {
      // Each list item becomes its own block
      flush();
      current.push(line);
      inList = true;
    } else if (inList && isListContinuation(line)) {
      // Continuation line belongs to the current list item
      current.push(line);
    } else {
      // Non-list content
      if (inList) {
        flush();
        inList = false;
      }
      current.push(line);
    }
  }
  flush();
  return blocks.filter(b => b.trim());
}

function sectionNumber(counters, depth) {
  return counters.slice(0, depth).join('.');
}

function convert(content) {
  // Strip existing section comments so re-runs are idempotent
  content = stripSectionComments(content);

  // Frontmatter
  let { frontmatter, body } = parseFrontmatter(content);
  if (frontmatter) {
    frontmatter = ensureBranchWriting(frontmatter);
  } else {
    frontmatter = '---\nbranch-writing: true\n---\n';
  }

  // Split into blocks
  const blocks = splitBlocks(body);

  // Assign section numbers
  const counters = [0, 0, 0, 0, 0, 0, 0]; // index 0 = depth 1
  let currentHeadingDepth = 0;
  const outputBlocks = [];

  for (const block of blocks) {
    const level = getHeadingLevel(block);
    let depth;

    if (level > 0) {
      depth = level;
      currentHeadingDepth = level;
      for (let i = depth; i < 7; i++) counters[i] = 0;
      counters[depth - 1]++;
    } else {
      depth = currentHeadingDepth + 1;
      for (let i = depth; i < 7; i++) counters[i] = 0;
      counters[depth - 1]++;
    }

    const num = sectionNumber(counters, depth);
    outputBlocks.push(`<!--section: ${num}-->\n${block}`);
  }

  return {
    content: frontmatter + '\n' + outputBlocks.join('\n\n') + '\n',
    sectionCount: outputBlocks.length,
  };
}

// ── Plugin ────────────────────────────────────────────────────────────────────

class BranchWritingConvert extends Plugin {
  onload() {
    this.addCommand({
      id: 'convert-to-branch-writing',
      name: 'Convert active note to Branch Writing format',
      callback: () => this.convertActiveNote(),
    });

    this.addCommand({
      id: 'strip-branch-writing',
      name: 'Remove Branch Writing metadata from active note',
      callback: () => this.stripActiveNote(),
    });

    this.addRibbonIcon('git-branch', 'Convert to Branch Writing', () => {
      this.convertActiveNote();
    });
  }

  async convertActiveNote() {
    const file = this.app.workspace.getActiveFile();

    if (!file) {
      new Notice('No active file.');
      return;
    }
    if (file.extension !== 'md') {
      new Notice('Active file is not a markdown note.');
      return;
    }

    const original = await this.app.vault.read(file);
    const { content, sectionCount } = convert(original);
    await this.app.vault.modify(file, content);

    new Notice(`✓ ${sectionCount} sections — ${file.name}`);
  }

  async stripActiveNote() {
    const file = this.app.workspace.getActiveFile();

    if (!file) {
      new Notice('No active file.');
      return;
    }
    if (file.extension !== 'md') {
      new Notice('Active file is not a markdown note.');
      return;
    }

    const original = await this.app.vault.read(file);
    const stripped = strip(original);
    await this.app.vault.modify(file, stripped);

    new Notice(`✓ Branch Writing metadata removed — ${file.name}`);
  }
}

module.exports = BranchWritingConvert;
