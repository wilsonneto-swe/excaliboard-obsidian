// THIRD-PARTY-NOTICES.md says what main.js and styles.css bundle, who wrote it and under which licence. This script
// writes it: `node scripts/third-party-notices.mjs`. With --check it writes nothing, and exits 1 when the file on disk
// differs from what it would write. It needs Node 22 or later, and esbuild from the devDependencies.
// - BUNDLED: the packages come from esbuild's metafile, built with esbuild.config.mjs's bundling options (BUNDLING,
//   kept in step by hand). Excaliboard's own code and the Mermaid stub (stubs/) aren't in node_modules, so they aren't
//   listed.
// - FROM NODE_MODULES: each package's name, version and declared licence come from its package.json, and the full
//   text of every LICENSE, LICENCE, COPYING or NOTICE file at the top of its folder.
// - HAND-WRITTEN: what node_modules doesn't hold is in the data and the licence texts at the end of this file, each
//   with the address it was taken from: the fonts, the licences of packages published without one, and other
//   projects' code that packages include in their own builds. Each entry names the versions it was checked against,
//   and the script stops when other versions are bundled, so that whoever updates a package checks the entry again.
// - GROUPED: licence texts that differ only in their copyright lines, an "MIT License" title or line breaks are printed
//   once, after the list of everything that uses them, each with its own copyright lines.
import esbuild from 'esbuild';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const NOTICES = 'THIRD-PARTY-NOTICES.md';

/**
 * The modules of Excalidraw's that esbuild.config.mjs replaces (dropLocales, replaceSubsetting), kept in step with it:
 * their code isn't in main.js, so neither are the licences of what it holds.
 */
const STAND_INS = {
  name: 'stand-ins',
  setup(build) {
    build.onResolve({ filter: /^\.\/(locales\/[\w-]+|subset-(shared|worker)\.chunk)\.js$/ }, (args) =>
      /[\\/]@excalidraw[\\/]excalidraw[\\/]dist[\\/]prod[\\/]/.test(args.importer)
        ? { path: args.path, namespace: 'stand-in' }
        : undefined,
    );
    build.onLoad({ filter: /.*/, namespace: 'stand-in' }, () => ({ contents: 'export {};', loader: 'js' }));
  },
};

/** The options of esbuild.config.mjs that decide what main.js and styles.css bundle. Keep them in step with it. */
const BUNDLING = {
  entryPoints: ['src/main.ts'],
  outfile: 'main.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2021',
  external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*'],
  define: { 'process.env.NODE_ENV': '"production"' },
  conditions: ['production'],
  loader: { '.woff2': 'dataurl' },
  minify: false,
  plugins: [STAND_INS],
};

/**
 * How esbuild.config.mjs embeds fonts in main.js, kept in step with it: Excalidraw's prod code refers to each font file
 * by this path, and its embedFonts plugin turns every one into a data: URL, except the families it leaves to the system.
 * The woff2 files Excalidraw's stylesheet imports are inlined into styles.css by the dataurl loader in BUNDLING.
 */
const EXCALIDRAW_PROD_JS = /node_modules\/@excalidraw\/excalidraw\/dist\/prod\/[^/]+\.js$/;
const FONT_PATH = /"\.\/fonts\/([A-Za-z]+)\/[\w.-]+\.woff2"/g;
const LEFT_TO_THE_SYSTEM = new Set(['Xiaolai', 'Liberation']);

const LICENCE_FILE = /^(licen[cs]e|copying|notice)([.-]|$)/i;
/** The start of a licence's first sentence. Its copyright lines come before it. */
const LICENCE_START =
  /^\s*(permission (is hereby granted|is granted|to use)|licensed under the apache|redistribution and use|terms and conditions for use)/i;
/** A copyright line, but not a sentence of a licence that starts with "copyright" (such as "copyright holders"). */
const COPYRIGHT =
  /^\s*(copyright\b(?!\s+(and|holders?|notice|owners?|licen[cs]e|law|statement)\b)|©|\(c\)\s*\d|all rights reserved\b)/i;
