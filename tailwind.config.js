/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Surfaces ──────────────────────────────────────────
        surface: {
          DEFAULT: 'var(--color-surface-background)',
          card: 'var(--color-surface-card)',
          'card-hover': 'var(--color-surface-cardHover)',
          raised: 'var(--color-surface-raised)',
        },
        // ── Text ──────────────────────────────────────────────
        primary: 'var(--color-text-primary)',
        secondary: 'var(--color-text-secondary)',
        muted: 'var(--color-text-muted)',
        faint: 'var(--color-text-faint)',
        inverse: 'var(--color-text-inverse)',
        // ── Borders ───────────────────────────────────────────
        divider: 'var(--color-border-divider)',
        'border-light': 'var(--color-border-light)',
        'border-focus': 'var(--color-border-focus)',
        // ── Brand / Primary accent ────────────────────────────
        accent: {
          DEFAULT: 'var(--color-primary-base)',
          hover: 'var(--color-primary-hover)',
          light: 'var(--color-primary-light)',
          'light-text': 'var(--color-primary-lightText)',
          medium: 'var(--color-primary-medium)',
          ring: 'var(--color-primary-ring)',
          border: 'var(--color-primary-border)',
          shadow: 'var(--color-primary-shadow)',
        },
        // ── Danger ────────────────────────────────────────────
        'danger': {
          DEFAULT: 'var(--color-danger-base)',
          hover: 'var(--color-danger-hover)',
          light: 'var(--color-danger-light)',
          'light-text': 'var(--color-danger-lightText)',
          border: 'var(--color-danger-border)',
        },
        // ── Success ───────────────────────────────────────────
        'success': {
          DEFAULT: 'var(--color-success-base)',
          light: 'var(--color-success-light)',
          'light-text': 'var(--color-success-lightText)',
          border: 'var(--color-success-border)',
        },
        // ── Input ─────────────────────────────────────────────
        'input': {
          DEFAULT: 'var(--color-input-background)',
          border: 'var(--color-input-border)',
          'focus-border': 'var(--color-input-focusBorder)',
          'focus-ring': 'var(--color-input-focusRing)',
          placeholder: 'var(--color-input-placeholder)',
          disabled: 'var(--color-input-disabled)',
        },
        // ── Table ─────────────────────────────────────────────
        'table': {
          header: 'var(--color-table-headerBg)',
          'header-text': 'var(--color-table-headerText)',
          row: 'var(--color-table-rowBg)',
          'row-hover': 'var(--color-table-rowHover)',
          border: 'var(--color-table-border)',
        },
        // ── Chart ─────────────────────────────────────────────
        'chart': {
          gridline: 'var(--color-chart-gridline)',
          axis: 'var(--color-chart-axisLabel)',
          remaining: 'var(--color-chart-remaining)',
        },
        // ── Badge ─────────────────────────────────────────────
        'badge': {
          DEFAULT: 'var(--color-badge-defaultBg)',
          text: 'var(--color-badge-defaultText)',
          selected: 'var(--color-badge-selectedBg)',
          'selected-text': 'var(--color-badge-selectedText)',
          hover: 'var(--color-badge-hoverBg)',
        },
        // ── Alert ─────────────────────────────────────────────
        'alert-success': {
          DEFAULT: 'var(--color-alert-successBg)',
          text: 'var(--color-alert-successText)',
          border: 'var(--color-alert-successBorder)',
        },
        'alert-warning': {
          DEFAULT: 'var(--color-alert-warningBg)',
          text: 'var(--color-alert-warningText)',
          border: 'var(--color-alert-warningBorder)',
        },
        'alert-error': {
          DEFAULT: 'var(--color-alert-errorBg)',
          text: 'var(--color-alert-errorText)',
          border: 'var(--color-alert-errorBorder)',
        },
        'alert-info': {
          DEFAULT: 'var(--color-alert-infoBg)',
          text: 'var(--color-alert-infoText)',
          border: 'var(--color-alert-infoBorder)',
        },
      },
      // Overlay color for modals
      backgroundColor: {
        overlay: 'var(--color-modal-overlay)',
      },
    },
  },
  plugins: [],
}
