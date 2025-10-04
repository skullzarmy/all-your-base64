/**
 * All Your Base64 - Modern Base64 Conversion Library
 * Main library entry point for programmatic usage
 */

// Core engine exports
export { Base64Engine } from './base64-engine.js';
export { OutputFormatter } from './output-formatter.js';
export { MimeTypeDetector } from './mime-detector.js';

// Type exports
export type {
  ConversionOptions,
  ConversionResult,
  FileMetadata,
  OutputFormatConfig,
} from './types.js';

// Error handling utilities
export { handleError } from './error-handler.js';

// Default export for convenience
export { Base64Engine as default } from './base64-engine.js';
