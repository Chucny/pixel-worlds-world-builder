(() => {
    console.log('%c🔍 Starting improved full document image extraction (with delays for Edge)...', 'color: #00ffcc; font-size: 16px; font-weight: bold');

    const downloaded = new Set();
    let count = 0;
    let totalAttempted = 0;

    function sanitizeFilename(name) {
        return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 120) || `image_${count}`;
    }

    function getExtensionFromUrl(url) {
        try {
            const ext = url.split('?')[0].split('.').pop().toLowerCase();
            if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
                return '.' + ext;
            }
        } catch {}
        return '.png'; // fallback
    }

    async function download(url, suggestedName = null) {
        if (!url || downloaded.has(url)) return;
        if (!url.startsWith('http') && !url.startsWith('data:')) return;

        downloaded.add(url);
        totalAttempted++;

        const link = document.createElement('a');
        link.href = url;
        
        const ext = getExtensionFromUrl(url);
        const filename = suggestedName 
            ? sanitizeFilename(suggestedName) + ext 
            : `texture_${count++}${ext}`;

        link.download = filename;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log(`%c✅ Downloaded: ${filename} (${url.substring(0, 80)}${url.length > 80 ? '...' : ''})`, 'color: lime');
    }

    // Small delay helper
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Main extraction with delays
    async function extractAll() {
        // 1. All <img> tags
        console.log('%c📸 Processing <img> tags...', 'color: orange');
        const imgs = document.querySelectorAll('img');
        for (let i = 0; i < imgs.length; i++) {
            const img = imgs[i];
            if (img.src) await download(img.src, img.alt || `img_${i}`);
            if (img.srcset) {
                img.srcset.split(',').forEach(src => {
                    const url = src.trim().split(' ')[0];
                    if (url) download(url, `img_${i}_srcset`);
                });
            }
            await sleep(350); // delay between images
        }

        // 2. Background images (including pseudo-elements)
        console.log('%c🎨 Processing background images...', 'color: orange');
        const allElements = document.querySelectorAll('*');
        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            try {
                const style = window.getComputedStyle(el);
                const bg = style.backgroundImage || '';
                const matches = bg.match(/url\(["']?([^"')]+)["']?\)/g) || [];
                for (const match of matches) {
                    const url = match.match(/url\(["']?([^"')]+)["']?\)/)[1];
                    await download(url, `bg_${i}`);
                }

                // pseudo-elements
                for (const pseudo of ['before', 'after']) {
                    const pStyle = window.getComputedStyle(el, `::${pseudo}`);
                    const pBg = pStyle.backgroundImage || '';
                    const pMatches = pBg.match(/url\(["']?([^"')]+)["']?\)/g) || [];
                    for (const match of pMatches) {
                        const url = match.match(/url\(["']?([^"')]+)["']?\)/)[1];
                        await download(url, `pseudo_${i}_${pseudo}`);
                    }
                }
            } catch (e) {}
            if (i % 50 === 0) await sleep(100); // occasional breath
        }

        // 3. CSS stylesheets (skip if too slow)
        console.log('%c📄 Processing CSS backgrounds...', 'color: orange');
        const stylesheets = Array.from(document.styleSheets);
        for (let sheetIndex = 0; sheetIndex < stylesheets.length; sheetIndex++) {
            const sheet = stylesheets[sheetIndex];
            try {
                const rules = sheet.cssRules || sheet.rules || [];
                for (let rule of rules) {
                    if (rule.style && rule.style.backgroundImage) {
                        const matches = rule.style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/g) || [];
                        for (const match of matches) {
                            let url = match.match(/url\(["']?([^"')]+)["']?\)/)[1];
                            if (!url.startsWith('http') && !url.startsWith('data:')) {
                                try {
                                    url = new URL(url, sheet.href || window.location.href).href;
                                } catch {}
                            }
                            await download(url, `css_${sheetIndex}`);
                        }
                    }
                }
            } catch (e) {
                // cross-origin stylesheet - skip silently
            }
            await sleep(200);
        }

        // 4. <picture> sources
        console.log('%c🖼️ Processing <picture> sources...', 'color: orange');
        document.querySelectorAll('picture source').forEach((source, i) => {
            if (source.srcset) {
                source.srcset.split(',').forEach(src => {
                    const url = src.trim().split(' ')[0];
                    if (url) download(url, `picture_source_${i}`);
                });
            }
        });

        // 5. Canvas elements
        console.log('%c🖌️ Processing canvases...', 'color: orange');
        document.querySelectorAll('canvas').forEach((canvas, i) => {
            try {
                const dataUrl = canvas.toDataURL('image/png', 1.0);
                download(dataUrl, `canvas_${i}`);
            } catch (err) {
                console.warn(`Canvas ${i} could not be exported (tainted or cross-origin)`);
            }
        });

        console.log(`%c🎉 Extraction finished! Attempted ${totalAttempted} downloads (${downloaded.size} unique).`, 
                    'color: #ffcc00; font-size: 15px; font-weight: bold');
        console.log('%cNote: If some still fail, try a slower delay (change 350 to 600) or use an extension like "Image Downloader".', 'color: orange');
    }

    // Start with a small pause
    setTimeout(() => {
        extractAll();
    }, 800);

})();
