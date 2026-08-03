import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

/**
 * ============================================================================
 * EDUSTRATA BENCHMARK: MASTER SCHOOL CAMPUS ARCHITECTURE
 * ============================================================================
 * Welcome to the flagship EduStrata Master Benchmark Schema!
 *
 * This master schema demonstrates the full power of Strata's hybrid visual ERD:
 * 1. D1 Relational Core: SQL Tables (`sqliteTable`) with physical Foreign Keys (`.references()`)
 * 2. Drizzle Query Builder: Logical relations (`relations()`) with 1:1, 1:N, and N:M cardinalities
 * 3. Cloudflare KV Storage: Fast key-value caches (`@strata { "target": "kv" }`)
 * 4. Cloudflare Durable Objects: Stateful WebSockets & anti-cheat engines (`@strata { "target": "do" }`)
 * 5. Cloudflare R2 Buckets: Media streams & document asset storage (`@strata { "target": "r2" }`)
 * 6. Synthetic JSDoc Relations: Cross-storage connection lines (`"relations": [{ "to": "..." }]`)
 *
 * ZERO SIDE CARS, SINGLE SOURCE OF TRUTH:
 * All visual coordinates, storage bindings, and synthetic links live directly in standard `@strata` JSDoc comments.
 */

// ============================================================================
// SECTION 1: ACADEMIC CORE (D1 RELATIONAL SQL TABLES & PHYSICAL FKs)
// ============================================================================

/**
 * Academic Departments
 * Root organizational unit for faculty and course offerings.
 * @strata { "target": "d1", "x": 120, "y": 80 }
 */
export const departments = sqliteTable("departments", {
  id: integer("id").primaryKey(),
  code: text("code").notNull().unique(), // e.g. "CS", "MATH", "PHYS"
  name: text("name").notNull(),
  building: text("building").default("Main Hall"),
  annualBudget: real("annual_budget").default(50000.0),
});

/**
 * Faculty Teachers & Professors
 * Linked to `departments` via physical foreign key `.references()`.
 * @strata { "target": "d1", "x": 580, "y": 80 }
 */
export const teachers = sqliteTable("teachers", {
  id: integer("id").primaryKey(),
  teacherId: text("teacher_id").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  departmentId: integer("department_id").notNull().references(() => departments.id),
  title: text("title").default("Associate Professor"),
});

/**
 * Course Catalog
 * Academic curriculum listing linked to `departments`.
 * @strata { "target": "d1", "x": 580, "y": 480 }
 */
export const courses = sqliteTable("courses", {
  id: integer("id").primaryKey(),
  courseCode: text("course_code").notNull().unique(), // e.g. "CS-101", "MATH-202"
  title: text("title").notNull(),
  credits: integer("credits").default(3),
  departmentId: integer("department_id").notNull().references(() => departments.id),
});

/**
 * Scheduled Class Sections
 * Term-specific course offerings taught by a teacher in a specific room.
 * @strata { "target": "d1", "x": 1040, "y": 280 }
 */
