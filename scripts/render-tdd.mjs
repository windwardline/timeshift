#!/usr/bin/env node
// Renders one Vitest run into TDD evidence, emitting BOTH from the same run:
//   - docs/logs/<label>.txt        (the default reporter's plain-text output)
//   - docs/screenshots/<label>.png (a colored red/green report built from JSON)
//
// Coloring is derived deterministically from Vitest's JSON reporter, so it does
// not depend on terminal/TTY color detection and is identical in CI.
//
// Usage: node scripts/render-tdd.mjs <NN-name-(red|green)> <textLog> <jsonResults>

import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { chromium } from '@playwright/test';

const [, , label, txtPath, jsonPath] = process.argv;

if (!label || !txtPath || !jsonPath || !/^\d{2}-[a-z0-9-]+-(red|green)$/.test(label)) {
  console.error('Usage: node scripts/render-tdd.mjs <NN-name-(red|green)> <textLog> <jsonResults>');
  process.exit(2);
}

const LOG_PATH = join('docs', 'logs', `${label}.txt`);
const PNG_PATH = join('docs', 'screenshots', `${label}.png`);
const CWD = process.cwd();

const ANSI_RE = /\x1B\[[0-9;?]*[A-Za-z]/g;
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rel = (p) => {
  try {
    return relative(CWD, p) || p;
  } catch {
    return p;
  }
};

// Trim a failure message: keep the assertion text and project stack frames,
// drop noisy node_modules / node internals frames.
function trimFailure(msg) {
  return String(msg)
    .split('\n')
    .filter((line) => !/node_modules|node:internal/.test(line))
    .join('\n')
    .trim();
}

function buildHtml(json, fallbackText) {
  const files = Array.isArray(json.testResults) ? json.testResults : [];
  const rows = [];

  for (const file of files) {
    const fileFailed = file.status === 'failed';
    rows.push(
      `<div class="file ${fileFailed ? 'fail' : 'pass'}">${fileFailed ? '❯' : '✓'} ${esc(
        rel(file.name),
      )}</div>`,
    );

    const assertions = file.assertionResults || [];
    for (const a of assertions) {
      const passed = a.status === 'passed';
      const ms = a.duration != null ? ` <span class="dim">${a.duration.toFixed(0)}ms</span>` : '';
      const name = [...(a.ancestorTitles || []), a.title].join(' › ');
      rows.push(
        `<div class="test ${passed ? 'pass' : 'fail'}">${passed ? '✓' : '×'} ${esc(name)}${ms}</div>`,
      );
      if (!passed) {
        for (const fm of a.failureMessages || []) {
          rows.push(`<pre class="err">${esc(trimFailure(fm))}</pre>`);
        }
      }
    }

    // Suite-level error (e.g. an import/collection failure with no assertions).
    if (fileFailed && assertions.length === 0 && file.message) {
      rows.push(`<pre class="err">${esc(trimFailure(file.message))}</pre>`);
    }
  }

  // If JSON carried no usable detail but the run failed, show the raw log tail.
  if (rows.length === 0 && fallbackText) {
    rows.push(`<pre class="err">${esc(fallbackText.replace(ANSI_RE, '').slice(-4000))}</pre>`);
  }

  const total = json.numTotalTests ?? 0;
  const failed = json.numFailedTests ?? 0;
  const passed = json.numPassedTests ?? 0;
  const ok = json.success === true && failed === 0;
  const summary = ok
    ? `<span class="pass">Tests  ${passed} passed (${total})</span>`
    : `<span class="fail">Tests  ${failed} failed</span> <span class="dim">|</span> <span class="pass">${passed} passed</span> <span class="dim">(${total})</span>`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;background:#1e1e1e;}
    .term{font-family:'SFMono-Regular',Menlo,Consolas,'Liberation Mono',monospace;
      font-size:13px;line-height:1.55;color:#d4d4d4;padding:22px;white-space:pre-wrap;}
    .run{color:#dcdcaa;margin-bottom:14px;}
    .file{margin-top:10px;font-weight:600;}
    .test{margin-left:18px;}
    .pass{color:#73c991;}
    .fail{color:#f14c4c;}
    .dim{color:#808080;}
    .err{color:#f14c4c;background:#2a1416;border-left:3px solid #f14c4c;
      margin:4px 0 4px 18px;padding:8px 12px;white-space:pre-wrap;}
    .summary{margin-top:16px;border-top:1px solid #333;padding-top:12px;}
  </style></head><body><div class="term"><div class="run">RUN  vitest — ${esc(
    rel(CWD) === '' ? CWD : CWD,
  )}</div>${rows.join('\n')}<div class="summary">${summary}</div></div></body></html>`;
}

async function screenshot(html, outPath) {
  const htmlPath = join(tmpdir(), `tdd-${label}-${Date.now()}.html`);
  await writeFile(htmlPath, html, 'utf8');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    await page.goto('file://' + htmlPath);
    await page.screenshot({ path: outPath, fullPage: true });
  } finally {
    await browser.close();
    await rm(htmlPath, { force: true });
  }
}

const textLog = await readFile(txtPath, 'utf8').catch(() => '');
let json = {};
try {
  json = JSON.parse(await readFile(jsonPath, 'utf8'));
} catch {
  json = {};
}

await mkdir('docs/logs', { recursive: true });
await mkdir('docs/screenshots', { recursive: true });
await writeFile(LOG_PATH, textLog.replace(ANSI_RE, '').trimEnd() + '\n', 'utf8');
await screenshot(buildHtml(json, textLog), PNG_PATH);

const ok = json.success === true && (json.numFailedTests ?? 0) === 0;
console.log(`[render-tdd] label=${label} success=${ok} passed=${json.numPassedTests ?? '?'} failed=${json.numFailedTests ?? '?'}`);
console.log(`[render-tdd] log  -> ${LOG_PATH}`);
console.log(`[render-tdd] shot -> ${PNG_PATH}`);
