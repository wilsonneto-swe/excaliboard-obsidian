#!/usr/bin/env node
// make-drawing 1.0.0: builds an Excalidraw drawing (a .excalidraw file) from a short JSON description of boxes and
// arrows, laid out in layers, top-down or left to right. Part of the excalidraw-diagrams agent skill (Excaliboard).
// One file, Node 18 or later, no dependencies. Run: node make-drawing.mjs --help
//
// The drawing is what Excalidraw 0.18.1 itself saves for the same shapes: every element field, each label bound to
// its box (containerId and boundElements), each arrow bound at both ends (startBinding, endBinding and the shapes'
// boundElements), fractional indexes a0, a1, ... and seeds derived from the ids, so the same description always gives
// the same file. Arrow ends sit where Excalidraw puts them when a shape moves (its outline geometry is ported below),
// and labels are sized with the advance widths of Excalidraw's own fonts, so nothing jumps on the first edit.
import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const VERSION = "1.0.0";
const SOURCE = "https://github.com/wilsonneto-swe/excaliboard-obsidian";
/** 2026-11-08T00:00:00Z: a fixed time for every element's "updated", so the file depends on the description only. */
const UPDATED = 1794096000000;
const GRID = 20;
/** Excalidraw's space between a box and its label. */
const BOUND_TEXT_PADDING = 5;
/** Between an arrow's end and the outline of the shape it is bound to. */
const GAP = 8;
/** How far each arrow of a pair that runs both ways between the same nodes arcs out to its side, at least. */
const PAIR_BULGE = 20;
const BLACK = "#1e1e1e";
const WHITE = "#ffffff";

/** Excalidraw 0.18.1's colour palette: five shades per colour, lightest first (its colour picker's rows). */
const PALETTE = {
	gray: ["#f8f9fa", "#e9ecef", "#ced4da", "#868e96", "#343a40"],
	red: ["#fff5f5", "#ffc9c9", "#ff8787", "#fa5252", "#e03131"],
	pink: ["#fff0f6", "#fcc2d7", "#f783ac", "#e64980", "#c2255c"],
	grape: ["#f8f0fc", "#eebefa", "#da77f2", "#be4bdb", "#9c36b5"],
	violet: ["#f3f0ff", "#d0bfff", "#9775fa", "#7950f2", "#6741d9"],
	blue: ["#e7f5ff", "#a5d8ff", "#4dabf7", "#228be6", "#1971c2"],
	cyan: ["#e3fafc", "#99e9f2", "#3bc9db", "#15aabf", "#0c8599"],
	teal: ["#e6fcf5", "#96f2d7", "#38d9a9", "#12b886", "#099268"],
	green: ["#ebfbee", "#b2f2bb", "#69db7c", "#40c057", "#2f9e44"],
	yellow: ["#fff9db", "#ffec99", "#ffd43b", "#fab005", "#f08c00"],
	orange: ["#fff4e6", "#ffd8a8", "#ffa94d", "#fd7e14", "#e8590c"],
	bronze: ["#f8f1ee", "#eaddd7", "#d2bab0", "#a18072", "#846358"],
};
const COLORS = [...Object.keys(PALETTE), "white"];

/** The three fonts Excalidraw 0.18.1 offers for new text, with its line heights (FONT_METADATA). */
const FONTS = {
	hand: { family: 5, lineHeight: 1.25 }, // Excalifont
	normal: { family: 6, lineHeight: 1.35 }, // Nunito
	code: { family: 8, lineHeight: 1.25 }, // Comic Shanns
};
/** Font sizes: Excalidraw's S, M and XL. */
const SIZE = { title: 36, subtitle: 20, node: 20, group: 20, edge: 16, note: 16 };

/**
 * Advance widths in thousandths of an em, base 36, read from the woff2 files Excalidraw 0.18.1 ships (Basic Latin,
 * Latin-1, Latin Extended-A, Greek, Cyrillic and common punctuation, where each font's unicode ranges have them).
 * Each part is "<first code point>:<width>,<width>,...". Canvas text measures within 1% of their sum, apart from
 * kerned pairs such as "AV" (up to 7% narrower).
 */
const WIDTH_TABLES = {
	5: "w:b4,8q,ab,lr,k1,ps,jy,62,c9,b6,el,fa,75,bf,7m,fl,ig,bv,jg,gw,g9,h6,hs,fi,ho,hh,7c,8a,fa,fa,fa,cy,n1,is,l5,hh,lo,jn,id,lo,fx,f5,ft,h1,f3,la,hk,lb,je,lc,kg,ha,nt,ka,gg,lu,hg,fo,n4,d4,gd,dt,e6,im,go,g0,ff,e0,gt,ex,dt,ff,fr,6s,94,et,69,if,em,go,ex,ez,bg,f3,fd,f8,el,j9,gf,eq,fw,e0,8b,f4,il;4g:b4,82,dl,jq,,i8,8b,,go,nu,bq,i1,,j8,i2,go,bg,fa,,,go,,hv,5k,go,,bq,ik,l6,l6,o4,cn,is,is,is,is,is,is,sk,hh,jn,jn,jn,jn,f5,f5,f5,f5,mn,hk,lb,lb,lb,lb,lb,fa,lg,ka,ka,ka,ka,fo,iu,fx,f2,f2,f2,f2,f2,f2,p9,e0,fb,fb,fb,fb,6s,6s,6s,6s,ea,em,fl,fl,fl,fl,fl,fa,h5,e4,e4,e4,e4,ei,fs,ei,is,f2,is,f2,is,f2,hh,e0,hh,e0,hh,e0,hh,e0,lo,gt,mn,h3,jn,fb,jn,fb,jn,fb,jn,fb,jn,fb,lo,ff,lo,ff,lo,ff,lo,ff,fx,fr,ig,h9,f5,6s,f5,6s,f5,6s,f5,6s,f5,6s,p5,fw,ft,94,h1,et,,f3,69,f3,69,f3,69,f3,97,hi,bc,hk,em,hk,em,hk,em,fx,,,lb,fl,lb,fl,lb,fl,xm,pk,kg,bg,kg,bg,kg,bg,ha,f3,ha,f3,ha,f3,ha,f3,nt,fd,nt,fd,nt,gw,ka,e4,ka,e4,ka,e4,ka,e4,ka,e4,ka,f8,lu,j9,fo,ei,fo,n4,fw,n4,fw,n4,fw,;6c3:ji,pz;6c8:7f,8g,6n;6cc:bg,bw,bw;6ci:ei;6cm:jp;6mo:,,,;6gc:jt;6jm:sk;6qa:fa;ou:8a,,,,,,7a,il,in,5k,mv,ie,ig,,ni,,os,lt,8d,is,l5,fi,,jn,n4,fx,ks,f5,h1,hx,la,hk,gs,lb,ga,je,,k3,nt,jm,j9,hg,i1,,f5,jm,fz,da,cw,8d,ea,fz,g2,da,fc,da,bz,cw,g9,8d,en,df,eo,d9,d2,ew,gn,eg,bf,ec,db,ea,hv,di,gt,j8,8d,ea,ew,ea,j8,h1,,,,,,,,fq;sg:jn,jn,ka,fi,i9,ha,f5,f5,ft,sl,on,ko,h1,h8,g6,gv,is,hp,l5,fi,kp,jn,n5,hk,h8,h8,h1,ii,la,fx,lb,ga,je,hh,nt,g6,j9,hg,gv,gf,lp,m0,j3,lx,hp,i2,oc,hs,g0,fx,e9,bn,fd,ex,i0,e5,eq,eq,ep,f8,gj,f1,go,fb,ex,e0,dl,eq,gq,gf,e2,e4,i5,io,gm,jf,e5,ez,kn,fe,fb,fb,gs,bn,f3,f3,6s,6s,94,me,kj,h9,ep,eq,ei,e9,,,ls,hs,,,,,,,,,,,,,,,lb,go,gx,er,,,,,,,,,,,,,,,,,,,,,,,,,,,fi,c8,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,i9,f4,,,,,,,,,h8,eq,,,lb,go,lb,go,,,,,g6,eq",
	6: "w:79,6h,b9,go,go,px,jh,6a,92,92,cj,go,6h,bv,6h,82,go,go,go,go,go,go,go,go,go,go,6h,6h,go,go,go,cf,qb,kd,iv,ir,kr,ga,fb,k9,l8,7a,97,hm,f8,nu,kl,lf,hp,lf,ip,h6,gv,kb,ja,uo,i7,gp,gh,90,82,90,go,dw,a1,et,gb,cx,gb,eu,9g,ge,fw,6l,6p,e4,8d,nx,fw,fk,gb,gb,a5,df,9y,fp,ee,ng,eq,ed,cy,a1,7i,a1,go;4g:79,6h,go,go,go,go,7i,fb,da,mn,96,cl,go,bv,mn,e3,ad,go,ak,ak,a1,go,gk,6h,bb,ak,9i,cl,oy,q6,oy,cf,kd,kd,kd,kd,kd,kd,rc,ir,ga,ga,ga,ga,7a,7a,7a,7a,kr,kl,lf,lf,lf,lf,lf,go,lf,kb,kb,kb,kb,gp,hr,hc,et,et,et,et,et,et,ny,cx,eu,eu,eu,eu,6l,6l,6l,6l,fp,fw,fk,fk,fk,fk,fk,go,fk,fp,fp,fp,fp,ed,gb,ed,kd,et,kd,et,kd,et,ir,cx,ir,cx,ir,cx,ir,cx,kr,gb,kr,gb,ga,eu,ga,eu,ga,eu,ga,eu,ga,eu,k9,ge,k9,ge,k9,ge,k9,ge,l8,fw,ma,fw,7a,6l,7a,6l,7a,6l,7a,6l,7a,6l,gh,,97,6p,hm,e4,e4,f8,8d,f8,8d,f8,8d,f8,9h,f8,8d,kl,fw,kl,fw,kl,fw,fw,kl,fw,lf,fk,lf,fk,lf,fk,t5,pb,ip,a5,ip,a5,ip,a5,h6,df,h6,df,h6,df,h6,df,gv,9y,gv,9y,gv,9y,kb,fp,kb,fp,kb,fp,kb,fp,kb,fp,kb,fp,uo,ng,gp,ed,gp,gh,cy,gh,cy,gh,cy,;6c3:dw,rs;6c8:6h,6h,6h;6cc:b9,b9,b9;6ci:ek;6cm:jg;6mo:,,,;6gc:go;6jm:pv;6qa:go;sg:ga,ga,nk,f6,ir,h6,7a,7a,97,ve,wd,no,i1,kl,hz,l2,kd,if,iv,f6,lr,ga,r7,hr,kl,kl,i1,kn,nu,l8,lf,l2,hp,ir,gv,hz,nq,i7,m4,iw,td,ue,m2,o1,if,ir,sd,iq,f4,fv,fc,c8,gm,f5,m2,dy,gc,gc,eu,g3,ih,gg,fv,gd,gm,d8,ci,eo,mc,f0,gr,fh,mf,n5,h7,kk,f1,dr,lo,f4,f5,f5,g7,c8,ds,dp,6w,6w,70,o7,ol,g7,eu,gc,eo,gd,,,k9,h7,,,,,,,qw,m2,,,,,,,lg,fv,kt,ff,,,,,,,,,,,,,,,,,,,,,l5,h2,jz,h7,hq,gl,f6,c8,g7,ct,is,fh,rg,na,hr,dy,ia,fy,j0,fw,j6,ev,lo,h0,mc,h6,q0,kr,,,mp,i6,ir,d4,g9,ci,gp,ef,gp,ef,ih,fk,pr,jg,k1,g7,iw,g0,iw,g7,pw,ho,pw,ho,7a,r7,m2,is,f7,l7,gt,l8,gg,lr,h6,j5,fh,oe,j7,6w,kd,f4,kd,f4,rc,o8,ga,f5,lg,f6,lg,f6,r7,m2,hr,dy,hr,dw,kl,gc,kl,gc,lf,fv,lg,fv,lg,fv,ir,dr,hz,eo,hz,eo,hz,eo,iw,fh,f6,c8,o1,kk,g7,ct,i7,f0,i7,f0",
	8: "w:fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa;4g:,fa,fa,fa,fa,fa,fa,,fa,,,fa,fa,,,fa,fa,fa,,,fa,,,,fa,,,fa,fa,,,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,,fa,fa,fa,fa,fa,fa,fa,,fa,fa,fa,fa,fa,fa,,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,f0,f0,f0,f0,,go,fa,fa,fa,fa,fa,fa,,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,,,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,,,fa,f0,fa,f0,fa,f0,fa,fa,fa,fa,,,fa,fa,fa,fa,,fa,fa,fa,fa,,,,,f8,f8,fa,go,fa,go,fa,go,,,,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,,,fa,fa,,,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa;6c3:fa,fa;6c8:fa,fa,fa;6cc:fa,fa,;6ci:fa;6cm:fa;6mo:fa,fa,fa,fa;6gc:fa;6jm:;6qa:fa;qj:f3",
};