const MIT_TITLE = /^\(?(the )?mit licen[cs]e( \(mit\))?\)?$/i;
const LICENCE_NAMES = {
  '0BSD': 'BSD Zero Clause License',
  'Apache-2.0': 'Apache License 2.0',
  'BSD-3-Clause': 'BSD 3-Clause License',
  'CC-BY-4.0': 'Creative Commons Attribution 4.0',
  'CC0-1.0': 'CC0 1.0 Universal',
  ISC: 'ISC License',
  MIT: 'MIT License',
  'Old MIT': 'Old MIT License',
  Zlib: 'zlib License',
};
const WIDTH = 118;
/** What Markdown would read as a list, heading, quote, table or code fence at the start of a line. */
const BLOCK_START = /^([-+*>#=|]|\d+[.)]|```)/;

async function main() {
  const { metafile } = await esbuild.build({
    ...BUNDLING,
    absWorkingDir: root,
    metafile: true,
    write: false,
    logLevel: 'error',
  });
  const inputs = Object.values(metafile.outputs).flatMap((output) =>
    Object.entries(output.inputs)
      .filter(([, { bytesInOutput }]) => bytesInOutput > 0)
      .map(([input]) => input),
  );
  const notices = render(bundledPackages(metafile), embeddedFonts(metafile), inputs);
  const file = path.join(root, NOTICES);
  if (!process.argv.includes('--check')) {
    writeFileSync(file, notices);
    console.log(`Wrote ${NOTICES}.`);
  } else if ((existsSync(file) ? readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : '') === notices) {
    console.log(`${NOTICES} is up to date.`);
  } else {
    console.error(`${NOTICES} is out of date: run node scripts/third-party-notices.mjs`);
    process.exitCode = 1;
  }
}

/** Every package with code in main.js or styles.css, once per name and version, in order. */
function bundledPackages(metafile) {
  const folders = new Set();
  for (const { inputs } of Object.values(metafile.outputs))
    for (const [input, { bytesInOutput }] of Object.entries(inputs)) {
      const folder = /^(.*node_modules\/(@[^/]+\/)?[^/]+)\//.exec(input)?.[1];
      if (folder && bytesInOutput > 0) folders.add(folder);
    }
  const packages = new Map();
  for (const folder of folders) {
    const pkg = readPackage(folder);
    if (!packages.has(id(pkg))) packages.set(id(pkg), pkg);
  }
  return [...packages.values()].sort(byNameAndVersion);
}

/** A package's name, version and declared licence, and the texts of its licence files. */
function readPackage(folder) {
  const dir = path.join(root, folder);
  const json = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const files = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && LICENCE_FILE.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  return {
    name: json.name,
    version: json.version,
    license: json.license?.type ?? json.license ?? json.licenses?.map((l) => l.type).join(' OR ') ?? 'unknown',
    texts: files.map((file) => readFileSync(path.join(dir, file), 'utf8')),
  };
}

/** The font families main.js and styles.css embed, each with the file it is in. */
function embeddedFonts(metafile) {
  const fonts = new Map();
  for (const [output, { inputs }] of Object.entries(metafile.outputs))
    for (const [input, { bytesInOutput }] of Object.entries(inputs)) {
      if (bytesInOutput === 0) continue;
      if (EXCALIDRAW_PROD_JS.test(input))
        for (const [, family] of readFileSync(path.join(root, input), 'utf8').matchAll(FONT_PATH))
          if (!LEFT_TO_THE_SYSTEM.has(family)) fonts.set(family, 'main.js');
      if (output.endsWith('.css'))
        for (const { path: file, external } of metafile.inputs[input]?.imports ?? [])
          if (!external && file.endsWith('.woff2')) fonts.set(file.split('/').at(-2), 'styles.css');
    }
  return fonts;
}

/** The notices, once the hand-written data is checked against what is bundled. */
function render(packages, fonts, inputs) {
  const versionsOf = (name) => packages.filter((pkg) => pkg.name === name).map((pkg) => pkg.version);
  checked('FONTS', [FONTS_CHECKED_WITH], versionsOf);
  for (const family of fonts.keys())
    if (!FONTS.some((font) => font.family === family))
      throw new Error(`main.js or styles.css embeds the font family ${family}, which FONTS doesn't describe.`);
  const shipped = FONTS.filter((font) => fonts.has(font.family));
  const excalidraw = versionsOf('@excalidraw/excalidraw')[0];

  const out = [
    '# Third-party notices',
    '',
    wrap(
      `Excaliboard bundles the Excalidraw editor (\`@excalidraw/excalidraw\` ${excalidraw}), React ` +
        `${versionsOf('react').join(', ')} and the packages they use into \`main.js\`, and Excalidraw's stylesheet ` +
        'into `styles.css`: Obsidian installs a plugin as those two files and `manifest.json`, and the editor never ' +
        'goes online. For the same reason the fonts Excalidraw draws with are embedded in `main.js`, rather than ' +
        "fetched from Excalidraw's CDN, and its interface font in `styles.css`.",
    ),
    '',
    wrap(
      "Some parts of Excalidraw aren't shipped. Xiaolai, its hand-drawn CJK font, is left out, so Chinese, Japanese " +
        'and Korean text is drawn in a system font. So is Liberation Sans, which Excalidraw keeps for exports made ' +
        "on its servers and doesn't offer in its font picker; its version 1.05 is under the GNU GPL, unlike the " +
        'other fonts. Its Mermaid importer, `@excalidraw/mermaid-to-excalidraw`, is replaced by a stub ' +
        '(`stubs/mermaid-to-excalidraw`), so neither it nor Mermaid is bundled.',
    ),
    '',
    wrap(
      "`scripts/third-party-notices.mjs` writes this file from esbuild's metafile and the licence files in " +
        "`node_modules`; what `node_modules` doesn't hold is written in the script, with the address of each source. " +
        '`node scripts/third-party-notices.mjs --check` fails when this file is out of date.',
    ),
    '',
    '## Fonts',
    '',
    wrap(
      `\`main.js\` embeds the fonts Excalidraw ${excalidraw} draws with, and \`styles.css\` its interface font, as ` +
        `data URLs. They are the font files of its npm package (\`dist/prod/fonts/\`), the same as in its ` +
        `repository's [fonts folder at v${excalidraw}](${EXCALIDRAW_TREE}/packages/excalidraw/fonts). That folder ` +
        "has no licence files, so each font's licence and copyright lines come from the font's own project, or from " +
        'the fields inside its font files (their name table), as noted for each.',
    ),
    '',
  ];
  for (const font of shipped) {
    out.push(`### ${font.name}`, '', wrap(`${font.about} In \`${fonts.get(font.family)}\`, under the ${font.licence}`));
    for (const { from, lines } of font.copyright)
      out.push('', wrap(`From ${from}:`), '', ...lines.map((line) => wrap(escape(line), '- ', '  ')));
    out.push('');
  }
  for (const [kind, licence] of Object.entries(FONT_LICENCES))
    if (shipped.some((font) => font.kind === kind)) {
      out.push(`### ${licence.heading}`, '', wrap(licence.about), '');
      for (const key of licence.texts)
        out.push(fenced(licence.withoutCopyright ? splitCopyright(TEXTS[key]).body : TEXTS[key]), '');
    }

  const entries = [];
  const sources = new Set();
  for (const pkg of packages) {
    let texts = pkg.texts;
    if (!texts.length) {
      const source = WITHOUT_LICENCE_FILE.find((s) => s.packages.includes(id(pkg)));
      if (!source)
        throw new Error(
          `${id(pkg)} has no licence file, and no entry of WITHOUT_LICENCE_FILE was checked for this version: ` +
            'find its licence and add it there.',
        );
      sources.add(source);
      texts = [licenceText(source)];
    }
    for (const text of texts) entries.push({ ...pkg, label: `\`${id(pkg)}\``, text });
  }
  const builds = INSIDE_BUILDS.filter(
    (build) =>
      checked('INSIDE_BUILDS', build.in, versionsOf, true) &&
      (!build.bundles || inputs.some((input) => build.bundles.test(input))),
  );
  for (const build of builds)
    for (const entry of build.entries) {
      const where = (entry.in ?? build.in).map((pin) => `\`${pin}\``).join(' and ');
      entries.push({ ...entry, label: `[${entry.label}](${entry.url}) (in ${where})`, text: licenceText(entry) });
    }

  out.push(
    '## Packages',
    '',
    wrap(
      `\`main.js\` and \`styles.css\` hold code from ${new Set(packages.map((pkg) => pkg.name)).size} npm packages ` +
        `(${packages.length} versions), found in esbuild's metafile. Each is listed with the copyright lines of the ` +
        'licence files in its npm package.',
    ),
    '',
  );
  if (sources.size)
    out.push(
      wrap('These were published without a licence file, so their licence comes from their repository:'),
      '',
      ...[...sources].map((source) => wrap(source.about, '- ', '  ')),
      '',
    );
  if (builds.length)
    out.push(
      wrap(
        "Some packages' builds include other projects' code, which `node_modules` doesn't hold apart. Those projects " +
          'are listed too, with the package they are in:',
      ),
      '',
      ...builds.map((build) => wrap(build.about, '- ', '  ')),
      '',
    );
  out.push(
    wrap(
      'Licence texts that differ only in their copyright lines, an "MIT License" title or line breaks are given ' +
        'once, after the list of everything that uses them.',
    ),
    '',
  );
  for (const group of groupByText(entries)) {
    out.push(`### ${group.heading}`, '');
    for (const { labels, copyright } of group.lines) {
      const suffix = copyright.length === 1 ? `: ${escape(copyright[0])}` : copyright.length ? ':' : '';
      out.push(wrap(labels.join(', ') + suffix, '- ', '  '));
      if (copyright.length > 1) for (const line of copyright) out.push(wrap(escape(line), '  - ', '    '));
    }
    out.push('', fenced(group.text), '');
  }
  return `${out.join('\n').trimEnd()}\n`;
}

/**
 * Groups licence texts that are the same apart from their copyright lines, an MIT title and line breaks, keeping the
 * most common wording. Each group lists its entries by their copyright lines. The biggest group comes first and is
 * named after its licence; the others follow by heading, which adds their packages' names.
 */
function groupByText(entries) {
  const byText = new Map();
  for (const entry of [...entries].sort(byNameAndVersion)) {
    const { copyright, body } = splitCopyright(entry.text);
    const key = body.replace(/\s+/g, ' ');
    if (!byText.has(key)) byText.set(key, { wordings: new Map(), members: [] });
    const group = byText.get(key);
    group.wordings.set(body, (group.wordings.get(body) ?? 0) + 1);
    group.members.push({ ...entry, copyright });
  }
  const groups = [...byText.values()].map(({ wordings, members }) => {
    const licence = mostCommon(members.map((member) => member.license));
    const lines = new Map();
    for (const { label, license, copyright } of members) {
      const key = copyright.join('\n');
      const declared =
        license === licence ? label : `${label} (its package.json says ${license.replace(/^\((.*)\)$/, '$1')})`;
      if (!lines.has(key)) lines.set(key, { labels: [], copyright });
      if (!lines.get(key).labels.includes(declared)) lines.get(key).labels.push(declared);
    }
    return {
      name: LICENCE_NAMES[licence] ?? licence,
      names: [...new Set(members.map((member) => member.name))],
      size: members.length,
      lines: [...lines.values()],
      text: mostCommon([...wordings.keys()], [...wordings.values()]),
    };
  });
  const [biggest, ...others] = groups.sort((a, b) => b.size - a.size);
  if (!biggest) return [];
  biggest.heading = biggest.name;
  for (const group of others) group.heading = `${group.name}: ${group.names.join(', ')}`;
  return [biggest, ...others.sort((a, b) => compare(a.heading.toLowerCase(), b.heading.toLowerCase()))];
}

/**
 * A licence text's copyright lines (those before its first sentence, or in its first 10 lines if no sentence is
 * recognised), and the rest, without an "MIT License" title.
 */
function splitCopyright(text) {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd());
  const start = lines.findIndex((line) => LICENCE_START.test(line));
  const header = start < 0 ? Math.min(lines.length, 10) : start;
  const copyright = [];
  const body = [];
  lines.forEach((line, i) => {
    if (i < header && COPYRIGHT.test(line)) copyright.push(line.trim());
    else if (!(i < header && MIT_TITLE.test(line.trim()))) body.push(line);
  });
  return {
    copyright,
    body: body
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\n+|\n+$/g, ''),
  };
}

