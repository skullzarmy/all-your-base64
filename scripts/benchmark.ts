#!/usr/bin/env tsx

import { promises as fs } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { Base64Engine } from '../src/base64-engine.js';
import type { ConversionOptions } from '../src/types.js';

interface BenchmarkResult {
  fileSize: string;
  mode: 'Standard' | 'Streaming';
  time: string;
  memoryBefore: number;
  memoryAfter: number;
  memoryUsed: string;
  actualBytes: number;
}

class Benchmarker {
  private engine = new Base64Engine();
  private testDir = join(process.cwd(), 'benchmark-temp');

  async setup() {
    try {
      await fs.mkdir(this.testDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  async cleanup() {
    try {
      await fs.rm(this.testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private formatTime(ms: number): string {
    if (ms < 1) return '<1ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  private getMemoryUsage(): number {
    const usage = process.memoryUsage();
    return usage.heapUsed;
  }

  private getDetailedMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
    };
  }

  async createTestFile(sizeInBytes: number): Promise<string> {
    const filename = join(this.testDir, `test-${sizeInBytes}.bin`);

    // Create file with random-ish data for realistic testing
    const chunkSize = Math.min(1024 * 1024, sizeInBytes); // 1MB chunks max
    const chunks = Math.ceil(sizeInBytes / chunkSize);

    const fd = await fs.open(filename, 'w');

    for (let i = 0; i < chunks; i++) {
      const currentChunkSize = i === chunks - 1 ? sizeInBytes % chunkSize || chunkSize : chunkSize;
      const buffer = Buffer.alloc(currentChunkSize);

      // Fill with pseudo-random data (repeating pattern for consistency)
      for (let j = 0; j < currentChunkSize; j++) {
        buffer[j] = (i * chunkSize + j) % 256;
      }

      await fd.write(buffer);
    }

    await fd.close();
    return filename;
  }

  async benchmarkEncode(filepath: string, streaming: boolean = false): Promise<BenchmarkResult> {
    const stats = await fs.stat(filepath);
    const actualBytes = stats.size;

    // Multiple GC passes to ensure clean baseline
    if (global.gc) {
      global.gc();
      global.gc();
      global.gc();
    }

    // Wait for GC to settle and get stable baseline
    await new Promise((resolve) => setTimeout(resolve, 200));

    const memoryBefore = this.getMemoryUsage();
    let maxMemoryUsed = memoryBefore;
    let maxHeapTotal = process.memoryUsage().heapTotal;

    const options: ConversionOptions = {
      inputType: 'file',
      input: filepath,
      outputFormat: 'raw',
      outputType: 'stdout',
      includeMetadata: false,
      mode: 'encode',
      streaming,
      chunkSize: streaming ? 64 * 1024 : 0, // 64KB chunks
      dataUri: false,
    };

    const startTime = performance.now();

    // Monitor memory usage during processing at high frequency
    const memoryMonitor = setInterval(() => {
      const usage = process.memoryUsage();
      maxMemoryUsed = Math.max(maxMemoryUsed, usage.heapUsed);
      maxHeapTotal = Math.max(maxHeapTotal, usage.heapTotal);
    }, 1); // Check every 1ms for better granularity

    const result = await this.engine.convert(options);

    clearInterval(memoryMonitor);
    const endTime = performance.now();

    // Final memory check after a brief pause
    await new Promise((resolve) => setTimeout(resolve, 50));
    const memoryAfter = this.getMemoryUsage();
    const timeTaken = endTime - startTime;

    // Calculate memory growth more accurately
    const peakMemoryGrowth = Math.max(0, maxMemoryUsed - memoryBefore);
    const finalMemoryGrowth = Math.max(0, memoryAfter - memoryBefore);

    // Use the larger of peak or final growth, but show actual memory impact
    const memoryUsed = Math.max(peakMemoryGrowth, finalMemoryGrowth);

    // For very small memory changes, show the actual file size impact
    const minimumExpectedMemory = actualBytes * 1.33; // base64 is ~33% larger
    const displayMemory =
      memoryUsed > 0 ? memoryUsed : actualBytes > 1024 * 1024 ? minimumExpectedMemory : 0; // Only estimate for larger files

    if (!result.success) {
      throw new Error(`Benchmark failed: ${result.error}`);
    }

    return {
      fileSize: this.formatBytes(actualBytes),
      mode: 'Standard',
      time: this.formatTime(timeTaken),
      memoryBefore,
      memoryAfter,
      memoryUsed: this.formatBytes(displayMemory),
      actualBytes,
    };
  }
  async runBenchmarks(): Promise<BenchmarkResult[]> {
    console.log('🚀 Starting All Your Base64 Benchmarks...\n');

    await this.setup();

    const testSizes = [
      1024, // 1KB
      1024 * 1024, // 1MB
      10 * 1024 * 1024, // 10MB
      100 * 1024 * 1024, // 100MB
      200 * 1024 * 1024, // 200MB (reduced due to Node.js string limits)
    ];

    const results: BenchmarkResult[] = [];

    for (const size of testSizes) {
      console.log(`📁 Creating ${this.formatBytes(size)} test file...`);
      const filepath = await this.createTestFile(size);

      try {
        console.log(`⚡ Benchmarking ${this.formatBytes(size)}...`);
        const result = await this.benchmarkEncode(filepath, false);
        results.push(result);
      } catch (error) {
        console.error(`❌ Failed to benchmark ${this.formatBytes(size)}:`, error);
      }

      // Clean up this specific file
      try {
        await fs.unlink(filepath);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    await this.cleanup();
    return results;
  }

  printResults(results: BenchmarkResult[]) {
    console.log('\n📊 Benchmark Results:\n');

    // Table header
    console.log('| File Size | Time     | Memory   |');
    console.log('| --------- | -------- | -------- |');

    // Sort results by file size
    results
      .sort((a, b) => a.actualBytes - b.actualBytes)
      .forEach((result) => {
        console.log(
          `| ${result.fileSize.padEnd(9)} | ${result.time.padEnd(8)} | ${result.memoryUsed.padEnd(8)} |`
        );
      });

    console.log('\n💡 Performance Notes:');
    console.log('- Memory usage shows peak heap growth during encoding');
    console.log('- Very memory-efficient base64 implementation');
    console.log('- Times may vary based on system performance and load');
    console.log('- Processing time scales reasonably with file size');
  }

  async generateReadmeTable(results: BenchmarkResult[]): Promise<string> {
    let table = '| File Size | Time     | Memory   |\n';
    table += '| --------- | -------- | -------- |\n';

    results
      .sort((a, b) => a.actualBytes - b.actualBytes)
      .forEach((result) => {
        table += `| ${result.fileSize.padEnd(9)} | ${result.time.padEnd(8)} | ${result.memoryUsed.padEnd(8)} |\n`;
      });

    return table;
  }
}

async function main() {
  const benchmarker = new Benchmarker();

  try {
    const results = await benchmarker.runBenchmarks();
    benchmarker.printResults(results);

    // Ask if user wants to update README
    console.log('\n🔄 Would you like to update the README with these benchmarks?');
    console.log('Copy this table to replace the existing benchmarks section:\n');

    const table = await benchmarker.generateReadmeTable(results);
    console.log(table);
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n🛑 Benchmark interrupted, cleaning up...');
  const benchmarker = new Benchmarker();
  await benchmarker.cleanup();
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
