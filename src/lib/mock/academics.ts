import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

/**
 * ============================================================================
 * EDUSTRATA LEVEL 2: FACULTY, COURSES & DRIZZLE RELATIONS
 * ============================================================================
 * Building on Level 1, Level 2 introduces multi-table academic management and
 * Drizzle's logical `relations()` query builder API.
 *
 * CONCEPT 1: DRIZZLE LOGICAL RELATIONS (relations())
 * - Beyond physical database foreign keys (`.references()`), Drizzle provides
 *   `relations(departments, ({ many }) => ({ teachers: many(teachers) }))`.
 * - Strata parses `relations()` declarations to render DASHED ANIMATED relationship lines
 *   in the ERD canvas, allowing high-level query navigation.
 *
 * CONCEPT 2: MULTI-TABLE CARDINALITY (1:N & N:M)
 * - `departments` connects to `teachers` via 1-to-Many cardinality (`many(teachers)` / `one(departments)`).
 * - `courses` connects to `teachers` via course lead instructor assignment.
 * - `enrollments` serves as a join table linking `students` to `courses`.
 *
 * TRY IT IN THE SANDBOX:
 * 1. Trace the dashed animated line connecting `departments` ➔ `teachers`.
 * 2. Select a relationship line to inspect its cardinality (1:N or 1:1) in the sidebar drawer.
 * 3. Draw a connection line between `courses` and `enrollments` to create a new relation!
 */

/**
 * Academic Departments
 * @strata { "target": "d1", "x": 100, "y": 140 }
 */
export const departments = sqliteTable("departments", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  budget: real("budget").notNull(),
});

/**
 * Teaching Faculty
 * @strata { "target": "d1", "x": 500, "y": 140 }
 */
export const teachers = sqliteTable("teachers", {
  id: integer("id").primaryKey(),
  full_name: text("full_name").notNull(),
  email: text("email").notNull(),
  department_id: integer("department_id").notNull().references(() => departments.id),
  hire_date: integer("hire_date", { mode: "timestamp" }).notNull(),
});

/**
 * Academic Course Catalog
 * @strata { "target": "d1", "x": 500, "y": 440 }
 */
export const courses = sqliteTable("courses", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  course_code: text("course_code").notNull(),
  teacher_id: integer("teacher_id").notNull().references(() => teachers.id),
  credits: integer("credits").notNull(),
});

/**
 * Student Course Enrollments (Junction Table)
 * @strata { "target": "d1", "x": 100, "y": 440 }
 */
export const enrollments = sqliteTable("enrollments", {
  id: integer("id").primaryKey(),
  student_id: integer("student_id").notNull(),
  course_id: integer("course_id").notNull().references(() => courses.id),
  grade_letter: text("grade_letter"),
  enrolled_at: integer("enrolled_at", { mode: "timestamp" }).notNull(),
});

// --- DRIZZLE QUERY BUILDER LOGICAL RELATIONS ---

export const departmentRelations = relations(departments, ({ many }) => ({
  teachers: many(teachers),
}));

export const teacherRelations = relations(teachers, ({ one, many }) => ({
  department: one(departments, {
    fields: [teachers.department_id],
    references: [departments.id],
  }),
  courses: many(courses),
}));

export const courseRelations = relations(courses, ({ one, many }) => ({
  instructor: one(teachers, {
    fields: [courses.teacher_id],
    references: [teachers.id],
  }),
  enrollments: many(enrollments),
}));
