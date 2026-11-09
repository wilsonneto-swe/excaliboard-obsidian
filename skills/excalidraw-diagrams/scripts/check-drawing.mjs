#!/usr/bin/env node
// check-drawing 1.0.0: reads Excalidraw drawings (.excalidraw files) the way Excaliboard does and reports what would
// make one open read-only, what Excalidraw 0.18.1 would drop, change or draw wrong when it loads it, and the
// mistakes that break a drawing quietly (labels and arrows whose two sides disagree, missing image files, duplicate
// ids, fonts it does not have). Part of the excalidraw-diagrams agent skill (Excaliboard). One file, Node 18 or
// later, no dependencies. It never writes. Run: node check-drawing.mjs --help
import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const VERSION = "1.0.0";

// ---------------------------------------------------------------------------------------------------------------
// What Excalidraw 0.18.1 knows (data/restore.ts, constants.ts, element/types.ts)

/** The element types restoreElement keeps; it drops every other type ("draw" becomes "line"). */
const KEPT_TYPES = new Set(["text", "freedraw", "image", "line", "draw", "arrow", "ellipse", "rectangle", "diamond", "iframe", "embeddable", "magicframe", "frame"]);
const LINEAR = new Set(["arrow", "line"]);
const CONTAINERS = new Set(["rectangle", "ellipse", "diamond", "arrow"]);
const FONT_NAMES = { 1: "Virgil", 2: "Helvetica", 3: "Cascadia", 5: "Excalifont", 6: "Nunito", 7: "Lilita One", 8: "Comic Shanns", 9: "Liberation Sans" };
const FONTS_TO_WRITE = new Set([5, 6, 8]);
const LINE_HEIGHTS = { 1: 1.25, 2: 1.15, 3: 1.2, 5: 1.25, 6: 1.35, 7: 1.15, 8: 1.25, 9: 1.15 };
const FILL_STYLES = ["hachure", "cross-hatch", "solid", "zigzag"];
const STROKE_STYLES = ["solid", "dashed", "dotted"];
const ARROWHEADS = ["arrow", "bar", "dot", "circle", "circle_outline", "triangle", "triangle_outline", "diamond", "diamond_outline", "crowfoot_one", "crowfoot_many", "crowfoot_one_or_many"];
const IMAGE_TYPES = ["image/svg+xml", "image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp", "image/x-icon", "image/avif", "image/jfif"];
const BOUND_TEXT_PADDING = 5;
const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Advance widths of Excalidraw's three text fonts (as in make-drawing.mjs): thousandths of an em, base 36. */
const WIDTH_TABLES = {
	5: "w:b4,8q,ab,lr,k1,ps,jy,62,c9,b6,el,fa,75,bf,7m,fl,ig,bv,jg,gw,g9,h6,hs,fi,ho,hh,7c,8a,fa,fa,fa,cy,n1,is,l5,hh,lo,jn,id,lo,fx,f5,ft,h1,f3,la,hk,lb,je,lc,kg,ha,nt,ka,gg,lu,hg,fo,n4,d4,gd,dt,e6,im,go,g0,ff,e0,gt,ex,dt,ff,fr,6s,94,et,69,if,em,go,ex,ez,bg,f3,fd,f8,el,j9,gf,eq,fw,e0,8b,f4,il;4g:b4,82,dl,jq,,i8,8b,,go,nu,bq,i1,,j8,i2,go,bg,fa,,,go,,hv,5k,go,,bq,ik,l6,l6,o4,cn,is,is,is,is,is,is,sk,hh,jn,jn,jn,jn,f5,f5,f5,f5,mn,hk,lb,lb,lb,lb,lb,fa,lg,ka,ka,ka,ka,fo,iu,fx,f2,f2,f2,f2,f2,f2,p9,e0,fb,fb,fb,fb,6s,6s,6s,6s,ea,em,fl,fl,fl,fl,fl,fa,h5,e4,e4,e4,e4,ei,fs,ei,is,f2,is,f2,is,f2,hh,e0,hh,e0,hh,e0,hh,e0,lo,gt,mn,h3,jn,fb,jn,fb,jn,fb,jn,fb,jn,fb,lo,ff,lo,ff,lo,ff,lo,ff,fx,fr,ig,h9,f5,6s,f5,6s,f5,6s,f5,6s,f5,6s,p5,fw,ft,94,h1,et,,f3,69,f3,69,f3,69,f3,97,hi,bc,hk,em,hk,em,hk,em,fx,,,lb,fl,lb,fl,lb,fl,xm,pk,kg,bg,kg,bg,kg,bg,ha,f3,ha,f3,ha,f3,ha,f3,nt,fd,nt,fd,nt,gw,ka,e4,ka,e4,ka,e4,ka,e4,ka,e4,ka,f8,lu,j9,fo,ei,fo,n4,fw,n4,fw,n4,fw,;6c3:ji,pz;6c8:7f,8g,6n;6cc:bg,bw,bw;6ci:ei;6cm:jp;6mo:,,,;6gc:jt;6jm:sk;6qa:fa;ou:8a,,,,,,7a,il,in,5k,mv,ie,ig,,ni,,os,lt,8d,is,l5,fi,,jn,n4,fx,ks,f5,h1,hx,la,hk,gs,lb,ga,je,,k3,nt,jm,j9,hg,i1,,f5,jm,fz,da,cw,8d,ea,fz,g2,da,fc,da,bz,cw,g9,8d,en,df,eo,d9,d2,ew,gn,eg,bf,ec,db,ea,hv,di,gt,j8,8d,ea,ew,ea,j8,h1,,,,,,,,fq;sg:jn,jn,ka,fi,i9,ha,f5,f5,ft,sl,on,ko,h1,h8,g6,gv,is,hp,l5,fi,kp,jn,n5,hk,h8,h8,h1,ii,la,fx,lb,ga,je,hh,nt,g6,j9,hg,gv,gf,lp,m0,j3,lx,hp,i2,oc,hs,g0,fx,e9,bn,fd,ex,i0,e5,eq,eq,ep,f8,gj,f1,go,fb,ex,e0,dl,eq,gq,gf,e2,e4,i5,io,gm,jf,e5,ez,kn,fe,fb,fb,gs,bn,f3,f3,6s,6s,94,me,kj,h9,ep,eq,ei,e9,,,ls,hs,,,,,,,,,,,,,,,lb,go,gx,er,,,,,,,,,,,,,,,,,,,,,,,,,,,fi,c8,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,i9,f4,,,,,,,,,h8,eq,,,lb,go,lb,go,,,,,g6,eq",
	6: "w:79,6h,b9,go,go,px,jh,6a,92,92,cj,go,6h,bv,6h,82,go,go,go,go,go,go,go,go,go,go,6h,6h,go,go,go,cf,qb,kd,iv,ir,kr,ga,fb,k9,l8,7a,97,hm,f8,nu,kl,lf,hp,lf,ip,h6,gv,kb,ja,uo,i7,gp,gh,90,82,90,go,dw,a1,et,gb,cx,gb,eu,9g,ge,fw,6l,6p,e4,8d,nx,fw,fk,gb,gb,a5,df,9y,fp,ee,ng,eq,ed,cy,a1,7i,a1,go;4g:79,6h,go,go,go,go,7i,fb,da,mn,96,cl,go,bv,mn,e3,ad,go,ak,ak,a1,go,gk,6h,bb,ak,9i,cl,oy,q6,oy,cf,kd,kd,kd,kd,kd,kd,rc,ir,ga,ga,ga,ga,7a,7a,7a,7a,kr,kl,lf,lf,lf,lf,lf,go,lf,kb,kb,kb,kb,gp,hr,hc,et,et,et,et,et,et,ny,cx,eu,eu,eu,eu,6l,6l,6l,6l,fp,fw,fk,fk,fk,fk,fk,go,fk,fp,fp,fp,fp,ed,gb,ed,kd,et,kd,et,kd,et,ir,cx,ir,cx,ir,cx,ir,cx,kr,gb,kr,gb,ga,eu,ga,eu,ga,eu,ga,eu,ga,eu,k9,ge,k9,ge,k9,ge,k9,ge,l8,fw,ma,fw,7a,6l,7a,6l,7a,6l,7a,6l,7a,6l,gh,,97,6p,hm,e4,e4,f8,8d,f8,8d,f8,8d,f8,9h,f8,8d,kl,fw,kl,fw,kl,fw,fw,kl,fw,lf,fk,lf,fk,lf,fk,t5,pb,ip,a5,ip,a5,ip,a5,h6,df,h6,df,h6,df,h6,df,gv,9y,gv,9y,gv,9y,kb,fp,kb,fp,kb,fp,kb,fp,kb,fp,kb,fp,uo,ng,gp,ed,gp,gh,cy,gh,cy,gh,cy,;6c3:dw,rs;6c8:6h,6h,6h;6cc:b9,b9,b9;6ci:ek;6cm:jg;6mo:,,,;6gc:go;6jm:pv;6qa:go;sg:ga,ga,nk,f6,ir,h6,7a,7a,97,ve,wd,no,i1,kl,hz,l2,kd,if,iv,f6,lr,ga,r7,hr,kl,kl,i1,kn,nu,l8,lf,l2,hp,ir,gv,hz,nq,i7,m4,iw,td,ue,m2,o1,if,ir,sd,iq,f4,fv,fc,c8,gm,f5,m2,dy,gc,gc,eu,g3,ih,gg,fv,gd,gm,d8,ci,eo,mc,f0,gr,fh,mf,n5,h7,kk,f1,dr,lo,f4,f5,f5,g7,c8,ds,dp,6w,6w,70,o7,ol,g7,eu,gc,eo,gd,,,k9,h7,,,,,,,qw,m2,,,,,,,lg,fv,kt,ff,,,,,,,,,,,,,,,,,,,,,l5,h2,jz,h7,hq,gl,f6,c8,g7,ct,is,fh,rg,na,hr,dy,ia,fy,j0,fw,j6,ev,lo,h0,mc,h6,q0,kr,,,mp,i6,ir,d4,g9,ci,gp,ef,gp,ef,ih,fk,pr,jg,k1,g7,iw,g0,iw,g7,pw,ho,pw,ho,7a,r7,m2,is,f7,l7,gt,l8,gg,lr,h6,j5,fh,oe,j7,6w,kd,f4,kd,f4,rc,o8,ga,f5,lg,f6,lg,f6,r7,m2,hr,dy,hr,dw,kl,gc,kl,gc,lf,fv,lg,fv,lg,fv,ir,dr,hz,eo,hz,eo,hz,eo,iw,fh,f6,c8,o1,kk,g7,ct,i7,f0,i7,f0",
	8: "w:fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa;4g:,fa,fa,fa,fa,fa,fa,,fa,,,fa,fa,,,fa,fa,fa,,,fa,,,,fa,,,fa,fa,,,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,,fa,fa,fa,fa,fa,fa,fa,,fa,fa,fa,fa,fa,fa,,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,f0,f0,f0,f0,,go,fa,fa,fa,fa,fa,fa,,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,,,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,,,fa,f0,fa,f0,fa,f0,fa,fa,fa,fa,,,fa,fa,fa,fa,,fa,fa,fa,fa,,,,,f8,f8,fa,go,fa,go,fa,go,,,,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,,,fa,fa,,,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa,fa;6c3:fa,fa;6c8:fa,fa,fa;6cc:fa,fa,;6ci:fa;6cm:fa;6mo:fa,fa,fa,fa;6gc:fa;6jm:;6qa:fa;qj:f3",
};
const widthMaps = new Map();
function widthMap(family) {
	if (!WIDTH_TABLES[family]) return null;
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
/**
 * Chinese, Japanese and Korean (Hangul, CJK, kana, fullwidth forms). Excalidraw 0.18.1 draws them in Xiaolai, the
 * hand-drawn font it pairs with Excalifont (5) only (getFontFamilyFallbacks); Excaliboard leaves Xiaolai out (12 MB),
 * so there a system font draws them. Either way, Excalifont is the best font for them: not reported there.
 */
const CJK = [[0x1100, 0x11ff], [0x2e80, 0x9fff], [0xa960, 0xa97f], [0xac00, 0xd7ff], [0xf900, 0xfaff], [0xfe10, 0xfe4f], [0xff00, 0xffef], [0x20000, 0x3ffff]];
const isCJK = (cp) => CJK.some(([a, b]) => cp >= a && cp <= b);

/** The width Excalidraw would measure for a text in fonts 5, 6 and 8 (null for the others). */
function textWidth(text, family, fontSize) {
	const map = widthMap(family);
	if (!map) return null;
	let width = 0;
	for (const line of text.replace(/\r\n?/g, "\n").replace(/\t/g, "        ").split("\n")) {
		let w = 0;
		for (const ch of line || " ") {
			const cp = ch.codePointAt(0);
			w += map.get(cp) ?? (cp >= 0x2e80 ? 1 : 0.6);
		}
		width = Math.max(width, w * fontSize);
	}
	return width;
}

/** A key of the fractional-indexing library Excalidraw orders elements with (validateOrderKey). */
function isOrderKey(key) {
	if (typeof key !== "string" || key === "" || key === `A${"0".repeat(26)}`) return false;
	for (const ch of key) if (!DIGITS.includes(ch)) return false;
	const head = key[0];
	const intLength = head >= "a" && head <= "z" ? head.charCodeAt(0) - 95 : head >= "A" && head <= "Z" ? 92 - head.charCodeAt(0) : 0;
	if (intLength === 0 || intLength > key.length) return false;
	return key.length === intLength || key[key.length - 1] !== "0";
}

// ---------------------------------------------------------------------------------------------------------------
// The check

const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isInt = (v) => Number.isInteger(v);
const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const q = (s) => JSON.stringify(s);

/**
 * Checks one drawing's text. Returns { readOnly, summary, issues, elements } where each issue is
 * { level: "error" | "warning", code, at, message } and `at` names the element ("#3 "id" (type)") or is null.
 */
export function checkDrawing(text) {
	const issues = [];
	const add = (level, code, at, message) => issues.push({ level, code, at, message });
	const result = { readOnly: null, summary: null, issues, elements: [] };

	// PARSE, exactly as Excaliboard's parseScene: anything else opens read-only.
	if (text.trim() === "") {
		add("warning", "empty-file", null, "The file is empty: Excaliboard opens it as a new, empty drawing (and excalidraw.com does not open it at all).");
		result.summary = { elements: 0, visible: 0, deleted: 0, byType: {}, files: 0, extent: null };
		return result;
	}
	// Obsidian drops a leading byte order mark before Excaliboard reads the text.
	if (text.charCodeAt(0) === 0xfeff) {
		text = text.slice(1);
		add("warning", "bom", null, "The file starts with a byte order mark (U+FEFF). Obsidian and excalidraw.com ignore it, but write UTF-8 without one.");
	}
	let data;
	try {
		data = JSON.parse(text);
	} catch (e) {
		return readOnly(result, "invalid-json", `Invalid JSON: ${e.message}.`);
	}
	if (!isObject(data) || data.type !== "excalidraw") return readOnly(result, "not-a-scene", 'Not an Excalidraw scene: "type" is not "excalidraw".');
	const elements = data.elements ?? [];
	if (!Array.isArray(elements)) return readOnly(result, "elements-not-array", '"elements" is not an array.');
	const bad = elements.findIndex((el) => !isObject(el) || typeof el.id !== "string" || typeof el.type !== "string");
	if (bad >= 0) return readOnly(result, "element-without-id-or-type", "An element has no id or type.", ` (element #${bad + 1} in "elements")`);
	if (data.files !== undefined && !isObject(data.files)) return readOnly(result, "files-not-object", '"files" is not an object.');
	const files = data.files ?? {};

	const at = (i) => `#${i + 1} ${q(elements[i].id)} (${elements[i].type})`;
	const byId = new Map();
	elements.forEach((el, i) => {
		if (!byId.has(el.id)) byId.set(el.id, i);
	});
	const live = (el) => el.isDeleted !== true;

	// LOAD, as Excaliboard's checkScene and Excalidraw's restoreElements: unsupported types, crashes, drops.
	const lost = new Map();
	const crash = (i, why) => {
		result.readOnly ??= `Excalidraw cannot load it: ${why}.`;
		add("error", "load-error", at(i), `Excalidraw 0.18.1 fails to load the drawing here (${why}), so Excaliboard opens it read-only.`);
	};
	const editorCrash = (i, why) => add("error", "load-error", at(i), `Excalidraw fails while it loads the drawing into the editor (${why}).`);
	const dropped = new Set();
	elements.forEach((el, i) => {
		if (el.type === "selection") {
			add("warning", "dropped-on-load", at(i), 'A "selection" element: Excalidraw drops it when it loads the drawing.');
			dropped.add(i);
			return;
		}
		const linearLike = LINEAR.has(el.type) || el.type === "freedraw";
		if (linearLike && (el.points === undefined || el.points === null)) return crash(i, `${el.type} without "points"`);
		const small = linearLike ? !(el.points?.length >= 2) : el.width === 0 && el.height === 0;
		if (!KEPT_TYPES.has(el.type)) {
			dropped.add(i);
			if (!live(el) || small) return;
			lost.set(el.type, (lost.get(el.type) ?? 0) + 1);
			return;
		}
		if (small) {
			dropped.add(i);
			if (live(el)) add("warning", "dropped-on-load", at(i), `${linearLike ? "Fewer than 2 points" : "Width and height are 0"}: Excalidraw drops this invisible element when it loads the drawing.`);
			return;
		}
		if (LINEAR.has(el.type) && Array.isArray(el.points) && el.points.length >= 2 && el.points.some((p) => !Array.isArray(p)))
			return crash(i, "one of its points is null");
		if (el.type === "text") {
			if ("font" in el && typeof el.font !== "string") return crash(i, 'a "font" that is not a string');
			if (typeof el.text !== "string" && !el.lineHeight && el.height) return crash(i, '"text" is not a string');
		}
		if (el.boundElementIds && !Array.isArray(el.boundElementIds)) return crash(i, '"boundElementIds" is not an array');
		if (el.link && typeof el.link !== "string") return crash(i, '"link" is not a string');
		if (el.boundElements && !Array.isArray(el.boundElements)) return editorCrash(i, '"boundElements" is not an array');
		if (Array.isArray(el.boundElements) && el.boundElements.some((b) => !isObject(b))) return editorCrash(i, 'an entry of "boundElements" is not an object');
	});
	if (lost.size) {
		const count = [...lost.values()].reduce((a, b) => a + b, 0);
		const types = [...lost.keys()].map((t) => `"${t}"`).join(", ");
		result.readOnly = `It has ${count} element(s) of type ${types} that this Excalidraw version does not support.`;
		add("error", "unsupported-type", null, `Excaliboard opens it read-only: ${result.readOnly} (Excalidraw 0.18.1 keeps only ${[...KEPT_TYPES].filter((t) => t !== "draw").join(", ")}; excalidraw.com's newer "stickynote" is not one of them.)`);
	}

	// Ids, and the fractional indexes Excalidraw orders elements by.
	const seenIds = new Map();
	elements.forEach((el, i) => {
		if (el.id === "") add("error", "bad-field", at(i), "An empty id.");
		if (seenIds.has(el.id)) add("error", "duplicate-id", at(i), `The same id as element #${seenIds.get(el.id) + 1}: Excalidraw gives this one a new random id when it loads the drawing, so labels and arrows that point to it lose it.`);
		else seenIds.set(el.id, i);
	});
	// (Elements dropped on load don't count; deleted ones leave the file at the next save.)
	const ordered = elements.map((el, i) => [el.index, i]).filter(([, i]) => !dropped.has(i) && KEPT_TYPES.has(elements[i].type));
	const withIndex = ordered.filter(([index]) => index !== undefined && index !== null);
	for (const [index, i] of withIndex) {
		if (!isOrderKey(index)) add("error", "bad-index", at(i), `"index" ${q(index)} is not a fractional index (a0, a1, ..., aZ, az, b00, ...): Excalidraw fails when it has to place an element next to it. Use valid indexes in order, or leave "index" out of every element.`);
	}
	const unindexed = ordered.filter(([index, i]) => (index === undefined || index === null) && live(elements[i])).length;
	if (withIndex.length && unindexed)
		add("warning", "index-missing", null, `${plural(unindexed, "element has", "elements have")} no "index" while the others have one: Excalidraw gives them one when it loads the drawing.`);
	const valid = withIndex.filter(([index]) => isOrderKey(index));
	for (let k = 1; k < valid.length; k++) {
		if (!(valid[k - 1][0] < valid[k][0])) {
			add("warning", "index-order", at(valid[k][1]), `"index" ${q(valid[k][0])} is not after ${q(valid[k - 1][0])} (element #${valid[k - 1][1] + 1}): elements are drawn in array order and indexes must grow with it; Excalidraw renumbers the ones out of order when it loads the drawing.`);
			break;
		}
	}

	// Fields, element by element.
	const missingByElement = [];
	let newerBindings = 0;
	const fontUse = new Map();
	const glyphs = new Map();
	elements.forEach((el, i) => {
		if (!live(el) || dropped.has(i) || !KEPT_TYPES.has(el.type)) return;
		const missing = [];
		const need = (key, check, what, { required = false } = {}) => {
			if (!(key in el) || el[key] === undefined) {
				if (required) add("error", "missing-field", at(i), `No ${q(key)} (${what}).`);
				else missing.push(key);
				return false;
			}
			if (!check(el[key])) {
				add("error", "bad-field", at(i), `${q(key)} is ${q(el[key])}; it must be ${what}.`);
				return false;
			}
			return true;
		};
		const linear = LINEAR.has(el.type) || el.type === "freedraw";
		need("x", isNum, "a number", { required: true });
		need("y", isNum, "a number", { required: true });
		need("width", isNum, "a number", { required: !linear });
		need("height", isNum, "a number", { required: !linear });
		need("angle", isNum, "a number of radians");
		need("strokeColor", (v) => typeof v === "string" && v !== "", "a colour such as \"#1e1e1e\"");
		need("backgroundColor", (v) => typeof v === "string" && v !== "", "a colour such as \"transparent\" or \"#a5d8ff\"");
		if (need("fillStyle", (v) => typeof v === "string", "a string") && !FILL_STYLES.includes(el.fillStyle))
			add("warning", "style", at(i), `"fillStyle" ${q(el.fillStyle)} is not one of ${FILL_STYLES.join(", ")}: it is drawn as hachure.`);
		need("strokeWidth", (v) => isNum(v) && v > 0, "a positive number (1, 2 or 4 in Excalidraw's menu)");
		if (need("strokeStyle", (v) => typeof v === "string", "a string") && !STROKE_STYLES.includes(el.strokeStyle))
			add("warning", "style", at(i), `"strokeStyle" ${q(el.strokeStyle)} is not one of ${STROKE_STYLES.join(", ")}: it is drawn solid.`);
		need("roughness", isNum, "a number (0, 1 or 2)");
		if (need("opacity", isNum, "a number from 0 to 100") && (el.opacity < 0 || el.opacity > 100)) add("warning", "style", at(i), `"opacity" ${el.opacity} is outside 0-100.`);
		need("groupIds", (v) => Array.isArray(v) && v.every((g) => typeof g === "string"), "an array of group ids");
		need("frameId", (v) => v === null || typeof v === "string", "null or a frame's id");
		need("roundness", (v) => v === null || (isObject(v) && [1, 2, 3].includes(v.type)), "null or {\"type\": 1, 2 or 3}");
		need("seed", isInt, "an integer");
		need("version", (v) => isInt(v) && v >= 1, "an integer from 1");
		need("versionNonce", isInt, "an integer");
		need("isDeleted", (v) => typeof v === "boolean", "true or false (a string such as \"false\" counts as deleted)");
		need("boundElements", (v) => v === null || (Array.isArray(v) && v.every((b) => isObject(b) && typeof b.id === "string" && (b.type === "text" || b.type === "arrow"))), "null or an array of {\"id\", \"type\": \"text\" or \"arrow\"}");
		need("updated", isNum, "a time in milliseconds");
		need("link", (v) => v === null || typeof v === "string", "null or a string");
		need("locked", (v) => typeof v === "boolean", "true or false");
		if (!linear && ((isNum(el.width) && el.width < 0) || (isNum(el.height) && el.height < 0)))
			add("warning", "negative-size", at(i), "A negative width or height: Excalidraw makes it positive and moves x and y when it loads the drawing.");

		if (el.type === "text") {
			const hasText = need("text", (v) => typeof v === "string", "the text shown", { required: true });
			need("originalText", (v) => typeof v === "string", "the text as written (before Excalidraw wraps it in its box)");
			need("fontSize", (v) => isNum(v) && v > 0, "a positive number (16, 20, 28 or 36 in Excalidraw's menu)", { required: true });
			if (!("fontFamily" in el)) add("error", "font", at(i), 'No "fontFamily": write 5 (Excalifont), 6 (Nunito) or 8 (Comic Shanns).');
			else if (!FONT_NAMES[el.fontFamily]) add("error", "font", at(i), `"fontFamily" ${q(el.fontFamily)} is not a font of Excalidraw 0.18.1: the text is drawn in a fallback font. Write 5 (Excalifont), 6 (Nunito) or 8 (Comic Shanns).`);
			else if (!FONTS_TO_WRITE.has(el.fontFamily)) fontUse.set(el.fontFamily, (fontUse.get(el.fontFamily) ?? 0) + 1);
			need("textAlign", (v) => ["left", "center", "right"].includes(v), '"left", "center" or "right"');
			need("verticalAlign", (v) => ["top", "middle", "bottom"].includes(v), '"top", "middle" or "bottom"');
			need("containerId", (v) => v === null || typeof v === "string", "null or the id of the box or arrow it labels");
			need("lineHeight", (v) => isNum(v) && v > 0, "a number such as 1.25 (Excalifont), 1.35 (Nunito) or 1.25 (Comic Shanns)");
			need("autoResize", (v) => typeof v === "boolean", "true or false");
			if (hasText) {
				if (el.text === "") add("warning", "dropped-on-load", at(i), "An empty text: Excalidraw deletes it when it loads the drawing.");
				if (typeof el.originalText === "string" && el.originalText.replace(/\s+/g, "") !== el.text.replace(/\s+/g, ""))
					add("warning", "text-mismatch", at(i), `"text" and "originalText" differ in more than line breaks: Excalidraw shows "text" and rewraps "originalText" when the label is edited or its box resized.`);
				if (isNum(el.fontSize) && isNum(el.height)) {
					const lines = el.text.replace(/\r\n?/g, "\n").split("\n").length;
					const lh = isNum(el.lineHeight) && el.lineHeight > 0 ? el.lineHeight : LINE_HEIGHTS[el.fontFamily] ?? 1.25;
					const expected = lines * el.fontSize * lh;
					if (Math.abs(el.height - expected) > 1.5)
						add("warning", "text-size", at(i), `"height" ${el.height} does not fit ${plural(lines, "line")} of ${el.fontSize} px text at line height ${lh}: it should be ${round(expected)}.`);
					const w = FONTS_TO_WRITE.has(el.fontFamily) ? textWidth(el.text, el.fontFamily, el.fontSize) : null;
					if (w !== null && isNum(el.width) && el.width > 0 && Math.abs(el.width - w) > 4 && (el.width < w * 0.85 || el.width > w * 1.25))
						add("warning", "text-size", at(i), `"width" ${el.width} is far from the width of the text in ${FONT_NAMES[el.fontFamily]} at ${el.fontSize} px (about ${Math.round(w)}): Excalidraw centres and selects the text by its width.`);
				}
				const map = widthMap(el.fontFamily);
				const lacks = (cp) => !map.has(cp) && !(el.fontFamily === 5 && isCJK(cp));
				if (map) for (const ch of el.text) if (!/\s/.test(ch) && lacks(ch.codePointAt(0))) glyphs.set(ch, (glyphs.get(ch) ?? 0) + 1);
			}
		}
		if (LINEAR.has(el.type) || el.type === "freedraw") {
			const pointsOk = need("points", (v) => Array.isArray(v) && v.every((p) => Array.isArray(p) && p.length >= 2 && isNum(p[0]) && isNum(p[1])), "an array of [x, y] pairs, relative to the element's x and y", { required: true });
			if (pointsOk) {
				const [px, py] = el.points[0];
				if (px !== 0 || py !== 0) add("warning", "points", at(i), `The first point is [${px}, ${py}], not [0, 0]: Excalidraw shifts the points and moves x and y when it loads the drawing.`);
				const xs = el.points.map((p) => p[0]);
				const ys = el.points.map((p) => p[1]);
				const w = Math.max(...xs) - Math.min(...xs);
				const h = Math.max(...ys) - Math.min(...ys);
				if (LINEAR.has(el.type) && isNum(el.width) && isNum(el.height) && (Math.abs(el.width - w) > 1 || Math.abs(el.height - h) > 1))
					add("warning", "points", at(i), `"width" and "height" (${round(el.width)} x ${round(el.height)}) are not the size of the points (${round(w)} x ${round(h)}): Excalidraw recomputes them when it loads the drawing.`);
			}
		}
		if (LINEAR.has(el.type)) {
			for (const key of ["startArrowhead", "endArrowhead"]) need(key, (v) => v === null || ARROWHEADS.includes(v), `null or one of ${ARROWHEADS.join(", ")}`);
			for (const key of ["startBinding", "endBinding"]) {
				if (need(key, (v) => v === null || (isObject(v) && typeof v.elementId === "string"), "null or {\"elementId\", \"focus\", \"gap\"}") && el[key]) {
					if (el.type === "line") add("warning", "arrow-binding", at(i), `A line with a ${key}: only arrows bind; Excalidraw removes it when it loads the drawing.`);
					const newerForm = !isNum(el[key].focus) && ("mode" in el[key] || "fixedPoint" in el[key]) && el.elbowed !== true;
					if (newerForm) newerBindings++;
					else {
						if (!isNum(el[key].focus)) add("warning", "arrow-binding", at(i), `${key} has no "focus" (a number from -1 to 1; 0 aims at the shape's centre).`);
						if (!isNum(el[key].gap)) add("warning", "arrow-binding", at(i), `${key} has no "gap" (the distance in pixels between the arrow's end and the shape).`);
					}
					if (el.elbowed === true && !Array.isArray(el[key].fixedPoint)) add("warning", "arrow-binding", at(i), `An elbow arrow's ${key} without "fixedPoint": Excalidraw removes the binding when it loads the drawing.`);
				}
			}
		}
		if (el.type === "freedraw") {
			need("pressures", (v) => Array.isArray(v) && v.every(isNum), "an array of numbers (empty with simulatePressure true)");
			need("simulatePressure", (v) => typeof v === "boolean", "true or false");
		}
		if (el.type === "image") {
			need("fileId", (v) => typeof v === "string", 'the key of its picture in "files"', { required: true });
			need("status", (v) => ["pending", "saved", "error"].includes(v), '"saved", "pending" or "error"');
			need("scale", (v) => Array.isArray(v) && v.length === 2 && v.every(isNum), "[1, 1] (or -1 to flip)");
		}
		if (el.type === "frame" || el.type === "magicframe") need("name", (v) => v === null || typeof v === "string", "null or the frame's title");
		if (el.type === "embeddable")
			add("warning", "embed", at(i), "An embedded web page: Excaliboard loads no web pages in drawings, so this shows its link instead of the page.");
		if (missing.length) missingByElement.push([i, missing]);
	});
	if (missingByElement.length) {
		for (const [i, keys] of missingByElement.slice(0, 20)) add("warning", "missing-field", at(i), `No ${keys.map(q).join(", ")}: Excalidraw fills in its defaults when it loads the drawing.`);
		if (missingByElement.length > 20) add("warning", "missing-field", null, `${missingByElement.length - 20} more elements have missing fields (the same kind as above).`);
	}
	if (newerBindings)
		add("warning", "arrow-binding", null, `${plural(newerBindings, "arrow binding is", "arrow bindings are")} in excalidraw.com's newer form ("mode" and "fixedPoint", without "focus" and "gap"): Excalidraw 0.18.1 aims ${newerBindings === 1 ? "it" : "them"} at the shape's centre (focus 0) when the shape moves.`);
	for (const [family, count] of fontUse)
		add("warning", "font", null, `${plural(count, "text uses", "texts use")} fontFamily ${family} (${FONT_NAMES[family]}): Excalidraw 0.18.1 draws it, but its three font buttons are 5 (Excalifont), 6 (Nunito) and 8 (Comic Shanns); write those in new text.`);
	if (glyphs.size) {
		const chars = [...glyphs.keys()];
		add("warning", "fallback-font", null, `Characters the text's font lacks, drawn in a fallback font: ${chars.slice(0, 12).join(" ")}${chars.length > 12 ? " ..." : ""}. Fine for emoji; for arrows and symbols write words ("to", "and"). Chinese, Japanese and Korean are best in Excalifont (fontFamily 5), next to which excalidraw.com draws them hand-drawn.`);
	}

	// Labels: a text with a containerId and its container's boundElements must name each other.
	const labelOf = new Map();
	elements.forEach((el, i) => {
		if (!live(el) || dropped.has(i) || el.type !== "text" || typeof el.containerId !== "string") return;
		const ci = byId.get(el.containerId);
		if (ci === undefined || !live(elements[ci])) return add("warning", "bound-text", at(i), `"containerId" is ${q(el.containerId)}, which is not in the drawing: Excalidraw makes it a free text when it loads the drawing.`);
		const c = elements[ci];
		if (!CONTAINERS.has(c.type)) return add("error", "bound-text", at(i), `"containerId" is ${at(ci)}; only a rectangle, ellipse, diamond or arrow holds a label.`);
		if (labelOf.has(ci)) return add("error", "bound-text", at(i), `${at(ci)} already has the label ${at(labelOf.get(ci))}: a box or arrow holds one label, and Excalidraw never draws the second.`);
		labelOf.set(ci, i);
		if (!(Array.isArray(c.boundElements) && c.boundElements.some((b) => b?.id === el.id && b?.type === "text")))
			add("warning", "bound-text", at(i), `${at(ci)} does not list it in "boundElements": Excalidraw adds {"type": "text", "id": ${q(el.id)}} when it loads the drawing. Write both sides.`);
		if (isOrderKey(el.index) && isOrderKey(c.index) && !(el.index > c.index)) add("warning", "label-order", at(i), "A label must come after its container in the drawing order (its index greater than the container's).");
		checkLabelGeometry(el, c, (m) => add("warning", m.code, at(i), m.message));
	});
	elements.forEach((el, i) => {
		if (!live(el) || dropped.has(i) || !Array.isArray(el.boundElements)) return;
		for (const b of el.boundElements) {
			if (!isObject(b)) continue;
			const ti = byId.get(b.id);
			if (ti === undefined) {
				add("warning", "stale-binding", at(i), `"boundElements" lists ${q(b.id)}, which is not in the drawing: Excalidraw removes the entry when it loads the drawing.`);
				continue;
			}
			const t = elements[ti];
			if (b.type === "text") {
				if (t.type !== "text") add("error", "bound-text", at(i), `"boundElements" lists ${at(ti)} as its text, but it is not a text.`);
				else if (t.containerId === null || t.containerId === undefined) add("warning", "bound-text", at(i), `"boundElements" lists ${at(ti)}, whose containerId is null: Excalidraw sets it to ${q(el.id)} when it loads the drawing. Write both sides.`);
				else if (t.containerId !== el.id) add("error", "bound-text", at(i), `"boundElements" lists ${at(ti)}, but that text's containerId is ${q(t.containerId)}: one label has two boxes.`);
			} else if (b.type === "arrow") {
				const binds = t.startBinding?.elementId === el.id || t.endBinding?.elementId === el.id;
				if (!binds) add("warning", "stale-binding", at(i), `"boundElements" lists ${at(ti)}, which is not bound to it (no startBinding or endBinding names ${q(el.id)}); Excalidraw ignores the entry.`);
			}
		}
	});

	// Arrows: each binding's element must list the arrow, or the arrow stays put when the shape moves.
	elements.forEach((el, i) => {
		if (!live(el) || dropped.has(i) || el.type !== "arrow") return;
		for (const key of ["startBinding", "endBinding"]) {
			const b = el[key];
			if (!isObject(b) || typeof b.elementId !== "string") continue;
			const ti = byId.get(b.elementId);
			if (ti === undefined || !live(elements[ti])) {
				add("warning", "arrow-binding", at(i), `${key} names ${q(b.elementId)}, which is not in the drawing: Excalidraw removes the binding when it loads the drawing.`);
				continue;
			}
			const t = elements[ti];
			const bindable = ["rectangle", "diamond", "ellipse", "image", "iframe", "embeddable", "frame", "magicframe"].includes(t.type) || (t.type === "text" && !t.containerId);
			if (!bindable) {
				add("error", "arrow-binding", at(i), `${key} names ${at(ti)}, which an arrow cannot bind to (a rectangle, diamond, ellipse, image, frame or free text can).`);
				continue;
			}
			if (!(Array.isArray(t.boundElements) && t.boundElements.some((x) => x?.id === el.id && x?.type === "arrow")))
				add("error", "arrow-binding", at(i), `${key} names ${at(ti)}, whose "boundElements" does not list the arrow: when that shape moves, the arrow stays behind. Add {"type": "arrow", "id": ${q(el.id)}} to it.`);
			checkArrowEnd(el, key, t, (message) => add("warning", "arrow-end", at(i), message));
		}
	});

	// Images and files.
	const used = new Set();
	elements.forEach((el, i) => {
		if (!live(el) || dropped.has(i) || el.type !== "image" || typeof el.fileId !== "string") return;
		used.add(el.fileId);
		if (!isObject(files[el.fileId])) add("error", "missing-file", at(i), `"fileId" is ${q(el.fileId)}, which is not in "files": the image shows as an empty placeholder.`);
	});
	for (const [key, f] of Object.entries(files)) {
		const where = `files[${q(key)}]`;
		if (!isObject(f)) {
			add("error", "bad-file", null, `${where} is not an object {"mimeType", "id", "dataURL", "created"}.`);
			continue;
		}
		if (f.id !== key) add("error", "bad-file", null, `${where} has "id" ${q(f.id)}: Excalidraw files each picture under its own id, so the images that use ${q(key)} find nothing. Make "id" the same as the key.`);
		if (typeof f.dataURL === "string" && !f.dataURL.startsWith("data:")) {
			add("warning", "web-picture", null, `${where}: "dataURL" is an address, and Excaliboard loads no picture from the web: its images show as pictures that failed to load. Put the picture itself in, as a data: URL ("data:image/png;base64,...").`);
		} else if (typeof f.dataURL !== "string") add("error", "bad-file", null, `${where}: "dataURL" must be the picture itself, a data: URL ("data:image/png;base64,...").`);
		else {
			const mime = /^data:([^;,]+)/.exec(f.dataURL)?.[1];
			if (typeof f.mimeType !== "string") add("warning", "bad-file", null, `${where} has no "mimeType" (such as "image/png").`);
			else if (mime && mime !== f.mimeType) add("warning", "bad-file", null, `${where}: "mimeType" is ${q(f.mimeType)} but the data is ${q(mime)}.`);
			if (typeof f.mimeType === "string" && !IMAGE_TYPES.includes(f.mimeType)) add("warning", "bad-file", null, `${where}: ${q(f.mimeType)} is not an image type Excalidraw shows (${IMAGE_TYPES.join(", ")}).`);
		}
		if (!isNum(f.created)) add("warning", "bad-file", null, `${where} has no "created" time (milliseconds).`);
		if (!used.has(key)) add("warning", "unused-file", null, `${where} is used by no image: Excalidraw leaves it out at the next save.`);
	}

	// Frames.
	elements.forEach((el, i) => {
		if (!live(el) || dropped.has(i) || typeof el.frameId !== "string") return;
		const fi = byId.get(el.frameId);
		if (fi === undefined || !live(elements[fi])) return add("warning", "frame", at(i), `"frameId" is ${q(el.frameId)}, which is not in the drawing: Excalidraw clears it when it loads the drawing.`);
		const f = elements[fi];
		if (f.type !== "frame" && f.type !== "magicframe") return add("warning", "frame", at(i), `"frameId" is ${at(fi)}, which is not a frame.`);
		const b = bounds(el);
		if (b && isNum(f.x) && isNum(f.width) && (b[0] < f.x - 1 || b[1] < f.y - 1 || b[2] > f.x + f.width + 1 || b[3] > f.y + f.height + 1))
			add("warning", "frame", at(i), `It sticks out of its frame ${at(fi)}: the frame clips what is outside it.`);
	});

	// The top level.
	if (data.version !== 2) add("warning", "scene-version", null, `"version" is ${q(data.version)}; Excalidraw writes 2.`);
	if (data.appState !== undefined && !isObject(data.appState)) add("warning", "app-state", null, '"appState" is not an object: Excalidraw uses its defaults (a white canvas, grid 20).');
	else if (isObject(data.appState) && data.appState.viewBackgroundColor !== undefined && typeof data.appState.viewBackgroundColor !== "string")
		add("warning", "app-state", null, '"appState.viewBackgroundColor" must be a colour such as "#ffffff".');

	// Summary.
	const kept = elements.filter((el, i) => !dropped.has(i) && KEPT_TYPES.has(el.type));
	const visible = kept.filter(live);
	const byType = {};
	for (const el of visible) byType[el.type] = (byType[el.type] ?? 0) + 1;
	const all = visible.map(bounds).filter(Boolean);
	const extent = all.length ? [Math.round(Math.max(...all.map((b) => b[2])) - Math.min(...all.map((b) => b[0]))), Math.round(Math.max(...all.map((b) => b[3])) - Math.min(...all.map((b) => b[1])))] : null;
	result.summary = { elements: elements.length, visible: visible.length, deleted: elements.filter((el) => el.isDeleted === true).length, byType, files: Object.keys(files).length, extent, unknownKeys: Object.keys(data).filter((k) => !["type", "version", "source", "elements", "appState", "files"].includes(k)) };
	result.elements = elements.map((el, i) => ({ n: i + 1, el, dropped: dropped.has(i) }));
	issues.sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1));
	return result;
}

