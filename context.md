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
- Animations: Framer Motion
  - Smooth component transitions
  - Spring physics animations
  - Gesture-based interactions
  - AnimatePresence for exit animations

## Project Structure

```
src/
├── atoms/
│   ├── market.ts           # Jotai atoms for market state
│   └── fermiClient.ts      # Global fermi client state
├── components/
│   ├── ConnectWallet.tsx   # Wallet connection button component
│   ├── ToastProvider.tsx   # Global toast notification provider
│   ├── ErrorPage.tsx       # Error display component
│   ├── WalletDetails.tsx   # Displays wallet balance and address
│   ├── Orderbook.tsx       # Real-time orderbook display
│   ├── TradePanel.tsx      # Trading interface component
│   ├── OpenOrdersTable/    # Open orders management
│   │   ├── index.tsx       # Main table component
│   │   └── columns.tsx     # Column definitions
│   └── ui/                 # Shadcn UI components
├── contexts/
│   ├── WalletContext.tsx   # Solana wallet provider and configuration
│   └── QueryProvider.tsx   # React Query provider with devtools
├── hooks/
│   ├── useNotification.ts  # Custom hook for toast notifications
│   ├── useBids.ts         # Hook for orderbook bids data
│   ├── useAsks.ts         # Hook for orderbook asks data
│   ├── useEventHeap.ts    # Hook for event heap data
│   └── useMarket.ts       # Market management and navigation
├── solana/
│   ├── fermiClient.ts     # Solana client implementation
│   ├── parsers.ts         # Account data parsing utilities
│   ├── constants.ts       # Solana-related constants
│   └── utils/
│       ├── rpc.ts         # RPC utility functions
│       └── helpers.ts     # General Solana helpers
├── utils/
│   ├── env.ts            # Environment validation and configuration
│   ├── explorer.ts       # Solana explorer URL utilities
│   └── market.ts         # Market address utilities and validation
├── index.css             # Tailwind CSS v4 imports and theme configuration
└── App.tsx              # Main application component
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
- Enhanced wallet connection UI:
  - Clean dropdown menu for wallet actions
  - Copy address functionality with feedback
  - Wallet switching support
  - Disconnect option
  - Visual connection status indicator
  - Truncated address display
- SOL balance display with auto-refresh (10s interval)
- Test token airdrop functionality:
  - Support for both base and quote tokens
  - Amount customization
  - Visual feedback during airdrop
  - Error handling
  - Success notifications
  - Popover-based UI
  - Token mint address display

### Market Management

- URL-based market navigation (?market=xyz)
- Default market fallback
- Market switching functionality
- Automatic URL synchronization
- Market account deserialization
- Error handling and recovery
- Loading states

### Trading Interface

- Real-time orderbook display
- Trade panel for order placement
- Open orders management:
  - Paginated orders table
  - Order cancellation
  - Order finalization
  - Animated transitions
  - Responsive design

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

### Styling and Animations

- Tailwind CSS v4 Beta integration
- CSS-first configuration
- Native CSS variables for theming
- Framer Motion animations:
  - Smooth component transitions
  - Spring physics for natural feel
  - Gesture-based interactions
  - Exit animations with AnimatePresence
  - Staggered animations for lists
  - Hover and tap effects

### Fermi Client Integration

- Global client provider architecture:
  - Centralized client initialization
  - Automatic wallet connection handling
  - Fallback to empty wallet when disconnected
  - Devnet RPC configuration
  - Program ID integration
  - Loading state management
- Client state management:
  - Jotai atom for global access
  - Reactive wallet updates
  - Clean unmount handling
  - Type-safe client instance
- Provider features:
  - Blocks child rendering until client is ready
  - Graceful loading states
  - Error boundary protection
  - Connection status monitoring
  - Debug logging in development
- Connection management:
  - Automatic RPC endpoint configuration
  - AnchorProvider integration
  - Default options handling
  - Wallet adapter compatibility
  - Connection persistence

### UI Components

- Custom Button component:
  - Loading state support
  - Multiple variants (default, outline, ghost)
  - Size variations
  - Icon support
  - Disabled state handling
- Popover component:
  - Radix UI integration
  - Custom styling
  - Card-like appearance
  - Flexible positioning
- DropdownMenu component:
  - Accessible menu items
  - Icon support
  - Custom styling
  - Hover states
- Input component:
  - Number formatting support
  - Validation
  - Custom styling
  - Error state handling

## Next Steps

- [ ] Implement market pair selection
- [ ] Add trade history view
- [ ] Implement order book depth visualization
- [ ] Add price charts integration
- [ ] Implement token balance display
- [ ] Add order type selection (limit, market, etc.)
- [ ] Implement order size presets
- [ ] Add market statistics panel
