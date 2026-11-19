// Injected into every page and frame during discovery. Records WHAT you click
// (element tag, label, text, a CSS path) so the sync can be automated later.
//
// It never records what you type: login fields, passwords and verification
// codes are not captured. For changed form fields, only <select> choices,
// checkboxes, and values that look like dates are kept; everything else is
// logged as "[redacted]".
(() => {
    if (window.__finsightRecorderInstalled) return;
    window.__finsightRecorderInstalled = true;

    const send = (event) => {
        try { window.__finsightRecord && window.__finsightRecord(event); } catch { /* recorder must never break the page */ }
    };
    const clean = (s, max = 120) => String(s || '').trim().replace(/\s+/g, ' ').slice(0, max);
    const isButtonInput = (el) => el.tagName === 'INPUT' && /^(submit|button|reset|image)$/i.test(el.type);

    function cssPath(el) {
        const parts = [];
        for (let node = el; node && node.nodeType === 1 && parts.length < 6; node = node.parentElement) {
            if (node.id) { parts.unshift(`#${CSS.escape(node.id)}`); break; }
            let part = node.tagName.toLowerCase();
            const parent = node.parentElement;
            if (parent) {
                const same = [...parent.children].filter((c) => c.tagName === node.tagName);
                if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
            }
            parts.unshift(part);
        }
        return parts.join(' > ');
    }

    function describe(el) {
        const isField = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !isButtonInput(el);
        let href = null;
        if (el.tagName === 'A' && el.getAttribute('href')) {
            const raw = el.getAttribute('href');
            href = raw.startsWith('javascript:') ? clean(raw, 200) : raw.split(/[?#]/)[0];
        }
        return {
            tag: el.tagName.toLowerCase(),
            id: el.id || null,
            name: el.getAttribute('name'),
            type: el.getAttribute('type'),
            role: el.getAttribute('role'),
            ariaLabel: el.getAttribute('aria-label'),
            title: el.getAttribute('title'),
            label: el.labels && el.labels[0] ? clean(el.labels[0].innerText) : null,
            // Visible text only, and never the contents of a text field.
            text: isField ? null : clean(isButtonInput(el) ? el.value : el.innerText),
            classes: clean(typeof el.className === 'string' ? el.className : '', 120) || null,
            href,
            selector: cssPath(el),
        };
    }

    const CLICKABLE = 'a,button,input,select,textarea,label,option,[role],[onclick],[tabindex]';

    document.addEventListener('click', (e) => {
        if (!(e.target instanceof Element)) return;
        const el = e.target.closest(CLICKABLE) || e.target;
        send({ kind: 'click', inFrame: window !== window.top, el: describe(el) });
    }, true);

    document.addEventListener('change', (e) => {
        const el = e.target;
        if (!(el instanceof Element)) return;
        let value = '[redacted]';
        if (el.tagName === 'SELECT') {
            const opt = el.options[el.selectedIndex];
            value = opt ? { text: clean(opt.text), value: opt.value } : null;
        } else if (el.type === 'checkbox' || el.type === 'radio') {
            value = el.checked;
        } else if (el.type !== 'password' && /^\s*\d{1,4}[-/. ]\d{1,2}[-/. ]\d{1,4}\s*$/.test(el.value || '')) {
            value = el.value.trim(); // a date — needed to learn the date-range format
        }
        send({ kind: 'change', inFrame: window !== window.top, el: describe(el), value });
    }, true);
})();
