# Third-party notices

Excaliboard bundles the Excalidraw editor (`@excalidraw/excalidraw` 0.18.1), React 18.3.1 and the packages they use
into `main.js`, and Excalidraw's stylesheet into `styles.css`: Obsidian installs a plugin as those two files and
`manifest.json`, and the editor never goes online. For the same reason the fonts Excalidraw draws with are embedded in
`main.js`, rather than fetched from Excalidraw's CDN, and its interface font in `styles.css`.

Some parts of Excalidraw aren't shipped. Xiaolai, its hand-drawn CJK font, is left out, so Chinese, Japanese and
Korean text is drawn in a system font. So is Liberation Sans, which Excalidraw keeps for exports made on its servers
and doesn't offer in its font picker; its version 1.05 is under the GNU GPL, unlike the other fonts. Its Mermaid
importer, `@excalidraw/mermaid-to-excalidraw`, is replaced by a stub (`stubs/mermaid-to-excalidraw`), so neither it
nor Mermaid is bundled.

`scripts/third-party-notices.mjs` writes this file from esbuild's metafile and the licence files in `node_modules`;
what `node_modules` doesn't hold is written in the script, with the address of each source.
`node scripts/third-party-notices.mjs --check` fails when this file is out of date.

## Fonts

`main.js` embeds the fonts Excalidraw 0.18.1 draws with, and `styles.css` its interface font, as data URLs. They are
the font files of its npm package (`dist/prod/fonts/`), the same as in its repository's
[fonts folder at v0.18.1](https://github.com/excalidraw/excalidraw/tree/v0.18.1/packages/excalidraw/fonts). That
folder has no licence files, so each font's licence and copyright lines come from the font's own project, or from the
fields inside its font files (their name table), as noted for each.

### Excalifont

Excalidraw's hand-drawn font, based on Virgil, with modifications by Ján Filípek / DizajnDesign (the designer field of
the full font). In `main.js`, under the SIL Open Font License 1.1, as the licence field of the full font says. The
subsets Excalidraw ships keep only its copyright, naming and version fields, and Excalidraw's source reproduces all of
them in
[fonts/Excalifont/index.ts](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/fonts/Excalifont/index.ts).

From the font's copyright field:

- Copyright (c) 2024 by Excalidraw. All rights reserved.

### Virgil

