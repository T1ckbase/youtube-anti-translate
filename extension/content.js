// @ts-check

(() => {
  'use strict';

  /**
   * @typedef {object} Oembed
   * @property {string} title
   */

  const LINK_TITLE_SELECTOR = [
    // Video thumbnails (home, channel, sidebar, search, playlist items; excludes mix/playlist cards)
    "h3 a[href^='/watch?v=']:where(:not([href*='&list=']), [href*='&index=']) > :where(span, yt-formatted-string)",
    // Shorts thumbnails (home, search)
    "h3 a[href^='/shorts/']:not([href='/shorts/']) > span",
    // Watch page playlist panel
    "a[href^='/watch?v='] h4 span#video-title",
    // Endscreen overlay cards near end of video
    "a[href^='https://www.youtube.com/watch?v='] > div.ytp-ce-video-title",
    // Post-video recommendations (videowall & autoplay countdown)
    "a[href^='https://www.youtube.com/watch?v='] span.ytp-modern-videowall-still-info-title",
    "a[href^='https://www.youtube.com/watch?v='] div.ytp-autonav-endscreen-upnext-title",
  ].join(',');

  const WATCH_TITLE_SELECTOR = 'ytd-watch-flexy:not([hidden]) div#title-row h1 > yt-formatted-string';

  /** @type {Map<string, string | null>} */
  const titleCache = new Map();
  /** @type {Map<string, Promise<void>>} */
  const pendingRequests = new Map();

  /**
   * @param {string} urlString
   * @returns {string | null}
   */
  function getVideoId(urlString) {
    try {
      const url = new URL(urlString, location.origin);
      if (url.pathname === '/watch') return url.searchParams.get('v');
      if (url.pathname.startsWith('/shorts/')) return url.pathname.split('/')[2] || null;
    } catch {
      // ignore invalid URLs
    }
    return null;
  }

  /**
   * Returns cached original title, `null` if unavailable, or `undefined` while fetching.
   * @param {string} videoId
   * @returns {string | null | undefined}
   */
  function getOriginalTitle(videoId) {
    if (titleCache.has(videoId)) return titleCache.get(videoId);
    if (!pendingRequests.has(videoId)) {
      const videoUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
      const request = fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}`)
        .then(async (res) => {
          if (!res.ok) {
            titleCache.set(videoId, null);
            if (res.status === 429 || res.status >= 500) {
              setTimeout(() => titleCache.delete(videoId), 10_000);
            }
            return;
          }
          /** @type {Oembed} */
          const data = await res.json();
          const title = data.title?.trim() || null;
          titleCache.set(videoId, title);
          if (title) scheduleUpdate();
        })
        .catch(() => {
          titleCache.set(videoId, null);
          setTimeout(() => titleCache.delete(videoId), 10_000);
        })
        .finally(() => {
          pendingRequests.delete(videoId);
        });
      pendingRequests.set(videoId, request);
    }
    return undefined;
  }

  /**
   * @param {Element} el
   * @param {string} originalTitle
   * @param {Element | null} [link]
   */
  function applyTitle(el, originalTitle, link = null) {
    const current = el.textContent?.trim();
    if (!current) return;
    if (current !== originalTitle) {
      console.log('[YoutubeAntiTranslate]', `"${current}" -> "${originalTitle}"`, el);
      // Mutate existing Text node in-place so Polymer ShadyDOM's cached child reference stays intact
      if (el.childNodes.length === 1 && el.firstChild?.nodeType === Node.TEXT_NODE) {
        el.firstChild.nodeValue = originalTitle;
      } else {
        el.textContent = originalTitle;
      }
    }
    if (el.hasAttribute('is-empty')) {
      el.removeAttribute('is-empty');
    }
    const titleTarget = [el, link, link?.closest('h3')].find((node) => node?.hasAttribute('title'));
    if (titleTarget && titleTarget.getAttribute('title') !== originalTitle) {
      titleTarget.setAttribute('title', originalTitle);
    }
  }

  function update() {
    for (const el of document.querySelectorAll(LINK_TITLE_SELECTOR)) {
      if (!el.textContent?.trim()) continue;
      const link = el.closest('a');
      if (!link) continue;
      const videoId = getVideoId(link.href);
      if (!videoId) continue;
      const originalTitle = getOriginalTitle(videoId);
      if (originalTitle) applyTitle(el, originalTitle, link);
    }

    const currentVideoId = getVideoId(location.href);
    if (currentVideoId) {
      const originalTitle = getOriginalTitle(currentVideoId);
      if (originalTitle) {
        const watchTitleEl = document.querySelector(WATCH_TITLE_SELECTOR);
        if (watchTitleEl) applyTitle(watchTitleEl, originalTitle);
        const expected = `${originalTitle} - YouTube`;
        if (document.title !== expected) {
          console.log('[YoutubeAntiTranslate]', `document.title: "${document.title}" -> "${expected}"`);
          document.title = expected;
        }
      }
    }
  }

  /** @type {number | null} */
  let timer = null;
  function scheduleUpdate() {
    if (timer !== null) return;
    timer = window.setTimeout(() => {
      timer = null;
      update();
    }, 50);
  }

  const observer = new MutationObserver(scheduleUpdate);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['href', 'hidden', 'title', 'is-empty'],
  });

  update();
})();
