#!/usr/bin/env node

import { Command } from 'commander';
import { promises as fs } from 'fs';
import { stdin as processStdin, stdout } from 'process';
import { Base64Engine } from './base64-engine.js';
import { OutputFormatter } from './output-formatter.js';
import type { ConversionOptions, ConversionResult } from './types.js';

/**
 * All Your Base64 - Modern CLI utility for base64 conversion
 * "All your base64 are belong to us!"
 */

const program = new Command();
const engine = new Base64Engine();
const formatter = new OutputFormatter();

// ASCII art banner
const banner = `
╔══════════════════════════════════════════════════════════════╗
║  All Your Base64 - Modern Base64 Conversion Utility         ║
║  "All your base64 are belong to us!"                        ║
╚══════════════════════════════════════════════════════════════╝
`;

program
  .name('ayb64')
  .description(
    'Modern, efficient, purpose-built CLI utility to convert any possible input file into a base64 string.'
  )
  .version('1.0.0')
  .option('--banner', 'Show banner', false)
  .addHelpText(
    'afterAll',
    `

Output Formats (for --format/-f):

  raw        - Plain base64 string (default)
  json       - JSON object with base64 and metadata
  js         - JavaScript module: const base64Data = "..."
  ts         - TypeScript module: export const base64Data: string = "..."
  css        - CSS custom property: --base64-content: "..."
  html       - HTML snippet with base64 data
  xml        - XML with <base64-data>
  yaml/yml   - YAML with base64_data: |
  markdown/md- Markdown code block

Special options:
  --data-uri   - Output as data URI (data:<mime>;base64,...)

Examples:
  ayb64 encode file.png --format js
    // => const base64Data = "...";
  ayb64 encode file.png --data-uri
    // => data:image/png;base64,...
  ayb64 encode file.txt --format html --metadata
    // => <div class="base64-data" data-content="..."></div>

See README.md for full documentation and more examples.
`
  );

interface CliOptions {
  output?: string;
  format?: string;
  wrap?: number;
  dataUri?: boolean;
  metadata?: boolean;
  streaming?: boolean;
  chunkSize?: string;
  quiet?: boolean;
  json?: boolean;
  outputDir?: string;
  extension?: string;
  decode?: boolean;
  parallel?: number;
  banner?: boolean;
}

