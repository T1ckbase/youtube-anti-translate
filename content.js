// "icons": {
//     "16": "images/kekwait.png",
//     "32": "images/kekwait.png",
//     "48": "images/kekwait.png",
//     "128": "images/kekwait.png"
// },

// "web_accessible_resources": [
//     {
//         "resources": ["scripts/gmail-chat-dark-theme.js", "scripts/zz.js", "scripts/facebook.js", "scripts/youtube-enhanced-bitrate.js", "scripts/tradingview.js"],
//         "matches": ["<all_urls>"]
//     }
// ]

(function() {
    const current_title_selector = 'h1 > yt-formatted-string.style-scope.ytd-watch-metadata'
    const thumbnail_selectors = [
        'ytd-rich-item-renderer',           // home page
        'ytd-video-renderer',               // search page
        'ytd-compact-video-renderer',       // watch page
        'ytd-grid-video-renderer',          // channel home page
        'ytd-playlist-video-renderer',      // ?
        'ytd-playlist-panel-video-renderer' // playlist
    ];

    const oembed = 'https://www.youtube.com/oembed?url=';

    let last_title = '';

    function wait_for_element(e, selector) {
        return new Promise(resolve => {
            if (e.querySelector(selector)) {
                return resolve(e.querySelector(selector));
            }
            const observer = new MutationObserver(mutations => {
                if (e.querySelector(selector)) {
                    observer.disconnect();
                    resolve(e.querySelector(selector));
                }
            });
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    }

    function untranslate_video(element) {
        console.log(`[YoutubeAntiTranslate] Current URL: ${document.location.href}`);
        const url = oembed + encodeURIComponent(document.location.href);
        fetch(url)
            .then(response => response.json())
            .then(async data => {
                const element = await wait_for_element(document, current_title_selector);
                
                let new_element = document.querySelector('h1 > span#new-title');
                // if (new_element && element.textContent == new_element.textContent)
                //     return;
        
                if (!new_element) {
                    new_element = document.createElement('span');
                    new_element.className = 'style-scope ytd-watch-metadata';
                    new_element.id = 'new-title';
                    element.after(new_element);
                    // console.log('[YoutubeAntiTranslate] created new-title element');
                }

                // if (element.textContent == data.title)
                    // return;
                
                const old_title = element.textContent;
                // element.style.visibility = 'hidden';
                // element.style.display = 'none';
                // element.textContent = data.title;
                // element.removeAttribute('is-empty');
                // element.style.display = 'block';
                
                new_element.textContent = data.title;
                // last_title = data.title;
                // new_element.classList.add('anti-translate-processed');

                const style = document.createElement('style');
                style.id = 'YoutubeAntiTranslate-style';
                style.innerHTML = 'h1 > yt-formatted-string {visibility: hidden !important; display: none !important;}';
                document.documentElement.append(style);

                document.title = data.title + ' - YouTube';

                console.log(`[YoutubeAntiTranslate] "${old_title}" -> "${data.title}"`);
            })
            .catch(error => {
                console.log(`[YoutubeAntiTranslate] ${error}`);
                document.querySelectorAll('#YoutubeAntiTranslate-style').forEach(e => e.remove());
            });
    }

    function untranslate_thumbnail(element) {
        // element.classList.add('anti-translate-processed');
        let a = element.querySelector('a#thumbnail')
        if (!a)
            return;

        const title = element.querySelector('#video-title');
        if (title.untranslated_href == a.href)
            return;

        title.untranslated_href = a.href;
        const url = oembed + encodeURIComponent(a.href);
        fetch(url)
            .then(response => {
                let j = response.json();
                // console.log(j);
                return j;
            })
            .then(data => {
                if (title.innerText == data.title)
                    return;
                
                const old_title = title.innerText;
                title.innerText = data.title;
                title.title = data.title;

                console.log('[YoutubeAntiTranslate]', `"${old_title}" -> "${data.title}"`);
            })
            .catch(error => {
                console.log('[YoutubeAntiTranslate]', error, a.href);
            });
    }

    // current video
    window.navigation.addEventListener('navigate', async function() {
        await new Promise(r => setTimeout(r, 1));
        untranslate_video();
    });
    // window.addEventListener('popstate', untranslate_video);
    untranslate_video();
    
    // thumbnail
    function callback(mutationList, observer) {
        // e = document.querySelector(current_title_selector);
        // if (e)
            // untranslate_video(e);

        thumbnail_selectors.forEach(selector => {
            selector = selector.concat(':has(a)');
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                untranslate_thumbnail(element);
            });
        });
    }

    const config = { attributes: false, childList: true, subtree: true };
    const observer = new MutationObserver(callback);
    observer.observe(document.querySelector('ytd-page-manager') || document.body, config);
})();

