import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
//import { drizzle } from "drizzle-orm/d1";

// Example D1 Client Initialization:
// export const db = drizzle(env.DB);

/** 
 * @strata {"x":-75,"y":105} 
 */
export const students = sqliteTable("students", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  balance: integer("balance").notNull().default(0),
});

/** 
 * @strata {"x":585,"y":-105} 
 */
export const meals = sqliteTable("meals", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  calories: integer("calories"),
});

/** 
 * @strata {"x":195,"y":390} 
 */
export const purchases = sqliteTable("purchases", {
  id: integer("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id),
  mealId: integer("meal_id").notNull().references(() => meals.id),
  createdAt: integer("created_at").notNull(),
});

/** 
 * @strata {"x":585,"y":525,"target":"do"} 
 */
export const inventory = sqliteTable("inventory", {
  id: integer("id").primaryKey(),
  mealId: integer("meal_id").notNull().references(() => meals.id),
  stock: integer("stock").notNull(),
  cafeteriaZone: text("cafeteria_zone").notNull(),
});

/** 
 * @strata {"x":50,"y":650} 
 */
export const clubs = sqliteTable("clubs", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
});

/** 
 * @strata {"x":-315,"y":480} 
 */
export const studentsToClubs = sqliteTable("students_to_clubs", {
  studentId: integer("student_id").notNull().references(() => students.id),
  clubId: integer("club_id").notNull().references(() => clubs.id),
});

/** 
 * @strata {"x":-810,"y":165,"target":"kv"} 
 */
export const activeSessions = {
  token: "string",
  studentId: "number",
  expiresAt: "number",
};

/** 
 * @strata {"x":-540,"y":165,"target":"kv"} 
 */
export const menuCache = {
  day: "string",
  items: "array",
  isPublished: "boolean",
};

// Relations logic
export const studentsRelations = relations(students, ({ many }) => ({
  purchases: many(purchases),
  studentToClubs: many(studentsToClubs),
}));

export const clubsRelations = relations(clubs, ({ many }) => ({
  studentToClubs: many(studentsToClubs),
}));

export const studentsToClubsRelations = relations(studentsToClubs, ({ one }) => ({
  student: one(students, {
    fields: [studentsToClubs.studentId],
    references: [students.id],
  }),
  club: one(clubs, {
    fields: [studentsToClubs.clubId],
    references: [clubs.id],
  }),
}));

export const mealsRelations = relations(meals, ({ many }) => ({
  purchases: many(purchases),
  inventoryRecords: many(inventory),
}));

export const purchasesRelations = relations(purchases, ({ one }) => ({
  student: one(students, {
    fields: [purchases.studentId],
    references: [students.id],
  }),
  meal: one(meals, {
    fields: [purchases.mealId],
    references: [meals.id],
  }),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
  meal: one(meals, {
    fields: [inventory.mealId],
    references: [meals.id],
  }),

}));

