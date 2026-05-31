/**
 * Zero-dependency terminal UI helpers for the live demo.
 *
 * No external packages: a judge demo should never break because a color library
 * changed its API. Everything here is plain ANSI. Color is auto-disabled when the
 * output is not a TTY (e.g. piped through `tee` to a log file) or when NO_COLOR is
 * set, so logs stay clean and CI-safe while the live terminal looks sharp.
 */

const isTty = Boolean(process.stdout.isTTY);
// Honor the NO_COLOR convention (https://no-color.org) and disable styling off-TTY.
const useColor = isTty && !process.env.NO_COLOR;

type Style = (s: string) => string;

const wrap = (open: number, close: number): Style => {
  const a = `\u001b[${open}m`;
  const z = `\u001b[${close}m`;
  return (s: string) => (useColor ? `${a}${s}${z}` : s);
};

export const c = {
  reset: '\u001b[0m',
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  italic: wrap(3, 23),
  underline: wrap(4, 24),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  blue: wrap(34, 39),
  magenta: wrap(35, 39),
  cyan: wrap(36, 39),
  gray: wrap(90, 39),
  brightGreen: wrap(92, 39),
  brightCyan: wrap(96, 39),
  brightWhite: wrap(97, 39),
};

/** Terminal width, clamped to a sensible range for stable boxes on any screen. */
export function width(): number {
  const w = process.stdout.columns ?? 80;
  return Math.max(60, Math.min(w, 100));
}

const out = (s: string): void => {
  process.stdout.write(s);
};

/** Pad a visible string to a target width, ignoring ANSI codes when measuring. */
function visibleLen(s: string): number {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\u001b\[[0-9;]*m/g, '').length;
}

function padEndVisible(s: string, target: number): string {
  const pad = target - visibleLen(s);
  return pad > 0 ? s + ' '.repeat(pad) : s;
}

/**
 * The opening banner. Big, calm, and informative: product name, the live network,
 * the model actually driving the run, and the one-line story.
 */
export function banner(opts: {
  network: string;
  model: string;
  provider: string;
  investor: string;
  symbol: string;
  steps: number;
}): void {
  const w = width();
  const line = (ch: string): string => ch.repeat(w);
  const title = 'EQUITY TREASURY AGENT';
  const sub = 'Tokenized securities on Hedera — driven entirely by natural language';

  const center = (s: string): string => {
    const pad = Math.max(0, Math.floor((w - visibleLen(s)) / 2));
    return ' '.repeat(pad) + s;
  };

  out('\n');
  out(c.cyan(line('━')) + '\n');
  out(center(c.bold(c.brightWhite(title))) + '\n');
  out(center(c.dim(sub)) + '\n');
  out(c.cyan(line('━')) + '\n');

  const net = opts.network.toUpperCase();
  const netBadge =
    net === 'MAINNET' ? c.bold(c.red(` ${net} `)) : c.bold(c.green(` ${net} `));
  const kv = (k: string, v: string): string =>
    `  ${c.gray(padEndVisible(k, 11))}${v}`;

  out(kv('Network', netBadge) + '\n');
  out(kv('Model', `${c.brightCyan(opts.model)} ${c.dim(`(${opts.provider})`)}`) + '\n');
  out(kv('Security', c.yellow(opts.symbol)) + '\n');
  out(kv('Investor', c.dim(opts.investor)) + '\n');
  out(kv('Lifecycle', `${opts.steps} live steps, real on-chain transactions`) + '\n');
  out(c.cyan(line('━')) + '\n');
}

/** A boxed step header with progress, e.g. "STEP 3 / 8  ·  Issue shares". */
export function stepHeader(n: number, total: number, title: string): void {
  const w = width();
  const label = `${c.bold(c.brightWhite(`STEP ${n}`))} ${c.dim(`/ ${total}`)}`;
  const dots = c.dim('·');
  out('\n');
  out(`${c.cyan('▌')} ${label}  ${dots}  ${c.bold(title)}\n`);
  // progress meter
  const filled = Math.round((n / total) * (w - 4));
  const bar =
    c.green('█'.repeat(filled)) + c.gray('░'.repeat(Math.max(0, w - 4 - filled)));
  out(`${c.cyan('▌')} ${bar}\n`);
}

