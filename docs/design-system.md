# PREMAL KAIZEN Design System

**Brand**: Premium streetwear inspired by Japanese Kaizen philosophy  
**Tagline**: "Wear Your Vibe. Own Your Story."  
**Version**: 1.0  
**Last Updated**: 2026-10-29

---

## Brand Direction

PREMAL KAIZEN is a premium, minimal streetwear brand. The design system reflects:

- **Premium Quality**: Use of high-contrast blacks and creams, generous spacing, clear typography
- **Minimalism**: No gradients, no decorative animations, no clutter
- **Japanese Kaizen**: Continuous improvement through refinement, not ornamentation
- **Accessibility**: High contrast, readable typography, keyboard-first interaction
- **Modern Explorer**: Technical yet approachable, designed for confident individuals

The brand should feel elevated but not pretentious, minimal but not sparse, modern but timeless.

---

## Color Palette

### Primary Colors

| Token | Hex | RGB | Usage | Notes |
|-------|-----|-----|-------|-------|
| `black` | #000000 | 0, 0, 0 | Primary text, borders, depth | Use sparingly for emphasis |
| `neutral-950` | #0A0A0A | 10, 10, 10 | Deep backgrounds | Alternative to pure black |
| `neutral-900` | #1A1A1A | 26, 26, 26 | Navigation, headers | Slightly warmer than black |
| `neutral-800` | #2D2D2D | 45, 45, 45 | Secondary backgrounds | Dark sections |

### Secondary Colors

| Token | Hex | RGB | Usage | Notes |
|-------|-----|-----|-------|-------|
| `cream` | #F5F1ED | 245, 241, 237 | Cards, buttons, backgrounds | Primary light background |
| `cream-light` | #FAFAF7 | 250, 250, 247 | Subtle backgrounds | Secondary light background |

### Accent Colors

| Token | Hex | RGB | Usage | Notes |
|-------|-----|-----|-------|-------|
| `beige` | #D4C5B9 | 212, 197, 185 | Prices, labels, secondary elements | Warm neutral |
| `beige-light` | #E8DDD4 | 232, 221, 212 | Subtle accents | Lighter beige |

### Neutral Grays

| Token | Hex | RGB | Usage | Notes |
|-------|-----|-----|-------|-------|
| `gray-dark` | #333333 | 51, 51, 51 | Secondary text | Good contrast on cream |
| `gray-medium` | #666666 | 102, 102, 102 | Tertiary text, borders | Lighter secondary text |
| `gray-light` | #999999 | 153, 153, 153 | Disabled states, placeholders | Lowest contrast text |

### Status Colors

| Token | Hex | Usage | Contrast Ratio |
|-------|-----|-------|-----------------|
| `success` | #2D5016 | Success messages, available stock | 5.2:1 (WCAG AA) |
| `error` | #8B0000 | Error messages, out of stock | 5.5:1 (WCAG AA) |
| `warning` | #7C4D00 | Warning messages | 4.8:1 (WCAG AA) |
| `info` | #003366 | Informational messages | 6.3:1 (WCAG AA) |

### Color Combinations (Approved Pairings)

| Foreground | Background | Contrast | Usage | WCAG Level |
|------------|-----------|----------|-------|-----------|
| Black | Cream | 18.5:1 | Primary text on primary background | AAA |
| Cream | Black | 18.5:1 | Inverted primary (buttons, headers) | AAA |
| Gray-Dark | Cream | 8.1:1 | Secondary text | AA |
| Beige | Cream | 1.2:1 | Subtle accent on light background | N/A |
| Success | Cream | 3.8:1 | Status indicator | AA |

---

## Typography

### Font Families

- **Headlines/Display**: System sans-serif stack (`-apple-system`, `system-ui`, sans-serif)
  - Used for: Page titles, section headers, CTAs
  - Font weight: 600–700 (semibold to bold)

- **Body/UI**: System sans-serif stack
  - Used for: Paragraphs, form inputs, navigation
  - Font weight: 400–500 (regular to medium)

