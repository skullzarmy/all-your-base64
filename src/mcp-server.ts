#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createHash } from 'crypto';
import { lookup } from 'mime-types';
import { Base64Engine } from './base64-engine.js';
import { OutputFormatter } from './output-formatter.js';
import { MimeTypeDetector } from './mime-detector.js';
import type { ConversionResult } from './types.js';

/**
 * All Your Base64 MCP Server
 * Optimized for AI agents and coding tasks with memory, job recall, and checksums
 */

// In-memory job storage with checksums for file change detection
interface JobRecord {
  id: string;
  result: ConversionResult;
  checksum: string;
  format: string;
  options: {
    dataUri?: boolean;
    includeMetadata?: boolean;
    wrapAt?: number;
  };
  timestamp: Date;
  filename?: string;
}

class JobMemory {
  private jobs = new Map<string, JobRecord>();
  private readonly maxJobs = 1000; // Prevent memory bloat

  set(job: JobRecord): void {
    // LRU eviction if at capacity
    if (this.jobs.size >= this.maxJobs) {
      const oldestKey = this.jobs.keys().next().value;
      if (oldestKey) {
        this.jobs.delete(oldestKey);
      }
    }
    this.jobs.set(job.id, job);
  }

  get(id: string): JobRecord | undefined {
    const job = this.jobs.get(id);
    if (job) {
      // Move to end (LRU)
      this.jobs.delete(id);
      this.jobs.set(id, job);
    }
    return job;
  }

