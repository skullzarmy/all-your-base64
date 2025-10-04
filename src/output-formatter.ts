import type { ConversionResult, OutputFormatConfig } from './types.js';

/**
 * Comprehensive output formatter for various formats
 */
export class OutputFormatter {
  private readonly formatConfigs: Map<string, OutputFormatConfig> = new Map([
    [
      'raw',
      {
        template: '{content}',
        extension: '.b64',
        mimeType: 'text/plain',
      },
    ],
    [
      'json',
      {
        template: '{"data":"{content}","metadata":{metadata}}',
        extension: '.json',
        mimeType: 'application/json',
      },
    ],
    [
      'js',
      {
        template: 'const base64Data = "{content}";',
        extension: '.js',
        mimeType: 'application/javascript',
      },
    ],
    [
      'css',
      {
        template: '.base64-data::before { content: "{content}"; }',
        extension: '.css',
        mimeType: 'text/css',
      },
    ],
    [
      'html',
      {
        template: '<div class="base64-data" data-content="{content}"></div>',
        extension: '.html',
        mimeType: 'text/html',
      },
    ],
    [
      'xml',
      {
        template: '<base64>{content}</base64>',
        extension: '.xml',
        mimeType: 'application/xml',
      },
    ],
  ]);

  /**
   * Format conversion result according to specified format
   */
  async format(
    result: ConversionResult,
    format: string = 'raw',
    options: {
      dataUri?: boolean;
      includeMetadata?: boolean;
      wrapAt?: number;
    } = {}
  ): Promise<string> {
    let content = typeof result.content === 'string' ? result.content : result.content.toString();

    // Apply line wrapping if specified
    if (options.wrapAt && options.wrapAt > 0) {
      content = this.wrapContent(content, options.wrapAt);
    }

    // Create data URI if requested
    if (options.dataUri && result.metadata.mimeType) {
      content = `data:${result.metadata.mimeType};base64,${content}`;
    }

    // Apply format template
    switch (format.toLowerCase()) {
      case 'raw':
        return content;

      case 'json':
        return this.formatAsJson(content, result, options.includeMetadata);

      case 'js':
      case 'javascript':
        return this.formatAsJavaScript(content, result, options.includeMetadata);

      case 'ts':
      case 'typescript':
        return this.formatAsTypeScript(content, result, options.includeMetadata);

      case 'css':
        return this.formatAsCss(content, result);

      case 'html':
        return this.formatAsHtml(content, result, options.includeMetadata);

      case 'xml':
        return this.formatAsXml(content, result, options.includeMetadata);

      case 'yaml':
      case 'yml':
        return this.formatAsYaml(content, result, options.includeMetadata);

      case 'markdown':
      case 'md':
        return this.formatAsMarkdown(content, result, options.includeMetadata);

      default:
        throw new Error(`Unsupported output format: ${format}`);
    }
  }

  private wrapContent(content: string, wrapAt: number): string {
    return content.match(new RegExp(`.{1,${wrapAt}}`, 'g'))?.join('\n') || content;
  }

  private formatAsJson(
    content: string,
    result: ConversionResult,
    includeMetadata?: boolean
  ): string {
    const output: Record<string, unknown> = {
      data: content,
      size: content.length,
    };

    if (includeMetadata) {
      output.metadata = {
        ...result.metadata,
        processingTime: result.processingTime,
      };
    }

    return JSON.stringify(output, null, 2);
  }

  private formatAsJavaScript(
    content: string,
    result: ConversionResult,
    includeMetadata?: boolean
  ): string {
    let output = `const base64Data = "${this.escapeForJs(content)}";\n`;

    if (includeMetadata) {
      output += `\nconst metadata = ${JSON.stringify(result.metadata, null, 2)};\n`;
      output += `\nmodule.exports = { base64Data, metadata };\n`;
    } else {
      output += `\nmodule.exports = base64Data;\n`;
    }

    return output;
  }

  private formatAsTypeScript(
    content: string,
    result: ConversionResult,
    includeMetadata?: boolean
  ): string {
    let output = `export const base64Data: string = "${this.escapeForJs(content)}";\n`;

    if (includeMetadata) {
      output += `\nexport interface FileMetadata {\n`;
      output += `  filename?: string;\n`;
      output += `  mimeType?: string;\n`;
      output += `  size: number;\n`;
      output += `  created?: string;\n`;
      output += `  modified?: string;\n`;
      output += `  hash?: string;\n`;
      output += `}\n\n`;
      output += `export const metadata: FileMetadata = ${JSON.stringify(result.metadata, null, 2)};\n`;
    }

    return output;
  }

