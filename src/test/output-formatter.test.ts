import { describe, it, expect, beforeEach } from 'vitest';
import { OutputFormatter } from '../output-formatter.js';
import type { ConversionResult } from '../types.js';

describe('OutputFormatter', () => {
  let formatter: OutputFormatter;
  let mockResult: ConversionResult;

  beforeEach(() => {
    formatter = new OutputFormatter();
    mockResult = {
      content: 'SGVsbG8sIFdvcmxkIQ==', // "Hello, World!" in base64
      metadata: {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: 13, // Actual size of "Hello, World!"
        hash: 'abc123def456789',
      },
      processingTime: 42,
      success: true,
    };
  });

  describe('Raw Format (Default)', () => {
    it('should return content as-is for raw format', async () => {
      const result = await formatter.format(mockResult, 'raw');
      expect(result).toBe('SGVsbG8sIFdvcmxkIQ==');
    });

    it('should handle empty content', async () => {
      const emptyResult = { ...mockResult, content: '' };
      const result = await formatter.format(emptyResult, 'raw');
      expect(result).toBe('');
    });
  });

  describe('JSON Format Validation', () => {
    it('should format as valid JSON with correct structure', async () => {
      const result = await formatter.format(mockResult, 'json');

      // Must be valid JSON
      const parsed = JSON.parse(result);

      // Validate required fields
      expect(parsed.data).toBe('SGVsbG8sIFdvcmxkIQ==');
      expect(parsed.size).toBe(20); // Length of base64 string
      expect(typeof parsed.size).toBe('number');
    });

    it('should include metadata when requested', async () => {
      const result = await formatter.format(mockResult, 'json', { includeMetadata: true });
      const parsed = JSON.parse(result);

      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.filename).toBe('test.txt');
      expect(parsed.metadata.mimeType).toBe('text/plain');
      expect(parsed.metadata.size).toBe(13); // Original file size
      expect(parsed.metadata.hash).toBe('abc123def456789');
    });

    it('should produce valid JSON for all content types', async () => {
      const testCases = [
        { content: '', description: 'empty' },
        { content: 'YQ==', description: 'single character' },
        { content: 'SGVsbG8gV29ybGQ=', description: 'no padding' },
        { content: 'SGVsbG8gV29ybGQh', description: 'with special chars' },
      ];

      for (const testCase of testCases) {
        const testResult = { ...mockResult, content: testCase.content };
        const result = await formatter.format(testResult, 'json');

        expect(() => JSON.parse(result)).not.toThrow(
          `Should produce valid JSON for ${testCase.description}`
        );
      }
    });
  });

  describe('JavaScript Module Format', () => {
    it('should produce syntactically valid JavaScript', async () => {
      const result = await formatter.format(mockResult, 'js');

      // Check for required elements
      expect(result).toContain('const base64Data = "SGVsbG8sIFdvcmxkIQ==";');
      expect(result).toContain('module.exports = base64Data;');

      // Validate proper escaping
      expect(result).not.toContain('""'); // No double quotes
      expect(result).not.toContain('\n"'); // No unescaped newlines
    });

    it('should properly escape special characters', async () => {
      const specialResult = {
        ...mockResult,
        content: 'Test\nWith"Quotes\\AndBackslashes',
      };

      const result = await formatter.format(specialResult, 'js');

      // Should contain escaped versions
      expect(result).toContain('\\"'); // Escaped quotes
      expect(result).toContain('\\n'); // Escaped newlines
      expect(result).toContain('\\\\'); // Escaped backslashes
    });

    it('should include metadata as valid JavaScript object', async () => {
      const result = await formatter.format(mockResult, 'js', { includeMetadata: true });

      expect(result).toContain('const metadata = {');
      expect(result).toContain('"filename": "test.txt"');
      expect(result).toContain('module.exports = { base64Data, metadata };');
    });
  });

  describe('TypeScript Module Format', () => {
    it('should produce valid TypeScript with proper types', async () => {
      const result = await formatter.format(mockResult, 'ts');

      expect(result).toContain('export const base64Data: string = "SGVsbG8sIFdvcmxkIQ==";');
      expect(result).not.toContain('module.exports'); // Should use ES modules
    });

    it('should include typed metadata interface', async () => {
      const result = await formatter.format(mockResult, 'ts', { includeMetadata: true });

      expect(result).toContain('export interface FileMetadata {');
      expect(result).toContain('filename?: string;');
      expect(result).toContain('mimeType?: string;');
      expect(result).toContain('size: number;');
      expect(result).toContain('export const metadata: FileMetadata =');
    });
  });

  describe('Data URI Format', () => {
    it('should create valid data URI with MIME type', async () => {
      const result = await formatter.format(mockResult, 'raw', { dataUri: true });

      expect(result).toBe('data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==');
      expect(result).toMatch(/^data:[^;]+;base64,/); // Valid data URI structure
    });

    it('should handle missing MIME type gracefully', async () => {
      const noMimeResult = {
        ...mockResult,
        metadata: { ...mockResult.metadata, mimeType: undefined },
      };

      const result = await formatter.format(noMimeResult, 'raw', { dataUri: true });

      // Should still work without MIME type (browser will infer)
      expect(result).toBe('SGVsbG8sIFdvcmxkIQ=='); // Falls back to raw
    });
  });

  describe('Line Wrapping', () => {
    it('should wrap content at specified width', async () => {
      const longResult = {
        ...mockResult,
        content: 'VGhpcyBpcyBhIHZlcnkgbG9uZyBiYXNlNjQgc3RyaW5nIHRoYXQgc2hvdWxkIGJlIHdyYXBwZWQ=',
      };

      const result = await formatter.format(longResult, 'raw', { wrapAt: 20 });

      const lines = result.split('\n');
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(20);
      }
    });

    it('should maintain RFC 2045 compliance with 76-character wrapping', async () => {
      const longResult = {
        ...mockResult,
        content: 'A'.repeat(100), // Very long base64-like string
      };

      const result = await formatter.format(longResult, 'raw', { wrapAt: 76 });

      const lines = result.split('\n');
      for (const line of lines.slice(0, -1)) {
        // All but last line
        expect(line.length).toBeLessThanOrEqual(76);
      }
    });
  });

  describe('CSS Format', () => {
    it('should produce valid CSS with custom properties', async () => {
      const result = await formatter.format(mockResult, 'css');

      expect(result).toContain('.base64-data {');
      expect(result).toContain('--base64-content:');
      expect(result).toContain('content: var(--base64-content);');
      expect(result).toContain('SGVsbG8sIFdvcmxkIQ==');
    });

    it('should properly escape CSS special characters', async () => {
      const specialResult = {
        ...mockResult,
        content: 'Test"With\\Quotes',
      };

      const result = await formatter.format(specialResult, 'css');

      expect(result).toContain('\\"'); // Escaped quotes
      expect(result).toContain('\\\\'); // Escaped backslashes
    });
  });

  describe('HTML Format', () => {
    it('should produce valid HTML5 document', async () => {
      const result = await formatter.format(mockResult, 'html');

      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<html lang="en">');
      expect(result).toContain('<meta charset="UTF-8">');
      expect(result).toContain('data-content="SGVsbG8sIFdvcmxkIQ=="');
    });

    it('should properly escape HTML entities', async () => {
      const htmlResult = {
        ...mockResult,
        content: 'Test<>&"\'Content',
        metadata: { ...mockResult.metadata, filename: 'test<>&"\'.txt' },
      };

      const result = await formatter.format(htmlResult, 'html', { includeMetadata: true });

      expect(result).toContain('&lt;'); // Escaped <
      expect(result).toContain('&gt;'); // Escaped >
      expect(result).toContain('&amp;'); // Escaped &
      expect(result).toContain('&quot;'); // Escaped "
    });
  });

  describe('Error Handling', () => {
    it('should throw descriptive error for unsupported format', async () => {
      await expect(formatter.format(mockResult, 'unsupported')).rejects.toThrow(
        'Unsupported output format: unsupported'
      );
    });

    it('should handle null/undefined content gracefully', async () => {
      const nullResult = { ...mockResult, content: null as unknown as string };

      // Should not throw, should handle gracefully
      const result = await formatter.format(nullResult, 'raw');
      expect(typeof result).toBe('string');
    });
  });

  describe('Format Availability', () => {
    it('should list all available formats', () => {
      const formats = formatter.getAvailableFormats();

      const expectedFormats = [
        'raw',
        'json',
        'js',
        'css',
        'html',
        'xml',
        'typescript',
        'ts',
        'yaml',
        'yml',
        'markdown',
        'md',
      ];

      for (const format of expectedFormats) {
        expect(formats).toContain(format);
      }
    });

    it('should support case-insensitive format names', async () => {
      const formats = ['JS', 'Json', 'HTML', 'XML'];

      for (const format of formats) {
        await expect(formatter.format(mockResult, format)).resolves.toBeDefined();
      }
    });
  });
});
