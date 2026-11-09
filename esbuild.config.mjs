// The plugin as Obsidian installs it: main.js (one CommonJS file; `obsidian` is provided by the app) and styles.css,
// at the repository root next to manifest.json. Those three files are all Obsidian's community installer downloads.
// - LAZY: src/main.ts loads the editor (React and Excalidraw) with import(), which esbuild bundles into main.js as
//   code that runs only when the first drawing opens; Obsidian's startup parses it but doesn't evaluate it.
// - FONTS: Excalidraw's fonts are embedded (see embedFonts), so the editor never goes online.
// - NO-NETWORK: the places where Excalidraw goes online by itself are made to stay offline (see NETWORK_PATCHES).
// - NOTICES: main.js ends with Excaliboard's licence and THIRD-PARTY-NOTICES.md, because Obsidian installs no other
//   file with it (`npm run notices` rewrites that file from what this build bundles).
// - Our own code isn't minified, so the code a vault runs stays readable; the libraries ship as they are published.
// `npm run dev` rebuilds on every change; set TEST_VAULT=/path/to/vault to build into its plugin folder instead.
import esbuild from 'esbuild';
import { readFileSync } from 'node:fs';
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const repository = JSON.parse(readFileSync('package.json', 'utf8')).repository.url.replace(/^git\+|\.git$/g, '');
/** Text as one JavaScript block comment, whatever it holds. */
const comment = (text) => `/*\n${text.trim().replaceAll('*/', '*\\/')}\n*/`;
const watch = process.argv.includes('--watch');
const outdir = process.env.TEST_VAULT ? path.join(process.env.TEST_VAULT, '.obsidian/plugins', manifest.id) : '.';

/**
 * Excalidraw's build refers to each font by a relative path ("./fonts/<Family>/<file>.woff2") and fetches it from
 * window.EXCALIDRAW_ASSET_PATH or, failing that, from a CDN. Here the fonts of its font picker (about 280 KB, 375 KB as
 * data URLs) become data: URLs, which Excalidraw uses as they are, with no fallback.
 * The families in LEFT_TO_THE_SYSTEM are left out, so text in them is drawn in a system font: Xiaolai, the 12 MB CJK
 * hand-drawn font (16 MB as data URLs), and Liberation Sans, which Excalidraw keeps for exports made on its servers and
 * doesn't offer in its picker (its version 1.05 is under the GPL, unlike the other fonts). Their paths become "local:",
 * and their metadata gets `local: true`, as Excalidraw marks its emoji font: otherwise it registers each as a font face
 * that fails to load, and then can't measure text in that family when its font changes.
 * scripts/third-party-notices.mjs repeats this rule: change both.
 */
const FONT_PATH = /"\.\/fonts\/([A-Za-z]+)\/([\w.-]+\.woff2)"/g;
/** Each family's folder, and the name Excalidraw registers it under. */
const LEFT_TO_THE_SYSTEM = new Map([
  ['Xiaolai', 'Xiaolai'],
  ['Liberation', 'Liberation Sans'],
]);
/** A family's entry in Excalidraw's font metadata, up to its metrics: `[x.Xiaolai]:{metrics:{...},`. */
const fontMetadata = (name) =>
  new RegExp(`\\[[\\w$]+(\\.${name}|\\[${JSON.stringify(name)}\\])\\]:\\{metrics:\\{[^{}]*\\},`, 'g');
const fontCounts = { embedded: 0, local: 0, marked: [] };

/**
 * NO-NETWORK: the places where Excalidraw 0.18.1 goes online by itself, each made to stay offline, wherever its content
 * comes from (a file opened, a paste from any menu, a drop, the library). Each pattern must match exactly once in
 * Excalidraw's build, or the build fails: a newer Excalidraw needs them checked again.
 * - picture: loading a picture from its address. A data URL loads as before; any other address fails, as an unreadable
 *   picture does. (view.ts doesn't count Excalidraw's mark on a picture that failed to load as an edit.)
 * - web page paste: HTML pasted from a web page brings its pictures' addresses, which Excalidraw would download; it
 *   gets none, so the paste goes in as text, from any menu.
 * - pasted picture: downloading such a picture, should one still come.
 * - AI page: showing a web page made by Excalidraw's AI tools ("wireframe to code"), which can load anything from the
 *   internet; a short note is shown in its place, and the drawing keeps the page as it was.
 * - AI error: the message of a failed AI page, which Excalidraw shows as HTML in the same kind of frame; a fixed text
 *   is shown instead.
 * - SVG picture: writing a picture's address into an SVG export, where the browser loads it; only data URLs are written.
 * - frame name: the canvas colour as the CSS `background` of the box for renaming a frame, where a url() would load;
 *   it is set as `background-color`, which can't.
 * - opacity, opacity slider: an element's opacity goes into the slider's CSS background, where text such as a url()
 *   would load; an opacity is read as a number (a numeric string such as "50" too, as Excalidraw draws it), anything
 *   else as the default, and the slider takes numbers only.
 * - library preview, publish preview: the library shows each item as an SVG made from its elements, put into the
 *   page, where a colour or an id can hold a url() that loads; the SVG is shown as an image, which loads nothing.
 * - publish: uploading library items to Excalidraw's library service (its menu item is hidden in styles.css too).
 */
