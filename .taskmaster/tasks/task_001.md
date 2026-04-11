# Task ID: 1

**Title:** Install Missing Dependencies and Configure Project

**Status:** pending

**Dependencies:** None

**Priority:** high

**Description:** Install all dependencies needed for Phase 1 that aren't in the current package.json: next-intl, framer-motion, recharts, date-fns, @anthropic-ai/sdk, and an Arabic font. Update tsconfig and next.config as needed.

**Details:**

Install:
- next-intl (i18n framework)
- framer-motion (animations)
- recharts (financial charts)
- date-fns (date manipulation)
- @anthropic-ai/sdk (Claude API)
- @fontsource/noto-sans-arabic or load via next/font
- @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, @radix-ui/react-tabs, @radix-ui/react-toast, @radix-ui/react-select (UI primitives)
- react-dropzone (file upload)

Update next.config.ts for next-intl plugin. Add path aliases if not set.

**Test Strategy:**

npm run build succeeds with no errors. All imports resolve.
