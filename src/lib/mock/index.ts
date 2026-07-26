/**
 * index.ts
 *
 * Summary: Centralized mock schemas module loading starter templates from $lib/mock/*.ts
 */

import fullstackCode from "./fullstack.ts?raw";
import basicCode from "./basic.ts?raw";
import ecommerceCode from "./ecommerce.ts?raw";

export interface SchemaTemplate {
  key: string;
  name: string;
  badge: string;
  description: string;
  code: string;
}

export const SAMPLE_TEMPLATES: Record<string, SchemaTemplate> = {
  fullstack: {
    key: "fullstack",
    name: "Cloudflare Full Stack",
    badge: "D1 + KV + DO + R2",
    description: "Complete Cloudflare architecture with D1 SQL tables, KV cache, Durable Objects, and R2 storage.",
    code: fullstackCode,
  },
  basic: {
    key: "basic",
    name: "Basic D1 Relational",
    badge: "SQLite D1",
    description: "Simple D1 relational schema with users and posts connected via physical foreign key.",
    code: basicCode,
  },
  ecommerce: {
    key: "ecommerce",
    name: "Multi-Entity E-Commerce",
    badge: "D1 SQL + Relations",
    description: "Multi-table relational model with products, orders, and line items.",
    code: ecommerceCode,
  },
};
