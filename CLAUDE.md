# Corelink AI Infrastructure — Claude Code Rules

## Design System

All UI in this repo uses the shared design system at `wooray2882/design-system`.

**Rules (never break these):**
- Never hardcode colors, spacing, radius, or typography — always use design tokens
- Always import `tokens/base.css` then `tokens/presets/sharp-professional.css`
- Use **Tremor** for all data components: charts, stat tiles, tables, badges
- Use **Lucide** for icons (already in the preset)
- Use `--font-family-display` (Outfit) for headings, `--font-family-body` (DM Sans) for body text

## Dashboard app (`app/dashboard/`)

- Stack: Vite + React 19 + TypeScript + Tailwind + Tremor
- Design preset: `sharp-professional` — navy brand, tight radius, flat shadows
- Components pull from `@tremor/react` — do not build chart or stat components from scratch
- Real-time data via WebSocket (`useAgentStream` hook in `src/hooks/`)

## Infrastructure (`modules/`, `environments/`)

- All AWS resources managed by Terraform
- Module pattern: one module per concern (`agent-heartbeat`, `agent-dashboard`)
- Agent tool permissions are IAM-enforced — each agent only gets policies for its declared `tools` list
- Never hardcode AWS account IDs in modules — use `data.aws_caller_identity.current`

## Deployment

- Terraform apply: GitHub Actions `terraform-apply.yml` (manual, requires typing "apply")
- Dashboard deploy: GitHub Actions `dashboard-deploy.yml` (manual, requires typing "deploy")
- Bootstrap must run before dev — creates the S3 backend and lock table
