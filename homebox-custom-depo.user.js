// ==UserScript==
// @name         Homebox Connector - [Custom] DEPO Online
// @namespace    https://github.com/Cougar/userscript-homebox
// @version      1.0.0
// @description  Homebox e-shop integration custom adapter for DEPO Online
// @author       Cougar
// @homepageURL  https://github.com/Cougar/userscript-homebox
// @supportURL   https://github.com/Cougar/userscript-homebox/issues
// @downloadURL  https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-custom-depo.user.js
// @updateURL    https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-custom-depo.user.js
// @match        *://*.depo.ee/*
// @match        *://*.depo.lv/*
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// ==/UserScript==

(function () {
  "use strict";

  // --- Constants & Configuration ---
  const ADAPTER_ID = "custom-depo";
  const ADAPTER_NAME = "DEPO Online";
  const PROTOCOL_VERSION = "1.0.0";
  const CORE_INSTALL_URL =
    "https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-core.user.js";

  const UI_CONFIG = {
    detail: {
      targetSelector: 'button, [class*="btn"]',
      textFilter: ["Lisa korvi", "Ielikt grozā", "Į krepšelį"],
      insertPosition: "afterend",
      buttonText: "Add to Homebox",
      theme: {
        nativeClasses: ["depo-cart-btn"],
        styleOverrides: {
          marginLeft: "10px",
        },
      },
    },
    listing: {
      cardSelector: 'a[href*="/toode/"], a[href*="/prece/"]',
      targetSelector: "",
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

  // --- Scraper & Parser Implementation ---
  function isProductPage() {
    return (
      window.location.pathname.includes("/toode/") ||
      window.location.pathname.includes("/prece/")
    );
  }

  function deduplicateImages(urls) {
    const unique = [];
    urls.forEach((url) => {
      if (url && !unique.includes(url)) {
        unique.push(url);
      }
    });
    return unique;
  }

  function scrapeProductDetails() {
    const titleEl =
      document.querySelector("h1") ||
      document.querySelector(".product-title") ||
      document.querySelector(".text-xl.font-bold") ||
      document.querySelector(".lg\\:text-3xl");
    const name = titleEl ? titleEl.textContent.trim() : "";

    const descEl =
      document.querySelector(".description") ||
      document.querySelector(".product-description") ||
      document.querySelector('[class*="description"]');
    const description = descEl ? descEl.innerHTML.trim() : "";

    let sku = "";
    const rows = Array.from(document.querySelectorAll("tr"));
    const skuRow = rows.find(
      (tr) =>
        tr.textContent.includes("Tootekood") ||
        tr.textContent.includes("SKU") ||
        tr.textContent.includes("Kods"),
    );
    if (skuRow) {
      const cells = skuRow.querySelectorAll("td");
      if (cells.length > 1) {
        sku = cells[1].textContent.trim();
      }
    }

    let value = 0;
    const priceCandidates = Array.from(
      document.querySelectorAll(
        '.text-2xl, .text-3xl, .font-bold, .price, [class*="price"]',
      ),
    );
    for (const el of priceCandidates) {
      const text = el.textContent.trim();
      if (/^\d+([,.]\d{1,2})?\s*€?$/.test(text)) {
        const cleanPrice = text.replace(/[^0-9,.]/g, "").replace(",", ".");
        const parsed = parseFloat(cleanPrice);
        if (parsed > 0) {
          value = parsed;
          break;
        }
      }
    }

    const imageUrls = [];
    const pageHtml = document.documentElement.innerHTML;
    const depoRegex =
      /https?:[^\s"']*(images\.depo\.lv)[^\s"']*\.(jpg|png|webp)/gi;
    let m;
    while ((m = depoRegex.exec(pageHtml))) {
      let href = m[0].replace(/\\u002F/g, "/").replace(/\\/g, "");
      const upscaled = href.replace(/\/\d+x\d+\//i, "/4000x4000/");
      if (!imageUrls.includes(upscaled)) {
        imageUrls.push(upscaled);
      }
    }

    return {
      name,
      description,
      value,
      currency: "EUR",
      url: window.location.href.split("?")[0],
      imageUrls: deduplicateImages(imageUrls),
      sku,
      manufacturer: "",
    };
  }

  function scrapeListingItem(cardEl) {
    const titleEl =
      cardEl.querySelector("h2, h3, h4, .title, .product-title") ||
      cardEl.querySelector('div[class*="title"]') ||
      cardEl;
    let name = titleEl ? titleEl.textContent.trim() : "";
    if (name.length > 120) {
      name = name.substring(0, 120) + "...";
    }

    const href = cardEl.getAttribute("href") || "";
    const fullUrl = href
      ? href.startsWith("/")
        ? window.location.origin + href
        : href
      : window.location.href;

    let value = 0;
    const priceEl = cardEl.querySelector(
      '[class*="price"], .font-bold, .text-xl',
    );
    if (priceEl) {
      const priceText = priceEl.textContent
        .replace(/[^0-9,.]/g, "")
        .replace(",", ".");
      value = parseFloat(priceText) || 0;
    }

    const imgEl = cardEl.querySelector("img");
    const imageUrl = imgEl ? imgEl.src : "";

    return {
      name,
      description: `Quick-added from ${ADAPTER_NAME} catalog.`,
      value,
      currency: "EUR",
      url: fullUrl,
      imageUrls: imageUrl ? [imageUrl] : [],
      sku: "",
      manufacturer: "",
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
        const imageUrls = [];

        const titleEl =
          doc.querySelector("h1") ||
          doc.querySelector(".product-title") ||
          doc.querySelector(".text-xl.font-bold") ||
          doc.querySelector(".lg\\:text-3xl");
        const name = titleEl ? titleEl.textContent.trim() : itemDetails.name;

        const descEl =
          doc.querySelector(".description") ||
          doc.querySelector(".product-description") ||
          doc.querySelector('[class*="description"]');
        if (descEl) description = descEl.innerHTML.trim();

        const rows = Array.from(doc.querySelectorAll("tr"));
        const skuRow = rows.find(
          (tr) =>
            tr.textContent.includes("Tootekood") ||
            tr.textContent.includes("SKU") ||
            tr.textContent.includes("Kods"),
        );
        if (skuRow) {
          const cells = skuRow.querySelectorAll("td");
          if (cells.length > 1) {
            sku = cells[1].textContent.trim();
          }
        }

        const depoRegex =
          /https?:[^\s"']*(images\.depo\.lv)[^\s"']*\.(jpg|png|webp)/gi;
        let m;
        while ((m = depoRegex.exec(htmlText))) {
          let href = m[0].replace(/\\u002F/g, "/").replace(/\\/g, "");
          const upscaled = href.replace(/\/\d+x\d+\//i, "/4000x4000/");
          if (!imageUrls.includes(upscaled)) {
            imageUrls.push(upscaled);
          }
        }

        return {
          ...itemDetails,
          name,
          description,
          sku,
          imageUrls: deduplicateImages(
            imageUrls.length > 0 ? imageUrls : itemDetails.imageUrls,
          ),
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

    Promise.resolve()
      .then(() => {
        if (mode === "listing") {
          const cards = document.querySelectorAll(
            UI_CONFIG.listing.cardSelector,
          );
          const targetCard = cards[cardIndex];
          if (!targetCard) throw new Error("Product card not found on page.");
          return scrapeListingItem(targetCard);
        }
        return scrapeProductDetails();
      })
      .then((itemDetails) => {
        if (
          itemDetails &&
          itemDetails.url &&
          (!itemDetails.imageUrls || itemDetails.imageUrls.length <= 1)
        ) {
          return enrichItemDetails(itemDetails);
        }
        return itemDetails;
      })
      .then((finalDetails) => {
        console.log(
          `[Homebox Adapter: ${ADAPTER_ID}] Scrape completed:`,
          finalDetails,
        );
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
                itemDetails: finalDetails,
                error: null,
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