// ---------------------------------------------------------------------------------------------------------------
// Text

const widthMaps = new Map();
function widthMap(family) {
	let map = widthMaps.get(family);
	if (map) return map;
	map = new Map();
	for (const part of WIDTH_TABLES[family].split(";")) {
		const [start, list] = part.split(":");
		let cp = parseInt(start, 36);
		for (const w of list.split(",")) {
			if (w) map.set(cp, parseInt(w, 36) / 1000);
			cp++;
		}
	}
	widthMaps.set(family, map);
	return map;
}

/** The width of a character in ems; one the font lacks is drawn in a fallback font. */
function charWidth(cp, map) {
	const w = map.get(cp);
	if (w !== undefined) return w;
	return cp >= 0x2e80 ? 1 : 0.6; // CJK and emoji are about 1 em wide
}

/**
 * Chinese, Japanese and Korean (Hangul, CJK, kana, fullwidth forms), about 1 em wide. Excalidraw 0.18.1 draws them in
 * Xiaolai, the hand-drawn font it pairs with Excalifont only (getFontFamilyFallbacks); Excaliboard leaves Xiaolai out
 * (12 MB), so there a system font draws them. Either way, Excalifont is the best a description can choose for them.
 */
const CJK = [[0x1100, 0x11ff], [0x2e80, 0x9fff], [0xa960, 0xa97f], [0xac00, 0xd7ff], [0xf900, 0xfaff], [0xfe10, 0xfe4f], [0xff00, 0xffef], [0x20000, 0x3ffff]];
const isCJK = (cp) => CJK.some(([a, b]) => cp >= a && cp <= b);

/** The characters of `text` that the font lacks (drawn in a fallback font), apart from CJK in Excalifont (see CJK). */
export function missingGlyphs(text, font) {
	const map = widthMap(FONTS[font].family);
	const lacks = (ch) => {
		const cp = ch.codePointAt(0);
		return !/\s/.test(ch) && !map.has(cp) && !(font === "hand" && isCJK(cp));
	};
	return [...new Set([...text].filter(lacks))];
}

/** Text size as Excalidraw measures it: the widest line, and one line height per line. */
export function measureText(text, font, fontSize) {
	const { family, lineHeight } = FONTS[font];
	const map = widthMap(family);
	const lines = text.replace(/\r\n?/g, "\n").replace(/\t/g, "        ").split("\n");
	let width = 0;
	for (const line of lines) {
		let w = 0;
		for (const ch of line || " ") w += charWidth(ch.codePointAt(0), map);
		width = Math.max(width, w * fontSize);
	}
	return { width: round2(width), height: round2(lines.length * fontSize * lineHeight), lines: lines.length };
}

// ---------------------------------------------------------------------------------------------------------------
// The description

class DescriptionError extends Error {
	constructor(problems) {
		super(problems.join("\n"));
		this.problems = problems;
	}
}

const TOP_KEYS = ["title", "subtitle", "layout", "font", "fill", "nodes", "edges", "groups", "notes"];
const NODE_KEYS = ["id", "label", "shape", "color", "group", "link", "fontSize", "x", "y", "width", "height"];
const FONT_SIZES = [16, 20, 28, 36];
const EDGE_KEYS = ["from", "to", "label", "style", "arrow", "color"];
const GROUP_KEYS = ["id", "label", "color", "fontSize"];
const SHAPES = ["rectangle", "ellipse", "diamond"];
const STYLES = ["solid", "dashed", "dotted"];
const ARROWS = ["end", "start", "both", "none"];
const LAYOUTS = ["down", "right", "manual"];
const FILLS = ["solid", "hachure", "cross-hatch"];
const ID = /^[A-Za-z0-9_.-]{1,64}$/;
const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const list = (values) => values.map((v) => `"${v}"`).join(", ");

