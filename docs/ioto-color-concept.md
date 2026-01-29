# Ioto UI Color System

Complete color system for light and dark mode, built on the Ioto Communications brand foundation.

---

## Brand Foundation

| Color | Hex | RGB | Usage |
|-------|-----|-----|-------|
| Navy Blue | `#162237` | 22, 34, 55 | Primary brand color |
| Sage Green | `#7a907d` | 122, 144, 125 | Secondary accent |
| Bright Blue | `#2790f1` | 39, 144, 241 | Highlight accent |
| Light Beige | `#eeece7` | 238, 236, 231 | Light background |
| Warm Beige | `#e9e5db` | 233, 229, 219 | Secondary background |
| Text Dark | `#202020` | 32, 32, 32 | Body text |
| White | `#ffffff` | 255, 255, 255 | Text on dark |

---

## Light Mode Palette

### Backgrounds

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-dark` | `#e9e5db` | Darker sections, sidebars |
| `--bg` | `#eeece7` | Primary page background |
| `--bg-light` | `#f7f6f3` | Elevated sections |
| `--bg-surface` | `#ffffff` | Cards, modals, inputs |

### Text

| Token | Hex | Usage |
|-------|-----|-------|
| `--text` | `#162237` | Headings, strong text |
| `--text-muted` | `#4a5568` | Body text, paragraphs |
| `--text-subtle` | `#7a8599` | Captions, metadata |

### Borders

| Token | Hex | Usage |
|-------|-----|-------|
| `--highlight` | `#d9d5cb` | Subtle borders, dividers |
| `--border` | `#c8c3b7` | Standard borders |
| `--border-muted` | `#b8b2a5` | Stronger borders |

### Actions

| Token | Hex | Hover | Usage |
|-------|-----|-------|-------|
| `--primary` | `#7a907d` | `#6a7f6d` | Primary buttons, links |
| `--secondary` | `#162237` | `#1f2f4a` | Secondary buttons |
| `--accent` | `#2790f1` | `#1a7dd8` | Highlights, focus states |

### Alerts

| Token | Color | Background | Usage |
|-------|-------|------------|-------|
| `--danger` | `#dc3545` | `#fdeced` | Errors, destructive |
| `--warning` | `#f5a623` | `#fef9e7` | Warnings, caution |
| `--success` | `#28a745` | `#e8f5e9` | Success, confirmation |
| `--info` | `#2790f1` | `#e8f4fc` | Information, tips |

---

## Dark Mode Palette

### Backgrounds

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-dark` | `#0d1520` | Deepest background |
| `--bg` | `#162237` | Primary page background |
| `--bg-light` | `#1f2f4a` | Elevated sections |
| `--bg-surface` | `#253854` | Cards, modals, inputs |

### Text

| Token | Hex | Usage |
|-------|-----|-------|
| `--text` | `#f7f6f3` | Headings, strong text |
| `--text-muted` | `#b8c2cf` | Body text, paragraphs |
| `--text-subtle` | `#8a99ab` | Captions, metadata |

### Borders

| Token | Hex | Usage |
|-------|-----|-------|
| `--highlight` | `#3a4d68` | Subtle borders, dividers |
| `--border` | `#2d3f5a` | Standard borders |
| `--border-muted` | `#1f2f4a` | Stronger borders |

### Actions

| Token | Hex | Hover | Usage |
|-------|-----|-------|-------|
| `--primary` | `#8fa892` | `#9fb9a2` | Primary buttons, links |
| `--secondary` | `#e9e5db` | `#eeece7` | Secondary buttons |
| `--accent` | `#4da3f5` | `#6db4f7` | Highlights, focus states |

### Alerts

| Token | Color | Background | Usage |
|-------|-------|------------|-------|
| `--danger` | `#f56565` | `#2d1f22` | Errors, destructive |
| `--warning` | `#f6c653` | `#2d2a1f` | Warnings, caution |
| `--success` | `#48bb78` | `#1f2d22` | Success, confirmation |
| `--info` | `#4da3f5` | `#1f2533` | Information, tips |

---

## CSS Variables

### Light Mode

