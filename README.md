# Homebox E-Shop Connector Suite

[![CI](https://github.com/Cougar/userscript-homebox/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Cougar/userscript-homebox/actions/workflows/ci.yml?query=branch%3Amain)

A modular browser userscript suite that connects online stores directly to your self-hosted [Homebox](https://homebox.software/) inventory instance. With a single click, save purchased tools, hardware, and components into Homebox complete with pricing, purchase dates, seller information, high-resolution photo galleries, and PDF manuals.

## Features

- **One-Click Imports**: Injects seamless "Add to Homebox" buttons onto product pages and catalog search grids.
- **Rich Metadata Extraction**: Automatically parses prices, item descriptions, SKUs, brand information, and transaction timestamps.
- **Full Gallery & Attachment Downloads**: Downloads original high-resolution photos and product manuals (PDFs) and uploads them directly to Homebox via background workers.
- **Modular & Decoupled Architecture**: Separate Core engine and lightweight store adapters communicate via a versioned browser-level CustomEvent IPC protocol (`v1.0.0`).
- **Per-Store Overrides**: Configure custom target locations (e.g. Workshop, Garage) and tags (e.g. `handymann`, `tools`) specifically for individual stores or entire platforms.

## Supported Stores & Platforms

| Store / Platform                   | Userscript File (One-Click Install)                                                                                                               | Target Domains                                    |
| :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------ |
| **Homebox Core Engine** (Required) | [`homebox-core.user.js`](https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-core.user.js)                                   | All supported stores                              |
| **Handymann & WooCommerce**        | [`homebox-platform-woocommerce.user.js`](https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-platform-woocommerce.user.js)   | `*.handymann.ee` & generic WooCommerce stores     |
| **Oomipood (OpenCart)**            | [`homebox-platform-opencart.user.js`](https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-platform-opencart.user.js)         | `*.oomipood.ee`                                   |
| **Bauhof (StorefrontUI)**          | [`homebox-platform-storefrontui.user.js`](https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-platform-storefrontui.user.js) | `*.bauhof.ee`                                     |
| **Bauhaus (Magento)**              | [`homebox-platform-magento.user.js`](https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-platform-magento.user.js)           | `*.bauhaus.ee`                                    |
| **Osta.ee**                        | [`homebox-custom-osta.user.js`](https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-custom-osta.user.js)                     | `*.osta.ee`                                       |
| **DEPO Online**                    | [`homebox-custom-depo.user.js`](https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-custom-depo.user.js)                     | `*.depo.ee`, `*.depo.lv`                          |
| **Arvutitark**                     | [`homebox-custom-arvutitark.user.js`](https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-custom-arvutitark.user.js)         | `*.arvutitark.ee`                                 |
| **Euronics**                       | [`homebox-custom-euronics.user.js`](https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-custom-euronics.user.js)             | `*.euronics.ee`, `*.euronics.lv`, `*.euronics.lt` |

## Installation (For Users)

1. **Install a Userscript Manager**:
   Install [Violentmonkey](https://violentmonkey.github.io/) (recommended) or [Tampermonkey](https://www.tampermonkey.net/) in your browser.

2. **Install the Core Script**:
   Install [`homebox-core.user.js`](https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-core.user.js). This manages Homebox authentication, settings, and the background import pipeline.

3. **Install Store Adapters**:
   Install the adapter userscript(s) for the stores you shop at from the table above (e.g., [`homebox-platform-woocommerce.user.js`](https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-platform-woocommerce.user.js) for Handymann).

## Configuration

1. Visit any supported store.
2. Open your userscript manager menu (Violentmonkey/Tampermonkey icon in the browser toolbar) and click **"Configure Homebox connection"**.
3. Fill in:
   - **Homebox Server URL**: Your instance URL (e.g. `https://homebox.yourdomain.com`).
   - **API Token**: Generated from your Homebox user settings (`hb_...`).
   - Click **Load collections** to choose your collection (tenant), then choose your default location and default tags.
4. _(Optional)_ Under **Store & Platform Overrides**, you can customize specific target locations and tags for the current store (e.g., tagging items from `handymann.ee` with a dedicated `"handymann"` tag).
5. Click **Save**.

## For Developers

This project is developed with the assistance of [Gemini CLI](https://github.com/google-gemini/gemini-cli) to automate refactoring, code quality enforcement, and versioning workflows.

The codebase is split into a central Core engine and lightweight platform adapters communicating over standard browser `CustomEvent` envelopes (`v1.0.0`). Adapters remain zero-privilege, uncredentialed DOM scrapers, while Core manages network interactions, credentials, and UI theming.

For detailed architecture diagrams, IPC event specifications, and coding standards, refer to [`GEMINI.md`](./GEMINI.md).

## License

MIT License.
