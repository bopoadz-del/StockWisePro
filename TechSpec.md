# StockWise Pro - Technical Specification

## 1. Component Inventory

### shadcn/ui Components (Built-in)
- `accordion` - FAQ section
- `alert` - Notifications, error states
- `avatar` - User testimonials, investor profiles
- `badge` - Stock signals, plan badges
- `button` - All CTAs, actions
- `card` - Pricing plans, stock cards
- `carousel` - Testimonials, investor slider
- `checkbox` - Filters, feature lists
- `dialog` - Stock detail modal
- `drawer` - Mobile navigation, side panels
- `dropdown-menu` - Navigation dropdowns
- `input` - Search, budget input
- `label` - Form labels
- `progress` - Score visualization
- `scroll-area` - Custom scrollbars
- `select` - Filter dropdowns
- `separator` - Visual dividers
- `sheet` - Stock detail drawer
- `slider` - Weight customization
- `sonner` - Toast notifications
- `switch` - Monthly/annual toggle
- `table` - Stock screener results
- `tabs` - Stock detail tabs
- `toast` - Notifications
- `tooltip` - Help text, data explanations

### Third-Party Components
- `@tanstack/react-table` - Advanced data table with sorting/filtering
- `recharts` - Charts and visualizations
- `framer-motion` - Animations and transitions
- `lucide-react` - Icon library (included with shadcn)

### Custom Components to Build
1. **StockScreener** - Main screening interface with filters
2. **ScoreVisualizer** - Animated circular score display
3. **WeightCustomizer** - Sliders for scoring weights
4. **InvestorCard** - Famous investor profile cards
5. **PortfolioBuilder** - Budget-based portfolio generator
6. **LiveTicker** - Scrolling stock ticker
7. **SparklineChart** - Mini price charts
8. **SignalBadge** - Buy/Hold/Sell indicators
9. **PricingCard** - Plan comparison cards
10. **TestimonialCarousel** - Auto-rotating testimonials
11. **MarketStatus** - Market open/closed indicator
12. **StockDetailDrawer** - Slide-out stock information

---

## 2. Animation Implementation Table

| Animation | Library | Implementation Approach | Complexity |
|-----------|---------|------------------------|------------|
| Page load sequence | Framer Motion | `AnimatePresence` + staggered `motion.div` | Medium |
| Scroll reveal | Framer Motion | `useInView` hook + `whileInView` prop | Low |
| Navbar underline | CSS | `::after` pseudo-element, width transition | Low |
| Card hover lift | CSS/Framer | `whileHover={{ y: -4 }}` or CSS transform | Low |
| Button hover | CSS | Background + scale transition | Low |
| Score ring animation | Framer Motion | SVG `stroke-dashoffset` animation | Medium |
| Table row highlight | CSS | Background transition on hover | Low |
| Ticker scroll | CSS | `@keyframes` infinite scroll, pause on hover | Medium |
| Modal/Drawer slide | Framer Motion | `AnimatePresence` + x/y transform | Medium |
| Accordion expand | Framer Motion | `AnimatePresence` + height animation | Medium |
| Counter animation | Custom hook | `useCountUp` with requestAnimationFrame | Medium |
| Sparkline draw | Recharts | Animated line chart | Low |
| Price flash | CSS | Keyframe color flash on update | Low |
| Slider drag | shadcn | Built-in slider with custom styling | Low |
| Toast notifications | Sonner | Built-in animation | Low |
| Carousel slide | Embla | Built-in carousel with fade/slide | Low |
| Tab content switch | Framer Motion | `AnimatePresence` mode="wait" | Medium |
| Loading spinner | CSS | Rotating border animation | Low |
| Glow effects | CSS | Box-shadow transition | Low |

---

## 3. Animation Library Choices

### Primary: Framer Motion
**Rationale:**
- Native React integration with declarative API
- Excellent performance with hardware acceleration
- Built-in `AnimatePresence` for enter/exit animations
- `useInView` hook for scroll-triggered animations
- Gesture support for interactive elements

**Use for:**
- Page transitions and load sequences
- Scroll-triggered reveals
- Modal/drawer animations
- Complex multi-step animations
- Interactive hover states

### Secondary: CSS Animations/Transitions
**Rationale:**
- Zero JS overhead for simple effects
- Better performance for micro-interactions
- Native browser support

**Use for:**
- Button hovers
- Link underlines
- Simple transforms (scale, translate)
- Infinite animations (ticker, spinner)
- Color transitions

### Charts: Recharts
**Rationale:**
- React-native charting library
- Customizable styling for dark theme
- Animation support

**Use for:**
- Sparklines
- Portfolio allocation pie chart
- Price history charts
- Score breakdown visualization

---

## 4. Project File Structure

