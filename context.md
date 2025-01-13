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
- Data Fetch/Sync: TanStack React Query v5
  - Global query client configuration
  - Development tools integration
  - Optimized caching and refetching
  - Type-safe queries and mutations
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
│   ├── market.ts           # Jotai atoms for market state
│   └── fermiClient.ts      # Global fermi client state
├── components/
│   ├── ConnectWallet.tsx  # Wallet connection button component
│   ├── ToastProvider.tsx  # Global toast notification provider
│   ├── ErrorPage.tsx      # Error display component
│   └── WalletDetails.tsx  # Displays wallet balance and address
├── contexts/
│   ├── WalletContext.tsx  # Solana wallet provider and configuration
│   └── QueryProvider.tsx  # React Query provider with devtools
├── hooks/
│   ├── useNotification.ts # Custom hook for toast notifications
│   ├── useBids.ts        # Hook for orderbook bids data
│   ├── useAsks.ts        # Hook for orderbook asks data
│   ├── useEventHeap.ts   # Hook for event heap data
│
├── solana/
│   ├── fermiClient.ts    # Solana client implementation
│   ├── parsers.ts        # Account data parsing utilities
│   ├── constants.ts      # Solana-related constants
│   └── utils/
│       ├── rpc.ts        # RPC utility functions
│       └── helpers.ts    # General Solana helpers
├── utils/
│   ├── env.ts           # Environment validation and configuration
│   ├── explorer.ts      # Solana explorer URL utilities
│   └── market.ts        # Market address utilities and validation
├── index.css            # Tailwind CSS v4 imports and theme configuration
└── App.tsx             # Main application component
```

### Development Environment

- Vite development server:
  - Port 3000
  - Host mode enabled
  - Path aliases (@/ for src directory)
  - Node polyfills integration
  - SWC for fast refresh

### Data Fetching Setup

- TanStack React Query v5 integration
- Global query client configuration:
  - 1-minute stale time
  - 5-minute garbage collection
  - 2 retries on failure
  - Window focus refetching enabled
- Development tools with query explorer
- Production-optimized builds (devtools excluded)
- Modular market data hooks:
  - Individual hooks for bids, asks, and event heap
  - Conditional fetching based on client/market availability
  - Optimized refetch intervals:
    - Orderbook (bids/asks): 10 seconds
    - Event heap: 1 second
  - Type-safe query responses with error handling
  - Enhanced orderbook parsing:
    - Price and quantity parsing
    - Timestamp tracking
    - Client order ID support
  - Combined hook for full market data
  - Optimized for component-level data requirements

### Code Organization

- Modular hook structure:
  - Separate files for each data type
  - Clear separation of concerns
  - Improved maintainability
  - Better code splitting
- Enhanced type safety:
  - Full TypeScript integration
  - Proper error handling
  - Null safety checks
  - Type-safe parsers
- Clean logging:
  - Removed debug console logs
  - Production-ready error handling
  - Clear error messages

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
