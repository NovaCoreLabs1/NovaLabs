# NovaLabs — Backend

The backend API for [NovaLabs](https://github.com/NovaCoreLabs1/NovaLabs), a comprehensive coworking and workspace management system. Built with [NestJS](https://nestjs.com/) and TypeScript.

---

## Getting Started

### Prerequisites

- Node.js ≥ 18.x
- PostgreSQL database
- Redis (for Bull queue and caching)

### Installation

```bash
npm install
```

### Compile and Run

```bash
# development (watch mode)
npm run start:dev

# debug mode
npm run start:debug

# production
npm run start:prod
```

### Run Tests

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e

# test coverage
npm run test:cov
```

---

## Environment Variables

Copy the example file and configure your variables:

```bash
cp .env.example .env
```

Key variables:

| Variable           | Description                              |
| ------------------ | ---------------------------------------- |
| `PORT`             | Server port (default: 6000)              |
| `DATABASE_*`       | PostgreSQL connection config             |
| `JWT_SECRET`       | JWT signing secret                       |
| `SMTP_*`           | Email / SMTP configuration               |
| `CLOUDINARY_*`     | Cloudinary image upload config           |
| `REDIS_*`          | Redis connection config (Bull queues)    |
| `COMPANY_NAME`     | Company name used in emails              |
| `FRONTEND_URL`     | Frontend base URL for email links        |

---

## Tech Stack

- **Framework**: NestJS 10
- **Language**: TypeScript
- **Database**: PostgreSQL via TypeORM
- **Queue**: Bull (Redis-backed)
- **Authentication**: Passport.js — JWT + Local strategies
- **Email**: Nodemailer + Handlebars templates
- **File Uploads**: Cloudinary
- **Validation**: class-validator + class-transformer
- **API Docs**: Swagger / OpenAPI (`/swagger`)
- **Blockchain**: Stellar Soroban SDK

---

## API Documentation

Once the server is running, visit:

```
http://localhost:6000/swagger
```

---

## Project Structure

```plaintext
backend/
├── src/
│   ├── auth/               # Authentication (JWT, OTP, 2FA)
│   ├── users/              # User management
│   ├── workspaces/         # Workspace management
│   ├── bookings/           # Booking management
│   ├── payments/           # Payment processing
│   ├── invoices/           # Invoice generation
│   ├── email/              # Email service + Handlebars templates
│   ├── notifications/      # Real-time notifications (WebSocket)
│   ├── dashboard/          # Dashboard analytics
│   ├── contact/            # Contact form handling
│   ├── newsletter/         # Newsletter subscriptions
│   ├── cloudinary/         # File upload service
│   ├── workspace-tracking/ # Biometric check-in/check-out
│   ├── config/             # App configuration
│   ├── common/             # Shared middlewares, transformers
│   └── utils/              # Shared utilities
└── .env.example
```

---

## Migrations

```bash
# Run pending migrations
npm run typeorm:run-migrations

# Generate a new migration
npm run typeorm:generate-migration --name=MigrationName

# Create a blank migration
npm run typeorm:create-migration --name=MigrationName

# Revert the last migration
npm run typeorm:revert-migration
```

---

## Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [TypeORM Documentation](https://typeorm.io)
- [Stellar / Soroban SDK](https://developers.stellar.org)

---

## Data Model

See [docs/data-model.md](./docs/data-model.md) for the full PostgreSQL entity-relationship diagram,
table definitions, indexes, and relationship documentation.

---

## License

[MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE)