/** A file Excaliboard's parseScene refuses: `message` is its own wording, `detail` what the checker adds. */
function readOnly(result, code, message, detail = "") {
	result.readOnly = message;
	result.issues.push({ level: "error", code, at: null, message: `Excaliboard opens it read-only: ${message}${detail}` });
	result.summary = { elements: 0, visible: 0, deleted: 0, byType: {}, files: 0, extent: null, unknownKeys: [] };
	return result;
}

const round = (v) => Math.round(v * 100) / 100;

/** [x1, y1, x2, y2] of an element, unrotated; null when its numbers are missing. */
function bounds(el) {
	if (!isNum(el.x) || !isNum(el.y)) return null;
	if (Array.isArray(el.points) && el.points.length && el.points.every((p) => Array.isArray(p) && isNum(p[0]) && isNum(p[1]))) {
		const xs = el.points.map((p) => el.x + p[0]);
		const ys = el.points.map((p) => el.y + p[1]);
		return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
	}
	if (!isNum(el.width) || !isNum(el.height)) return null;
	return [Math.min(el.x, el.x + el.width), Math.min(el.y, el.y + el.height), Math.max(el.x, el.x + el.width), Math.max(el.y, el.y + el.height)];
}

/** Where Excalidraw puts a label, and whether it fits (computeBoundTextPosition, getBoundTextMaxWidth/Height). */
function checkLabelGeometry(t, c, report) {
	if (![t.x, t.y, t.width, t.height, c.x, c.y, c.width, c.height].every(isNum)) return;
	if (c.type === "arrow") {
		if (!Array.isArray(c.points) || c.points.length < 2 || !c.points.every((p) => Array.isArray(p) && isNum(p[0]) && isNum(p[1]))) return;
		const pts = c.points.map((p) => [c.x + p[0], c.y + p[1]]);
		let mid;
		if (pts.length % 2 === 1) mid = pts[(pts.length - 1) / 2];
		else if (pts.length === 2 || c.roundness === null) {
			const k = pts.length / 2;
			mid = [(pts[k - 1][0] + pts[k][0]) / 2, (pts[k - 1][1] + pts[k][1]) / 2];
		} else return; // the middle of a curved segment: not checked
		const [ex, ey] = [mid[0] - t.width / 2, mid[1] - t.height / 2];
		if (Math.abs(ex - t.x) > 1 || Math.abs(ey - t.y) > 1)
			report({ code: "label-position", message: `An arrow label sits at ${round(t.x)}, ${round(t.y)}; Excalidraw centres it on the arrow's middle point, at ${round(ex)}, ${round(ey)}, as soon as the arrow changes.` });
		const w = isNum(t.fontSize) && typeof t.text === "string" ? textWidth(t.text, t.fontFamily, t.fontSize) : null;
		const maxWidth = Math.max(0.7 * c.width, (isNum(t.fontSize) ? t.fontSize : 20) * 11);
		if (w !== null && w > maxWidth + 1)
			report({ code: "label-fit", message: `The label is about ${Math.round(w)} px wide; Excalidraw keeps ${Math.floor(maxWidth)} px on one line on this arrow and wraps the rest when the arrow changes.` });
		return;
	}
	const P = BOUND_TEXT_PADDING;
	let [x, y, maxW, maxH] = [c.x + P, c.y + P, c.width - 2 * P, c.height - 2 * P];
	if (c.type === "ellipse") {
		x += (c.width / 2) * (1 - Math.SQRT2 / 2);
		y += (c.height / 2) * (1 - Math.SQRT2 / 2);
		maxW = Math.round((c.width / 2) * Math.SQRT2) - 2 * P;
		maxH = Math.round((c.height / 2) * Math.SQRT2) - 2 * P;
	} else if (c.type === "diamond") {
		x += c.width / 4;
		y += c.height / 4;
		maxW = Math.round(c.width / 2) - 2 * P;
		maxH = Math.round(c.height / 2) - 2 * P;
	}
	const ex = t.textAlign === "left" ? x : t.textAlign === "right" ? x + maxW - t.width : x + maxW / 2 - t.width / 2;
	const ey = t.verticalAlign === "top" ? y : t.verticalAlign === "bottom" ? y + maxH - t.height : y + maxH / 2 - t.height / 2;
	if (Math.abs(ex - t.x) > 1 || Math.abs(ey - t.y) > 1)
		report({ code: "label-position", message: `The label sits at ${round(t.x)}, ${round(t.y)}; Excalidraw puts it at ${round(ex)}, ${round(ey)} (textAlign ${t.textAlign}, verticalAlign ${t.verticalAlign}) as soon as its box moves or changes.` });
	const w = isNum(t.fontSize) && typeof t.text === "string" ? textWidth(t.text, t.fontFamily, t.fontSize) : null;
	if (w !== null && w > maxW + 1)
		report({ code: "label-fit", message: `The label is about ${Math.round(w)} px wide; its ${c.type} holds ${Math.round(maxW)} px: Excalidraw wraps it and makes the box taller when the box is resized or the text edited. Make the box wider, or break the label into lines.` });
	if (t.height > maxH + 1)
		report({ code: "label-fit", message: `The label is ${round(t.height)} px tall; its ${c.type} holds ${Math.round(maxH)} px: Excalidraw makes the box taller when the box is resized or the text edited.` });
}