/** Checks the description and fills in the defaults; every problem is reported at once. */
export function readDescription(d) {
	const problems = [];
	const say = (text) => problems.push(text);
	if (!isObject(d)) throw new DescriptionError(["The description must be a JSON object with \"nodes\" (and usually \"edges\")."]);
	const unknownKeys = (obj, keys, where) => {
		for (const key of Object.keys(obj)) if (!keys.includes(key)) say(`${where}: unknown key "${key}" (allowed: ${list(keys)}).`);
	};
	const optString = (obj, key, where, { nonEmpty = false } = {}) => {
		const v = obj[key];
		if (v === undefined) return undefined;
		if (typeof v !== "string") say(`${where}: "${key}" must be a string.`);
		else if (nonEmpty && v.trim() === "") say(`${where}: "${key}" is empty.`);
		else return v;
		return undefined;
	};
	const optEnum = (obj, key, values, where, fallback) => {
		const v = obj[key];
		if (v === undefined) return fallback;
		if (!values.includes(v)) say(`${where}: "${key}" must be one of ${list(values)}, not ${JSON.stringify(v)}.`);
		return values.includes(v) ? v : fallback;
	};

	unknownKeys(d, TOP_KEYS, "The description");
	const out = {
		title: optString(d, "title", "The description", { nonEmpty: true }),
		subtitle: optString(d, "subtitle", "The description", { nonEmpty: true }),
		layout: optEnum(d, "layout", LAYOUTS, "The description", "down"),
		font: optEnum(d, "font", Object.keys(FONTS), "The description", "hand"),
		fill: optEnum(d, "fill", FILLS, "The description", "solid"),
		nodes: [],
		edges: [],
		groups: [],
		notes: [],
	};

	const groupIds = new Set();
	if (d.groups !== undefined && !Array.isArray(d.groups)) say("\"groups\" must be an array.");
	for (const [i, g] of (Array.isArray(d.groups) ? d.groups : []).entries()) {
		const where = `groups[${i}]`;
		if (!isObject(g)) {
			say(`${where} must be an object like {"id": "backend", "label": "Backend"}.`);
			continue;
		}
		unknownKeys(g, GROUP_KEYS, where);
		if (typeof g.id !== "string" || !ID.test(g.id)) say(`${where}: "id" must be 1-64 letters, digits, "_", "-" or ".".`);
		else if (groupIds.has(g.id)) say(`${where}: the id "${g.id}" is used twice.`);
		else groupIds.add(g.id);
		const fontSize = g.fontSize === undefined ? SIZE.group : g.fontSize;
		if (!FONT_SIZES.includes(fontSize)) say(`${where}: "fontSize" must be one of ${FONT_SIZES.join(", ")}.`);
		out.groups.push({ id: g.id, label: optString(g, "label", where, { nonEmpty: true }), color: optEnum(g, "color", COLORS, where, "gray"), fontSize });
	}
	// The area of group "a-title" and the title of group "a" would both be "group-a-title".
	for (const [i, g] of out.groups.entries()) {
		const owner = typeof g.id === "string" && g.id.endsWith("-title") ? g.id.slice(0, -"-title".length) : null;
		if (owner && groupIds.has(owner)) say(`groups[${i}]: the id "${g.id}" clashes with the title of the group "${owner}" (both would be "group-${g.id}"); choose another id.`);
	}

	const nodeIds = new Set();
	if (!Array.isArray(d.nodes) || d.nodes.length === 0) say("\"nodes\" must be a non-empty array of nodes.");
	for (const [i, n] of (Array.isArray(d.nodes) ? d.nodes : []).entries()) {
		const where = `nodes[${i}]`;
		if (!isObject(n)) {
			say(`${where} must be an object like {"id": "api", "label": "API"}.`);
			continue;
		}
		unknownKeys(n, NODE_KEYS, where);
		if (typeof n.id !== "string" || !ID.test(n.id)) say(`${where}: "id" must be 1-64 letters, digits, "_", "-" or ".".`);
		else if (nodeIds.has(n.id)) say(`${where}: the id "${n.id}" is used twice.`);
		else nodeIds.add(n.id);
		const label = optString(n, "label", where, { nonEmpty: true });
		if (n.label === undefined) say(`${where}: "label" is missing (the text in the box).`);
		const group = optString(n, "group", where);
		if (group !== undefined && !groupIds.has(group)) say(`${where}: "group" is "${group}", which is not in "groups".`);
		const shape = optEnum(n, "shape", SHAPES, where, "rectangle");
		const num = (key) => {
			if (n[key] === undefined) return undefined;
			if (typeof n[key] !== "number" || !Number.isFinite(n[key]) || Math.abs(n[key]) > 1e5) say(`${where}: "${key}" must be a number of pixels.`);
			else return n[key];
			return undefined;
		};
		const [x, y, width, height] = ["x", "y", "width", "height"].map(num);
		const fontSize = n.fontSize === undefined ? SIZE.node : n.fontSize;
		if (!FONT_SIZES.includes(fontSize)) say(`${where}: "fontSize" must be one of ${FONT_SIZES.join(", ")} (Excalidraw's sizes S, M, L and XL).`);
		if (out.layout === "manual" && (x === undefined || y === undefined)) say(`${where}: "layout": "manual" needs "x" and "y" on every node (its top-left corner, in pixels).`);
		if (out.layout !== "manual" && (n.x !== undefined || n.y !== undefined)) say(`${where}: "x" and "y" are for "layout": "manual"; the ${out.layout} layout places the boxes itself.`);
		if (label !== undefined && (width !== undefined || height !== undefined)) {
			const [minW, minH] = shapeSize(shape, measureText(label, out.font, FONT_SIZES.includes(fontSize) ? fontSize : SIZE.node), 0);
			if (width !== undefined && width < minW) say(`${where}: "width" ${width} is too narrow for the label: at least ${minW}.`);
			if (height !== undefined && height < minH) say(`${where}: "height" ${height} is too low for the label: at least ${minH}.`);
		}
		out.nodes.push({ id: n.id, label: label ?? "", shape, color: optEnum(n, "color", COLORS, where, undefined), group, link: optString(n, "link", where, { nonEmpty: true }), fontSize, x, y, width, height });
	}

	const seen = new Map();
	if (d.edges !== undefined && !Array.isArray(d.edges)) say("\"edges\" must be an array.");
	for (const [i, e] of (Array.isArray(d.edges) ? d.edges : []).entries()) {
		const where = `edges[${i}]`;
		if (!isObject(e)) {
			say(`${where} must be an object like {"from": "api", "to": "db"}.`);
			continue;
		}
		unknownKeys(e, EDGE_KEYS, where);
		for (const end of ["from", "to"]) {
			if (typeof e[end] !== "string") say(`${where}: "${end}" must be a node id.`);
			else if (groupIds.has(e[end]) && !nodeIds.has(e[end])) {
				if (out.layout !== "manual") say(`${where}: "${end}" is the group "${e[end]}"; an edge can end at a group (its area) only with "layout": "manual".`);
			} else if (!nodeIds.has(e[end])) say(`${where}: "${end}" is "${e[end]}", which is not a node or group id.`);
		}
		if (e.from === e.to && typeof e.from === "string") say(`${where}: an edge from a node to itself is not supported.`);
		// An end is a group only when no node has that id (a node's id wins).
		const member = (node, group) => groupIds.has(group) && !nodeIds.has(group) && out.nodes.some((n) => n.id === node && n.group === group);
		if (member(e.from, e.to) || member(e.to, e.from)) say(`${where}: an edge between a node and its own group is not supported (it would start inside the area).`);
		const key = `${e.from}\u0000${e.to}`;
		if (seen.has(key)) say(`${where} repeats edges[${seen.get(key)}] (${e.from} -> ${e.to}): merge them into one edge.`);
		else seen.set(key, i);
		out.edges.push({
			from: e.from,
			to: e.to,
			label: optString(e, "label", where, { nonEmpty: true }),
			style: optEnum(e, "style", STYLES, where, "solid"),
			arrow: optEnum(e, "arrow", ARROWS, where, "end"),
			color: optEnum(e, "color", COLORS, where, undefined),
		});
	}

	if (d.notes !== undefined && (!Array.isArray(d.notes) || d.notes.some((n) => typeof n !== "string" || n.trim() === "")))
		say("\"notes\" must be an array of non-empty strings.");
	else out.notes = d.notes ?? [];

	for (const g of out.groups) if (!out.nodes.some((n) => n.group === g.id)) say(`The group "${g.id}" has no nodes: give some nodes "group": "${g.id}".`);
	if (problems.length) throw new DescriptionError(problems);
	return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Layout: layers (longest path), crossing reduction (barycentres), then positions (isotonic regression)

const up = (v) => Math.ceil(v / GRID - 1e-9) * GRID;
const round2 = (v) => Math.round(v * 100) / 100;

/**
 * A box that holds the label with Excalidraw's padding plus some air, on the 20 px grid; with `air` 0, the smallest
 * box whose text area (getBoundTextMaxWidth and getBoundTextMaxHeight) still holds the label on its lines.
 */
function shapeSize(shape, m, air = 1) {
	const p = 2 * BOUND_TEXT_PADDING;
	const fit = air ? up : Math.ceil;
	if (shape === "ellipse") return [Math.max(160 * air, fit((m.width + p + 24 * air) * Math.SQRT2)), Math.max(80 * air, fit((m.height + p + 8 * air) * Math.SQRT2))];
	if (shape === "diamond") return [Math.max(160 * air, fit(2 * (m.width + p + 16 * air))), Math.max(100 * air, fit(2 * (m.height + p + 6 * air)))];
	return [Math.max(120 * air, fit(m.width + p + 40 * air)), Math.max(60 * air, fit(m.height + p + 20 * air))];
}

/** Layers by longest path, after reversing the edges that close a cycle (found by a depth-first search). */
function assignLayers(count, edges) {
	const out = Array.from({ length: count }, () => []);
	edges.forEach((e, i) => out[e.u].push(i));
	const state = new Array(count).fill(0);
	const flipped = new Set();
	for (let s = 0; s < count; s++) {
		if (state[s]) continue;
		const stack = [[s, 0]];
		state[s] = 1;
		while (stack.length) {
			const top = stack[stack.length - 1];
			if (top[1] < out[top[0]].length) {
				const ei = out[top[0]][top[1]++];
				const w = edges[ei].v;
				if (state[w] === 1) flipped.add(ei);
				else if (state[w] === 0) {
					state[w] = 1;
					stack.push([w, 0]);
				}
			} else {
				state[top[0]] = 2;
				stack.pop();
			}
		}
	}
	const succ = Array.from({ length: count }, () => []);
	const pred = Array.from({ length: count }, () => []);
	edges.forEach((e, i) => {
		const [a, b] = flipped.has(i) ? [e.v, e.u] : [e.u, e.v];
		succ[a].push(b);
		pred[b].push(a);
	});
	const indeg = pred.map((p) => p.length);
	const order = [];
	const queue = [];
	for (let v = 0; v < count; v++) if (indeg[v] === 0) queue.push(v);
	while (queue.length) {
		const v = queue.shift();
		order.push(v);
		for (const w of succ[v]) if (--indeg[w] === 0) queue.push(w);
	}
	const layer = new Array(count).fill(0);
	for (const v of order) for (const w of succ[v]) layer[w] = Math.max(layer[w], layer[v] + 1);
	// A node with no incoming edges sits right above the nearest node it points to, not in the first layer.
	for (const v of [...order].reverse()) {
		if (pred[v].length === 0 && succ[v].length > 0) layer[v] = Math.min(...succ[v].map((w) => layer[w])) - 1;
	}
	return { layer, flipped };
}

/** Positions minimising the squared distance to `desired`, keeping each centre `sep[i]` after the one before. */
function isotonicPlace(desired, sep) {
	const offset = [0];
	for (let i = 0; i < sep.length; i++) offset.push(offset[i] + sep[i]);
	const blocks = [];
	desired.forEach((d, i) => {
		blocks.push({ sum: d - offset[i], n: 1 });
		while (blocks.length > 1) {
			const b = blocks[blocks.length - 1];
			const a = blocks[blocks.length - 2];
			if (a.sum / a.n <= b.sum / b.n) break;
			blocks.pop();
			a.sum += b.sum;
			a.n += b.n;
		}
	});
	const out = [];
	for (const b of blocks) for (let k = 0; k < b.n; k++) out.push(b.sum / b.n + offset[out.length]);
	return out;
}

function layout(desc) {
	const horizontal = desc.layout === "right"; // layers are columns
	const index = new Map(desc.nodes.map((n, i) => [n.id, i]));
	const groupOf = new Map(desc.groups.map((g) => [g.id, g]));
	const nodes = desc.nodes.map((n, i) => {
		const m = measureText(n.label, desc.font, n.fontSize);
		const [w, h] = shapeSize(n.shape, m);
		return { ...n, i, m, w: n.width ?? w, h: n.height ?? h };
	});
	// u and v: the node indexes of the edge's ends (null for an end at a group, in the manual layout).
	const edges = desc.edges.map((e, i) => ({ ...e, i, u: index.get(e.from) ?? null, v: index.get(e.to) ?? null }));

	// "manual": the boxes go where the description puts them; arrows run straight between the centres of their boxes
	// (or of the groups' areas).
	if (desc.layout === "manual") {
		const nodeBox = new Map(nodes.map((n) => [n.i, { x: n.x, y: n.y, w: n.w, h: n.h }]));
		const areas = groupAreas(desc, nodes, nodeBox);
		const boxOf = (i, id) => (i !== null ? nodeBox.get(i) : areas.find((a) => a.group.id === id));
		const centreOf = (i, id) => {
			const b = boxOf(i, id);
			return [b.x + b.w / 2, b.y + b.h / 2];
		};
		const paths = edges.map((e) => [centreOf(e.u, e.from), centreOf(e.v, e.to)]);
		return { nodes, edges, nodeBox, paths, areas, horizontal: false };
	}

	const { layer, flipped } = assignLayers(nodes.length, edges);
	const layerCount = Math.max(...layer) + 1;

	// Boxes of the same shape in one layer share their size across the flow (heights in rows, widths in columns),
	// unless the description sets it.
	for (let k = 0; k < layerCount; k++) {
		for (const shape of SHAPES) {
			const same = nodes.filter((n) => layer[n.i] === k && n.shape === shape && (horizontal ? n.width : n.height) === undefined);
			if (horizontal) {
				const w = Math.max(0, ...same.map((n) => n.w));
				for (const n of same) n.w = w;
			} else {
				const h = Math.max(0, ...same.map((n) => n.h));
				for (const n of same) n.h = h;
			}
		}
	}

	// Items per layer: nodes, and route points ("dummies") where an edge crosses a layer.
	const items = nodes.map((n) => ({ kind: "node", node: n, layer: layer[n.i], group: n.group, size: horizontal ? n.h : n.w }));
	const routes = edges.map((e) => {
		const [a, b] = flipped.has(e.i) ? [e.v, e.u] : [e.u, e.v];
		const chain = [a];
		for (let k = layer[a] + 1; k < layer[b]; k++) {
			items.push({ kind: "dummy", edge: e.i, layer: k, group: undefined, size: 0 });
			chain.push(items.length - 1);
		}
		chain.push(b);
		// A label sits on the middle route point when there is one: keep the boxes beside it clear of the label.
		const dummies = chain.length - 2;
		if (e.label !== undefined && dummies % 2 === 1) {
			const m = measureText(e.label, desc.font, SIZE.edge);
			items[chain[(chain.length - 1) / 2]].size = (horizontal ? m.height : m.width) + 16;
		}
		return chain;
	});
	const preds = items.map(() => []);
	const succs = items.map(() => []);
	for (const chain of routes) {
		for (let k = 0; k + 1 < chain.length; k++) {
			succs[chain[k]].push(chain[k + 1]);
			preds[chain[k + 1]].push(chain[k]);
		}
	}
	const layers = Array.from({ length: layerCount }, () => []);
	items.forEach((it, i) => layers[it.layer].push(i));
	const pos = new Array(items.length).fill(0);
	const setPositions = () => layers.forEach((l) => l.forEach((it, p) => (pos[it] = p)));
	setPositions();

	const crossings = () => {
		let c = 0;
		for (let k = 0; k + 1 < layerCount; k++) {
			const pairs = [];
			for (const a of layers[k]) for (const b of succs[a]) pairs.push([pos[a], pos[b]]);
			for (let i = 0; i < pairs.length; i++)
				for (let j = i + 1; j < pairs.length; j++) if ((pairs[i][0] - pairs[j][0]) * (pairs[i][1] - pairs[j][1]) < 0) c++;
		}
		return c;
	};
	const mean = (vals) => vals.reduce((s, v) => s + v, 0) / vals.length;
	let best = { count: crossings(), layers: layers.map((l) => [...l]) };
	for (let iter = 0; iter < 16 && best.count > 0; iter++) {
		const down = iter % 2 === 0;
		const range = down ? [...Array(layerCount).keys()].slice(1) : [...Array(layerCount).keys()].reverse().slice(1);
		for (const k of range) {
			const key = new Map();
			for (const it of layers[k]) {
				const nb = down ? preds[it] : succs[it];
				key.set(it, nb.length ? mean(nb.map((x) => pos[x])) : pos[it]);
			}
			// Nodes of one group stay together: they sort by the group's mean key first.
			const groupKey = new Map();
			for (const it of layers[k]) {
				const g = items[it].group;
				if (g === undefined || groupKey.has(g)) continue;
				groupKey.set(g, mean(layers[k].filter((x) => items[x].group === g).map((x) => key.get(x))));
			}
			const sortKey = (it) => (items[it].group === undefined ? key.get(it) : groupKey.get(items[it].group));
			layers[k].sort((a, b) => sortKey(a) - sortKey(b) || key.get(a) - key.get(b) || pos[a] - pos[b]);
			layers[k].forEach((it, p) => (pos[it] = p));
		}
		const count = crossings();
		if (count < best.count) best = { count, layers: layers.map((l) => [...l]) };
	}
	best.layers.forEach((l, k) => (layers[k] = l));
	setPositions();

	// Space between neighbours in a layer: more between groups, for the groups' areas and their titles.
	const groupTop = (g) => groupBand(groupOf.get(g), desc.font);
	const minSep = (a, b) => {
		const A = items[a];
		const B = items[b];
		if (A.kind === "dummy" || B.kind === "dummy") return (A.size + B.size) / 2 + (A.kind === B.kind ? 20 : 40);
		let gap = 40;
		if (A.group !== B.group) {
			if (horizontal) gap += (A.group !== undefined ? 20 : 0) + (B.group !== undefined ? groupTop(B.group) : 0) + 20;
			else gap += (A.group !== undefined ? 20 : 0) + (B.group !== undefined ? 20 : 0) + 20;
		}
		return (A.size + B.size) / 2 + gap;
	};
	const centre = new Array(items.length).fill(0);
	for (const l of layers) {
		let c = 0;
		l.forEach((it, p) => {
			if (p > 0) c += minSep(l[p - 1], it);
			centre[it] = c;
		});
		const shift = c / 2;
		for (const it of l) centre[it] -= shift;
	}
	const placeLayer = (l, neighbours) => {
		if (!l.length) return;
		const desired = l.map((it) => {
			const nb = neighbours(it);
			return nb.length ? mean(nb.map((x) => centre[x])) : centre[it];
		});
		const sep = l.slice(1).map((it, p) => minSep(l[p], it));
		isotonicPlace(desired, sep).forEach((c, p) => (centre[l[p]] = c));
	};
	// Alternate sweeps; the last one goes up, so each box ends centred over the boxes it points to (a group's area
	// is then as wide as its widest layer, and areas side by side do not overlap).
	for (let iter = 0; iter < 12; iter++) {
		for (let k = 1; k < layerCount; k++) placeLayer(layers[k], (it) => preds[it]);
		for (let k = layerCount - 2; k >= 0; k--) placeLayer(layers[k], (it) => succs[it]);
	}
	// On the grid: each centre on a multiple of 20 px, so boxes in a chain line up and the arrows between them run
	// straight, keeping the spacing.
	for (const l of layers) {
		l.forEach((it, p) => {
			let c = Math.round(centre[it] / GRID) * GRID;
			if (p > 0) {
				const min = centre[l[p - 1]] + minSep(l[p - 1], it);
				if (c < min - 1e-9) c = up(min);
			}
			centre[it] = c;
		});
	}

	// Across the layers: each layer's band, and the gap after it (room for arrow labels and group areas).
	const labelSize = (e) => (e.label === undefined ? null : measureText(e.label, desc.font, SIZE.edge));
	const band = layers.map((l) => Math.max(0, ...l.filter((it) => items[it].kind === "node").map((it) => (horizontal ? items[it].node.w : items[it].node.h))));
	const gaps = [];
	for (let k = 0; k + 1 < layerCount; k++) {
		let need = horizontal ? 120 : 100;
		const groupsEndingHere = new Set();
		const groupsStartingNext = new Set();
		for (const g of desc.groups) {
			const ls = nodes.filter((n) => n.group === g.id).map((n) => layer[n.i]);
			if (Math.max(...ls) === k) groupsEndingHere.add(g.id);
			if (Math.min(...ls) === k + 1) groupsStartingNext.add(g.id);
		}
		const areaRoom = (groupsEndingHere.size ? 20 : 0) + (groupsStartingNext.size ? (horizontal ? 20 : Math.max(...[...groupsStartingNext].map(groupTop))) : 0);
		for (const [ei, chain] of routes.entries()) {
			const m = labelSize(edges[ei]);
			if (!m) continue;
			const crosses = chain.some((it, p) => p + 1 < chain.length && items[it].layer === k && items[chain[p + 1]].layer === k + 1);
			// Room for the label and 20 px of arrow on either side (40 px along a horizontal arrow).
			if (crosses) need = Math.max(need, (horizontal ? m.width + 80 : m.height + 40) + areaRoom + 2 * GAP);
		}
		// Steep enough that an arrow aimed at a box's centre clears the boxes beside it (40 px away): a gap that
		// grows with how far across the arrow runs.
		const alongOf = (it) => (items[it].kind === "node" ? (horizontal ? items[it].node.w : items[it].node.h) : 0);
		for (const chain of routes) {
			for (let p = 0; p + 1 < chain.length; p++) {
				const [a, b] = [chain[p], chain[p + 1]];
				if (items[a].layer !== k || items[b].layer !== k + 1) continue;
				const across = Math.abs(centre[a] - centre[b]);
				for (const end of [a, b]) {
					if (items[end].kind !== "node") continue;
					need = Math.max(need, (alongOf(end) * across) / (items[end].size + 80) - (alongOf(a) + alongOf(b)) / 2 + 20);
				}
			}
		}
		need = Math.max(need, areaRoom + 60);
		gaps.push(up(need));
	}
	const bandStart = [0];
	for (let k = 1; k < layerCount; k++) bandStart.push(bandStart[k - 1] + band[k - 1] + gaps[k - 1]);

	// Real coordinates.
	const nodeBox = new Map();
	for (const it of items.keys()) {
		const item = items[it];
		const k = item.layer;
		if (item.kind === "node") {
			const n = item.node;
			const across = bandStart[k] + ((horizontal ? band[k] - n.w : band[k] - n.h) / 2);
			const x = horizontal ? across : centre[it] - n.w / 2;
			const y = horizontal ? centre[it] - n.h / 2 : across;
			nodeBox.set(n.i, { x, y, w: n.w, h: n.h });
			item.point = [x + n.w / 2, y + n.h / 2];
		} else {
			const across = bandStart[k] + band[k] / 2;
			item.point = horizontal ? [across, centre[it]] : [centre[it], across];
		}
	}
	const paths = routes.map((chain, ei) => {
		const pts = chain.map((it) => items[it].point);
		return flipped.has(ei) ? pts.reverse() : pts;
	});

	return { nodes, edges, nodeBox, paths, areas: groupAreas(desc, nodes, nodeBox), horizontal };
}

/** The space above a group's nodes in its area: 20 px, or room for the title (60 px for a 20 px title). */
function groupBand(g, font) {
	return g.label === undefined ? 20 : up(16 + measureText(g.label, font, g.fontSize).height + 12);
}

/** Group areas: 20 px around their nodes, with room at the top for the title. */
function groupAreas(desc, nodes, nodeBox) {
	return desc.groups.map((g) => {
		const boxes = nodes.filter((n) => n.group === g.id).map((n) => nodeBox.get(n.i));
		let x1 = Math.min(...boxes.map((b) => b.x)) - 20;
		let x2 = Math.max(...boxes.map((b) => b.x + b.w)) + 20;
		const y1 = Math.min(...boxes.map((b) => b.y)) - groupBand(g, desc.font);
		const y2 = Math.max(...boxes.map((b) => b.y + b.h)) + 20;
		const title = g.label !== undefined ? measureText(g.label, desc.font, g.fontSize) : null;
		if (title && x2 - x1 < title.width + 40) {
			const extra = up(title.width + 40 - (x2 - x1));
			x1 -= extra / 2;
			x2 += extra / 2;
		}
		return { group: g, x: x1, y: y1, w: x2 - x1, h: y2 - y1, title };
	});
}

// ---------------------------------------------------------------------------------------------------------------
// Geometry, ported from Excalidraw 0.18.1 (element/utils.ts, element/binding.ts, math/*) for unrotated shapes

const PRECISION = 1e-4;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const scale = (v, s) => [v[0] * s, v[1] * s];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
const normalize = (v) => {
	const l = Math.hypot(v[0], v[1]);
	return l === 0 ? [0, 0] : [v[0] / l, v[1] / l];
};

function linesIntersectAt(a, b) {
	const A1 = a[1][1] - a[0][1];
	const B1 = a[0][0] - a[1][0];
	const A2 = b[1][1] - b[0][1];
	const B2 = b[0][0] - b[1][0];
	const D = A1 * B2 - A2 * B1;
	if (D === 0) return null;
	const C1 = A1 * a[0][0] + B1 * a[0][1];
	const C2 = A2 * b[0][0] + B2 * b[0][1];
	return [(C1 * B2 - C2 * B1) / D, (A1 * C2 - A2 * C1) / D];
}
function distanceToSegment(p, s) {
	const [[x1, y1], [x2, y2]] = s;
	const C = x2 - x1;
	const D = y2 - y1;
	const lenSq = C * C + D * D;
	let t = lenSq !== 0 ? ((p[0] - x1) * C + (p[1] - y1) * D) / lenSq : -1;
	t = Math.max(0, Math.min(1, t));
	return Math.hypot(p[0] - (x1 + t * C), p[1] - (y1 + t * D));
}
function segmentIntersection(l, s) {
	const c = linesIntersectAt(l, s);
	if (!c || distanceToSegment(c, s) >= PRECISION || distanceToSegment(c, l) >= PRECISION) return null;
	return c;
}
function bezier(c, t) {
	const u = 1 - t;
	return [0, 1].map((k) => u ** 3 * c[0][k] + 3 * u * u * t * c[1][k] + 3 * u * t * t * c[2][k] + t ** 3 * c[3][k]);
}
/** One crossing of a cubic Bézier corner and a segment, by Newton's method from three guesses, as Excalidraw does. */
function curveIntersection(c, l) {
	const f = (t, s) => {
		const b = bezier(c, t);
		return [b[0] - (l[0][0] + s * (l[1][0] - l[0][0])), b[1] - (l[0][1] + s * (l[1][1] - l[0][1]))];
	};
	for (const [t0, s0] of [[0.5, 0], [0.2, 0], [0.8, 0]]) {
		let [t, s] = [t0, s0];
		let ok = false;
		for (let iter = 0; iter < 10; iter++) {
			const y = f(t, s);
			if (Math.hypot(y[0], y[1]) < 1e-3) {
				ok = true;
				break;
			}
			const d = 1e-6;
			const ft1 = f(t + d, s);
			const ft0 = f(t - d, s);
			const fs1 = f(t, s + d);
			const fs0 = f(t, s - d);
			const J = [[(ft1[0] - ft0[0]) / (2 * d), (fs1[0] - fs0[0]) / (2 * d)], [(ft1[1] - ft0[1]) / (2 * d), (fs1[1] - fs0[1]) / (2 * d)]];
			const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
			if (det === 0) break;
			t += (-J[1][1] * y[0] + J[0][1] * y[1]) / det;
			s += (J[1][0] * y[0] - J[0][0] * y[1]) / det;
		}
		if (ok && t >= 0 && t <= 1 && s >= 0 && s <= 1) return [bezier(c, t)];
	}
	return [];
}
function cornerRadius(x, roundness) {
	if (roundness?.type === 2 || roundness?.type === 1) return x * 0.25;
	if (roundness?.type === 3) return x <= 128 ? x * 0.25 : 32;
	return 0;
}
/** A rectangle's outline pushed out by `offset`: four sides and four rounded corners (Bézier curves). */
function rectangleOutline(el, offset) {
	const r = cornerRadius(Math.min(el.width, el.height), el.roundness);
	if (r <= 0) {
		const [x1, y1, x2, y2] = [el.x - offset, el.y - offset, el.x + el.width + offset, el.y + el.height + offset];
		return [[[[x1, y1], [x2, y1]], [[x2, y1], [x2, y2]], [[x1, y2], [x2, y2]], [[x1, y2], [x1, y1]]], []];
	}
	const c = [el.x + el.width / 2, el.y + el.height / 2];
	const [x1, y1, x2, y2] = [el.x, el.y, el.x + el.width, el.y + el.height];
	const top = [[x1 + r, y1], [x2 - r, y1]];
	const right = [[x2, y1 + r], [x2, y2 - r]];
	const bottom = [[x1 + r, y2], [x2 - r, y2]];
	const left = [[x1, y2 - r], [x1, y1 + r]];
	const off = [[x1 - offset, y1 - offset], [x2 + offset, y1 - offset], [x2 + offset, y2 + offset], [x1 - offset, y2 + offset]].map((p) =>
		scale(normalize(sub(p, c)), offset),
	);
	const toward = (p, q) => [p[0] + (2 / 3) * (q[0] - p[0]), p[1] + (2 / 3) * (q[1] - p[1])];
	const corners = [
		[left[1], toward(left[1], [x1, y1]), toward(top[0], [x1, y1]), top[0]].map((p) => add(off[0], p)),
		[top[1], toward(top[1], [x2, y1]), toward(right[0], [x2, y1]), right[0]].map((p) => add(off[1], p)),
		[right[1], toward(right[1], [x2, y2]), toward(bottom[1], [x2, y2]), bottom[1]].map((p) => add(off[2], p)),
		[bottom[0], toward(bottom[0], [x1, y2]), toward(left[0], [x1, y2]), left[0]].map((p) => add(off[3], p)),
	];
	const sides = [[corners[0][3], corners[1][0]], [corners[1][3], corners[2][0]], [corners[2][3], corners[3][0]], [corners[3][3], corners[0][0]]];
	return [sides, corners];
}
/** A diamond's outline pushed out by `offset` (Excalidraw puts the top and side corners 1 px past the middle). */
function diamondOutline(el, offset) {
	const tx = Math.floor(el.width / 2) + 1;
	const ry = Math.floor(el.height / 2) + 1;
	const vr = cornerRadius(Math.abs(tx - 0), el.roundness);
	const hr = cornerRadius(Math.abs(ry - 0), el.roundness);
	if (el.roundness?.type == null) {
		const T = [el.x + tx, el.y - offset];
		const R = [el.x + el.width + offset, el.y + ry];
		const B = [el.x + tx, el.y + el.height + offset];
		const L = [el.x - offset, el.y + ry];
		return [[
			[[T[0] + vr, T[1] + hr], [R[0] - vr, R[1] - hr]],
			[[R[0] - vr, R[1] + hr], [B[0] + vr, B[1] - hr]],
			[[B[0] - vr, B[1] - hr], [L[0] + vr, L[1] + hr]],
			[[L[0] + vr, L[1] - hr], [T[0] - vr, T[1] + hr]],
		], []];
	}
	const c = [el.x + el.width / 2, el.y + el.height / 2];
	const T = [el.x + tx, el.y];
	const R = [el.x + el.width, el.y + ry];
	const B = [el.x + tx, el.y + el.height];
	const L = [el.x, el.y + ry];
	const off = [R, B, L, T].map((p) => scale(normalize(sub(p, c)), offset));
	const corners = [
		[[R[0] - vr, R[1] - hr], R, R, [R[0] - vr, R[1] + hr]].map((p) => add(off[0], p)),
		[[B[0] + vr, B[1] - hr], B, B, [B[0] - vr, B[1] - hr]].map((p) => add(off[1], p)),
		[[L[0] + vr, L[1] + hr], L, L, [L[0] + vr, L[1] - hr]].map((p) => add(off[2], p)),
		[[T[0] - vr, T[1] + hr], T, T, [T[0] + vr, T[1] + hr]].map((p) => add(off[3], p)),
	];
	const sides = [[corners[0][3], corners[1][0]], [corners[1][3], corners[2][0]], [corners[2][3], corners[3][0]], [corners[3][3], corners[0][0]]];
	return [sides, corners];
}
function ellipseIntersections(el, offset, [g, h]) {
	const [cx, cy] = [el.x + el.width / 2, el.y + el.height / 2];
	const [rx, ry] = [el.width / 2 + offset, el.height / 2 + offset];
	const [x1, y1, x2, y2] = [g[0] - cx, g[1] - cy, h[0] - cx, h[1] - cy];
	const a = (x2 - x1) ** 2 / rx ** 2 + (y2 - y1) ** 2 / ry ** 2;
	const b = 2 * ((x1 * (x2 - x1)) / rx ** 2 + (y1 * (y2 - y1)) / ry ** 2);
	const c = x1 ** 2 / rx ** 2 + y1 ** 2 / ry ** 2 - 1;
	const root = Math.sqrt(b * b - 4 * a * c);
	return [(-b + root) / (2 * a), (-b - root) / (2 * a)].map((t) => [x1 + t * (x2 - x1) + cx, y1 + t * (y2 - y1) + cy]).filter((p) => !Number.isNaN(p[0]) && !Number.isNaN(p[1]));
}
/** Where a segment crosses a shape's outline pushed out by `offset` (intersectElementWithLineSegment). */
function outlineIntersections(el, segment, offset) {
	if (el.type === "ellipse") return ellipseIntersections(el, offset, segment);
	const [sides, corners] = el.type === "diamond" ? diamondOutline(el, offset) : rectangleOutline(el, offset);
	const hits = [...sides.map((s) => segmentIntersection(segment, s)).filter(Boolean), ...corners.flatMap((c) => curveIntersection(c, segment))];
	return hits.filter((p, i) => hits.findIndex((q) => Math.abs(p[0] - q[0]) < PRECISION && Math.abs(p[1] - q[1]) < PRECISION) === i);
}
/** The end of a bound arrow: where the line from `adjacent` through `through` meets the outline pushed out by GAP. */
function boundEnd(el, adjacent, through) {
	const c = [el.x + el.width / 2, el.y + el.height / 2];
	const length = dist(adjacent, through) + dist(adjacent, c) + Math.max(el.width, el.height) * 2;
	const far = add(adjacent, scale(normalize(sub(through, adjacent)), length));
	const hits = outlineIntersections(el, [adjacent, far], GAP).sort((a, b) => dist2(a, adjacent) - dist2(b, adjacent));
	return hits.length > 1 ? hits[0] : null;
}
// ---------------------------------------------------------------------------------------------------------------
// Elements

const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
/** The n-th fractional index in Excalidraw's sequence: a0 ... az, b00 ... bzz, c000 ... */
export function fractionalIndex(n) {
	let size = 62;
	let digits = 1;
	let head = 0;
	while (n >= size) {
		n -= size;
		digits++;
		head++;
		size *= 62;
	}
	let s = "";
	for (let d = 0; d < digits; d++) {
		s = DIGITS[n % 62] + s;
		n = Math.floor(n / 62);
	}
	return String.fromCharCode(97 + head) + s;
}
/** FNV-1a, 31 bits: seeds and nonces that depend on the element's id only. */
function hash(text) {
	let h = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
	return (h >>> 1) || 1;
}

/** Every field Excalidraw 0.18.1 writes for an element, in its order; `extra` adds the type's own fields. */
function element(id, type, props, extra = {}) {
	return {
		id,
		type,
		x: round2(props.x),
		y: round2(props.y),
		width: round2(props.width),
		height: round2(props.height),
		angle: 0,
		strokeColor: props.strokeColor ?? BLACK,
		backgroundColor: props.backgroundColor ?? "transparent",
		fillStyle: props.fillStyle ?? "solid",
		strokeWidth: props.strokeWidth ?? 2,
		strokeStyle: props.strokeStyle ?? "solid",
		roughness: 1,
		opacity: 100,
		groupIds: props.groupIds ?? [],
		frameId: null,
		index: null, // set in order once every element exists
		roundness: props.roundness ?? null,
		seed: hash(id),
		version: 1,
		versionNonce: hash(`${id}#`),
		isDeleted: false,
		boundElements: props.boundElements ?? [], // Excalidraw loads null as [] and saves [], so write []
		updated: UPDATED,
		link: props.link ?? null,
		locked: false,
		...extra,
	};
}
function textElement(id, text, font, fontSize, box, props = {}) {
	const m = measureText(text, font, fontSize);
	return element(id, "text", { x: box.x, y: box.y, width: m.width, height: m.height, strokeColor: props.color, groupIds: props.groupIds }, {
		text,
		fontSize,
		fontFamily: FONTS[font].family,
		textAlign: props.align ?? "left",
		verticalAlign: props.verticalAlign ?? "top",
		containerId: props.containerId ?? null,
		originalText: text,
		autoResize: true,
		lineHeight: FONTS[font].lineHeight,
	});
}
/** Where Excalidraw puts a centred label in its box (computeBoundTextPosition). */
function labelPosition(box, m) {
	let [x, y, maxW, maxH] = [box.x + BOUND_TEXT_PADDING, box.y + BOUND_TEXT_PADDING, box.width - 2 * BOUND_TEXT_PADDING, box.height - 2 * BOUND_TEXT_PADDING];
	if (box.type === "ellipse") {
		x += (box.width / 2) * (1 - Math.SQRT2 / 2);
		y += (box.height / 2) * (1 - Math.SQRT2 / 2);
		maxW = Math.round((box.width / 2) * Math.SQRT2) - 2 * BOUND_TEXT_PADDING;
		maxH = Math.round((box.height / 2) * Math.SQRT2) - 2 * BOUND_TEXT_PADDING;
	} else if (box.type === "diamond") {
		x += box.width / 4;
		y += box.height / 4;
		maxW = Math.round(box.width / 2) - 2 * BOUND_TEXT_PADDING;
		maxH = Math.round(box.height / 2) - 2 * BOUND_TEXT_PADDING;
	}
	return { x: x + maxW / 2 - m.width / 2, y: y + maxH / 2 - m.height / 2 };
}

const overlaps = (a, b, margin = 0) => a.x < b.x + b.w + margin && b.x < a.x + a.w + margin && a.y < b.y + b.h + margin && b.y < a.y + a.h + margin;
const contains = (outer, inner) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
/** Does the segment p-q pass through the box (shrunk by `inset`)? Liang-Barsky clipping. */
function segmentHitsBox(p, q, box, inset = 2) {
	const [x1, y1, x2, y2] = [box.x + inset, box.y + inset, box.x + box.w - inset, box.y + box.h - inset];
	let [t0, t1] = [0, 1];
	const d = sub(q, p);
	for (const [pp, qq] of [[-d[0], p[0] - x1], [d[0], x2 - p[0]], [-d[1], p[1] - y1], [d[1], y2 - p[1]]]) {
		if (pp === 0) {
			if (qq < 0) return false;
		} else {
			const t = qq / pp;
			if (pp < 0) t0 = Math.max(t0, t);
			else t1 = Math.min(t1, t);
			if (t0 > t1) return false;
		}
	}
	return true;
}

/** Builds the drawing: { scene, warnings, counts }. Throws a DescriptionError for a description it cannot draw. */
export function buildDrawing(input) {
	const desc = readDescription(input);
	const L = layout(desc);
	const warnings = [];
	const fontName = { hand: "Excalifont", normal: "Nunito", code: "Comic Shanns" }[desc.font];
	const texts = [
		...(desc.title ? [["the title", desc.title]] : []),
		...(desc.subtitle ? [["the subtitle", desc.subtitle]] : []),
		...desc.nodes.map((n) => [`node "${n.id}"`, n.label]),
		...desc.edges.filter((e) => e.label).map((e) => [`the label of ${e.from} -> ${e.to}`, e.label]),
		...desc.groups.filter((g) => g.label).map((g) => [`group "${g.id}"`, g.label]),
		...desc.notes.map((n, i) => [`notes[${i}]`, n]),
	];
	for (const [what, text] of texts) {
		const missing = missingGlyphs(text, desc.font);
		const cjk = missing.filter((ch) => isCJK(ch.codePointAt(0)));
		const other = missing.filter((ch) => !cjk.includes(ch));
		if (other.length) warnings.push(`${what}: ${fontName} has no ${other.join(" ")}; Excalidraw draws ${other.length === 1 ? "it" : "them"} in another font. Write words instead (for example "to" for an arrow).`);
		if (cjk.length) warnings.push(`${what}: ${fontName} has no Chinese, Japanese or Korean (${cjk.slice(0, 8).join(" ")}); leave "font" out (Excalifont), next to which excalidraw.com draws them hand-drawn.`);
	}
	const nodeId = (n) => `node-${n.id}`;
	const shapes = new Map(); // node index -> its shape element
	const nodeElements = [];
	const nodeLabels = new Map();

	for (const n of L.nodes) {
		const box = L.nodeBox.get(n.i);
		const colors = n.color === undefined ? { strokeColor: BLACK, backgroundColor: "transparent" }
			: n.color === "white" ? { strokeColor: BLACK, backgroundColor: WHITE }
			: { strokeColor: PALETTE[n.color][4], backgroundColor: PALETTE[n.color][1] };
		const shape = element(nodeId(n), n.shape, {
			x: box.x,
			y: box.y,
			width: box.w,
			height: box.h,
			...colors,
			fillStyle: desc.fill,
			roundness: n.shape === "rectangle" ? { type: 3 } : { type: 2 },
			boundElements: [{ type: "text", id: `label-${n.id}` }],
			link: n.link,
		});
		const m = measureText(n.label, desc.font, n.fontSize);
		const at = labelPosition(shape, m);
		const label = textElement(`label-${n.id}`, n.label, desc.font, n.fontSize, at, { align: "center", verticalAlign: "middle", containerId: shape.id });
		shapes.set(n.i, shape);
		nodeLabels.set(n.i, label);
		nodeElements.push(shape, label);
	}

	// Areas behind the groups: a tinted rectangle and its title (placed once the arrows are known), grouped so they
	// move together.
	const areaElements = [];
	const areaBoxes = [];
	const areaShapes = new Map(); // group id -> its area, for edges that end at a group
	for (const a of L.areas) {
		const c = PALETTE[a.group.color] ?? PALETTE.gray;
		const area = element(`group-${a.group.id}`, "rectangle", {
			x: a.x, y: a.y, width: a.w, height: a.h,
			strokeColor: c[3], backgroundColor: c[0], strokeWidth: 1, strokeStyle: "dashed", roundness: { type: 3 },
			groupIds: a.title ? [`area-${a.group.id}`] : [],
		});
		areaElements.push(area);
		areaShapes.set(a.group.id, area);
		areaBoxes.push({ group: a.group.id, x: a.x, y: a.y, w: a.w, h: a.h, title: null });
	}

	// Arrows: bound at both ends, straight through the boxes' centres (focus 0), or curved through route points.
	const pairs = new Set(L.edges.map((e) => `${e.from}\u0000${e.to}`));
	const edgeElements = [];
	const edgeLabels = [];
	const arrowShapes = [];
	for (const e of L.edges) {
		const id = `edge-${e.i + 1}`;
		const from = e.u !== null ? shapes.get(e.u) : areaShapes.get(e.from);
		const to = e.v !== null ? shapes.get(e.v) : areaShapes.get(e.to);
		let path = L.paths[e.i].map((p) => [...p]);
		// A pair of edges both ways between the same two ends: each arrow arcs out to its own side through a middle
		// point and stays aimed at the centres (focus 0), so the two do not overlap and their labels sit apart.
		if (pairs.has(`${e.to}\u0000${e.from}`)) {
			const forward = e.from < e.to;
			const [a, b] = [path[0], path[path.length - 1]];
			const dir = normalize(forward ? sub(b, a) : sub(a, b));
			const other = L.edges.find((o) => o.from === e.to && o.to === e.from);
			const sizes = [e, other].filter((x) => x.label !== undefined).map((x) => measureText(x.label, desc.font, SIZE.edge));
			const across = Math.abs(dir[0]) >= Math.abs(dir[1]) ? "height" : "width"; // the labels stack across the arrows
			const bulge = Math.max(PAIR_BULGE, ...sizes.map((m) => m[across] / 2 + 8));
			const offset = scale([-dir[1], dir[0]], bulge * (forward ? 1 : -1));
			path = path.length === 2 ? [a, add(scale(add(a, b), 0.5), offset), b] : path.map((p, k) => (k === 0 || k === path.length - 1 ? p : add(p, offset)));
		}
		const start = boundEnd(from, path[1], path[0]);
		const end = boundEnd(to, path[path.length - 2], path[path.length - 1]);
		if (!start || !end) {
			warnings.push(`edges[${e.i}] (${e.from} -> ${e.to}): the two boxes are too close to draw an arrow between them.`);
			continue;
		}
		let pts = [start, ...path.slice(1, -1), end];
		let labelAt = null;
		let m = null;
		if (e.label !== undefined) {
			m = measureText(e.label, desc.font, SIZE.edge);
			if (pts.length === 2) {
				labelAt = freeMidpoint(pts[0], pts[1], m, areaBoxes);
				if (labelAt && dist(labelAt, [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2]) > 0.5) pts = [pts[0], labelAt, pts[1]];
				else labelAt = null;
			} else if (pts.length % 2 === 0) {
				const k = pts.length / 2;
				pts.splice(k, 0, [(pts[k - 1][0] + pts[k][0]) / 2, (pts[k - 1][1] + pts[k][1]) / 2]);
			}
			const mid = pts.length === 2 ? [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2] : pts[(pts.length - 1) / 2];
			labelAt = mid;
		}
		const x0 = round2(pts[0][0]);
		const y0 = round2(pts[0][1]);
		const rel = pts.map((p) => [round2(p[0] - x0), round2(p[1] - y0)]);
		rel[0] = [0, 0];
		const xs = rel.map((p) => p[0]);
		const ys = rel.map((p) => p[1]);
		const color = e.color === undefined || e.color === "white" ? BLACK : PALETTE[e.color][4];
		const arrow = element(id, "arrow", {
			x: x0, y: y0, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys),
			strokeColor: color, strokeStyle: e.style, roundness: { type: 2 },
			boundElements: e.label !== undefined ? [{ type: "text", id: `${id}-label` }] : [],
		}, {
			points: rel,
			lastCommittedPoint: null,
			startBinding: { elementId: from.id, focus: 0, gap: GAP },
			endBinding: { elementId: to.id, focus: 0, gap: GAP },
			startArrowhead: e.arrow === "start" || e.arrow === "both" ? "arrow" : null,
			endArrowhead: e.arrow === "end" || e.arrow === "both" ? "arrow" : null,
			elbowed: false,
		});
		from.boundElements.push({ type: "arrow", id });
		to.boundElements.push({ type: "arrow", id });
		// The size exactly as Excalidraw computes it from the points (getSizeFromPoints), unrounded, so loading the
		// drawing changes nothing.
		arrow.width = Math.max(...xs) - Math.min(...xs);
		arrow.height = Math.max(...ys) - Math.min(...ys);
		edgeElements.push(arrow);
		arrowShapes.push({ e, pts: rel.map((p) => [x0 + p[0], y0 + p[1]]) });
		if (labelAt) {
			const label = textElement(`${id}-label`, e.label, desc.font, SIZE.edge, { x: labelAt[0] - m.width / 2, y: labelAt[1] - m.height / 2 }, {
				align: "center", verticalAlign: "middle", containerId: id,
			});
			edgeElements.push(label);
			edgeLabels.push({ e, box: { x: label.x, y: label.y, w: label.width, h: label.height } });
			const maxWidth = Math.max(0.7 * arrow.width, SIZE.edge * 11);
			if (m.width > maxWidth + 0.5)
				warnings.push(`edges[${e.i}] (${e.from} -> ${e.to}): the label is wider than Excalidraw keeps on one line on this arrow (${Math.floor(maxWidth)} px); it wraps when a connected box moves. Shorten it or put a line break in it.`);
		}
	}

	// Group titles: top left, or top right when an arrow crosses the top left.
	const titleElements = [];
	for (const [k, a] of L.areas.entries()) {
		if (!a.title) continue;
		const c = PALETTE[a.group.color] ?? PALETTE.gray;
		const left = { x: a.x + 20, y: a.y + 16, w: a.title.width, h: a.title.height };
		const right = { ...left, x: a.x + a.w - 20 - a.title.width };
		const crossed = (box) => arrowShapes.some((s) => s.pts.some((p, i) => i + 1 < s.pts.length && segmentHitsBox(p, s.pts[i + 1], box, -6)));
		const box = !crossed(left) || crossed(right) ? left : right;
		titleElements.push(textElement(`group-${a.group.id}-title`, a.group.label, desc.font, a.group.fontSize, box, { color: c[4], groupIds: [`area-${a.group.id}`] }));
		areaBoxes[k].title = box;
	}

	// Title and subtitle above, notes below.
	const boxes = [...L.nodeBox.values()].map((b) => ({ ...b }));
	const all = [...boxes, ...areaBoxes, ...edgeLabels.map((l) => l.box)];
	for (const a of arrowShapes) for (const p of a.pts) all.push({ x: p[0], y: p[1], w: 0, h: 0 });
	const minX = Math.min(...all.map((b) => b.x));
	const minY = Math.min(...all.map((b) => b.y));
	const maxY = Math.max(...all.map((b) => b.y + b.h));
	const headElements = [];
	let headHeight = 0;
	if (desc.title !== undefined) {
		const t = textElement("title", desc.title, desc.font, SIZE.title, { x: 0, y: 0 });
		headElements.push(t);
		headHeight = t.height;
	}
	if (desc.subtitle !== undefined) {
		const s = textElement("subtitle", desc.subtitle, desc.font, SIZE.subtitle, { x: 0, y: headHeight ? headHeight + 8 : 0 }, { color: PALETTE.gray[3] });
		headElements.push(s);
		headHeight = s.y + s.height;
	}
	const top = headHeight ? up(headHeight + 40) : 0;
	const dx = -Math.floor(minX / GRID) * GRID;
	const dy = top - Math.floor(minY / GRID) * GRID;
	const noteElements = [];
	let noteY = up(maxY + dy + 40);
	desc.notes.forEach((text, i) => {
		const n = textElement(`note-${i + 1}`, text, desc.font, SIZE.note, { x: 0, y: noteY }, { color: PALETTE.gray[4] });
		noteElements.push(n);
		noteY += n.height + 12;
	});

	// Move the diagram under the title (whole grid steps, so boxes stay on the grid).
	for (const el of [...areaElements, ...titleElements, ...edgeElements, ...nodeElements]) {
		el.x = round2(el.x + dx);
		el.y = round2(el.y + dy);
	}
	const shift = (b) => ({ ...b, x: b.x + dx, y: b.y + dy });

	const elements = [...headElements, ...areaElements, ...titleElements, ...edgeElements, ...nodeElements, ...noteElements];
	elements.forEach((el, i) => (el.index = fractionalIndex(i)));

	// Self-check: what a reader would see as a mistake.
	const nodeRects = L.nodes.map((n) => ({ n, box: shift(L.nodeBox.get(n.i)) }));
	const labelRects = edgeLabels.map((l) => ({ ...l, box: shift(l.box) }));
	const areaRects = areaBoxes.map((a) => ({ ...a, ...shift(a), title: a.title && shift(a.title) }));
	for (const [i, a] of nodeRects.entries())
		for (const b of nodeRects.slice(i + 1)) if (overlaps(a.box, b.box, 10)) warnings.push(`The boxes "${a.n.id}" and "${b.n.id}" overlap or are less than 10 px apart.`);
	for (const a of arrowShapes) {
		const pts = a.pts.map((p) => [p[0] + dx, p[1] + dy]);
		for (const { n, box } of nodeRects) {
			if (n.i === a.e.u || n.i === a.e.v) continue;
			if (pts.some((p, k) => k + 1 < pts.length && segmentHitsBox(p, pts[k + 1], box)))
				warnings.push(`edges[${a.e.i}] (${a.e.from} -> ${a.e.to}) passes through the box "${n.id}".`);
		}
		for (const ar of areaRects) {
			if (ar.title && pts.some((p, k) => k + 1 < pts.length && segmentHitsBox(p, pts[k + 1], ar.title, -2)))
				warnings.push(`edges[${a.e.i}] (${a.e.from} -> ${a.e.to}) crosses the title of the group "${ar.group}".`);
		}
	}
	for (const [i, l] of labelRects.entries()) {
		for (const { n, box } of nodeRects) if (overlaps(l.box, box, 4)) warnings.push(`The label of edges[${l.e.i}] (${l.e.from} -> ${l.e.to}) touches the box "${n.id}".`);
		for (const o of labelRects.slice(i + 1)) if (overlaps(l.box, o.box, 4)) warnings.push(`The labels of edges[${l.e.i}] and edges[${o.e.i}] overlap.`);
		for (const ar of areaRects) if (ar.title && overlaps(l.box, ar.title, 4)) warnings.push(`The label of edges[${l.e.i}] touches the title of the group "${ar.group}".`);
	}
	for (const [i, ar] of areaRects.entries()) {
		for (const { n, box } of nodeRects) if (n.group !== ar.group && overlaps(ar, box)) warnings.push(`The area of the group "${ar.group}" covers the box "${n.id}", which is not in the group.`);
		for (const o of areaRects.slice(i + 1)) if (overlaps(ar, o) && !contains(ar, o) && !contains(o, ar)) warnings.push(`The areas of the groups "${ar.group}" and "${o.group}" overlap.`);
	}

	const scene = {
		type: "excalidraw",
		version: 2,
		source: SOURCE,
		elements,
		appState: { gridSize: GRID, gridStep: 5, gridModeEnabled: false, viewBackgroundColor: WHITE },
		files: {},
	};
	const xsAll = elements.flatMap((el) => (el.points ? el.points.map((p) => el.x + p[0]) : [el.x, el.x + el.width]));
	const ysAll = elements.flatMap((el) => (el.points ? el.points.map((p) => el.y + p[1]) : [el.y, el.y + el.height]));
	const counts = {
		elements: elements.length,
		boxes: nodeElements.length / 2,
		arrows: edgeElements.filter((el) => el.type === "arrow").length,
		areas: L.areas.length,
		width: Math.round(Math.max(...xsAll) - Math.min(...xsAll)),
		height: Math.round(Math.max(...ysAll) - Math.min(...ysAll)),
	};
	return { scene, warnings: [...new Set(warnings)], counts };
}
/**
 * Where a straight arrow's label goes: the middle of the arrow, or the middle of its longest stretch outside the
 * group areas it only passes into, so the label stays clear of the areas' titles.
 */
