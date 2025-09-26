// src/shared/utils/logger.ts

export interface LogEntry {
    id: string;
    timestamp: number;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    context?: any;
    source?: string;
}

class LoggerService {
    private logs: LogEntry[] = [];
    private maxLogs = 1000;
    private subscribers: ((log: LogEntry) => void)[] = [];

    log(level: LogEntry['level'], message: string, context?: any, source?: string) {
        const logEntry: LogEntry = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            level,
            message,
            context,
            source: source || 'app'
        };

        this.logs.unshift(logEntry);
        if (this.logs.length > this.maxLogs) {
            this.logs.pop();
        }

        // Notify subscribers
        this.subscribers.forEach(callback => callback(logEntry));

        // Also log to console for development
        const consoleMethod = console[level] || console.log;
        consoleMethod(`[${source || 'app'}]`, message, context || '');
    }

    info(message: string, context?: any, source?: string) {
        this.log('info', message, context, source);
    }

    warn(message: string, context?: any, source?: string) {
        this.log('warn', message, context, source);
    }

    error(message: string, context?: any, source?: string) {
        this.log('error', message, context, source);
    }

    debug(message: string, context?: any, source?: string) {
        this.log('debug', message, context, source);
    }

    getLogs(): LogEntry[] {
        return [...this.logs];
    }

    clearLogs() {
        this.logs = [];
    }

    subscribe(callback: (log: LogEntry) => void) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(sub => sub !== callback);
        };
    }

    exportLogs(): string {
        return this.logs
            .map(log => `[${new Date(log.timestamp).toISOString()}] [${log.level}] [${log.source}] ${log.message} ${log.context ? JSON.stringify(log.context, null, 2) : ''}`)
            .join('\n');
    }
}

export const logger = new LoggerService();