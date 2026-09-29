CREATE TABLE "comment_reports" (
	"comment_id" uuid NOT NULL,
	"reporter_id" text NOT NULL,
	"reason" text NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_reports_comment_id_reporter_id_pk" PRIMARY KEY("comment_id","reporter_id")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "notify_replies" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "notify_post_comments" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "notify_digest" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "reply_to_id" uuid;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "held_reason" text;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "held_detail" text;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_reports_reporter_created_idx" ON "comment_reports" USING btree ("reporter_id","created_at");--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_reply_to_id_comments_id_fk" FOREIGN KEY ("reply_to_id") REFERENCES "public"."comments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_reply_to_idx" ON "comments" USING btree ("reply_to_id");