function freeMidpoint(p, q, m, areas) {
	const len = dist(p, q);
	const cuts = [0, 1];
	for (const a of areas) {
		const box = { x: a.x, y: a.y, w: a.w, h: a.h };
		const inP = p[0] >= box.x && p[0] <= box.x + box.w && p[1] >= box.y && p[1] <= box.y + box.h;
		const inQ = q[0] >= box.x && q[0] <= box.x + box.w && q[1] >= box.y && q[1] <= box.y + box.h;
		if (inP === inQ) continue;
		const d = sub(q, p);
		for (const [t, ok] of [[(box.x - p[0]) / d[0], d[0] !== 0], [(box.x + box.w - p[0]) / d[0], d[0] !== 0], [(box.y - p[1]) / d[1], d[1] !== 0], [(box.y + box.h - p[1]) / d[1], d[1] !== 0]]) {
			if (!ok || t <= 0 || t >= 1) continue;
			const at = add(p, scale(d, t));
			if (at[0] >= box.x - 0.01 && at[0] <= box.x + box.w + 0.01 && at[1] >= box.y - 0.01 && at[1] <= box.y + box.h + 0.01) cuts.push(t);
		}
	}
	cuts.sort((a, b) => a - b);
	const inside = (t) => {
		const at = add(p, scale(sub(q, p), t));
		return areas.some((a) => {
			const inA = at[0] > a.x && at[0] < a.x + a.w && at[1] > a.y && at[1] < a.y + a.h;
			const inP = p[0] >= a.x && p[0] <= a.x + a.w && p[1] >= a.y && p[1] <= a.y + a.h;
			const inQ = q[0] >= a.x && q[0] <= a.x + a.w && q[1] >= a.y && q[1] <= a.y + a.h;
			return inA && inP !== inQ;
		});
	};
	let bestSpan = null;
	for (let k = 0; k + 1 < cuts.length; k++) {
		const [a, b] = [cuts[k], cuts[k + 1]];
		if (b - a < 1e-6 || inside((a + b) / 2)) continue;
		if (!bestSpan || b - a > bestSpan[1] - bestSpan[0]) bestSpan = [a, b];
	}
	if (!bestSpan || (bestSpan[0] === 0 && bestSpan[1] === 1)) return null;
	const across = Math.abs(q[0] - p[0]) > Math.abs(q[1] - p[1]) ? m.width : m.height;
	if ((bestSpan[1] - bestSpan[0]) * len < across + 8) return null;
	return add(p, scale(sub(q, p), (bestSpan[0] + bestSpan[1]) / 2));
}

