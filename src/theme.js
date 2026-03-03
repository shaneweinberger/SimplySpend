/**
 * FinSight Design System — Single source of truth for all UI colors.
 *
 * How it works:
 *   1. This file defines every color token.
 *   2. ThemeProvider.jsx flattens them into CSS custom properties (--color-*).
 *   3. tailwind.config.js maps those variables to semantic Tailwind utilities.
 *   4. Components use classes like `bg-surface-card`, `text-primary`, `border-divider`.
 *
 * To change a color, edit it here — it propagates everywhere automatically.
 */

export const theme = {

    // ── Surfaces ──────────────────────────────────────────────────────────────
    surface: {
        background: '#f8fafc',      // slate-50  — page background
        card: '#ffffff',      // white     — cards, panels
        cardHover: '#f8fafc',      // slate-50  — card hover state
        raised: '#ffffff',      // white     — elevated components (popovers, dropdowns)
        overlay: 'rgba(15, 23, 42, 0.45)', // backdrop behind modals
    },

    // ── Text ─────────────────────────────────────────────────────────────────
    text: {
        primary: '#0f172a',       // slate-900
        secondary: '#334155',       // slate-700
        muted: '#64748b',       // slate-500
        faint: '#94a3b8',       // slate-400
        inverse: '#ffffff',       // white (on dark backgrounds)
        link: '#034638',       // indigo-500
        linkHover: '#034638',       // indigo-600
    },

    // ── Borders ──────────────────────────────────────────────────────────────
    border: {
        default: '#e2e8f0',        // slate-200
        light: '#f1f5f9',        // slate-100
        focus: '#a5b4fc',        // indigo-300
        divider: '#e2e8f0',        // slate-200
    },

    // ── Primary (accent) ──────────────────────────────────────────────────────
    primary: {
        base: '#034638',       // main accent (buttons, links, icons)
        hover: '#034638',       // darker hover
        text: '#ffffff',       // text on primary bg
        light: '#eef2ff',       // very light tint (bg highlights) — was indigo-50
        lightText: '#034638',       // text on light bg — was indigo-700
        medium: '#c7d2fe',       // medium tint (active tabs) — was indigo-100
        ring: '#c7d2fe',       // focus rings, subtle borders — was indigo-200
        border: '#a5b4fc',       // accent borders (focus) — was indigo-300
        shadow: '#c7d2fe',       // box shadow — was indigo-200
    },

    // ── Secondary (slate) ────────────────────────────────────────────────────
    secondary: {
        base: '#f1f5f9',          // slate-100
        hover: '#e2e8f0',          // slate-200
        text: '#475569',          // slate-600
        border: '#e2e8f0',          // slate-200
    },

    // ── Danger (rose) ────────────────────────────────────────────────────────
    danger: {
        base: '#e11d48',       // rose-600
        hover: '#be123c',       // rose-700
        text: '#ffffff',
        light: '#fff1f2',       // rose-50
        lightText: '#be123c',       // rose-700
        border: '#fecdd3',       // rose-200
    },

    // ── Success (emerald) ────────────────────────────────────────────────────
    success: {
        base: '#059669',       // emerald-600
        light: '#ecfdf5',       // emerald-50
        lightText: '#047857',       // emerald-700
        border: '#a7f3d0',       // emerald-200
    },

    // ── Inputs ───────────────────────────────────────────────────────────────
    input: {
        background: '#ffffff',
        border: '#e2e8f0',     // slate-200
        focusBorder: '#034638',     // indigo-300
        focusRing: '#e0e7ff',     // indigo-100
        placeholder: '#94a3b8',     // slate-400
        disabled: '#f1f5f9',     // slate-100
    },

    // ── Table ────────────────────────────────────────────────────────────────
    table: {
        headerBg: '#f8fafc',      // slate-50
        headerText: '#64748b',      // slate-500
        rowBg: '#ffffff',
        rowHover: '#f8fafc',      // slate-50
        border: '#f1f5f9',      // slate-100
    },

    // ── Chart ────────────────────────────────────────────────────────────────
    chart: {
        gridline: '#f1f5f9',   // slate-100
        axisLabel: '#94a3b8',   // slate-400
        tooltipBg: '#ffffff',
        tooltipBorder: '#e2e8f0',   // slate-200
        tooltipText: '#334155',   // slate-700
        cursorFill: '#f8fafc',   // slate-50
        remaining: '#cbd5e1',   // slate-300 — "remaining categories" segment
    },

    // ── Badge / Pill / Chip ──────────────────────────────────────────────────
    badge: {
        defaultBg: '#f1f5f9',     // slate-100
        defaultText: '#475569',     // slate-600
        selectedBg: '#eef2ff',     // indigo-50
        selectedText: '#034638',     // indigo-700
        hoverBg: '#e2e8f0',     // slate-200
    },

    // ── Modal / Popover / Tooltip ────────────────────────────────────────────
    modal: {
        overlay: 'rgba(15, 23, 42, 0.45)',
        background: '#ffffff',
        border: '#e2e8f0',      // slate-200
    },

    // ── Alerts / Toasts ──────────────────────────────────────────────────────
    alert: {
        successBg: '#ecfdf5',   // emerald-50
        successText: '#047857',   // emerald-700
        successBorder: '#a7f3d0',   // emerald-200

        warningBg: '#fffbeb',   // amber-50
        warningText: '#b45309',   // amber-700
        warningBorder: '#fde68a',   // amber-200

        errorBg: '#fff1f2',   // rose-50
        errorText: '#be123c',   // rose-700
        errorBorder: '#fecdd3',   // rose-200

        infoBg: '#eff6ff',   // blue-50
        infoText: '#034638',   // blue-700
        infoBorder: '#bfdbfe',   // blue-200
    },

    // ── Links ────────────────────────────────────────────────────────────────
    link: {
        default: '#6366f1',         // indigo-500
        hover: '#4f46e5',         // indigo-600
    },

    // ── Sidebar (existing — unchanged) ───────────────────────────────────────
    sidebar: {
        backgroundColor: '#212121ff',
        borderColor: '#272727ff',
        activeItemBackground: '#034638',
        activeItemText: '#ffffff',
        inactiveItemText: '#d6d6d6ff',
        hoverItemBackground: '#454545ff',
        hoverItemText: '#ffffff',
        logoText: '#ffffff',
        dropdownBackground: '#1c1c1cff',
        dropdownBorder: '#3b3b3bff',
        dropdownHoverBackground: '#2d2d2dff',
        userProfileHoverBackground: '#2d2d2dff',
        userText: '#e2e8f0',
        userSubtext: '#94a3b8',
        toggleButtonColor: '#94a3b8',
        toggleButtonHoverColor: '#2d2d2dff',
    },
};
