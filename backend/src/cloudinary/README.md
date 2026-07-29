# `cloudinary/`

Image upload and transformation module via Cloudinary.

## Purpose

Handles profile picture uploads, workspace image management, and on-the-fly
image transformations (resize, crop, format conversion) via the Cloudinary API.

## Key Entities

- **CloudinaryService** — wraps the Cloudinary Node.js SDK for upload,
  deletion, and URL generation with dynamic transformations.

## Key Files

| File                   | Role                           |
| ---------------------- | ------------------------------ |
| `cloudinary.module.ts` | NestJS module registration     |
| `cloudinary.service.ts`| Cloudinary API integration     |
