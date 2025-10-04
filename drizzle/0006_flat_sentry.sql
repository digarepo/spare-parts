CREATE TABLE "inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"qty" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_seller_id_organizations_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_inventory_tenant_product_seller" ON "inventory" USING btree ("tenant_id","product_id","seller_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_tenant_product" ON "inventory" USING btree ("tenant_id","product_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_tenant_seller" ON "inventory" USING btree ("tenant_id","seller_id");