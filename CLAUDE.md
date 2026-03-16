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