```
/mnt/okcomputer/output/app/
├── app/
│   ├── globals.css              # Global styles, Tailwind imports
│   ├── layout.tsx               # Root layout with fonts
│   ├── page.tsx                 # Main landing page
│   │
│   ├── sections/                # Page sections
│   │   ├── Navbar.tsx
│   │   ├── Hero.tsx
│   │   ├── StockScreener.tsx
│   │   ├── ScoringSystem.tsx
│   │   ├── InvestorPortfolios.tsx
│   │   ├── LiveMarketData.tsx
│   │   ├── Pricing.tsx
│   │   ├── Testimonials.tsx
│   │   ├── FAQ.tsx
│   │   ├── CTABanner.tsx
│   │   └── Footer.tsx
│   │
│   ├── components/              # Reusable components
│   │   ├── ScoreVisualizer.tsx
│   │   ├── SignalBadge.tsx
│   │   ├── WeightCustomizer.tsx
│   │   ├── InvestorCard.tsx
│   │   ├── PortfolioBuilder.tsx
│   │   ├── LiveTicker.tsx
│   │   ├── SparklineChart.tsx
│   │   ├── PricingCard.tsx
│   │   ├── TestimonialCard.tsx
│   │   ├── MarketStatus.tsx
│   │   ├── StockDetailDrawer.tsx
│   │   ├── AnimatedCounter.tsx
│   │   ├── ScrollReveal.tsx
│   │   └── SectionWrapper.tsx
│   │
│   ├── hooks/                   # Custom React hooks
│   │   ├── useStockData.ts      # Fetch and manage stock data
│   │   ├── useScoring.ts        # Scoring system logic
│   │   ├── useCountUp.ts        # Animated counter
│   │   ├── useInViewAnimation.ts # Scroll detection
│   │   └── useLocalStorage.ts   # Persist user preferences
│   │
│   ├── lib/                     # Utilities and data
│   │   ├── utils.ts             # Helper functions
│   │   ├── stockData.ts         # Mock/live stock data
│   │   ├── scoringCriteria.ts   # Scoring system config
│   │   ├── investors.ts         # Famous investor data
│   │   └── animations.ts        # Animation variants
│   │
│   ├── types/                   # TypeScript types
│   │   ├── stock.ts
│   │   ├── scoring.ts
│   │   └── investor.ts
│   │
│   └── store/                   # State management (if needed)
│       └── appStore.ts
│
├── components/ui/               # shadcn/ui components
│   ├── accordion.tsx
│   ├── badge.tsx
│   ├── button.tsx
│   ├── card.tsx
│   ├── carousel.tsx
│   ├── checkbox.tsx
│   ├── dialog.tsx
│   ├── drawer.tsx
│   ├── input.tsx
│   ├── progress.tsx
│   ├── scroll-area.tsx
│   ├── select.tsx
│   ├── separator.tsx
│   ├── sheet.tsx
│   ├── slider.tsx
│   ├── sonner.tsx
│   ├── switch.tsx
│   ├── table.tsx
│   ├── tabs.tsx
│   └── tooltip.tsx
│
├── public/                      # Static assets
│   ├── images/
│   │   └── (generated images)
│   └── fonts/
│
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 5. Dependencies to Install

### Core (via init script)
- react
- react-dom
- next
- typescript
- tailwindcss
- @radix-ui/* (via shadcn)

### Animation
```bash
npm install framer-motion
```

### Charts
```bash
npm install recharts
```

### Data Table
```bash
npm install @tanstack/react-table
```

### Icons (included with shadcn)
- lucide-react

### Fonts
- Inter (Google Fonts via next/font)
- JetBrains Mono (Google Fonts via next/font)

### Utilities
```bash
npm install clsx tailwind-merge
```

---

## 6. Data Architecture

### Stock Data Structure
```typescript
interface Stock {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: number;
  peRatio: number;
  pbRatio: number;
  dividendYield: number;
  sector: string;
  score: number;
  signal: 'buy' | 'hold' | 'sell';
  sparklineData: number[];
}
```

### Scoring System Structure
```typescript
interface ScoringCriteria {
  id: string;
  name: string;
  description: string;
  weight: number; // 0-100
  metrics: Metric[];
}

interface Metric {
  id: string;
  name: string;
  value: number;
  maxValue: number;
  score: number; // 0-100
}
```

### Investor Profile Structure
```typescript
interface Investor {
  id: string;
  name: string;
  title: string;
  description: string;
  strategy: string;
  topHoldings: string[];
  image: string;
}
```

---

## 7. Key Implementation Notes

### Scoring System Algorithm
1. Each criterion has a weight (default sum = 100%)
2. Each criterion calculates a sub-score (0-100) based on metrics
3. Final score = Σ(criterionScore × criterionWeight) / 100
4. Signal determination:
   - Score ≥ 70: BUY
   - Score 40-69: HOLD
   - Score < 40: SELL

### Portfolio Mimicry Algorithm
1. User inputs budget
2. Select investor profile
3. Fetch investor's actual holdings (or predefined allocation)
4. Calculate proportional allocation based on budget
5. Generate buy list with quantities

### Real-time Data Strategy
- Use Yahoo Finance API for live data
- Poll every 30 seconds during market hours
- Cache data for 5 minutes to reduce API calls
- Show "Last updated" timestamp

### Performance Optimizations
- Use `React.memo` for stock list items
- Virtualize long lists with `react-window`
- Debounce search input (300ms)
- Lazy load sections below fold
- Use `will-change` sparingly on animated elements

---

## 8. Responsive Breakpoints

- **Mobile**: < 640px (sm)
- **Tablet**: 640px - 1024px (md, lg)
- **Desktop**: > 1024px (xl, 2xl)

### Key Responsive Changes
- Navbar: Hamburger menu on mobile
- Hero: Stack columns on mobile
- Stock Screener: Full-width table, collapsible filters
- Pricing: Stack cards on mobile
- Investor Cards: Horizontal scroll on all sizes
