/**
 * Core types and interfaces for All Your Base64
 */

export interface ConversionOptions {
  /** Input source type */
  inputType: 'file' | 'string' | 'stdin';
  /** Input content or file path */
  input: string | Buffer;
  /** Output format */
  outputFormat: 'raw' | 'json' | 'js' | 'css' | 'html' | 'xml';
  /** Output destination */
  outputType: 'stdout' | 'file' | 'clipboard';
  /** Output file path (when outputType is 'file') */
  outputPath?: string;
  /** Include metadata in output */
  includeMetadata: boolean;
  /** Wrap output at specified column */
  wrapAt?: number;
  /** Add URL prefix for data URIs */
  dataUri: boolean;
  /** Encoding mode */
  mode: 'encode' | 'decode';
  /** Streaming for large files */
  streaming: boolean;
  /** Chunk size for streaming (bytes) */
  chunkSize: number;
}

export interface FileMetadata {
  /** Original file name */
  filename?: string;
  /** MIME type */
  mimeType?: string;
  /** File size in bytes */
  size: number;
  /** Creation/modification dates */
  created?: Date;
  modified?: Date;
  /** File hash for integrity */
  hash?: string;
}

export interface ConversionResult {
  /** Base64 encoded/decoded content */
  content: string | Buffer;
  /** File metadata */
  metadata: FileMetadata;
  /** Processing time in milliseconds */
  processingTime: number;
  /** Success status */
  success: boolean;
  /** Error message if any */
  error?: string;
}

export interface OutputFormatConfig {
  /** Template for formatting output */
  template: string;
  /** File extension for output files */
  extension: string;
  /** MIME type for the output format */
  mimeType: string;
}
