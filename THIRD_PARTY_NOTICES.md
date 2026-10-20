# Third-party notices

Original Venus Workspace code is licensed under the MIT License. The copyright notice for that code is `Copyright (c) 2026 Akira Yuzai`. The text is in `LICENSE` at the root of the source archive and at the root of the unsigned extension archive.

Third-party software keeps its own license and copyright. Nothing in this file relicenses it as Venus code. The Venus name, icons, and branding are not a trademark registration and are not claimed as a registered mark.

The files under `licenses/` are verbatim copies of the license and notice files from the locked package versions that are bundled into the Firefox extension. They were taken from the installed npm packages. No upstream notice was invented.

| Package | Locked version | License | Bundled | Included text |
|---|---|---|---|---|
| react | 19.1.0 | MIT | Yes, in the extension JavaScript | `licenses/react/LICENSE` |
| react-dom | 19.1.0 | MIT | Yes, in the extension JavaScript | `licenses/react-dom/LICENSE` |
| scheduler | 0.26.0 | MIT | Yes, as the React DOM scheduler dependency inside the extension JavaScript | `licenses/scheduler/LICENSE` |
| dexie | 4.0.11 | Apache-2.0 | Yes, in `background.js` and the application chunk | `licenses/dexie/LICENSE` and `licenses/dexie/NOTICE` |
| zod | 3.24.2 | MIT | Yes, in the extension JavaScript | `licenses/zod/LICENSE` |
| jalaali-js | 2.0.1 | MIT | Yes, in the extension JavaScript | `licenses/jalaali-js/LICENSE` |
| rrule-temporal | 2.2.8 | MIT | Yes, in the extension JavaScript | `licenses/rrule-temporal/LICENSE` |
| temporal-polyfill | 1.0.5 | MIT | Yes, in the extension JavaScript | `licenses/temporal-polyfill/LICENSE` |
| temporal-spec | 1.0.1 | Apache-2.0 | Yes, as a dependency of rrule-temporal and temporal-polyfill | `licenses/temporal-spec/LICENSE` |
| temporal-utils | 1.0.3 | MIT | Yes, as a dependency of temporal-polyfill | `licenses/temporal-utils/LICENSE` |
| @zip.js/zip.js | 2.23.0 | BSD-3-Clause | Yes, in the extension JavaScript through the native entry `index-native.js` | `licenses/zip.js/LICENSE` |

React, React DOM, and scheduler each carry this copyright line in their own license file: `Copyright (c) Meta Platforms, Inc. and affiliates.` Zod's license file says `Copyright (c) 2020 Colin McDonnell`. Dexie's `NOTICE` file, as shipped with 4.0.11, says `Copyright (c) 2014-2017 David Fahlander` and points at the Apache License, Version 2.0. That NOTICE file is included unchanged. Dexie does not become MIT code. `jalaali-js@2.0.1` is MIT, `Copyright (c) 2020 Behrang Norouzinia`. `rrule-temporal@2.2.8` is MIT, `Copyright (c) 2024 ggaabe`. `temporal-polyfill@1.0.5` and `temporal-utils@1.0.3` are MIT, `Copyright (c) 2026 Adam Shaw`. `temporal-spec@1.0.1` is Apache-2.0, `Copyright 2026 Adam Shaw`. It ships no separate NOTICE file. The Apache-2.0 license text is included unchanged. temporal-spec does not become MIT code. `@zip.js/zip.js@2.23.0` is BSD-3-Clause, `Copyright (c) 2023, Gildas Lormeau`. The license text is included unchanged. It does not become MIT code, and the author name is not used to endorse Venus.

These same `LICENSE`, `THIRD_PARTY_NOTICES.md`, and `licenses/` files are placed in the unsigned extension archive because the bundled libraries are distributed there, and in the source archive so a reviewer can rebuild and compare.

The 96×96 and 48×48 icons are local solid-color test images. No external artwork or fonts are included.

Development-only tools, including WXT, Vite, Vitest, ESLint, and web-ext, are used to build or test. They are not files inside the extension archive. Their presence in the npm lockfile does not relicense the extension.