/**
 * Throws unless each package an entry was checked against is bundled at that version, and at no other. An optional
 * entry may also find none of its packages bundled, and then returns false.
 */
function checked(what, pins, versionsOf, optional = false) {
  const found = pins.map((pin) => {
    const name = pin.slice(0, pin.lastIndexOf('@'));
    return { pin, name, versions: versionsOf(name) };
  });
  if (optional && found.every(({ versions }) => !versions.length)) return false;
  for (const { pin, name, versions } of found)
    if (versions.length !== 1 || `${name}@${versions[0]}` !== pin)
      throw new Error(
        `${what} was checked against ${pin}, but ${versions.length ? `${name} ${versions.join(', ')} is` : 'it is not'}` +
          ' bundled: check the entry against what is bundled now, and update it.',
      );
  return true;
}

function licenceText(entry) {
  return entry.mit ? ['MIT License', '', ...entry.mit, '', TEXTS.mit].join('\n') : TEXTS[entry.text];
}

function id(pkg) {
  return `${pkg.name}@${pkg.version}`;
}

function byNameAndVersion(a, b) {
  return compare(a.name.toLowerCase(), b.name.toLowerCase()) || compareVersions(a.version ?? '', b.version ?? '');
}

function compareVersions(a, b) {
  const x = a.split(/[.+-]/);
  const y = b.split(/[.+-]/);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const order = Number(x[i] ?? -1) - Number(y[i] ?? -1) || compare(x[i] ?? '', y[i] ?? '');
    if (order) return order;
  }
  return 0;
}

/** Compares strings by code unit, the same on every machine (unlike localeCompare). */
function compare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The value that occurs most often, or has the most weight. A tie goes to the first. */
function mostCommon(values, weights = values.map(() => 1)) {
  const totals = new Map();
  values.forEach((value, i) => totals.set(value, (totals.get(value) ?? 0) + weights[i]));
  let best;
  for (const [value, total] of totals) if (best === undefined || total > totals.get(best)) best = value;
  return best;
}

/**
 * Wraps a paragraph or list item at WIDTH. Code spans and link texts stay on one line, and no line starts with what
 * Markdown would read as a new block.
 */
function wrap(text, first = '', rest = first) {
  const words = [];
  for (const word of text.split(' ')) {
    const last = words.at(-1);
    const open = last !== undefined && ((last.match(/`/g)?.length ?? 0) % 2 === 1 || /\[[^\]]*$/.test(last));
    if (open) words[words.length - 1] = `${last} ${word}`;
    else words.push(word);
  }
  const lines = [];
  let line = '';
  for (const word of words) {
    const indent = lines.length ? rest : first;
    if (line && indent.length + line.length + 1 + word.length > WIDTH && !BLOCK_START.test(word)) {
      lines.push(indent + line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  lines.push((lines.length ? rest : first) + line);
  return lines.join('\n');
}

/** A copyright line as plain text in Markdown, without links, emphasis or HTML, but with its addresses kept as links. */
function escape(text) {
  return text
    .split(/(<(?:https?:\/\/|[^\s<>@]+@)[^\s<>]*>|https?:\/\/[^\s<>()]+)/)
    .map((part, i) => (i % 2 ? part : part.replace(/[\\`*_[\]<]/g, '\\$&')))
    .join('');
}

function fenced(text) {
  let fence = '```';
  while (text.includes(fence)) fence += '`';
  return `${fence}\n${text}\n${fence}`;
}

// -----------------------------------------------------------------------------------------------------------------
// HAND-WRITTEN DATA: what node_modules doesn't hold. The licence texts the entries name are in TEXTS, below.
// -----------------------------------------------------------------------------------------------------------------

const EXCALIDRAW_BLOB = 'https://github.com/excalidraw/excalidraw/blob/v0.18.1';
const EXCALIDRAW_TREE = 'https://github.com/excalidraw/excalidraw/tree/v0.18.1';

/** FONTS and FONT_LICENCES were checked against this release of Excalidraw. */
const FONTS_CHECKED_WITH = '@excalidraw/excalidraw@0.18.1';

/**
 * The fonts, by their folder in Excalidraw's fonts/ (`family`): those it draws text with, then its interface font.
 * "The font's copyright field" (or licence, version, designer field) is that field of the name table in the font's
 * files, which are the same in Excalidraw's npm package and in its repository at v0.18.1. `licence` follows "under the".
 */
