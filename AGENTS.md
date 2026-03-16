# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

A React + TypeScript + Vite frontend for a Solana-based decentralized exchange (DEX). The application provides trading interfaces, vault management, and wallet integration for the Solana blockchain ecosystem.

## Commands

### Development

```bash
pnpm dev          # Start development server on port 4000
pnpm build        # Build for production
pnpm preview      # Preview production build
pnpm serve        # Serve on port 5500 with host
```

### Code Quality

```bash
pnpm lint         # Run ESLint
pnpm lint:fix     # Fix ESLint issues
pnpm format       # Format code with Prettier
pnpm typecheck    # TypeScript type checking
```

**Important**: Always run `pnpm lint` and `pnpm typecheck` after making changes to ensure code quality.

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

- Development server runs on port 4000
- Uses TypeScript strict mode
- Radix UI components are pre-configured in `src/shared/ui/`
- Trading charts use Lightweight Charts library
- All Solana wallet adapters are configured in app providers
- Environment variables should be prefixed with `VITE_`
