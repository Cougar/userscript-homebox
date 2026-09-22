// ==UserScript==
// @name         Homebox Connector - [Platform] WooCommerce
// @namespace    https://github.com/Cougar/userscript-homebox
// @version      1.0.0
// @description  Homebox e-shop integration platform adapter for WooCommerce (Handymann etc.)
// @author       Cougar
// @homepageURL  https://github.com/Cougar/userscript-homebox
// @supportURL   https://github.com/Cougar/userscript-homebox/issues
// @downloadURL  https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-platform-woocommerce.user.js
// @updateURL    https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-platform-woocommerce.user.js
// @match        *://*.handymann.ee/*
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// ==/UserScript==

(function () {
  "use strict";

  // --- Constants & Configuration ---
  const ADAPTER_ID = "platform-woocommerce";
  const ADAPTER_NAME = "WooCommerce";
  const PROTOCOL_VERSION = "1.0.0";
  const CORE_INSTALL_URL =
    "https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-core.user.js";

  const UI_CONFIG = {
    detail: {
      targetSelector:
        ".summary .single_add_to_cart_button, button.single_add_to_cart_button, .single_add_to_cart_button, .summary form.cart button[type='submit']",
      insertPosition: "afterend",
      buttonText: "Add to Homebox",
      theme: {
        nativeClasses: ["button", "alt"],
        styleOverrides: {
          marginLeft: "10px",
          verticalAlign: "middle",
        },
      },
    },
    listing: {
      cardSelector: "li.product, .products .product, .wpb-wps-slider-item",
      targetSelector: ".image-wrapper, a.woocommerce-LoopProduct-link",
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
    return !!document.querySelector(".product_title");
  }

  function deduplicateImages(urls) {
    const groups = {};
    urls.forEach((url) => {
      const key = url
        .replace(/-\d+x\d+(?=\.[a-z0-9]+$)/i, "")
        .replace(/-scaled(?=\.[a-z0-9]+$)/i, "");
      if (!groups[key]) groups[key] = [];
      groups[key].push(url);
    });

    const deduplicated = [];
    Object.keys(groups).forEach((key) => {
      const groupUrls = groups[key];
      const scaledVersion = groupUrls.find((u) => u.includes("-scaled"));
      if (scaledVersion) {
        deduplicated.push(scaledVersion);
        return;
      }
      const originalVersion = groupUrls.find(
        (u) => !/-\d+x\d+(?=\.[a-z0-9]+$)/i.test(u),
      );
      if (originalVersion) {
        deduplicated.push(originalVersion);
        return;
      }
      deduplicated.push(groupUrls[0]);
    });
    return deduplicated;
  }

  function scrapeProductDetails() {
    const titleEl = document.querySelector(".product_title");
    const name = titleEl ? titleEl.textContent.trim() : "";

    const priceEl =
      document.querySelector(".summary .price .woocommerce-Price-amount bdi") ||
      document.querySelector(".summary .price .woocommerce-Price-amount") ||
      document.querySelector(".price .woocommerce-Price-amount");
    let value = 0;
    if (priceEl) {
      const priceText = priceEl.textContent
        .replace(/[^0-9,.]/g, "")
        .replace(",", ".");
      value = parseFloat(priceText) || 0;
    }

    const descEl = document.querySelector(
      ".woocommerce-product-details__short-description",
    );
    const description = descEl ? descEl.textContent.trim() : "";

    const skuEl = document.querySelector(".product_meta .sku");
    const sku = skuEl ? skuEl.textContent.trim() : "";

    const brandEl =
      document.querySelector(".product_meta .posted_in a") ||
      document.querySelector(".product_meta .tagged_as a");
    const manufacturer = brandEl ? brandEl.textContent.trim() : "";

    const imageUrls = [];
    const galleryEls = document.querySelectorAll(
      ".woocommerce-product-gallery__wrapper a, .woocommerce-product-gallery__image img, .woocommerce-product-gallery img",
    );
    galleryEls.forEach((el) => {
      let src = "";
      if (el.tagName === "A") {
        src = el.getAttribute("href");
      } else if (el.tagName === "IMG") {
        src =
          el.getAttribute("data-large_image") ||
          el.getAttribute("data-src") ||
          el.src;
      }
      if (src && src.startsWith("http") && !imageUrls.includes(src)) {
        imageUrls.push(src);
      }
    });

    if (imageUrls.length === 0) {
      const imgEl = document.querySelector(".woocommerce-product-gallery img");
      if (imgEl && imgEl.src) imageUrls.push(imgEl.src);
    }

    return {
      name,
      description,
      value,
      currency: "EUR",
      url: window.location.href.split("?")[0],
      imageUrls: deduplicateImages(imageUrls),
      sku,
      manufacturer,
    };
  }

  function scrapeListingItem(cardEl) {
    const titleEl =
      cardEl.querySelector(".woocommerce-loop-product__title") ||
      cardEl.querySelector(".product-title") ||
      cardEl.querySelector("h2") ||
      cardEl.querySelector("h3");
    const name = titleEl ? titleEl.textContent.trim() : "";

    const linkEl =
      cardEl.querySelector("a.woocommerce-LoopProduct-link") ||
      (cardEl.tagName === "A" ? cardEl : cardEl.querySelector("a"));
    const href = linkEl ? linkEl.getAttribute("href") : "";
    const fullUrl = href
      ? href.startsWith("/")
        ? window.location.origin + href
        : href
      : window.location.href;

    const priceEl =
      cardEl.querySelector(".price .woocommerce-Price-amount bdi") ||
      cardEl.querySelector(".price .woocommerce-Price-amount") ||
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
        let manufacturer = itemDetails.manufacturer;
        const imageUrls = [];

        const descEl = doc.querySelector(
          ".woocommerce-product-details__short-description",
        );
        if (descEl) description = descEl.textContent.trim();

        const skuEl = doc.querySelector(".product_meta .sku");
        if (skuEl) sku = skuEl.textContent.trim();

        const brandEl =
          doc.querySelector(".product_meta .posted_in a") ||
          doc.querySelector(".product_meta .tagged_as a");
        if (brandEl) manufacturer = brandEl.textContent.trim();

        const galleryEls = doc.querySelectorAll(
          ".woocommerce-product-gallery__wrapper a, .woocommerce-product-gallery__image img, .woocommerce-product-gallery img",
        );
        galleryEls.forEach((el) => {
          let src = "";
          if (el.tagName === "A") {
            src = el.getAttribute("href");
          } else if (el.tagName === "IMG") {
            src =
              el.getAttribute("data-large_image") ||
              el.getAttribute("data-src") ||
              el.src;
          }
          if (src && src.startsWith("http") && !imageUrls.includes(src)) {
            imageUrls.push(src);
          }
        });

        return {
          ...itemDetails,
          description,
          sku,
          manufacturer,
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