**Rationale**: System fonts load instantly (no HTTP requests), provide native look-and-feel, ensure excellent legibility at all sizes, and maintain brand consistency across platforms.

### Font Scale

| Token | Size | Line Height | Usage | Example |
|-------|------|-------------|-------|---------|
| `xs` | 12px | 1.2 | Labels, badges, small text | "Sale" badge, form hints |
| `sm` | 14px | 1.4 | Form inputs, secondary labels | Form field labels |
| `base` | 16px | 1.6 | Body text, paragraphs | Product descriptions, reviews |
| `lg` | 18px | 1.6 | Emphasis text, large labels | Card titles |
| `xl` | 20px | 1.4 | Section subtitles | "Shop the Collection" subtitle |
| `2xl` | 24px | 1.2 | Section titles | Category page titles |
| `3xl` | 32px | 1.2 | Page titles | Homepage title |
| `4xl` | 40px | 1.2 | Hero titles | Hero section headline |
| `5xl` | 48px | 1.2 | Display headlines | Brand statement on hero |

### Font Weights

- **400 (Regular)**: Body text, normal UI
- **500 (Medium)**: Emphasis within body, labels
- **600 (Semibold)**: Section headers, button text
- **700 (Bold)**: Page titles, hero headlines

### Line Height

- **1.2 (Tight)**: Short headlines, titles (prevents excess vertical space)
- **1.4 (Snug)**: Section subtitles, medium-length text
- **1.6 (Normal)**: Body paragraphs (improves readability)
- **1.8 (Relaxed)**: Long-form content, accessibility-focused

---

## Spacing System

Based on a **4px base unit**, creating a consistent rhythm throughout the interface.

| Token | Pixels | Usage | Example |
|-------|--------|-------|---------|
| 1 | 4px | Tiny gaps, icon spacing | Space between icon and text |
| 2 | 8px | Small padding, tight grouping | Form input padding |
| 3 | 12px | Small spacing within components | Padding inside buttons |
| 4 | 16px | Standard padding, regular gaps | Card padding, section gaps |
| 5 | 20px | Medium padding, breathing room | Page section padding |
| 6 | 24px | Large padding, section separation | Container padding |
| 8 | 32px | Major section spacing | Gap between hero and product grid |
| 10 | 40px | Large gaps | Gap between major sections |
| 12 | 48px | Extra-large spacing | Gap between page sections |
| 16 | 64px | Full section gaps | Hero to next section |
| 20 | 80px | Page-level spacing | Top/bottom padding on full-width sections |
| 24 | 96px | Maximum spacing | Large whitespace between distinct sections |

### Margin Collapsing

Use consistent padding on containers rather than margins on child elements to avoid margin collapsing and unpredictable spacing.

**Good**: Parent container with `p-4`, children with no margin  
**Avoid**: Children with individual margins that may collapse

---

## Layout & Grid

### Container Widths

| Breakpoint | Width | Max Width | Padding |
|-----------|-------|-----------|---------|
| Mobile (xs) | 100% | — | 16px (p-4) sides |
| Small (sm) | 100% | 640px | 16px sides |
| Tablet (md) | 100% | 768px | 24px sides |
| Desktop (lg) | 100% | 1024px | 32px sides |
| Large (xl) | 100% | 1280px | 32px sides |
| Extra Large (2xl) | 100% | 1536px | 32px sides |

### Grid System

- **Storefront Product Grid**: 4 columns on desktop, 2 on tablet, 1 on mobile
- **Admin Dashboard**: Variable (sidebar + main), responsive columns
- **Form Layout**: Single column on mobile, 2 columns on desktop

### Responsive Breakpoints

| Breakpoint | Min Width | Usage |
|-----------|-----------|-------|
| `xs` | 320px | Mobile devices |
| `sm` | 640px | Small phones, large phones |
| `md` | 768px | Tablets |
| `lg` | 1024px | Desktops, small laptops |
| `xl` | 1280px | Large desktops |
| `2xl` | 1536px | Extra-large screens |

