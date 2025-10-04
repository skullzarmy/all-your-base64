import { fileTypeFromFile, fileTypeFromBuffer } from 'file-type';
import { lookup } from 'mime-types';

/**
 * Simple MIME type detection using proven packages
 */
export class MimeTypeDetector {
  /**
   * Detect MIME type from file path
   */
  async detectFromFile(filePath: string): Promise<string> {
    try {
      // Try magic number detection first
      const fileType = await fileTypeFromFile(filePath);
      if (fileType) {
        return fileType.mime;
      }

      // Fallback to extension-based detection
      return lookup(filePath) || 'application/octet-stream';
    } catch {
      return lookup(filePath) || 'application/octet-stream';
    }
  }

  /**
   * Detect MIME type from buffer
   */
  async detectFromBuffer(buffer: Buffer): Promise<string> {
    try {
      const fileType = await fileTypeFromBuffer(buffer);
      return fileType?.mime || 'application/octet-stream';
    } catch {
      return 'application/octet-stream';
    }
  }
}
