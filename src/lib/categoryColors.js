/**
 * Shared category color palette — dark green / teal / navy / slate.
 *
 * Used in two ways:
 *   1. Auto-assigned on insert: the next free color is picked by cycling
 *      through this array based on how many categories already exist.
 *   2. Fallback rendering: if a saved category somehow has no color stored,
 *      CATEGORY_COLORS[index % length] is used as a visual fallback.
 *
 * To change the whole app's color language, edit this file only.
 */
export const CATEGORY_COLORS = [
    // ── Primary palette (user-specified) ─────────────────────────────────────
    '#d9ed92', // chartreuse-lime     — vibrant accent for first category
    '#b5e48c', // light green
    '#99d98c', // medium-light green
    '#76c893', // fresh green
    '#52b69a', // seafoam teal
    '#34a0a4', // teal
    '#168aad', // ocean blue-teal
    '#1a759f', // medium blue
    '#1e6091', // deep blue
    '#184e77', // navy

    // ── Extended palette — more categories, darker / more muted tones ─────────
    '#0f3d57', // deep navy
    '#0a2e3f', // darkest navy
    '#2d6a4f', // forest green
    '#1b4332', // deep forest
    '#40916c', // mid forest green
    '#52796f', // muted sage
    '#354f52', // dark slate-teal
    '#4a6fa5', // muted steel blue
    '#6b7f6e', // grey-green
    '#556b5c', // dark grey-green
    '#718096', // cool grey
    '#4a5568', // slate grey
    '#2d3748', // dark slate
];
