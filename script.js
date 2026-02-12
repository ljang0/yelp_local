document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('site-search');
    const button = document.querySelector('.search-row button');
    const suggestions = document.getElementById('suggestions');

    if (!input || !button || !suggestions) return;

    const fallbackWebsites = [
        { name: 'amazon', domain: 'amazon.com' },
        { name: 'apple', domain: 'apple.com' },
        { name: 'airbnb', domain: 'airbnb.com' },
        { name: 'google', domain: 'google.com' },
        { name: 'github', domain: 'github.com' },
        { name: 'reddit', domain: 'reddit.com' },
        { name: 'youtube', domain: 'youtube.com' }
    ];

    const MAX_SUGGESTIONS = 8;
    let websites = [];
    let websitesByName = new Map();
    let prefixIndex = createPrefixIndex([]);

    let currentMatches = [];
    let activeIndex = -1;

    const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const toUrl = (raw) => {
        const cleaned = raw.trim();
        if (!cleaned) return '';

        const known = websitesByName.get(cleaned.toLowerCase());
        if (known) return `https://${known.domain}`;

        return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
    };

    const openUrl = () => {
        const url = toUrl(input.value);
        if (!url) return;
        window.open(url, '_blank', 'noopener');
    };

    const openSite = (site) => {
        if (!site || !site.domain) return;
        window.open(`https://${site.domain}`, '_blank', 'noopener');
    };

    const hideSuggestions = () => {
        suggestions.hidden = true;
        suggestions.innerHTML = '';
        activeIndex = -1;
    };

    const setActive = (index) => {
        const buttons = suggestions.querySelectorAll('.suggestion-btn');
        buttons.forEach((btn, i) => {
            btn.classList.toggle('is-active', i === index);
            btn.setAttribute('aria-selected', i === index ? 'true' : 'false');
        });
    };

    const chooseSuggestion = (site) => {
        input.value = site.name;
        hideSuggestions();
    };

    const renderSuggestions = (query) => {
        const trimmed = query.trim();
        if (!trimmed) {
            hideSuggestions();
            return;
        }

        currentMatches = findPrefixMatches(trimmed, MAX_SUGGESTIONS);

        if (!currentMatches.length) {
            hideSuggestions();
            return;
        }

        suggestions.innerHTML = '';
        currentMatches.forEach((site) => {
            const li = document.createElement('li');
            const suggestionBtn = document.createElement('button');
            suggestionBtn.type = 'button';
            suggestionBtn.className = 'suggestion-btn';
            suggestionBtn.setAttribute('role', 'option');
            suggestionBtn.setAttribute('aria-selected', 'false');
            suggestionBtn.innerHTML = `${site.name}<span class="suggestion-domain">${site.domain}</span>`;
            suggestionBtn.addEventListener('mousedown', (event) => {
                event.preventDefault();
                chooseSuggestion(site);
                openSite(site);
            });

            li.appendChild(suggestionBtn);
            suggestions.appendChild(li);
        });

        suggestions.hidden = false;
        activeIndex = -1;
    };

    input.addEventListener('input', (event) => {
        renderSuggestions(event.target.value);
    });

    input.addEventListener('keydown', (event) => {
        if (suggestions.hidden || !currentMatches.length) {
            if (event.key === 'Enter') {
                event.preventDefault();
                openUrl();
            }
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            activeIndex = (activeIndex + 1) % currentMatches.length;
            setActive(activeIndex);
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            activeIndex = activeIndex <= 0 ? currentMatches.length - 1 : activeIndex - 1;
            setActive(activeIndex);
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            if (activeIndex >= 0) {
                chooseSuggestion(currentMatches[activeIndex]);
            }
            openUrl();
            return;
        }

        if (event.key === 'Escape') {
            hideSuggestions();
        }
    });

    input.addEventListener('blur', () => {
        window.setTimeout(hideSuggestions, 120);
    });

    input.addEventListener('focus', () => {
        renderSuggestions(input.value);
    });

    button.addEventListener('click', openUrl);

    initializeWebsites();

    async function initializeWebsites() {
        websites = await loadWebsites();
        websitesByName = new Map(websites.map((site) => [site.name.toLowerCase(), site]));
        prefixIndex = createPrefixIndex(websites);
    }

    async function loadWebsites() {
        try {
            const response = await fetch('./websites.json');
            if (!response.ok) throw new Error('Failed to load websites.json');
            const data = await response.json();
            return sanitizeWebsiteList(data);
        } catch (_error) {
            return fallbackWebsites;
        }
    }

    function sanitizeWebsiteList(data) {
        if (!Array.isArray(data)) return fallbackWebsites;

        const normalized = [];
        for (const item of data) {
            if (!item || typeof item !== 'object') continue;
            if (typeof item.name !== 'string' || typeof item.domain !== 'string') continue;

            const name = item.name.trim().toLowerCase();
            const domain = item.domain.trim().toLowerCase();
            if (!name || !domain) continue;

            normalized.push({ name, domain });
        }

        if (!normalized.length) return fallbackWebsites;
        normalized.sort((a, b) => a.name.localeCompare(b.name));
        return normalized;
    }

    function createPrefixIndex(sites) {
        const root = createNode();
        sites.forEach((site, index) => {
            let node = root;
            for (const char of site.name) {
                if (!node.children.has(char)) {
                    node.children.set(char, createNode());
                }
                node = node.children.get(char);
            }
            node.matches.push(index);
        });
        return root;
    }

    function createNode() {
        return { children: new Map(), matches: [] };
    }

    function findPrefixMatches(query, limit) {
        const normalized = query.toLowerCase();
        const startsWithRegex = new RegExp(`^${escapeRegex(normalized)}`, 'i');

        let node = prefixIndex;
        for (const char of normalized) {
            node = node.children.get(char);
            if (!node) return [];
        }

        const results = [];
        const stack = [node];
        while (stack.length && results.length < limit) {
            const current = stack.pop();
            for (const idx of current.matches) {
                if (results.length >= limit) break;
                const site = websites[idx];
                if (site && startsWithRegex.test(site.name)) {
                    results.push(site);
                }
            }

            const children = Array.from(current.children.values()).reverse();
            for (const child of children) {
                stack.push(child);
            }
        }

        return results;
    }
});
