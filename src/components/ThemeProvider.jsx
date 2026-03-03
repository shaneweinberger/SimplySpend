import { useEffect } from 'react';
import { theme } from '../theme';

/**
 * ThemeProvider — flattens theme.js into CSS custom properties on :root.
 *
 * Usage:  <ThemeProvider>{children}</ThemeProvider>
 *
 * Produces variables like:
 *   --color-surface-card: #ffffff
 *   --color-primary-base: #4f46e5
 *   --color-text-muted:   #64748b
 *
 * These are consumed by tailwind.config.js via var(--color-*).
 */
function flattenTheme(obj, prefix = 'color') {
    const vars = {};
    for (const [key, value] of Object.entries(obj)) {
        const varName = `--${prefix}-${key}`;
        if (typeof value === 'object' && value !== null) {
            Object.assign(vars, flattenTheme(value, `${prefix}-${key}`));
        } else {
            vars[varName] = value;
        }
    }
    return vars;
}

export default function ThemeProvider({ children }) {
    useEffect(() => {
        const vars = flattenTheme(theme);
        const root = document.documentElement;
        for (const [prop, value] of Object.entries(vars)) {
            root.style.setProperty(prop, value);
        }
        return () => {
            for (const prop of Object.keys(vars)) {
                root.style.removeProperty(prop);
            }
        };
    }, []);

    return children;
}
