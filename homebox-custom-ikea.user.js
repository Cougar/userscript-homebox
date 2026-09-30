// ==UserScript==
// @name         Homebox Connector - [Custom] IKEA
// @namespace    https://github.com/Cougar/userscript-homebox
// @version      1.0.0
// @description  Homebox e-shop integration custom adapter for IKEA
// @author       Cougar
// @homepageURL  https://github.com/Cougar/userscript-homebox
// @supportURL   https://github.com/Cougar/userscript-homebox/issues
// @downloadURL  https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-custom-ikea.user.js
// @updateURL    https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-custom-ikea.user.js
// @match        *://*.ikea.com/*
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// ==/UserScript==

(function () {
  "use strict";

  // --- Constants & Configuration ---
  const ADAPTER_ID = "custom-ikea";
  const ADAPTER_NAME = "IKEA";
  const PROTOCOL_VERSION = "1.0.0";
  const CORE_INSTALL_URL =
    "https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-core.user.js";

  console.log(
    `%c[Homebox Adapter: ${ADAPTER_ID}] Script active on ${window.location.hostname}`,
    "color: #3b82f6; font-weight: bold;",
  );

  const UI_CONFIG = {
    detail: {
      targetSelector: [
        ".js-buy-module",
        ".pip-buy-module",
        ".pipf-price-package",
        ".js-price-package",
        ".pip-price-package",
      ],
      insertPosition: "afterend",
      buttonText: "Add to Homebox",
      theme: {
        nativeClasses: ["pip-btn", "pip-btn--secondary"],
        styleOverrides: {
          width: "100%",
          marginTop: "12px",
          minHeight: "48px",
          borderRadius: "64px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontWeight: "700",
          backgroundColor: "#f5f5f5",
          color: "#111111",
          border: "1px solid #dfdfdf",
          cursor: "pointer",
        },
      },
    },
    listing: {
      cardSelector:
        ".plp-mastercard, .plp-fragment-wrapper, .pip-product-compact",
      targetSelector:
        ".plp-image-container, .pip-product-compact__image-wrapper, .pip-image",
      insertPosition: "beforeend",
      theme: {
        nativeClasses: [],
        styleOverrides: {
          position: "absolute",
          top: "8px",
          right: "8px",
        },
      },
    },
  };

  // --- Helpers & Parsers ---
  function formatIkeaCode(code) {
    if (!code) return "";
    const digits = code.replace(/[^0-9]/g, "");
    if (digits.length === 8) {
      return digits.replace(/(\d{3})(\d{3})(\d{2})/, "$1.$2.$3");
    }
    return code.trim();
  }

  function isProductPage() {
    return !!(
      document.querySelector(".js-buy-module, .pip-buy-module") ||
      document.querySelector(".pipf-price-package, .js-price-package") ||
      window.location.pathname.includes("/p/")
    );
  }

  function deduplicateImages(urls) {
    const unique = [];
    urls.forEach((url) => {
      // Upgrade smaller sizes to super high-res _s5.jpg
      const highRes = url.replace(/_s[0-4]\.jpg/i, "_s5.jpg");
      if (!unique.includes(highRes)) {
        unique.push(highRes);
      }
    });
    return unique;
  }

  function extractIkeaDocuments(rootDoc = document) {
    const attachments = [];

    // 1. DOM document links (assembly guides, manuals, care instructions)
    const docLinks = rootDoc.querySelectorAll(
      'a.pipf-product-details-tab__document-link, a[href*="/pdoc/"], a[href*=".pdf"]',
    );
    docLinks.forEach((link) => {
      const href = link.href;
      if (href && !attachments.some((a) => a.url === href)) {
        const container = link.closest(
          ".pipf-product-details-tab__container, .pip-product-details-tab__container",
        );
        const header = container
          ? container.querySelector(
              ".pipf-product-details-tab__document-header, .pip-product-details-tab__document-header",
            )
          : null;
        let title = header ? header.textContent.trim() : "";
        if (!title) {
          const span = link.querySelector("span");
          title = span ? span.textContent.trim() : link.textContent.trim();
        }
        if (!title || title.length > 80 || title === "PDF") {
          title = "Kasutusjuhend";
        }
        attachments.push({
          url: href,
          name: title.endsWith(".pdf") ? title : `${title}.pdf`,
        });
      }
    });

    // 2. Compliance / Energy label PDFs
    const docHtml = rootDoc.documentElement.innerHTML;
    const complianceRegex =
      /https?:\/\/[^\s"'<>)]+\/(?:compliance|pdoc)\/[^\s"'<>)]+\.pdf/gi;
    let m;
    while ((m = complianceRegex.exec(docHtml))) {
      const url = m[0];
      if (!attachments.some((a) => a.url === url)) {
        const isEnergy = url.includes("compliance") || url.includes("web-");
        const docName = isEnergy
          ? "Toote-teabeleht-ja-energiamargis.pdf"
          : "Kasutusjuhend.pdf";
        attachments.push({ url, name: docName });
      }
    }

    return attachments;
  }

  function scrapeProductDetails() {
    let name = "";
    let description = "";
    let value = 0;
    let currency = "EUR";
    let sku = "";
    let manufacturer = "IKEA";
    const imageUrls = [];

    // 1. JSON-LD schema parsing
    const jsonLdScripts = document.querySelectorAll(
      'script[type*="application/ld+json"]',
    );
    jsonLdScripts.forEach((script) => {
      try {
        const data = JSON.parse(script.textContent);
        const item =
          data["@type"] === "Product"
            ? data
            : Array.isArray(data["@graph"])
              ? data["@graph"].find((x) => x["@type"] === "Product")
              : null;
        if (item) {
          if (!name && item.name) name = item.name;
          if (!description && item.description) description = item.description;
          if (!sku && (item.sku || item.mpn)) {
            sku = formatIkeaCode(item.sku || item.mpn);
          }
          if (item.brand?.name) manufacturer = item.brand.name;
          if (item.offers) {
            const offer = Array.isArray(item.offers)
              ? item.offers[0]
              : item.offers;
            if (offer.price) value = parseFloat(offer.price) || value;
            if (offer.priceCurrency) currency = offer.priceCurrency;
          }
          if (item.image) {
            const imgs = Array.isArray(item.image) ? item.image : [item.image];
            imgs.forEach((img) => {
              const u = typeof img === "string" ? img : img.contentUrl;
              if (u && !imageUrls.includes(u)) imageUrls.push(u);
            });
          }
        }
      } catch {
        // ignore
      }
    });

    // 2. DOM fallbacks
    if (!name) {
      const h1El = document.querySelector("h1");
      if (h1El) name = h1El.textContent.trim().replace(/\s+/g, " ");
    }

    if (!sku) {
      const idEl = document.querySelector(
        ".pipf-product-identifier__value, .pip-product-identifier__value, [data-product-number]",
      );
      if (idEl) {
        sku = formatIkeaCode(
          idEl.getAttribute("data-product-number") || idEl.textContent.trim(),
        );
      }
      if (!sku) {
        const urlMatch = window.location.pathname.match(/-(\d{8})\/?$/);
        if (urlMatch) sku = formatIkeaCode(urlMatch[1]);
      }
    }

    if (!value) {
      const priceEl = document.querySelector(
        ".pipf-price-package__price-module-wrapper, .pip-price__integer, .pipcom-price-module__price",
      );
      if (priceEl) {
        const clean = priceEl.textContent
          .replace(/[^0-9,.]/g, "")
          .replace(",", ".");
        value = parseFloat(clean) || 0;
      }
    }

    if (!description) {
      const descEl = document.querySelector(
        ".pipf-product-details__paragraph, .pip-product-details__paragraph, [itemprop='description']",
      );
      if (descEl) description = descEl.textContent.trim();
    }

    // 3. Documents & Attachments
    const attachments = extractIkeaDocuments(document);

    // 4. Custom fields attribute for Homebox
    const fields = [];
    if (sku) {
      fields.push({
        name: "IKEA Product Code",
        textValue: sku,
        type: "text",
      });
    }

    return {
      name,
      description,
      value,
      currency,
      url: window.location.href.split("?")[0],
      imageUrls: deduplicateImages(imageUrls),
      attachments,
      fields,
      sku,
      manufacturer,
    };
  }

  function scrapeListingItem(cardEl) {
    const titleEl =
      cardEl.querySelector(
        ".plp-price-module__name-decorator, .pip-header-section__title--small, h3",
      ) || cardEl.querySelector("a");
    const name = titleEl ? titleEl.textContent.trim() : "";

    const linkEl =
      cardEl.querySelector("a.plp-fragment-wrapper__link") ||
      cardEl.querySelector("a.pip-product-compact__link") ||
      cardEl.querySelector("a");
    const href = linkEl ? linkEl.getAttribute("href") : "";
    const fullUrl = href
      ? href.startsWith("/")
        ? window.location.origin + href
        : href
      : window.location.href;

    let value = 0;
    const priceEl = cardEl.querySelector(
      ".plp-price__integer, .pip-price__integer, .price",
    );
    if (priceEl) {
      const clean = priceEl.textContent
        .replace(/[^0-9,.]/g, "")
        .replace(",", ".");
      value = parseFloat(clean) || 0;
    }

    let sku = "";
    const urlMatch = fullUrl.match(/-(\d{8})\/?$/);
    if (urlMatch) sku = formatIkeaCode(urlMatch[1]);

    const imgEl = cardEl.querySelector("img");
    const imageUrl = imgEl ? imgEl.src : "";

    const fields = [];
    if (sku) {
      fields.push({
        name: "IKEA Product Code",
        textValue: sku,
        type: "text",
      });
    }

    return {
      name,
      description: `Quick-added from ${ADAPTER_NAME} catalog.`,
      value,
      currency: "EUR",
      url: fullUrl,
      imageUrls: imageUrl ? deduplicateImages([imageUrl]) : [],
      fields,
      sku,
      manufacturer: "IKEA",
    };
  }

  function enrichItemDetails(itemDetails) {
    if (!itemDetails.url) return Promise.resolve(itemDetails);

    return fetch(itemDetails.url)
      .then((res) => {
        if (!res.ok)
          throw new Error("Failed to load product page in background.");
        return res.text();
      })
      .then((htmlText) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, "text/html");

        let description = itemDetails.description;
        let sku = itemDetails.sku;
        let manufacturer = itemDetails.manufacturer || "IKEA";
        let value = itemDetails.value;
        const imageUrls = [...itemDetails.imageUrls];

        // 1. JSON-LD
        const jsonLdScripts = doc.querySelectorAll(
          'script[type*="application/ld+json"]',
        );
        jsonLdScripts.forEach((script) => {
          try {
            const data = JSON.parse(script.textContent);
            const item =
              data["@type"] === "Product"
                ? data
                : Array.isArray(data["@graph"])
                  ? data["@graph"].find((x) => x["@type"] === "Product")
                  : null;
            if (item) {
              if (item.description) description = item.description;
              if (!sku && (item.sku || item.mpn)) {
                sku = formatIkeaCode(item.sku || item.mpn);
              }
              if (item.brand?.name) manufacturer = item.brand.name;
              if (item.offers) {
                const offer = Array.isArray(item.offers)
                  ? item.offers[0]
                  : item.offers;
                if (offer.price) value = parseFloat(offer.price) || value;
              }
              if (item.image) {
                const imgs = Array.isArray(item.image)
                  ? item.image
                  : [item.image];
                imgs.forEach((img) => {
                  const u = typeof img === "string" ? img : img.contentUrl;
                  if (u && !imageUrls.includes(u)) imageUrls.push(u);
                });
              }
            }
          } catch {
            // ignore
          }
        });

        // 2. Documents & Attachments
        const attachments = extractIkeaDocuments(doc);

        const fields = [];
        if (sku) {
          fields.push({
            name: "IKEA Product Code",
            textValue: sku,
            type: "text",
          });
        }

        return {
          ...itemDetails,
          description,
          sku,
          manufacturer,
          value,
          attachments,
          fields,
          imageUrls: deduplicateImages(imageUrls),
        };
      })
      .catch((err) => {
        console.warn(
          `[Homebox Adapter: ${ADAPTER_ID}] Background enrichment failed:`,
          err,
        );
        return itemDetails;
      });
  }

  // --- Handshake & Health Check ---
  let coreConnected = false;
  let handshakeAttempts = 0;
  const MAX_HANDSHAKE_ATTEMPTS = 6;

  function handleCoreMissing() {
    const errorMsg = `[Homebox Connector] Core module is either not installed or not up to date (matching "${window.location.hostname}" is missing). Please install or update Homebox Core: ${CORE_INSTALL_URL}`;
    console.error(errorMsg);

    if (typeof GM_registerMenuCommand !== "undefined") {
      GM_registerMenuCommand(
        "⚠️ Homebox Core is missing or needs update",
        () => {
          if (typeof GM_openInTab !== "undefined") {
            GM_openInTab(CORE_INSTALL_URL, { active: true });
          } else {
            window.open(CORE_INSTALL_URL, "_blank");
          }
        },
      );
    }
  }

  function registerWithCore() {
    if (coreConnected) return;
    window.dispatchEvent(
      new CustomEvent("homebox:register", {
        detail: {
          protocolVersion: PROTOCOL_VERSION,
          messageId: crypto.randomUUID(),
          sender: "adapter",
          adapterId: ADAPTER_ID,
          adapterName: ADAPTER_NAME,
          action: "register",
          payload: {
            hostname: window.location.hostname,
            isProductPage: isProductPage(),
            ui: UI_CONFIG,
          },
        },
      }),
    );
  }

  // --- Lifecycle & Event Handlers ---
  window.addEventListener("homebox:handshake-ack", (e) => {
    if (e.detail?.adapterId === ADAPTER_ID) {
      coreConnected = true;
    }
  });

  window.addEventListener("homebox:core-ready", () => {
    registerWithCore();
  });

  window.addEventListener("homebox:scrape:trigger", (e) => {
    if (e.detail?.adapterId !== ADAPTER_ID) return;
    const messageId = e.detail?.messageId || e.detail?.payload?.messageId;
    const mode = e.detail?.payload?.mode;
    const cardIndex = e.detail?.payload?.cardIndex;
    console.log(
      `[Homebox Adapter: ${ADAPTER_ID}] Scrape trigger received (mode: ${mode}, messageId: ${messageId})`,
    );

    let scrapePromise;
    if (mode === "listing") {
      const cards = document.querySelectorAll(UI_CONFIG.listing.cardSelector);
      const targetCard = cards[cardIndex];
      if (!targetCard) {
        scrapePromise = Promise.reject(
          new Error("Product card not found on page."),
        );
      } else {
        const initialDetails = scrapeListingItem(targetCard);
        scrapePromise = enrichItemDetails(initialDetails);
      }
    } else {
      try {
        const details = scrapeProductDetails();
        scrapePromise = Promise.resolve(details);
      } catch (err) {
        scrapePromise = Promise.reject(err);
      }
    }

    scrapePromise
      .then((itemDetails) => {
        window.dispatchEvent(
          new CustomEvent("homebox:scrape:result", {
            detail: {
              protocolVersion: PROTOCOL_VERSION,
              messageId,
              sender: "adapter",
              adapterId: ADAPTER_ID,
              action: "scrape:result",
              payload: {
                messageId,
                success: true,
                itemDetails,
              },
            },
          }),
        );
      })
      .catch((err) => {
        window.dispatchEvent(
          new CustomEvent("homebox:scrape:result", {
            detail: {
              protocolVersion: PROTOCOL_VERSION,
              messageId,
              sender: "adapter",
              adapterId: ADAPTER_ID,
              action: "scrape:result",
              payload: {
                messageId,
                success: false,
                itemDetails: null,
                error: err.message || String(err),
              },
            },
          }),
        );
      });
  });

  registerWithCore();
  const handshakeInterval = setInterval(() => {
    handshakeAttempts++;
    if (coreConnected) {
      clearInterval(handshakeInterval);
    } else if (handshakeAttempts >= MAX_HANDSHAKE_ATTEMPTS) {
      clearInterval(handshakeInterval);
      handleCoreMissing();
    } else {
      registerWithCore();
    }
  }, 500);
})();