/** An arrow's end should sit about `gap` px outside the shape it is bound to. */
function checkArrowEnd(a, key, t, report) {
	if (!Array.isArray(a.points) || a.points.length < 2 || !isNum(a.x) || !isNum(a.y) || ![t.x, t.y, t.width, t.height].every(isNum) || (t.angle ?? 0) !== 0) return;
	const p = a.points[key === "startBinding" ? 0 : a.points.length - 1];
	if (!Array.isArray(p) || !isNum(p[0]) || !isNum(p[1])) return;
	const [px, py] = [a.x + p[0], a.y + p[1]];
	const [cx, cy, hw, hh] = [t.x + t.width / 2, t.y + t.height / 2, Math.abs(t.width) / 2, Math.abs(t.height) / 2];
	const [dx, dy] = [Math.abs(px - cx), Math.abs(py - cy)];
	let d;
	if (t.type === "ellipse" && hw > 0 && hh > 0) d = (Math.hypot(dx / hw, dy / hh) - 1) * Math.min(hw, hh);
	else if (t.type === "diamond" && hw > 0 && hh > 0) d = ((dx / hw + dy / hh - 1) * hw * hh) / Math.hypot(hw, hh);
	else {
		const [ox, oy] = [dx - hw, dy - hh];
		d = ox > 0 || oy > 0 ? Math.hypot(Math.max(ox, 0), Math.max(oy, 0)) : Math.max(ox, oy);
	}
	const gap = isNum(a[key]?.gap) ? a[key].gap : 0;
	const end = key === "startBinding" ? "starts" : "ends";
	if (d > gap + 40) report(`It ${end} ${Math.round(d)} px from the shape it is bound to: Excalidraw pulls the end to ${round(gap)} px from it when the shape moves.`);
	else if (d < -12) report(`It ${end} ${Math.round(-d)} px inside the shape it is bound to: put the end on the outline (plus "gap"), aimed at the centre.`);
}

