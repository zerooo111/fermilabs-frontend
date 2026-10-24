# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A React + TypeScript + Vite frontend for a Solana-based decentralized exchange (DEX). The application provides trading interfaces, vault management, and wallet integration for the Solana blockchain ecosystem.

## Commands

### Development

```bash
pnpm dev          # Start development server on port 8070
pnpm build        # Build for production
pnpm preview      # Preview production build
pnpm serve        # Serve on port 5500 with host
```

### Code Quality

```bash
pnpm lint         # Run ESLint
pnpm lint:fix     # Fix ESLint issues
pnpm format       # Format code with Prettier
pnpm typecheck    # Type-check the app; fails only on errors not in typecheck-baseline.json
pnpm test         # Unit tests (vitest, src/**/*.test.ts)
```

**Important**: Always run `pnpm lint`, `pnpm typecheck` and `pnpm test` after making changes. `pnpm typecheck` lists the known baseline errors; when you fix some, run `node scripts/typecheck.mjs --update`.

## Architecture

The project follows **Feature Slice Design (FSD)** architecture:

- `src/app/` - Application-wide setup (providers, router configuration)
- `src/entities/` - Business entities (market, orderbook, wallet, server)
- `src/features/` - Feature modules (chart, order-placement, vault-deposit, etc.)
- `src/pages/` - Page components (trade, vault)
- `src/shared/` - Shared utilities, UI components, API clients

Path alias `@/*` maps to `./src/*` in imports.

## Key Technologies

- **React 18.3.1** with TypeScript
- **Vite 6.0.5** with SWC for fast refresh
- **TailwindCSS 4.0.14** for styling
- **Solana Web3.js** and Anchor framework for blockchain integration
- **Jotai** for atomic state management
- **TanStack Query** for server state management
- **Radix UI** components for accessible UI primitives

## Package Manager

Uses **PNPM** - always use `pnpm` commands, not `npm` or `yarn`.

## Development Notes

- Development server runs on port 8070 (the gateway's CORS allowlist only accepts that port)
- Uses TypeScript strict mode
- Radix UI components are pre-configured in `src/shared/ui/`
- Vaults: `features/vaults` (pages under `/vaults`) and `features/flp-vault` (FLP data, transactions, vendored SDK). Read their README.md first; `pnpm flp:sync` checks FLP against the protocol's deployment manifest. `features/vault-deposit` (`/vault`) is the older, unrelated `fermi_vault` program.
- The perps chart is CandleFrame (vendored tarball in `vendor/`, built from github.com/adarshzpatel/candleframe); see `src/features/chart/ui/CandleFrameChart.tsx`
- All Solana wallet adapters are configured in app providers
- Environment variables should be prefixed with `VITE_`
