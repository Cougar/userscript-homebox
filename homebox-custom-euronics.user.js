// ==UserScript==
// @name         Homebox Connector - [Custom] Euronics
// @namespace    https://github.com/Cougar/userscript-homebox
// @version      1.0.4
// @description  Homebox e-shop integration custom adapter for Euronics
// @author       Cougar
// @homepageURL  https://github.com/Cougar/userscript-homebox
// @supportURL   https://github.com/Cougar/userscript-homebox/issues
// @downloadURL  https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-custom-euronics.user.js
// @updateURL    https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-custom-euronics.user.js
// @match        *://*.euronics.ee/*
// @match        *://*.euronics.lv/*
// @match        *://*.euronics.lt/*
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// ==/UserScript==

(function () {
  "use strict";

  // --- Constants & Configuration ---
  const ADAPTER_ID = "custom-euronics";
  const ADAPTER_NAME = "Euronics";
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
        ".product__buttons div:first-child",
        ".product__buttons button[data-card-add-remove-id]",
        ".product__buttons button",
        ".pricing-block button.button--medium.add-to-cart",
        ".pricing-block button.add-to-cart",
      ],
      insertPosition: "afterend",
      buttonText: "Add to Homebox",
      theme: {
        nativeClasses: ["button", "button--tertiary", "m-b-8"],
        styleOverrides: {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: "8px",
          minHeight: "36px",
          height: "36px",
          padding: "0 12px",
          fontSize: "14px",
          fontWeight: "600",
          backgroundColor: "#e4e6ec",
          color: "#00178f",
          border: "none",
          borderRadius: "25px",
          cursor: "pointer",
        },
      },
    },
    listing: {
      cardSelector: ".product-card, .carousel-card, article[data-product-name]",
      targetSelector: ".product-card__image-wrapper, .image__wrapper",
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
      document.querySelector("button.add-to-cart") ||
      document.querySelector(".product__title") ||
      document.querySelector('[itemprop="offers"]')
    );
  }

  function deduplicateImages(urls) {
    const groups = {};
    urls.forEach((url) => {
      const clean = url.replace(/-medium\.([a-z0-9]+)$/i, ".$1");
      const key = clean.replace(/\.[a-z0-9]+$/i, "");
      if (!groups[key]) groups[key] = [];
      groups[key].push(clean);
    });

    const deduplicated = [];
    Object.keys(groups).forEach((key) => {
      const list = groups[key];
      const fullRes = list.find((u) => !u.includes("-medium"));
      const chosen = fullRes || list[0];
      if (!deduplicated.includes(chosen)) {
        deduplicated.push(chosen);
      }
    });
    return deduplicated;
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
    const jsonLdScripts = document.querySelectorAll('script[type*="json"]');
    jsonLdScripts.forEach((script) => {
      try {
        const data = JSON.parse(script.textContent);
        const graph = Array.isArray(data["@graph"]) ? data["@graph"] : [data];

        const product = graph.find((x) => x["@type"] === "Product");
        if (product) {
          if (!name && product.name) name = product.name;
          if (!description && product.description)
            description = product.description;
          if (!sku && (product.sku || product.model))
            sku = product.sku || product.model;
          if (!manufacturer && product.brand) {
            manufacturer = product.brand.name || product.brand;
          }
          if (product.image) {
            const imgs = Array.isArray(product.image)
              ? product.image
              : [product.image];
            imgs.forEach((u) => {
              const fullRes = u.replace(/-medium\.([a-z0-9]+)$/i, ".$1");
              if (!imageUrls.includes(fullRes)) imageUrls.push(fullRes);
            });
          }
        }

        const offer = graph.find((x) => x["@type"] === "Offer");
        if (offer) {
          if (offer.price) value = parseFloat(offer.price) || value;
          if (offer.priceCurrency) currency = offer.priceCurrency;
        }
      } catch {
        // ignore
      }
    });

    // 2. DOM fallbacks
    const titleEl =
      document.querySelector(".product__title") || document.querySelector("h1");
    if (!name && titleEl) {
      name =
        titleEl.getAttribute("data-product-name-native") ||
        titleEl.getAttribute("data-product-name") ||
        titleEl.textContent.trim();
    }

    if (!manufacturer) {
      const brandEl =
        document.querySelector(".product__info [data-product-brand]") ||
        document.querySelector("[data-product-brand]");
      if (brandEl) {
        manufacturer =
          brandEl.getAttribute("data-product-brand") ||
          brandEl.textContent.trim();
      }
    }

    if (!value) {
      const priceBtn = document.querySelector("button[data-product-price]");
      if (priceBtn) {
        value = parseFloat(priceBtn.getAttribute("data-product-price")) || 0;
      }
    }
    if (!value) {
      const productInfo = document.querySelector(
        ".product__info, .product-header",
      );
      const priceDataEl =
        (productInfo
          ? productInfo.querySelector("[data-product-price]")
          : null) || document.querySelector("[data-product-price]");
      if (priceDataEl) {
        value = parseFloat(priceDataEl.getAttribute("data-product-price")) || 0;
      }
    }
    if (!value) {
      const priceEl =
        document.querySelector(".price__original") ||
        document.querySelector(".pricing-block .price") ||
        document.querySelector(".price");
      if (priceEl) {
        const clean = priceEl.textContent
          .replace(/[^0-9,.]/g, "")
          .replace(",", ".");
        value = parseFloat(clean) || 0;
      }
    }

    if (!sku) {
      const codeBtn = document.querySelector("button[data-product-code]");
      if (codeBtn) sku = codeBtn.getAttribute("data-product-code") || "";
    }
    if (!sku) {
      const codeEl =
        document.querySelector(".product__info [data-product-code]") ||
        document.querySelector("[data-product-code]");
      if (codeEl) {
        sku =
          codeEl.getAttribute("data-product-code") || codeEl.textContent.trim();
      }
    }

    if (!description) {
      const descEl =
        document.querySelector(".product__info__text") ||
        document.querySelector(".product-description") ||
        document.querySelector("#product-description-content") ||
        document.querySelector('[itemprop="description"]');
      if (descEl) description = descEl.textContent.trim();
    }

    // 3. High-resolution gallery images from DOM
    const galleryImgs = document.querySelectorAll(
      ".slider__image, .product-image__img, .product-image img",
    );
    galleryImgs.forEach((img) => {
      const src = img.getAttribute("data-src") || img.src;
      if (src && src.includes("/UserFiles/Products/Images/")) {
        const fullRes = src.replace(/-medium\.([a-z0-9]+)$/i, ".$1");
        if (!imageUrls.includes(fullRes)) imageUrls.push(fullRes);
      }
    });

    // 4. Attachments (PDF manuals)
    const attachments = [];
    const pdfLinks = document.querySelectorAll(
      'a[href*=".pdf"], a.manual, a.datasheet',
    );
    pdfLinks.forEach((link) => {
      const href = link.href;
      if (href && !attachments.some((a) => a.url === href)) {
        const title = link.textContent.trim() || "Manual";
        attachments.push({
          url: href,
          name: title.endsWith(".pdf") ? title : `${title}.pdf`,
        });
      }
    });

    return {
      name,
      description,
      value,
      currency,
      url: window.location.href.split("?")[0],
      imageUrls: deduplicateImages(imageUrls),
      attachments,
      sku,
      manufacturer,
    };
  }

  function scrapeListingItem(cardEl) {
    const titleEl =
      cardEl.querySelector(
        ".product-card__title, .carousel-card__title, h5, h4, h3",
      ) || cardEl.querySelector("a");
    const name =
      cardEl.getAttribute("data-product-name") ||
      (titleEl ? titleEl.textContent.trim() : "");

    const linkEl =
      cardEl.querySelector("a.product-card__link") ||
      cardEl.querySelector("a.carousel-card__link") ||
      cardEl.querySelector("a");
    const href = linkEl ? linkEl.getAttribute("href") : "";
    const fullUrl = href
      ? href.startsWith("/")
        ? window.location.origin + href
        : href
      : window.location.href;

    let value = 0;
    const priceAttr = cardEl.getAttribute("data-product-price");
    if (priceAttr) {
      value = parseFloat(priceAttr) || 0;
    } else {
      const priceEl = cardEl.querySelector(".price, .product-card__price");
      if (priceEl) {
        const clean = priceEl.textContent
          .replace(/[^0-9,.]/g, "")
          .replace(",", ".");
        value = parseFloat(clean) || 0;
      }
    }

    const sku = cardEl.getAttribute("data-product-code") || "";

    const imgEl = cardEl.querySelector("img");
    let imageUrl = imgEl ? imgEl.getAttribute("data-src") || imgEl.src : "";
    if (imageUrl) {
      imageUrl = imageUrl.replace(/-medium\.([a-z0-9]+)$/i, ".$1");
    }

    return {
      name,
      description: `Quick-added from ${ADAPTER_NAME} catalog.`,
      value,
      currency: "EUR",
      url: fullUrl,
      imageUrls: imageUrl ? [imageUrl] : [],
      sku,
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
        const attachments = [];

        // 1. JSON-LD
        const jsonLdScripts = doc.querySelectorAll('script[type*="json"]');
        jsonLdScripts.forEach((script) => {
          try {
            const data = JSON.parse(script.textContent);
            const graph = Array.isArray(data["@graph"])
              ? data["@graph"]
              : [data];

            const product = graph.find((x) => x["@type"] === "Product");
            if (product) {
              if (product.description) description = product.description;
              if (product.sku || product.model) {
                sku = product.sku || product.model;
              }
              if (product.brand) {
                manufacturer = product.brand.name || product.brand;
              }
              if (product.image) {
                const imgs = Array.isArray(product.image)
                  ? product.image
                  : [product.image];
                imgs.forEach((u) => {
                  const fullRes = u.replace(/-medium\.([a-z0-9]+)$/i, ".$1");
                  if (!imageUrls.includes(fullRes)) imageUrls.push(fullRes);
                });
              }
            }

            const offer = graph.find((x) => x["@type"] === "Offer");
            if (offer && offer.price) {
              value = parseFloat(offer.price) || value;
            }
          } catch {
            // ignore
          }
        });

        // 2. High-res gallery images from DOM
        const galleryImgs = doc.querySelectorAll(
          ".slider__image, .product-image__img, .product-image img",
        );
        galleryImgs.forEach((img) => {
          const src = img.getAttribute("data-src") || img.src;
          if (src && src.includes("/UserFiles/Products/Images/")) {
            const fullRes = src.replace(/-medium\.([a-z0-9]+)$/i, ".$1");
            if (!imageUrls.includes(fullRes)) imageUrls.push(fullRes);
          }
        });

        // 3. Attachments (PDF manuals)
        const pdfLinks = doc.querySelectorAll(
          'a[href*=".pdf"], a.manual, a.datasheet',
        );
        pdfLinks.forEach((link) => {
          const href = link.href;
          if (href && !attachments.some((a) => a.url === href)) {
            const title = link.textContent.trim() || "Manual";
            attachments.push({
              url: href,
              name: title.endsWith(".pdf") ? title : `${title}.pdf`,
            });
          }
        });

        return {
          ...itemDetails,
          description,
          sku,
          manufacturer,
          value,
          attachments,
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
