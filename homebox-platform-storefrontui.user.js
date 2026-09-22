// ==UserScript==
// @name         Homebox Connector - [Platform] StorefrontUI
// @namespace    https://github.com/Cougar/userscript-homebox
// @version      1.0.0
// @description  Homebox e-shop integration platform adapter for StorefrontUI / Nuxt (Bauhof etc.)
// @author       Cougar
// @homepageURL  https://github.com/Cougar/userscript-homebox
// @supportURL   https://github.com/Cougar/userscript-homebox/issues
// @downloadURL  https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-platform-storefrontui.user.js
// @updateURL    https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-platform-storefrontui.user.js
// @match        *://*.bauhof.ee/*
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// ==/UserScript==

(function () {
  "use strict";

  // --- Constants & Configuration ---
  const ADAPTER_ID = "platform-storefrontui";
  const ADAPTER_NAME = "StorefrontUI";
  const PROTOCOL_VERSION = "1.0.0";
  const CORE_INSTALL_URL =
    "https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-core.user.js";

  const UI_CONFIG = {
    detail: {
      targetSelector: ".product__add-to-cart, .sf-add-to-cart",
      insertPosition: "afterend",
      buttonText: "Add to Homebox",
      theme: {
        nativeClasses: ["sf-button", "sf-button--pure"],
        styleOverrides: {
          marginLeft: "10px",
        },
      },
    },
    listing: {
      cardSelector: ".sf-product-card, .product-card",
      targetSelector: ".sf-product-card__image-wrapper",
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
    return window.location.pathname.includes("/p/");
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
      document.querySelector(".sf-heading__title") ||
      document.querySelector("h1.sf-heading__title");
    const name = titleEl ? titleEl.textContent.trim() : "";

    const descEl = document.querySelector(".product__description");
    const description = descEl ? descEl.innerHTML.trim() : "";

    const skuEl =
      document.querySelector(".product-sku__value") ||
      document.querySelector(".product__sku");
    const sku = skuEl
      ? skuEl.textContent.trim().replace("Tootekood: ", "")
      : "";

    const priceEl =
      document.querySelector(".price-block") ||
      document.querySelector(".sf-price");
    let value = 0;
    if (priceEl) {
      const priceText = priceEl.textContent
        .replace(/[^0-9,.]/g, "")
        .replace(",", ".");
      value = parseFloat(priceText) || 0;
    }

    const imageUrls = [];
    if (sku) {
      const pageHtml = document.documentElement.innerHTML;
      const bauhofRegex =
        /https?:[^\s"']*(media\.bauhof\.ee)[^\s"']*\.(jpg|png|webp)/gi;
      let m;
      while ((m = bauhofRegex.exec(pageHtml))) {
        let href = m[0].replace(/\\u002F/g, "/").replace(/\\/g, "");
        if (href.includes(sku) && !imageUrls.includes(href)) {
          imageUrls.push(href);
        }
      }
    }

    if (imageUrls.length === 0) {
      const galleryImages = document.querySelectorAll(
        '.sf-gallery img, .sf-image, [itemprop="image"]',
      );
      galleryImages.forEach((img) => {
        const src = img.getAttribute("data-src") || img.src;
        if (src && !imageUrls.includes(src)) {
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
      imageUrls: deduplicateImages(imageUrls),
      sku,
      manufacturer: "",
    };
  }

  function scrapeListingItem(cardEl) {
    const titleEl =
      cardEl.querySelector(".sf-product-card__title") ||
      cardEl.querySelector(".product-title") ||
      cardEl.querySelector("h3") ||
      cardEl.querySelector("a.title");
    const name = titleEl ? titleEl.textContent.trim() : "";

    const linkEl =
      cardEl.querySelector("a.sf-product-card__link") ||
      cardEl.querySelector('a[href*="/p/"]') ||
      (cardEl.tagName === "A" ? cardEl : cardEl.querySelector("a"));
    const href = linkEl ? linkEl.getAttribute("href") : "";
    const fullUrl = href
      ? href.startsWith("/")
        ? window.location.origin + href
        : href
      : window.location.href;

    const priceEl =
      cardEl.querySelector(".sf-price__regular") ||
      cardEl.querySelector(".sf-price__special") ||
      cardEl.querySelector(".sf-price") ||
      cardEl.querySelector(".price");
    let value = 0;
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
        let value = itemDetails.value;
        const imageUrls = [];

        const titleEl =
          doc.querySelector(".sf-heading__title") ||
          doc.querySelector("h1.sf-heading__title");
        const name = titleEl ? titleEl.textContent.trim() : itemDetails.name;

        const descEl = doc.querySelector(".product__description");
        if (descEl) description = descEl.innerHTML.trim();

        const skuEl =
          doc.querySelector(".product-sku__value") ||
          doc.querySelector(".product__sku");
        if (skuEl) sku = skuEl.textContent.trim().replace("Tootekood: ", "");

        const priceEl =
          doc.querySelector(".price-block") || doc.querySelector(".sf-price");
        if (priceEl) {
          const priceText = priceEl.textContent
            .replace(/[^0-9,.]/g, "")
            .replace(",", ".");
          value = parseFloat(priceText) || value;
        }

        if (sku) {
          const bauhofRegex =
            /https?:[^\s"']*(media\.bauhof\.ee)[^\s"']*\.(jpg|png|webp)/gi;
          let m;
          while ((m = bauhofRegex.exec(htmlText))) {
            let href = m[0].replace(/\\u002F/g, "/").replace(/\\/g, "");
            if (href.includes(sku) && !imageUrls.includes(href)) {
              imageUrls.push(href);
            }
          }
        }

        return {
          ...itemDetails,
          name,
          description,
          sku,
          value,
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
