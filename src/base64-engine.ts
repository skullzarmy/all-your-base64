import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { Transform } from 'stream';
import crypto from 'crypto';
import type { ConversionOptions, ConversionResult, FileMetadata } from './types.js';
import { MimeTypeDetector } from './mime-detector.js';

/**
 * High-performance Base64 conversion engine with streaming support
 */
export class Base64Engine {
  private readonly mimeDetector: MimeTypeDetector;

  constructor() {
    this.mimeDetector = new MimeTypeDetector();
  }

  /**
   * Convert input to base64 with comprehensive options
   */
  async convert(options: ConversionOptions): Promise<ConversionResult> {
    const startTime = Date.now();

    try {
      let result: ConversionResult;

      if (options.streaming && options.inputType === 'file') {
        result = await this.convertStreamingFile(options);
      } else {
        result = await this.convertInMemory(options);
      }

      result.processingTime = Date.now() - startTime;
      return result;
    } catch (error) {
      return {
        content: '',
        metadata: { size: 0 },
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Convert file using streaming for large files
   */
  private async convertStreamingFile(options: ConversionOptions): Promise<ConversionResult> {
    const filePath = options.input as string;
    const stats = await fs.stat(filePath);

    const metadata: FileMetadata = {
      filename: filePath.split('/').pop(),
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      mimeType: await this.mimeDetector.detectFromFile(filePath),
    };

    if (options.mode === 'encode') {
      const content = await this.streamEncodeFile(filePath, options.chunkSize);
      return {
        content,
        metadata: { ...metadata, hash: await this.calculateFileHash(filePath) },
        processingTime: 0,
        success: true,
      };
    } else {
      const content = await this.streamDecodeFile(filePath);
      return {
        content,
        metadata,
        processingTime: 0,
        success: true,
      };
    }
  }

  /**
   * Convert data in memory (for smaller files and strings)
   */
  private async convertInMemory(options: ConversionOptions): Promise<ConversionResult> {
    let buffer: Buffer;
    let metadata: FileMetadata;

    // Get input data
    if (options.inputType === 'file') {
      const filePath = options.input as string;
      buffer = await fs.readFile(filePath);
      const stats = await fs.stat(filePath);

      metadata = {
        filename: filePath.split('/').pop(),
        size: buffer.length,
        created: stats.birthtime,
        modified: stats.mtime,
        mimeType: await this.mimeDetector.detectFromFile(filePath),
        hash: this.calculateBufferHash(buffer),
      };
    } else if (options.inputType === 'string') {
      buffer = Buffer.from(options.input as string, 'utf8');
      metadata = {
        size: buffer.length,
        mimeType: 'text/plain',
        hash: this.calculateBufferHash(buffer),
      };
    } else {
      // stdin
      buffer = options.input as Buffer;
      metadata = {
        size: buffer.length,
        mimeType: await this.mimeDetector.detectFromBuffer(buffer),
        hash: this.calculateBufferHash(buffer),
      };
    }

    // Convert
    let content: string | Buffer;
    if (options.mode === 'encode') {
      content = this.encodeBuffer(buffer, options.wrapAt);
    } else {
      content = this.decodeBase64(buffer.toString());
    }

    return {
      content,
      metadata,
      processingTime: 0,
      success: true,
    };
  }

  /**
   * Encode buffer to base64 with optional line wrapping
   */
  private encodeBuffer(buffer: Buffer, wrapAt?: number): string {
    const base64 = buffer.toString('base64');

    if (wrapAt && wrapAt > 0) {
      return base64.match(new RegExp(`.{1,${wrapAt}}`, 'g'))?.join('\n') || base64;
    }

    return base64;
  }

  /**
   * Decode base64 string to buffer
   */
  private decodeBase64(base64String: string): Buffer {
    // Clean the base64 string (remove whitespace, newlines)
    const cleaned = base64String.replace(/\s/g, '');

    // Validate base64 format
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
      throw new Error('Invalid base64 format');
    }

    return Buffer.from(cleaned, 'base64');
  }

  /**
   * Stream encode a file to base64
   */
  private async streamEncodeFile(filePath: string, chunkSize: number): Promise<string> {
    const chunks: string[] = [];

    const encodeTransform = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        const base64Chunk = chunk.toString('base64');
        callback(null, base64Chunk);
      },
      objectMode: false,
    });

    const readStream = createReadStream(filePath, { highWaterMark: chunkSize });

    return new Promise((resolve, reject) => {
      encodeTransform.on('data', (chunk) => {
        chunks.push(chunk.toString());
      });

      encodeTransform.on('end', () => {
        resolve(chunks.join(''));
      });

      encodeTransform.on('error', reject);

      readStream.pipe(encodeTransform);
    });
  }

  /**
   * Stream decode a base64 file
   */
  private async streamDecodeFile(filePath: string): Promise<Buffer> {
    const base64Content = await fs.readFile(filePath, 'utf8');
    return this.decodeBase64(base64Content);
  }

  /**
   * Calculate file hash for integrity checking
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);

    for await (const chunk of stream) {
      hash.update(chunk);
    }

    return hash.digest('hex');
  }

  /**
   * Calculate buffer hash
   */
  private calculateBufferHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Write output to file with streaming support
   */
  async writeOutput(content: string | Buffer, outputPath: string): Promise<void> {
    if (typeof content === 'string') {
      await fs.writeFile(outputPath, content, 'utf8');
    } else {
      await fs.writeFile(outputPath, content);
    }
  }

  /**
   * Write output using streams for large content
   */
  async writeOutputStreaming(content: string | Buffer, outputPath: string): Promise<void> {
    const writeStream = createWriteStream(outputPath);

    if (typeof content === 'string') {
      writeStream.write(content, 'utf8');
    } else {
      writeStream.write(content);
    }

    writeStream.end();

    return new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }
}
