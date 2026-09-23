// ==UserScript==
// @name         Homebox Connector - [Custom] Osta.ee
// @namespace    https://github.com/Cougar/userscript-homebox
// @version      1.0.2
// @description  Homebox e-shop integration custom adapter for Osta.ee
// @author       Cougar
// @homepageURL  https://github.com/Cougar/userscript-homebox
// @supportURL   https://github.com/Cougar/userscript-homebox/issues
// @downloadURL  https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-custom-osta.user.js
// @updateURL    https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-custom-osta.user.js
// @match        *://osta.ee/*
// @match        *://www.osta.ee/*
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// ==/UserScript==

(function () {
  "use strict";

  // --- Constants & Configuration ---
  const ADAPTER_ID = "custom-osta";
  const ADAPTER_NAME = "Osta.ee";
  const PROTOCOL_VERSION = "1.0.0";
  const CORE_INSTALL_URL =
    "https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-core.user.js";

  const UI_CONFIG = {
    detail: {
      targetSelector: [
        ".data-list",
        ".offer-details__price-data.default",
        ".offer-details__price-data",
        ".bids-and-buy",
      ],
      insertPosition: "afterend",
      buttonText: "Add to Homebox",
      theme: {
        nativeClasses: ["btn", "btn-primary"],
        styleOverrides: {
          marginTop: "12px",
          marginBottom: "12px",
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontWeight: "600",
        },
      },
    },
    listing: {
      cardSelector:
        ".offer-thumb, .product-grid-item, .listing-item, .c-product-card",
      targetSelector:
        ".offer-thumb__image, .image-wrapper, .c-product-card__image-wrapper",
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
    return !!(
      document.querySelector(".header-title") ||
      document.querySelector('[itemprop="productID"]') ||
      window.location.pathname.match(/-\d+\.html/)
    );
  }

  function deduplicateImages(urls) {
    const groups = {};
    urls.forEach((url) => {
      const key = url
        .replace(/img-osta\.ee\/item\/[^/]+/i, "img-osta.ee/item")
        .replace(/\.[a-z0-9]+$/i, "");
      if (!groups[key]) groups[key] = [];
      groups[key].push(url);
    });

    const deduplicated = [];
    Object.keys(groups).forEach((key) => {
      const groupUrls = groups[key];
      const origVersion = groupUrls.find((u) => u.includes("/orig/"));
      if (origVersion) {
        deduplicated.push(origVersion);
        return;
      }
      const sorted = [...groupUrls].sort((a, b) => b.localeCompare(a));
      deduplicated.push(sorted[0]);
    });
    return deduplicated;
  }

  function parseOstaDate(dateStr) {
    if (!dateStr) return "";
    const match = dateStr.match(
      /(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
    );
    if (!match) return "";
    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    const year = match[3];
    const hours = (match[4] || "12").padStart(2, "0");
    const minutes = (match[5] || "00").padStart(2, "0");
    const seconds = (match[6] || "00").padStart(2, "0");

    const d = new Date(
      `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`,
    );
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`;
  }

  function scrapeProductDetails() {
    const titleEl =
      document.querySelector(".header-title") ||
      document.querySelector("h1") ||
      document.querySelector('[itemprop="name"]');
    const name = titleEl ? titleEl.textContent.trim() : "";

    let value = 0;
    const rows = Array.from(document.querySelectorAll("tr"));
    const lopphindRow = rows.find((tr) => tr.textContent.includes("Lõpphind:"));
    const hetkehindRow = rows.find((tr) =>
      tr.textContent.includes("Hetkehind:"),
    );
    const ostakoheRow = rows.find((tr) =>
      tr.textContent.includes("Osta kohe:"),
    );
    const alghindRow = rows.find((tr) => tr.textContent.includes("Alghind:"));

    const activeRow = lopphindRow || hetkehindRow || ostakoheRow || alghindRow;
    let priceText = "";
    if (activeRow) {
      const priceSpan =
        activeRow.querySelector('[itemprop="price"]') ||
        activeRow.querySelector("td");
      if (priceSpan) priceText = priceSpan.textContent;
    }
    if (!priceText) {
      const priceEl =
        document.querySelector(".js-current-price") ||
        document.querySelector(".price-new") ||
        document.querySelector('[itemprop="price"]');
      if (priceEl) priceText = priceEl.textContent;
    }
    if (priceText) {
      const cleanPrice = priceText.replace(/[^0-9,.]/g, "").replace(",", ".");
      value = parseFloat(cleanPrice) || 0;
    }

    let purchaseDate = "";
    const dateEl =
      document.querySelector('[itemprop="validThrough"]') ||
      document.querySelector(".js-date-end");
    let dateText = dateEl ? dateEl.textContent.trim() : "";
    if (!dateText) {
      const lopuaegRow = rows.find((tr) => tr.textContent.includes("Lõpuaeg:"));
      if (lopuaegRow) {
        const td = lopuaegRow.querySelector("td");
        if (td) dateText = td.textContent.trim();
      }
    }
    if (dateText) {
      purchaseDate = parseOstaDate(dateText) || "";
    }

    const descEl =
      document.querySelector(".offer-details__description") ||
      document.querySelector('[itemprop="description"]') ||
      document.querySelector(".description");
    const description = descEl ? descEl.textContent.trim() : "";

    const skuEl = document.querySelector('[itemprop="productID"]');
    let sku = skuEl ? skuEl.textContent.replace(/[^0-9]/g, "") : "";
    if (!sku) {
      const idMatch = window.location.pathname.match(/-(\d+)\.html/);
      if (idMatch) sku = idMatch[1];
    }

    const sellerEl =
      document.querySelector(".view-seller-items-btn") ||
      document.querySelector(".seller-name") ||
      document.querySelector(".user-name a") ||
      document.querySelector(".username a");
    const sellerName = sellerEl ? sellerEl.textContent.trim() : "";
    let sellerUrl = sellerEl && sellerEl.href ? sellerEl.href : "";
    if (sellerUrl && sellerUrl.startsWith("/")) {
      sellerUrl = window.location.origin + sellerUrl;
    }

    const imageUrls = [];
    const origRegex =
      /https?:\\?\/\\?\/img-osta\.ee\\?\/item\\?\/orig\\?\/[a-z0-9_\\\-/]+\.[a-z0-9]+/gi;
    let m;
    while ((m = origRegex.exec(document.documentElement.innerHTML))) {
      const cleanUrl = m[0].replace(/\\/g, "");
      if (!imageUrls.includes(cleanUrl)) {
        imageUrls.push(cleanUrl);
      }
    }

    if (imageUrls.length === 0) {
      const galleryImages = document.querySelectorAll(
        '.gallery-viewer img, .item-photos img, .fotorama img, [itemprop="image"]',
      );
      galleryImages.forEach((img) => {
        const src = img.getAttribute("data-original") || img.src;
        if (src && src.includes("img-osta.ee") && !imageUrls.includes(src)) {
          imageUrls.push(src);
        }
      });
    }

    return {
      name,
      description,
      value,
      currency: "EUR",
      url: window.location.href.split("?")[0],
      purchaseDate,
      imageUrls: deduplicateImages(imageUrls),
      sku,
      manufacturer: "",
      sellerName,
      sellerUrl,
    };
  }

  function scrapeListingItem(cardEl) {
    const titleEl =
      cardEl.querySelector(".product-title") ||
      cardEl.querySelector(".offer-title") ||
      cardEl.querySelector("h3 a") ||
      cardEl.querySelector("h3") ||
      cardEl.querySelector("a.title");
    const name = titleEl ? titleEl.textContent.trim() : "";

    const linkEl =
      cardEl.querySelector('a[href*=".html"]') ||
      cardEl.querySelector('a[href*="/item/"]') ||
      cardEl.querySelector("a.featured-item__link") ||
      (cardEl.tagName === "A" ? cardEl : cardEl.querySelector("a"));
    const href = linkEl ? linkEl.getAttribute("href") : "";
    const fullUrl = href
      ? href.startsWith("/")
        ? window.location.origin + href
        : href
      : window.location.href;

    const priceEl =
      cardEl.querySelector(".price-current") ||
      cardEl.querySelector(".price") ||
      cardEl.querySelector(".c-price");
    let value = 0;
    if (priceEl) {
      const cleanPrice = priceEl.textContent
        .replace(/[^0-9,.]/g, "")
        .replace(",", ".");
      value = parseFloat(cleanPrice) || 0;
    }

    const imgEl = cardEl.querySelector("img");
    let imageUrl = imgEl
      ? imgEl.getAttribute("data-original") || imgEl.src
      : "";
    if (!imageUrl) {
      const bgEl = cardEl.querySelector("[style*='background-image']");
      if (bgEl) {
        const bgMatch = bgEl.style.backgroundImage.match(
          /url\(["']?([^"']+)["']?\)/,
        );
        if (bgMatch) imageUrl = bgMatch[1];
      }
    }

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

        const descEl =
          doc.querySelector(".offer-details__description") ||
          doc.querySelector('[itemprop="description"]');
        if (descEl) description = descEl.textContent.trim();

        const skuEl = doc.querySelector('[itemprop="productID"]');
        if (skuEl) sku = skuEl.textContent.replace(/[^0-9]/g, "");

        let purchaseDate = itemDetails.purchaseDate || "";
        const dateEl =
          doc.querySelector('[itemprop="validThrough"]') ||
          doc.querySelector(".js-date-end");
        let dateText = dateEl ? dateEl.textContent.trim() : "";
        if (!dateText) {
          const docRows = Array.from(doc.querySelectorAll("tr"));
          const lopuaegRow = docRows.find((tr) =>
            tr.textContent.includes("Lõpuaeg:"),
          );
          if (lopuaegRow) {
            const td = lopuaegRow.querySelector("td");
            if (td) dateText = td.textContent.trim();
          }
        }
        if (dateText) {
          purchaseDate = parseOstaDate(dateText) || purchaseDate;
        }

        const sellerEl =
          doc.querySelector(".view-seller-items-btn") ||
          doc.querySelector(".seller-name") ||
          doc.querySelector(".user-name a") ||
          doc.querySelector(".username a");
        const sellerName = sellerEl
          ? sellerEl.textContent.trim()
          : itemDetails.sellerName;
        let sellerUrl =
          sellerEl && sellerEl.href ? sellerEl.href : itemDetails.sellerUrl;
        if (sellerUrl && sellerUrl.startsWith("/")) {
          sellerUrl = window.location.origin + sellerUrl;
        }

        const origRegex =
          /https?:\\?\/\\?\/img-osta\.ee\\?\/item\\?\/orig\\?\/[a-z0-9_\\\-/]+\.[a-z0-9]+/gi;
        let m;
        while ((m = origRegex.exec(htmlText))) {
          const cleanUrl = m[0].replace(/\\/g, "");
          if (!imageUrls.includes(cleanUrl)) {
            imageUrls.push(cleanUrl);
          }
        }

        if (imageUrls.length === 0) {
          const galleryImages = doc.querySelectorAll(
            '.gallery-viewer img, .item-photos img, .fotorama img, [itemprop="image"]',
          );
          galleryImages.forEach((el) => {
            const src = el.getAttribute("data-original") || el.src;
            if (
              src &&
              src.includes("img-osta.ee") &&
              !imageUrls.includes(src)
            ) {
              imageUrls.push(src);
            }
          });
        }

        return {
          ...itemDetails,
          description,
          sku,
          sellerName,
          sellerUrl,
          purchaseDate,
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