export const classes = sqliteTable("classes", {
  id: integer("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => courses.id),
  teacherId: integer("teacher_id").notNull().references(() => teachers.id),
  term: text("term").notNull(), // e.g. "Fall 2026", "Spring 2027"
  roomNumber: text("room_number").default("Bldg-A 101"),
  maxCapacity: integer("max_capacity").default(30),
});

/**
 * Student Roster
 * Central student records containing personal data, GPA, and enrollment status.
 * @strata { "target": "d1", "x": 120, "y": 480 }
 */
export const students = sqliteTable("students", {
  id: integer("id").primaryKey(),
  studentNumber: text("student_number").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  gradeLevel: integer("grade_level").default(9),
  gpa: real("gpa").default(4.0),
  status: text("status").default("ACTIVE"),
});

/**
 * Class Enrollments (Many-to-Many Join Table)
 * Connects `students` to specific `classes` with final letter grades.
 * @strata { "target": "d1", "x": 1040, "y": 680 }
 */
export const enrollments = sqliteTable("enrollments", {
  id: integer("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id),
  classId: integer("class_id").notNull().references(() => classes.id),
  grade: text("grade").default("IN_PROGRESS"),
  enrolledAt: integer("enrolled_at", { mode: "timestamp" }).notNull(),
});

/**
 * Tuition & Fee Invoices
 * Financial billing ledger linked to `students`.
 * @strata { "target": "d1", "x": 580, "y": 880 }
 */
export const tuitionInvoices = sqliteTable("tuition_invoices", {
  id: integer("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  studentId: integer("student_id").notNull().references(() => students.id),
  amountCents: integer("amount_cents").notNull(),
  status: text("status").default("PENDING"), // "PENDING", "PAID", "OVERDUE"
  dueDate: integer("due_date", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// SECTION 2: DRIZZLE QUERY BUILDER LOGICAL RELATIONS (DOTTED/VIRTUAL EDGES)
// ============================================================================

export const departmentsRelations = relations(departments, ({ many }) => ({
  teachers: many(teachers),
  courses: many(courses),
}));

export const teachersRelations = relations(teachers, ({ one, many }) => ({
  department: one(departments, {
    fields: [teachers.departmentId],
    references: [departments.id],
  }),
  classes: many(classes),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  department: one(departments, {
    fields: [courses.departmentId],
    references: [departments.id],
  }),
  classes: many(classes),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  course: one(courses, {
    fields: [classes.courseId],
    references: [courses.id],
  }),
  teacher: one(teachers, {
    fields: [classes.teacherId],
    references: [teachers.id],
  }),
  enrollments: many(enrollments),
}));

export const studentsRelations = relations(students, ({ many }) => ({
  enrollments: many(enrollments),
  tuitionInvoices: many(tuitionInvoices),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  student: one(students, {
    fields: [enrollments.studentId],
    references: [students.id],
  }),
  class: one(classes, {
    fields: [enrollments.classId],
    references: [classes.id],
  }),
}));

export const tuitionInvoicesRelations = relations(tuitionInvoices, ({ one }) => ({
  student: one(students, {
    fields: [tuitionInvoices.studentId],
    references: [students.id],
  }),
}));

// ============================================================================
// SECTION 3: CLOUDFLARE KV KEY-VALUE STORAGE (SYNTHETIC JSDOC RELATIONS)
// ============================================================================

/**
 * Student Portal Auth Sessions (Cloudflare KV)
 * Global sub-millisecond session validation token cache.
 * @strata { "target": "kv", "x": 120, "y": 880, "relations": [{ "to": "students" }], "schema": { "sessionId": "string", "studentId": "number", "authToken": "string", "ipAddress": "string", "expiresAt": "number" } }
 */
export const STUDENT_SESSIONS_KV = {};

/**
 * Campus Bell & Emergency Schedule (Cloudflare KV)
 * Real-time daily period timing & emergency alert broadcast flags.
 * @strata { "target": "kv", "x": 120, "y": 1240, "relations": [{ "to": "departments" }], "schema": { "scheduleType": "string", "periodIndex": "number", "startTime": "string", "endTime": "string", "emergencyLockdown": "boolean" } }
 */
export const BELL_SCHEDULE_KV = {};

// ============================================================================
// SECTION 4: CLOUDFLARE DURABLE OBJECTS (STATEFUL WEBSOCKET ENGINES)
// ============================================================================

/**
 * Interactive SmartBoard Engine (Cloudflare Durable Object)
 * Manages live classroom WebSocket sessions, digital whiteboards, and instant polls.
 * @strata { "target": "do", "x": 1500, "y": 280, "relations": [{ "to": "classes" }], "path": "./src/do/ClassroomSmartBoardDO.ts", "class": "ClassroomSmartBoardDO", "methods": ["joinClassSession", "broadcastDrawingStroke", "raiseHand", "submitLivePoll"] }
 */
export const ClassroomSmartBoardDO = {};

/**
 * Exam Proctoring Anti-Cheat Session (Cloudflare Durable Object)
 * Stateful real-time monitor for online exams tracking browser focus & telemetry.
 * @strata { "target": "do", "x": 1500, "y": 680, "relations": [{ "to": "enrollments" }], "path": "./src/do/ExamProctorSessionDO.ts", "class": "ExamProctorSessionDO", "methods": ["initializeExam", "recordTabSwitch", "streamWebcamSnapshot", "finalizeGrade"] }
 */
export const ExamProctorSessionDO = {};

// ============================================================================
// SECTION 5: CLOUDFLARE R2 OBJECT STORAGE BUCKETS (FILE & MEDIA ASSETS)
// ============================================================================

/**
 * Student Document Assets (Cloudflare R2 Bucket)
 * Secure object storage bucket for PDF transcripts, student ID badges, and health forms.
 * @strata { "target": "r2", "x": 580, "y": 1240, "relations": [{ "to": "students" }], "public": false, "cors": true, "folders": { "transcripts": "application/pdf", "id_badges": "image/png", "medical_records": "application/pdf" } }
 */
export const STUDENT_ASSETS_R2 = {};

/**
 * Lecture Video & Media Archives (Cloudflare R2 Bucket)
 * Public high-capacity bucket holding recorded video lectures, slide PDFs, and audio podcasts.
 * @strata { "target": "r2", "x": 1040, "y": 1240, "relations": [{ "to": "courses" }], "public": true, "cors": true, "folders": { "video_streams": "video/mp4", "lecture_notes": "application/pdf", "audio_podcasts": "audio/mpeg" } }
 */
export const LECTURE_ARCHIVES_R2 = {};
