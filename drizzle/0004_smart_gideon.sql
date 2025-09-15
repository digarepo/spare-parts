CREATE TYPE "public"."product_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" varchar(160) NOT NULL,
	"slug" varchar(180) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "product_fitments" (
	"product_id" uuid NOT NULL,
	"trim_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"alt" varchar(200),
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"category_id" uuid,
	"name" varchar(200) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"sku" varchar(64) NOT NULL,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"currency" varchar(3) DEFAULT 'ETB' NOT NULL,
	"price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"compare_at_price" numeric(12, 2),
	"stock_qty" integer DEFAULT 0 NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"short_desc" varchar(400),
	"description" text,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "vehicle_makes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(140) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"make_id" uuid NOT NULL,
	"name" varchar(140) NOT NULL,
	"slug" varchar(160) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_trims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"year_start" integer NOT NULL,
	"year_end" integer NOT NULL,
	"engine" varchar(120),
	"fuel" varchar(30),
	"transmission" varchar(60)
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_fitments" ADD CONSTRAINT "product_fitments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_fitments" ADD CONSTRAINT "product_fitments_trim_id_vehicle_trims_id_fk" FOREIGN KEY ("trim_id") REFERENCES "public"."vehicle_trims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_fitments" ADD CONSTRAINT "product_fitments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_make_id_vehicle_makes_id_fk" FOREIGN KEY ("make_id") REFERENCES "public"."vehicle_makes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_trims" ADD CONSTRAINT "vehicle_trims_model_id_vehicle_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cat_tenant_slug_uq" ON "categories" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE INDEX "cat_tenant_parent_idx" ON "categories" USING btree ("tenant_id","parent_id");--> statement-breakpoint
CREATE INDEX "cat_tenant_created_idx" ON "categories" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pfit_product_trim_uq" ON "product_fitments" USING btree ("product_id","trim_id");--> statement-breakpoint
CREATE INDEX "pfit_tenant_idx" ON "product_fitments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "pfit_product_idx" ON "product_fitments" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "pfit_trim_idx" ON "product_fitments" USING btree ("trim_id");--> statement-breakpoint
CREATE INDEX "pimg_product_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "pimg_primary_idx" ON "product_images" USING btree ("is_primary");--> statement-breakpoint
CREATE UNIQUE INDEX "prod_tenant_sku_uq" ON "products" USING btree ("tenant_id","sku");--> statement-breakpoint
CREATE UNIQUE INDEX "prod_tenant_slug_uq" ON "products" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE INDEX "prod_tenant_category_idx" ON "products" USING btree ("tenant_id","category_id");--> statement-breakpoint
CREATE INDEX "prod_tenant_status_idx" ON "products" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "prod_tenant_created_idx" ON "products" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "vmake_slug_uq" ON "vehicle_makes" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "vmodel_make_slug_uq" ON "vehicle_models" USING btree ("make_id","slug");--> statement-breakpoint
CREATE INDEX "vmodel_make_idx" ON "vehicle_models" USING btree ("make_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vtrim_model_span_name_uq" ON "vehicle_trims" USING btree ("model_id","name","year_start","year_end");--> statement-breakpoint
CREATE INDEX "vtrim_model_idx" ON "vehicle_trims" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "vtrim_span_idx" ON "vehicle_trims" USING btree ("year_start","year_end");