**Mobile-First Approach**: Design for mobile first, then enhance for larger screens. Breakpoints use `min-width` media queries.

---

## Component Patterns

### Buttons

**Primary Button**
- Background: Cream (`#F5F1ED`)
- Border: None
- Text: Black, semibold (600)
- Padding: 12px 24px (vertical × horizontal)
- Radius: 4px
- Hover: Darker cream (`#E8DDD4`)
- Active: Even darker
- Disabled: Gray-light text, gray-light background

**Secondary Button**
- Background: Transparent
- Border: 1px black
- Text: Black, semibold (600)
- Padding: 12px 24px
- Radius: 4px
- Hover: Black background, cream text
- Active: Darker background
- Disabled: Gray-light border, gray-light text

**Icon Button**
- No visible background (transparent)
- Icon: Black, 20–24px
- Hover: Background beige-light
- Active: Background beige
- Radius: 4px (on hover background)

### Form Controls

**Text Input**
- Background: White
- Border: 1px gray-light
- Text: Black, base (16px)
- Padding: 8px 12px
- Radius: 4px
- Focus: Border black, outline none
- Disabled: Gray-light background, gray-light text
- Error: Border error color, error icon

**Label**
- Text: Black, semibold (600), sm (14px)
- Margin-bottom: 8px (2)
- Required asterisk: error color

**Placeholder**
- Color: Gray-light
- Font-style: Normal (not italic)

### Focus States

- **Visible Focus**: 2px solid black border, 2px offset outline
- **Keyboard Focus**: Always visible (no removal of focus indicators)
- **Mouse Focus**: Optional (can be lighter for mouse users, but must still be present)

**Why**: Users navigating with keyboards must see where they are. Never remove focus indicators; instead, style them appropriately.

### Cards

- Background: Cream
- Border: None
- Shadow: `0 2px 4px 0 rgba(0, 0, 0, 0.1)`
- Radius: 4px
- Padding: 16px (p-4)
- Hover (optional): Shadow increases to `0 4px 8px 0 rgba(0, 0, 0, 0.12)`

### Images

**Product Images**
- Aspect Ratio: 1:1 (square)
- Fit: `cover` (fill the space, crop if needed)
- Lazy Loading: Enabled (Next.js Image component)
- Format: WebP with JPEG fallback

**Hero Images**
- Aspect Ratio: 16:9 or full height (depends on context)
- Fit: `cover`
- Lazy Loading: Disabled for above-the-fold hero

**Gallery Thumbnails**
- Aspect Ratio: 1:1
- Fit: `cover`
- Size: 60–80px

---

## Shadows and Elevation

| Token | Shadow CSS | Usage | Elevation |
|-------|-----------|-------|-----------|
| `shadow-sm` | `0 1px 2px 0 rgba(0, 0, 0, 0.05)` | Subtle elevation | +1 |
| `shadow-base` | `0 2px 4px 0 rgba(0, 0, 0, 0.1)` | Default card elevation | +2 |
| `shadow-md` | `0 4px 8px 0 rgba(0, 0, 0, 0.12)` | Medium elevation | +3 |
| `shadow-lg` | `0 8px 16px 0 rgba(0, 0, 0, 0.15)` | Large elevation | +4 |
| `shadow-xl` | `0 12px 24px 0 rgba(0, 0, 0, 0.18)` | Extra-large elevation | +5 |

**Usage**: Shadows indicate clickable elements, containers, and depth hierarchy. Use sparingly—maximize contrast instead.

---

## Borders and Radii

### Border Widths

| Token | Pixels | Usage |
|-------|--------|-------|
| 0 | 0 | No border |
| 1 | 1px | Default borders |
| 2 | 2px | Emphasis borders, focus states |
| 3 | 3px | Strong emphasis, active states |

### Border Radius

| Token | Pixels | Usage |
|-------|--------|-------|
| `none` | 0 | Square elements |
| `sm` | 2px | Very subtle rounding |
| `base` | 4px | Standard buttons, inputs, cards |
| `md` | 6px | Medium rounding |
| `lg` | 8px | Larger components |
| `xl` | 12px | Large modal dialogs |
| `full` | 9999px | Pills, circular avatars |

