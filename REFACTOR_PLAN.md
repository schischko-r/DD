# Gravity UI Refactor Plan

## Goal

Make the Gravity UI codebase easier and safer to change while preserving its current behavior, calculations, data contract, content, and visual design.

## Context

The current React application is concentrated in `gravity-app/src/main.jsx`, while `build_calc_report.py` is the most stable and feature-complete module in the project. The Python core is therefore frozen for this refactor. The first implementation phase focuses on mechanically separating the Gravity UI and making equivalent interface elements consistent across every page.

## Process Overview

1. Capture the current build and behavioral baseline.
2. Define stable frontend module boundaries around the existing JSON contract.
3. Extract domain selectors and formatting helpers without changing behavior.
4. Extract pages and feature components from `main.jsx` without redesigning them.
5. Introduce shared semantic button roles using Gravity UI components.
6. Add focused tests and validate build and behavioral parity.
7. Review and publish the phase as a scoped change.

## Detailed Steps

### Step 1: Freeze the Baseline

**What happens:** Record the current source and generated-output state, run the existing frontend build, and identify stable user flows and data selectors.
**Input:** Current `refactor/project-wide` branch and existing `gravity-app` source.
**Output:** A reproducible baseline for comparison after extraction.
**Decisions:** Generated artifacts are not regenerated unless a validation step explicitly requires it.
**Owner:** Codex/Ponytail.
**Notes:** `build_calc_report.py` must remain byte-for-byte unchanged.

### Step 2: Establish Module Boundaries

**What happens:** Create directories for app shell, pages, domain helpers, feature components, and shared UI primitives.
**Input:** Responsibilities currently mixed in `main.jsx`.
**Output:** A module map with explicit imports and no circular dependencies.
**Decisions:** Remain on JavaScript/JSX; use JSDoc only where the report-data contract benefits from documentation.
**Owner:** Codex/Ponytail.
**Notes:** The existing `report-data.json` shape remains the runtime boundary.

### Step 3: Extract Pure Logic

**What happens:** Move selectors, formatters, constants, and other pure functions out of `main.jsx` first.
**Input:** Existing helper functions and constants.
**Output:** Independently testable domain modules with unchanged results.
**Decisions:** No renaming of data fields or semantic changes during extraction.
**Owner:** Codex/Ponytail.
**Notes:** Pure logic moves before UI components to keep diffs reviewable.

### Step 4: Extract Pages and Features

**What happens:** Move the dashboard, summary, team profile, Data Driven information page, dialogs, and reusable feature blocks into focused modules.
**Input:** Remaining React components in `main.jsx`.
**Output:** A small entry point and clearly owned page/feature modules.
**Decisions:** Preserve current copy, navigation, DOM behavior, Gravity UI components, and CSS class names.
**Owner:** Ponytail, reviewed by Codex.
**Notes:** This phase is mechanical refactoring, not a redesign.

### Step 5: Standardize Semantic Buttons

**What happens:** Add shared wrappers or configuration for five roles: primary action, secondary action, navigation, destructive action, and compact icon-only action.
**Input:** Existing button usages across all pages.
**Output:** Equivalent actions share the same Gravity UI variant, size, spacing, and states.
**Decisions:** Visual differences remain only when they communicate a different semantic role.
**Owner:** Ponytail, reviewed by Codex.
**Notes:** Button text alone never determines styling.

### Step 6: Add Safety Tests and Validate

**What happens:** Add Vitest and Testing Library coverage for pure selectors, view switching, data loading, and shared button roles; run the production build and parity checks.
**Input:** Refactored modules and current report-data fixture.
**Output:** Passing tests and a successful Vite build with no intentional UI or data changes.
**Decisions:** Avoid broad snapshot tests; test behavior and stable semantic output.
**Owner:** Codex/Ponytail.
**Notes:** Existing Python tests remain required, but the frozen Python core is not edited.

### Step 7: Review and Publish

**What happens:** Inspect the entire diff, confirm generated and user-owned files are untouched, then commit the scoped phase.
**Input:** Validated frontend refactor.
**Output:** One reviewable refactor commit on `refactor/project-wide`.
**Decisions:** Push only after explicit user instruction or an already agreed publishing step.
**Owner:** Codex.
**Notes:** Existing untracked logs, workbooks, and PDF files remain outside the commit.

## Edge Cases and Failure Modes

- If module extraction changes rendered behavior, revert the affected extraction and reduce its scope.
- If equivalent-looking buttons have different semantics, keep separate roles and document the distinction.
- If a build regenerates large tracked artifacts, review and exclude them unless they are intentionally part of this phase.
- If the frontend relies on an implicit JSON fallback, preserve it and cover it with a focused test before cleanup.
- If new dependencies introduce version conflicts, prefer the smallest compatible test setup and do not upgrade unrelated production packages.
- If validation reveals an issue inside `build_calc_report.py`, document it separately; do not fix it in this refactor.

## Dependencies and Requirements

- Node.js and the existing `gravity-app` dependencies.
- Vitest, Testing Library, and a DOM test environment for focused frontend tests.
- The checked-in `gravity-app/public/report-data.json` fixture.
- Existing Python test environment for regression verification.

## Open Questions

None for the first implementation phase. JavaScript/JSX, frozen Python core, no redesign, and semantic button roles are agreed defaults.

## Success Criteria

- `build_calc_report.py` is unchanged.
- `main.jsx` becomes a small application entry point rather than the full application.
- Pages, domain logic, and shared UI elements have clear module ownership.
- Semantically equivalent buttons use the same shared role across every page.
- Existing text, data behavior, navigation, and visual design remain intact.
- Frontend tests and the production build pass.
- No unrelated logs, spreadsheets, PDFs, or generated artifacts enter the commit.
