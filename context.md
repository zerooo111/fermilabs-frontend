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
│   └── WalletDetails.tsx  # Displays wallet balance and address
├── contexts/
│   └── WalletContext.tsx  # Solana wallet provider and configuration
├── utils/
│   └── market.ts          # Market address utilities and validation
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