// ---------------------------------------------------------------------------------------------------------------
// Command line

const USAGE = `check-drawing ${VERSION}: checks Excalidraw drawings (.excalidraw) as Excaliboard reads them

usage: node check-drawing.mjs <drawing.excalidraw or folder>... [--elements] [--json]

  A folder is searched for *.excalidraw files (dot folders and node_modules are skipped).
  --elements  also list every element: its number, index, id, type, position and size, and its text,
              label or binding
  --json      print one JSON object instead of text

Errors: Excaliboard opens the drawing read-only, or Excalidraw 0.18.1 drops, renames or misdraws something.
Warnings: likely mistakes, and what Excalidraw changes when it loads the drawing or at the next save.
Exit status: 0 no errors, 1 errors (or no drawing found), 2 usage or an unreadable path.`;

function print(text) {
	process.stdout.write(`${text}\n`);
}

function walk(dir, out) {
	const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
	for (const entry of entries) {
		if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
		const p = join(dir, entry.name);
		if (entry.isDirectory()) walk(p, out);
		else if (entry.isFile() && /\.excalidraw$/i.test(entry.name)) out.push(p);
	}
}

function describe(el) {
	const num = (v) => (isNum(v) ? String(Math.round(v)) : "?");
	const pos = `x ${num(el.x)}, y ${num(el.y)}, ${num(el.width)} x ${num(el.height)}`;
	const short = (s) => {
		const one = String(s).replace(/\s*\n\s*/g, " / ");
		return q(one.length > 48 ? `${one.slice(0, 47)}...` : one);
	};
	let extra = "";
	if (el.type === "text") extra = `${short(el.text ?? "")}${el.containerId ? ` in ${el.containerId}` : ""}`;
	else if (LINEAR.has(el.type)) extra = `${el.startBinding?.elementId ?? "(free)"} -> ${el.endBinding?.elementId ?? "(free)"}`;
	else if (el.type === "image") extra = `file ${el.fileId}`;
	else if (el.type === "frame" || el.type === "magicframe") extra = `frame ${q(el.name ?? "")}`;
	const label = Array.isArray(el.boundElements) ? el.boundElements.find((b) => b?.type === "text") : null;
	if (label) extra += `${extra ? ", " : ""}label ${label.id}`;
	if (el.link) extra += `${extra ? ", " : ""}link ${q(el.link)}`;
	if (el.isDeleted === true) extra += `${extra ? ", " : ""}deleted`;
	return { pos, extra };
}

