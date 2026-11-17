/**
 * Cookie plugin
 *
 * Copyright (c) 2006 Klaus Hartl (stilbuero.de)
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 *
 */

jQuery.cookie = function (b, j, m) { if (typeof j != "undefined") { m = m || {}; if (j === null) { j = ""; m.expires = -1 } var e = ""; if (m.expires && (typeof m.expires == "number" || m.expires.toUTCString)) { var f; if (typeof m.expires == "number") { f = new Date(); f.setTime(f.getTime() + (m.expires * 24 * 60 * 60 * 1000)) } else { f = m.expires } e = "; expires=" + f.toUTCString() } var l = m.path ? "; path=" + (m.path) : ""; var g = m.domain ? "; domain=" + (m.domain) : ""; var a = m.secure ? "; secure" : ""; document.cookie = [b, "=", encodeURIComponent(j), e, l, g, a].join("") } else { var d = null; if (document.cookie && document.cookie != "") { var k = document.cookie.split(";"); for (var h = 0; h < k.length; h++) { var c = jQuery.trim(k[h]); if (c.substring(0, b.length + 1) == (b + "=")) { d = decodeURIComponent(c.substring(b.length + 1)); break } } } return d } };

/**
 * Module to show Recently Viewed Products
 *
 * Copyright (c) 2014 Caroline Schnapp (11heavens.com)
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 *
 * MOTHER & ME: repaired storage, fetch, empty/loading states, and slider init.
 */

