// @ts-check

(() => {
  /**
   * Represents an Oembed object, containing information about embedded content.
   * @typedef {object} Oembed
   * @property {string} title - The title of the embedded content.
   * @property {string} author_name - The name of the author or creator of the content.
   * @property {string} author_url - The URL of the author or creator.
   * @property {string} type - The type of the embedded content (e.g., "video", "photo", "rich").
   * @property {number} height - The height of the embedded content in pixels.
   * @property {number} width - The width of the embedded content in pixels.
   * @property {string} version - The Oembed version.
   * @property {string} provider_name - The name of the content provider.
   * @property {string} provider_url - The URL of the content provider.
   * @property {number} thumbnail_height - The height of the content's thumbnail in pixels.
   * @property {number} thumbnail_width - The width of the content's thumbnail in pixels.
   * @property {string} thumbnail_url - The URL of the content's thumbnail image.
   * @property {string} html - The HTML code to embed the content.
   */

  /**
   * @param {string} url
   * @returns {Promise<Oembed>}
   */
  async function getOembed(url) {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(`Failed to fetch Oembed data for URL: "${url}". ${res.status} ${res.statusText}`);
    return await res.json();
  }

  /**
   * @param {() => Element | undefined} fn
   * @returns {Promise<Element>}
   */
  function waitForElement(fn) {
    return new Promise((resolve, reject) => {
      const element = fn();
      if (element) resolve(element);
      const observer = new MutationObserver(() => {
        const element = fn();
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    });
  }

  const currentTitleSelector = 'h1 > yt-formatted-string.style-scope.ytd-watch-metadata';
  const thumbnailSelectors = [
    'ytd-rich-item-renderer', // home page
    'ytd-video-renderer', // search page
    'ytd-compact-video-renderer', // watch page
    'ytd-grid-video-renderer', // channel home page
    'ytd-playlist-video-renderer', // watch later
    'ytd-playlist-panel-video-renderer', // playlist
  ];
  const thumbnailSelector = thumbnailSelectors.map((selector) => `${selector}:not(:has(ytd-ad-slot-renderer)):not([data-untranslated])`).join(',');

  /**
   * @param {Element} element
   */
  async function untranslateThumbnail(element) {
    element.setAttribute('data-untranslated', 'true');
    /** @type {HTMLAnchorElement | null} */
    const a = element.querySelector('a#thumbnail');
    if (!a) return;
    /** @type {HTMLSpanElement | null} */
    const title = element.querySelector('#video-title');
    if (!title) return;
    try {
      const oembed = await getOembed(a.href);
      if (title.innerText.trim() === oembed.title.trim()) return;
      console.log('[YoutubeAntiTranslate]', `"${title.innerText}" -> "${oembed.title}"`, a.href, element);
      title.innerText = oembed.title;
    } catch (err) {
      console.log(err, a.href);
    }
  }

  async function untranslateVideo() {
    try {
      console.log(`[YoutubeAntiTranslate] Current URL: ${document.location.href}`);
      const oembed = await getOembed(document.location.href);
      const element = await waitForElement(() => document.querySelector(currentTitleSelector));
      /** @type {HTMLSpanElement | null} */
      let newElement = document.querySelector('h1 > span#new-title');
      if (!newElement) {
        newElement = document.createElement('span');
        newElement.className = 'style-scope ytd-watch-metadata';
        newElement.id = 'new-title';
        element.insertAdjacentElement('afterend', newElement);
      }
      console.log(`[YoutubeAntiTranslate] "${newElement.innerText}" -> "${oembed.title}"`);
      newElement.innerText = oembed.title;
      if (document.title !== oembed.title + ' - YouTube') {
        document.title = oembed.title + ' - YouTube';
      }

      const style = document.createElement('style');
      style.id = 'youtube-anti-translate-style';
      style.innerHTML = 'h1 > yt-formatted-string {visibility: hidden !important; display: none !important;}';
      document.documentElement.append(style);
    } catch (err) {
      console.log(`[YoutubeAntiTranslate] ${err}`);
      document.querySelectorAll('#youtube-anti-translate-style').forEach((e) => e.remove());
    }
  }

  window.navigation.addEventListener('navigate', () => setTimeout(untranslateVideo, 1));
  const observer1 = new MutationObserver(untranslateVideo);
  observer1.observe(document.querySelector('title'), { attributes: false, childList: true, subtree: true });
  untranslateVideo();

  const observer2 = new MutationObserver(() => document.querySelectorAll(thumbnailSelector).forEach(untranslateThumbnail));
  observer2.observe(document.body, { attributes: false, childList: true, subtree: true });
})();
