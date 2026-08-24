import { MigrationInterface, QueryRunner } from 'typeorm';

export class BaselineSchema17356896000001787522225542 implements MigrationInterface {
  name = 'BaselineSchema17356896000001787522225542';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "hubs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(150) NOT NULL, "slug" character varying(100) NOT NULL, "description" text, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_8463c24a70afaca27e546d9314a" UNIQUE ("name"), CONSTRAINT "UQ_2fdd263d5ee41b0eb11bbcab8fe" UNIQUE ("slug"), CONSTRAINT "PK_44b53d1f2b4568b26ce4710b843" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."workspaces_type_enum" AS ENUM('HotDesk', 'DedicatedDesk', 'PrivateOffice', 'MeetingRoom', 'Virtual', 'Hybrid')`,
    );
    await queryRunner.query(
      `CREATE TABLE "workspaces" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "type" "public"."workspaces_type_enum" NOT NULL, "totalSeats" integer NOT NULL DEFAULT '1', "hourlyRate" bigint NOT NULL, "description" text, "amenities" text, "images" text, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "hubId" uuid, CONSTRAINT "PK_098656ae401f3e1a4586f47fd8e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9c71b88b85e57e43d29c987a5f" ON "workspaces" ("hubId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "token" text NOT NULL, "familyId" character varying(255) NOT NULL, "version" integer NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE, "revoked" boolean NOT NULL DEFAULT false, "consumedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_50db1b2ab77f2bb6b737b39341" ON "refresh_tokens" ("familyId", "version") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_40e9a8b923a1b3fb4429a5c624" ON "refresh_tokens" ("familyId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_610102b60fea1455310ccd299d" ON "refresh_tokens" ("userId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4542dd2f38a61354a040ba9fd5" ON "refresh_tokens" ("token") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('super_admin', 'admin', 'staff', 'user')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_membershipstatus_enum" AS ENUM('active', 'inactive', 'suspended')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "firstname" character varying NOT NULL, "lastname" character varying NOT NULL, "username" character varying, "email" character varying NOT NULL, "password" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'user', "passwordResetToken" character varying, "passwordResetExpiresIn" TIMESTAMP WITH TIME ZONE, "lastPasswordResetSentAt" TIMESTAMP WITH TIME ZONE, "verificationToken" character varying, "verificationTokenExpiry" TIMESTAMP WITH TIME ZONE, "lastVerificationEmailSent" TIMESTAMP WITH TIME ZONE, "verificationCode" character varying, "verificationCodeExpiresAt" TIMESTAMP WITH TIME ZONE, "passwordResetCode" character varying, "passwordResetCodeExpiresAt" TIMESTAMP WITH TIME ZONE, "isVerified" boolean NOT NULL DEFAULT false, "isActive" boolean NOT NULL DEFAULT true, "isDeleted" boolean NOT NULL DEFAULT false, "isSuspended" boolean NOT NULL DEFAULT false, "profilePicture" character varying(500), "phone" character varying(15), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "twoFactorEnabled" boolean NOT NULL DEFAULT false, "totpSecret" character varying(255), "totpBackupCodes" jsonb, "passkeyCredentials" jsonb, "membershipStatus" "public"."users_membershipstatus_enum" NOT NULL DEFAULT 'inactive', "memberSince" TIMESTAMP WITH TIME ZONE, "profileCompleteness" integer NOT NULL DEFAULT '0', "deletedAt" TIMESTAMP, "hubId" uuid, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bc9b2e5fc43865bb22f7f639bb" ON "users" ("hubId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_plantype_enum" AS ENUM('daily', 'weekly', 'monthly', 'quarterly', 'yearly')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_status_enum" AS ENUM('pending', 'confirmed', 'cancelled', 'completed', 'expired')`,
    );
    await queryRunner.query(
      `CREATE TABLE "bookings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid, "workspaceId" uuid NOT NULL, "planType" "public"."bookings_plantype_enum" NOT NULL, "startDate" date NOT NULL, "endDate" date NOT NULL, "totalAmount" bigint NOT NULL, "status" "public"."bookings_status_enum" NOT NULL DEFAULT 'pending', "paymentDeadline" TIMESTAMP WITH TIME ZONE, "seatCount" integer NOT NULL DEFAULT '1', "notes" text, "sorobanEscrowId" character varying, "reminderSent" boolean NOT NULL DEFAULT false, "isGuestBooking" boolean NOT NULL DEFAULT false, "guestInfo" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "hubId" uuid, CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_56f577cf0c0fa0fec2eb3b5973" ON "bookings" ("hubId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_48b267d894e32a25ebde4b207a" ON "bookings" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_96d2c1b1f22ea3d78ae391fd19" ON "bookings" ("workspaceId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_38a69a58a323647f2e75eb994d" ON "bookings" ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "workspace_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "workspaceId" uuid NOT NULL, "bookingId" uuid, "checkedInAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "checkedOutAt" TIMESTAMP WITH TIME ZONE, "durationMinutes" integer, "notes" text, "biometricTemplateHash" character varying(128), "biometricStorageReference" character varying(255), "biometricProcessingLocation" character varying(32), "biometricVendor" character varying(64), "hubId" uuid, CONSTRAINT "PK_9e1f33dca5e32c00c10c0f4abed" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5e8bb6dfe26742f97abc4ea7c0" ON "workspace_logs" ("hubId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3f0e626284faa95cdde4799a3d" ON "workspace_logs" ("userId", "checkedInAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f0409cb0365b7d0cc097d6861d" ON "workspace_logs" ("workspaceId", "checkedInAt") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_provider_enum" AS ENUM('paystack', 'soroban')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_status_enum" AS ENUM('pending', 'success', 'failed', 'refunded')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "bookingId" uuid NOT NULL, "userId" uuid, "amount" bigint NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'NGN', "provider" "public"."payments_provider_enum" NOT NULL, "providerReference" character varying, "status" "public"."payments_status_enum" NOT NULL DEFAULT 'pending', "paidAt" TIMESTAMP WITH TIME ZONE, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "hubId" uuid, CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_84476971d14de4d7ca2d029a3f" ON "payments" ("hubId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6bd9aa51f09e7dd2727adb8a6e" ON "payments" ("providerReference") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d35cb3c13a18e1ea1705b2817b" ON "payments" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1ead3dc5d71db0ea822706e389" ON "payments" ("bookingId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('booking_confirmed', 'booking_cancelled', 'booking_completed', 'payment_success', 'payment_failed', 'payment_refunded', 'invoice_generated', 'general')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "type" "public"."notifications_type_enum" NOT NULL, "title" character varying(255) NOT NULL, "message" text NOT NULL, "isRead" boolean NOT NULL DEFAULT false, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "hubId" uuid, CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d63b48df36934f25b4772e79e8" ON "notifications" ("hubId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5340fc241f57310d243e5ab20b" ON "notifications" ("userId", "isRead") `,
    );
    await queryRunner.query(
      `CREATE TABLE "newsletter_subscriber" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(254) NOT NULL, "isVerified" boolean NOT NULL DEFAULT false, "verifiedAt" TIMESTAMP WITH TIME ZONE, "verificationToken" character varying(128), "verificationTokenExpiresAt" TIMESTAMP WITH TIME ZONE, "subscribedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "unsubscribedAt" TIMESTAMP WITH TIME ZONE, "isActive" boolean NOT NULL DEFAULT true, "unsubscribeToken" character varying(128) NOT NULL, "consentedAt" TIMESTAMP WITH TIME ZONE, "ipAddress" character varying(64), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_c7c77fa243eefb2415b13f1b4e4" UNIQUE ("email"), CONSTRAINT "PK_673f5f9a16ef0e216059224e02f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_607cf367dae44af2260c472799" ON "newsletter_subscriber" ("isVerified") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_19aa53c6630913c18dd641a739" ON "newsletter_subscriber" ("isActive") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c7c77fa243eefb2415b13f1b4e" ON "newsletter_subscriber" ("email") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."invoices_status_enum" AS ENUM('pending', 'paid', 'void')`,
    );
    await queryRunner.query(
      `CREATE TABLE "invoices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "invoiceNumber" character varying(20) NOT NULL, "userId" uuid NOT NULL, "bookingId" uuid NOT NULL, "paymentId" uuid, "amountKobo" bigint NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'NGN', "status" "public"."invoices_status_enum" NOT NULL DEFAULT 'pending', "paidAt" TIMESTAMP WITH TIME ZONE, "lineItems" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "hubId" uuid, CONSTRAINT "PK_668cef7c22a427fd822cc1be3ce" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5c8989925e479cfffa7edc0f94" ON "invoices" ("hubId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_eca01fda44679cc1c342822e01" ON "invoices" ("bookingId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fcbe490dc37a1abf68f19c5ccb" ON "invoices" ("userId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_bf8e0f9dd4558ef209ec111782" ON "invoices" ("invoiceNumber") `,
    );
    await queryRunner.query(
      `CREATE TABLE "contact_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fullName" character varying(100) NOT NULL, "email" character varying(254) NOT NULL, "phone" character varying(20), "company" character varying(150), "subject" character varying(200) NOT NULL, "message" text NOT NULL, "ipAddress" character varying(64), "isRead" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b74f96eb2edd977ccfba6533293" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "trusted_devices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "deviceToken" text NOT NULL, "deviceLabel" character varying(255) NOT NULL DEFAULT 'Unknown device', "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, CONSTRAINT "PK_bc545fd72c357ff2edc8bbc7deb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f30e59414f783ffe9e1ba79a09" ON "trusted_devices" ("userId", "deviceToken") `,
    );
    await queryRunner.query(
      `CREATE TABLE "security_ip_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "audit_log_id" uuid NOT NULL, "raw_ip" inet NOT NULL, "action" character varying(100) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_f94e943d6fa52d6e0acd95edc33" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e4eb297b0c3bb2828ebf327188" ON "security_ip_log" ("audit_log_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f3a95056ddcfb10e33c748b5a2" ON "security_ip_log" ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actor_id" uuid, "actor_email" character varying(255), "actor_role" character varying(50), "action" character varying(100) NOT NULL, "target_type" character varying(100), "target_id" uuid, "ip_address" character varying(45), "user_agent" text, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "hub_id" uuid, CONSTRAINT "PK_07fefa57f7f5ab8fc3f52b3ed0b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_41242242a16c09b948c8dd3467" ON "audit_log" ("hub_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "workspaces" ADD CONSTRAINT "FK_9c71b88b85e57e43d29c987a5fb" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_bc9b2e5fc43865bb22f7f639bb5" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_38a69a58a323647f2e75eb994de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_96d2c1b1f22ea3d78ae391fd19a" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_56f577cf0c0fa0fec2eb3b59737" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_logs" ADD CONSTRAINT "FK_3d5ccd8a7b758f0b54415d2f192" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_logs" ADD CONSTRAINT "FK_4d2691b22fed2696106da1660ae" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_logs" ADD CONSTRAINT "FK_41831fddedcf6d6d87e28ba609c" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_logs" ADD CONSTRAINT "FK_5e8bb6dfe26742f97abc4ea7c02" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_1ead3dc5d71db0ea822706e389d" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_d35cb3c13a18e1ea1705b2817b1" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_84476971d14de4d7ca2d029a3f8" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_692a909ee0fa9383e7859f9b406" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_d63b48df36934f25b4772e79e87" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_fcbe490dc37a1abf68f19c5ccb9" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_eca01fda44679cc1c342822e01b" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_64923f3a8d3f3247dd5fe9f43c5" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_5c8989925e479cfffa7edc0f94d" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "trusted_devices" ADD CONSTRAINT "FK_d1623ce96eb58dbfc177e00e413" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_log" ADD CONSTRAINT "FK_41242242a16c09b948c8dd34679" FOREIGN KEY ("hub_id") REFERENCES "hubs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_log" DROP CONSTRAINT "FK_41242242a16c09b948c8dd34679"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trusted_devices" DROP CONSTRAINT "FK_d1623ce96eb58dbfc177e00e413"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_5c8989925e479cfffa7edc0f94d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_64923f3a8d3f3247dd5fe9f43c5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_eca01fda44679cc1c342822e01b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_fcbe490dc37a1abf68f19c5ccb9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_d63b48df36934f25b4772e79e87"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_692a909ee0fa9383e7859f9b406"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_84476971d14de4d7ca2d029a3f8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_d35cb3c13a18e1ea1705b2817b1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_1ead3dc5d71db0ea822706e389d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_logs" DROP CONSTRAINT "FK_5e8bb6dfe26742f97abc4ea7c02"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_logs" DROP CONSTRAINT "FK_41831fddedcf6d6d87e28ba609c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_logs" DROP CONSTRAINT "FK_4d2691b22fed2696106da1660ae"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_logs" DROP CONSTRAINT "FK_3d5ccd8a7b758f0b54415d2f192"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_56f577cf0c0fa0fec2eb3b59737"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_96d2c1b1f22ea3d78ae391fd19a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_38a69a58a323647f2e75eb994de"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_bc9b2e5fc43865bb22f7f639bb5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspaces" DROP CONSTRAINT "FK_9c71b88b85e57e43d29c987a5fb"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_41242242a16c09b948c8dd3467"`,
    );
    await queryRunner.query(`DROP TABLE "audit_log"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f3a95056ddcfb10e33c748b5a2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e4eb297b0c3bb2828ebf327188"`,
    );
    await queryRunner.query(`DROP TABLE "security_ip_log"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f30e59414f783ffe9e1ba79a09"`,
    );
    await queryRunner.query(`DROP TABLE "trusted_devices"`);
    await queryRunner.query(`DROP TABLE "contact_messages"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bf8e0f9dd4558ef209ec111782"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fcbe490dc37a1abf68f19c5ccb"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_eca01fda44679cc1c342822e01"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5c8989925e479cfffa7edc0f94"`,
    );
    await queryRunner.query(`DROP TABLE "invoices"`);
    await queryRunner.query(`DROP TYPE "public"."invoices_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c7c77fa243eefb2415b13f1b4e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_19aa53c6630913c18dd641a739"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_607cf367dae44af2260c472799"`,
    );
    await queryRunner.query(`DROP TABLE "newsletter_subscriber"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5340fc241f57310d243e5ab20b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d63b48df36934f25b4772e79e8"`,
    );
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1ead3dc5d71db0ea822706e389"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d35cb3c13a18e1ea1705b2817b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6bd9aa51f09e7dd2727adb8a6e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_84476971d14de4d7ca2d029a3f"`,
    );
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payments_provider_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f0409cb0365b7d0cc097d6861d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3f0e626284faa95cdde4799a3d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5e8bb6dfe26742f97abc4ea7c0"`,
    );
    await queryRunner.query(`DROP TABLE "workspace_logs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_38a69a58a323647f2e75eb994d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_96d2c1b1f22ea3d78ae391fd19"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_48b267d894e32a25ebde4b207a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_56f577cf0c0fa0fec2eb3b5973"`,
    );
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(`DROP TYPE "public"."bookings_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."bookings_plantype_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bc9b2e5fc43865bb22f7f639bb"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_membershipstatus_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4542dd2f38a61354a040ba9fd5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_610102b60fea1455310ccd299d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_40e9a8b923a1b3fb4429a5c624"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_50db1b2ab77f2bb6b737b39341"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9c71b88b85e57e43d29c987a5f"`,
    );
    await queryRunner.query(`DROP TABLE "workspaces"`);
    await queryRunner.query(`DROP TYPE "public"."workspaces_type_enum"`);
    await queryRunner.query(`DROP TABLE "hubs"`);
  }
}
