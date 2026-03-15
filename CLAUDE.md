# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Grip is an ultra-fast, modern drag/resize/gesture library designed as a high-performance alternative to interact.js. The library is framework-agnostic with optional React and Vue 3 integrations.

## Development Commands

Build and run the project:
```bash
pnpm dev          # Development build with watch mode
pnpm build        # Production build
pnpm demo         # Run the demo with Vite
```

Testing and quality checks:
```bash
pnpm test         # Run tests
pnpm test:coverage # Run tests with coverage report
pnpm bench        # Run benchmarks
pnpm typecheck    # Type checking without emit
pnpm lint         # ESLint check
```

Run a single test file:
```bash
pnpm test path/to/test.spec.ts
```

## Architecture

The codebase follows a modular, plugin-based architecture:

- **Core System** (`/src/core/`): Central interaction handling, event management, and base interactable functionality
- **Plugins** (`/src/plugins/`): Feature-specific modules (draggable, resizable, gesturable) that extend core functionality
- **Modifiers** (`/src/modifiers/`): Transform or constrain interactions (snap, restrict, inertia physics)
- **Framework Integrations** (`/src/integrations/`): React hooks and Vue 3 composables/directives
- **Type System** (`/src/types/`): Comprehensive TypeScript definitions for all public APIs

Key architectural patterns:
- Event-driven architecture with custom event dispatching
- Plugin registration system for extending functionality
- Modifier chain for processing interaction updates
- Unified pointer event handling for mouse/touch/pen
- RAF-based update loop for smooth animations

## Code Style

- No semicolons, single quotes, 120 character line width (Prettier enforced)
- TypeScript with strict mode enabled
- ES2020 target with modern JavaScript features
- Tree-shakeable exports using ES modules
- No external runtime dependencies

