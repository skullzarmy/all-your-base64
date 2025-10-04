/**
 * Simple error handling and validation for All Your Base64
 */

export class ValidationError extends Error {
  constructor(
    message: string,
    public code: string = 'VALIDATION_ERROR'
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class FileSystemError extends Error {
  constructor(
    message: string,
    public code: string = 'FILESYSTEM_ERROR',
    public path?: string
  ) {
    super(message);
    this.name = 'FileSystemError';
  }
}

export class ConversionError extends Error {
  constructor(
    message: string,
    public code: string = 'CONVERSION_ERROR'
  ) {
    super(message);
    this.name = 'ConversionError';
  }
}

/**
 * Handle and format errors for user display
 */
export function handleError(error: unknown): {
  message: string;
  code: string;
  suggestions?: string[];
} {
  if (error instanceof ValidationError) {
    return {
      message: error.message,
      code: error.code,
      suggestions: getSuggestions(error.code),
    };
  }

  if (error instanceof FileSystemError) {
    return {
      message: error.message,
      code: error.code,
      suggestions: getFileSystemSuggestions(error.code, error.path),
    };
  }

  if (error instanceof ConversionError) {
    return {
      message: error.message,
      code: error.code,
      suggestions: getConversionSuggestions(error.code),
    };
  }

  // Handle Node.js errors
  if (error instanceof Error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code) {
      return {
        message: `System error: ${error.message}`,
        code: nodeError.code,
        suggestions: getSystemErrorSuggestions(nodeError.code),
      };
    }
  }

  // Unknown error
  return {
    message: error instanceof Error ? error.message : 'Unknown error occurred',
    code: 'UNKNOWN_ERROR',
    suggestions: ['Please report this issue with steps to reproduce'],
  };
}

function getSuggestions(code: string): string[] {
  const suggestions: Record<string, string[]> = {
    INVALID_PATH: ['Ensure the file path is correct and the file exists'],
    INVALID_BASE64_FORMAT: ['Check that the base64 string contains only valid characters'],
    UNSUPPORTED_FORMAT: ['Use --help to see supported output formats'],
    FILE_TOO_LARGE: ['Use --streaming option for large files'],
  };
  return suggestions[code] || [];
}

function getFileSystemSuggestions(code: string, path?: string): string[] {
  const suggestions: Record<string, string[]> = {
    FILE_NOT_FOUND: ['Check that the file path is correct', 'Ensure the file exists'],
    ACCESS_DENIED: ['Check file permissions', 'Run with appropriate privileges if needed'],
  };
  const baseSuggestions = suggestions[code] || [];
  if (path) {
    baseSuggestions.push(`Path: ${path}`);
  }
  return baseSuggestions;
}

function getConversionSuggestions(code: string): string[] {
  const suggestions: Record<string, string[]> = {
    ENCODING_FAILED: ['Check that the input data is valid'],
    DECODING_FAILED: ['Verify the base64 input is properly formatted'],
  };
  return suggestions[code] || [];
}

function getSystemErrorSuggestions(code: string): string[] {
  const suggestions: Record<string, string[]> = {
    ENOENT: ['File or directory not found'],
    EACCES: ['Permission denied - check file/directory permissions'],
    ENOSPC: ['No space left on device'],
  };
  return suggestions[code] || [];
}

/**
 * Safe execution wrapper for async operations
 */
export async function safeExecute<T>(
  operation: () => Promise<T>,
  errorContext: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const handled = handleError(error);
    throw new Error(`${errorContext}: ${handled.message}`);
  }
}