const OFFLINE = 'new Error("Excaliboard does not go online")';
const AI_PAGE =
  '<!doctype html><meta charset="utf-8"><body style="margin:0;height:100vh;display:flex;align-items:center;' +
  'justify-content:center;padding:1em;box-sizing:border-box;font:14px sans-serif;color:#888;text-align:center">' +
  "A web page made by Excalidraw's AI tools. Excaliboard doesn't show it, since it would load content from the internet." +
  '</body>';
const NETWORK_PATCHES = [
  {
    name: 'picture',
    pattern:
      /(\w+)=>new Promise\(\((\w+),(\w+)\)=>\{let (\w+)=new Image;\4\.onload=\(\)=>\{\2\(\4\)\},\4\.onerror=(\w+)=>\{\3\(\5\)\},\4\.src=\1\}\)/g,
    replace: `$1=>new Promise(($2,$3)=>{let $4=new Image;$4.onload=()=>{$2($4)},$4.onerror=$5=>{$3($5)},/^data:/i.test($1)?$4.src=$1:$3(${OFFLINE})})`,
  },
  {
    name: 'web page paste',
    pattern: /(\w+)&&\1\.startsWith\("http"\)&&(\w+)\.push\(\{type:"imageUrl"/g,
    replace: '!1&&$2.push({type:"imageUrl"',
  },
  {
    name: 'pasted picture',
    pattern: /try\{(\w+)=await fetch\(\w+\)\}catch\{throw new Error\("Error: failed to fetch image"/g,
    replace: `try{$1=await Promise.reject(${OFFLINE})}catch{throw new Error("Error: failed to fetch image"`,
  },
  {
    name: 'AI page',
    pattern: /if\((\w+)\.status==="done"\)\{let (\w+)=\1\.html;/g,
    replace: `if($1.status==="done"){let $2=${JSON.stringify(AI_PAGE)};`,
  },
  {
    name: 'AI error',
    pattern: /(\w+)=\w+\.message\|\|"Generation failed"/g,
    replace: '$1="Generation failed"',
  },
  {
    name: 'SVG picture',
    pattern: /(\w+)\.setAttribute\("href",(\w+)\.dataURL\)/g,
    replace: '/^data:/i.test($2.dataURL)&&$1.setAttribute("href",$2.dataURL)',
  },
  {
    name: 'frame name',
    pattern: /style:\{background:this\.state\.viewBackgroundColor,/g,
    replace: 'style:{backgroundColor:this.state.viewBackgroundColor,',
  },
  {
    name: 'opacity',
    pattern: /opacity:(\w+)\.opacity==null\?(\w+)\.opacity:\1\.opacity/g,
    replace: 'opacity:$1.opacity==null||!Number.isFinite(+$1.opacity)?$2.opacity:+$1.opacity',
  },
  {
    name: 'opacity slider',
    pattern:
      /(\w+)\.style\.background=`linear-gradient\(to right, var\(--color-slider-track\) 0%, var\(--color-slider-track\) \$\{(\w+)\}%, var\(--button-bg\) \$\{\2\}%, var\(--button-bg\) 100%\)`/g,
    replace:
      '$1.style.background=`linear-gradient(to right, var(--color-slider-track) 0%, var(--color-slider-track) ${+$2||0}%, var(--button-bg) ${+$2||0}%, var(--button-bg) 100%)`',
  },
  {
    name: 'library preview',
    pattern: /(\w+)\.innerHTML=(\w+)\.outerHTML\),\(\)=>\{\1\.innerHTML=""\}/g,
    replace:
      '$1.replaceChildren(Object.assign(document.createElement("img"),{src:"data:image/svg+xml;charset=utf-8,"+encodeURIComponent($2.outerHTML),draggable:!1}))),()=>{$1.innerHTML=""}',
  },
  {
    name: 'publish preview',
    pattern: /(\w+)\.innerHTML=(\w+)\.outerHTML\}\)\(\)/g,
    replace:
      '$1.replaceChildren(Object.assign(document.createElement("img"),{src:"data:image/svg+xml;charset=utf-8,"+encodeURIComponent($2.outerHTML)}))})()',
  },
  {
    name: 'publish',
    pattern: /fetch\((`\$\{\w+\.VITE_APP_LIBRARY_BACKEND\}\/submit`)/g,
    replace: `((...request)=>Promise.reject(${OFFLINE}))($1`,
  },
];
const networkCounts = new Map();
const embedFonts = {
  name: 'embed-excalidraw-fonts',
  setup(build) {
    build.onLoad({ filter: /[\\/]@excalidraw[\\/]excalidraw[\\/]dist[\\/]prod[\\/][^\\/]+\.js$/ }, async (args) => {
      const code = await readFile(args.path, 'utf8');
      let contents = code.replace(FONT_PATH, (_, family, file) => {
        if (LEFT_TO_THE_SYSTEM.has(family)) {
          fontCounts.local++;
          return '"local:"';
        }
        fontCounts.embedded++;
        const font = readFileSync(path.join(path.dirname(args.path), 'fonts', family, file));
        return JSON.stringify(`data:font/woff2;base64,${font.toString('base64')}`);
      });
      for (const name of LEFT_TO_THE_SYSTEM.values())
        contents = contents.replace(fontMetadata(name), (entry) => {
          fontCounts.marked.push(name);
          return `${entry}local:!0,`;
        });
      for (const { name, pattern, replace } of NETWORK_PATCHES)
        contents = contents.replace(pattern, (...match) => {
          networkCounts.set(name, (networkCounts.get(name) ?? 0) + 1);
          return replace.replace(/\$(\d)/g, (_, i) => match[Number(i)]);
        });
      return { contents, loader: 'js' };
    });
  },
};

/** styles.css: esbuild writes the CSS it collects (Excalidraw's and ours) to main.css; Obsidian loads styles.css. */
const postBuild = {
  name: 'post-build',
  setup(build) {
    build.onStart(() => {
      fontCounts.embedded = fontCounts.local = 0;
      fontCounts.marked = [];
      networkCounts.clear();
    });
    build.onEnd(async (result) => {
      if (result.errors.length) return;
      const js = await readFile(path.join(outdir, 'main.js'), 'utf8');
      const problem = /["']\.\/fonts\/[^"']+\.woff2["']/.test(js)
        ? 'A font path is left in main.js: Excalidraw would fetch it from its CDN.'
        : !fontCounts.embedded
          ? 'No font was embedded: has Excalidraw changed how it refers to its fonts?'
          : ([...LEFT_TO_THE_SYSTEM.values()]
              .filter((name) => fontCounts.marked.filter((marked) => marked === name).length !== 1)
              .map(
                (name) => `Excalidraw's metadata for the font ${name} wasn't found once: has its build changed?`,
              )[0] ??
            NETWORK_PATCHES.filter(({ name }) => networkCounts.get(name) !== 1).map(
              ({ name }) => `NO-NETWORK: Excalidraw's code for "${name}" wasn't found once: has its build changed?`,
            )[0]);
      if (problem) {
        await rm(path.join(outdir, 'main.css'), { force: true }); // no stylesheet from a build that failed
        throw new Error(problem);
      }
      await rm(path.join(outdir, 'styles.css'), { force: true });
      await rename(path.join(outdir, 'main.css'), path.join(outdir, 'styles.css'));
      if (outdir !== '.') await copyFile('manifest.json', path.join(outdir, 'manifest.json'));
      console.log(`fonts: ${fontCounts.embedded} embedded, ${fontCounts.local} left to the system`);
    });
  },
};

const options = {
  entryPoints: ['src/main.ts'],
  outfile: path.join(outdir, 'main.js'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2021',
  external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*'],
  define: { 'process.env.NODE_ENV': '"production"' },
  conditions: ['production'],
  // Excalidraw's own stylesheet refers to its interface font (Assistant) by relative URL, which can't resolve from
  // styles.css once Obsidian loads it, so those four small files are inlined too.
  loader: { '.woff2': 'dataurl' },
  minify: false,
  banner: {
    js:
      `/* ${manifest.name} ${manifest.version}, ${repository}. MIT License. It bundles other projects' code and fonts: ` +
      'their licences and copyright notices are at the end of this file. */',
  },
  footer: { js: comment(`${readFileSync('LICENSE', 'utf8')}\n\n${readFileSync('THIRD-PARTY-NOTICES.md', 'utf8')}`) },
  legalComments: 'none', // the footer holds every licence, where esbuild would keep only some
  sourcemap: watch ? 'inline' : false,
  logLevel: 'info',
  plugins: [embedFonts, postBuild],
};

await mkdir(outdir, { recursive: true });
if (watch) await (await esbuild.context(options)).watch();
else await esbuild.build(options);
