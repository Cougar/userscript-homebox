// ==UserScript==
// @name         Homebox Connector - [Custom] Arvutitark
// @namespace    https://github.com/Cougar/userscript-homebox
// @version      1.0.0
// @description  Homebox e-shop integration custom adapter for Arvutitark
// @author       Cougar
// @homepageURL  https://github.com/Cougar/userscript-homebox
// @supportURL   https://github.com/Cougar/userscript-homebox/issues
// @downloadURL  https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-custom-arvutitark.user.js
// @updateURL    https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-custom-arvutitark.user.js
// @match        *://arvutitark.ee/*
// @match        *://www.arvutitark.ee/*
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// ==/UserScript==

(function () {
  "use strict";

  // --- Constants & Configuration ---
  const ADAPTER_ID = "custom-arvutitark";
  const ADAPTER_NAME = "Arvutitark";
  const PROTOCOL_VERSION = "1.0.0";
  const CORE_INSTALL_URL =
    "https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-core.user.js";

  const UI_CONFIG = {
    detail: {
      targetSelector: [
        "button.button.-secondary",
        "button.button.-primary",
        ".button.-primary",
      ],
      insertPosition: "afterend",
      buttonText: "Add to Homebox",
      theme: {
        nativeClasses: ["button", "mt-2", "w-full", "-secondary"],
        styleOverrides: {
          minHeight: "44px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontWeight: "600",
        },
      },
    },
    listing: {
      cardSelector:
        ".catalogue-product-wrapper, .catalogue-product, .-grid .catalogue-product-wrapper",
      targetSelector: "._image-wrapper, .catalogue-product-link",
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
      document.querySelector("button.button.-primary") ||
      document.querySelector("._main-price") ||
      window.location.pathname.match(/-\d+$/)
    );
  }

  function deduplicateImages(urls) {
    const groups = {};
    urls.forEach((url) => {
      let raw = url;
      if (url.includes("/https%3A%2F%2Fcms.arvutitark.ee%2F")) {
        const match = url.match(
          /https%3A%2F%2Fcms\.arvutitark\.ee%2F[^\s"'<>)]+/i,
        );
        if (match) raw = decodeURIComponent(match[0]);
      }
      const key = raw.replace(/\.[a-z0-9]+$/i, "");
      if (!groups[key]) groups[key] = [];
      groups[key].push(raw);
    });

    const deduplicated = [];
    Object.keys(groups).forEach((key) => {
      const groupUrls = groups[key];
      const cmsMaster = groupUrls.find((u) =>
        u.startsWith("https://cms.arvutitark.ee"),
      );
      if (cmsMaster && !deduplicated.includes(cmsMaster)) {
        deduplicated.push(cmsMaster);
        return;
      }
      deduplicated.push(groupUrls[0]);
    });
    return deduplicated.filter((u) => !u.includes("media-hub-cms"));
  }

  function scrapeProductDetails() {
    let name = "";
    let description = "";
    let value = 0;
    let currency = "EUR";
    let sku = "";
    let manufacturer = "";
    const imageUrls = [];

    // 1. JSON-LD schema parsing
    const jsonLdScripts = document.querySelectorAll(
      'script[type="application/ld+json"]',
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
          if (!sku && (item.sku || item.mpn || item.gtin14 || item.productID)) {
            sku = item.sku || item.mpn || item.gtin14 || item.productID;
          }
          if (!manufacturer && item.brand) {
            manufacturer = item.brand.name || item.brand;
          }
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
              if (img && !imageUrls.includes(img)) imageUrls.push(img);
            });
          }
        }
      } catch {
        // ignore
      }
    });

    // 2. DOM fallbacks
    if (!name) {
      const h2El = document.querySelector("h2");
      const h1El = document.querySelector("h1");
      name = h2El
        ? h2El.textContent.trim()
        : h1El
          ? h1El.textContent.trim()
          : "";
    }

    if (!value) {
      const priceEl =
        document.querySelector("._main-price") ||
        document.querySelector(".product-price") ||
        document.querySelector(".price");
      if (priceEl) {
        const clean = priceEl.textContent
          .replace(/[^0-9,.]/g, "")
          .replace(",", ".");
        value = parseFloat(clean) || 0;
      }
    }

    if (!sku) {
      const rows = Array.from(document.querySelectorAll("div, span, td, p"));
      const codeRow = rows.find(
        (el) =>
          el.textContent.includes("Tootekood:") ||
          el.textContent.includes("Tootekood"),
      );
      if (codeRow) {
        const clean = codeRow.textContent
          .replace(/Tootekood:?/i, "")
          .replace(/[\n\r\t]/g, "")
          .trim();
        if (clean && clean.length < 50) sku = clean;
      }
      if (!sku) {
        const idMatch = window.location.pathname.match(/-(\d+)$/);
        if (idMatch) sku = idMatch[1];
      }
    }

    if (!description) {
      const descEl =
        document.querySelector("#tab-description") ||
        document.querySelector(".product-description") ||
        document.querySelector('[itemprop="description"]');
      if (descEl) description = descEl.textContent.trim();
    }

    // 3. Media hub full-resolution image regex
    const pageHtml = document.documentElement.innerHTML;
    const regex =
      /https?:\/\/(?:media|cms)\.arvutitark\.ee\/[^\s"'<>)]+\.(?:jpg|jpeg|png|webp)/gi;
    let m;
    while ((m = regex.exec(pageHtml))) {
      let url = m[0];
      if (
        url.includes("/storage/media-hub-cms/") &&
        (url.includes("wallet") ||
          url.includes("shield") ||
          url.includes("icon") ||
          url.includes("logo") ||
          url.includes(".svg"))
      ) {
        continue;
      }
      if (url.includes("/https%3A%2F%2Fcms.arvutitark.ee%2F")) {
        const encodedMatch = url.match(
          /https%3A%2F%2Fcms\.arvutitark\.ee%2F[^\s"'<>)]+/i,
        );
        if (encodedMatch) url = decodeURIComponent(encodedMatch[0]);
      }
      if (!imageUrls.includes(url)) imageUrls.push(url);
    }

    return {
      name,
      description,
      value,
      currency,
      url: window.location.href.split("?")[0],
      imageUrls: deduplicateImages(imageUrls),
      sku,
      manufacturer,
    };
  }

  function scrapeListingItem(cardEl) {
    const titleEl =
      cardEl.querySelector(".catalogue-product-name") ||
      cardEl.querySelector("h3 a") ||
      cardEl.querySelector("h3") ||
      cardEl.querySelector("a.catalogue-product-link");
    const name = titleEl ? titleEl.textContent.trim() : "";

    const linkEl =
      cardEl.querySelector("a.catalogue-product-link") ||
      (cardEl.tagName === "A" ? cardEl : cardEl.querySelector("a"));
    const href = linkEl ? linkEl.getAttribute("href") : "";
    const fullUrl = href
      ? href.startsWith("/")
        ? window.location.origin + href
        : href
      : window.location.href;

    const priceEl =
      cardEl.querySelector(".catalogue-product-price") ||
      cardEl.querySelector("._main-price") ||
      cardEl.querySelector(".price");
    let value = 0;
    if (priceEl) {
      const cleanPrice = priceEl.textContent
        .replace(/[^0-9,.]/g, "")
        .replace(",", ".");
      value = parseFloat(cleanPrice) || 0;
    }

    const imgEl = cardEl.querySelector("img");
    const imageUrl = imgEl
      ? imgEl.getAttribute("data-original") || imgEl.src
      : "";

    return {
      name,
      description: `Quick-added from ${ADAPTER_NAME} catalog.`,
      value,
      currency: "EUR",
      url: fullUrl,
      imageUrls: imageUrl ? deduplicateImages([imageUrl]) : [],
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
        let manufacturer = itemDetails.manufacturer;
        let value = itemDetails.value;
        const imageUrls = [...itemDetails.imageUrls];

        // 1. JSON-LD
        const jsonLdScripts = doc.querySelectorAll(
          'script[type="application/ld+json"]',
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
              if (item.sku || item.mpn || item.gtin14) {
                sku = item.sku || item.mpn || item.gtin14;
              }
              if (item.brand) {
                manufacturer = item.brand.name || item.brand;
              }
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
                  if (img && !imageUrls.includes(img)) imageUrls.push(img);
                });
              }
            }
          } catch {
            // ignore
          }
        });

        // 2. Regex for media hub images
        const regex =
          /https?:\/\/(?:media|cms)\.arvutitark\.ee\/[^\s"'<>)]+\.(?:jpg|jpeg|png|webp)/gi;
        let m;
        while ((m = regex.exec(htmlText))) {
          let url = m[0];
          if (
            url.includes("/storage/media-hub-cms/") &&
            (url.includes("wallet") ||
              url.includes("shield") ||
              url.includes("icon") ||
              url.includes("logo") ||
              url.includes(".svg"))
          ) {
            continue;
          }
          if (url.includes("/https%3A%2F%2Fcms.arvutitark.ee%2F")) {
            const encodedMatch = url.match(
              /https%3A%2F%2Fcms\.arvutitark\.ee%2F[^\s"'<>)]+/i,
            );
            if (encodedMatch) url = decodeURIComponent(encodedMatch[0]);
          }
          if (!imageUrls.includes(url)) imageUrls.push(url);
        }

        return {
          ...itemDetails,
          description,
          sku,
          manufacturer,
          value,
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
