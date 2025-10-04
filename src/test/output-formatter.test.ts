import { describe, it, expect, beforeEach } from 'vitest';
import { OutputFormatter } from '../output-formatter.js';
import type { ConversionResult } from '../types.js';

describe('OutputFormatter', () => {
  let formatter: OutputFormatter;
  let mockResult: ConversionResult;

  beforeEach(() => {
    formatter = new OutputFormatter();
    mockResult = {
      content: 'SGVsbG8sIFdvcmxkIQ==',
      metadata: {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: 13,
        hash: 'abc123',
      },
      processingTime: 42,
      success: true,
    };
  });

  describe('Basic Formats', () => {
    it('should return content as-is for raw format', async () => {
      const result = await formatter.format(mockResult, 'raw');
      expect(result).toBe('SGVsbG8sIFdvcmxkIQ==');
    });

    it('should format as JSON', async () => {
      const result = await formatter.format(mockResult, 'json');
      const parsed = JSON.parse(result);

      expect(parsed.data).toBe('SGVsbG8sIFdvcmxkIQ==');
      expect(parsed.size).toBe(20); // base64 length
    });

    it('should format as JavaScript module', async () => {
      const result = await formatter.format(mockResult, 'js');

      expect(result).toContain('const base64Data = "SGVsbG8sIFdvcmxkIQ==";');
      expect(result).toContain('module.exports = base64Data;');
    });

    it('should format as TypeScript module', async () => {
      const result = await formatter.format(mockResult, 'ts');

      expect(result).toContain('export const base64Data: string = "SGVsbG8sIFdvcmxkIQ==";');
    });
  });

  describe('Options', () => {
    it('should apply line wrapping', async () => {
      const result = await formatter.format(mockResult, 'raw', { wrapAt: 10 });
      expect(result).toContain('\n');
    });

    it('should create data URI', async () => {
      const result = await formatter.format(mockResult, 'raw', { dataUri: true });
      expect(result).toBe('data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==');
    });

    it('should include metadata when requested', async () => {
      const result = await formatter.format(mockResult, 'json', { includeMetadata: true });
      const parsed = JSON.parse(result);

      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.filename).toBe('test.txt');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unsupported format', async () => {
      await expect(formatter.format(mockResult, 'unsupported')).rejects.toThrow(
        'Unsupported output format: unsupported'
      );
    });
  });
});