  list(): JobRecord[] {
    return Array.from(this.jobs.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  has(id: string): boolean {
    return this.jobs.has(id);
  }

  clear(): void {
    this.jobs.clear();
  }

  size(): number {
    return this.jobs.size;
  }
}

// Initialize components
const engine = new Base64Engine();
const formatter = new OutputFormatter();
const mimeDetector = new MimeTypeDetector();
const jobMemory = new JobMemory();

// Utility functions
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function calculateChecksum(data: string | Buffer): string {
  const hash = createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}

async function detectFileType(filename?: string, data?: Buffer): Promise<string> {
  if (!filename && !data) return 'application/octet-stream';

  if (data) {
    try {
      return await mimeDetector.detectFromBuffer(data);
    } catch {
      // Fall back to extension detection
    }
  }

  if (filename) {
    return lookup(filename) || 'application/octet-stream';
  }

  return 'application/octet-stream';
}

// Create MCP server
const server = new McpServer({
  name: 'ayb64-mcp',
  version: '1.0.0',
});

// Tool: Encode data to base64
server.registerTool(
  'encode',
  {
    title: 'Base64 Encode',
    description:
      'Encode text, files, or binary data to base64. Optimized for AI coding tasks with job recall and change detection.',
    inputSchema: {
      data: z.string().describe('Raw string data, file path, or base64-encoded binary data'),
      filename: z.string().optional().describe('Optional filename for MIME detection and context'),
      format: z
        .enum(['raw', 'json', 'js', 'ts', 'css', 'html', 'xml', 'yaml', 'md'])
        .default('raw')
        .describe('Output format'),
      dataUri: z.boolean().default(false).describe('Generate data URI with MIME type'),
      includeMetadata: z.boolean().default(false).describe('Include file metadata in output'),
      wrapAt: z.number().optional().describe('Wrap base64 output at specified column width'),
      isFile: z.boolean().default(false).describe('Treat data as file path (for file reading)'),
    },
  },
  async ({ data, filename, format, dataUri, includeMetadata, wrapAt, isFile }) => {
    try {
      let inputContent: string | Buffer = data;
      let actualFilename = filename;

      // If treating as file path, read the file
      if (isFile) {
        const fs = await import('fs/promises');
        try {
          const fileBuffer = await fs.readFile(data);
          inputContent = fileBuffer;
          actualFilename = actualFilename || data.split('/').pop() || 'file';
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      }

      // Calculate checksum for change detection
      const checksum = calculateChecksum(inputContent);

      // Check if we've already processed this exact data
      const existingJob = Array.from(jobMemory.list()).find(
        (job) =>
          job.checksum === checksum &&
          job.format === format &&
          JSON.stringify(job.options) === JSON.stringify({ dataUri, includeMetadata, wrapAt })
      );

      if (existingJob) {
        return {
          content: [
            {
              type: 'text',
              text: `Recalled from cache (job ${existingJob.id}):\n\n${existingJob.result.content}`,
            },
          ],
        };
      }

      // Perform encoding
      const conversionOptions = {
        inputType: 'string' as const,
        input: inputContent,
        outputFormat: format as 'raw' | 'json' | 'js' | 'css' | 'html' | 'xml',
        outputType: 'stdout' as const,
        includeMetadata: includeMetadata || false,
        wrapAt,
        dataUri: dataUri || false,
        mode: 'encode' as const,
        streaming: false,
        chunkSize: 65536,
      };

      const result = await engine.convert(conversionOptions);

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Encoding error: ${result.error}`,
            },
          ],
          isError: true,
        };
      }

      // Format output
      const formattedOutput = await formatter.format(result, format, {
        dataUri,
        includeMetadata,
        wrapAt,
      });

      // Store job for recall
      const jobId = generateJobId();
      const jobRecord: JobRecord = {
        id: jobId,
        result,
        checksum,
        format,
        options: { dataUri, includeMetadata, wrapAt },
        timestamp: new Date(),
        filename: actualFilename,
      };

      jobMemory.set(jobRecord);

      return {
        content: [
          {
            type: 'text',
            text: `Job ID: ${jobId}\nChecksum: ${checksum.slice(0, 16)}...\n${actualFilename ? `File: ${actualFilename}\n` : ''}MIME: ${result.metadata.mimeType || 'unknown'}\n\n${formattedOutput}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Decode base64 data
server.registerTool(
  'decode',
  {
    title: 'Base64 Decode',
    description: 'Decode base64 data back to original format',
    inputSchema: {
      data: z.string().describe('Base64 string to decode'),
      outputFile: z.string().optional().describe('Optional output file path'),
      detectType: z.boolean().default(true).describe('Auto-detect content type from decoded data'),
    },
  },
  async ({ data, outputFile, detectType }) => {
    try {
      const conversionOptions = {
        inputType: 'string' as const,
        input: data,
        outputFormat: 'raw' as const,
        outputType: outputFile ? ('file' as const) : ('stdout' as const),
        outputPath: outputFile,
        includeMetadata: false,
        dataUri: false,
        mode: 'decode' as const,
        streaming: false,
        chunkSize: 65536,
      };

      const result = await engine.convert(conversionOptions);

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Decoding error: ${result.error}`,
            },
          ],
          isError: true,
        };
      }

      let response = `Successfully decoded ${data.length} base64 characters`;

      if (outputFile) {
        response += ` to file: ${outputFile}`;
      } else {
        const decodedContent =
          typeof result.content === 'string' ? result.content : result.content.toString();
        response += `\n\nDecoded content:\n${decodedContent}`;
      }

      if (detectType && typeof result.content !== 'string') {
        const detectedType = await detectFileType(outputFile, result.content);
        response += `\nDetected MIME type: ${detectedType}`;
      }

      return {
        content: [
          {
            type: 'text',
            text: response,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Recall job by ID
server.registerTool(
  'recall',
  {
    title: 'Recall Job',
    description: 'Retrieve a previous encoding job by ID',
    inputSchema: {
      jobId: z.string().describe('Job ID to recall'),
    },
  },
  async ({ jobId }) => {
    const job = jobMemory.get(jobId);

    if (!job) {
      return {
        content: [
          {
            type: 'text',
            text: `Job not found: ${jobId}\n\nAvailable jobs: ${jobMemory
              .list()
              .slice(0, 5)
              .map((j) => j.id)
              .join(', ')}`,
          },
        ],
        isError: true,
      };
    }

    const formattedOutput = await formatter.format(job.result, job.format, job.options);

    return {
      content: [
        {
          type: 'text',
          text: `Recalled job: ${job.id}\nTimestamp: ${job.timestamp.toISOString()}\nChecksum: ${job.checksum.slice(0, 16)}...\n${job.filename ? `File: ${job.filename}\n` : ''}Format: ${job.format}\n\n${formattedOutput}`,
        },
      ],
    };
  }
);

// Tool: List recent jobs
server.registerTool(
  'jobs',
  {
    title: 'List Jobs',
    description: 'List recent encoding jobs with metadata',
    inputSchema: {
      limit: z.number().min(1).max(50).default(10).describe('Maximum number of jobs to return'),
    },
  },
  async ({ limit }) => {
    const jobs = jobMemory.list().slice(0, limit);

    if (jobs.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No jobs found in memory.',
          },
        ],
      };
    }

    const jobsList = jobs
      .map(
        (job) =>
          `${job.id}: ${job.filename || 'unnamed'} (${job.format}${job.options.dataUri ? ', data-uri' : ''}) - ${job.timestamp.toLocaleString()}`
      )
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Recent jobs (${jobs.length}/${jobMemory.size()}):\n\n${jobsList}\n\nUse 'recall' tool with job ID to retrieve full output.`,
        },
      ],
    };
  }
);

// Tool: Generate data URI from file
server.registerTool(
  'datauri',
  {
    title: 'Generate Data URI',
    description: 'Create a data URI from file path or base64 data, optimized for web development',
    inputSchema: {
      input: z.string().describe('File path or base64 string'),
      isFile: z.boolean().default(true).describe('Treat input as file path'),
      mimeType: z.string().optional().describe('Override MIME type detection'),
    },
  },
  async ({ input, isFile, mimeType }) => {
    try {
      let data: Buffer;
      let detectedMime: string;

      if (isFile) {
        const fs = await import('fs/promises');
        data = await fs.readFile(input);
        detectedMime = mimeType || (await detectFileType(input, data));
      } else {
        data = Buffer.from(input, 'base64');
        detectedMime = mimeType || (await detectFileType(undefined, data));
      }

      const base64 = data.toString('base64');
      const dataUri = `data:${detectedMime};base64,${base64}`;
      const checksum = calculateChecksum(data);

      // Store job
      const jobId = generateJobId();
      const result: ConversionResult = {
        content: base64,
        metadata: {
          filename: isFile ? input.split('/').pop() : undefined,
          mimeType: detectedMime,
          size: data.length,
          hash: checksum,
        },
        processingTime: 0,
        success: true,
      };

      const jobRecord: JobRecord = {
        id: jobId,
        result,
        checksum,
        format: 'datauri',
        options: { dataUri: true },
        timestamp: new Date(),
        filename: isFile ? input : undefined,
      };

      jobMemory.set(jobRecord);

      return {
        content: [
          {
            type: 'text',
            text: `Job ID: ${jobId}\nData URI (${dataUri.length} chars):\n\n${dataUri}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Memory management
server.registerTool(
  'memory',
  {
    title: 'Memory Management',
    description: 'Manage job memory (clear, stats, etc.)',
    inputSchema: {
      action: z.enum(['stats', 'clear']).describe('Action to perform'),
    },
  },
  async ({ action }) => {
    switch (action) {
      case 'stats': {
        const jobs = jobMemory.list();
        const totalSize = jobs.reduce((sum, job) => sum + (job.result.metadata.size || 0), 0);
        return {
          content: [
            {
              type: 'text',
              text: `Memory Statistics:\n- Jobs stored: ${jobMemory.size()}\n- Total data size: ${totalSize} bytes\n- Memory limit: 1000 jobs\n- Oldest job: ${jobs[jobs.length - 1]?.timestamp.toLocaleString() || 'None'}\n- Newest job: ${jobs[0]?.timestamp.toLocaleString() || 'None'}`,
            },
          ],
        };
      }

      case 'clear': {
        const clearedCount = jobMemory.size();
        jobMemory.clear();
        return {
          content: [
            {
              type: 'text',
              text: `Cleared ${clearedCount} jobs from memory.`,
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: 'Unknown action. Use "stats" or "clear".',
            },
          ],
          isError: true,
        };
    }
  }
);

// Connect and start server
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('All Your Base64 MCP Server is running...');
    console.error('Tools available: encode, decode, recall, jobs, datauri, memory');
    console.error('Optimized for AI agents with memory, job recall, and file checksums');
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { server, jobMemory };
