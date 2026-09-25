// ==UserScript==
// @name         Homebox Connector - Core
// @namespace    https://github.com/Cougar/userscript-homebox
// @version      1.0.1
// @description  Core background engine and API connector for Homebox e-shop userscripts
// @author       Cougar
// @homepageURL  https://github.com/Cougar/userscript-homebox
// @supportURL   https://github.com/Cougar/userscript-homebox/issues
// @downloadURL  https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-core.user.js
// @updateURL    https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-core.user.js
// @match        *://*.handymann.ee/*
// @match        *://*.osta.ee/*
// @match        *://*.oomipood.ee/*
// @match        *://*.bauhof.ee/*
// @match        *://*.bauhaus.ee/*
// @match        *://*.depo.ee/*
// @match        *://*.depo.lv/*
// @match        *://*.arvutitark.ee/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function () {
  "use strict";

  // --- Constants ---
  const PROTOCOL_VERSION = "1.0.0";
  const ADAPTER_NAMES = {
    "platform-woocommerce": "WooCommerce",
    "platform-opencart": "OpenCart",
    "platform-storefrontui": "StorefrontUI",
    "platform-magento": "Magento",
    "custom-osta": "Osta.ee",
    "custom-depo": "DEPO Online",
    "custom-arvutitark": "Arvutitark",
    woocommerce: "WooCommerce",
    opencart: "OpenCart",
    storefrontui: "StorefrontUI",
    magento: "Magento",
    osta: "Osta.ee",
    depo: "DEPO Online",
    arvutitark: "Arvutitark",
  };

  // --- CSS Styles ---
  const GLOBAL_CSS = `
    /* Homebox Toast Notifications */
    .homebox-toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #1f2937;
      color: #ffffff;
      padding: 12px 24px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 99999;
      font-size: 14px;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: homeboxSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes homeboxSlideIn {
      from { transform: translateX(120%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    /* Settings Modal overlay */
    .homebox-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(2px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 999999;
      font-family: system-ui, -apple-system, sans-serif;
    }

    /* Modal dialog structure */
    .homebox-modal {
      background: #ffffff;
      color: #1f2937;
      width: 90%;
      max-width: 480px;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      overflow: hidden;
      animation: homeboxFadeIn 0.2s ease-out;
    }
    @keyframes homeboxFadeIn {
      from { opacity: 0; transform: scale(0.95) translateY(-10px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    /* Modal header */
    .homebox-header {
      background: #10b981;
      color: #ffffff;
      padding: 16px 20px;
      font-size: 18px;
      font-weight: 700;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .homebox-header-close {
      cursor: pointer;
      font-size: 24px;
      border: none;
      background: none;
      color: #ffffff;
      line-height: 1;
      padding: 0;
      opacity: 0.8;
      transition: opacity 0.15s;
    }
    .homebox-header-close:hover {
      opacity: 1;
    }

    /* Modal forms */
    .homebox-body {
      padding: 20px;
      max-height: 70vh;
      overflow-y: auto;
    }
    .homebox-form-group {
      margin-bottom: 16px;
    }
    .homebox-label {
      display: block;
      margin-bottom: 6px;
      font-weight: 600;
      font-size: 13px;
      color: #4b5563;
    }
    .homebox-input, .homebox-select {
      width: 100%;
      height: 40px !important;
      min-height: 40px !important;
      border: 1px solid #d1d5db !important;
      border-radius: 6px !important;
      box-sizing: border-box !important;
      font-size: 14px !important;
      background-color: #ffffff !important;
      color: #1f2937 !important;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      margin: 0 !important;
    }
    .homebox-input {
      padding: 0 12px !important;
      line-height: normal !important;
    }
    .homebox-select:not([multiple]) {
      height: 40px !important;
      line-height: 38px !important;
      padding: 0 32px 0 12px !important;
      background-image: url('data:image/svg+xml;charset=US-ASCII,<svg%20xmlns="http://www.w3.org/2000/svg"%20width="16"%20height="16"%20viewBox="0 0%2024%2024"%20fill="none"%20stroke="%236b7280"%20stroke-width="2"%20stroke-linecap="round"%20stroke-linejoin="round"><polyline%20points="6%209%2012%2015%2018%209"></polyline></svg>') !important;
      background-repeat: no-repeat !important;
      background-position: right 10px center !important;
      background-size: 16px 16px !important;
      -webkit-appearance: none !important;
      -moz-appearance: none !important;
      appearance: none !important;
    }
    .homebox-select[multiple] {
      height: 90px !important;
      padding: 6px 8px !important;
      line-height: 1.4 !important;
      -webkit-appearance: listbox !important;
      appearance: listbox !important;
    }
    .homebox-input:focus, .homebox-select:focus {
      outline: none !important;
      border-color: #10b981 !important;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2) !important;
    }

    /* Modal footer and buttons */
    .homebox-footer {
      padding: 16px 20px;
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }
    .homebox-btn {
      height: 40px !important;
      min-height: 40px !important;
      line-height: 40px !important;
      padding: 0 18px !important;
      border: none !important;
      border-radius: 6px !important;
      font-weight: 600 !important;
      font-size: 14px !important;
      cursor: pointer !important;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      box-sizing: border-box !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      white-space: nowrap !important;
      margin: 0 !important;
      transition: background-color 0.15s, transform 0.1s !important;
    }
    .homebox-btn-secondary {
      background: #e5e7eb;
      color: #374151;
    }
    .homebox-btn-secondary:hover {
      background: #d1d5db;
    }
    .homebox-btn-secondary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .homebox-btn-primary {
      background: #10b981;
      color: #ffffff;
    }
    .homebox-btn-primary:hover {
      background: #059669;
    }

    /* Base Styling for injected button elements */
    .homebox-injected-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      box-sizing: border-box;
      transition: background-color 0.15s, transform 0.1s, opacity 0.2s;
    }
    .homebox-injected-btn-fallback {
      background: #10b981;
      color: #ffffff;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
    }
    .homebox-injected-btn-fallback:hover {
      background: #059669;
    }
    .homebox-injected-btn.homebox-loading {
      pointer-events: none;
      opacity: 0.8;
    }

    /* Spinner animation nested in buttons */
    .homebox-btn-spinner {
      display: none;
      animation: homeboxRotate 1s linear infinite;
    }
    .homebox-loading .homebox-btn-spinner {
      display: inline-block;
    }
    .homebox-loading .homebox-btn-icon,
    .homebox-loading .homebox-btn-text {
      display: none;
    }

    /* Success indicator nested in buttons */
    .homebox-btn-success-icon {
      display: none;
    }
    .homebox-success .homebox-btn-success-icon {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .homebox-success .homebox-btn-icon,
    .homebox-success .homebox-btn-text {
      display: none;
    }

    /* Product card quick-add catalog button */
    .homebox-list-btn {
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(16, 185, 129, 0.9);
      color: #ffffff;
      border: none;
      border-radius: 50%;
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 49;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      transition: background-color 0.2s, transform 0.1s, opacity 0.2s;
      opacity: 0;
    }
    .homebox-list-btn:hover {
      background: rgba(5, 150, 105, 1) !important;
      transform: scale(1.1);
    }
    .homebox-list-btn:active {
      transform: scale(0.95);
    }

    /* Standard triggers for quick-add visibility */
    li.product:hover .homebox-list-btn,
    .products .product:hover .homebox-list-btn,
    .wpb-wps-slider-item:hover .homebox-list-btn,
    .product-grid-item:hover .homebox-list-btn,
    .product-item-info:hover .homebox-list-btn {
      opacity: 1;
    }

    /* General Spinner Rotation */
    @keyframes homeboxRotate {
      100% { transform: rotate(360deg); }
    }
  `;

  // --- Helpers ---
  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = "homebox-toast";

    let icon = "ℹ️";
    if (type === "success") {
      icon = "✅";
      toast.style.borderLeft = "4px solid #10b981";
    } else if (type === "error") {
      icon = "❌";
      toast.style.borderLeft = "4px solid #ef4444";
    }

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = "opacity 0.4s ease-out, transform 0.4s ease-out";
      toast.style.opacity = "0";
      toast.style.transform = "translateY(15px)";
      setTimeout(() => {
        toast.remove();
      }, 400);
    }, 3500);
  }

  // --- Debug Logger ---
  function logDebug(action, url, headers, status, responseText) {
    console.group(
      `%c[Homebox Connector Core Debug] - ${action}`,
      "color: #10b981; font-weight: bold; font-size: 12px;",
    );
    console.log(`%cURL:%c ${url}`, "font-weight: bold;", "color: #2563eb;");
    console.log("%cHeaders:", "font-weight: bold;", headers);
    console.log(
      `%cStatus Code:%c ${status}`,
      "font-weight: bold;",
      status === 200 || status === 201
        ? "color: #059669; font-weight: bold;"
        : "color: #dc2626; font-weight: bold;",
    );
    try {
      const parsed = JSON.parse(responseText);
      console.log("%cResponse (JSON):", "font-weight: bold;", parsed);
    } catch {
      console.log(
        `%cResponse (Text):%c ${responseText}`,
        "font-weight: bold;",
        "color: #4b5563;",
      );
    }
    console.groupEnd();
  }

  // --- Config Manager ---
  const Config = {
    load() {
      let tagIds = [];
      try {
        tagIds = JSON.parse(GM_getValue("homebox_tag_ids", "[]"));
      } catch {
        // use default
      }
      return {
        url: GM_getValue("homebox_url", ""),
        token: GM_getValue("homebox_token", ""),
        tenantId: GM_getValue("homebox_tenant_id", ""),
        tenantName: GM_getValue("homebox_tenant_name", ""),
        locationId: GM_getValue("homebox_location_id", ""),
        locationName: GM_getValue("homebox_location_name", ""),
        currency: GM_getValue("homebox_currency", "EUR"),
        tagIds,
      };
    },

    save(config) {
      GM_setValue("homebox_url", config.url);
      GM_setValue("homebox_token", config.token);
      GM_setValue("homebox_tenant_id", config.tenantId);
      GM_setValue("homebox_tenant_name", config.tenantName);
      GM_setValue("homebox_location_id", config.locationId);
      GM_setValue("homebox_location_name", config.locationName);
      GM_setValue("homebox_currency", config.currency);
      GM_setValue("homebox_tag_ids", JSON.stringify(config.tagIds || []));
    },

    isConfigured() {
      const config = this.load();
      return config.url && config.token;
    },

    showSettingsModal() {
      if (document.querySelector(".homebox-overlay")) return;

      const config = this.load();
      const overlay = document.createElement("div");
      overlay.className = "homebox-overlay";

      let loadedGroups = [];
      let shopOverrides = {};

      // Retrieve registered shops from storage and purge non-store subdomains
      let rawRegistered = [];
      try {
        rawRegistered = JSON.parse(
          GM_getValue("homebox_registered_entities", "[]"),
        );
      } catch {
        // ignore
      }

      // Purge legacy storage keys if present
      GM_deleteValue("homebox_dynamic_shops");

      const IGNORED_HOST_PREFIXES = [
        "files.",
        "img.",
        "img-",
        "cdn.",
        "assets.",
        "static.",
        "api.",
        "media.",
      ];
      let registeredEntities = rawRegistered.filter(
        (item) =>
          item.host &&
          !IGNORED_HOST_PREFIXES.some((prefix) => item.host.startsWith(prefix)),
      );

      // Detect current page context
      const currentHost = window.location.hostname
        .replace(/^www\./i, "")
        .toLowerCase();

      let activeAdapterId = Object.keys(activeAdapters)[0] || "";
      if (!activeAdapterId) {
        const matchedEntity = registeredEntities.find(
          (e) => e.host === currentHost,
        );
        if (matchedEntity) {
          activeAdapterId = matchedEntity.adapterId || "";
        }
      }
      const activeAdapterName = activeAdapterId
        ? activeAdapters[activeAdapterId]?.name ||
          ADAPTER_NAMES[activeAdapterId] ||
          activeAdapterId
        : "";

      // Ensure current host is in registered entities if an adapter is active
      if (
        activeAdapterId &&
        !registeredEntities.some((e) => e.host === currentHost)
      ) {
        registeredEntities.push({
          host: currentHost,
          adapterId: activeAdapterId,
          adapterName: activeAdapterName,
        });
      }

      // Group distinct platforms that are actually registered
      const registeredPlatforms = [];
      registeredEntities.forEach((entity) => {
        if (!registeredPlatforms.some((p) => p.id === entity.adapterId)) {
          registeredPlatforms.push({
            id: entity.adapterId,
            name:
              entity.adapterName ||
              ADAPTER_NAMES[entity.adapterId] ||
              entity.adapterId,
          });
        }
      });

      // Load overrides only for registered shops and platforms
      const allOverrideKeys = [
        ...registeredEntities.map((e) => e.host),
        ...registeredPlatforms.map((p) => p.id),
      ];
      allOverrideKeys.forEach((key) => {
        try {
          shopOverrides[key] = JSON.parse(
            GM_getValue(`homebox_override_${key}`, "null"),
          ) || { locationId: "", locationName: "", tagIds: [] };
        } catch {
          shopOverrides[key] = { locationId: "", locationName: "", tagIds: [] };
        }
      });

      // Automatically prune uninstalled/stale shops that have no configured overrides
      registeredEntities = registeredEntities.filter((entity) => {
        if (entity.host === currentHost) return true;
        const ov = shopOverrides[entity.host];
        return ov && (ov.locationId || (ov.tagIds && ov.tagIds.length > 0));
      });

      // Commit cleaned entities back to storage
      GM_setValue(
        "homebox_registered_entities",
        JSON.stringify(registeredEntities),
      );

      const isCurrentShopActive = !!activeAdapterId;
      const otherShops = registeredEntities.filter(
        (e) => e.host !== currentHost,
      );
      const otherPlatforms = registeredPlatforms.filter(
        (p) => p.id !== activeAdapterId && !p.id.startsWith("custom-"),
      );

      function isConfigured(key) {
        const ov = shopOverrides[key];
        return !!(ov && (ov.locationId || (ov.tagIds && ov.tagIds.length > 0)));
      }

      overlay.innerHTML = `
        <div class="homebox-modal">
          <div class="homebox-header">
            <span>Homebox Settings</span>
            <button class="homebox-header-close">&times;</button>
          </div>
          <div class="homebox-body">
            <div class="homebox-form-group">
              <label class="homebox-label">Homebox Server URL</label>
              <input type="text" id="hb-url" class="homebox-input" value="${config.url}" placeholder="https://homebox.sinudomeen.ee">
            </div>
            <div class="homebox-form-group">
              <label class="homebox-label">API Token (hb_...)</label>
              <input type="password" id="hb-token" class="homebox-input" value="${config.token}" placeholder="hb_...">
            </div>
            <div class="homebox-form-group">
              <label class="homebox-label">Collection (X-Tenant)</label>
              <div style="display: flex; gap: 10px; align-items: center;">
                <select id="hb-tenant" class="homebox-select" style="flex: 1;">
                  <option value="${config.tenantId}">${config.tenantName || "Load collections from server..."}</option>
                </select>
                <button id="hb-load-tenants" class="homebox-btn homebox-btn-secondary">Load collections</button>
              </div>
            </div>
            <div class="homebox-form-group">
              <label class="homebox-label">Default Location</label>
              <div style="display: flex; gap: 10px; align-items: center;">
                <select id="hb-location" class="homebox-select" style="flex: 1;" disabled>
                  <option value="${config.locationId}">${config.locationName || "Select location from list..."}</option>
                </select>
                <button id="hb-load-locations" class="homebox-btn homebox-btn-secondary" disabled>Load</button>
              </div>
            </div>
            <div class="homebox-form-group">
              <label class="homebox-label">Default Tags</label>
              <div style="display: flex; gap: 10px; align-items: flex-start;">
                <select id="hb-tags" class="homebox-select" style="flex: 1; height: 90px;" multiple disabled>
                  <!-- Tags loaded dynamically -->
                </select>
                <button id="hb-load-tags" class="homebox-btn homebox-btn-secondary" disabled>Load</button>
              </div>
              <small style="color: #6b7280; font-size: 11px; margin-top: 4px; display: block;">Hold Ctrl/Cmd to select multiple tags.</small>
            </div>

            <!-- Active Page Context Banner -->
            ${
              isCurrentShopActive
                ? `
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px 14px; margin-top: 24px; margin-bottom: 14px;">
              <div style="font-size: 11px; font-weight: 700; color: #15803d; text-transform: uppercase; letter-spacing: 0.5px;">Active Store & Detected Platform</div>
              <div style="font-size: 15px; font-weight: 700; color: #166534; margin-top: 2px;">
                ${currentHost}
              </div>
              <div style="font-size: 12px; color: #16a34a; margin-top: 3px;">${activeAdapterId.startsWith("custom-") ? "Module: <strong>Custom Shop Adapter</strong>" : `Platform module: <strong>${activeAdapterName}</strong>`}</div>
            </div>
            `
                : ""
            }

            <!-- Shop overrides section -->
            <div class="homebox-form-group" style="${isCurrentShopActive ? "" : "margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;"}">
              <label class="homebox-label" style="color: #10b981; font-size: 14px;">Store & Platform Overrides</label>
              ${
                registeredEntities.length === 0
                  ? `<div style="font-size: 12px; color: #6b7280; background: #f9fafb; padding: 10px; border-radius: 6px; border: 1px solid #e5e7eb;">No store modules have registered yet. Visit a supported store to configure overrides for it.</div>`
                  : `
              <select id="hb-override-shop" class="homebox-select">
                <option value="">-- Select store or platform for override --</option>
                ${
                  isCurrentShopActive
                    ? `
                <optgroup label="👉 Current Store & Platform">
                  <option value="${currentHost}" selected>⭐ ${currentHost} (Only this store)${isConfigured(currentHost) ? " ⚙️" : ""}</option>
                  ${
                    !activeAdapterId.startsWith("custom-")
                      ? `<option value="${activeAdapterId}">🌐 All ${activeAdapterName} stores (platform default rule)${isConfigured(activeAdapterId) ? " ⚙️" : ""}</option>`
                      : ""
                  }
                </optgroup>
                `
                    : ""
                }
                ${
                  otherShops.length > 0
                    ? `
                <optgroup label="Other Registered Stores">
                  ${otherShops.map((s) => `<option value="${s.host}">${s.host} [${s.adapterId.startsWith("custom-") ? "Custom Shop" : s.adapterName}]${isConfigured(s.host) ? " ⚙️" : ""}</option>`).join("")}
                </optgroup>
                `
                    : ""
                }
                ${
                  otherPlatforms.length > 0
                    ? `
                <optgroup label="Other Registered Platforms">
                  ${otherPlatforms.map((p) => `<option value="${p.id}">${p.name}${isConfigured(p.id) ? " ⚙️" : ""}</option>`).join("")}
                </optgroup>
                `
                    : ""
                }
              </select>
              `
              }
            </div>
            <div id="hb-shop-override-fields" style="display: none; background: #f9fafb; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; margin-bottom: 16px;">
              <div id="hb-override-status-badge" style="font-size: 12px; padding: 6px 10px; border-radius: 4px; margin-bottom: 12px; display: none;"></div>
              <div class="homebox-form-group">
                <label class="homebox-label">Store Target Location</label>
                <select id="hb-override-location" class="homebox-select">
                  <option value="">-- Use global location --</option>
                </select>
              </div>
              <div class="homebox-form-group">
                <label class="homebox-label">Store Tags</label>
                <select id="hb-override-tags" class="homebox-select" style="height: 80px;" multiple>
                  <!-- Tag elements duplicated here -->
                </select>
              </div>
              <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
                <button type="button" id="hb-delete-override" class="homebox-btn" style="height: 30px !important; min-height: 30px !important; line-height: 30px !important; padding: 0 10px !important; font-size: 12px !important; background: #fee2e2 !important; color: #dc2626 !important; border: 1px solid #fca5a5 !important;">
                  🗑️ Remove this override
                </button>
              </div>
            </div>

          </div>
          <div class="homebox-footer">
            <button id="hb-cancel" class="homebox-btn homebox-btn-secondary">Cancel</button>
            <button id="hb-save" class="homebox-btn homebox-btn-primary">Save</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const closeBtn = overlay.querySelector(".homebox-header-close");
      const cancelBtn = overlay.querySelector("#hb-cancel");
      const saveBtn = overlay.querySelector("#hb-save");
      const loadTenantsBtn = overlay.querySelector("#hb-load-tenants");
      const tenantSelect = overlay.querySelector("#hb-tenant");
      const loadLocationsBtn = overlay.querySelector("#hb-load-locations");
      const locationSelect = overlay.querySelector("#hb-location");
      const loadTagsBtn = overlay.querySelector("#hb-load-tags");
      const tagsSelect = overlay.querySelector("#hb-tags");

      const overrideShopSelect = overlay.querySelector("#hb-override-shop");
      const overrideFieldsDiv = overlay.querySelector(
        "#hb-shop-override-fields",
      );
      const overrideLocSelect = overlay.querySelector("#hb-override-location");
      const overrideTagsSelect = overlay.querySelector("#hb-override-tags");

      let currentOverrideShop = isCurrentShopActive ? currentHost : "";

      const close = () => overlay.remove();

      closeBtn.addEventListener("click", close);
      cancelBtn.addEventListener("click", close);

      // Trigger automatic cascading load if credentials are valid
      if (config.url && config.token) {
        loadTenants(true);
      }

      function loadTenants(autoLoadLocations = false) {
        const url = overlay.querySelector("#hb-url").value.trim();
        const token = overlay.querySelector("#hb-token").value.trim();

        if (!url || !token) {
          showToast("Please enter server URL and Token first!", "error");
          return;
        }

        loadTenantsBtn.disabled = true;
        loadTenantsBtn.textContent = "Loading...";

        HomeboxAPI.getSelf(url, token)
          .then((userData) => {
            const defaultGroup =
              (userData.item && userData.item.defaultGroup) ||
              userData.defaultGroup ||
              "";

            return HomeboxAPI.getGroupsAll(url, token).then((groups) => {
              tenantSelect.innerHTML = "";
              loadedGroups = groups;

              if (groups.length === 0) {
                tenantSelect.innerHTML =
                  '<option value="">No collections found</option>';
                loadLocationsBtn.disabled = true;
                locationSelect.disabled = true;
                loadTagsBtn.disabled = true;
                tagsSelect.disabled = true;
                return;
              }

              groups.forEach((group) => {
                const option = document.createElement("option");
                option.value = group.id;
                option.textContent =
                  group.name || `Collection (${group.id.substring(0, 8)}...)`;
                if (
                  group.id === config.tenantId ||
                  (group.id === defaultGroup && !config.tenantId)
                ) {
                  option.selected = true;
                }
                tenantSelect.appendChild(option);
              });

              loadLocationsBtn.disabled = false;
              locationSelect.disabled = false;
              loadTagsBtn.disabled = false;
              tagsSelect.disabled = false;
              showToast("Collections loaded successfully!", "success");

              if (autoLoadLocations) {
                loadLocations();
              }
            });
          })
          .catch((err) => {
            showToast(err.message, "error");
          })
          .finally(() => {
            loadTenantsBtn.disabled = false;
            loadTenantsBtn.textContent = "Load collections";
          });
      }

      function loadLocations() {
        const url = overlay.querySelector("#hb-url").value.trim();
        const token = overlay.querySelector("#hb-token").value.trim();
        const tenantId = tenantSelect.value;

        if (!url || !token) {
          showToast("Please enter server URL and Token first!", "error");
          return;
        }
        if (!tenantId) {
          showToast("Please select a Collection first!", "error");
          return;
        }

        loadLocationsBtn.disabled = true;
        loadLocationsBtn.textContent = "Loading...";

        HomeboxAPI.getLocations(url, token, tenantId)
          .then((locations) => {
            locationSelect.innerHTML = "";

            if (locations.length === 0) {
              locationSelect.innerHTML =
                '<option value="">No locations found</option>';
              return;
            }

            locations.forEach((loc) => {
              const option = document.createElement("option");
              option.value = loc.id;
              option.textContent = loc.name;
              if (loc.id === config.locationId) {
                option.selected = true;
              }
              locationSelect.appendChild(option);
            });

            showToast("Locations loaded!", "success");
            loadTags();
            updateOverrideFields();
          })
          .catch((err) => {
            showToast(err.message, "error");
          })
          .finally(() => {
            loadLocationsBtn.disabled = false;
            loadLocationsBtn.textContent = "Load";
          });
      }

      function loadTags() {
        const url = overlay.querySelector("#hb-url").value.trim();
        const token = overlay.querySelector("#hb-token").value.trim();
        const tenantId = tenantSelect.value;

        if (!url || !token || !tenantId) return;

        loadTagsBtn.disabled = true;
        loadTagsBtn.textContent = "Loading...";

        HomeboxAPI.getTags(url, token, tenantId)
          .then((tags) => {
            tagsSelect.innerHTML = "";

            if (tags.length === 0) {
              tagsSelect.innerHTML = '<option value="">No tags found</option>';
              return;
            }

            tags.forEach((tag) => {
              const option = document.createElement("option");
              option.value = tag.id;
              option.textContent = tag.name;
              if (config.tagIds && config.tagIds.includes(tag.id)) {
                option.selected = true;
              }
              tagsSelect.appendChild(option);
            });

            tagsSelect.disabled = false;
            showToast("Tags loaded!", "success");
            updateOverrideFields();
          })
          .catch((err) => {
            showToast(err.message, "error");
          })
          .finally(() => {
            loadTagsBtn.disabled = false;
            loadTagsBtn.textContent = "Load";
          });
      }

      function updateOverrideFields() {
        if (!currentOverrideShop) {
          overrideFieldsDiv.style.display = "none";
          return;
        }

        overrideFieldsDiv.style.display = "block";

        // Rebuild Location select
        overrideLocSelect.innerHTML =
          '<option value="">-- Use global location --</option>';
        Array.from(locationSelect.options).forEach((opt) => {
          const clone = document.createElement("option");
          clone.value = opt.value;
          clone.textContent = opt.textContent;
          if (opt.value === shopOverrides[currentOverrideShop].locationId) {
            clone.selected = true;
          }
          overrideLocSelect.appendChild(clone);
        });

        // Rebuild Tags select
        overrideTagsSelect.innerHTML = "";
        Array.from(tagsSelect.options).forEach((opt) => {
          const clone = document.createElement("option");
          clone.value = opt.value;
          clone.textContent = opt.textContent;
          if (
            shopOverrides[currentOverrideShop].tagIds &&
            shopOverrides[currentOverrideShop].tagIds.includes(opt.value)
          ) {
            clone.selected = true;
          }
          overrideTagsSelect.appendChild(clone);
        });

        // Update status badge
        const statusBadge = overrideFieldsDiv.querySelector(
          "#hb-override-status-badge",
        );
        if (statusBadge) {
          statusBadge.style.display = "block";
          if (isConfigured(currentOverrideShop)) {
            statusBadge.style.background = "#ecfdf5";
            statusBadge.style.color = "#065f46";
            statusBadge.style.border = "1px solid #a7f3d0";
            statusBadge.innerHTML =
              "⚙️ <strong>Override active:</strong> this store has a custom location or tags.";
          } else {
            statusBadge.style.background = "#f3f4f6";
            statusBadge.style.color = "#4b5563";
            statusBadge.style.border = "1px solid #e5e7eb";
            statusBadge.innerHTML =
              "ℹ️ <strong>No override:</strong> using global default location and tags.";
          }
        }
      }

      function refreshOptionBadges() {
        if (!overrideShopSelect) return;
        Array.from(overrideShopSelect.options).forEach((opt) => {
          if (!opt.value) return;
          const has = isConfigured(opt.value);
          const cleanText = opt.textContent.replace(/\s*⚙️\s*$/, "");
          opt.textContent = cleanText + (has ? " ⚙️" : "");
        });
      }

      function saveActiveOverride() {
        if (!currentOverrideShop) return;

        const locId = overrideLocSelect.value;
        const selectedLocOpt =
          overrideLocSelect.options[overrideLocSelect.selectedIndex];
        const locName = selectedLocOpt ? selectedLocOpt.textContent : "";

        const tagIds = Array.from(overrideTagsSelect.selectedOptions)
          .map((opt) => opt.value)
          .filter(Boolean);

        shopOverrides[currentOverrideShop] = {
          locationId: locId,
          locationName: locId ? locName : "",
          tagIds,
        };

        refreshOptionBadges();
      }

      overrideShopSelect.addEventListener("change", (e) => {
        saveActiveOverride();
        currentOverrideShop = e.target.value;
        updateOverrideFields();
      });

      const deleteOverrideBtn = overlay.querySelector("#hb-delete-override");
      if (deleteOverrideBtn) {
        deleteOverrideBtn.addEventListener("click", () => {
          if (!currentOverrideShop) return;
          if (
            !confirm(
              `Are you sure you want to remove the override for "${currentOverrideShop}"?`,
            )
          ) {
            return;
          }

          GM_deleteValue(`homebox_override_${currentOverrideShop}`);
          delete shopOverrides[currentOverrideShop];

          // Also prune from registered entities if not currently active on this page
          let currentRegistered = [];
          try {
            currentRegistered = JSON.parse(
              GM_getValue("homebox_registered_entities", "[]"),
            );
          } catch {
            // ignore
          }
          currentRegistered = currentRegistered.filter(
            (e) =>
              e.host !== currentOverrideShop &&
              e.adapterId !== currentOverrideShop,
          );
          GM_setValue(
            "homebox_registered_entities",
            JSON.stringify(currentRegistered),
          );

          showToast("Override removed!", "info");
          close();
          Config.showSettingsModal();
        });
      }

      loadTenantsBtn.addEventListener("click", () => loadTenants(false));
      loadLocationsBtn.addEventListener("click", loadLocations);
      loadTagsBtn.addEventListener("click", loadTags);

      tenantSelect.addEventListener("change", () => {
        loadLocations();
      });

      saveBtn.addEventListener("click", () => {
        const url = overlay.querySelector("#hb-url").value.trim();
        const token = overlay.querySelector("#hb-token").value.trim();
        const tenantId = tenantSelect.value;
        const selectedTenantOption =
          tenantSelect.options[tenantSelect.selectedIndex];
        const tenantName = selectedTenantOption
          ? selectedTenantOption.textContent
          : "";
        const locationId = locationSelect.value;
        const selectedLocationOption =
          locationSelect.options[locationSelect.selectedIndex];
        const locationName = selectedLocationOption
          ? selectedLocationOption.textContent
          : "";

        const tagIds = Array.from(tagsSelect.selectedOptions)
          .map((opt) => opt.value)
          .filter(Boolean);

        if (!url || !token) {
          showToast("Please fill in URL and Token fields!", "error");
          return;
        }

        const matchedGroup = loadedGroups.find((g) => g.id === tenantId);
        const currency = matchedGroup
          ? matchedGroup.currency || "EUR"
          : config.currency || "EUR";

        Config.save({
          url,
          token,
          tenantId,
          tenantName,
          locationId,
          locationName,
          currency,
          tagIds,
        });

        // Commit active overrides
        saveActiveOverride();
        Object.keys(shopOverrides).forEach((key) => {
          GM_setValue(
            `homebox_override_${key}`,
            JSON.stringify(shopOverrides[key]),
          );
        });

        showToast("Settings saved successfully!", "success");
        close();
      });
    },
  };

  // --- Homebox API Interface ---
  const HomeboxAPI = {
    getSelf(url, token) {
      return new Promise((resolve, reject) => {
        const requestUrl = `${url.replace(/\/$/, "")}/api/v1/users/self`;
        const headers = {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        };
        GM_xmlhttpRequest({
          method: "GET",
          url: requestUrl,
          headers: headers,
          onload: (response) => {
            logDebug(
              "Get User Self (User Profile)",
              requestUrl,
              headers,
              response.status,
              response.responseText,
            );
            if (response.status === 200) {
              try {
                const data = JSON.parse(response.responseText);
                resolve(data);
              } catch {
                reject(
                  new Error("Invalid JSON response for user profile request."),
                );
              }
            } else {
              reject(
                new Error(
                  `Failed to load user profile (Kood ${response.status})`,
                ),
              );
            }
          },
          onerror: () => {
            logDebug(
              "Get User Self (Error)",
              requestUrl,
              headers,
              0,
              "Network error.",
            );
            reject(new Error("Network error while requesting user profile."));
          },
        });
      });
    },

    getGroupsAll(url, token) {
      return new Promise((resolve, reject) => {
        const requestUrl = `${url.replace(/\/$/, "")}/api/v1/groups/all`;
        const headers = {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        };
        GM_xmlhttpRequest({
          method: "GET",
          url: requestUrl,
          headers: headers,
          onload: (response) => {
            logDebug(
              "Get All Groups (Collections)",
              requestUrl,
              headers,
              response.status,
              response.responseText,
            );
            if (response.status === 200) {
              try {
                const data = JSON.parse(response.responseText);
                resolve(Array.isArray(data) ? data : []);
              } catch {
                reject(new Error("Invalid JSON response for groups request."));
              }
            } else {
              reject(
                new Error(`Failed to load groups (Kood ${response.status})`),
              );
            }
          },
          onerror: () => {
            logDebug(
              "Get All Groups (Error)",
              requestUrl,
              headers,
              0,
              "Network error.",
            );
            reject(new Error("Network error while requesting groups."));
          },
        });
      });
    },

    getTags(url, token, tenantId) {
      return new Promise((resolve, reject) => {
        const requestUrl = `${url.replace(/\/$/, "")}/api/v1/tags`;
        const headers = {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        };
        if (tenantId) {
          headers["X-Tenant"] = tenantId;
        }
        GM_xmlhttpRequest({
          method: "GET",
          url: requestUrl,
          headers: headers,
          onload: (response) => {
            logDebug(
              "Get Tags",
              requestUrl,
              headers,
              response.status,
              response.responseText,
            );
            if (response.status === 200) {
              try {
                const data = JSON.parse(response.responseText);
                const tags = data.tags || (Array.isArray(data) ? data : []);
                resolve(tags);
              } catch {
                reject(new Error("Invalid JSON response for tags request."));
              }
            } else {
              reject(
                new Error(`Failed to load tags (Kood ${response.status})`),
              );
            }
          },
          onerror: () => {
            logDebug(
              "Get Tags (Error)",
              requestUrl,
              headers,
              0,
              "Network error.",
            );
            reject(new Error("Network error while requesting tags."));
          },
        });
      });
    },

    getLocations(url, token, tenantId) {
      return new Promise((resolve, reject) => {
        const requestUrl = `${url.replace(/\/$/, "")}/api/v1/entities/tree`;
        const headers = {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        };
        if (tenantId) {
          headers["X-Tenant"] = tenantId;
        }
        GM_xmlhttpRequest({
          method: "GET",
          url: requestUrl,
          headers: headers,
          onload: (response) => {
            logDebug(
              "Get Location Tree",
              requestUrl,
              headers,
              response.status,
              response.responseText,
            );
            if (response.status === 200) {
              try {
                const data = JSON.parse(response.responseText);
                const tree = Array.isArray(data) ? data : data.item || [];

                const flattenTree = (nodes, depth = 0) => {
                  let list = [];
                  nodes.forEach((node) => {
                    const prefix =
                      "\u00A0\u00A0\u00A0".repeat(depth) +
                      (depth > 0 ? "└─ " : "");
                    list.push({
                      id: node.id,
                      name: prefix + node.name,
                    });
                    if (node.children && node.children.length > 0) {
                      list = list.concat(flattenTree(node.children, depth + 1));
                    }
                  });
                  return list;
                };

                const flatLocations = flattenTree(tree);
                resolve(flatLocations);
              } catch {
                reject(
                  new Error("Invalid JSON response for locations request."),
                );
              }
            } else {
              reject(
                new Error(`Failed to load locations (Kood ${response.status})`),
              );
            }
          },
          onerror: () => {
            logDebug(
              "Get Location Tree (Error)",
              requestUrl,
              headers,
              0,
              "Network error.",
            );
            reject(new Error("Network error while requesting locations."));
          },
        });
      });
    },

    createItem(url, token, tenantId, itemData) {
      return new Promise((resolve, reject) => {
        const requestUrl = `${url.replace(/\/$/, "")}/api/v1/entities`;
        const headers = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        };
        if (tenantId) {
          headers["X-Tenant"] = tenantId;
        }
        GM_xmlhttpRequest({
          method: "POST",
          url: requestUrl,
          headers: headers,
          data: JSON.stringify(itemData),
          onload: (response) => {
            logDebug(
              "Create Entity (Item)",
              requestUrl,
              headers,
              response.status,
              response.responseText,
            );
            if (response.status === 201 || response.status === 200) {
              try {
                const data = JSON.parse(response.responseText);
                resolve(data);
              } catch {
                reject(
                  new Error(
                    "Item was created, but response could not be read.",
                  ),
                );
              }
            } else {
              reject(
                new Error(`Failed to create item (Kood ${response.status})`),
              );
            }
          },
          onerror: () => {
            logDebug(
              "Create Entity (Error)",
              requestUrl,
              headers,
              0,
              "Network error.",
            );
            reject(new Error("Network error while creating item."));
          },
        });
      });
    },

    uploadAttachmentFromUrl(
      url,
      token,
      tenantId,
      itemId,
      imageUrl,
      nameOverride,
    ) {
      return new Promise((resolve, reject) => {
        if (!imageUrl) {
          resolve();
          return;
        }

        GM_xmlhttpRequest({
          method: "GET",
          url: imageUrl,
          responseType: "blob",
          onload: (imgRes) => {
            if (imgRes.status !== 200) {
              reject(
                new Error(`Failed to download image (Kood ${imgRes.status})`),
              );
              return;
            }

            const blob = imgRes.response;
            if (!blob) {
              reject(new Error("Invalid image data."));
              return;
            }

            const formData = new FormData();
            let fileName = nameOverride || "product.jpg";
            if (!nameOverride) {
              try {
                const urlPath = new URL(imageUrl).pathname;
                fileName =
                  urlPath.substring(urlPath.lastIndexOf("/") + 1) ||
                  "product.jpg";
              } catch {
                // Fallback
              }
            } else {
              if (
                imageUrl.toLowerCase().endsWith(".pdf") &&
                !fileName.toLowerCase().endsWith(".pdf")
              ) {
                fileName += ".pdf";
              }
            }

            formData.append("name", fileName);
            formData.append("file", blob, fileName);

            const requestUrl = `${url.replace(/\/$/, "")}/api/v1/entities/${itemId}/attachments`;
            const headers = {
              Authorization: `Bearer ${token}`,
            };
            if (tenantId) {
              headers["X-Tenant"] = tenantId;
            }

            GM_xmlhttpRequest({
              method: "POST",
              url: requestUrl,
              headers: headers,
              data: formData,
              fetch: true,
              onload: (uploadRes) => {
                logDebug(
                  "Upload Attachment",
                  requestUrl,
                  headers,
                  uploadRes.status,
                  uploadRes.responseText,
                );
                if (uploadRes.status === 201 || uploadRes.status === 200) {
                  resolve();
                } else {
                  reject(
                    new Error(
                      `Failed to upload file (Kood ${uploadRes.status})`,
                    ),
                  );
                }
              },
              onerror: () => {
                logDebug(
                  "Upload Attachment (Error)",
                  requestUrl,
                  headers,
                  0,
                  "Network error.",
                );
                reject(new Error("Network error while uploading file."));
              },
            });
          },
          onerror: () => {
            reject(
              new Error("Network error while downloading file from store."),
            );
          },
        });
      });
    },

    updateItem(url, token, tenantId, itemId, updateData) {
      return new Promise((resolve, reject) => {
        const requestUrl = `${url.replace(/\/$/, "")}/api/v1/entities/${itemId}`;
        const headers = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        };
        if (tenantId) {
          headers["X-Tenant"] = tenantId;
        }
        GM_xmlhttpRequest({
          method: "PUT",
          url: requestUrl,
          headers: headers,
          data: JSON.stringify(updateData),
          onload: (response) => {
            logDebug(
              "Update Entity (PUT)",
              requestUrl,
              headers,
              response.status,
              response.responseText,
            );
            if (response.status === 200) {
              try {
                const data = JSON.parse(response.responseText);
                resolve(data);
              } catch {
                reject(
                  new Error(
                    "Item was updated, but response could not be read.",
                  ),
                );
              }
            } else {
              reject(
                new Error(`Failed to update item (Kood ${response.status})`),
              );
            }
          },
          onerror: () => {
            logDebug(
              "Update Entity (Error)",
              requestUrl,
              headers,
              0,
              "Network error.",
            );
            reject(new Error("Network error while updating item."));
          },
        });
      });
    },
  };

  // --- Dynamic UI Injection Engine ---
  const activeAdapters = {};

  function handleImportClick(e, adapterId, mode, cardIndex, btnElement) {
    console.log(
      `%c[Homebox Core] Button Clicked! Starting import flow for adapter: ${adapterId} (mode: ${mode}, cardIndex: ${cardIndex})`,
      "color: #10b981; font-weight: bold; font-size: 13px;",
    );

    if (!Config.isConfigured()) {
      console.warn(
        "[Homebox Core] Credentials not configured! Opening settings modal.",
      );
      showToast("Please configure Homebox connection first!", "error");
      Config.showSettingsModal();
      return;
    }

    const originalHtml = btnElement.innerHTML;
    btnElement.disabled = true;
    btnElement.classList.add("homebox-loading");

    const messageId = crypto.randomUUID();
    console.log(`[Homebox Core] Generated messageId: ${messageId}`);

    // Set up a listener for the scrape result from the active adapter
    const onScrapeResult = (resEvent) => {
      const detail = resEvent.detail;
      const incomingMsgId = detail?.messageId || detail?.payload?.messageId;
      console.log(
        `[Homebox Core] Received homebox:scrape:result (incomingMsgId: ${incomingMsgId}, adapter: ${detail?.adapterId})`,
        detail,
      );

      if (incomingMsgId !== messageId || detail?.adapterId !== adapterId) {
        console.log(
          `[Homebox Core] Ignoring scrape result - messageId mismatch (${incomingMsgId} !== ${messageId}) or adapter mismatch (${detail?.adapterId} !== ${adapterId})`,
        );
        return;
      }

      window.removeEventListener("homebox:scrape:result", onScrapeResult);

      const payload = detail.payload || {};
      if (!payload.success || !payload.itemDetails) {
        console.error("[Homebox Core] Scrape failed:", payload.error);
        showToast(
          `Error scraping product details: ${payload.error || "Unknown error"}`,
          "error",
        );
        resetButton();
        return;
      }

      console.log(
        "[Homebox Core] Scrape successful! Item details:",
        payload.itemDetails,
      );
      executeImport(payload.itemDetails);
    };

    window.addEventListener("homebox:scrape:result", onScrapeResult);

    // Trigger the scrape event to the matching adapter
    console.log(
      `[Homebox Core] Dispatching homebox:scrape:trigger to adapter: ${adapterId}...`,
    );
    window.dispatchEvent(
      new CustomEvent("homebox:scrape:trigger", {
        detail: {
          protocolVersion: PROTOCOL_VERSION,
          messageId,
          sender: "core",
          adapterId,
          action: "scrape:trigger",
          payload: {
            messageId,
            mode,
            cardIndex,
          },
        },
      }),
    );

    function resetButton() {
      btnElement.innerHTML = originalHtml;
      btnElement.classList.remove("homebox-loading");
      btnElement.disabled = false;
    }

    function executeImport(itemDetails) {
      const config = Config.load();

      // Resolve host / domain from item URL or current location
      let host;
      try {
        const u = new URL(
          itemDetails.url || window.location.href,
          window.location.href,
        );
        host = u.hostname.replace(/^www\./i, "").toLowerCase();
      } catch {
        host = window.location.hostname.replace(/^www\./i, "").toLowerCase();
      }

      // Priority override resolution:
      // 1. Specific Hostname override (e.g. "handymann.ee")
      // 2. Platform Adapter override (e.g. "woocommerce")
      // 3. Global settings default
      let hostOverride = null;
      let adapterOverride = null;

      try {
        hostOverride = JSON.parse(
          GM_getValue(`homebox_override_${host}`, "null"),
        );
      } catch {
        // ignore
      }

      try {
        adapterOverride = JSON.parse(
          GM_getValue(`homebox_override_${adapterId}`, "null"),
        );
      } catch {
        // ignore
      }

      const finalLocationId =
        (hostOverride && hostOverride.locationId) ||
        (adapterOverride && adapterOverride.locationId) ||
        config.locationId;

      const finalTagIds =
        hostOverride && hostOverride.tagIds && hostOverride.tagIds.length > 0
          ? hostOverride.tagIds
          : adapterOverride &&
              adapterOverride.tagIds &&
              adapterOverride.tagIds.length > 0
            ? adapterOverride.tagIds
            : config.tagIds || [];

      console.log(
        `[Homebox Core] Override resolution for host "${host}" / adapter "${adapterId}":`,
        {
          hostMatched: !!hostOverride,
          adapterMatched: !!adapterOverride,
          finalLocationId,
          finalTagIds,
        },
      );

      console.log(
        "[Homebox Core] Starting 3-step import pipeline for:",
        itemDetails.name,
      );
      console.log(
        `[Homebox Core] Target collection: ${config.tenantId || "(default)"}, Location: ${finalLocationId || "(none)"}, Tags:`,
        finalTagIds,
      );
      showToast("Product scraped! Creating Homebox item...", "info");

      // Cent value representation
      const centsValue = Math.round((parseFloat(itemDetails.value) || 0) * 100);

      let description = itemDetails.description || "";
      if (description.length > 255) {
        description = description.substring(0, 255);
      }

      const payload = {
        name: itemDetails.name,
        description: description,
        type: "item",
        quantity: 1,
        value: centsValue,
        currency: itemDetails.currency || config.currency || "EUR",
        url: itemDetails.url,
        purchasedAt: new Date().toISOString(),
      };

      if (finalLocationId) {
        payload.parentId = finalLocationId;
      }
      if (itemDetails.manufacturer) {
        payload.manufacturer = itemDetails.manufacturer;
      }

      console.log(
        `[Homebox Core] Step 1/3: Creating item entity at ${config.url}/api/v1/entities...`,
        payload,
      );
      HomeboxAPI.createItem(config.url, config.token, config.tenantId, payload)
        .then((createdItem) => {
          const itemId =
            createdItem.id || (createdItem.item && createdItem.item.id);
          const entityTypeId =
            createdItem.entityTypeId ||
            (createdItem.entityType &&
              (typeof createdItem.entityType === "string"
                ? createdItem.entityType
                : createdItem.entityType.id));

          if (!itemId) {
            throw new Error(
              "Item was created, but item ID was not found in response.",
            );
          }

          console.log(
            `[Homebox Core] Step 1/3 completed! Created item ID: ${itemId}`,
          );
          showToast("Item created! Saving purchase details...", "info");

          const updatePayload = {
            id: itemId,
            name: itemDetails.name,
            description: description,
            quantity: 1,
            parentId: finalLocationId || null,
            entityTypeId: entityTypeId || null,
            purchasePrice: parseFloat(itemDetails.value) || 0,
            purchaseDate: itemDetails.purchaseDate || new Date().toISOString(),
            purchaseFrom: itemDetails.url || "",
            manufacturer: itemDetails.manufacturer || "",
            modelNumber: itemDetails.sku || "",
            tagIds: finalTagIds,
          };

          if (itemDetails.sellerName) {
            updatePayload.fields = [
              {
                name: "seller_name",
                textValue: itemDetails.sellerName,
                type: "text",
              },
              {
                name: "seller_url",
                textValue: itemDetails.sellerUrl || "",
                type: "text",
              },
            ];
          }

          console.log(
            `[Homebox Core] Step 2/3: Updating entity details for ${itemId}...`,
            updatePayload,
          );
          return HomeboxAPI.updateItem(
            config.url,
            config.token,
            config.tenantId,
            itemId,
            updatePayload,
          ).then(() => {
            console.log(`[Homebox Core] Step 2/3 completed!`);
            showToast("Item and purchase details saved!", "success");
            return { itemId, itemDetails };
          });
        })
        .then(({ itemId, itemDetails }) => {
          // Upload gallery photos sequentially
          if (itemDetails.imageUrls && itemDetails.imageUrls.length > 0) {
            console.log(
              `[Homebox Core] Step 3/3: Uploading ${itemDetails.imageUrls.length} images...`,
              itemDetails.imageUrls,
            );
            showToast(
              `Uploading ${itemDetails.imageUrls.length} images...`,
              "info",
            );

            let uploadChain = Promise.resolve();
            itemDetails.imageUrls.forEach((imgUrl, idx) => {
              uploadChain = uploadChain.then(() => {
                console.log(
                  `[Homebox Core] Uploading image ${idx + 1}/${itemDetails.imageUrls.length}: ${imgUrl}`,
                );
                showToast(
                  `Uploading image ${idx + 1}/${itemDetails.imageUrls.length}...`,
                  "info",
                );
                return HomeboxAPI.uploadAttachmentFromUrl(
                  config.url,
                  config.token,
                  config.tenantId,
                  itemId,
                  imgUrl,
                );
              });
            });

            return uploadChain.then(() => {
              console.log("[Homebox Core] All images uploaded successfully!");
              showToast("Images uploaded successfully!", "success");
              return { itemId, itemDetails };
            });
          }
          return { itemId, itemDetails };
        })
        .then(({ itemId, itemDetails }) => {
          // Upload extra file attachments sequentially
          if (itemDetails.attachments && itemDetails.attachments.length > 0) {
            console.log(
              `[Homebox Core] Uploading ${itemDetails.attachments.length} attachments...`,
              itemDetails.attachments,
            );
            showToast(
              `Uploading ${itemDetails.attachments.length} files...`,
              "info",
            );

            let uploadChain = Promise.resolve();
            itemDetails.attachments.forEach((file, idx) => {
              uploadChain = uploadChain.then(() => {
                console.log(
                  `[Homebox Core] Uploading attachment ${idx + 1}/${itemDetails.attachments.length}: ${file.name}`,
                );
                showToast(
                  `Uploading file ${idx + 1}/${itemDetails.attachments.length}: ${file.name}...`,
                  "info",
                );
                return HomeboxAPI.uploadAttachmentFromUrl(
                  config.url,
                  config.token,
                  config.tenantId,
                  itemId,
                  file.url,
                  file.name,
                );
              });
            });

            return uploadChain.then(() => {
              console.log(
                "[Homebox Core] All attachments uploaded successfully!",
              );
              showToast("Files uploaded successfully!", "success");
            });
          }
        })
        .then(() => {
          console.log(
            `%c[Homebox Core] Import completed successfully for ${itemDetails.name}!`,
            "color: #059669; font-weight: bold; font-size: 13px;",
          );
          btnElement.innerHTML = `
            <svg class="homebox-btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: middle; margin-right: 6px;">
              <path d="M20 6L9 17l-5-5"></path>
            </svg>
            Added!
          `;
          btnElement.classList.remove("homebox-loading");
          btnElement.classList.add("homebox-success");

          setTimeout(() => {
            btnElement.classList.remove("homebox-success");
            resetButton();
          }, 2500);
        })
        .catch((err) => {
          console.error("[Homebox Core Error during import]", err);
          showToast(err.message, "error");
          resetButton();
        });
    }
  }

  function injectInterfaceButtons() {
    Object.keys(activeAdapters).forEach((id) => {
      const adapter = activeAdapters[id];
      const ui = adapter.ui || {};

      // 1. Ingest Detail Product Page buttons
      if (ui.detail && ui.detail.targetSelector) {
        if (!document.querySelector(".homebox-detail-injected")) {
          let anchor = null;
          const selectors = Array.isArray(ui.detail.targetSelector)
            ? ui.detail.targetSelector
            : ui.detail.targetSelector.split(",").map((s) => s.trim());

          for (const sel of selectors) {
            const candidates = document.querySelectorAll(sel);
            for (const el of candidates) {
              if (ui.detail.textFilter && Array.isArray(ui.detail.textFilter)) {
                const text = el.textContent || "";
                if (
                  !ui.detail.textFilter.some((filter) => text.includes(filter))
                ) {
                  continue;
                }
              }
              if (el.closest(".owp-floating-bar")) {
                continue;
              }
              anchor = el;
              break;
            }
            if (anchor) break;
          }

          if (anchor) {
            const theme = ui.detail.theme || {};
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "homebox-injected-btn homebox-detail-injected";

            if (theme.nativeClasses && theme.nativeClasses.length > 0) {
              theme.nativeClasses.forEach((cls) => btn.classList.add(cls));
            } else {
              btn.classList.add("homebox-injected-btn-fallback");
            }

            if (theme.styleOverrides) {
              Object.assign(btn.style, theme.styleOverrides);
            }

            const iconHtml = `
              <svg class="homebox-btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
            `;

            btn.innerHTML = `
              <svg class="homebox-btn-spinner homebox-spinner" width="14" height="14" viewBox="0 0 50 50" style="vertical-align: middle; margin-right: 6px;">
                <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" stroke-dasharray="80, 200" stroke-dashoffset="0" stroke-linecap="round"></circle>
              </svg>
              <span class="homebox-btn-success-icon">✓</span>
              <span class="homebox-btn-icon">${iconHtml}</span>
              <span class="homebox-btn-text">${ui.detail.buttonText || "Add to Homebox"}</span>
            `;

            btn.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              handleImportClick(e, id, "detail", 0, btn);
            });

            const pos = ui.detail.insertPosition || "beforeend";
            anchor.insertAdjacentElement(pos, btn);
          }
        }
      }

      // 2. Ingest Grid Product Lists buttons
      if (ui.listing && ui.listing.cardSelector) {
        const cards = document.querySelectorAll(ui.listing.cardSelector);
        cards.forEach((card, idx) => {
          if (card.querySelector(".homebox-list-btn")) return;

          const anchor = ui.listing.targetSelector
            ? card.querySelector(ui.listing.targetSelector)
            : card;
          if (!anchor) return;

          const theme = ui.listing.theme || {};
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "homebox-list-btn";
          btn.title = "Add to Homebox";

          if (theme.nativeClasses && theme.nativeClasses.length > 0) {
            theme.nativeClasses.forEach((cls) => btn.classList.add(cls));
          }

          if (theme.styleOverrides) {
            Object.assign(btn.style, theme.styleOverrides);
          }

          btn.innerHTML = `
            <svg class="homebox-btn-spinner homebox-spinner" width="14" height="14" viewBox="0 0 50 50">
              <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" stroke-dasharray="80, 200" stroke-dashoffset="0" stroke-linecap="round"></circle>
            </svg>
            <span class="homebox-btn-success-icon">✓</span>
            <svg class="homebox-btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          `;

          btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleImportClick(e, id, "listing", idx, btn);
          });

          // Ensure parent relative position for correct layouting on grid hover dislays
          const originalPosition = window.getComputedStyle(card).position;
          if (originalPosition === "static" || !originalPosition) {
            card.style.position = "relative";
          }

          const pos = ui.listing.insertPosition || "beforeend";
          anchor.insertAdjacentElement(pos, btn);
        });
      }
    });
  }

  // --- IPC Event Listeners & Router ---
  window.addEventListener("homebox:register", (e) => {
    const detail = e.detail;
    if (!detail || detail.sender !== "adapter" || detail.action !== "register")
      return;

    const adapterId = detail.adapterId;
    activeAdapters[adapterId] = {
      name: detail.adapterName,
      ui: detail.payload?.ui,
    };

    // Auto-record registered shop and its platform
    const rawHostname =
      detail.payload?.hostname || window.location.hostname || "";
    const cleanHost = rawHostname.replace(/^www\./i, "").toLowerCase();
    if (cleanHost) {
      try {
        let registered = JSON.parse(
          GM_getValue("homebox_registered_entities", "[]"),
        );
        const existing = registered.find((item) => item.host === cleanHost);
        const adapterLabel =
          detail.adapterName ||
          ADAPTER_NAMES[detail.adapterId] ||
          detail.adapterId;
        if (!existing) {
          registered.push({
            host: cleanHost,
            adapterId: detail.adapterId,
            adapterName: adapterLabel,
          });
          GM_setValue(
            "homebox_registered_entities",
            JSON.stringify(registered),
          );
        } else if (!existing.adapterName && adapterLabel) {
          existing.adapterName = adapterLabel;
          GM_setValue(
            "homebox_registered_entities",
            JSON.stringify(registered),
          );
        }
      } catch {
        // ignore
      }
    }

    logDebug(
      "Handshake / Registration Received",
      window.location.href,
      {},
      200,
      JSON.stringify(detail),
    );

    // Reply with handshake confirmation
    window.dispatchEvent(
      new CustomEvent("homebox:handshake-ack", {
        detail: {
          protocolVersion: PROTOCOL_VERSION,
          messageId: detail.messageId,
          sender: "core",
          adapterId,
          action: "handshake-ack",
          payload: {
            coreVersion: "1.0.0",
            isConfigured: Config.isConfigured(),
          },
        },
      }),
    );

    // Kickoff immediate injection check
    injectInterfaceButtons();
  });

  // Announce Core presence to any adapters that loaded earlier
  window.dispatchEvent(
    new CustomEvent("homebox:core-ready", {
      detail: {
        protocolVersion: PROTOCOL_VERSION,
        coreVersion: "1.0.0",
      },
    }),
  );

  // --- Initializer ---
  function init() {
    const style = document.createElement("style");
    style.textContent = GLOBAL_CSS;
    document.head.appendChild(style);

    if (typeof GM_registerMenuCommand !== "undefined") {
      GM_registerMenuCommand("Configure Homebox connection", () => {
        Config.showSettingsModal();
      });
    }

    injectInterfaceButtons();

    const observer = new MutationObserver(() => {
      injectInterfaceButtons();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Missing adapter health check (allow ample time for adapter retry handshake)
    setTimeout(() => {
      if (Object.keys(activeAdapters).length === 0) {
        console.warn(
          `%c[Homebox Core]%c No adapter connected for "${window.location.hostname}". An adapter userscript for this site is missing and needs to be installed.`,
          "color: #10b981; font-weight: bold;",
          "color: #d97706; font-weight: 500;",
        );
      }
    }, 3500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
