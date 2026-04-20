/**
 * AI Agency School CRM - WordPress Tracking Script v2
 *
 * Add to WordPress header:
 * <script src="https://crm-automation-backend.onrender.com/crm-tracker.js"></script>
 */
(function() {
  'use strict';

  var CRM_BACKEND = 'https://crm-automation-backend.onrender.com';
  var STORAGE_KEY = 'crm_utm';
  var COOKIE_DAYS = 30;

  // ── URL params ──
  function getParams() {
    var params = {};
    var search = window.location.search.substring(1);
    if (!search) return params;
    search.split('&').forEach(function(pair) {
      var kv = pair.split('=');
      if (kv[0]) params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
    return params;
  }

  // ── Cookies ──
  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + days * 86400000);
    document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }

  // ── Capture & store UTMs ──
  var params = getParams();
  var stored = {};
  try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch(e) {}

  var utmFields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'fbclid', 'gclid', 'ad_id', 'adset_id', 'campaign_id'];
  utmFields.forEach(function(f) {
    if (params[f]) stored[f] = params[f];
  });

  stored.page_url = window.location.href;
  stored.referrer = document.referrer || '';

  var path = window.location.pathname.toLowerCase();
  if (path.includes('vsl') || path.includes('שאלון')) stored.entry_type = 'vsl';
  else if (path.includes('webinar')) stored.entry_type = 'webinar';

  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stored)); } catch(e) {}
  if (stored.utm_source) setCookie('crm_utm_source', stored.utm_source, COOKIE_DAYS);

  // ── Send data to CRM ──
  function sendToCRM(endpoint, data) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', CRM_BACKEND + endpoint, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(data));
    } catch(e) {}
  }

  // ── Append UTMs to Fillout links ──
  function patchFilloutLinks() {
    var links = document.querySelectorAll('a[href*="fillout.com"]');
    links.forEach(function(link) {
      var href = link.getAttribute('href');
      if (!href || href.includes('utm_source=')) return;
      var sep = href.includes('?') ? '&' : '?';
      var qs = '';
      // Forward all UTM and tracking params
      var forwardFields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'fbclid', 'gclid', 'ad_id', 'adset_id', 'campaign_id', 'entry_type'];
      forwardFields.forEach(function(f) {
        if (stored[f]) qs += f + '=' + encodeURIComponent(stored[f]) + '&';
      });
      qs += 'page_url=' + encodeURIComponent(window.location.href);
      if (stored.referrer) qs += '&referrer=' + encodeURIComponent(stored.referrer);
      link.setAttribute('href', href + sep + qs);
    });
  }

  // ── Intercept Elementor form AJAX ──
  // Elementor Pro sends forms via AJAX (jQuery.ajax or fetch).
  // We intercept the XMLHttpRequest to catch the form data AFTER it's submitted.
  function hookElementorAjax() {
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
      this._crmUrl = url;
      this._crmMethod = method;
      return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
      var xhr = this;
      var url = this._crmUrl || '';

      // Elementor Pro sends to admin-ajax.php with action=elementor_pro_forms_send_form
      // Body can be a string (URL-encoded) or FormData object
      var bodyStr = '';
      if (typeof body === 'string') {
        bodyStr = body;
      } else if (body instanceof FormData) {
        body.forEach(function(val, key) { bodyStr += encodeURIComponent(key) + '=' + encodeURIComponent(val) + '&'; });
      }

      if (url.includes('admin-ajax.php') && bodyStr && (bodyStr.includes('elementor_pro_forms') || bodyStr.includes('elementor') && bodyStr.includes('form_fields'))) {
        xhr.addEventListener('load', function() {
          try {
            // Parse the form data that was sent
            var formData = {};
            var pairs = bodyStr.split('&');
            for (var i = 0; i < pairs.length; i++) {
              var kv = pairs[i].split('=');
              var key = decodeURIComponent(kv[0] || '');
              var val = decodeURIComponent(kv[1] || '');
              if (key.startsWith('form_fields[')) {
                var fieldName = key.replace('form_fields[', '').replace(']', '');
                formData[fieldName] = val;
              }
            }

            // Only send to CRM if we got some data
            if (Object.keys(formData).length > 0) {
              var crmPayload = {
                fields: formData,
                meta: {
                  utm_source: stored.utm_source || null,
                  utm_medium: stored.utm_medium || null,
                  utm_campaign: stored.utm_campaign || null,
                  utm_content: stored.utm_content || null,
                  utm_term: stored.utm_term || null,
                  utm_id: stored.utm_id || null,
                  entry_type: stored.entry_type || null,
                  page_url: window.location.href,
                  referrer: document.referrer,
                  fbclid: stored.fbclid || null,
                  gclid: stored.gclid || null,
                  ad_id: stored.ad_id || null,
                  adset_id: stored.adset_id || null,
                  campaign_id: stored.campaign_id || null,
                }
              };

              console.log('[CRM Tracker] Elementor form captured:', Object.keys(formData));
              sendToCRM('/api/webhooks/elementor', crmPayload);
            }
          } catch(e) {
            console.warn('[CRM Tracker] Error parsing form:', e);
          }
        });
      }

      return origSend.apply(this, arguments);
    };
  }

  // ── Also hook fetch() for newer Elementor versions ──
  function hookFetchApi() {
    var origFetch = window.fetch;
    if (!origFetch) return;

    window.fetch = function(url, opts) {
      var urlStr = typeof url === 'string' ? url : (url && url.url) || '';

      if (urlStr.includes('admin-ajax.php') && opts && opts.body) {
        var bodyStr = '';
        if (typeof opts.body === 'string') bodyStr = opts.body;
        else if (opts.body instanceof FormData) {
          // Convert FormData to check
          opts.body.forEach(function(val, key) { bodyStr += key + '=' + val + '&'; });
        }

        if (bodyStr.includes('elementor') && bodyStr.includes('form_fields')) {
          // Parse and send to CRM after fetch completes
          return origFetch.apply(this, arguments).then(function(response) {
            try {
              var formData = {};
              var pairs = bodyStr.split('&');
              for (var i = 0; i < pairs.length; i++) {
                var kv = pairs[i].split('=');
                var key = decodeURIComponent(kv[0] || '');
                var val = decodeURIComponent(kv[1] || '');
                if (key.startsWith('form_fields[')) {
                  formData[key.replace('form_fields[', '').replace(']', '')] = val;
                }
              }
              if (Object.keys(formData).length > 0) {
                console.log('[CRM Tracker] Elementor form (fetch) captured:', Object.keys(formData));
                sendToCRM('/api/webhooks/elementor', {
                  fields: formData,
                  meta: {
                    utm_source: stored.utm_source || null,
                    utm_medium: stored.utm_medium || null,
                    utm_campaign: stored.utm_campaign || null,
                    utm_content: stored.utm_content || null,
                    utm_term: stored.utm_term || null,
                    utm_id: stored.utm_id || null,
                    entry_type: stored.entry_type || null,
                    page_url: window.location.href,
                    referrer: document.referrer,
                    fbclid: stored.fbclid || null,
                    gclid: stored.gclid || null,
                    ad_id: stored.ad_id || null,
                    adset_id: stored.adset_id || null,
                    campaign_id: stored.campaign_id || null,
                  }
                });
              }
            } catch(e) {}
            return response;
          });
        }
      }

      return origFetch.apply(this, arguments);
    };
  }

  // ── Intercept Elementor form submit (handles both AJAX and redirect) ──
  function hookElementorFormSubmit() {
    document.addEventListener('submit', function(e) {
      var form = e.target;
      if (!form || form.tagName !== 'FORM') return;

      // Check if this is an Elementor form
      var isElementor = form.classList.contains('elementor-form') ||
                        form.querySelector('[name="action"][value*="elementor"]') ||
                        form.querySelector('input[name="form_fields[name]"], input[name="form_fields[email]"], input[name="form_fields[field_"]');

      if (!isElementor) return;

      try {
        var formData = {};
        var inputs = form.querySelectorAll('input, select, textarea');
        for (var i = 0; i < inputs.length; i++) {
          var input = inputs[i];
          var name = input.getAttribute('name') || '';
          var val = input.value || '';
          if (!name || !val) continue;
          if (name.startsWith('form_fields[')) {
            var fieldName = name.replace('form_fields[', '').replace(']', '');
            formData[fieldName] = val;
          } else if (name === 'form_fields') {
            // Some Elementor versions use flat names
          }
        }

        if (Object.keys(formData).length > 0) {
          console.log('[CRM Tracker] Elementor form submit captured:', Object.keys(formData));
          // Use sendBeacon for reliability during page unload/redirect
          var payload = JSON.stringify({
            fields: formData,
            meta: {
              utm_source: stored.utm_source || null,
              utm_medium: stored.utm_medium || null,
              utm_campaign: stored.utm_campaign || null,
              utm_content: stored.utm_content || null,
              utm_term: stored.utm_term || null,
              utm_id: stored.utm_id || null,
              entry_type: stored.entry_type || null,
              page_url: window.location.href,
              referrer: document.referrer || stored.referrer || null,
              fbclid: stored.fbclid || null,
              gclid: stored.gclid || null,
              ad_id: stored.ad_id || null,
              adset_id: stored.adset_id || null,
              campaign_id: stored.campaign_id || null,
            }
          });

          if (navigator.sendBeacon) {
            navigator.sendBeacon(CRM_BACKEND + '/api/webhooks/elementor', new Blob([payload], { type: 'application/json' }));
          } else {
            sendToCRM('/api/webhooks/elementor', JSON.parse(payload));
          }
        }
      } catch(e) {
        console.warn('[CRM Tracker] Error capturing form:', e);
      }
    }, true); // capture phase — runs before the form actually submits
  }

  // ── Run ──
  function init() {
    patchFilloutLinks();
    hookElementorAjax();
    hookFetchApi();
    hookElementorFormSubmit();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-patch Fillout links when DOM changes (Elementor lazy loading)
  new MutationObserver(function() { patchFilloutLinks(); }).observe(document.body, { childList: true, subtree: true });

  console.log('[CRM Tracker v2] Loaded. UTM:', stored.utm_source || '(none)', '| Entry:', stored.entry_type || '(none)');
})();