/** The natural-language instruction handed to the agent, shown as a quoted prompt. */
export function instruction(text: string): void {
  const w = width();
  out(`${c.gray('└─ prompt')}\n`);
  for (const ln of wrapText(text, w - 4)) {
    out(`   ${c.italic(c.dim(ln))}\n`);
  }
  out('\n');
}

/** Wrap text to a width on word boundaries. */
function wrapText(text: string, w: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    if ((cur + ' ' + word).trim().length > w) {
      if (cur) lines.push(cur);
      cur = word;
    } else {
      cur = (cur ? cur + ' ' : '') + word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Highlight the things judges look for in the agent's reply: tx hashes, EVM
 * addresses, Hedera ids, HashScan links, and numeric balances. Pure cosmetic —
 * the underlying text is unchanged.
 */
export function highlight(reply: string): string {
  if (!useColor) return reply;
  return reply
    // HashScan links
    .replace(/https?:\/\/\S+/g, (m) => c.underline(c.brightCyan(m)))
    // 0x hashes / addresses
    .replace(/0x[0-9a-fA-F]{6,}/g, (m) => c.brightGreen(m))
    // Hedera ids 0.0.x
    .replace(/\b0\.0\.\d+\b/g, (m) => c.yellow(m))
    // SHA-256-ish hex (64 chars, no 0x)
    .replace(/\b[0-9a-f]{64}\b/g, (m) => c.magenta(m));
}

/** Print the agent's reply, indented and highlighted. */
export function reply(text: string): void {
  out(highlight(text) + '\n');
}

/** A green success line with elapsed time. */
export function stepOk(secs: string): void {
  out(`\n${c.brightGreen('✔')} ${c.green('done')} ${c.dim(`· ${secs}s`)}\n`);
}

/** A red failure line. */
export function stepFail(n: number, msg: string): void {
  out(`\n${c.red('✘')} ${c.bold(c.red(`STEP ${n} FAILED`))} ${c.dim('·')} ${c.red(msg)}\n`);
}

/** A dim informational note (e.g. settling for the mirror node). */
export function note(text: string): void {
  out(`${c.dim(`   ⏳ ${text}`)}\n\n`);
}

/** The closing summary. */
export function summary(opts: {
  total: number;
  failures: number;
  network: string;
  elapsedSec: string;
}): void {
  const w = width();
  out('\n' + c.cyan('━'.repeat(w)) + '\n');
  const ok = opts.total - opts.failures;
  if (opts.failures === 0) {
    out(
      `${c.brightGreen('✔')} ${c.bold(c.brightGreen('Demo complete'))} ` +
        `${c.dim('·')} ${c.green(`${ok}/${opts.total} steps`)} ` +
        `${c.dim('·')} live ${c.bold(opts.network.toUpperCase())} ` +
        `${c.dim('·')} ${c.dim(`${opts.elapsedSec}s total`)}\n`,
    );
    out(c.dim('  Every step was a real tool call against the live network.\n'));
  } else {
    out(
      `${c.red('✘')} ${c.bold(c.red('Demo finished with failures'))} ` +
        `${c.dim('·')} ${c.yellow(`${ok}/${opts.total} passed`)} ` +
        `${c.dim('·')} ${c.red(`${opts.failures} failed`)}\n`,
    );
  }
  out(c.cyan('━'.repeat(w)) + '\n');
}

/**
 * A lightweight spinner for the wait while the agent thinks/acts. Animates only on
 * a TTY; off-TTY it prints a single static line so piped logs stay readable.
 * Returns a stop() that clears the line on a TTY.
 */
export function spinner(label: string): { stop: () => void } {
  if (!isTty) {
    out(`${c.dim(`   … ${label}`)}\n`);
    return { stop: () => undefined };
  }
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const tick = (): void => {
    const f = c.cyan(frames[i % frames.length]);
    process.stdout.write(`\r   ${f} ${c.dim(label)}   `);
    i += 1;
  };
  tick();
  const handle = setInterval(tick, 80);
  return {
    stop: (): void => {
      clearInterval(handle);
      // clear the spinner line
      process.stdout.write('\r' + ' '.repeat(width()) + '\r');
    },
  };
}
