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
- Blockchain: Solana Web3.js
- UI Components: Shadcn UI

## Project Structure

```
src/
├── components/
│   ├── ConnectWallet.tsx    # Wallet connection button component
│   └── WalletDetails.tsx    # Displays wallet balance and address
├── contexts/
│   └── WalletContext.tsx    # Solana wallet provider and configuration
├── index.css               # Tailwind CSS v4 imports and theme configuration
└── App.tsx                 # Main application component
```

## Features Implemented

### Wallet Integration

- Multi-wallet support (Phantom, Solflare, Coinbase, Trust)
- Auto-connect functionality
- Devnet configuration (ready for mainnet switch)
- Wallet connection status display
- SOL balance display with auto-refresh (10s interval)
- Truncated wallet address display

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
- [ ] Implement Jotai for global state management
