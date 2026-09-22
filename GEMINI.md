# GEMINI Context - Userscripts

This file provides system/instructional context for working within this workspace, specifically tailored for Gemini CLI.

## Project Overview

This repository is a modular suite of browser userscripts (Tampermonkey / Violentmonkey / Greasemonkey) designed to connect various e-commerce websites directly to a self-hosted **Homebox** inventory instance.

### Tech Stack & Core Technologies

- **JavaScript (ES6+)**: Raw client-side scripting.
- **Browser DOM APIs**: Native web APIs for DOM manipulation, event handling, and CustomEvent IPC.
- **Userscript Managers**: Violentmonkey, Tampermonkey, Greasemonkey.
- **Version Control**: Managed via **Git** with short-lived feature branches.

---

## Architecture: Core + Platform Adapter Suite

The userscript suite is decoupled into a central **Core Engine** and lightweight **Platform Adapters** communicating via a versioned, browser-level `CustomEvent` Inter-Process Communication (IPC) protocol.

### 1. Main Files & Components

- `homebox-core.user.js`: Central background engine managing credentials (`GM_setValue`), Homebox API endpoints, multi-tenant collections, location trees, tag management, settings modal UI, button DOM injection, and the 3-step import pipeline.
- `homebox-platform-woocommerce.user.js`: Platform adapter for WooCommerce (supporting Handymann.ee and generic WooCommerce stores).
- `homebox-platform-opencart.user.js`: Platform adapter for OpenCart (supporting Oomipood.ee and generic OpenCart stores).
- `homebox-platform-storefrontui.user.js`: Platform adapter for StorefrontUI / Nuxt (supporting Bauhof.ee and generic StorefrontUI stores).
- `homebox-platform-magento.user.js`: Platform adapter for Magento (supporting Bauhaus.ee and generic Magento stores).
- `homebox-custom-osta.user.js`: Dedicated custom adapter for Osta.ee (handling auction/buy prices, seller metadata, and direct HTML `/orig/` high-res photo parsing).
- `homebox-custom-depo.user.js`: Dedicated custom adapter for DEPO Online React SPA (handling table attributes and upscaled 4000x4000 image regex).
- `eslint.config.mjs`: ESLint Flat Configuration file defining browser and Greasemonkey environments.

---

## IPC Protocol Specification (`v1.0.0`)

All communication between Core and Adapters occurs via standard DOM `CustomEvent` dispatches on the shared `window` object.

### Standard Message Envelope

```typescript
interface HomeboxIPCEnvelope<T = any> {
  protocolVersion: "1.0.0";
  messageId: string;
  sender: "core" | "adapter";
  adapterId: string;
  adapterName?: string;
  action: "register" | "handshake-ack" | "scrape:trigger" | "scrape:result";
  payload: T;
}
```

### Event Lifecycle & Handshake Flow

1. **Registration (`homebox:register`)**: When an adapter loads, it dispatches its `ADAPTER_ID`, target selectors, and theme configuration to Core.
2. **Handshake Ack (`homebox:handshake-ack`)**: Core replies immediately, confirming active connection.
3. **Bi-Directional Health Checks**:
   - **Missing Core Check**: If an adapter receives no handshake acknowledgment within 500ms, it logs an error to the console with the Core script installation link and registers an alert under the Greasemonkey/Violentmonkey extension menu (`GM_registerMenuCommand`).
   - **Missing Adapter Check**: If Core receives no adapter registration within 1500ms of page load, it logs a warning in the console that an adapter userscript for the current site is missing and needs to be installed.
4. **Scrape Trigger (`homebox:scrape:trigger`)**: When a user clicks an injected button, Core sets the button to loading and asks the adapter to scrape the product.
5. **Scrape Result (`homebox:scrape:result`)**: Adapter scrapes the page (or fetches details asynchronously in background for catalog cards) and returns rich product metadata.
6. **Import Execution**: Core executes the 3-step Homebox import pipeline and updates the button state.

---

## Theming & Chameleon Button Styling

To keep adapter files minimal and avoid CSS duplication:

- **Core manages state & behavior**: Core provides loading spinners, checkmarks, toasts, and fallback emerald green styling.
- **Adapters manage aesthetics**: Adapters declare `nativeClasses` (cloning host page classes such as `['btn', 'btn-primary']`) and optional `styleOverrides` (e.g. margins) so that buttons naturally blend into the host e-shop's visual design.

---

## Development Conventions

- **Indentation**: 2 spaces.
- **No Trailing Whitespace**: Every line must be trimmed.
- **Line Endings**: Single clean Unix newline at end of file.
- **Linting & Formatting**:
  ```bash
  npx eslint *.user.js
  npx prettier --check *.user.js
  npx prettier --write *.user.js
  ```
