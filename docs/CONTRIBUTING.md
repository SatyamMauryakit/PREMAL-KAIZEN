# Contributing to PREMAL KAIZEN

## Development Workflow

### 1. Setup

```bash
# Clone the repository and install dependencies
pnpm install

# Create .env.local from .env.example
cp .env.example .env.local

# Edit .env.local with your local development settings
```

### 2. Running Applications

```bash
# Start all apps in development mode
pnpm dev

# Or start individual apps
cd apps/storefront && pnpm dev    # Port 3000
cd apps/admin && pnpm dev         # Port 3001
cd apps/api && pnpm dev           # Port 3002
```

### 3. Code Style and Linting

```bash
# Run ESLint on all code
pnpm lint

# Auto-fix ESLint issues
pnpm lint -- --fix

# Format code with Prettier
pnpm format

# Type-check all packages
pnpm type-check
```

### 4. Git Workflow

#### Branch Naming
- Feature: `feature/description` (e.g., `feature/product-page`)
- Bug fix: `fix/description` (e.g., `fix/cart-calculation`)
- Chore: `chore/description` (e.g., `chore/update-deps`)
- Documentation: `docs/description` (e.g., `docs/api-guide`)

#### Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add product detail page
^--^  ^--^
│     └─ summary in imperative mood
└─ type: feat|fix|docs|chore|refactor|test

Longer explanation if needed. Include:
- What changed
- Why it changed
- Any breaking changes
```

Examples:
- `feat: implement product gallery with image zoom`
- `fix: correct cart total calculation with taxes`
- `docs: add design system color tokens`
- `chore: update Next.js to 15.0.1`

### 5. Testing Checklist

Before submitting a PR:

- [ ] Code runs locally without errors
- [ ] ESLint passes: `pnpm lint`
- [ ] TypeScript checks pass: `pnpm type-check`
- [ ] Responsive design works (mobile, tablet, desktop)
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] No console warnings or errors
- [ ] Commit messages follow convention

### 6. Pull Request Process

1. **Push to feature branch**: `git push origin feature/your-feature`
2. **Create PR on GitHub** with:
   - Clear title (e.g., "feat: add product detail page")
   - Description of changes
   - Reference any issues (e.g., "Closes #123")
   - Screenshots or videos for UI changes
3. **Address feedback** and push updates
4. **Squash and merge** once approved

### 7. Project Structure Reference

```
apps/
├── storefront/    # Customer website (Next.js, Port 3000)
├── admin/         # Staff dashboard (Next.js, Port 3001)
└── api/           # Backend API (NestJS, Port 3002)

packages/
├── types/         # Shared TypeScript types, Zod schemas
└── ui/            # Shared React components

docs/
├── design-system.md        # Colors, typography, spacing
├── development-roadmap.md  # 10-phase plan
└── CONTRIBUTING.md         # This file
```

### 8. Common Tasks

#### Adding a dependency

```bash
# Add to specific app
cd apps/storefront && pnpm add package-name

# Add to root (for dev tools)
pnpm add -w -D package-name
```

#### Creating a new component

1. Create file: `apps/storefront/components/YourComponent.tsx`
2. Import and use in pages
3. If reusable across apps, move to `packages/ui/src/components/`

#### Running tests

```bash
# Run all tests
pnpm test

# Run specific app's tests
cd apps/storefront && pnpm test

# Watch mode
pnpm test -- --watch
```

## Design System Guidelines

- Colors: Use design tokens from `docs/design-system.md`
- Spacing: Use Tailwind classes (p-4, m-4, gap-4, etc.)
- Typography: Use semantic size classes (text-lg, text-2xl, etc.)
- Focus states: Always include `:focus-visible` for keyboard users
- Images: Use Next.js `<Image>` component with lazy loading
- Animations: Keep under 300ms, respect `prefers-reduced-motion`

## Troubleshooting

### Port already in use

```bash
# Kill process on port 3000 (macOS/Linux)
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Or change port
NEXT_PUBLIC_PORT=3003 pnpm dev
```

### Node modules issues

```bash
# Clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### TypeScript errors

```bash
# Rebuild TypeScript
pnpm type-check

# Clear cache
rm -rf .next dist
pnpm build
```

## Questions?

- Check [`docs/development-roadmap.md`](./development-roadmap.md) for phase context
- Check [`docs/design-system.md`](./design-system.md) for design tokens
- Review [`README.md`](../README.md) for quick start

---

**Thank you for contributing to PREMAL KAIZEN!**