const FONTS = [
  {
    family: 'Excalifont',
    name: 'Excalifont',
    kind: 'OFL',
    about:
      "Excalidraw's hand-drawn font, based on Virgil, with modifications by Ján Filípek / DizajnDesign (the designer " +
      'field of the full font).',
    licence:
      'SIL Open Font License 1.1, as the licence field of the full font says. The subsets Excalidraw ships keep only ' +
      "its copyright, naming and version fields, and Excalidraw's source reproduces all of them in " +
      `[fonts/Excalifont/index.ts](${EXCALIDRAW_BLOB}/packages/excalidraw/fonts/Excalifont/index.ts).`,
    copyright: [
      { from: "the font's copyright field", lines: ['Copyright (c) 2024 by Excalidraw. All rights reserved.'] },
    ],
  },
  {
    family: 'Virgil',
    name: 'Virgil',
    kind: 'OFL',
    about: "Excalidraw's original hand-drawn font, by Ellinor Rapp.",
    licence:
      'SIL Open Font License 1.1, as its ' +
      '[LICENSE.md](https://github.com/excalidraw/virgil/blob/3d4c829dc85b455d4646631ac52bc1517df04217/LICENSE.md) ' +
      "and the font's licence field say.",
    copyright: [
      { from: 'LICENSE.md', lines: ['Copyright (c) 2021 - Present, Ellinor Rapp, with Reserved Font Name Virgil.'] },
      {
        from: "the font's copyright field",
        lines: ['Copyright (c) 2011 by Your Own Font Foundry. All rights reserved.'],
      },
    ],
  },
  {
    family: 'Nunito',
    name: 'Nunito',
    kind: 'OFL',
    about: "Version 3.602 (the font's version field).",
    licence:
      "SIL Open Font License 1.1, as the Nunito project's " +
      '[OFL.txt](https://github.com/googlefonts/nunito/blob/8c6a9bb9732545b9ed53f29ec5e1ab0ff53c4e6f/OFL.txt) says.',
    copyright: [
      {
        from: "OFL.txt and the font's copyright field",
        lines: ['Copyright 2014 The Nunito Project Authors (https://github.com/googlefonts/nunito)'],
      },
    ],
  },
  {
    family: 'Lilita',
    name: 'Lilita One',
    kind: 'OFL',
    about: "By Juan Montoreano, version 1.002 (the font's version field).",
    licence:
      'SIL Open Font License 1.1, as its ' +
      '[OFL.txt](https://github.com/google/fonts/blob/5bb28733cec313b63fbd415b574b5ae35c8aa8b8/ofl/lilitaone/OFL.txt) ' +
      "in Google Fonts' repository says.",
    copyright: [
      {
        from: 'OFL.txt',
        lines: ['Copyright (c) 2011 Juan Montoreano (juan@remolacha.biz), with Reserved Font Name Lilita'],
      },
      {
        from: "the font's copyright field",
        lines: ['Copyright (c) 2011 Juan Montoreano (juan@remolacha.biz), with Reserved Font Names "Lilita One"'],
      },
    ],
  },
  {
    family: 'ComicShanns',
    name: 'Comic Shanns',
    kind: 'MIT',
    about:
      "Comic Shanns Mono, Jesus Gonzalez's monospaced version of Shannon Miwa's Comic Shanns. Its copyright field is " +
      "the one in the project's " +
      '[source](https://github.com/jesusmgg/comic-shanns-mono/blob/5a13931471e3a5546adcf5dd772946aa34602e79/src/ComicShannsMono-Regular.sfd) ' +
      'since June 2024, after the v1.3.0 release, although its version field says 1.3.0.',
    licence:
      "MIT License, as the font's copyright field and the project's " +
      '[LICENSE.md](https://github.com/jesusmgg/comic-shanns-mono/blob/5a13931471e3a5546adcf5dd772946aa34602e79/LICENSE.md) ' +
      "say. Excalidraw's source reproduces the font's fields in " +
      `[fonts/ComicShanns/index.ts](${EXCALIDRAW_BLOB}/packages/excalidraw/fonts/ComicShanns/index.ts).`,
    copyright: [
      {
        from: "the font's copyright field",
        lines: [
          'Copyright (c) 2018 Shannon Miwa',
          'Copyright (c) 2023 Jesus Gonzalez',
          'Copyright (c) 2023 Rodrigo Batista de Moraes',
          'Copyright (c) 2024 Fini Jastrow',
          'Copyright (c) 2024 Kyle Beechly',
        ],
      },
    ],
  },
  {
    family: 'Cascadia',
    name: 'Cascadia Code',
    kind: 'OFL',
    about:
      "Microsoft's monospaced font, version 2005.150 (the font's version field). The font's own licence field starts " +
      "with Microsoft's general notice for the fonts it supplies, then gives a licence based on the SIL Open Font " +
      "License and points to the project's LICENSE for its terms.",
    licence:
      'SIL Open Font License 1.1, as the [LICENSE](https://github.com/microsoft/cascadia-code/blob/v2005.15/LICENSE) ' +
      'of that release, v2005.15, says.',
    copyright: [
      {
        from: 'LICENSE',
        lines: ['Copyright (c) 2019 - Present, Microsoft Corporation, with Reserved Font Name Cascadia Code.'],
      },
      { from: "the font's copyright field", lines: ['© 2020 Microsoft Corporation. All Rights Reserved.'] },
    ],
  },
  // Not shipped: esbuild.config.mjs leaves it to the system (LEFT_TO_THE_SYSTEM). The entry stays, checked, for the day
  // it is embedded again.
  {
    family: 'Liberation',
    name: 'Liberation Sans',
    kind: 'Liberation',
    about:
      "Version 1.05 (the font's version field), from Liberation Fonts 1.x, which Steve Matteson designed at Ascender " +
      'Corporation for Red Hat. Liberation Fonts 2.0 and later are under the SIL Open Font License, but 1.x is not.',
    licence:
      "GNU General Public License version 2 with the exceptions in Red Hat's licence agreement, as License.txt and " +
      'COPYING in the ' +
      '[liberation-fonts 1.05 release](https://github.com/liberationfonts/liberation-fonts/blob/29a6b7d3e06db1539af34f5cee9a2d688c98e641/releases/liberation-fonts-1.05.tar.gz) ' +
      "say. They are the same in the project's " +
      '[repository](https://github.com/liberationfonts/liberation-fonts/tree/99a390676af7be27fcb477c6636dd5106290dda4/trunk) ' +
      "on 12 January 2009, the date in the font's unique ID.",
    copyright: [
      {
        from: "the release's LiberationSans-Regular.sfd (the font's copyright field has a backtick in place of the ©)",
        lines: ['Digitized data © 2007 Ascender Corporation. All rights reserved.'],
      },
      {
        from: 'License.txt',
        lines: ['Copyright © 2007 Red Hat, Inc. All rights reserved. LIBERATION is a trademark of Red Hat, Inc.'],
      },
    ],
  },
  {
    family: 'Assistant',
    name: 'Assistant',
    kind: 'OFL',
    about:
      "Excalidraw's interface font, version 3.000, with Hebrew by Ben Nathan and Latin by Paul Hunt (the font's " +
      'designer field).',
    licence:
      'SIL Open Font License 1.1, as its ' +
      '[OFL.txt](https://github.com/google/fonts/blob/5bb28733cec313b63fbd415b574b5ae35c8aa8b8/ofl/assistant/OFL.txt) ' +
      "in Google Fonts' repository says.",
    copyright: [
      {
        from: "OFL.txt and the font's copyright field",
        lines: [
          'Copyright 2020 The Assistant Project Authors (https://github.com/hafontia/Assistant).',
          'Copyright 2010 The Source Sans Pro Authors (https://github.com/adobe-fonts/source-sans-pro), with Reserved ' +
            "Font Name 'Source'.",
          'Source is a trademark of Adobe Systems Incorporated in the United States and/or other countries.',
        ],
      },
    ],
  },
];

/** The fonts' licence texts, each printed once after the fonts, if a font that uses it is shipped. */
const FONT_LICENCES = {
  OFL: {
    heading: 'SIL Open Font License 1.1',
    about:
      "As in Nunito's " +
      '[OFL.txt](https://github.com/googlefonts/nunito/blob/8c6a9bb9732545b9ed53f29ec5e1ab0ff53c4e6f/OFL.txt). The ' +
      'licence files linked above for the other fonts under this licence, and the licence field of the full ' +
      'Excalifont, have the same wording.',
    texts: ['ofl'],
  },
  MIT: {
    heading: 'MIT License: Comic Shanns',
    about:
      "Comic Shanns's licence, from the project's " +
      '[LICENSE.md](https://github.com/jesusmgg/comic-shanns-mono/blob/5a13931471e3a5546adcf5dd772946aa34602e79/LICENSE.md), ' +
      'without its copyright lines, which are listed above.',
    texts: ['comicShanns'],
    withoutCopyright: true,
  },
  Liberation: {
    heading: "Liberation Sans: Red Hat's licence agreement and the GNU General Public License version 2",
    about:
      "License.txt and COPYING, from the liberation-fonts 1.05 release. License.txt's last line has its © " +
      'double-encoded there, which is undone here.',
    texts: ['liberation', 'gpl2'],
  },
};

