CREATE TABLE "reservation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"committed_at" timestamp with time zone,
	"released_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "reservation_items" ADD CONSTRAINT "reservation_items_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_items" ADD CONSTRAINT "reservation_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_items" ADD CONSTRAINT "reservation_items_seller_id_organizations_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_res_items_tenant_res_prod_seller" ON "reservation_items" USING btree ("tenant_id","reservation_id","product_id","seller_id");--> statement-breakpoint
CREATE INDEX "ix_res_items_tenant_product_seller" ON "reservation_items" USING btree ("tenant_id","product_id","seller_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reservations_tenant_key" ON "reservations" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE INDEX "ix_reservations_tenant_status" ON "reservations" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "ix_reservations_tenant_expires" ON "reservations" USING btree ("tenant_id","expires_at");