// ==UserScript==
// @name         Homebox Connector - [Platform] OpenCart
// @namespace    https://github.com/Cougar/userscript-homebox
// @version      1.0.0
// @description  Homebox e-shop integration platform adapter for OpenCart (Oomipood etc.)
// @author       Cougar
// @homepageURL  https://github.com/Cougar/userscript-homebox
// @supportURL   https://github.com/Cougar/userscript-homebox/issues
// @downloadURL  https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-platform-opencart.user.js
// @updateURL    https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-platform-opencart.user.js
// @match        *://*.oomipood.ee/*
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// ==/UserScript==

(function () {
  "use strict";

  // --- Constants & Configuration ---
  const ADAPTER_ID = "platform-opencart";
  const ADAPTER_NAME = "OpenCart";
  const PROTOCOL_VERSION = "1.0.0";
  const CORE_INSTALL_URL =
    "https://raw.githubusercontent.com/Cougar/userscript-homebox/main/homebox-core.user.js";

  const UI_CONFIG = {
    detail: {
      targetSelector: "#button-cart, .button-cart",
      insertPosition: "afterend",
      buttonText: "Add to Homebox",
      theme: {
        nativeClasses: ["btn", "btn-primary", "button-cart"],
        styleOverrides: {
          marginLeft: "10px",
        },
      },
    },
    listing: {
      cardSelector: ".product-layout, .product-thumb, .product-item",
      targetSelector: ".image",
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
      !!document.querySelector("body.product-product") ||
      window.location.pathname.includes("/product/")
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
    let name = "";
    let description = "";
    let value = 0;
    let sku = "";
    let manufacturer = "";
    const imageUrls = [];
    const attachments = [];

    // 1. Parse JSON-LD Schema
    const schemaScript = document.querySelector(
      'script[type="application/ld+json"]',
    );
    if (schemaScript) {
      try {
        const data = JSON.parse(schemaScript.textContent);
        if (data["@type"] === "Product") {
          name = data.name || "";
          description = data.description || "";
          sku = data.sku || "";
          manufacturer = data.brand ? data.brand.name || data.brand : "";

          if (data.offers) {
            const offers = Array.isArray(data.offers)
              ? data.offers[0]
              : data.offers;
            value = parseFloat(offers.price) || 0;
          }

          if (data.image) {
            const imgs = Array.isArray(data.image) ? data.image : [data.image];
            imgs.forEach((i) => {
              if (i && !imageUrls.includes(i)) imageUrls.push(i);
            });
          }
        }
      } catch {
        // ignore
      }
    }

    if (!name) {
      const titleEl = document.querySelector("h1");
      name = titleEl ? titleEl.textContent.trim() : "";
    }

    // 2. Client discount price check
    const customerPriceEl =
      document.querySelector(".customer-price strong") ||
      document.querySelector(".price-customer strong");
    if (customerPriceEl) {
      const cleanPrice = customerPriceEl.textContent
        .replace(/[^0-9,.]/g, "")
        .replace(",", ".");
      value = parseFloat(cleanPrice) || value;
    }

    // 3. High-res image extraction via regex
    const pageHtml = document.documentElement.innerHTML;
    const oomiRegex =
      /\/image\/cachewebp\/800x800\/catalog\/[a-z0-9_\\\-/.]+/gi;
    let m;
    while ((m = oomiRegex.exec(pageHtml))) {
      let href = m[0].replace(/\\/g, "");
      if (href.startsWith("/")) {
        href = window.location.origin + href;
      }
      if (!imageUrls.includes(href)) {
        imageUrls.push(href);
      }
    }

    // 4. Attachments (PDFs)
    const pdfLinks = document.querySelectorAll(
      'a[href$=".pdf"], a[href*=".pdf"]',
    );
    pdfLinks.forEach((el) => {
      let href = el.getAttribute("href");
      if (href) {
        if (href.startsWith("/")) {
          href = window.location.origin + href;
        }
        const spanEl = el.parentNode
          ? el.parentNode.querySelector("span")
          : null;
        let pdfName = spanEl ? spanEl.textContent.trim() : "";
        if (!pdfName) {
          try {
            const urlPath = new URL(href).pathname;
            const fileName = urlPath.substring(urlPath.lastIndexOf("/") + 1);
            pdfName =
              decodeURIComponent(
                fileName.substring(0, fileName.lastIndexOf(".")),
              ) || "Manual";
          } catch {
            pdfName = "Manual";
          }
        }
        if (!attachments.some((att) => att.url === href)) {
          attachments.push({ url: href, name: pdfName });
        }
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
      manufacturer,
      attachments,
    };
  }

  function scrapeListingItem(cardEl) {
    const titleEl =
      cardEl.querySelector(".caption h4 a") ||
      cardEl.querySelector(".name a") ||
      cardEl.querySelector("h4 a") ||
      cardEl.querySelector("h4") ||
      cardEl.querySelector("a.product-name");
    const name = titleEl ? titleEl.textContent.trim() : "";

    const linkEl =
      cardEl.querySelector('a[href*="/product/"]') ||
      cardEl.querySelector(".image a") ||
      (cardEl.tagName === "A" ? cardEl : cardEl.querySelector("a"));
    const href = linkEl ? linkEl.getAttribute("href") : "";
    const fullUrl = href
      ? href.startsWith("/")
        ? window.location.origin + href
        : href
      : window.location.href;

    const priceEl =
      cardEl.querySelector(".customer-price strong") ||
      cardEl.querySelector(".price-new") ||
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
        let value = itemDetails.value;
        const imageUrls = [];
        const attachments = [];

        // 1. JSON-LD
        const schemaScript = doc.querySelector(
          'script[type="application/ld+json"]',
        );
        if (schemaScript) {
          try {
            const data = JSON.parse(schemaScript.textContent);
            if (data["@type"] === "Product") {
              if (data.description) description = data.description;
              if (data.sku) sku = data.sku;
              if (data.brand) {
                manufacturer = data.brand.name || data.brand;
              }
              if (data.offers) {
                const offers = Array.isArray(data.offers)
                  ? data.offers[0]
                  : data.offers;
                value = parseFloat(offers.price) || value;
              }
              if (data.image) {
                const imgs = Array.isArray(data.image)
                  ? data.image
                  : [data.image];
                imgs.forEach((i) => {
                  if (i && !imageUrls.includes(i)) imageUrls.push(i);
                });
              }
            }
          } catch {
            // ignore
          }
        }

        // 2. Client discount price check
        const customerPriceEl =
          doc.querySelector(".customer-price strong") ||
          doc.querySelector(".price-customer strong");
        if (customerPriceEl) {
          const cleanPrice = customerPriceEl.textContent
            .replace(/[^0-9,.]/g, "")
            .replace(",", ".");
          value = parseFloat(cleanPrice) || value;
        }

        // 3. High-res images regex
        const oomiRegex =
          /\/image\/cachewebp\/800x800\/catalog\/[a-z0-9_\\\-/.]+/gi;
        let m;
        while ((m = oomiRegex.exec(htmlText))) {
          let href = m[0].replace(/\\/g, "");
          if (href.startsWith("/")) {
            try {
              const origin = new URL(itemDetails.url).origin;
              href = origin + href;
            } catch {
              href = window.location.origin + href;
            }
          }
          if (!imageUrls.includes(href)) {
            imageUrls.push(href);
          }
        }

        // 4. PDF attachments
        const pdfLinks = doc.querySelectorAll(
          'a[href$=".pdf"], a[href*=".pdf"]',
        );
        pdfLinks.forEach((el) => {
          let href = el.getAttribute("href");
          if (href) {
            if (href.startsWith("/")) {
              try {
                const origin = new URL(itemDetails.url).origin;
                href = origin + href;
              } catch {
                href = window.location.origin + href;
              }
            }
            const spanEl = el.parentNode
              ? el.parentNode.querySelector("span")
              : null;
            let pdfName = spanEl ? spanEl.textContent.trim() : "";
            if (!pdfName) {
              try {
                const urlPath = new URL(href).pathname;
                const fileName = urlPath.substring(
                  urlPath.lastIndexOf("/") + 1,
                );
                pdfName =
                  decodeURIComponent(
                    fileName.substring(0, fileName.lastIndexOf(".")),
                  ) || "Manual";
              } catch {
                pdfName = "Manual";
              }
            }
            if (!attachments.some((att) => att.url === href)) {
              attachments.push({ url: href, name: pdfName });
            }
          }
        });

        return {
          ...itemDetails,
          description,
          sku,
          manufacturer,
          value,
          attachments,
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
