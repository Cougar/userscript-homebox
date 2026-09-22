// ==UserScript==
// @name         Homebox Connector - [Platform] Magento
// @namespace    https://github.com/Cougar/userscript-homebox
// @version      1.0.0
// @description  Homebox e-shop integration platform adapter for Magento (Bauhaus etc.)
// @author       Cougar
// @homepageURL  https://github.com/Cougar/userscript-homebox
// @supportURL   https://github.com/Cougar/userscript-homebox/issues
// @downloadURL  https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-platform-magento.user.js
// @updateURL    https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-platform-magento.user.js
// @match        *://*.bauhaus.ee/*
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// ==/UserScript==

(function () {
  "use strict";

  // --- Constants & Configuration ---
  const ADAPTER_ID = "platform-magento";
  const ADAPTER_NAME = "Magento";
  const PROTOCOL_VERSION = "1.0.0";
  const CORE_INSTALL_URL =
    "https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-core.user.js";

  const UI_CONFIG = {
    detail: {
      targetSelector:
        '#product-addtocart-button, .box-tocart .action.tocart, [data-testid="add-to-cart-button"]',
      insertPosition: "afterend",
      buttonText: "Add to Homebox",
      theme: {
        nativeClasses: ["action", "primary", "tocart"],
        styleOverrides: {
          marginLeft: "10px",
        },
      },
    },
    listing: {
      cardSelector: ".product-item-info, .product-item",
      targetSelector: ".product-item-photo",
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
      !!document.querySelector('[data-testid="add-to-cart-button"]') ||
      window.location.pathname.includes("/postijalg-") ||
      !!document.querySelector("h1.font-semibold") ||
      !!document.querySelector("#product-addtocart-button")
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
    let productData = null;
    const schemaScripts = document.querySelectorAll(
      'script[type="application/ld+json"]',
    );
    schemaScripts.forEach((script) => {
      try {
        const data = JSON.parse(script.textContent);
        const items = Array.isArray(data) ? data : [data];
        const prod = items.find((i) => i["@type"] === "Product");
        if (prod) productData = prod;
      } catch {
        // ignore
      }
    });

    if (productData) {
      const images = [];
      if (productData.image) {
        if (Array.isArray(productData.image)) {
          images.push(...productData.image);
        } else if (typeof productData.image === "string") {
          images.push(productData.image);
        } else if (productData.image.url) {
          images.push(productData.image.url);
        }
      }

      let price =
        parseFloat(
          productData.offers
            ? productData.offers.price || productData.offers[0]?.price
            : productData.price,
        ) || 0;

      return {
        name: productData.name,
        description: productData.description || "",
        value: price,
        currency: "EUR",
        url: window.location.href.split("?")[0],
        imageUrls: deduplicateImages(images),
        sku: productData.sku || "",
        manufacturer: productData.brand
          ? productData.brand.name || productData.brand
          : "",
      };
    }

    const titleEl =
      document.querySelector("h1.page-title span") ||
      document.querySelector(".page-title-wrapper .page-title") ||
      document.querySelector(".product-info-main h1") ||
      document.querySelector('[itemprop="name"]');
    const name = titleEl ? titleEl.textContent.trim() : "";

    const descEl =
      document.querySelector(".product.attribute.description .value") ||
      document.querySelector(".description .value") ||
      document.querySelector("#description") ||
      document.querySelector('[itemprop="description"]');
    const description = descEl ? descEl.innerHTML.trim() : "";

    const skuEl =
      document.querySelector(".product.attribute.sku .value") ||
      document.querySelector(".product-info-stock-sku .value") ||
      document.querySelector(".sku .value") ||
      document.querySelector('[itemprop="sku"]');
    const sku = skuEl ? skuEl.textContent.trim() : "";

    const priceEl =
      document.querySelector('[data-price-type="finalPrice"] .price') ||
      document.querySelector(".price-box .price") ||
      document.querySelector(".price-final_price .price") ||
      document.querySelector(".price") ||
      document.querySelector('[itemprop="price"]');
    let value = 0;
    if (priceEl) {
      const priceText = priceEl.textContent
        .replace(/[^0-9,.]/g, "")
        .replace(",", ".");
      value = parseFloat(priceText) || 0;
    }

    const imageUrls = [];
    const galleryImages = document.querySelectorAll(
      '.fotorama__stage .fotorama__img, .fotorama__nav .fotorama__img, .fotorama__img, [itemprop="image"]',
    );
    galleryImages.forEach((img) => {
      const src = img.getAttribute("data-src") || img.src;
      if (src && !imageUrls.includes(src)) {
        imageUrls.push(src);
      }
    });

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
      cardEl.querySelector(".product-item-name a") ||
      cardEl.querySelector(".product-item-link") ||
      cardEl.querySelector("h2 a") ||
      cardEl.querySelector("h3 a") ||
      cardEl.querySelector("a.product-item-link");
    const name = titleEl ? titleEl.textContent.trim() : "";

    const linkEl =
      cardEl.querySelector("a.product-item-link") ||
      cardEl.querySelector("a.product-item-photo") ||
      (cardEl.tagName === "A" ? cardEl : cardEl.querySelector("a"));
    const href = linkEl ? linkEl.getAttribute("href") : "";
    const fullUrl = href
      ? href.startsWith("/")
        ? window.location.origin + href
        : href
      : window.location.href;

    const priceEl =
      cardEl.querySelector('[data-price-type="finalPrice"] .price') ||
      cardEl.querySelector(".price-wrapper .price") ||
      cardEl.querySelector(".price");
    let value = 0;
    if (priceEl) {
      const priceText = priceEl.textContent
        .replace(/[^0-9,.]/g, "")
        .replace(",", ".");
      value = parseFloat(priceText) || 0;
    }

    const imgEl = cardEl.querySelector("img.product-image-photo, img");
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
          doc.querySelector("h1.page-title span") ||
          doc.querySelector(".page-title-wrapper .page-title") ||
          doc.querySelector(".product-info-main h1") ||
          doc.querySelector('[itemprop="name"]');
        const name = titleEl ? titleEl.textContent.trim() : itemDetails.name;

        const descEl =
          doc.querySelector(".product.attribute.description .value") ||
          doc.querySelector(".description .value") ||
          doc.querySelector("#description") ||
          doc.querySelector('[itemprop="description"]');
        if (descEl) description = descEl.innerHTML.trim();

        const skuEl =
          doc.querySelector(".product.attribute.sku .value") ||
          doc.querySelector(".product-info-stock-sku .value") ||
          doc.querySelector(".sku .value") ||
          doc.querySelector('[itemprop="sku"]');
        if (skuEl) sku = skuEl.textContent.trim();

        const priceEl =
          doc.querySelector('[data-price-type="finalPrice"] .price') ||
          doc.querySelector(".price-box .price") ||
          doc.querySelector(".price-final_price .price") ||
          doc.querySelector(".price") ||
          doc.querySelector('[itemprop="price"]');
        if (priceEl) {
          const priceText = priceEl.textContent
            .replace(/[^0-9,.]/g, "")
            .replace(",", ".");
          value = parseFloat(priceText) || value;
        }

        const galleryImages = doc.querySelectorAll(
          '.fotorama__stage .fotorama__img, .fotorama__nav .fotorama__img, .fotorama__img, [itemprop="image"]',
        );
        galleryImages.forEach((img) => {
          const src = img.getAttribute("data-src") || img.src;
          if (src && !imageUrls.includes(src)) {
            imageUrls.push(src);
          }
        });

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
