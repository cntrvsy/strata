/**
 * version.ts
 *
 * Summary: Single source of truth for the application version, dynamically injected
 * at build-time from package.json via Vite define (__APP_VERSION__).
 */

export const APP_VERSION: string =
	typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '3.2.0';
