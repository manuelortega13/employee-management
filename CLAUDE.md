# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Employee management application built with Angular 21, using standalone components, signals, and Vitest for testing.

## Commands

- `npm start` / `ng serve` — dev server at localhost:4200
- `npm run build` / `ng build` — production build (output in `dist/`)
- `npm test` / `ng test` — run all tests (Vitest via `@angular/build:unit-test`)
- `ng generate component <name>` — scaffold a new component

## Architecture

- **Angular 21** with standalone components (no NgModules — components declare `imports` directly)
- **Signals** used for reactive state (e.g., `signal()` in components)
- **Routing** configured in `src/app/app.routes.ts`, provided via `provideRouter()` in `src/app/app.config.ts`
- **Styling**: Tailwind CSS v4 via PostCSS, imported in `src/styles.css`
- **Testing**: Vitest with `vitest/globals` types — test files use `*.spec.ts` convention
- **Strict TypeScript**: all strict flags enabled including `strictTemplates` in Angular compiler options

## Conventions

- Component selector prefix: `app`
- Prettier: 100 char print width, single quotes, Angular HTML parser
- Package manager: npm

## UI Rules

- **Never use `alert()`, `confirm()`, or `prompt()`.** They look out of place, can't be styled, block the JS thread, and behave differently across browsers. Always use the in-app `ConfirmService` (`src/app/shared/confirm.service.ts`) for confirmations:

  ```ts
  private readonly confirmService = inject(ConfirmService);

  const ok = await this.confirmService.ask({
    title: 'Release payroll?',
    message: 'This cannot be edited afterwards.',
    confirmText: 'Release',
    variant: 'primary', // or 'danger' for destructive actions
  });
  if (!ok) return;
  ```

  For informational messages, use a status banner on the page (existing `.alert-success` / `.alert-error` pattern) — not a popup.

## Git Rules

- **When asked to "commit and push" (or similar), do it on the CURRENT branch — including `main`.** Do NOT create a new branch unless explicitly told to. The default workflow here is committing straight to `main`. If you think a branch is warranted, ask first rather than acting.