Excalidraw's original hand-drawn font, by Ellinor Rapp. In `main.js`, under the SIL Open Font License 1.1, as its
[LICENSE.md](https://github.com/excalidraw/virgil/blob/3d4c829dc85b455d4646631ac52bc1517df04217/LICENSE.md) and the
font's licence field say.

From LICENSE.md:

- Copyright (c) 2021 - Present, Ellinor Rapp, with Reserved Font Name Virgil.

From the font's copyright field:

- Copyright (c) 2011 by Your Own Font Foundry. All rights reserved.

### Nunito

Version 3.602 (the font's version field). In `main.js`, under the SIL Open Font License 1.1, as the Nunito project's
[OFL.txt](https://github.com/googlefonts/nunito/blob/8c6a9bb9732545b9ed53f29ec5e1ab0ff53c4e6f/OFL.txt) says.

From OFL.txt and the font's copyright field:

- Copyright 2014 The Nunito Project Authors (https://github.com/googlefonts/nunito)

### Lilita One

By Juan Montoreano, version 1.002 (the font's version field). In `main.js`, under the SIL Open Font License 1.1, as
its [OFL.txt](https://github.com/google/fonts/blob/5bb28733cec313b63fbd415b574b5ae35c8aa8b8/ofl/lilitaone/OFL.txt) in
Google Fonts' repository says.

From OFL.txt:

- Copyright (c) 2011 Juan Montoreano (juan@remolacha.biz), with Reserved Font Name Lilita

From the font's copyright field:

- Copyright (c) 2011 Juan Montoreano (juan@remolacha.biz), with Reserved Font Names "Lilita One"

### Comic Shanns

Comic Shanns Mono, Jesus Gonzalez's monospaced version of Shannon Miwa's Comic Shanns. Its copyright field is the one
in the project's
[source](https://github.com/jesusmgg/comic-shanns-mono/blob/5a13931471e3a5546adcf5dd772946aa34602e79/src/ComicShannsMono-Regular.sfd)
since June 2024, after the v1.3.0 release, although its version field says 1.3.0. In `main.js`, under the MIT License,
as the font's copyright field and the project's
[LICENSE.md](https://github.com/jesusmgg/comic-shanns-mono/blob/5a13931471e3a5546adcf5dd772946aa34602e79/LICENSE.md)
say. Excalidraw's source reproduces the font's fields in
[fonts/ComicShanns/index.ts](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/fonts/ComicShanns/index.ts).

From the font's copyright field:

- Copyright (c) 2018 Shannon Miwa
- Copyright (c) 2023 Jesus Gonzalez
- Copyright (c) 2023 Rodrigo Batista de Moraes
- Copyright (c) 2024 Fini Jastrow
- Copyright (c) 2024 Kyle Beechly

### Cascadia Code

Microsoft's monospaced font, version 2005.150 (the font's version field). The font's own licence field starts with
Microsoft's general notice for the fonts it supplies, then gives a licence based on the SIL Open Font License and
points to the project's LICENSE for its terms. In `main.js`, under the SIL Open Font License 1.1, as the
[LICENSE](https://github.com/microsoft/cascadia-code/blob/v2005.15/LICENSE) of that release, v2005.15, says.

From LICENSE:

- Copyright (c) 2019 - Present, Microsoft Corporation, with Reserved Font Name Cascadia Code.

From the font's copyright field:

- © 2020 Microsoft Corporation. All Rights Reserved.

### Assistant

Excalidraw's interface font, version 3.000, with Hebrew by Ben Nathan and Latin by Paul Hunt (the font's designer
field). In `styles.css`, under the SIL Open Font License 1.1, as its
[OFL.txt](https://github.com/google/fonts/blob/5bb28733cec313b63fbd415b574b5ae35c8aa8b8/ofl/assistant/OFL.txt) in
Google Fonts' repository says.

From OFL.txt and the font's copyright field:

- Copyright 2020 The Assistant Project Authors (https://github.com/hafontia/Assistant).
- Copyright 2010 The Source Sans Pro Authors (https://github.com/adobe-fonts/source-sans-pro), with Reserved Font Name
  'Source'.
- Source is a trademark of Adobe Systems Incorporated in the United States and/or other countries.

### SIL Open Font License 1.1

As in Nunito's [OFL.txt](https://github.com/googlefonts/nunito/blob/8c6a9bb9732545b9ed53f29ec5e1ab0ff53c4e6f/OFL.txt).
The licence files linked above for the other fonts under this licence, and the licence field of the full Excalifont,
have the same wording.

```
-----------------------------------------------------------
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
OTHER DEALINGS IN THE FONT SOFTWARE.
```

### MIT License: Comic Shanns

Comic Shanns's licence, from the project's
[LICENSE.md](https://github.com/jesusmgg/comic-shanns-mono/blob/5a13931471e3a5546adcf5dd772946aa34602e79/LICENSE.md),
without its copyright lines, which are listed above.

```
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
SOFTWARE.
```

## Packages

`main.js` and `styles.css` hold code from 71 npm packages (82 versions), found in esbuild's metafile. Each is listed
with the copyright lines of the licence files in its npm package.

These were published without a licence file, so their licence comes from their repository:

- `@excalidraw/excalidraw`: its [LICENSE at v0.18.1](https://github.com/excalidraw/excalidraw/blob/v0.18.1/LICENSE).
- the `@radix-ui` packages: the
  [LICENSE](https://github.com/radix-ui/primitives/blob/ee4e3197bffe7dde669d6bbf8c30fef97b65e49d/LICENSE) of
  radix-ui/primitives, unchanged since June 2022, before the oldest of these versions was published (July 2022).
- `react-remove-scroll-bar`: the
  [LICENSE](https://github.com/theKashey/react-remove-scroll-bar/blob/7301c160fda44cb8cf2b9fdfde61efad35736196/LICENSE)
  its repository added in May 2025, after 2.3.8 was published (its package.json says MIT).

Some packages' builds include other projects' code, which `node_modules` doesn't hold apart. Those projects are listed
too, with the package they are in:

- `@excalidraw/excalidraw` 0.18.1 includes the WebAssembly modules it subsets fonts with, and their bindings
  ([scripts/buildWasm.js](https://github.com/excalidraw/excalidraw/blob/v0.18.1/scripts/buildWasm.js),
  [packages/excalidraw/subset](https://github.com/excalidraw/excalidraw/tree/v0.18.1/packages/excalidraw/subset)). The
  modules are byte for byte those of the harfbuzzjs 0.3.6 and fonteditor-core 2.4.0 npm packages: HarfBuzz's
  subsetter, with bindings adapted from subset-font, and Google's WOFF2 and Brotli, with fonteditor-core's bindings,
  which it adapted from woff2-wasm. fonteditor-core doesn't record which WOFF2 and Brotli commits it built, in 2019
  and 2020; both were MIT-licensed by then, and their licences are linked at recent commits. Its icons come from Font
  Awesome, Tabler Icons and, for one, Storybook
  ([components/icons.tsx](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/components/icons.tsx)).
  Excalidraw doesn't record their versions, so the licences are linked on Font Awesome's 5.x branch, at a recent
  commit of Tabler Icons, and as Storybook's was when Excalidraw added that icon, in February 2020. Comments in its
  source also credit a few short functions to lodash, clipboard.js, klona, Modernizr, p-try, Radix UI and the TC39
  proposal for `Array.prototype.at`, all MIT-licensed; those are not listed below.
- `pica` 7.1.1 (`dist/pica.js`) includes glur, inherits, multimath, object-assign and webworkify, and
  `image-blob-reduce` 3.0.1 includes pica 7.1.0 with the same five. Their versions are the newest that the dependency
  ranges allowed when each build was published, and their licences those of these versions' npm packages.
- `pako` 2.0.3 is a port of zlib, and its source keeps zlib's notice.

Licence texts that differ only in their copyright lines, an "MIT License" title or line breaks are given once, after
the list of everything that uses them.

### MIT License

- `@babel/runtime@7.29.13`: Copyright (c) 2014-present Sebastian McKenzie and other contributors
- `@braintree/sanitize-url@6.0.2`: Copyright (c) 2017 Braintree
- `@excalidraw/excalidraw@0.18.1`: Copyright (c) 2020 Excalidraw
- `@excalidraw/laser-pointer@1.3.1`: Copyright (c) 2023 Excalidraw
- `@floating-ui/core@1.8.0`, `@floating-ui/dom@1.8.0`, `@floating-ui/react-dom@2.1.9`, `@floating-ui/utils@0.2.12`:
  Copyright (c) 2021-present Floating UI contributors
- `@radix-ui/primitive@1.0.0`, `@radix-ui/primitive@1.1.1`, `@radix-ui/react-arrow@1.1.2`,
  `@radix-ui/react-collection@1.0.1`, `@radix-ui/react-compose-refs@1.0.0`, `@radix-ui/react-compose-refs@1.1.1`,
  `@radix-ui/react-context@1.0.0`, `@radix-ui/react-context@1.1.1`, `@radix-ui/react-direction@1.0.0`,
  `@radix-ui/react-dismissable-layer@1.1.5`, `@radix-ui/react-focus-guards@1.1.1`,
  `@radix-ui/react-focus-scope@1.1.2`, `@radix-ui/react-id@1.0.0`, `@radix-ui/react-id@1.1.0`,
  `@radix-ui/react-popover@1.1.6`, `@radix-ui/react-popper@1.2.2`, `@radix-ui/react-portal@1.1.4`,
  `@radix-ui/react-presence@1.0.0`, `@radix-ui/react-presence@1.1.2`, `@radix-ui/react-primitive@1.0.1`,
  `@radix-ui/react-primitive@2.0.2`, `@radix-ui/react-roving-focus@1.0.2`, `@radix-ui/react-slot@1.0.1`,
  `@radix-ui/react-slot@1.1.2`, `@radix-ui/react-tabs@1.0.2`, `@radix-ui/react-use-callback-ref@1.0.0`,
  `@radix-ui/react-use-callback-ref@1.1.0`, `@radix-ui/react-use-controllable-state@1.0.0`,
  `@radix-ui/react-use-controllable-state@1.1.0`, `@radix-ui/react-use-escape-keydown@1.1.0`,
  `@radix-ui/react-use-layout-effect@1.0.0`, `@radix-ui/react-use-layout-effect@1.1.0`,
  `@radix-ui/react-use-size@1.1.0`: Copyright (c) 2022 WorkOS
- `aria-hidden@1.2.6`, `react-remove-scroll@2.7.2`, `react-style-singleton@2.2.3`, `use-callback-ref@1.3.3`,
  `use-sidecar@1.1.3`: Copyright (c) 2017 Anton Korzunov
- [Brotli](https://github.com/google/brotli/blob/d89c4b1c52e25ddafe047bc78bbee5c1e24b1809/LICENSE) (in
  `@excalidraw/excalidraw@0.18.1`): Copyright (c) 2009, 2010, 2013-2016 by the Brotli Authors.
- `canvas-roundrect-polyfill@0.0.1`: Copyright (c) 2021 Tristan Fraipont
- `clsx@1.1.1`: Copyright (c) Luke Edwards <luke.edwards05@gmail.com> (lukeed.com)
- `es6-promise-pool@2.5.0`: Copyright (c) 2017 Tim De Pauw <https://tmdpw.eu/>
- [fonteditor-core 2.4.0](https://github.com/kekee000/fonteditor-core/blob/v2.4.0/LICENSE) (in
  `@excalidraw/excalidraw@0.18.1`): Copyright (c) 2014 ecomfe
- `fuzzy@0.1.3`: Copyright (c) 2012 Matt York
- `get-nonce@1.0.1`: Copyright (c) 2020 Anton Korzunov
- [glur 1.1.2](https://www.npmjs.com/package/glur/v/1.1.2) (in `pica@7.1.1` and `image-blob-reduce@3.0.1`): Copyright
  (c) 2014 Andrei Tupitcyn
- `hachure-fill@0.5.2`: Copyright (c) 2023 Preet Shihn
- `image-blob-reduce@3.0.1`: Copyright (C) 2020 by authors
- `jotai@2.11.0`: Copyright (c) 2020-2023 Poimandres
- `jotai-scope@0.7.2`: Copyright (c) 2023 Daishi Kato
- [multimath 2.0.0](https://www.npmjs.com/package/multimath/v/2.0.0) (in `pica@7.1.1` and `image-blob-reduce@3.0.1`):
  Copyright (C) 2017 by Vitaly Puzrin
- `nanoid@3.3.20`: Copyright 2017 Andrey Sitnik <andrey@sitnik.ru>
- [object-assign 4.1.1](https://www.npmjs.com/package/object-assign/v/4.1.1) (in `pica@7.1.1` and
  `image-blob-reduce@3.0.1`): Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)
- `open-color@1.9.1`: Copyright (c) 2016 heeyeun
- `pako@2.0.3` (its package.json says MIT AND Zlib): Copyright (C) 2014-2017 by Vitaly Puzrin and Andrei Tuputcyn
- `path-data-parser@0.1.0`, `points-on-curve@0.2.0`, `points-on-curve@1.0.1`: Copyright (c) 2020 Preet Shihn
- `perfect-freehand@1.2.0`: Copyright (c) 2021 Stephen Ruiz Ltd
- [pica 7.1.0](https://www.npmjs.com/package/pica/v/7.1.0) (in `image-blob-reduce@3.0.1`), `pica@7.1.1`: Copyright (C)
  2014-2017 by Vitaly Puzrin
- `png-chunk-text@1.0.0`, `png-chunks-encode@1.0.0`, `png-chunks-extract@1.0.0`: Copyright (c) 2015 Hugh Kennedy
- `points-on-path@0.2.1`: Copyright (c) 2020 Preet
- `react@18.3.1`, `react-dom@18.3.1`, `scheduler@0.23.2`: Copyright (c) Facebook, Inc. and its affiliates.
- `react-remove-scroll-bar@2.3.8`: Copyright (c) 2025 Anton Korzunov <thekashey@gmail.com>
- `roughjs@4.6.4`: Copyright (c) 2019 Preet Shihn
- [Tabler Icons](https://github.com/tabler/tabler-icons/blob/58f60538fe2fab2e1459a09198f9bd3b033bf90e/LICENSE) (in
  `@excalidraw/excalidraw@0.18.1`): Copyright (c) 2020-2026 Paweł Kuna
- `tunnel-rat@0.1.2`: Copyright (c) 2022 Poimandres
- `use-sync-external-store@1.7.0`: Copyright (c) Meta Platforms, Inc. and affiliates.
- [WOFF2](https://github.com/google/woff2/blob/7b67e12355fe7da148db5c19d4261f0a498a9537/LICENSE) (in
  `@excalidraw/excalidraw@0.18.1`): Copyright (c) 2013-2017 by the WOFF2 Authors.
- [woff2-wasm](https://github.com/alimilhim/woff2-wasm/blob/78c679a73d6cb40056896842121297948aaec8b8/LICENSE) (in
  `@excalidraw/excalidraw@0.18.1`): Copyright (c) 2019 Ali Milhim
- `zustand@4.5.7`: Copyright (c) 2019 Paul Henschel

```
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
SOFTWARE.
```

### Apache License 2.0: browser-fs-access

- `browser-fs-access@0.29.1`

```
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright [yyyy] [name of copyright owner]

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

### Apache License 2.0: crc-32

- `crc-32@0.3.0`: Copyright (C) 2014  SheetJS

```
   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

### BSD 3-Clause License: subset-font

- [subset-font at 3f711c8](https://github.com/papandreou/subset-font/blob/3f711c8aa29a426c7f22655861abfb976950f527/LICENSE)
  (in `@excalidraw/excalidraw@0.18.1`):
  - Copyright (c) 2012, Andreas Lind Petersen
  - All rights reserved.

```
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
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### BSD Zero Clause License: tslib

- `tslib@2.9.1`: Copyright (c) Microsoft Corporation.

```
Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
```

### CC0 1.0 Universal: fractional-indexing

- `fractional-indexing@3.2.0`

```
Creative Commons Legal Code

CC0 1.0 Universal

    CREATIVE COMMONS CORPORATION IS NOT A LAW FIRM AND DOES NOT PROVIDE
    LEGAL SERVICES. DISTRIBUTION OF THIS DOCUMENT DOES NOT CREATE AN
    ATTORNEY-CLIENT RELATIONSHIP. CREATIVE COMMONS PROVIDES THIS
    INFORMATION ON AN "AS-IS" BASIS. CREATIVE COMMONS MAKES NO WARRANTIES
    REGARDING THE USE OF THIS DOCUMENT OR THE INFORMATION OR WORKS
    PROVIDED HEREUNDER, AND DISCLAIMS LIABILITY FOR DAMAGES RESULTING FROM
    THE USE OF THIS DOCUMENT OR THE INFORMATION OR WORKS PROVIDED
    HEREUNDER.

Statement of Purpose

The laws of most jurisdictions throughout the world automatically confer
exclusive Copyright and Related Rights (defined below) upon the creator
and subsequent owner(s) (each and all, an "owner") of an original work of
authorship and/or a database (each, a "Work").

Certain owners wish to permanently relinquish those rights to a Work for
the purpose of contributing to a commons of creative, cultural and
scientific works ("Commons") that the public can reliably and without fear
of later claims of infringement build upon, modify, incorporate in other
works, reuse and redistribute as freely as possible in any form whatsoever
and for any purposes, including without limitation commercial purposes.
These owners may contribute to the Commons to promote the ideal of a free
culture and the further production of creative, cultural and scientific
works, or to gain reputation or greater distribution for their Work in
part through the use and efforts of others.

For these and/or other purposes and motivations, and without any
expectation of additional consideration or compensation, the person
associating CC0 with a Work (the "Affirmer"), to the extent that he or she
is an owner of Copyright and Related Rights in the Work, voluntarily
elects to apply CC0 to the Work and publicly distribute the Work under its
terms, with knowledge of his or her Copyright and Related Rights in the
Work and the meaning and intended legal effect of CC0 on those rights.

1. Copyright and Related Rights. A Work made available under CC0 may be
protected by copyright and related or neighboring rights ("Copyright and
Related Rights"). Copyright and Related Rights include, but are not
limited to, the following:

  i. the right to reproduce, adapt, distribute, perform, display,
     communicate, and translate a Work;
 ii. moral rights retained by the original author(s) and/or performer(s);
iii. publicity and privacy rights pertaining to a person's image or
     likeness depicted in a Work;
 iv. rights protecting against unfair competition in regards to a Work,
     subject to the limitations in paragraph 4(a), below;
  v. rights protecting the extraction, dissemination, use and reuse of data
     in a Work;
 vi. database rights (such as those arising under Directive 96/9/EC of the
     European Parliament and of the Council of 11 March 1996 on the legal
     protection of databases, and under any national implementation
     thereof, including any amended or successor version of such
     directive); and
vii. other similar, equivalent or corresponding rights throughout the
     world based on applicable law or treaty, and any national
     implementations thereof.

2. Waiver. To the greatest extent permitted by, but not in contravention
of, applicable law, Affirmer hereby overtly, fully, permanently,
irrevocably and unconditionally waives, abandons, and surrenders all of
Affirmer's Copyright and Related Rights and associated claims and causes
of action, whether now known or unknown (including existing as well as
future claims and causes of action), in the Work (i) in all territories
worldwide, (ii) for the maximum duration provided by applicable law or
treaty (including future time extensions), (iii) in any current or future
medium and for any number of copies, and (iv) for any purpose whatsoever,
including without limitation commercial, advertising or promotional
purposes (the "Waiver"). Affirmer makes the Waiver for the benefit of each
member of the public at large and to the detriment of Affirmer's heirs and
successors, fully intending that such Waiver shall not be subject to
revocation, rescission, cancellation, termination, or any other legal or
equitable action to disrupt the quiet enjoyment of the Work by the public
as contemplated by Affirmer's express Statement of Purpose.

3. Public License Fallback. Should any part of the Waiver for any reason
be judged legally invalid or ineffective under applicable law, then the
Waiver shall be preserved to the maximum extent permitted taking into
account Affirmer's express Statement of Purpose. In addition, to the
extent the Waiver is so judged Affirmer hereby grants to each affected
person a royalty-free, non transferable, non sublicensable, non exclusive,
irrevocable and unconditional license to exercise Affirmer's Copyright and
Related Rights in the Work (i) in all territories worldwide, (ii) for the
maximum duration provided by applicable law or treaty (including future
time extensions), (iii) in any current or future medium and for any number
of copies, and (iv) for any purpose whatsoever, including without
limitation commercial, advertising or promotional purposes (the
"License"). The License shall be deemed effective as of the date CC0 was
applied by Affirmer to the Work. Should any part of the License for any
reason be judged legally invalid or ineffective under applicable law, such
partial invalidity or ineffectiveness shall not invalidate the remainder
of the License, and in such case Affirmer hereby affirms that he or she
will not (i) exercise any of his or her remaining Copyright and Related
Rights in the Work or (ii) assert any associated claims and causes of
action with respect to the Work, in either case contrary to Affirmer's
express Statement of Purpose.

4. Limitations and Disclaimers.

 a. No trademark or patent rights held by Affirmer are waived, abandoned,
    surrendered, licensed or otherwise affected by this document.
 b. Affirmer offers the Work as-is and makes no representations or
    warranties of any kind concerning the Work, express, implied,
    statutory or otherwise, including without limitation warranties of
    title, merchantability, fitness for a particular purpose, non
    infringement, or the absence of latent or other defects, accuracy, or
    the present or absence of errors, whether or not discoverable, all to
    the greatest extent permissible under applicable law.
 c. Affirmer disclaims responsibility for clearing rights of other persons
    that may apply to the Work or any use thereof, including without
    limitation any person's Copyright and Related Rights in the Work.
    Further, Affirmer disclaims responsibility for obtaining any necessary
    consents, permissions or other rights required for any use of the
    Work.
 d. Affirmer understands and acknowledges that Creative Commons is not a
    party to this document and has no duty or obligation with respect to
    this CC0 or use of the Work.
```

### Creative Commons Attribution 4.0: Font Awesome Free

- [Font Awesome Free](https://github.com/FortAwesome/Font-Awesome/blob/afecf2af5d897b763e5e8e28d46aad2f710ccad6/LICENSE.txt)
  (in `@excalidraw/excalidraw@0.18.1`)

```
Font Awesome Free License
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
to represent the company, product, or service to which they refer.**
```

### ISC License: inherits

- [inherits 2.0.4](https://www.npmjs.com/package/inherits/v/2.0.4) (in `pica@7.1.1` and `image-blob-reduce@3.0.1`):
  Copyright (c) Isaac Z. Schlueter

```
The ISC License

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
```

### MIT License: harfbuzzjs

- [harfbuzzjs 0.3.6](https://github.com/harfbuzz/harfbuzzjs/blob/v0.3.6/LICENSE) (in `@excalidraw/excalidraw@0.18.1`):
  Copyright (c) 2019 Ebrahim Byagowi

```
Apache license for Zephyr libc implementations (zephyr-string.c),
emmalloc.cpp (from emscripten project) and MIT for rest of the project

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
SOFTWARE.
```

### MIT License: lodash.debounce, lodash.throttle

- `lodash.debounce@4.0.8`, `lodash.throttle@4.1.1`: Copyright jQuery Foundation and other contributors
  <https://jquery.org/>

```
Based on Underscore.js, copyright Jeremy Ashkenas,
DocumentCloud and Investigative Reporters & Editors <http://underscorejs.org/>

This software consists of voluntary contributions made by many
individuals. For exact contribution history, see the revision history
available at https://github.com/lodash/lodash

The following license applies to all parts of this software except as
documented below:

====

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

====

Copyright and related rights for sample code are waived via CC0. Sample
code is defined as all source code displayed within the prose of the
documentation.

CC0: http://creativecommons.org/publicdomain/zero/1.0/

====

Files located in the node_modules and vendor directories are externally
maintained libraries used by this software which have their own
licenses; we recommend you read them, as their terms may differ from the
terms above.
```

### MIT License: sliced

- `sliced@1.0.1`: Copyright (c) 2012 \[Aaron Heckmann\](aaron.heckmann+github@gmail.com)

```
Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

### MIT License: Storybook

- [Storybook, February 2020](https://github.com/storybookjs/storybook/blob/5fda73c07088ea72cf3b21c42475864aa06620fc/LICENSE)
  (in `@excalidraw/excalidraw@0.18.1`): Copyright (c) 2017 Kadira Inc. <hello@kadira.io>

```
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
THE SOFTWARE.
```

### MIT License: webworkify

- [webworkify 1.5.0](https://www.npmjs.com/package/webworkify/v/1.5.0) (in `pica@7.1.1` and `image-blob-reduce@3.0.1`)

```
This software is released under the MIT license:

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
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

### Old MIT License: HarfBuzz

- [HarfBuzz at e079dd2, the commit harfbuzzjs 0.3.6 builds](https://github.com/harfbuzz/harfbuzz/blob/e079dd20304bacd8d753eee2ceacbaa1a3978a34/COPYING)
  (in `@excalidraw/excalidraw@0.18.1`):
  - Copyright © 2010-2022  Google, Inc.
  - Copyright © 2015-2020  Ebrahim Byagowi
  - Copyright © 2019,2020  Facebook, Inc.
  - Copyright © 2012,2015  Mozilla Foundation
  - Copyright © 2011  Codethink Limited
  - Copyright © 2008,2010  Nokia Corporation and/or its subsidiary(-ies)
  - Copyright © 2009  Keith Stribley
  - Copyright © 2011  Martin Hosken and SIL International
  - Copyright © 2007  Chris Wilson
  - Copyright © 2005,2006,2020,2021,2022,2023  Behdad Esfahbod
  - Copyright © 2004,2007,2008,2009,2010,2013,2021,2022,2023  Red Hat, Inc.
  - Copyright © 1998-2005  David Turner and Werner Lemberg
  - Copyright © 2016  Igalia S.L.
  - Copyright © 2022  Matthias Clasen
  - Copyright © 2018,2021  Khaled Hosny
  - Copyright © 2018,2019,2020  Adobe, Inc
  - Copyright © 2013-2015  Alexei Podtelezhnikov

```
HarfBuzz is licensed under the so-called "Old MIT" license.  Details follow.
For parts of HarfBuzz that are licensed under different licenses see individual
files names COPYING in subdirectories where applicable.

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
PROVIDE MAINTENANCE, SUPPORT, UPDATES, ENHANCEMENTS, OR MODIFICATIONS.
```

### zlib License: zlib

- [zlib](https://github.com/nodeca/pako/blob/2.0.3/lib/zlib/deflate.js#L3-L20) (in `pako@2.0.3`):
  - (C) 1995-2013 Jean-loup Gailly and Mark Adler
  - (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin

```
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
3. This notice may not be removed or altered from any source distribution.
```
