import { describe, it, expect, beforeEach } from 'vitest';
import { Base64Engine } from '../base64-engine.js';
import type { ConversionOptions } from '../types.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Base64Engine', () => {
  let engine: Base64Engine;
  let tempDir: string;

  beforeEach(async () => {
    engine = new Base64Engine();
    tempDir = await fs.mkdtemp(join(tmpdir(), 'ayb64-test-'));
  });

  describe('String Operations', () => {
    it('should encode string to base64', async () => {
      const options: ConversionOptions = {
        inputType: 'string',
        input: 'Hello, World!',
        outputFormat: 'raw',
        outputType: 'stdout',
        includeMetadata: false,
        mode: 'encode',
        streaming: false,
        chunkSize: 65536,
        dataUri: false,
      };

      const result = await engine.convert(options);

      expect(result.success).toBe(true);
      expect(result.content).toBe('SGVsbG8sIFdvcmxkIQ==');
    });

    it('should decode base64 to string', async () => {
      const options: ConversionOptions = {
        inputType: 'string',
        input: 'SGVsbG8sIFdvcmxkIQ==',
        outputFormat: 'raw',
        outputType: 'stdout',
        includeMetadata: false,
        mode: 'decode',
        streaming: false,
        chunkSize: 65536,
        dataUri: false,
      };

      const result = await engine.convert(options);

      expect(result.success).toBe(true);
      expect(result.content.toString()).toBe('Hello, World!');
    });
  });

  describe('File Operations', () => {
    it('should encode text file', async () => {
      const testFile = join(tempDir, 'test.txt');
      const content = 'Test file content';
      await fs.writeFile(testFile, content);

      const options: ConversionOptions = {
        inputType: 'file',
        input: testFile,
        outputFormat: 'raw',
        outputType: 'stdout',
        includeMetadata: false,
        mode: 'encode',
        streaming: false,
        chunkSize: 65536,
        dataUri: false,
      };

      const result = await engine.convert(options);

      expect(result.success).toBe(true);
      expect(result.content).toBe(Buffer.from(content).toString('base64'));
    });

    it('should handle non-existent file', async () => {
      const options: ConversionOptions = {
        inputType: 'file',
        input: join(tempDir, 'nonexistent.txt'),
        outputFormat: 'raw',
        outputType: 'stdout',
        includeMetadata: false,
        mode: 'encode',
        streaming: false,
        chunkSize: 65536,
        dataUri: false,
      };

      const result = await engine.convert(options);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid base64', async () => {
      const options: ConversionOptions = {
        inputType: 'string',
        input: 'Invalid@Base64!',
        outputFormat: 'raw',
        outputType: 'stdout',
        includeMetadata: false,
        mode: 'decode',
        streaming: false,
        chunkSize: 65536,
        dataUri: false,
      };

      const result = await engine.convert(options);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
