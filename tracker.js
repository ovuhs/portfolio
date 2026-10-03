/* Visitor Tracking & Analytics Engine for Shuvo Ibn Alam Portfolio */
(function(window) {
  'use strict';

  var STORAGE_KEY = 'shuvo_portfolio_analytics_v1';
  var VID_KEY = 'shuvo_portfolio_vid';
  var SESS_KEY = 'shuvo_portfolio_sess';
  var SESS_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity = new visit

  function getVid() {
    try {
      var vid = localStorage.getItem(VID_KEY);
      if (!vid) {
        vid = 'v-' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem(VID_KEY, vid);
      }
      return vid;
    } catch (e) {
      return 'v-' + Math.random().toString(36).substring(2, 9);
    }
  }

  function getClientMeta() {
    var ua = navigator.userAgent || '';
    var browser = 'Other';
    if (/Edg\//i.test(ua)) browser = 'Edge';
    else if (/Chrome\//i.test(ua)) browser = 'Chrome';
    else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
    else if (/Firefox\//i.test(ua)) browser = 'Firefox';
    else if (/Opera|OPR\//i.test(ua)) browser = 'Opera';

    var os = 'Other';
    if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
    else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
    else if (/Linux/i.test(ua)) os = 'Linux';

    var device = 'Desktop';
    if (/Mobile|Android|iPhone|iPod/i.test(ua)) device = 'Mobile';
    else if (/iPad|Tablet/i.test(ua) || (os === 'macOS' && navigator.maxTouchPoints > 1)) device = 'Tablet';
    else if (window.innerWidth < 768) device = 'Mobile';

    var ref = 'Direct';
    if (document.referrer) {
      try {
        var rUrl = new URL(document.referrer);
        if (rUrl.hostname !== location.hostname) {
          ref = rUrl.hostname.replace(/^www\./, '');
        }
      } catch (e) {
        ref = document.referrer.slice(0, 32);
      }
    }

    var screenRes = (window.screen && window.screen.width) ? (window.screen.width + 'x' + window.screen.height) : 'Unknown';
    var tz = 'Unknown';
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown';
    } catch (e) {}

    return {
      browser: browser,
      os: os,
      device: device,
      referrer: ref,
      screenRes: screenRes,
      tz: tz
    };
  }

  function getTodayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function getLocalData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch (e) {}

    return {
      totalVisits: 0,
      uniqueVisitors: {},
      todayDate: getTodayKey(),
      todayVisits: 0,
      totalEvents: 0,
      pages: {},
      devices: {},
      browsers: {},
      os: {},
      referrers: {},
      activities: []
    };
  }

  function saveLocalData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      window.dispatchEvent(new CustomEvent('portfolio-analytics-update', { detail: data }));
    } catch (e) {}
  }

  function syncToSupabase(payload) {
    try {
      var cfg = window.PORTFOLIO_CONFIG || {};
      var url = (cfg.supabaseUrl || '').replace(/\/$/, '');
      var anon = cfg.supabaseAnonKey || '';
      if (!url || !anon) return;

      fetch(url + '/rest/v1/site_activities', {
        method: 'POST',
        headers: {
          'apikey': anon,
          'Authorization': 'Bearer ' + anon,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(payload)
      }).catch(function() {
        // Silently ignore if table doesn't exist yet
      });
    } catch (e) {}
  }

  function recordActivity(type, detail, meta) {
    meta = meta || {};
    var vid = getVid();
    var client = getClientMeta();
    var now = Date.now();
    var today = getTodayKey();
    var store = getLocalData();

    // Check if new session
    var isNewVisit = false;
    try {
      var lastActive = parseInt(sessionStorage.getItem(SESS_KEY) || '0', 10);
      if (!lastActive || (now - lastActive) > SESS_TIMEOUT_MS) {
        isNewVisit = true;
      }
      sessionStorage.setItem(SESS_KEY, String(now));
    } catch (e) {
      isNewVisit = true;
    }

    if (store.todayDate !== today) {
      store.todayDate = today;
      store.todayVisits = 0;
    }

    if (isNewVisit) {
      store.totalVisits = (store.totalVisits || 0) + 1;
      store.todayVisits = (store.todayVisits || 0) + 1;
      store.uniqueVisitors = store.uniqueVisitors || {};
      store.uniqueVisitors[vid] = now;

      // Update visitor info breakdown
      store.devices[client.device] = (store.devices[client.device] || 0) + 1;
      store.browsers[client.browser] = (store.browsers[client.browser] || 0) + 1;
      store.os[client.os] = (store.os[client.os] || 0) + 1;
      store.referrers[client.referrer] = (store.referrers[client.referrer] || 0) + 1;
    }

    store.totalEvents = (store.totalEvents || 0) + 1;

    var pageName = meta.page || (location.hash ? location.hash.replace(/^#/, '') : 'intro');
    if (type === 'page_view') {
      store.pages[pageName] = (store.pages[pageName] || 0) + 1;
    }

    var activityItem = {
      id: 'act_' + now + '_' + Math.random().toString(36).substring(2, 6),
      time: now,
      vid: vid,
      type: type,
      detail: detail || '',
      page: pageName,
      device: client.device,
      browser: client.browser,
      os: client.os,
      screen: client.screenRes,
      referrer: client.referrer,
      tz: client.tz
    };

    store.activities = store.activities || [];
    store.activities.unshift(activityItem);
    if (store.activities.length > 200) {
      store.activities = store.activities.slice(0, 200);
    }

    saveLocalData(store);

    // Sync to Supabase in background
    syncToSupabase({
      visitor_id: vid,
      event_type: type,
      detail: detail || '',
      page: pageName,
      device: client.device,
      browser: client.browser,
      os: client.os,
      screen: client.screenRes,
      referrer: client.referrer,
      timezone: client.tz
    });

    return activityItem;
  }

  function getStats(token) {
    var local = getLocalData();
    var uniqueCount = Object.keys(local.uniqueVisitors || {}).length;

    // Check if remote Supabase data is available
    var cfg = window.PORTFOLIO_CONFIG || {};
    var url = (cfg.supabaseUrl || '').replace(/\/$/, '');
    var anon = cfg.supabaseAnonKey || '';

    if (url && anon && token) {
      return fetch(url + '/rest/v1/site_activities?select=*&order=created_at.desc&limit=250', {
        headers: {
          'apikey': anon,
          'Authorization': 'Bearer ' + token
        }
      })
      .then(function(res) {
        if (!res.ok) throw new Error('Status ' + res.status);
        return res.json();
      })
      .then(function(rows) {
        if (Array.isArray(rows) && rows.length > 0) {
          return aggregateSupabaseRows(rows, local);
        }
        return formatOutputStats(local, uniqueCount);
      })
      .catch(function() {
        return formatOutputStats(local, uniqueCount);
      });
    }

    return Promise.resolve(formatOutputStats(local, uniqueCount));
  }

  function aggregateSupabaseRows(rows, localFallback) {
    var uniqueVids = {};
    var pages = {};
    var devices = {};
    var browsers = {};
    var os = {};
    var referrers = {};
    var today = getTodayKey();
    var todayVisits = 0;
    var totalVisits = 0;

    var activities = rows.map(function(r) {
      var d = r.created_at ? new Date(r.created_at) : new Date();
      var ts = d.getTime();
      var rowDay = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

      if (r.visitor_id) {
        uniqueVids[r.visitor_id] = true;
      }
      if (r.event_type === 'page_view' || r.event_type === 'visit') {
        totalVisits++;
        if (rowDay === today) todayVisits++;
      }
      if (r.page) pages[r.page] = (pages[r.page] || 0) + 1;
      if (r.device) devices[r.device] = (devices[r.device] || 0) + 1;
      if (r.browser) browsers[r.browser] = (browsers[r.browser] || 0) + 1;
      if (r.os) os[r.os] = (os[r.os] || 0) + 1;
      if (r.referrer) referrers[r.referrer] = (referrers[r.referrer] || 0) + 1;

      return {
        id: 'sb_' + (r.id || ts),
        time: ts,
        vid: r.visitor_id || 'unknown',
        type: r.event_type,
        detail: r.detail || '',
        page: r.page || 'intro',
        device: r.device || 'Desktop',
        browser: r.browser || 'Other',
        os: r.os || 'Other',
        screen: r.screen || 'Unknown',
        referrer: r.referrer || 'Direct',
        tz: r.timezone || 'Unknown'
      };
    });

    var uniqueCount = Math.max(Object.keys(uniqueVids).length, 1);
    var finalTotal = Math.max(totalVisits, uniqueCount, localFallback.totalVisits || 0);
    var finalToday = Math.max(todayVisits, localFallback.todayVisits || 0);

    return {
      totalVisits: finalTotal,
      uniqueVisitors: uniqueCount,
      todayVisits: finalToday,
      totalEvents: rows.length,
      pages: Object.keys(pages).length ? pages : localFallback.pages,
      devices: Object.keys(devices).length ? devices : localFallback.devices,
      browsers: Object.keys(browsers).length ? browsers : localFallback.browsers,
      os: Object.keys(os).length ? os : localFallback.os,
      referrers: Object.keys(referrers).length ? referrers : localFallback.referrers,
      activities: activities,
      isRemote: true
    };
  }

  function formatOutputStats(local, uniqueCount) {
    return {
      totalVisits: local.totalVisits || (local.activities.length ? 1 : 0),
      uniqueVisitors: Math.max(uniqueCount, (local.totalVisits ? 1 : 0)),
      todayVisits: local.todayVisits || 0,
      totalEvents: local.totalEvents || (local.activities ? local.activities.length : 0),
      pages: local.pages || {},
      devices: local.devices || {},
      browsers: local.browsers || {},
      os: local.os || {},
      referrers: local.referrers || {},
      activities: local.activities || [],
      isRemote: false
    };
  }

  function recordTestVisit() {
    var testBrowsers = ['Chrome', 'Safari', 'Edge', 'Firefox'];
    var testOs = ['Windows', 'macOS', 'iOS', 'Android'];
    var testDevices = ['Desktop', 'Mobile', 'Tablet'];
    var testPages = ['intro', 'projects', 'skills', 'certifications', 'experience', 'hobbies', 'contact'];
    var testEvents = [
      { type: 'page_view', detail: 'Viewed Projects' },
      { type: 'project_view', detail: 'Explored Power BI Sales Dashboard' },
      { type: 'project_view', detail: 'Explored Operation Portal' },
      { type: 'cert_view', detail: 'Viewed Lean Six Sigma Black Belt' },
      { type: 'cv_click', detail: 'Downloaded CV' },
      { type: 'contact_click', detail: 'Clicked Email link' },
      { type: 'theme_toggle', detail: 'Switched to Light mode' }
    ];

    var b = testBrowsers[Math.floor(Math.random() * testBrowsers.length)];
    var o = testOs[Math.floor(Math.random() * testOs.length)];
    var d = (o === 'iOS' || o === 'Android') ? 'Mobile' : testDevices[Math.floor(Math.random() * testDevices.length)];
    var p = testPages[Math.floor(Math.random() * testPages.length)];
    var ev = testEvents[Math.floor(Math.random() * testEvents.length)];

    var store = getLocalData();
    var testVid = 'v-' + Math.random().toString(36).substring(2, 8);
    var now = Date.now();

    store.totalVisits = (store.totalVisits || 0) + 1;
    store.todayVisits = (store.todayVisits || 0) + 1;
    store.uniqueVisitors = store.uniqueVisitors || {};
    store.uniqueVisitors[testVid] = now;
    store.totalEvents = (store.totalEvents || 0) + 1;

    store.devices[d] = (store.devices[d] || 0) + 1;
    store.browsers[b] = (store.browsers[b] || 0) + 1;
    store.os[o] = (store.os[o] || 0) + 1;
    store.pages[p] = (store.pages[p] || 0) + 1;
    store.referrers['Direct'] = (store.referrers['Direct'] || 0) + 1;

    var act = {
      id: 'test_' + now,
      time: now,
      vid: testVid,
      type: ev.type,
      detail: ev.detail,
      page: p,
      device: d,
      browser: b,
      os: o,
      screen: d === 'Mobile' ? '390x844' : '1920x1080',
      referrer: 'Direct',
      tz: 'Asia/Dhaka'
    };

    store.activities = store.activities || [];
    store.activities.unshift(act);
    saveLocalData(store);
    return act;
  }

  function clearData() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(SESS_KEY);
      window.dispatchEvent(new CustomEvent('portfolio-analytics-update', { detail: null }));
    } catch (e) {}
  }

  window.PortfolioTracker = {
    trackVisit: function(page) {
      return recordActivity('page_view', 'Viewed ' + (page || 'Intro'), { page: page });
    },
    trackPage: function(page) {
      return recordActivity('page_view', 'Viewed ' + (page || 'Intro'), { page: page });
    },
    trackEvent: function(type, detail, meta) {
      return recordActivity(type, detail, meta);
    },
    getStats: getStats,
    recordTestVisit: recordTestVisit,
    clearData: clearData
  };

})(window);
