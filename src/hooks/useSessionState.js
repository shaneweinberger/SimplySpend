import { useState, useEffect } from 'react';

/**
 * Drop-in replacement for useState that persists to sessionStorage.
 *
 * - Survives in-app React Router navigation (component unmount/remount).
 * - Automatically clears on browser reload or tab close (sessionStorage semantics).
 * - Priority: sessionStorage saved value > defaultValue.
 *
 * @param {string} key           Unique sessionStorage key (e.g. "overview.timeRange")
 * @param {*}      defaultValue  Used when no saved value exists in the session
 * @returns {[*, Function]}      [value, setter] — identical API to useState
 */
export function useSessionState(key, defaultValue) {
    const [value, setValue] = useState(() => {
        try {
            const saved = sessionStorage.getItem(key);
            return saved !== null ? JSON.parse(saved) : defaultValue;
        } catch {
            return defaultValue;
        }
    });

    useEffect(() => {
        try {
            sessionStorage.setItem(key, JSON.stringify(value));
        } catch {
            // sessionStorage unavailable (private browsing quota, etc.) — silently no-op
        }
    }, [key, value]);

    return [value, setValue];
}
