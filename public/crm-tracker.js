/**
 * AI Agency School CRM - WordPress Tracking Script
 *
 * Add this to your WordPress site (Elementor > Custom Code or wp_head)
 * It captures UTM params from the URL and stores them in cookies/localStorage
 * so they persist across pages and get sent with form submissions.
 *
 * Usage: Add this script tag to your WordPress header:
 * <script src="https://crm-automation-backend.onrender.com/crm-tracker.js"></script>
 */
(function() {
  'use strict';

  var CRM_BACKEND = 'https://crm-automation-backend.onrender.com';
  var COOKIE_DAYS = 30;
  var STORAGE_KEY = 'crm_utm';

  // ── Parse URL params ──
  function getParams() {
    var params = {};
    var search = window.location.search.substring(1);
    if (!search) return params;
    search.split('&').forEach(function(pair) {
      var kv = pair.split('=');
      params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
    return params;
  }

  // ── Cookie helpers ──
  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + days * 86400000);
    document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }

  function getCookie(name) {
    var v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return v ? decodeURIComponent(v.pop()) : '';
  }

  // ── Capture & store UTMs ──
  var params = getParams();
  var utmFields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ad_id', 'adset_id', 'campaign_id'];
  var stored = {};

  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch(e) {}

  // Only overwrite if we have new UTM params (first touch attribution)
  var hasNewUtm = false;
  utmFields.forEach(function(f) {
    if (params[f]) {
      stored[f] = params[f];
      hasNewUtm = true;
    }
  });

  // Always track current page and referrer
  stored.page_url = window.location.href;
  stored.referrer = document.referrer || '';

  // Detect entry type from URL path
  var path = window.location.pathname.toLowerCase();
  if (path.includes('vsl')) stored.entry_type = 'vsl';
  else if (path.includes('webinar')) stored.entry_type = 'webinar';
  else if (path.includes('meeting')) stored.entry_type = 'direct';

  // Save
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch(e) {}

  // Also store in cookie for cross-subdomain access
  if (hasNewUtm) {
    setCookie('crm_utm_source', stored.utm_source || '', COOKIE_DAYS);
    setCookie('crm_utm_medium', stored.utm_medium || '', COOKIE_DAYS);
    setCookie('crm_utm_campaign', stored.utm_campaign || '', COOKIE_DAYS);
    setCookie('crm_utm_content', stored.utm_content || '', COOKIE_DAYS);
    setCookie('crm_entry_type', stored.entry_type || '', COOKIE_DAYS);
  }

  // ── Inject UTM params into Fillout embeds ──
  // Fillout with data-fillout-inherit-parameters already handles this,
  // but for links we need to append params
  function appendUtmToLinks() {
    var links = document.querySelectorAll('a[href*="fillout.com"]');
    links.forEach(function(link) {
      var href = link.getAttribute('href');
      if (!href) return;
      var sep = href.includes('?') ? '&' : '?';
      var utmString = '';
      if (stored.utm_source) utmString += 'utm_source=' + encodeURIComponent(stored.utm_source) + '&';
      if (stored.utm_medium) utmString += 'utm_medium=' + encodeURIComponent(stored.utm_medium) + '&';
      if (stored.utm_campaign) utmString += 'utm_campaign=' + encodeURIComponent(stored.utm_campaign) + '&';
      if (stored.utm_content) utmString += 'utm_content=' + encodeURIComponent(stored.utm_content) + '&';
      if (stored.entry_type) utmString += 'entry_type=' + encodeURIComponent(stored.entry_type) + '&';
      utmString += 'page_url=' + encodeURIComponent(window.location.href);
      if (utmString && !href.includes('utm_source')) {
        link.setAttribute('href', href + sep + utmString);
      }
    });
  }

  // ── Inject UTM as hidden fields into Elementor forms ──
  function injectUtmIntoForms() {
    var forms = document.querySelectorAll('.elementor-form');
    forms.forEach(function(form) {
      // Check if already injected
      if (form.querySelector('input[name="utm_source"]')) return;

      var fieldsToInject = {
        'utm_source': stored.utm_source,
        'utm_medium': stored.utm_medium,
        'utm_campaign': stored.utm_campaign,
        'utm_content': stored.utm_content,
        'utm_term': stored.utm_term,
        'entry_type': stored.entry_type,
        'page_url': window.location.href,
        'referrer': document.referrer,
        'fbclid': stored.fbclid,
        'gclid': stored.gclid,
      };

      for (var name in fieldsToInject) {
        if (fieldsToInject[name]) {
          var input = document.createElement('input');
          input.type = 'hidden';
          input.name = name;
          input.value = fieldsToInject[name];
          form.appendChild(input);
        }
      }
    });
  }

  // ── Hook into Elementor form submissions ──
  // Add webhook action to send data to CRM
  function hookElementorForms() {
    document.addEventListener('submit', function(e) {
      var form = e.target;
      if (!form.classList || !form.classList.contains('elementor-form')) return;

      // Collect form data
      var data = { fields: {}, meta: {} };
      var inputs = form.querySelectorAll('input, select, textarea');
      inputs.forEach(function(input) {
        var name = input.name || input.id || '';
        if (name && input.value) {
          if (name.startsWith('utm_') || name === 'entry_type' || name === 'page_url' || name === 'referrer' || name === 'fbclid' || name === 'gclid') {
            data.meta[name] = input.value;
          } else {
            data.fields[name] = input.value;
          }
        }
      });

      // Send to CRM backend (non-blocking)
      try {
        navigator.sendBeacon(CRM_BACKEND + '/api/webhooks/elementor', JSON.stringify(data));
      } catch(err) {
        // Fallback
        var xhr = new XMLHttpRequest();
        xhr.open('POST', CRM_BACKEND + '/api/webhooks/elementor', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify(data));
      }
    }, true);
  }

  // ── Run ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      appendUtmToLinks();
      injectUtmIntoForms();
      hookElementorForms();
    });
  } else {
    appendUtmToLinks();
    injectUtmIntoForms();
    hookElementorForms();
  }

  // Re-run after Elementor loads dynamically
  var observer = new MutationObserver(function() {
    appendUtmToLinks();
    injectUtmIntoForms();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  console.log('[CRM Tracker] Loaded. UTM:', JSON.stringify(stored));
})();
