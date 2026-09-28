ALTER TYPE "public"."user_role" ADD VALUE 'reader';--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT;