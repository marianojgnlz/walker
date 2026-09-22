# Walker

Walker is a fork of [Code - OSS](https://github.com/microsoft/vscode) — the open source repository behind [Visual Studio Code](https://code.visualstudio.com) — maintained at [github.com/marianojgnlz/walker](https://github.com/marianojgnlz/walker).

It tracks upstream `microsoft/vscode` and diverges through product identity and product-level customizations, in the spirit of other VSCodium-style distributions.

## Relationship to Visual Studio Code

Visual Studio Code is a distribution of the `Code - OSS` repository with Microsoft-specific customizations, released under a traditional [Microsoft product license](https://code.visualstudio.com/License/).

Walker is not affiliated with, endorsed by, or sponsored by Microsoft. "Visual Studio Code" and "VS Code" are trademarks of Microsoft Corporation. Walker is distributed under the MIT license of the underlying `Code - OSS` source; see [LICENSE.txt](LICENSE.txt) and [ThirdPartyNotices.txt](ThirdPartyNotices.txt).

## Building from source

Walker builds exactly like Code - OSS. You need Node.js `24.18.0` (see `.nvmrc`).

```bash
npm install
npm run compile        # or: npm run watch
./scripts/code.sh      # launch the dev build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development workflow, and `.github/copilot-instructions.md` for architecture notes and coding conventions.

## Product identity

Product identity (names, application identifiers, data folders, URL protocol) is defined in [product.json](product.json):

- Application name: `walker` (CLI: `walker`)
- User data folder: `~/.walker` (`%APPDATA%\Walker` on Windows)
- URL protocol: `walker://`
- Server/tunnel: `walker-server`, `walker-tunnel`

## Issues

Please file issues and feature requests in [this repository's issue tracker](https://github.com/marianojgnlz/walker/issues). For bugs that reproduce in stock Visual Studio Code, report them to [microsoft/vscode](https://github.com/microsoft/vscode/issues) instead.