// Main conversion command
program
  .command('encode')
  .alias('e')
  .description('Encode input to base64')
  .argument('[input]', 'Input file path (use - for stdin)')
  .option('-o, --output <path>', 'Output file path (default: stdout)')
  .option(
    '-f, --format <format>',
    'Output format: raw, json, js, ts, css, html, xml, yaml, md',
    'raw'
  )
  .option('-w, --wrap <columns>', 'Wrap base64 output at specified column width', parseInt)
  .option('-d, --data-uri', 'Generate data URI with MIME type', false)
  .option('-m, --metadata', 'Include file metadata in output', false)
  .option('-s, --streaming', 'Use streaming for large files', false)
  .option('-c, --chunk-size <bytes>', 'Chunk size for streaming (bytes)', '64KB')
  .option('--no-mime', 'Disable MIME type detection')
  .option('--quiet', 'Suppress non-essential output', false)
  .action(async (input: string | undefined, options: CliOptions) => {
    try {
      if (options.banner || (!input && !options.quiet)) {
        console.log(banner);
      }

      const conversionOptions = await buildConversionOptions('encode', input, options);
      const result = await engine.convert(conversionOptions);

      if (!result.success) {
        console.error('Error:', result.error);
        process.exit(1);
      }

      const formattedOutput = await formatter.format(result, options.format, {
        dataUri: options.dataUri,
        includeMetadata: options.metadata,
        wrapAt: options.wrap,
      });

      if (options.output) {
        await fs.writeFile(options.output, formattedOutput);
        if (!options.quiet) {
          console.log('✓', `Encoded to ${options.output}`);
          if (options.metadata) {
            displayMetadata(result);
          }
        }
      } else {
        stdout.write(formattedOutput);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Decode command
program
  .command('decode')
  .alias('d')
  .description('Decode base64 input')
  .argument('[input]', 'Input file path or base64 string (use - for stdin)')
  .option('-o, --output <path>', 'Output file path (default: stdout)')
  .option('-s, --streaming', 'Use streaming for large files', false)
  .option('-m, --metadata', 'Show metadata if available', false)
  .option('--quiet', 'Suppress non-essential output', false)
  .action(async (input: string | undefined, options: CliOptions) => {
    try {
      if (options.banner || (!input && !options.quiet)) {
        console.log(banner);
      }

      const conversionOptions = await buildConversionOptions('decode', input, options);
      const result = await engine.convert(conversionOptions);

      if (!result.success) {
        console.error('Error:', result.error);
        process.exit(1);
      }

      if (options.output) {
        if (typeof result.content === 'string') {
          await fs.writeFile(options.output, result.content);
        } else {
          await fs.writeFile(options.output, result.content);
        }
        if (!options.quiet) {
          console.log('✓', `Decoded to ${options.output}`);
          if (options.metadata) {
            displayMetadata(result);
          }
        }
      } else {
        if (typeof result.content === 'string') {
          stdout.write(result.content);
        } else {
          stdout.write(result.content);
        }
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Info command - analyze file without conversion
program
  .command('info')
  .alias('i')
  .description('Display file information and metadata')
  .argument('<input>', 'Input file path')
  .option('-j, --json', 'Output as JSON', false)
  .action(async (input: string, options: CliOptions) => {
    try {
      const conversionOptions: ConversionOptions = {
        inputType: 'file',
        input,
        outputFormat: 'raw',
        outputType: 'stdout',
        includeMetadata: true,
        mode: 'encode',
        streaming: false,
        chunkSize: 65536,
        dataUri: false,
      };

      const result = await engine.convert(conversionOptions);

      if (!result.success) {
        console.error('Error:', result.error);
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(result.metadata, null, 2));
      } else {
        displayMetadata(result);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Batch processing command
program
  .command('batch')
  .alias('b')
  .description('Process multiple files in batch')
  .argument('<pattern>', 'Glob pattern for input files')
  .option('-o, --output-dir <dir>', 'Output directory', './output')
  .option('-f, --format <format>', 'Output format: raw, json, js, css, html, xml', 'raw')
  .option('-e, --extension <ext>', 'Output file extension', '.b64')
  .option('--decode', 'Decode instead of encode', false)
  .option('--parallel <count>', 'Number of parallel processes', '4')
  .action(async (_pattern: string, _options: CliOptions) => {
    console.log('Batch processing will be implemented in a future version');
    // TODO: Implement batch processing with glob support
  });

// MCP Server command
program
  .command('mcp')
  .description('Start the Model Context Protocol server for AI agents')
  .action(async () => {
    // Import and start the MCP server
    const { spawn } = await import('child_process');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const mcpServerPath = path.join(__dirname, 'mcp-server.js');

    try {
      // Check if built version exists, otherwise use tsx with source
      const fs = await import('fs');
      if (fs.existsSync(mcpServerPath)) {
        spawn('node', [mcpServerPath], { stdio: 'inherit' });
      } else {
        spawn('npx', ['tsx', path.join(__dirname, '../src/mcp-server.ts')], { stdio: 'inherit' });
      }
    } catch (error) {
      console.error('Failed to start MCP server:', error);
      process.exit(1);
    }
  });

// Utility functions
async function buildConversionOptions(
  mode: 'encode' | 'decode',
  input: string | undefined,
  options: CliOptions
): Promise<ConversionOptions> {
  let inputType: 'file' | 'string' | 'stdin';
  let inputContent: string | Buffer;

  // Determine input source
  if (!input || input === '-') {
    inputType = 'stdin';
    inputContent = await readStdin();
  } else if (await isFile(input)) {
    inputType = 'file';
    inputContent = input;
  } else {
    inputType = 'string';
    inputContent = input;
  }

  // Parse chunk size
  const chunkSize = parseChunkSize(options.chunkSize || '64KB');

  return {
    inputType,
    input: inputContent,
    outputFormat: (options.format || 'raw') as 'raw' | 'json' | 'js' | 'css' | 'html' | 'xml',
    outputType: options.output ? 'file' : 'stdout',
    outputPath: options.output,
    includeMetadata: options.metadata || false,
    wrapAt: options.wrap,
    dataUri: options.dataUri || false,
    mode,
    streaming: options.streaming || false,
    chunkSize,
  };
}

async function readStdin(): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of processStdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function isFile(path: string): Promise<boolean> {
  try {
    const stats = await fs.stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
}

function parseChunkSize(size: string): number {
  const units: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
  };

  const match = size.match(/^(\d+)\s*(B|KB|MB|GB)?$/i);
  if (!match) {
    throw new Error(`Invalid chunk size format: ${size}`);
  }

  const value = parseInt(match[1]);
  const unit = (match[2] || 'B').toUpperCase();

  return value * (units[unit] || 1);
}

function displayMetadata(result: ConversionResult) {
  console.log('\nFile Information:');
  console.log('├─ Size:', formatBytes(result.metadata.size));
  if (result.metadata.mimeType) {
    console.log('├─ MIME Type:', result.metadata.mimeType);
  }
  if (result.metadata.filename) {
    console.log('├─ Filename:', result.metadata.filename);
  }
  if (result.metadata.hash) {
    console.log('├─ SHA256:', result.metadata.hash.slice(0, 16) + '...');
  }
  if (result.metadata.created) {
    console.log('├─ Created:', result.metadata.created.toISOString());
  }
  if (result.metadata.modified) {
    console.log('├─ Modified:', result.metadata.modified.toISOString());
  }
  console.log('└─ Processing Time:', `${result.processingTime}ms`);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  console.error('Fatal Error:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
  process.exit(1);
});

// Parse command line arguments
program.parse(process.argv);
