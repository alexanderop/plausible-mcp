// Debug utility for comprehensive stdio transport logging
import { inspect } from 'util';

const DEBUG = process.env.DEBUG_STDIO === 'true';
const LOG_FILE = process.env.DEBUG_LOG_FILE;

let fileStream: NodeJS.WritableStream | null = null;

// Initialize file stream synchronously
if (LOG_FILE) {
  void import('fs').then(fs => {
    fileStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
  }).catch((err: unknown) => {
    console.error('Failed to create log file stream:', err);
  });
}

export type LogEntry = {
  timestamp: string;
  type: 'server' | 'client';
  category: 'stdio' | 'transport' | 'message' | 'error' | 'lifecycle';
  direction?: 'in' | 'out';
  event: string;
  data?: any;
  error?: any;
  metadata?: {
    pid?: number;
    memory?: NodeJS.MemoryUsage;
    [key: string]: any;
  };
}

export class StdioLogger {
  private readonly instanceId: string;
  private messageCounter = 0;
  private readonly startTime = Date.now();

  constructor(private readonly type: 'server' | 'client') {
    this.instanceId = `${type}-${process.pid}-${Date.now()}`;
    this.log('lifecycle', 'init', `${type} logger initialized`, {
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      debugEnabled: DEBUG,
      logFile: LOG_FILE
    });
  }

  private formatMessage(entry: LogEntry): string {
    const elapsed = Date.now() - this.startTime;
    const prefix = `[${entry.timestamp}] [${elapsed}ms] [${entry.type.toUpperCase()}] [${entry.category}]`;
    const direction = entry.direction ? ` [${entry.direction === 'in' ? '←' : '→'}]` : '';
    let message = `${prefix}${direction} ${entry.event}`;
    
    if (entry.data !== undefined) {
      const dataStr = typeof entry.data === 'string' 
        ? entry.data 
        : inspect(entry.data, { depth: 3, colors: true, compact: false });
      message += `\n  DATA: ${dataStr}`;
    }
    
    if (entry.error) {
      message += `\n  ERROR: ${entry.error.message || entry.error}`;
      if (entry.error.stack) {
        message += `\n  STACK: ${entry.error.stack}`;
      }
    }
    
    if (entry.metadata) {
      message += `\n  META: ${inspect(entry.metadata, { depth: 2, colors: true })}`;
    }
    
    return message;
  }

  private writeLog(entry: LogEntry): void {
    if (!DEBUG) return;
    
    const message = this.formatMessage(entry);
    
    // Write to stderr (so it doesn't interfere with stdio transport)
    console.error(message);
    
    // Also write to file if configured
    if (fileStream) {
      fileStream.write(message + '\n');
    }
  }

  log(category: LogEntry['category'], event: string, data?: any, metadata?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: this.type,
      category,
      event,
      data,
      metadata: {
        ...metadata,
        messageCount: ++this.messageCounter,
        instanceId: this.instanceId
      }
    };
    
    this.writeLog(entry);
  }

  logStdio(direction: 'in' | 'out', event: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: this.type,
      category: 'stdio',
      direction,
      event,
      data,
      metadata: {
        messageCount: ++this.messageCounter,
        instanceId: this.instanceId,
        memory: process.memoryUsage()
      }
    };
    
    this.writeLog(entry);
  }

  logMessage(direction: 'in' | 'out', messageType: string, message: any): void {
    // Parse JSON-RPC message if possible
    let parsedMessage = message;
    let messageInfo: any = {};
    
    try {
      if (typeof message === 'string') {
        parsedMessage = JSON.parse(message);
      }
      
      // Extract JSON-RPC details
      if (parsedMessage.jsonrpc) {
        messageInfo = {
          jsonrpc: parsedMessage.jsonrpc,
          method: parsedMessage.method,
          id: parsedMessage.id,
          hasParams: !!parsedMessage.params,
          hasResult: !!parsedMessage.result,
          hasError: !!parsedMessage.error
        };
        
        // Log specific method details
        if (parsedMessage.method) {
          messageInfo.method = parsedMessage.method;
          if (parsedMessage.params) {
            messageInfo.paramsPreview = Object.keys(parsedMessage.params);
          }
        }
      }
    } catch (e) {
      // Not JSON, log as is
    }
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: this.type,
      category: 'message',
      direction,
      event: `${messageType} message`,
      data: parsedMessage,
      metadata: {
        messageCount: ++this.messageCounter,
        instanceId: this.instanceId,
        messageInfo,
        byteSize: typeof message === 'string' ? message.length : JSON.stringify(message).length
      }
    };
    
    this.writeLog(entry);
  }

  logTransport(event: string, details?: any): void {
    this.log('transport', event, details, {
      transportType: 'stdio',
      streams: {
        stdin: process.stdin ? 'available' : 'unavailable',
        stdout: process.stdout ? 'available' : 'unavailable',
        stderr: process.stderr ? 'available' : 'unavailable'
      }
    });
  }

  logError(error: Error, context?: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: this.type,
      category: 'error',
      event: context || 'Unknown error',
      error,
      metadata: {
        messageCount: ++this.messageCounter,
        instanceId: this.instanceId
      }
    };
    
    this.writeLog(entry);
  }

  // Helper to intercept and log stdio streams
  interceptStdio() {
    if (!DEBUG) return;
    
    const originalStdinOn = process.stdin.on.bind(process.stdin);
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    
    // Intercept stdin
    process.stdin.on = (event: string, listener: any) => {
      if (event === 'data') {
        const wrappedListener = (data: Buffer) => {
          this.logStdio('in', 'stdin:data', {
            raw: data.toString('utf8').substring(0, 1000),
            byteLength: data.length,
            encoding: 'utf8'
          });
          return listener(data);
        };
        return originalStdinOn(event, wrappedListener);
      }
      return originalStdinOn(event, listener);
    };
    
    // Intercept stdout
    process.stdout.write = (chunk: any, ...args: Array<any>) => {
      this.logStdio('out', 'stdout:write', {
        raw: chunk.toString('utf8').substring(0, 1000),
        byteLength: chunk.length,
        encoding: 'utf8'
      });
      return originalStdoutWrite(chunk, ...args);
    };
    
    this.log('transport', 'stdio interceptors installed');
  }
}

// Singleton instances
let serverLogger: StdioLogger | null = null;
let clientLogger: StdioLogger | null = null;

export function getServerLogger(): StdioLogger {
  if (!serverLogger) {
    serverLogger = new StdioLogger('server');
  }
  return serverLogger;
}

export function getClientLogger(): StdioLogger {
  if (!clientLogger) {
    clientLogger = new StdioLogger('client');
  }
  return clientLogger;
}

// Helper to enable debugging via environment variable
export function enableDebugLogging(): void {
  process.env.DEBUG_STDIO = 'true';
  console.error('🔍 STDIO Debug logging enabled');
  console.error('📝 Set DEBUG_LOG_FILE env var to also write to a file');
  console.error('📊 Logs will be written to stderr to avoid stdio interference');
}