/**
 * Cookie helper + Recently Viewed Products (MOTHER & ME).
 * Stores product handles only; fetches live card HTML. Waits for jQuery/Shopify.
 */
(function bootRecentlyViewedModule(attempt) {
  if (typeof window.jQuery === 'undefined' || typeof window.Shopify === 'undefined') {
    if ((attempt || 0) > 120) return;
    window.setTimeout(function () {
      bootRecentlyViewedModule((attempt || 0) + 1);
    }, 50);
    return;
  }

  if (typeof jQuery.cookie !== 'function') {
    jQuery.cookie = function (b, j, m) {
      if (typeof j != 'undefined') {
        m = m || {};
        if (j === null) {
          j = '';
          m.expires = -1;
        }
        var e = '';
        if (m.expires && (typeof m.expires == 'number' || m.expires.toUTCString)) {
          var f;
          if (typeof m.expires == 'number') {
            f = new Date();
            f.setTime(f.getTime() + m.expires * 24 * 60 * 60 * 1000);
          } else {
            f = m.expires;
          }
          e = '; expires=' + f.toUTCString();
        }
        var l = m.path ? '; path=' + m.path : '';
        var g = m.domain ? '; domain=' + m.domain : '';
        var a = m.secure ? '; secure' : '';
        document.cookie = [b, '=', encodeURIComponent(j), e, l, g, a].join('');
      } else {
        var d = null;
        if (document.cookie && document.cookie != '') {
          var k = document.cookie.split(';');
          for (var h = 0; h < k.length; h++) {
            var c = jQuery.trim(k[h]);
            if (c.substring(0, b.length + 1) == b + '=') {
              d = decodeURIComponent(c.substring(b.length + 1));
              break;
            }
          }
        }
        return d;
      }
    };
  }

  Shopify.Products = (function () {
    var config = {
      howManyToShow: 4,
      howManyToStoreInMemory: 12,
      wrapperId: 'recently-viewed-products-list-2',
      templateId: 'recently-viewed-product-block',
      layout: 'grid',
      swipe: false,
      media: 'square',
      excludeHandle: '',
      handles: null,
      onComplete: null
    };

    var productHandleQueue = [];
    var wrapper = null;
    var renderedCount = 0;
    var activeRequestId = 0;

    function normalizeHandle(raw) {
      if (!raw) return '';
      try {
        raw = decodeURIComponent(String(raw));
      } catch (e) {}
      return String(raw)
        .split('?')[0]
        .split('#')[0]
        .replace(/^\/+|\/+$/g, '')
        .replace(/^products\//, '');
    }

    function getCurrentProductHandle() {
      if (config.excludeHandle) return normalizeHandle(config.excludeHandle);
      var path = window.location.pathname || '';
      var idx = path.indexOf('/products/');
      if (idx === -1) return '';
      var rest = path.slice(idx + '/products/'.length);
      return normalizeHandle(rest.split('/')[0]);
    }

    function isProductDetailPage() {
      var path = window.location.pathname || '';
      if (path.indexOf('/products/') === -1) return false;
      /* Ignore search / collection Ajax views that may include /products/ in query only */
      return true;
    }

    function dedupeHandles(list) {
      var seen = {};
      var out = [];
      for (var i = 0; i < list.length; i++) {
        var handle = normalizeHandle(list[i]);
        if (!handle || seen[handle]) continue;
        seen[handle] = true;
        out.push(handle);
      }
      return out;
    }

    var cookie = {
      configuration: {
        expires: 90,
        path: '/'
      },
      name: 'shopify_recently_viewed',
      write: function (recentlyViewed) {
        var value = recentlyViewed.join(' ');
        try {
          jQuery.cookie(this.name, value, this.configuration);
        } catch (e) {}
        try {
          localStorage.setItem(this.name, value);
        } catch (e2) {}
      },
      read: function () {
        var recentlyViewed = [];
        var cookieValue = null;
        try {
          cookieValue = jQuery.cookie(this.name);
        } catch (e) {}
        if (!cookieValue) {
          try {
            cookieValue = localStorage.getItem(this.name);
          } catch (e2) {}
        }
        if (cookieValue !== null && cookieValue !== undefined && cookieValue !== '') {
          recentlyViewed = String(cookieValue).split(/\s+/).filter(Boolean);
        }
        return dedupeHandles(recentlyViewed);
      },
      destroy: function () {
        try {
          jQuery.cookie(this.name, null, this.configuration);
        } catch (e) {}
        try {
          localStorage.removeItem(this.name);
        } catch (e2) {}
      },
      remove: function (productHandle) {
        var recentlyViewed = this.read();
        var normalized = normalizeHandle(productHandle);
        var next = recentlyViewed.filter(function (h) {
          return normalizeHandle(h) !== normalized;
        });
        this.write(next);
      }
    };

    function refreshMmCards() {
      try {
        document.dispatchEvent(new CustomEvent('mm:collection:updated'));
      } catch (e) {}
      if (window.mmWishlist && typeof window.mmWishlist.sync === 'function') {
        window.mmWishlist.sync();
      } else if (window.wishlist && window.wishlist.show && window.halo && typeof halo.setLocalStorageProductForWishlist === 'function') {
        halo.setLocalStorageProductForWishlist();
      }
    }

    function finalize(count) {
      renderedCount = typeof count === 'number' ? count : renderedCount;
      var list = wrapper && wrapper.length ? wrapper.get(0) : null;
      if (list) {
        list.querySelectorAll('.product-item--loadingNoInfo').forEach(function (el) {
          var product = el.closest('.product');
          if (product) product.remove();
          else el.remove();
        });
        list.setAttribute('data-mm-reco-count', String(renderedCount));
        list.classList.toggle('column-' + Math.min(renderedCount || 1, 4), true);
        list.setAttribute('aria-busy', 'false');
      }

      if (wrapper && wrapper.length) {
        wrapper.addClass('recently-viewed-loaded');
        if (renderedCount > 0 && renderedCount <= 2) {
          wrapper.addClass('center');
        } else {
          wrapper.removeClass('center');
        }
      }

      if (renderedCount > 0) {
        refreshMmCards();
      }

      if (config.onComplete) {
        try {
          config.onComplete(renderedCount);
        } catch (error) {}
      }
    }

    function rootPath() {
      var root = (window.routes && window.routes.root) || '/';
      return root.replace(/\/?$/, '/');
    }

    function fetchCardHtml(handle) {
      var url = rootPath() + 'products/' + encodeURIComponent(handle) + '?view=ajax_section_recently_viewed';
      return new Promise(function (resolve) {
        var settled = false;
        var timer = window.setTimeout(function () {
          if (settled) return;
          settled = true;
          resolve({ handle: handle, html: '' });
        }, 7000);

        fetch(url, { credentials: 'same-origin', headers: { Accept: 'text/html' } })
          .then(function (res) {
            if (!res.ok) throw new Error('rv_http');
            return res.text();
          })
          .then(function (text) {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            var trimmed = (text || '').trim();
            /* Require a real card node — never treat opaque storage as HTML */
            if (!trimmed || trimmed.indexOf('data-mm-product-card') === -1) {
              resolve({ handle: handle, html: '' });
              return;
            }
            resolve({ handle: handle, html: trimmed });
          })
          .catch(function () {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            resolve({ handle: handle, html: '' });
          });
      });
    }

    /* Popup path (legacy sequential) — keep for halo popup if enabled */
    var shownPopup = 0;
    var moveAlong = function (wrapperP) {
      if (productHandleQueue.length && shownPopup < config.howManyToShow) {
        var handle = productHandleQueue[shownPopup];
        var url = rootPath() + 'products/' + encodeURIComponent(handle) + '?view=ajax_recently_viewed';
        jQuery.ajax({
          type: 'get',
          url: url,
          cache: true,
          timeout: 7000,
          success: function (product) {
            if (handle && product && String(product).trim() !== '') {
              wrapperP.append(product);
              renderedCount++;
            } else {
              cookie.remove(handle);
            }
            shownPopup++;
            moveAlong(wrapperP);
          },
          error: function () {
            cookie.remove(handle);
            shownPopup++;
            moveAlong(wrapperP);
          }
        });
      } else {
        finalize(renderedCount);
      }
    };

    function loadSectionCards(wrapperS, requestId) {
      var handles = productHandleQueue.slice(0, config.howManyToShow);
      if (!handles.length) {
        finalize(0);
        return;
      }

      Promise.all(
        handles.map(function (handle) {
          return fetchCardHtml(handle);
        })
      ).then(function (results) {
        if (requestId !== activeRequestId) return;

        var list = wrapperS.get(0);
        if (list) {
          list.innerHTML = '';
        }

        renderedCount = 0;
        for (var i = 0; i < results.length; i++) {
          var item = results[i];
          if (!item.html) {
            cookie.remove(item.handle);
            continue;
          }
          if (list) {
            /* Insert as DOM from Shopify-rendered fragment (not from localStorage) */
            var tmp = document.createElement('div');
            tmp.innerHTML = item.html;
            while (tmp.firstChild) {
              list.appendChild(tmp.firstChild);
            }
            renderedCount++;
          }
        }

        finalize(renderedCount);
      });
    }

    return {
      resizeImage: function (src, size) {
        if (size == null) return src;
        if (size == 'master') return src.replace(/http(s)?:/, '');
        var match = src.match(/\.(jpg|jpeg|gif|png|bmp|bitmap|tiff|tif)(\?v=\d+)?/i);
        if (match != null) {
          var prefix = src.split(match[0]);
          var suffix = match[0];
          return (prefix[0] + '_' + size + suffix).replace(/http(s)?:/, '');
        }
        return null;
      },

      readHandles: function () {
        return cookie.read();
      },

      showRecentlyViewed: function (params) {
        var params = params || {};
        jQuery.extend(config, params);

        renderedCount = 0;
        shownPopup = 0;
        activeRequestId += 1;
        var requestId = activeRequestId;

        if (Array.isArray(config.handles) && config.handles.length) {
          productHandleQueue = dedupeHandles(config.handles);
        } else {
          productHandleQueue = cookie.read();
        }

        var currentHandle = getCurrentProductHandle();
        if (currentHandle) {
          productHandleQueue = productHandleQueue.filter(function (h) {
            return normalizeHandle(h) !== currentHandle;
          });
        }

        wrapper = jQuery('#' + config.wrapperId);
        config.howManyToShow = Math.min(
          productHandleQueue.length,
          Math.max(1, parseInt(config.howManyToShow, 10) || 4)
        );
        config.howManyToShow = Math.min(config.howManyToShow, 4);

        if (!config.howManyToShow || !wrapper.length) {
          finalize(0);
          return;
        }

        if (config.templateId == 'recently-viewed-product-popup') {
          moveAlong(wrapper);
        } else {
          loadSectionCards(wrapper, requestId);
        }
      },

      getConfig: function () {
        return config;
      },

      clearList: function () {
        cookie.destroy();
      },

      recordRecentlyViewed: function (params) {
        var params = params || {};
        jQuery.extend(config, params);

        if (!isProductDetailPage()) return;

        var recentlyViewed = cookie.read();
        var productHandle = getCurrentProductHandle();
        if (!productHandle) return;

        var position = -1;
        for (var i = 0; i < recentlyViewed.length; i++) {
          if (normalizeHandle(recentlyViewed[i]) === productHandle) {
            position = i;
            break;
          }
        }

        if (position === -1) {
          recentlyViewed.unshift(productHandle);
        } else {
          recentlyViewed.splice(position, 1);
          recentlyViewed.unshift(productHandle);
        }

        var maxStore = parseInt(config.howManyToStoreInMemory, 10) || 12;
        if (maxStore > 12) maxStore = 12;
        recentlyViewed = recentlyViewed.slice(0, maxStore);
        cookie.write(recentlyViewed);
      }
    };
  })();

  try {
    document.dispatchEvent(new CustomEvent('mm:recently-viewed-ready'));
  } catch (e) {}
})();
