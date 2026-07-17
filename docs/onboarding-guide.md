# Developer Onboarding Guide

## First Day Checklist
1. Clone the repo: `git clone https://github.com/NovaCoreLabs1/NovaLabs.git`
2. Install deps: `npm install`
3. Copy env: `cp .env.example .env`
4. Run dev: `npm run dev`
5. Run tests: `npm test`

## Code Style
- TypeScript strict mode
- ESLint + Prettier
- Conventional commits

## PR Process
1. Create a branch from `main`
2. Make changes
3. Run `npm run lint` and `npm test`
4. Submit PR with description
5. Wait for review