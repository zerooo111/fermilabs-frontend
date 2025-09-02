# Feature Slice Architecture

This project has been reorganized according to the Feature Slice Design (FSD) pattern. This README explains the new structure and how to work with it.

## Directory Structure

```
src/
├── app/                  # Application-wide setup and configuration
│   ├── providers/        # All providers wrapped in a single component
│   ├── router/           # Router configuration
│   ├── styles/           # Global styles
│   └── index.ts          # Entry point
├── entities/             # Business entities (domain models)
│   ├── market/           # Market entity
│   ├── orderbook/        # Orderbook entity
│   ├── token/            # Token entity
│   ├── wallet/           # Wallet entity
│   └── server/           # Server entity
├── features/             # Feature modules
│   ├── market-selector/  # Market selection feature
│   ├── order-placement/  # Order placement feature
│   ├── orderbook-view/   # Orderbook viewing feature
│   ├── chart/            # Chart feature
│   ├── vault-deposit/    # Vault deposit feature
│   ├── vault-withdraw/   # Vault withdrawal feature
│   ├── wallet-connect/   # Wallet connection feature
│   └── server-selector/  # Server selection feature
├── pages/                # Page components that compose features
│   ├── trade/            # Trade page
│   ├── vault/            # Vault page
├── shared/               # Shared utilities, UI components, etc.
│   ├── api/              # API clients and utilities
│   ├── config/           # Configuration constants
│   ├── lib/              # Utility functions
│   └── ui/               # UI components
└── main.tsx              # Application entry point
```

## Migration Progress

The migration to the Feature Slice Architecture is in progress. Here's what has been done so far:

- ✅ Created the core directory structure
- ✅ Moved application providers to `app/providers`
- ✅ Moved router configuration to `app/router`
- ✅ Created entity models for market, orderbook, token, wallet, and server
- ✅ Created feature modules for market-selector, orderbook-view, wallet-connect, and server-selector
- ✅ Created feature modules for chart, order-placement, and vault-deposit
- ✅ Moved UI components to `shared/ui`
- ✅ Moved utility functions to `shared/lib`
- ✅ Moved constants to `shared/config`
- ✅ Moved API clients to `shared/api`
- ✅ Created page components for trade and vault

Still to be done:

- ✅ Update imports in all files to reflect the new structure
- ✅ Fix import issues and optimize exports
- ⬜ Test the application to ensure everything works as expected
- ✅ Remove the old files once the new structure works correctly

## Layers

### App Layer

The `app` layer contains application-wide setup and configuration:

- `providers/`: All context providers wrapped in a single component
- `router/`: Router configuration
- `styles/`: Global styles
- `index.ts`: Entry point that exports the main App component

### Entities Layer

The `entities` layer contains business entities (domain models):

- `market/`: Market entity with state and operations
- `orderbook/`: Orderbook entity with state and operations
- `token/`: Token entity with state and operations
- `wallet/`: Wallet entity with state and operations

Each entity has its own model, state, and operations.

### Features Layer

The `features` layer contains feature modules:

- `market-selector/`: Market selection feature
- `order-placement/`: Order placement feature
- `orderbook-view/`: Orderbook viewing feature
- `chart/`: Chart feature
- `vault-deposit/`: Vault deposit feature
- `vault-withdraw/`: Vault withdrawal feature

Each feature is self-contained and includes its own UI components, hooks, and state.

### Pages Layer

The `pages` layer contains page components that compose features:

- `trade/`: Trade page
- `vault/`: Vault page

Pages are responsible for composing features and handling page-specific logic.

### Shared Layer

The `shared` layer contains shared utilities, UI components, etc.:

- `api/`: API clients and utilities
- `config/`: Configuration constants
- `lib/`: Utility functions
- `ui/`: UI components

## Working with the Feature Slice Architecture

### Adding a New Feature

1. Create a new directory in the `features/` directory
2. Create the necessary UI components, hooks, and state
3. Export the feature through an `index.ts` file
4. Import and use the feature in a page component

### Adding a New Entity

1. Create a new directory in the `entities/` directory
2. Define the entity model, state, and operations
3. Export the entity through an `index.ts` file
4. Import and use the entity in features or pages

### Adding a New Page

1. Create a new directory in the `pages/` directory
2. Compose features to create the page
3. Add the page to the router configuration in `app/router/index.tsx`

## Benefits of Feature Slice Architecture

- **Modularity**: Features are isolated, making it easier to develop, test, and maintain them individually
- **Scalability**: Scalability is simplified as features can be added or removed with minimal impact on the rest of the application
- **Collaboration**: Teams can work concurrently on different features without stepping on each other's toes
- **Readability**: The codebase becomes more readable and easier to navigate
