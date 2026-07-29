# `contact/`

Public contact form and inquiry management module.

## Purpose

Accepts contact form submissions from the public website, persists them,
sends confirmation emails to the submitter, and notifies administrators.

## Key Entities

- **ContactMessage** (`entities/contact-message.entity.ts`) — a contact form
  submission with name, email, subject, message body, and read status.

## Endpoints

| Method | Path       | Auth   | Description                  |
| ------ | ---------- | ------ | ---------------------------- |
| POST   | `/contact` | Public | Submit contact form          |
| GET    | `/contact` | Admin  | List all contact messages    |

## Key Files

| File                               | Role                           |
| ---------------------------------- | ------------------------------ |
| `contact.module.ts`                 | NestJS module registration     |
| `contact.controller.ts`            | HTTP endpoints                 |
| `contact.service.ts`               | Orchestration layer            |
| `entities/contact-message.entity.ts`| TypeORM entity                 |
| `dto/submit-contact.dto.ts`        | Form validation DTO            |
