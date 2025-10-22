# Zuperior Trading Terminal Design System

A comprehensive design system for building professional trading platforms. Built with **Next.js 15**, **React 19**, **Tailwind CSS v4**, **Framer Motion**, and **TradingView Lightweight Charts**.

## 🚀 Features

- **60+ Components**: Complete set of atomic, navigation, data display, form, trading-specific, and chart components
- **Zuperior Branding**: Consistent brand colors with purple/blue gradient identity
- **Dark Theme**: Optimized for trading terminals with professional dark color scheme
- **Animations**: Smooth micro-interactions with Framer Motion
- **Type-Safe**: Fully typed with TypeScript
- **Trading Charts**: Professional-grade charts using TradingView Lightweight Charts
- **Responsive**: Desktop-first design with mobile adaptations
- **Accessible**: ARIA labels and keyboard navigation support

## 📦 Tech Stack

- **Framework**: Next.js 15.5.5 (React 19.1.0)
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion 12.x
- **Charts**: Lightweight Charts 5.x
- **Icons**: Lucide React
- **Fonts**: Manrope (UI), JetBrains Mono (Numbers/Prices)
- **Package Manager**: Bun

## 🎨 Component Categories

### Atomic Components (15)
- Button (5 variants)
- Input (Text, Number, Search)
- Icon Button
- Toggle Switch
- Checkbox
- Radio Group
- Badge
- Spinner
- Slider
- Progress
- Label
- Divider
- Avatar
- Select

### Navigation Components (5)
- Header
- Sidebar
- Tabs
- Instrument Tabs
- Breadcrumb

### Data Display Components (8)
- Price Display (animated)
- Stats Panel
- Card
- Table
- List
- Flag Icon
- Chart Tooltip
- Account Info Card

### Form & Control Components (7)
- Number Stepper
- Search Input
- Filter Dropdown
- Range Slider
- Radio Group
- Color Picker
- Date Time Picker

### Trading-Specific Components (10)
- Order Panel (Buy/Sell)
- Position Card
- Price Ticker
- Instrument List Item
- Account Switcher
- Balance Display
- Economic Calendar Event
- Deposit Button
- P/L Indicator
- Leverage Badge

### Chart Components (10)
- Chart Container
- Drawing Toolbar
- Chart Toolbar
- Timeframe Selector
- Price Scale
- OHLC Display
- Position Marker
- Volume Bars
- Chart Grid
- Time Axis

### Overlay Components (5)
- Modal
- Dropdown Menu
- Popover
- Drawer
- Settings Panel

## 🎯 Design Tokens

### Colors

```css
/* Brand Colors */
--primary: 250 84% 60% /* Purple/Violet */

/* Trading Colors */
--success: 158 100% 38% /* #00c176 - Profit/Buy */
--danger: 4 100% 60% /* #ff3b30 - Loss/Sell */
--info: 211 100% 50% /* #007aff */
--warning: 48 100% 50% /* #ffd60a */

/* Background */
--background: 0 0% 4% /* #0a0a0a */
--background-800: 0 0% 10% /* #1a1a1a */
--background-700: 0 0% 16% /* #2a2a2a */

/* Border */
--border: 0 0% 18% /* #2d2d2d */
--border-darker: 0 0% 11% /* #1d1d1d */

/* Text */
--text-primary: 0 0% 100% /* #ffffff */
--text-secondary: 0 0% 63% /* #a0a0a0 */
--text-tertiary: 0 0% 42% /* #6b6b6b */
```

### Typography

- **UI Text**: Manrope (Google Fonts)
- **Numbers/Prices**: JetBrains Mono (Google Fonts)

## 🏃 Getting Started

### Installation

```bash
# Clone the repository
git clone <repository-url>

# Install dependencies
bun install

# Run development server
bun run dev
```

### View Design System

Navigate to `http://localhost:3000/design-system` to see all components in action.

## 📖 Usage Examples

### Button

```tsx
import { Button } from "@/components/ui/button"

<Button variant="primary">Trade Now</Button>
<Button variant="destructive">Sell</Button>
```

### Price Display

```tsx
import { PriceDisplay } from "@/components/data-display/price-display"

<PriceDisplay
  value={1.0850}
  previousValue={1.0848}
  precision={5}
  showAnimation={true}
/>
```

### Order Panel

```tsx
import { OrderPanel } from "@/components/trading/order-panel"

<OrderPanel
  symbol="EUR/USD"
  currentPrice={1.0850}
  onBuy={(data) => console.log("Buy:", data)}
  onSell={(data) => console.log("Sell:", data)}
/>
```

### Chart Container

```tsx
import { ChartContainer } from "@/components/chart/chart-container"

<ChartContainer
  symbol="EUR/USD"
  basePrice={1.0850}
/>
```

## 🎨 Design System Page

The `/design-system` page showcases:

1. **Color Palette**: All brand and trading colors
2. **Typography Scale**: Font families and sizes
3. **Atomic Components**: All base UI components
4. **Form Components**: Input controls for trading
5. **Data Display**: Price displays, stats, flags
6. **Trading Components**: Order panels, positions, tickers
7. **Navigation**: Headers, sidebars, tabs
8. **Chart Integration**: Full trading chart with toolbars

## 📁 Project Structure

```
.
├── app/
│   ├── design-system/
│   │   └── page.tsx              # Main showcase page
│   ├── globals.css               # Design tokens & styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page
├── components/
│   ├── ui/                       # Atomic components (shadcn base)
│   ├── navigation/               # Header, Sidebar, Tabs
│   ├── data-display/             # Tables, Lists, Cards
│   ├── forms/                    # Form controls
│   ├── overlays/                 # Modals, Drawers, Dropdowns
│   ├── trading/                  # Trading-specific components
│   ├── chart/                    # Chart components
│   └── design-system/            # Showcase utilities
├── lib/
│   ├── utils.ts                  # Utility functions
│   ├── animations.ts             # Framer Motion variants
│   └── chart-config.ts           # Chart configuration
├── components.json               # shadcn/ui config
├── tailwind.config.ts            # Tailwind configuration
└── package.json
```

## 🔧 Customization

### Add New Components

1. Create component in appropriate directory
2. Follow existing component patterns
3. Use Framer Motion for animations
4. Add to design system showcase page

### Modify Colors

Edit `app/globals.css` CSS variables:

```css
:root {
  --primary: 250 84% 60%;
  --success: 158 100% 38%;
  /* ... */
}
```

### Update Fonts

Modify `app/layout.tsx`:

```tsx
import { YourFont } from "next/font/google"

const yourFont = YourFont({
  variable: "--font-your-font",
  subsets: ["latin"],
})
```

## 🚀 Deployment

```bash
# Build for production
bun run build

# Start production server
bun run start
```

## 📝 License

© 2025 Zuperior. All rights reserved.

## 🤝 Contributing

Contributions are welcome! Please follow the existing code style and component patterns.

## 📧 Support

For issues and questions, please open an issue on GitHub.

---

**Built with ❤️ for traders by Zuperior**