Shopify.Products = (function () {
    var config = {
        howManyToShow: 3,
        howManyToStoreInMemory: 8,
        wrapperId: 'recently-viewed-products',
        templateId: 'recently-viewed-product-template',
        layout: 'slider',
        swipe: true,
        media: 'square',
        excludeHandle: '',
        handles: null,
        onComplete: null
    };
    var productHandleQueue = [];
    var wrapper = null;
    var template = null;
    var shown = 0;
    var shownSection = 0;
    var renderedCount = 0;

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
            path: '/',
            domain: window.location.hostname
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

    var finalize = function (count) {
        renderedCount = typeof count === 'number' ? count : renderedCount;
        var list = wrapper && wrapper.length ? wrapper.get(0) : null;
        if (list) {
            list.querySelectorAll('.product-item--loadingNoInfo').forEach(function (el) {
                var product = el.closest('.product');
                if (product) product.remove();
                else el.remove();
            });
        }

        if (wrapper && wrapper.length) {
            wrapper.addClass('recently-viewed-loaded');
            if (renderedCount <= 2) {
                wrapper.addClass('center');
            }
            wrapper.show();
        }

        if (config.onComplete) {
            try {
                config.onComplete(renderedCount);
            } catch (error) {}
        }
    };

    var moveAlong = function (wrapperP) {
        if (productHandleQueue.length && shown < config.howManyToShow) {
            var handle = productHandleQueue[shown];
            var root = (window.routes && window.routes.root) || '/';
            var url = root.replace(/\/?$/, '/') + 'products/' + encodeURIComponent(handle) + '?view=ajax_recently_viewed';

            jQuery.ajax({
                type: 'get',
                url: url,
                cache: true,
                timeout: 7000,
                success: function (product) {
                    if (handle) wrapperP.append(product);
                    shown++;
                    renderedCount++;
                    moveAlong(wrapperP);
                },
                error: function () {
                    cookie.remove(handle);
                    shown++;
                    moveAlong(wrapperP);
                }
            });
        } else {
            finalize(renderedCount);
        }
    };

    var initSectionSlider = function (productGrid) {
        if (!productGrid || !productGrid.length || productGrid.hasClass('slick-initialized')) return;

        var itemToShow = parseInt(productGrid.data('item-to-show'), 10) || 4;
        var itemDots = productGrid.data('item-dots');
        var itemDotsMb = productGrid.data('item-dots-mb');
        var itemArrows = productGrid.data('item-arrows');
        var itemArrowsMb = productGrid.data('item-arrows-mb');
        var preferReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        productGrid.slick({
            mobileFirst: true,
            adaptiveHeight: false,
            vertical: false,
            infinite: false,
            autoplay: false,
            speed: preferReduced ? 0 : 220,
            slidesToShow: 2,
            slidesToScroll: 2,
            arrows: !!itemArrowsMb,
            dots: !!itemDotsMb,
            nextArrow: window.arrows && window.arrows.icon_next,
            prevArrow: window.arrows && window.arrows.icon_prev,
            rtl: window.rtl_slick,
            responsive: [
                {
                    breakpoint: 1024,
                    settings: {
                        arrows: !!itemArrows,
                        dots: !!itemDots,
                        slidesToShow: itemToShow,
                        slidesToScroll: Math.min(itemToShow, 4)
                    }
                },
                {
                    breakpoint: 768,
                    settings: {
                        arrows: !!itemArrowsMb,
                        dots: !!itemDotsMb,
                        slidesToShow: 3,
                        slidesToScroll: 3
                    }
                }
            ]
        });
    };

    var doAlong = function (wrapperS) {
        const recentlyViewed = wrapperS.parents('.halo-recently-viewed-block');
        const sectionId = recentlyViewed.attr('sectionid') || '';

        if (productHandleQueue.length && shownSection < config.howManyToShow) {
            var handle = productHandleQueue[shownSection];
            var root = (window.routes && window.routes.root) || '/';
            var url = root.replace(/\/?$/, '/') + 'products/' + encodeURIComponent(handle) + '?view=ajax_section_recently_viewed';

            jQuery.ajax({
                type: 'get',
                url: url,
                cache: true,
                timeout: 7000,
                success: function (product) {
                    wrapperS.find('.product-item--loadingNoInfo').parents('.product').first().remove();
                    if (handle && product && String(product).trim() !== '') {
                        wrapperS.append(product);
                        renderedCount++;
                    } else {
                        cookie.remove(handle);
                    }

                    recentlyViewed.find('.card .variants-popup-content .selector-wrapper .swatch-element').each(function () {
                        const $input = $(this).find('input');
                        const $label = $(this).find('label');
                        $input.attr({
                            id: ($input.attr('id') || '') + sectionId,
                            name: ($input.attr('name') || '') + sectionId
                        });
                        $label.attr('for', ($label.attr('for') || '') + sectionId);
                    });

                    recentlyViewed.find('.card').each(function () {
                        const $qsForm = $(this).find('.variants-popup-content form');
                        const $acForm = $(this).find('.card-action form');
                        const $select = $(this).find('.variants-popup-content select');
                        const $acButton = $(this).find('.card-action form button');
                        const $qsButton = $(this).find('.variants-popup-content .product-card__button2 button');

                        $qsForm.attr('id', ($qsForm.attr('id') || '') + sectionId);
                        $acForm.attr('id', ($acForm.attr('id') || '') + sectionId);
                        $select.attr('id', ($select.attr('id') || '') + sectionId);
                        $acButton.attr('data-form-id', ($acButton.attr('data-form-id') || '') + sectionId);
                        $qsButton.attr('data-form-id', ($qsButton.attr('data-form-id') || '') + sectionId);
                    });

                    shownSection++;
                    doAlong(wrapperS);
                },
                error: function () {
                    cookie.remove(handle);
                    wrapperS.find('.product-item--loadingNoInfo').parents('.product').first().remove();
                    shownSection++;
                    doAlong(wrapperS);
                }
            });
        } else {
            wrapperS.find('.product-item--loadingNoInfo').parents('.product').remove();

            if (renderedCount === 0) {
                recentlyViewed.addClass('mm-pdp-reco--empty').attr('hidden', 'hidden');
                finalize(0);
                return;
            }

            if (config.layout == 'slider') {
                initSectionSlider(wrapperS);
            }

            if ($('body').hasClass('cursor-fixed__show')) {
                window.sharedFunctionsAnimation && window.sharedFunctionsAnimation.onEnterButton && window.sharedFunctionsAnimation.onEnterButton();
                window.sharedFunctionsAnimation && window.sharedFunctionsAnimation.onLeaveButton && window.sharedFunctionsAnimation.onLeaveButton();
            }

            if ($('body').hasClass('product-card-layout-08')) {
                window.sharedFunctions && window.sharedFunctions.productCountdownCard && window.sharedFunctions.productCountdownCard();
            }

            window.sharedFunctions && window.sharedFunctions.swapHoverVideoProductCard && window.sharedFunctions.swapHoverVideoProductCard();
            finalize(renderedCount);
        }
    };

    return {
        resizeImage: function (src, size) {
            if (size == null) {
                return src;
            }

            if (size == 'master') {
                return src.replace(/http(s)?:/, '');
            }

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

            shown = 0;
            shownSection = 0;
            renderedCount = 0;

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

            template = config.templateId;
            wrapper = jQuery('#' + config.wrapperId);
            config.howManyToShow = Math.min(productHandleQueue.length, config.howManyToShow || 8);

            if (!config.howManyToShow || !wrapper.length) {
                finalize(0);
                return;
            }

            if (template == 'recently-viewed-product-popup') {
                moveAlong(wrapper);
            } else {
                doAlong(wrapper);
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

            var recentlyViewed = cookie.read();
            var path = window.location.pathname || '';
            if (path.indexOf('/products/') === -1) return;

            var productHandle = getCurrentProductHandle();
            if (!productHandle) return;

            var position = recentlyViewed.indexOf(productHandle);
            if (position === -1) {
                recentlyViewed.unshift(productHandle);
            } else {
                recentlyViewed.splice(position, 1);
                recentlyViewed.unshift(productHandle);
            }

            recentlyViewed = recentlyViewed.splice(0, config.howManyToStoreInMemory || 8);
            cookie.write(recentlyViewed);
        }
    };
})();
