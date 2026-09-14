/**
 * @strata-layout {
 *   "customers": { "x": 100, "y": 120 },
 *   "orders": { "x": 560, "y": 120 },
 *   "orderItems": { "x": 560, "y": 480 },
 *   "products": { "x": 100, "y": 480 },
 *   "DISCOUNT_RULES_KV": { "x": 1040, "y": 120, "relations": [{ "to": "orders" }] },
 *   "CartCheckoutLockDO": { "x": 1040, "y": 480, "relations": [{ "to": "products" }] },
 *   "PRODUCT_MEDIA_R2": { "x": 100, "y": 860, "relations": [{ "to": "products" }] }
 * }
 */
import { sqliteTable, integer, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

/**
 * ============================================================================
 * ARCHITECTURE BLUEPRINT: GLOBAL EDGE E-COMMERCE & INVENTORY LOCKING
 * ============================================================================
 * High-concurrency transactional storefront showcasing strict SQLite financial modeling:
 *
 * 1. ZERO-FLOAT FINANCIAL ACCURACY (Integer Cents)
 *    - Never store currency as floating-point numbers (`real`) in databases!
 *    - All monetary columns (`priceCents`, `subtotalCents`, `taxCents`, `totalCents`)
 *      use exact `integer()` cents to eliminate rounding and precision errors.
 *
 * 2. CLOUDFLARE DURABLE OBJECTS (Atomic Flash-Sale Inventory Locking)
 *    - Preventing overselling during viral drops requires atomic coordination.
 *    - `CartCheckoutLockDO` reserves stock in an in-memory lock table for 10 minutes
 *      while the customer completes payment through Stripe/Checkout.
 *
 * 3. COMPOSITE UNIQUE CONSTRAINTS
 *    - Compound index on `(order_id, product_id)` in `order_items` prevents duplicate line entries.
 *
 * 4. R2 PUBLIC ASSET OPTIMIZATION
 *    - `PRODUCT_MEDIA_R2` hosts responsive WebP product images served via a custom CDN domain.
 */

// ============================================================================
// SECTION 1: D1 RELATIONAL SQL TABLES
// ============================================================================

/**
 * Registered Customers
 */
export const customers = sqliteTable("customers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id").unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/**
 * Product Catalog & Live Stock Counts
 */
export const products = sqliteTable("products", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sku: text("sku").notNull().unique(),
  title: text("title").notNull(),
  priceCents: integer("price_cents").notNull(), // Exact integer monetary cents
  stockQuantity: integer("stock_quantity").default(0).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }), // Soft delete support
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/**
 * Purchase Orders Ledger
 */
export const orders = sqliteTable("orders", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderNumber: text("order_number").notNull().unique(),
  customerId: text("customer_id").notNull().references(() => customers.id),
  subtotalCents: integer("subtotal_cents").notNull(),
  taxCents: integer("tax_cents").default(0).notNull(),
  shippingCents: integer("shipping_cents").default(0).notNull(),
  totalCents: integer("total_cents").notNull(),
  status: text("status", { enum: ["pending", "paid", "fulfilled", "refunded"] }).default("pending").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/**
 * Order Line Items (Composite Constraint Junction)
 */
export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").default(1).notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  totalPriceCents: integer("total_price_cents").notNull(),
}, (table) => [
  uniqueIndex("order_item_unique_idx").on(table.orderId, table.productId),
]);

// ============================================================================
// SECTION 2: DRIZZLE RELATIONS
// ============================================================================

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const productsRelations = relations(products, ({ many }) => ({
  orderItems: many(orderItems),
}));

