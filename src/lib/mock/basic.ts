import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * ============================================================================
 * EDUSTRATA LEVEL 1: CLASSROOMS & STUDENT FOUNDATIONS
 * ============================================================================
 * Welcome to the Strata Sandbox! This is Level 1 of the EduStrata School System.
 *
 * CONCEPT 1: D1 TABLES (sqliteTable)
 * - Strata parses Drizzle `sqliteTable()` declarations into interactive ERD cards.
 * - The `@strata` JSDoc block above each entity stores its visual (x, y) canvas coordinates.
 *
 * CONCEPT 2: PHYSICAL FOREIGN KEYS (.references)
 * - `students.classroom_id` uses `.references(() => classrooms.id)`.
 * - Strata automatically renders physical foreign keys as SOLID lines with arrowheads pointing to the parent table.
 *
 * TRY IT IN THE SANDBOX:
 * 1. Drag `classrooms` or `students` cards on the canvas — notice how `@strata` coordinates update!
 * 2. Click on a table or column to inspect and modify properties in the sidebar Inspector.
 * 3. Use the "+ New Entity" button to add a new table to your schema.
 */

/**
 * Parent Entity: Classrooms Table
 * @strata { "target": "d1", "x": 120, "y": 180 }
 */
export const classrooms = sqliteTable("classrooms", {
  id: integer("id").primaryKey(),
  room_number: text("room_number").notNull(),
  building_wing: text("building_wing").notNull(),
  capacity: integer("capacity").notNull(),
  is_active: integer("is_active", { mode: "boolean" }).notNull(),
});

/**
 * Child Entity: Students Table
 * Linked to `classrooms` via `classroom_id` physical foreign key reference.
 * @strata { "target": "d1", "x": 560, "y": 180 }
 */
export const students = sqliteTable("students", {
  id: integer("id").primaryKey(),
  full_name: text("full_name").notNull(),
  email: text("email").notNull(),
  grade_level: integer("grade_level").notNull(),
  classroom_id: integer("classroom_id").notNull().references(() => classrooms.id),
  enrolled_at: integer("enrolled_at", { mode: "timestamp" }).notNull(),
});