```css
:root {
  /* Backgrounds */
  --bg-dark: #e9e5db;
  --bg: #eeece7;
  --bg-light: #f7f6f3;
  --bg-surface: #ffffff;
  
  /* Text */
  --text: #162237;
  --text-muted: #4a5568;
  --text-subtle: #7a8599;
  
  /* Borders */
  --highlight: #d9d5cb;
  --border: #c8c3b7;
  --border-muted: #b8b2a5;
  
  /* Actions */
  --primary: #7a907d;
  --primary-hover: #6a7f6d;
  --secondary: #162237;
  --secondary-hover: #1f2f4a;
  --accent: #2790f1;
  --accent-hover: #1a7dd8;
  
  /* Alerts */
  --danger: #dc3545;
  --danger-bg: #fdeced;
  --warning: #f5a623;
  --warning-bg: #fef9e7;
  --success: #28a745;
  --success-bg: #e8f5e9;
  --info: #2790f1;
  --info-bg: #e8f4fc;
}
```

### Dark Mode

```css
:root {
  /* Backgrounds */
  --bg-dark: #0d1520;
  --bg: #162237;
  --bg-light: #1f2f4a;
  --bg-surface: #253854;
  
  /* Text */
  --text: #f7f6f3;
  --text-muted: #b8c2cf;
  --text-subtle: #8a99ab;
  
  /* Borders */
  --highlight: #3a4d68;
  --border: #2d3f5a;
  --border-muted: #1f2f4a;
  
  /* Actions */
  --primary: #8fa892;
  --primary-hover: #9fb9a2;
  --secondary: #e9e5db;
  --secondary-hover: #eeece7;
  --accent: #4da3f5;
  --accent-hover: #6db4f7;
  
  /* Alerts */
  --danger: #f56565;
  --danger-bg: #2d1f22;
  --warning: #f6c653;
  --warning-bg: #2d2a1f;
  --success: #48bb78;
  --success-bg: #1f2d22;
  --info: #4da3f5;
  --info-bg: #1f2533;
}
```

---

## Usage Guidelines

### Text Contrast
Use `--text` for headings and important content, `--text-muted` for body paragraphs, and `--text-subtle` for captions and secondary information.

### Backgrounds
Layer backgrounds from darkest to lightest: `--bg-dark` → `--bg` → `--bg-light` → `--bg-surface` to create depth and visual hierarchy.

### Buttons
- **Primary**: Sage green for main CTAs
- **Secondary**: Navy/beige for secondary actions
- **Accent**: Bright blue for special emphasis

### Alerts
Always pair alert colors with their corresponding background for proper contrast and visual distinction.

---

## Implementation Status

**Applied**: 29 January 2026
**Target**: `ioto-fmp/frontend/src/`

### Files Modified

| File | Changes |
|------|---------|
| `frontend/src/main.ts` | `definePreset(Aura)` with sage green primary scale (50–950) and light/dark `colorScheme` overrides. Removed old blue primary and dark surface scale. |
| `frontend/src/App.vue` | Added `html:root` block for light mode (warm beige surfaces, navy text, sage green highlights). Replaced `:root.p-dark` block with navy palette (navy surfaces, light text, sage green highlights). Sidebar/topbar use `var(--app-sidebar-bg)` / `var(--app-topbar-bg)`. |
| `frontend/src/components/DeviceMapPage.vue` | Dark popup overrides: `#18222c` → `#253854`, `#283039` → `#2d3f5a`, `#9faab6` → `#b8c2cf`, `#c1c9d2` → `#f7f6f3`. |

### PrimeVue Token Mapping

| Token | Light | Dark |
|-------|-------|------|
| `--p-surface-ground` | `#eeece7` (warm beige) | `#162237` (navy) |
| `--p-surface-0` | `#ffffff` (white) | `#253854` (dark navy) |
| `--p-text-color` | `#162237` (navy) | `#f7f6f3` (off-white) |
| `--p-text-muted-color` | `#4a5568` | `#b8c2cf` |
| `--p-surface-border` | `#c8c3b7` (warm) | `#2d3f5a` (navy) |
| `--p-primary-color` | `#7a907d` (sage) | `#8fa892` (lighter sage) |
| `--app-sidebar-bg` | `#e9e5db` (beige) | `#0d1520` (deepest navy) |
| `--app-topbar-bg` | `#ffffff` | `#0d1520` |

### Dark Mode Toggle

`.p-dark` class on `<html>` element, managed by `stores/theme.ts`, configured via `darkModeSelector: '.p-dark'` in `main.ts`.

---

*Ioto Communications • Color System v1.1 — Implementation Complete*