function main(argv) {
	const paths = [];
	let json = false;
	let list = false;
	for (const a of argv) {
		if (a === "--help" || a === "-h") {
			print(USAGE);
			return 0;
		}
		if (a === "--version") {
			print(VERSION);
			return 0;
		}
		if (a === "--json") json = true;
		else if (a === "--elements") list = true;
		else if (a.startsWith("--")) {
			process.stderr.write(`check-drawing: unknown option ${a}\n\n${USAGE}\n`);
			return 2;
		} else paths.push(a);
	}
	if (!paths.length) {
		process.stderr.write(`check-drawing: give at least one drawing or folder\n\n${USAGE}\n`);
		return 2;
	}
	const files = [];
	const notes = [];
	for (const p of paths) {
		let isDir;
		try {
			isDir = statSync(p).isDirectory();
		} catch {
			process.stderr.write(`check-drawing: ${p}: no such file or folder\n`);
			return 2;
		}
		if (!isDir) {
			files.push(p);
			continue;
		}
		const found = [];
		try {
			walk(p, found);
		} catch (e) {
			process.stderr.write(`check-drawing: ${p}: cannot be read (${e.message})\n`);
			return 2;
		}
		if (!found.length) notes.push(`${p}: no .excalidraw file in this folder`);
		files.push(...found);
	}
	const reports = [];
	for (const file of files) {
		let text;
		try {
			text = readFileSync(file, "utf8");
		} catch (e) {
			process.stderr.write(`check-drawing: ${file}: cannot be read (${e.message})\n`);
			return 2;
		}
		reports.push({ file, bytes: Buffer.byteLength(text), ...checkDrawing(text) });
	}
	const errors = reports.reduce((n, r) => n + r.issues.filter((i) => i.level === "error").length, 0) + notes.length;
	const warnings = reports.reduce((n, r) => n + r.issues.filter((i) => i.level === "warning").length, 0);
	const elementCount = reports.reduce((n, r) => n + (r.summary?.visible ?? 0), 0);
	if (json) {
		print(JSON.stringify({
			drawings: reports.map((r) => ({
				file: r.file,
				readOnly: r.readOnly,
				...r.summary,
				bytes: r.bytes,
				issues: r.issues,
				...(list ? { list: r.elements.map(({ n, el, dropped }) => ({ n, index: el.index ?? null, id: el.id, type: el.type, dropped, ...describe(el) })) } : {}),
			})),
			errors,
			warnings,
			notes,
		}, null, 2));
	} else {
		for (const r of reports) {
			const s = r.summary;
			const types = Object.entries(s.byType).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${n} ${t}`).join(", ");
			const parts = [
				`${plural(s.visible, "element")}${types ? ` (${types})` : ""}`,
				...(s.deleted ? [`${s.deleted} deleted`] : []),
				plural(s.files, "file"),
				...(s.extent ? [`${s.extent[0]} x ${s.extent[1]} px`] : []),
				`${(r.bytes / 1024).toFixed(1)} KB`,
			];
			print(`${r.file}: ${parts.join(", ")}`);
			if (r.readOnly === null && s.unknownKeys?.length) print(`  note     top-level keys Excalidraw does not use, which Excaliboard keeps when it saves: ${s.unknownKeys.join(", ")}`);
			for (const i of r.issues) print(`  ${i.level.padEnd(8)} ${i.at ? `${i.at}: ` : ""}${i.message}`);
			if (list) for (const { n, el, dropped } of r.elements) {
				const { pos, extra } = describe(el);
				print(`  #${String(n).padEnd(4)} ${String(el.index ?? "-").padEnd(5)} ${String(el.id).padEnd(24)} ${String(el.type).padEnd(10)} ${pos.padEnd(34)} ${extra}${dropped ? " (dropped on load)" : ""}`);
			}
		}
		for (const n of notes) print(`error: ${n}`);
		const drawings = `${plural(reports.length, "drawing")}, ${plural(elementCount, "element")}`;
		print(errors === 0 && warnings === 0 ? `OK: ${drawings}, no errors, no warnings.` : `${drawings}: ${plural(errors, "error")}, ${plural(warnings, "warning")}.`);
	}
	return errors > 0 ? 1 : 0;
}

const invokedAsScript = (() => {
	try {
		return realpathSync(process.argv[1] ?? "") === realpathSync(fileURLToPath(import.meta.url));
	} catch {
		return false;
	}
})();
if (invokedAsScript) process.exitCode = main(process.argv.slice(2));