// ---------------------------------------------------------------------------------------------------------------
// Command line

const USAGE = `make-drawing ${VERSION}: builds an Excalidraw drawing from a JSON description of boxes and arrows

usage: node make-drawing.mjs <description.json | -> -o <drawing.excalidraw> [--force]
       node make-drawing.mjs <description.json | -> --stdout
       node make-drawing.mjs --measure <text> [--font hand | normal | code] [--size 16 | 20 | 28 | 36]

  -          read the description from standard input
  -o <file>  write the drawing there (the folder must exist; an existing file is kept unless --force)
  --force    replace an existing file
  --stdout   print the drawing instead of writing a file (messages go to standard error)
  --measure  print the width and height Excalidraw gives a text element ("\n" for a line break), and the
             smallest rectangle, ellipse and diamond that hold it as a label (default: hand, 20)

The description is one JSON object (SKILL.md, "The diagram description", explains every key):
  {"title": "...", "subtitle": "...", "layout": "down" | "right" | "manual", "font": "hand" | "normal" | "code",
   "fill": "solid" | "hachure" | "cross-hatch",
   "nodes": [{"id": "api", "label": "API", "shape": "rectangle" | "ellipse" | "diamond", "color": "blue",
              "group": "backend", "link": "[[API notes]]", "fontSize": 16 | 20 | 28 | 36,
              "x": 0, "y": 0, "width": 160, "height": 80}],
   "edges": [{"from": "api", "to": "db", "label": "SQL", "style": "solid" | "dashed" | "dotted",
              "arrow": "end" | "start" | "both" | "none", "color": "red"}],
   "groups": [{"id": "backend", "label": "Backend", "color": "gray", "fontSize": 20}],
   "notes": ["A line of text under the diagram."]}
Only "nodes" (each with "id" and "label") is required. "x" and "y" (a box's top-left corner) go with
"layout": "manual", which also lets an edge end at a group. Colours: ${COLORS.join(", ")}.

Exit status: 0 written (read the warnings it prints), 1 a problem in the description (nothing written),
2 a bad command line or a path that cannot be read or written.`;