/** Packages published without a licence file, at the versions named, and where their licence comes from instead. */
const WITHOUT_LICENCE_FILE = [
  {
    packages: ['@excalidraw/excalidraw@0.18.1'],
    about: `\`@excalidraw/excalidraw\`: its [LICENSE at v0.18.1](${EXCALIDRAW_BLOB}/LICENSE).`,
    mit: ['Copyright (c) 2020 Excalidraw'],
  },
  {
    packages: [
      'primitive@1.0.0',
      'primitive@1.1.1',
      'react-arrow@1.1.2',
      'react-collection@1.0.1',
      'react-compose-refs@1.0.0',
      'react-compose-refs@1.1.1',
      'react-context@1.0.0',
      'react-context@1.1.1',
      'react-direction@1.0.0',
      'react-dismissable-layer@1.1.5',
      'react-focus-guards@1.1.1',
      'react-focus-scope@1.1.2',
      'react-id@1.0.0',
      'react-id@1.1.0',
      'react-popover@1.1.6',
      'react-popper@1.2.2',
      'react-portal@1.1.4',
      'react-presence@1.0.0',
      'react-presence@1.1.2',
      'react-primitive@1.0.1',
      'react-primitive@2.0.2',
      'react-roving-focus@1.0.2',
      'react-slot@1.0.1',
      'react-slot@1.1.2',
      'react-tabs@1.0.2',
      'react-use-callback-ref@1.0.0',
      'react-use-callback-ref@1.1.0',
      'react-use-controllable-state@1.0.0',
      'react-use-controllable-state@1.1.0',
      'react-use-escape-keydown@1.1.0',
      'react-use-layout-effect@1.0.0',
      'react-use-layout-effect@1.1.0',
      'react-use-size@1.1.0',
    ].map((pkg) => `@radix-ui/${pkg}`),
    about:
      'the `@radix-ui` packages: the ' +
      '[LICENSE](https://github.com/radix-ui/primitives/blob/ee4e3197bffe7dde669d6bbf8c30fef97b65e49d/LICENSE) of ' +
      'radix-ui/primitives, unchanged since June 2022, before the oldest of these versions was published (July 2022).',
    mit: ['Copyright (c) 2022 WorkOS'],
  },
  {
    packages: ['react-remove-scroll-bar@2.3.8'],
    about:
      '`react-remove-scroll-bar`: the ' +
      '[LICENSE](https://github.com/theKashey/react-remove-scroll-bar/blob/7301c160fda44cb8cf2b9fdfde61efad35736196/LICENSE) ' +
      'its repository added in May 2025, after 2.3.8 was published (its package.json says MIT).',
    mit: ['Copyright (c) 2025 Anton Korzunov <thekashey@gmail.com>'],
  },
];

/**
 * Other projects' code inside the builds of the packages in `in`, which were checked at these versions. An entry's
 * licence text is TEXTS[text], or, where the upstream file is the MIT License apart from its title and line breaks, the
 * MIT License with the copyright lines in `mit`.
 */
const INSIDE_BUILDS = [
  {
    in: ['@excalidraw/excalidraw@0.18.1'],
    // Only while main.js holds Excalidraw's font subsetting, which esbuild.config.mjs replaces (replaceSubsetting).
    bundles: /node_modules\/@excalidraw\/excalidraw\/dist\/prod\/chunk-EIO257PC\.js$/,
    about:
      '`@excalidraw/excalidraw` 0.18.1 includes the WebAssembly modules it subsets fonts with, and their bindings ' +
      `([scripts/buildWasm.js](${EXCALIDRAW_BLOB}/scripts/buildWasm.js), ` +
      `[packages/excalidraw/subset](${EXCALIDRAW_TREE}/packages/excalidraw/subset)). The modules are byte for byte ` +
      "those of the harfbuzzjs 0.3.6 and fonteditor-core 2.4.0 npm packages: HarfBuzz's subsetter, with bindings " +
      "adapted from subset-font, and Google's WOFF2 and Brotli, with fonteditor-core's bindings, which it adapted " +
      "from woff2-wasm. fonteditor-core doesn't record which WOFF2 and Brotli commits it built, in 2019 and 2020; " +
      'both were MIT-licensed by then, and their licences are linked at recent commits.',
    entries: [
      {
        name: 'harfbuzzjs',
        version: '0.3.6',
        label: 'harfbuzzjs 0.3.6',
        url: 'https://github.com/harfbuzz/harfbuzzjs/blob/v0.3.6/LICENSE',
        license: 'MIT',
        text: 'harfbuzzjs',
      },
      {
        name: 'HarfBuzz',
        label: 'HarfBuzz at e079dd2, the commit harfbuzzjs 0.3.6 builds',
        url: 'https://github.com/harfbuzz/harfbuzz/blob/e079dd20304bacd8d753eee2ceacbaa1a3978a34/COPYING',
        license: 'Old MIT',
        text: 'harfbuzz',
      },
      {
        name: 'subset-font',
        label: 'subset-font at 3f711c8',
        url: 'https://github.com/papandreou/subset-font/blob/3f711c8aa29a426c7f22655861abfb976950f527/LICENSE',
        license: 'BSD-3-Clause',
        text: 'subsetFont',
      },
      {
        name: 'fonteditor-core',
        version: '2.4.0',
        label: 'fonteditor-core 2.4.0',
        url: 'https://github.com/kekee000/fonteditor-core/blob/v2.4.0/LICENSE',
        license: 'MIT',
        mit: ['Copyright (c) 2014 ecomfe'],
      },
      {
        name: 'WOFF2',
        label: 'WOFF2',
        url: 'https://github.com/google/woff2/blob/7b67e12355fe7da148db5c19d4261f0a498a9537/LICENSE',
        license: 'MIT',
        mit: ['Copyright (c) 2013-2017 by the WOFF2 Authors.'],
      },
      {
        name: 'Brotli',
        label: 'Brotli',
        url: 'https://github.com/google/brotli/blob/d89c4b1c52e25ddafe047bc78bbee5c1e24b1809/LICENSE',
        license: 'MIT',
        mit: ['Copyright (c) 2009, 2010, 2013-2016 by the Brotli Authors.'],
      },
      {
        name: 'woff2-wasm',
        label: 'woff2-wasm',
        url: 'https://github.com/alimilhim/woff2-wasm/blob/78c679a73d6cb40056896842121297948aaec8b8/LICENSE',
        license: 'MIT',
        mit: ['Copyright (c) 2019 Ali Milhim'],
      },
    ],
  },
  {
    in: ['@excalidraw/excalidraw@0.18.1'],
    about:
      "`@excalidraw/excalidraw` 0.18.1's icons come from Font Awesome, Tabler Icons and, for one, Storybook " +
      `([components/icons.tsx](${EXCALIDRAW_BLOB}/packages/excalidraw/components/icons.tsx)). Excalidraw doesn't ` +
      "record their versions, so the licences are linked on Font Awesome's 5.x branch, at a recent commit of Tabler " +
      "Icons, and as Storybook's was when Excalidraw added that icon, in February 2020. Comments in its source also " +
      'credit a few short functions to lodash, clipboard.js, klona, Modernizr, p-try, Radix UI and the TC39 proposal ' +
      'for `Array.prototype.at`, all MIT-licensed; those are not listed below.',
    entries: [
      {
        name: 'Font Awesome Free',
        label: 'Font Awesome Free',
        url: 'https://github.com/FortAwesome/Font-Awesome/blob/afecf2af5d897b763e5e8e28d46aad2f710ccad6/LICENSE.txt',
        license: 'CC-BY-4.0',
        text: 'fontAwesome',
      },
      {
        name: 'Tabler Icons',
        label: 'Tabler Icons',
        url: 'https://github.com/tabler/tabler-icons/blob/58f60538fe2fab2e1459a09198f9bd3b033bf90e/LICENSE',
        license: 'MIT',
        mit: ['Copyright (c) 2020-2026 Paweł Kuna'],
      },
      {
        name: 'Storybook',
        label: 'Storybook, February 2020',
        url: 'https://github.com/storybookjs/storybook/blob/5fda73c07088ea72cf3b21c42475864aa06620fc/LICENSE',
        license: 'MIT',
        text: 'storybook',
      },
    ],
  },
  {
    in: ['pica@7.1.1', 'image-blob-reduce@3.0.1'],
    about:
      '`pica` 7.1.1 (`dist/pica.js`) includes glur, inherits, multimath, object-assign and webworkify, and ' +
      '`image-blob-reduce` 3.0.1 includes pica 7.1.0 with the same five. Their versions are the newest that the ' +
      "dependency ranges allowed when each build was published, and their licences those of these versions' npm " +
      'packages.',
    entries: [
      {
        name: 'glur',
        version: '1.1.2',
        label: 'glur 1.1.2',
        url: 'https://www.npmjs.com/package/glur/v/1.1.2',
        license: 'MIT',
        mit: ['Copyright (c) 2014 Andrei Tupitcyn'],
      },
      {
        name: 'inherits',
        version: '2.0.4',
        label: 'inherits 2.0.4',
        url: 'https://www.npmjs.com/package/inherits/v/2.0.4',
        license: 'ISC',
        text: 'inherits',
      },
      {
        name: 'multimath',
        version: '2.0.0',
        label: 'multimath 2.0.0',
        url: 'https://www.npmjs.com/package/multimath/v/2.0.0',
        license: 'MIT',
        mit: ['Copyright (C) 2017 by Vitaly Puzrin'],
      },
      {
        name: 'object-assign',
        version: '4.1.1',
        label: 'object-assign 4.1.1',
        url: 'https://www.npmjs.com/package/object-assign/v/4.1.1',
        license: 'MIT',
        mit: ['Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)'],
      },
      {
        name: 'pica',
        version: '7.1.0',
        label: 'pica 7.1.0',
        url: 'https://www.npmjs.com/package/pica/v/7.1.0',
        in: ['image-blob-reduce@3.0.1'],
        license: 'MIT',
        mit: ['Copyright (C) 2014-2017 by Vitaly Puzrin'],
      },
      {
        name: 'webworkify',
        version: '1.5.0',
        label: 'webworkify 1.5.0',
        url: 'https://www.npmjs.com/package/webworkify/v/1.5.0',
        license: 'MIT',
        text: 'webworkify',
      },
    ],
  },
  {
    in: ['pako@2.0.3'],
    about: "`pako` 2.0.3 is a port of zlib, and its source keeps zlib's notice.",
    entries: [
      {
        name: 'zlib',
        label: 'zlib',
        url: 'https://github.com/nodeca/pako/blob/2.0.3/lib/zlib/deflate.js#L3-L20',
        license: 'Zlib',
        text: 'zlib',
      },
    ],
  },
];

