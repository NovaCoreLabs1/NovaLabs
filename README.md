<div align="center">

# 🏢 NovaLabs

**The Modern Coworking & Workspace Management Platform**

NovaLabs is a full-stack platform built to power the next generation of coworking spaces, tech hubs, and shared workspaces. From biometric attendance to smart invoicing and team management — everything your workspace needs, in one place.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-novalabs.vercel.app-black?style=for-the-badge&logo=vercel)](https://novalabs.vercel.app/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![Contributors](https://img.shields.io/badge/Contributors-96%2B-brightgreen?style=for-the-badge)](https://github.com/NovaCoreLabs1/NovaLabs/graphs/contributors)
[![Contracts](https://img.shields.io/codecov/c/github/NovaCoreLabs1/NovaLabs?flag=contracts&label=Contracts&logo=codecov&style=for-the-badge)](https://codecov.io/gh/NovaCoreLabs1/NovaLabs)
[![Backend](https://img.shields.io/codecov/c/github/NovaCoreLabs1/NovaLabs?flag=backend&label=Backend&logo=codecov&style=for-the-badge)](https://codecov.io/gh/NovaCoreLabs1/NovaLabs)

</div>

---

## Table of Contents

1. [About](#about)
2. [Key Features](#key-features)
3. [Tech Stack](#tech-stack)
4. [Getting Started](#getting-started)
   - [Prerequisites](#prerequisites)
   - [Installation](#installation)
   - [Environment Variables](#environment-variables)
5. [Usage](#usage)
6. [Project Structure](#project-structure)
7. [Contributing](#contributing)
8. [Roadmap](#roadmap)
9. [License](#license)
10. [Acknowledgements](#acknowledgements)

---

## About

NovaLabs is built to handle the full operational lifecycle of a modern coworking space — from member onboarding to daily attendance tracking, workspace booking, invoicing, and administrative oversight.

The platform is **modular**, **scalable**, and designed with enterprise-grade real-world needs in mind. Whether you're running a single coworking floor or a network of tech hubs across multiple cities, NovaLabs grows with you.

🌐 **Live Demo:** [https://novalabs.vercel.app](https://novalabs.vercel.app)

---

## Key Features

| Feature | Description |
|---|---|
| 🔐 **Biometric Authentication** | Fingerprint-based clock-in/clock-out for members and staff |
| 👥 **User & Role Management** | Fine-grained account roles, permissions, and team structures |
| 🪑 **Workspace & Seat Tracking** | Real-time monitoring of workspace occupancy and resource usage |
| 📊 **Analytics & Attendance Logs** | Rich dashboards with attendance history and activity reports |
| 🧾 **Invoicing & Payments** | Automated invoice generation and payment notifications |
| 📧 **Smart Email Notifications** | Branded transactional emails for bookings, payments, and alerts |
| 🔒 **2FA & OTP Security** | Two-factor authentication and OTP verification flows |
| 🧩 **Modular Architecture** | Clean, extensible codebase — easy to customize and scale |
| ⛓️ **Blockchain Integration** | Rust & Stellar smart contracts for on-chain operations |
| 📰 **Newsletter Management** | Built-in newsletter subscription and confirmation flows |

---

## Tech Stack

NovaLabs uses a modern, production-grade full-stack technology stack:

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14, React, Tailwind CSS |
| **Backend** | NestJS, Node.js |
| **Database** | PostgreSQL |
| **Auth** | JWT, TOTP (2FA), Biometric |
| **Blockchain / Contracts** | Rust, Stellar |
| **Email** | Transactional email templates (HTML) |
| **Deployment** | Vercel (Frontend), Node server (Backend) |
| **CI/CD** | GitHub Actions |

> **Why NestJS + Next.js?** NestJS handles complex business logic, auth flows, and multi-client API needs with a structured, maintainable architecture — something Next.js API routes alone aren't optimized for at scale. This combination gives NovaLabs both a great developer experience and a solid production foundation.

---

## Getting Started

Follow these steps to run NovaLabs locally for development or testing.

### Prerequisites

Make sure you have the following installed:

- **Node.js** ≥ 18.x
- **npm** or **yarn**
- **PostgreSQL** database (local or hosted)
- **Rust toolchain** (only needed for building `contracts/`)

---

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/NovaCoreLabs1/NovaLabs.git
cd NovaLabs
```

**2. Install dependencies**

```bash
# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

---

### Environment Variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Key variables to configure:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for JWT signing |
| `TOTP_ISSUER` | Issuer name for 2FA (e.g. `NovaLabs`) |
| `SMTP_*` | SMTP credentials for transactional emails |
| `FRONTEND_URL` | Base URL of the frontend app |

Refer to `.env.example` for the full list of required variables.

---

## Usage

**Start the backend (development mode):**

```bash
cd backend
npm run start:dev
```

**Start the frontend (development mode):**

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The backend API runs on [http://localhost:3001](http://localhost:3001) by default.

---

## Project Structure

```plaintext
NovaLabs/
├── backend/                # NestJS backend API
│   ├── src/
│   │   ├── auth/           # Authentication & 2FA modules
│   │   ├── users/          # User management
│   │   ├── bookings/       # Workspace booking logic
│   │   ├── invoices/       # Invoice generation
│   │   ├── email/          # Email templates & services
│   │   └── ...
├── frontend/               # Next.js client application
│   ├── app/                # App router pages & layouts
│   ├── components/         # Reusable UI components
│   ├── lib/                # Utilities, SEO helpers, etc.
│   └── ...
├── contracts/              # Rust & Stellar smart contracts
├── .github/                # CI/CD workflows (GitHub Actions)
└── README.md
```

- **`backend/`** — Controllers, services, modules, guards, and database entities (NestJS).
- **`frontend/`** — Pages, layouts, auth flows, dashboard UI, and API integrations (Next.js).
- **`contracts/`** — On-chain logic compiled to WASM using Rust and Stellar SDK.

---

## Contributing

Contributions are welcome! Whether it's a bug fix, new feature, documentation improvement, or test coverage — every bit helps.

**How to contribute:**

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes and commit: `git commit -m "feat: describe your change"`
4. Push to your fork: `git push origin feature/your-feature-name`
5. Open a Pull Request against `main`

Please follow the existing code style, naming conventions, and module architecture when contributing. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full checklist, and the [PostgreSQL data model](backend/docs/data-model.md) if your change touches any entity, migration, or schema.

---

## Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Multi-hub / multi-location support
- [ ] Public API for third-party integrations
- [ ] Webhook support for payment providers
- [ ] Dark mode UI
- [ ] Offline biometric fallback support

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

## Acknowledgements

NovaLabs is built and maintained by a growing community of contributors.

A huge thank you to all **96+ contributors** who have helped design, build, test, and ship this platform. Your work powers real workspaces and real people every day. 🙌

---

<div align="center">

Built with ❤️ by the **NovaLabs Team** · [novalabs.vercel.app](https://novalabs.vercel.app)

</div>