function fail(code, message) {
	process.stderr.write(`make-drawing: ${message}\n`);
	return code;
}

/** --measure: a text element's size, and the smallest boxes that hold it as a label. */
function measureCommand(argv) {
	let text = null;
	let font = "hand";
	let size = SIZE.node;
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--measure") text = argv[++i];
		else if (argv[i] === "--font") font = argv[++i];
		else if (argv[i] === "--size") size = Number(argv[++i]);
		else return fail(2, `unknown argument ${argv[i]} with --measure`);
	}
	if (text === undefined || text === null) return fail(2, "--measure needs a text.");
	if (!FONTS[font]) return fail(2, `--font must be one of ${Object.keys(FONTS).join(", ")}.`);
	if (!FONT_SIZES.includes(size)) return fail(2, `--size must be one of ${FONT_SIZES.join(", ")}.`);
	text = text.replace(/\\n/g, "\n");
	const m = measureText(text, font, size);
	const boxes = SHAPES.map((shape) => `${shape} ${shapeSize(shape, m, 0).join(" x ")}`).join(", ");
	process.stdout.write(`text ${m.width} x ${m.height} (${m.lines} line${m.lines === 1 ? "" : "s"}, fontFamily ${FONTS[font].family}, fontSize ${size}, lineHeight ${FONTS[font].lineHeight})\n`);
	process.stdout.write(`smallest label boxes: ${boxes}\n`);
	const missing = missingGlyphs(text, font);
	if (missing.length) process.stdout.write(`warning: the font has no ${missing.join(" ")}; Excalidraw draws ${missing.length === 1 ? "it" : "them"} in another font.\n`);
	return 0;
}