  private formatAsCss(content: string, _result: ConversionResult): string {
    const safeContent = this.escapeForCss(content);
    return (
      `.base64-data {\n  --base64-content: "${safeContent}";\n}\n\n` +
      `.base64-data::before {\n  content: var(--base64-content);\n}\n`
    );
  }

  private formatAsHtml(
    content: string,
    result: ConversionResult,
    includeMetadata?: boolean
  ): string {
    const safeContent = this.escapeForHtml(content);

    let output = `<!DOCTYPE html>\n<html lang="en">\n<head>\n`;
    output += `  <meta charset="UTF-8">\n`;
    output += `  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n`;
    output += `  <title>Base64 Data</title>\n`;
    output += `</head>\n<body>\n`;
    output += `  <div class="base64-data" data-content="${safeContent}"></div>\n`;

    if (includeMetadata) {
      output += `  <div class="metadata">\n`;
      output += `    <h3>File Information</h3>\n`;
      if (result.metadata.filename) {
        output += `    <p><strong>Filename:</strong> ${this.escapeForHtml(result.metadata.filename)}</p>\n`;
      }
      if (result.metadata.mimeType) {
        output += `    <p><strong>MIME Type:</strong> ${result.metadata.mimeType}</p>\n`;
      }
      output += `    <p><strong>Size:</strong> ${result.metadata.size} bytes</p>\n`;
      output += `  </div>\n`;
    }

    output += `</body>\n</html>\n`;
    return output;
  }

  private formatAsXml(
    content: string,
    result: ConversionResult,
    includeMetadata?: boolean
  ): string {
    const safeContent = this.escapeForXml(content);

    let output = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    output += `<base64-data>\n`;
    output += `  <content>${safeContent}</content>\n`;

    if (includeMetadata) {
      output += `  <metadata>\n`;
      if (result.metadata.filename) {
        output += `    <filename>${this.escapeForXml(result.metadata.filename)}</filename>\n`;
      }
      if (result.metadata.mimeType) {
        output += `    <mime-type>${result.metadata.mimeType}</mime-type>\n`;
      }
      output += `    <size>${result.metadata.size}</size>\n`;
      if (result.metadata.hash) {
        output += `    <hash>${result.metadata.hash}</hash>\n`;
      }
      output += `  </metadata>\n`;
    }

    output += `</base64-data>\n`;
    return output;
  }

  private formatAsYaml(
    content: string,
    result: ConversionResult,
    includeMetadata?: boolean
  ): string {
    let output = `base64_data: |\n`;
    const lines = this.wrapContent(content, 76).split('\n');
    for (const line of lines) {
      output += `  ${line}\n`;
    }

    if (includeMetadata) {
      output += `\nmetadata:\n`;
      if (result.metadata.filename) {
        output += `  filename: "${result.metadata.filename}"\n`;
      }
      if (result.metadata.mimeType) {
        output += `  mime_type: "${result.metadata.mimeType}"\n`;
      }
      output += `  size: ${result.metadata.size}\n`;
      if (result.metadata.hash) {
        output += `  hash: "${result.metadata.hash}"\n`;
      }
    }

    return output;
  }

  private formatAsMarkdown(
    content: string,
    result: ConversionResult,
    includeMetadata?: boolean
  ): string {
    let output = `# Base64 Data\n\n`;

    if (includeMetadata && result.metadata.filename) {
      output += `## File: ${result.metadata.filename}\n\n`;
    }

    output += `\`\`\`base64\n`;
    output += this.wrapContent(content, 76);
    output += `\n\`\`\`\n`;

    if (includeMetadata) {
      output += `\n## Metadata\n\n`;
      if (result.metadata.mimeType) {
        output += `- **MIME Type:** ${result.metadata.mimeType}\n`;
      }
      output += `- **Size:** ${result.metadata.size} bytes\n`;
      if (result.metadata.hash) {
        output += `- **SHA256:** \`${result.metadata.hash}\`\n`;
      }
      output += `- **Processing Time:** ${result.processingTime}ms\n`;
    }

    return output;
  }

  // Escape functions for different formats
  private escapeForJs(content: string): string {
    return content.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  private escapeForCss(content: string): string {
    return content.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private escapeForHtml(content: string): string {
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  private escapeForXml(content: string): string {
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Get available output formats
   */
  getAvailableFormats(): string[] {
    return Array.from(this.formatConfigs.keys()).concat([
      'typescript',
      'ts',
      'yaml',
      'yml',
      'markdown',
      'md',
    ]);
  }

  /**
   * Get format configuration
   */
  getFormatConfig(format: string): OutputFormatConfig | undefined {
    return this.formatConfigs.get(format.toLowerCase());
  }
}