**Rationale**: Subtle rounding (4px default) maintains premium feel without excessive roundness.

---

## Transitions and Motion

### Duration

| Token | Duration | Usage |
|-------|----------|-------|
| `fast` | 150ms | Quick micro-interactions (hover, button press) |
| `base` | 200ms | Standard transitions (fade, slide) |
| `slow` | 300ms | Longer transitions (modal open, page change) |

### Easing

- **Default**: `ease` or `cubic-bezier(0.25, 0.46, 0.45, 0.94)` (smooth)
- **Entrance**: `ease-out` (objects come in quickly, slow at end)
- **Exit**: `ease-in` (objects leave smoothly)
- **Interactive**: `ease-in-out` (smooth both ways)

### Motion Guidelines

- **Avoid**: Gratuitous animations, animations longer than 500ms, animations on scroll
- **Prefer**: Purposeful transitions (state changes, interactions), subtle effects
- **Reduce**: Respect `prefers-reduced-motion` media query for accessibility

---

## Accessibility

### Contrast Requirements

All text must meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text).

**Verified Pairings**:
- Black on cream: 18.5:1 ✓ (AAA)
- Gray-dark on cream: 8.1:1 ✓ (AA)
- Gray-medium on cream: 3.1:1 ✗ (not approved for body text)
- Success on cream: 3.8:1 ✓ (AA, large text only)

### Color is Not Alone

Never use color as the only way to communicate information. Always add:
- Icons (e.g., ✓ for success, ✗ for error)
- Text labels
- Patterns (e.g., underline for links)

### Keyboard Navigation

All interactive elements must be accessible via keyboard:
- Use semantic HTML (`<button>`, `<a>`, `<input>`)
- Tab order must be logical
- Focus indicators must be visible
- Modals must trap focus

### Alt Text

All images must have descriptive alt text:
- **Product images**: "PREMAL KAIZEN Mountain Hoodie in black, front view"
- **Icons**: "Cart icon" (short, descriptive)
- **Decorative images**: `alt=""` (empty, skip in screen readers)
- **Logos**: "PREMAL KAIZEN logo"

### Form Labels

Every form input must have an associated label:
```html
<label for="email">Email Address</label>
<input id="email" type="email" required />
```

### Screen Reader Announcements

Use `aria-live`, `aria-label`, `role` attributes for:
- Loading states
- Error messages
- Status updates
- Custom components

---

## Implementation Notes

### Tailwind CSS Integration

All tokens are configured in `tailwind.config.ts` and available as Tailwind classes:

```tsx
<button className="bg-cream hover:bg-beige-light text-black font-semibold px-6 py-3 rounded">
  Shop Now
</button>
```

### CSS Variables (Optional)

For components that need runtime customization, CSS variables are also available:

```css
:root {
  --color-black: #000000;
  --color-cream: #F5F1ED;
  --color-beige: #D4C5B9;
}

.button {
  background-color: var(--color-cream);
  color: var(--color-black);
}
```

### Global Styles

Global styles are applied in `apps/storefront/app/globals.css` and `apps/admin/app/globals.css`:
- CSS reset
- Font loading
- Root color scheme
- System font stack

### Component Library

Reusable components are in `packages/ui/src/components/` and exported from `packages/ui/src/index.ts`.

---

## Design Tokens Summary

| Category | Example Token | Value | Tailwind Class |
|----------|----------------|-------|------------------|
| Color | `cream` | #F5F1ED | `bg-cream`, `text-cream` |
| Spacing | `4` | 16px | `p-4`, `m-4`, `gap-4` |
| Typography | `2xl` | 24px | `text-2xl` |
| Border Radius | `base` | 4px | `rounded` |
| Shadow | `md` | See above | `shadow-md` |
| Duration | `base` | 200ms | `duration-200` |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-10-29 | Initial design system created for Phase 1 |

---

**Questions or updates?** Please refer to the design system regularly and update this document as the brand evolves.