function main(argv) {
	if (argv.includes("--measure")) return measureCommand(argv);
	let input = null;
	let output = null;
	let force = false;
	let toStdout = false;
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--help" || a === "-h") {
			process.stdout.write(`${USAGE}\n`);
			return 0;
		}
		if (a === "--version") {
			process.stdout.write(`${VERSION}\n`);
			return 0;
		}
		if (a === "-o" || a === "--output") {
			output = argv[++i];
			if (output === undefined) return fail(2, `${a} needs a file name.\n\n${USAGE}`);
		} else if (a === "--force") force = true;
		else if (a === "--stdout") toStdout = true;
		else if (a.startsWith("-") && a !== "-") return fail(2, `unknown option ${a}\n\n${USAGE}`);
		else if (input === null) input = a;
		else return fail(2, `one description at a time (got "${input}" and "${a}").\n\n${USAGE}`);
	}
	if (input === null) return fail(2, `give a description file, or - for standard input.\n\n${USAGE}`);
	if ((output === null) === !toStdout) return fail(2, `give either -o <file> or --stdout.\n\n${USAGE}`);
	if (output !== null && !/\.excalidraw$/i.test(output)) return fail(2, `the output file's name must end in .excalidraw (got "${output}").`);

	let text;
	try {
		text = input === "-" ? readFileSync(0, "utf8") : readFileSync(input, "utf8");
	} catch (e) {
		return fail(2, `${input === "-" ? "standard input" : input}: cannot be read (${e.message}).`);
	}
	let description;
	try {
		description = JSON.parse(text);
	} catch (e) {
		return fail(1, `the description is not valid JSON: ${e.message}.`);
	}
	let result;
	try {
		result = buildDrawing(description);
	} catch (e) {
		if (!(e instanceof DescriptionError)) throw e;
		process.stderr.write(`make-drawing: the description has ${e.problems.length} problem${e.problems.length === 1 ? "" : "s"}; nothing was written.\n`);
		for (const p of e.problems) process.stderr.write(`  ${p}\n`);
		return 1;
	}
	const json = JSON.stringify(result.scene, null, 2);
	const c = result.counts;
	const summary = `${c.elements} elements (${c.boxes} box${c.boxes === 1 ? "" : "es"}, ${c.arrows} arrow${c.arrows === 1 ? "" : "s"}${c.areas ? `, ${c.areas} area${c.areas === 1 ? "" : "s"}` : ""}), ${c.width} x ${c.height} px`;
	const log = toStdout ? (s) => process.stderr.write(`${s}\n`) : (s) => process.stdout.write(`${s}\n`);
	if (toStdout) process.stdout.write(json);
	else {
		const path = resolve(output);
		const folder = dirname(path);
		if (!existsSync(folder) || !statSync(folder).isDirectory()) return fail(2, `the folder ${folder} does not exist (create it first).`);
		if (existsSync(path) && !force) return fail(2, `${path} exists; nothing was written. Use --force to replace it, or choose another name.`);
		try {
			writeFileSync(path, json);
		} catch (e) {
			return fail(2, `${path}: cannot be written (${e.message}).`);
		}
		log(`Wrote ${path}: ${summary}.`);
	}
	if (toStdout) log(`Drawing: ${summary}.`);
	for (const w of result.warnings) log(`warning: ${w}`);
	return 0;
}

const invokedAsScript = (() => {
	try {
		return realpathSync(process.argv[1] ?? "") === realpathSync(fileURLToPath(import.meta.url));
	} catch {
		return false;
	}
})();
if (invokedAsScript) process.exitCode = main(process.argv.slice(2));
