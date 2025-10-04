import { describe, it, expect, beforeEach } from 'vitest';
import { Base64Engine } from '../base64-engine.js';
import type { ConversionOptions } from '../types.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// RFC 4648 Test Vectors - These are the official test cases that any base64 implementation MUST pass
const RFC_4648_TEST_VECTORS = [
  { input: '', expected: '' },
  { input: 'f', expected: 'Zg==' },
  { input: 'fo', expected: 'Zm8=' },
  { input: 'foo', expected: 'Zm9v' },
  { input: 'foob', expected: 'Zm9vYg==' },
  { input: 'fooba', expected: 'Zm9vYmE=' },
  { input: 'foobar', expected: 'Zm9vYmFy' },
] as const;

// Additional test vectors for comprehensive validation
const ADDITIONAL_TEST_VECTORS = [
  { input: 'Hello, World!', expected: 'SGVsbG8sIFdvcmxkIQ==' },
  {
    input: 'The quick brown fox jumps over the lazy dog',
    expected: 'VGhlIHF1aWNrIGJyb3duIGZveCBqdW1wcyBvdmVyIHRoZSBsYXp5IGRvZw==',
  },
  // Binary data test
  {
    input: Buffer.from([0, 1, 2, 3, 254, 255]),
    expected: Buffer.from([0, 1, 2, 3, 254, 255]).toString('base64'),
  },
  // Unicode test
  { input: '🚀 Hello 世界', expected: Buffer.from('🚀 Hello 世界', 'utf8').toString('base64') },
] as const;

// Invalid base64 test cases - only truly broken stuff
const INVALID_BASE64_CASES = [
  'Invalid@Base64!', // Invalid characters
  'SGVs*G8', // Invalid character in middle
  'SGVsbG8===', // Too much padding
] as const;

// These are "non-canonical" but still work with Node.js Buffer.from()
const LENIENT_BASE64_CASES = [
  'SGVsbG8', // Missing padding - Node.js handles this
  'SGVsbG8=', // Incorrect padding - Node.js handles this
  'SGVsbG8= ', // Whitespace after padding - we strip whitespace
] as const;

describe('Base64Engine', () => {
  let engine: Base64Engine;
  let tempDir: string;

  beforeEach(async () => {
    engine = new Base64Engine();
    tempDir = await fs.mkdtemp(join(tmpdir(), 'ayb64-test-'));
  });

  describe('RFC 4648 Compliance', () => {
    it.each(RFC_4648_TEST_VECTORS)(
      'should encode "$input" to "$expected" (RFC 4648)',
      async ({ input, expected }) => {
        const options: ConversionOptions = {
          inputType: 'string',
          input,
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
        expect(result.content).toBe(expected);
      }
    );

    it.each(RFC_4648_TEST_VECTORS)(
      'should decode "$expected" to "$input" (RFC 4648)',
      async ({ input, expected }) => {
        if (expected === '') return; // Skip empty test for decode

        const options: ConversionOptions = {
          inputType: 'string',
          input: expected,
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
        expect(result.content.toString()).toBe(input);
      }
    );
  });

  describe('Cross-Validation with Node.js Built-ins', () => {
    it.each(ADDITIONAL_TEST_VECTORS)(
      'should match Node.js Buffer.from() for "$input"',
      async ({ input, expected }) => {
        const inputBuffer = typeof input === 'string' ? input : input;
        const nodeResult = Buffer.from(inputBuffer).toString('base64');

        const options: ConversionOptions = {
          inputType: 'string',
          input: inputBuffer,
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
        expect(result.content).toBe(nodeResult);
        expect(result.content).toBe(expected);
      }
    );

    it.each(ADDITIONAL_TEST_VECTORS)(
      'should match Node.js Buffer.from() for decoding',
      async ({ input, expected }) => {
        const nodeResult = Buffer.from(expected, 'base64').toString();

        const options: ConversionOptions = {
          inputType: 'string',
          input: expected,
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
        expect(result.content.toString()).toBe(nodeResult);
        expect(result.content.toString()).toBe(
          typeof input === 'string' ? input : input.toString()
        );
      }
    );
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle empty input', async () => {
      const options: ConversionOptions = {
        inputType: 'string',
        input: '',
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
      expect(result.content).toBe('');
    });

    it.each(INVALID_BASE64_CASES)('should reject invalid base64: "%s"', async (invalidBase64) => {
      const options: ConversionOptions = {
        inputType: 'string',
        input: invalidBase64,
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

    it.each(LENIENT_BASE64_CASES)('should accept lenient base64: "%s"', async (lenisentBase64) => {
      const options: ConversionOptions = {
        inputType: 'string',
        input: lenisentBase64,
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
      expect(result.content).toBeDefined();
    });

    it('should handle large binary data', async () => {
      // Create 1MB of random binary data
      const largeData = Buffer.alloc(1024 * 1024);
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = Math.floor(Math.random() * 256);
      }

      const testFile = join(tempDir, 'large.bin');
      await fs.writeFile(testFile, largeData);

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
      const expectedBase64 = largeData.toString('base64');

      expect(result.success).toBe(true);
      expect(result.content).toBe(expectedBase64);
    });

    it('should handle non-existent file gracefully', async () => {
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
      expect(result.error).toContain('ENOENT');
    });
  });

  describe('Streaming Mode Validation', () => {
    it('should produce identical results in streaming vs non-streaming mode', async () => {
      const testData = 'Large test data '.repeat(1000); // ~16KB
      const testFile = join(tempDir, 'streaming-test.txt');
      await fs.writeFile(testFile, testData);

      // Non-streaming result
      const nonStreamingOptions: ConversionOptions = {
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

      // Streaming result
      const streamingOptions: ConversionOptions = {
        ...nonStreamingOptions,
        streaming: true,
        chunkSize: 1024, // Small chunks to test streaming
      };

      const [nonStreamingResult, streamingResult] = await Promise.all([
        engine.convert(nonStreamingOptions),
        engine.convert(streamingOptions),
      ]);

      expect(nonStreamingResult.success).toBe(true);
      expect(streamingResult.success).toBe(true);
      expect(streamingResult.content).toBe(nonStreamingResult.content);

      // Validate against Node.js
      const expectedBase64 = Buffer.from(testData).toString('base64');
      expect(streamingResult.content).toBe(expectedBase64);
    });
  });
});