/** The licence texts the entries above name, as taken from the addresses given there, without trailing spaces or form
 *  feeds. */
const TEXTS = {
  mit: `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
  ofl: `-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.`,
  comicShanns: `MIT License

Copyright (c) 2018 Shannon Miwa
Copyright (c) 2023 Jesus Gonzalez

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
  liberation: `LICENSE AGREEMENT AND LIMITED PRODUCT WARRANTY
LIBERATION FONT SOFTWARE

This agreement governs the use of the Software and any updates to the Software, regardless of the delivery mechanism. Subject to the following terms, Red Hat, Inc. ("Red Hat") grants to the user ("Client") a license to this work pursuant to the GNU General Public License v.2 with the exceptions set forth below and such other terms as are set forth in this End User License Agreement.

 1. The Software and License Exception. LIBERATION font software  (the "Software") consists of TrueType-OpenType formatted font software for rendering LIBERATION typefaces in sans-serif, serif, and monospaced character styles. You are licensed to use, modify, copy, and distribute the Software pursuant to the GNU General Public License v.2 with the following exceptions:

  (a) As a special exception, if you create a document which uses this font, and embed this font or unaltered portions of this font into the document, this font does not by itself cause the resulting document to be covered by the GNU General Public License. This exception does not however invalidate any other reasons why the document might be covered by the GNU General Public License. If you modify this font, you may extend this exception to your version of the font, but you are not obligated to do so. If you do not wish to do so, delete this exception statement from your version.

  (b) As a further exception, any distribution of the object code of the Software in a physical product must provide you the right to access and modify the source code for the Software and to reinstall that modified version of the Software in object code form on the same physical product on which you received it.

 2. Intellectual Property Rights. The Software and each of its components, including the source code, documentation, appearance, structure and organization are owned by Red Hat and others and are protected under copyright and other laws. Title to the Software and any component, or to any copy, modification, or merged portion shall remain with the aforementioned, subject to the applicable license. The "LIBERATION" trademark is a trademark of Red Hat, Inc. in the U.S. and other countries. This agreement does not permit Client to distribute modified versions of the Software using Red Hat's trademarks. If Client makes a redistribution of a modified version of the Software, then Client must modify the files names to remove any reference to the Red Hat trademarks and must not use the Red Hat trademarks in any way to reference or promote the modified Software.

 3. Limited Warranty. To the maximum extent permitted under applicable law, the Software is provided and licensed "as is" without warranty of any kind, expressed or implied, including the implied warranties of merchantability, non-infringement or fitness for a particular purpose. Red Hat does not warrant that the functions contained in the Software will meet Client's requirements or that the operation of the Software will be entirely error free or appear precisely as described in the accompanying documentation.

 4. Limitation of Remedies and Liability. To the maximum extent permitted by applicable law, Red Hat or any Red Hat authorized dealer will not be liable to Client for any incidental or consequential damages, including lost profits or lost savings arising out of the use or inability to use the Software, even if Red Hat or such dealer has been advised of the possibility of such damages.

 5. General. If any provision of this agreement is held to be unenforceable, that shall not affect the enforceability of the remaining provisions. This agreement shall be governed by the laws of the State of North Carolina and of the United States, without regard to any conflict of laws provisions, except that the United Nations Convention on the International Sale of Goods shall not apply.
Copyright © 2007 Red Hat, Inc. All rights reserved. LIBERATION is a trademark of Red Hat, Inc.`,
  gpl2: `		    GNU GENERAL PUBLIC LICENSE
		       Version 2, June 1991

 Copyright (C) 1989, 1991 Free Software Foundation, Inc.
     59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 Everyone is permitted to copy and distribute verbatim copies
 of this license document, but changing it is not allowed.

			    Preamble

  The licenses for most software are designed to take away your
freedom to share and change it.  By contrast, the GNU General Public
License is intended to guarantee your freedom to share and change free
software--to make sure the software is free for all its users.  This
General Public License applies to most of the Free Software
Foundation's software and to any other program whose authors commit to
using it.  (Some other Free Software Foundation software is covered by
the GNU Library General Public License instead.)  You can apply it to
your programs, too.

  When we speak of free software, we are referring to freedom, not
price.  Our General Public Licenses are designed to make sure that you
have the freedom to distribute copies of free software (and charge for
this service if you wish), that you receive source code or can get it
if you want it, that you can change the software or use pieces of it
in new free programs; and that you know you can do these things.

  To protect your rights, we need to make restrictions that forbid
anyone to deny you these rights or to ask you to surrender the rights.
These restrictions translate to certain responsibilities for you if you
distribute copies of the software, or if you modify it.

  For example, if you distribute copies of such a program, whether
gratis or for a fee, you must give the recipients all the rights that
you have.  You must make sure that they, too, receive or can get the
source code.  And you must show them these terms so they know their
rights.

  We protect your rights with two steps: (1) copyright the software, and
(2) offer you this license which gives you legal permission to copy,
distribute and/or modify the software.

  Also, for each author's protection and ours, we want to make certain
that everyone understands that there is no warranty for this free
software.  If the software is modified by someone else and passed on, we
want its recipients to know that what they have is not the original, so
that any problems introduced by others will not reflect on the original
authors' reputations.

  Finally, any free program is threatened constantly by software
patents.  We wish to avoid the danger that redistributors of a free
program will individually obtain patent licenses, in effect making the
program proprietary.  To prevent this, we have made it clear that any
patent must be licensed for everyone's free use or not licensed at all.

  The precise terms and conditions for copying, distribution and
modification follow.

		    GNU GENERAL PUBLIC LICENSE
   TERMS AND CONDITIONS FOR COPYING, DISTRIBUTION AND MODIFICATION

  0. This License applies to any program or other work which contains
a notice placed by the copyright holder saying it may be distributed
under the terms of this General Public License.  The "Program", below,
refers to any such program or work, and a "work based on the Program"
means either the Program or any derivative work under copyright law:
that is to say, a work containing the Program or a portion of it,
either verbatim or with modifications and/or translated into another
language.  (Hereinafter, translation is included without limitation in
the term "modification".)  Each licensee is addressed as "you".

Activities other than copying, distribution and modification are not
covered by this License; they are outside its scope.  The act of
running the Program is not restricted, and the output from the Program
is covered only if its contents constitute a work based on the
Program (independent of having been made by running the Program).
Whether that is true depends on what the Program does.

  1. You may copy and distribute verbatim copies of the Program's
source code as you receive it, in any medium, provided that you
conspicuously and appropriately publish on each copy an appropriate
copyright notice and disclaimer of warranty; keep intact all the
notices that refer to this License and to the absence of any warranty;
and give any other recipients of the Program a copy of this License
along with the Program.

You may charge a fee for the physical act of transferring a copy, and
you may at your option offer warranty protection in exchange for a fee.

  2. You may modify your copy or copies of the Program or any portion
of it, thus forming a work based on the Program, and copy and
distribute such modifications or work under the terms of Section 1
above, provided that you also meet all of these conditions:

    a) You must cause the modified files to carry prominent notices
    stating that you changed the files and the date of any change.

    b) You must cause any work that you distribute or publish, that in
    whole or in part contains or is derived from the Program or any
    part thereof, to be licensed as a whole at no charge to all third
    parties under the terms of this License.

    c) If the modified program normally reads commands interactively
    when run, you must cause it, when started running for such
    interactive use in the most ordinary way, to print or display an
    announcement including an appropriate copyright notice and a
    notice that there is no warranty (or else, saying that you provide
    a warranty) and that users may redistribute the program under
    these conditions, and telling the user how to view a copy of this
    License.  (Exception: if the Program itself is interactive but
    does not normally print such an announcement, your work based on
    the Program is not required to print an announcement.)

These requirements apply to the modified work as a whole.  If
identifiable sections of that work are not derived from the Program,
and can be reasonably considered independent and separate works in
themselves, then this License, and its terms, do not apply to those
sections when you distribute them as separate works.  But when you
distribute the same sections as part of a whole which is a work based
on the Program, the distribution of the whole must be on the terms of
this License, whose permissions for other licensees extend to the
entire whole, and thus to each and every part regardless of who wrote it.

Thus, it is not the intent of this section to claim rights or contest
your rights to work written entirely by you; rather, the intent is to
exercise the right to control the distribution of derivative or
collective works based on the Program.

In addition, mere aggregation of another work not based on the Program
with the Program (or with a work based on the Program) on a volume of
a storage or distribution medium does not bring the other work under
the scope of this License.

  3. You may copy and distribute the Program (or a work based on it,
under Section 2) in object code or executable form under the terms of
Sections 1 and 2 above provided that you also do one of the following:

    a) Accompany it with the complete corresponding machine-readable
    source code, which must be distributed under the terms of Sections
    1 and 2 above on a medium customarily used for software interchange; or,

    b) Accompany it with a written offer, valid for at least three
    years, to give any third party, for a charge no more than your
    cost of physically performing source distribution, a complete
    machine-readable copy of the corresponding source code, to be
    distributed under the terms of Sections 1 and 2 above on a medium
    customarily used for software interchange; or,

    c) Accompany it with the information you received as to the offer
    to distribute corresponding source code.  (This alternative is
    allowed only for noncommercial distribution and only if you
    received the program in object code or executable form with such
    an offer, in accord with Subsection b above.)

The source code for a work means the preferred form of the work for
making modifications to it.  For an executable work, complete source
code means all the source code for all modules it contains, plus any
associated interface definition files, plus the scripts used to
control compilation and installation of the executable.  However, as a
special exception, the source code distributed need not include
anything that is normally distributed (in either source or binary
form) with the major components (compiler, kernel, and so on) of the
operating system on which the executable runs, unless that component
itself accompanies the executable.

If distribution of executable or object code is made by offering
access to copy from a designated place, then offering equivalent
access to copy the source code from the same place counts as
distribution of the source code, even though third parties are not
compelled to copy the source along with the object code.

  4. You may not copy, modify, sublicense, or distribute the Program
except as expressly provided under this License.  Any attempt
otherwise to copy, modify, sublicense or distribute the Program is
void, and will automatically terminate your rights under this License.
However, parties who have received copies, or rights, from you under
this License will not have their licenses terminated so long as such
parties remain in full compliance.

  5. You are not required to accept this License, since you have not
signed it.  However, nothing else grants you permission to modify or
distribute the Program or its derivative works.  These actions are
prohibited by law if you do not accept this License.  Therefore, by
modifying or distributing the Program (or any work based on the
Program), you indicate your acceptance of this License to do so, and
all its terms and conditions for copying, distributing or modifying
the Program or works based on it.

  6. Each time you redistribute the Program (or any work based on the
Program), the recipient automatically receives a license from the
original licensor to copy, distribute or modify the Program subject to
these terms and conditions.  You may not impose any further
restrictions on the recipients' exercise of the rights granted herein.
You are not responsible for enforcing compliance by third parties to
this License.

  7. If, as a consequence of a court judgment or allegation of patent
infringement or for any other reason (not limited to patent issues),
conditions are imposed on you (whether by court order, agreement or
otherwise) that contradict the conditions of this License, they do not
excuse you from the conditions of this License.  If you cannot
distribute so as to satisfy simultaneously your obligations under this
License and any other pertinent obligations, then as a consequence you
may not distribute the Program at all.  For example, if a patent
license would not permit royalty-free redistribution of the Program by
all those who receive copies directly or indirectly through you, then
the only way you could satisfy both it and this License would be to
refrain entirely from distribution of the Program.

If any portion of this section is held invalid or unenforceable under
any particular circumstance, the balance of the section is intended to
apply and the section as a whole is intended to apply in other
circumstances.

It is not the purpose of this section to induce you to infringe any
patents or other property right claims or to contest validity of any
such claims; this section has the sole purpose of protecting the
integrity of the free software distribution system, which is
implemented by public license practices.  Many people have made
generous contributions to the wide range of software distributed
through that system in reliance on consistent application of that
system; it is up to the author/donor to decide if he or she is willing
to distribute software through any other system and a licensee cannot
impose that choice.

This section is intended to make thoroughly clear what is believed to
be a consequence of the rest of this License.

  8. If the distribution and/or use of the Program is restricted in
certain countries either by patents or by copyrighted interfaces, the
original copyright holder who places the Program under this License
may add an explicit geographical distribution limitation excluding
those countries, so that distribution is permitted only in or among
countries not thus excluded.  In such case, this License incorporates
the limitation as if written in the body of this License.

  9. The Free Software Foundation may publish revised and/or new versions
of the General Public License from time to time.  Such new versions will
be similar in spirit to the present version, but may differ in detail to
address new problems or concerns.

Each version is given a distinguishing version number.  If the Program
specifies a version number of this License which applies to it and "any
later version", you have the option of following the terms and conditions
either of that version or of any later version published by the Free
Software Foundation.  If the Program does not specify a version number of
this License, you may choose any version ever published by the Free Software
Foundation.

  10. If you wish to incorporate parts of the Program into other free
programs whose distribution conditions are different, write to the author
to ask for permission.  For software which is copyrighted by the Free
Software Foundation, write to the Free Software Foundation; we sometimes
make exceptions for this.  Our decision will be guided by the two goals
of preserving the free status of all derivatives of our free software and
of promoting the sharing and reuse of software generally.

			    NO WARRANTY

  11. BECAUSE THE PROGRAM IS LICENSED FREE OF CHARGE, THERE IS NO WARRANTY
FOR THE PROGRAM, TO THE EXTENT PERMITTED BY APPLICABLE LAW.  EXCEPT WHEN
OTHERWISE STATED IN WRITING THE COPYRIGHT HOLDERS AND/OR OTHER PARTIES
PROVIDE THE PROGRAM "AS IS" WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESSED
OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.  THE ENTIRE RISK AS
TO THE QUALITY AND PERFORMANCE OF THE PROGRAM IS WITH YOU.  SHOULD THE
PROGRAM PROVE DEFECTIVE, YOU ASSUME THE COST OF ALL NECESSARY SERVICING,
REPAIR OR CORRECTION.

  12. IN NO EVENT UNLESS REQUIRED BY APPLICABLE LAW OR AGREED TO IN WRITING
WILL ANY COPYRIGHT HOLDER, OR ANY OTHER PARTY WHO MAY MODIFY AND/OR
REDISTRIBUTE THE PROGRAM AS PERMITTED ABOVE, BE LIABLE TO YOU FOR DAMAGES,
INCLUDING ANY GENERAL, SPECIAL, INCIDENTAL OR CONSEQUENTIAL DAMAGES ARISING
OUT OF THE USE OR INABILITY TO USE THE PROGRAM (INCLUDING BUT NOT LIMITED
TO LOSS OF DATA OR DATA BEING RENDERED INACCURATE OR LOSSES SUSTAINED BY
YOU OR THIRD PARTIES OR A FAILURE OF THE PROGRAM TO OPERATE WITH ANY OTHER
PROGRAMS), EVEN IF SUCH HOLDER OR OTHER PARTY HAS BEEN ADVISED OF THE
POSSIBILITY OF SUCH DAMAGES.

		     END OF TERMS AND CONDITIONS

	    How to Apply These Terms to Your New Programs

  If you develop a new program, and you want it to be of the greatest
possible use to the public, the best way to achieve this is to make it
free software which everyone can redistribute and change under these terms.

  To do so, attach the following notices to the program.  It is safest
to attach them to the start of each source file to most effectively
convey the exclusion of warranty; and each file should have at least
the "copyright" line and a pointer to where the full notice is found.

    <one line to give the program's name and a brief idea of what it does.>
    Copyright (C) <year>  <name of author>

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program; if not, write to the Free Software
    Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA


Also add information on how to contact you by electronic and paper mail.

If the program is interactive, make it output a short notice like this
when it starts in an interactive mode:

    Gnomovision version 69, Copyright (C) year  name of author
    Gnomovision comes with ABSOLUTELY NO WARRANTY; for details type \`show w'.
    This is free software, and you are welcome to redistribute it
    under certain conditions; type \`show c' for details.

The hypothetical commands \`show w' and \`show c' should show the appropriate
parts of the General Public License.  Of course, the commands you use may
be called something other than \`show w' and \`show c'; they could even be
mouse-clicks or menu items--whatever suits your program.

You should also get your employer (if you work as a programmer) or your
school, if any, to sign a "copyright disclaimer" for the program, if
necessary.  Here is a sample; alter the names:

  Yoyodyne, Inc., hereby disclaims all copyright interest in the program
  \`Gnomovision' (which makes passes at compilers) written by James Hacker.

  <signature of Ty Coon>, 1 April 1989
  Ty Coon, President of Vice

This General Public License does not permit incorporating your program into
proprietary programs.  If your program is a subroutine library, you may
consider it more useful to permit linking proprietary applications with the
library.  If this is what you want to do, use the GNU Library General
Public License instead of this License.`,
  harfbuzzjs: `Apache license for Zephyr libc implementations (zephyr-string.c),
emmalloc.cpp (from emscripten project) and MIT for rest of the project

Copyright (c) 2019 Ebrahim Byagowi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
  harfbuzz: `HarfBuzz is licensed under the so-called "Old MIT" license.  Details follow.
For parts of HarfBuzz that are licensed under different licenses see individual
files names COPYING in subdirectories where applicable.

Copyright © 2010-2022  Google, Inc.
Copyright © 2015-2020  Ebrahim Byagowi
Copyright © 2019,2020  Facebook, Inc.
Copyright © 2012,2015  Mozilla Foundation
Copyright © 2011  Codethink Limited
Copyright © 2008,2010  Nokia Corporation and/or its subsidiary(-ies)
Copyright © 2009  Keith Stribley
Copyright © 2011  Martin Hosken and SIL International
Copyright © 2007  Chris Wilson
Copyright © 2005,2006,2020,2021,2022,2023  Behdad Esfahbod
Copyright © 2004,2007,2008,2009,2010,2013,2021,2022,2023  Red Hat, Inc.
Copyright © 1998-2005  David Turner and Werner Lemberg
Copyright © 2016  Igalia S.L.
Copyright © 2022  Matthias Clasen
Copyright © 2018,2021  Khaled Hosny
Copyright © 2018,2019,2020  Adobe, Inc
Copyright © 2013-2015  Alexei Podtelezhnikov

For full copyright notices consult the individual files in the package.


Permission is hereby granted, without written agreement and without
license or royalty fees, to use, copy, modify, and distribute this
software and its documentation for any purpose, provided that the
above copyright notice and the following two paragraphs appear in
all copies of this software.

IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE TO ANY PARTY FOR
DIRECT, INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES
ARISING OUT OF THE USE OF THIS SOFTWARE AND ITS DOCUMENTATION, EVEN
IF THE COPYRIGHT HOLDER HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH
DAMAGE.

THE COPYRIGHT HOLDER SPECIFICALLY DISCLAIMS ANY WARRANTIES, INCLUDING,
BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS FOR A PARTICULAR PURPOSE.  THE SOFTWARE PROVIDED HEREUNDER IS
ON AN "AS IS" BASIS, AND THE COPYRIGHT HOLDER HAS NO OBLIGATION TO
PROVIDE MAINTENANCE, SUPPORT, UPDATES, ENHANCEMENTS, OR MODIFICATIONS.`,
  subsetFont: `Copyright (c) 2012, Andreas Lind Petersen
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

  * Redistributions of source code must retain the above copyright
    notice, this list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright
    notice, this list of conditions and the following disclaimer in
    the documentation and/or other materials provided with the
    distribution.
  * Neither the name of the author nor the names of contributors may
    be used to endorse or promote products derived from this
    software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`,
  fontAwesome: `Font Awesome Free License
-------------------------

Font Awesome Free is free, open source, and GPL friendly. You can use it for
commercial projects, open source projects, or really almost whatever you want.
Full Font Awesome Free license: https://fontawesome.com/license/free.

# Icons: CC BY 4.0 License (https://creativecommons.org/licenses/by/4.0/)
In the Font Awesome Free download, the CC BY 4.0 license applies to all icons
packaged as SVG and JS file types.

# Fonts: SIL OFL 1.1 License (https://scripts.sil.org/OFL)
In the Font Awesome Free download, the SIL OFL license applies to all icons
packaged as web and desktop font files.

# Code: MIT License (https://opensource.org/licenses/MIT)
In the Font Awesome Free download, the MIT license applies to all non-font and
non-icon files.

# Attribution
Attribution is required by MIT, SIL OFL, and CC BY licenses. Downloaded Font
Awesome Free files already contain embedded comments with sufficient
attribution, so you shouldn't need to do anything additional when using these
files normally.

We've kept attribution comments terse, so we ask that you do not actively work
to remove them from files, especially code. They're a great way for folks to
learn about Font Awesome.

# Brand Icons
All brand icons are trademarks of their respective owners. The use of these
trademarks does not indicate endorsement of the trademark holder by Font
Awesome, nor vice versa. **Please do not use brand logos for any purpose except
to represent the company, product, or service to which they refer.**`,
  storybook: `The MIT License (MIT)

Copyright (c) 2017 Kadira Inc. <hello@kadira.io>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.`,
  inherits: `The ISC License

Copyright (c) Isaac Z. Schlueter

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.`,
  webworkify: `This software is released under the MIT license:

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`,
  zlib: `(C) 1995-2013 Jean-loup Gailly and Mark Adler
(C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin

This software is provided 'as-is', without any express or implied
warranty. In no event will the authors be held liable for any damages
arising from the use of this software.

Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter it and redistribute it
freely, subject to the following restrictions:

1. The origin of this software must not be misrepresented; you must not
  claim that you wrote the original software. If you use this software
  in a product, an acknowledgment in the product documentation would be
  appreciated but is not required.
2. Altered source versions must be plainly marked as such, and must not be
  misrepresented as being the original software.
3. This notice may not be removed or altered from any source distribution.`,
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
