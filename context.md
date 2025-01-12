## Goal

Build a production ready frontend for trading on a decentralised solana exchange.

## Tech Stack

- Framework: Vite React Typescript
- Styling: Tailwind CSS v4 Beta
  - Uses new CSS-first configuration approach
  - No tailwind.config.js needed
  - Theme customization via CSS variables in index.css
  - Native CSS cascade layers support
  - Built-in import support
  - Automatic source detection
- Data Fetch/Sync: React Query
- State Management: Jotai
  - URL-based market address handling
  - Global state atoms
  - Development tools integration
  - Dark theme devtools UI
- Notifications: Sonner
  - Custom themed toasts
  - Rich colors support
  - Type-safe notifications hook
  - Transaction-specific toasts
  - Explorer integration
- Environment: Zod
  - Runtime environment validation
  - Type-safe env variables
  - Detailed error messages
- Blockchain: Solana Web3.js
- UI Components: Shadcn UI

## Project Structure

```
src/
├── atoms/
│   └── market.ts           # Jotai atoms for market state
├── components/
│   ├── ConnectWallet.tsx  # Wallet connection button component
│   ├── JotaiDevTools.tsx  # Development-only state debugging tools
│   ├── ToastProvider.tsx  # Global toast notification provider
│   └── WalletDetails.tsx  # Displays wallet balance and address
├── contexts/
│   └── WalletContext.tsx  # Solana wallet provider and configuration
├── hooks/
│   └── useNotification.ts # Custom hook for toast notifications
├── utils/
│   ├── env.ts            # Environment validation and configuration
│   ├── explorer.ts       # Solana explorer URL utilities
│   └── market.ts         # Market address utilities and validation
├── index.css             # Tailwind CSS v4 imports and theme configuration
└── App.tsx               # Main application component
```

## Features Implemented

### Wallet Integration

- Multi-wallet support (Phantom, Solflare, Coinbase, Trust)
- Auto-connect functionality
- Devnet configuration (ready for mainnet switch)
- Wallet connection status display
- SOL balance display with auto-refresh (10s interval)
- Truncated wallet address display

### Market Handling

- URL-based market address (?market=xyz)
- Default market fallback
- Solana address validation
- Global market state with Jotai
- Automatic URL synchronization

### Development Tools

- Jotai DevTools integration
- Dark theme UI
- Production build exclusion
- Real-time state inspection
- Custom positioning

### Environment Configuration

- Runtime environment validation
- Type-safe environment variables
- Detailed error messages for missing/invalid vars
- Default values for optional variables
- Cluster-aware configuration
- Example environment file

### Notifications

- Global toast provider
- Dark theme integration
- Custom styled toasts
- Type-safe notification hook
- Multiple notification types (success, error, info, warning, loading)
- Configurable durations
- Transaction-specific toasts:
  - Multi-state handling (initiated, processing, confirmed, failed)
  - Automatic explorer links
  - Custom transaction names
  - Environment-aware URLs
  - Error message handling

### Styling Setup

- Tailwind CSS v4 Beta integration with Vite
- CSS-first configuration in index.css
- Native CSS variables for theming
- No JavaScript configuration needed

## Next Steps

- [ ] Setup theme customization in index.css
- [ ] Setup Shadcn UI components
- [ ] Implement trading interface
- [ ] Add Solana token integration
- [ ] Setup React Query for market data
- [x] Implement Jotai for global state management
