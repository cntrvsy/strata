import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

/**
 * ============================================================================
 * STRATA LESSON 2: MULTI-ENTITY RELATIONAL MODEL & DRIZZLE RELATIONS
 * ============================================================================
 * Building on Lesson 1, this template demonstrates multi-table schemas and
 * Drizzle's logical `relations()` query builder API.
 *
 * CONCEPT 1: DRIZZLE LOGICAL RELATIONS (relations())
 * - Beyond physical database foreign keys (`.references()`), Drizzle provides
 *   `relations(customers, ({ many }) => ({ orders: many(orders) }))`.
 * - Strata parses `relations()` declarations to render DASHED relationship lines
 *   in the ERD, allowing query-level relationship navigation.
 *
 * CONCEPT 2: MULTI-TABLE CONNECTIONS & CARDINALITY
 * - `customers` connects to `orders` via 1-to-Many cardinality (`many(orders)` / `one(customers)`).
 * - `products` stands alone as an entity ready to be connected to `orders` via a join table!
 *
 * TRY IT IN THE SANDBOX:
 * 1. Look at the relationship line connecting `customers` ➔ `orders`.
 * 2. Try creating an `order_items` join table to connect `orders` and `products`!
 * 3. Delete or modify a relation to watch the diagram lines adjust dynamically.
 */

/**
 * Customers Table
 * @strata { "target": "d1", "x": 100, "y": 140 }
 */
export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
});

/**
 * Orders Table
 * @strata { "target": "d1", "x": 500, "y": 140 }
 */
export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey(),
  customer_id: integer("customer_id").notNull().references(() => customers.id),
  total_amount: real("total_amount").notNull(),
  created_at: integer("created_at", { mode: "timestamp" }).notNull(),
});

/**
 * Products Catalog Table
 * @strata { "target": "d1", "x": 500, "y": 440 }
 */
export const products = sqliteTable("products", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  price: real("price").notNull(),
});

// --- DRIZZLE QUERY BUILDER LOGICAL RELATIONS ---

export const customerRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
}));

export const orderRelations = relations(orders, ({ one }) => ({
  customer: one(customers, {
    fields: [orders.customer_id],
    references: [customers.id],
  }),
}));
