const easycolor = require('@onurege3467/easycolor');
const fs = require('fs'); // Needed for potential file transport

const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
};

/**
 * A configurable logger for the application.
 */
class Logger {
    /**
     * Creates a new Logger instance.
     * @param {object} [options={}] Logger configuration options.
     * @param {'debug'|'info'|'warn'|'error'} [options.level='info'] Minimum log level to output.
     * @param {'console'|'file'|'discordChannel'} [options.transport='console'] Where to send logs.
     * @param {string} [options.filePath] Path for the log file if transport is 'file'.
     * @param {import('discord.js').Client} [options.client] Discord Client instance if transport is 'discordChannel'.
     * @param {string} [options.channelId] Channel ID for logs if transport is 'discordChannel'.
     */
    constructor(options = {}) {
        this.level = LogLevel[options.level?.toUpperCase() ?? 'INFO'] ?? LogLevel.INFO;
        this.transport = options.transport || 'console';
        this.filePath = options.filePath;
        this.client = options.client;
        this.channelId = options.channelId;

        if (this.transport === 'file' && !this.filePath) {
            console.warn(easycolor.yellow("[Logger] File transport selected but 'filePath' option is missing. Falling back to console."));
            this.transport = 'console';
        }
         if (this.transport === 'discordChannel' && (!this.client || !this.channelId)) {
            console.warn(easycolor.yellow("[Logger] Discord transport selected but 'client' or 'channelId' option is missing. Falling back to console."));
            this.transport = 'console';
        }
    }

    _log(level, message, ...args) {
        if (level < this.level) {
            return;
        }

        const timestamp = new Date().toISOString();
        const levelName = Object.keys(LogLevel).find(key => LogLevel[key] === level);
        const baseMessage = `[${timestamp}] [${levelName}] ${message}`;

        // Format args for better readability
        const formattedArgs = args.map(arg => {
            if (arg instanceof Error) {
                return arg.stack || arg.message;
            }
            if (typeof arg === 'object' && arg !== null) {
                try {
                    return JSON.stringify(arg, null, 2); // Pretty print objects
                } catch {
                    return '[Unserializable Object]';
                }
            }
            return arg;
        }).join(' ');

        const fullMessage = `${baseMessage}${formattedArgs ? ` ${formattedArgs}` : ''}`;

        // Console Transport (with colors)
        if (this.transport === 'console') {
            let coloredMessage = baseMessage;
            switch (level) {
                case LogLevel.DEBUG: coloredMessage = easycolor.gray(baseMessage); break;
                case LogLevel.INFO: coloredMessage = easycolor.blue(baseMessage); break;
                case LogLevel.WARN: coloredMessage = easycolor.yellow(baseMessage); break;
                case LogLevel.ERROR: coloredMessage = easycolor.red(baseMessage); break;
            }
            const consoleMethod = level === LogLevel.ERROR ? console.error : (level === LogLevel.WARN ? console.warn : console.log);
            consoleMethod(coloredMessage, ...(args.length > 0 ? args : [''])); // Pass original args for better console formatting
        }

        // File Transport (Placeholder - needs robust implementation)
        if (this.transport === 'file' && this.filePath) {
            try {
                fs.appendFileSync(this.filePath, fullMessage + '\n', 'utf8');
            } catch (err) {
                console.error(easycolor.red(`[Logger] Failed to write to log file ${this.filePath}:`), err);
                // Optionally fallback to console here
            }
        }

        // Discord Channel Transport (Placeholder - needs robust implementation)
        if (this.transport === 'discordChannel' && this.client && this.channelId) {
            this._sendLogToDiscord(fullMessage);
        }
    }

    async _sendLogToDiscord(message) {
        try {
            const channel = await this.client.channels.fetch(this.channelId).catch(() => null);
            if (channel && channel.isTextBased()) {
                // Split long messages for Discord limit
                const chunks = message.match(/[\s\S]{1,1990}/g) || []; // Split into chunks approx 2000 chars
                 for (const chunk of chunks) {
                     await channel.send(`\`\`\`log\n${chunk}\n\`\`\``).catch(err => {
                          console.error(easycolor.red(`[Logger] Failed to send log chunk to Discord channel ${this.channelId}:`), err);
                     });
                 }
            } else {
                 console.warn(easycolor.yellow(`[Logger] Discord log channel ${this.channelId} not found or not text-based.`));
            }
        } catch (err) {
             console.error(easycolor.red(`[Logger] Error sending log to Discord channel ${this.channelId}:`), err);
        }
    }

    debug(message, ...args) { this._log(LogLevel.DEBUG, message, ...args); }
    info(message, ...args) { this._log(LogLevel.INFO, message, ...args); }
    warn(message, ...args) { this._log(LogLevel.WARN, message, ...args); }
    error(message, ...args) { this._log(LogLevel.ERROR, message, ...args); }
}

module.exports = Logger;

