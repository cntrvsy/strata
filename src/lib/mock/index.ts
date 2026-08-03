/**
 * index.ts
 *
 * Summary: Centralized mock schemas module loading progressive EduStrata starter templates.
 */

import basicCode from "./basic.ts?raw";
import academicsCode from "./academics.ts?raw";
import infrastructureCode from "./infrastructure.ts?raw";
import fullstackCode from "./fullstack.ts?raw";
import masterCode from "./schema.ts?raw";

export interface SchemaTemplate {
  key: string;
  name: string;
  badge: string;
  description: string;
  code: string;
}

export const SAMPLE_TEMPLATES: Record<string, SchemaTemplate> = {
  master: {
    key: "master",
    name: "EduStrata Benchmark: Master School Campus",
    badge: "Full Hybrid Cloud (D1 + KV + DO + R2)",
    description: "Ultimate school campus architecture featuring 13 entities, physical Foreign Keys, Drizzle logical relations, KV auth sessions, Durable Object WebSockets, R2 asset buckets, and synthetic cross-storage links.",
    code: masterCode,
  },
  basic: {
    key: "basic",
    name: "EduStrata L1: Classrooms & Students",
    badge: "Level 1 • D1 Core & FKs",
    description: "Core classroom and student roster schema demonstrating D1 table declarations and physical foreign key references.",
    code: basicCode,
  },
  academics: {
    key: "academics",
    name: "EduStrata L2: Faculty & Courses",
    badge: "Level 2 • D1 + Drizzle Relations",
    description: "Multi-table academic management schema featuring Departments, Teachers, Courses, Enrollments, and Drizzle query builder relations().",
    code: academicsCode,
  },
  infrastructure: {
    key: "infrastructure",
    name: "EduStrata L3: Operations, KV & R2",
    badge: "Level 3 • D1 + KV + R2",
    description: "Campus operations modeling D1 Staff, real-time KV Bell Schedule, R2 Document Assets, and synthetic JSDoc cross-storage links.",
    code: infrastructureCode,
  },
  fullstack: {
    key: "fullstack",
    name: "EduStrata L4: Enterprise Campus",
    badge: "Level 4 • D1 + KV + DO + R2",
    description: "Full-stack enterprise campus ecosystem with D1 Tuition Invoicing, KV Cafeteria POS, Durable Object SmartBoard WebSocket server, and R2 Lecture Archives.",
    code: fullstackCode,
  },
};
