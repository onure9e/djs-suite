const fs = require('fs');
const path = require('path');
const { Collection, REST, Routes, InteractionType, ApplicationCommandType, PermissionsBitField } = require('discord.js');
const PermissionUtils = require('./PermissionUtils');
const Logger = require('./Logger'); // Use internal logger if none provided

// Enum for command types used internally
const CommandType = {
    SLASH: 'SLASH',         // ApplicationCommandType.ChatInput
    USER: 'USER',           // ApplicationCommandType.User
    MESSAGE: 'MESSAGE',       // ApplicationCommandType.Message
    LEGACY: 'LEGACY'        // Prefix-based message command
};

/**
 * Handles loading, registration, and execution of all command types.
 */
class CommandHandler {
    /**
     * Creates a CommandHandler instance.
     * @param {import('discord.js').Client} client The Discord Client instance.
     * @param {object} [options={}] Configuration options.
     * @param {string} [options.commandDir='./commands'] Path to the directory containing command files.
     * @param {string} [options.prefix] Prefix string for legacy message commands (required to enable legacy commands).
     * @param {string} [options.devGuildId] Guild ID for registering slash commands during development.
     * @param {boolean} [options.registerGlobally] Whether to register slash commands globally (default: true if devGuildId is not set).
     * @param {Logger} [options.logger] A logger instance.
     * @param {string[]} [options.ownerIds=[]] Array of user IDs considered bot owners (for devOnly commands).
     */
    constructor(client, options = {}) {
        if (!client) throw new Error("CommandHandler requires a Discord Client instance.");
        this.client = client;
        this.commands = new Collection(); // Stores all loaded commands: <commandName, commandObject>
        this.cooldowns = new Collection(); // Stores cooldowns: <userId, <commandName, timestamp>>

        this.commandDir = options.commandDir ? path.resolve(options.commandDir) : path.resolve('./commands');
        this.prefix = options.prefix;
        this.devGuildId = options.devGuildId;
        this.registerGlobally = options.registerGlobally ?? !this.devGuildId; // Default based on devGuildId
        this.logger = options.logger || new Logger({ level: 'info' });
        this.ownerIds = options.ownerIds || [];

        // Load commands immediately
        this.loadCommands();

        // Register slash commands when the client is ready
        if (this.client.isReady()) {
            this.registerSlashCommands();
        } else {
            // Use 'once' to ensure it runs only the first time the client is ready
            this.client.once('ready', () => this.registerSlashCommands());
        }

        // Start listening for command interactions and messages
        this._listen();
        this.logger.info('CommandHandler initialized.');
    }

    /**
     * Recursively reads a directory and returns paths of all .js files.
     * @param {string} dir The directory path to read.
     * @returns {string[]} An array of absolute file paths.
     * @private
     */
    _readDirRecursive(dir) {
        let results = [];
        try {
            const list = fs.readdirSync(dir);
            list.forEach((file) => {
                const filePath = path.resolve(dir, file);
                try {
                    const stat = fs.statSync(filePath);
                    if (stat && stat.isDirectory()) {
                        // Recurse into subdirectories
                        results = results.concat(this._readDirRecursive(filePath));
                    } else if (filePath.endsWith('.js')) {
                        // Add .js file to results
                        results.push(filePath);
                    }
                } catch (statError) {
                     this.logger.warn(`Could not stat file/directory ${filePath}:`, statError);
                }
            });
        } catch (readError) {
             // Log if directory doesn't exist, but don't crash
             if (readError.code === 'ENOENT') {
                 this.logger.warn(`Command directory not found: ${dir}`);
             } else {
                this.logger.error(`Error reading command directory ${dir}:`, readError);
             }
        }
        return results;
    }

    /**
     * Loads all command files from the specified directory and its subdirectories.
     */
    loadCommands() {
        this.logger.info(`Loading commands from: ${this.commandDir}`);
        this.commands.clear(); // Clear existing commands for reload
        const commandFiles = this._readDirRecursive(this.commandDir);
        let loadedCount = 0;
        let slashCommandCount = 0;
        let legacyCommandCount = 0;

        for (const file of commandFiles) {
            try {
                // Clear cache for the file to allow reloading changes without restarting bot
                delete require.cache[require.resolve(file)];
                const command = require(file);

                // Basic validation: Ensure it exports an object with an execute function
                if (!command || typeof command !== 'object') {
                    this.logger.warn(`Skipping file: ${file}. Does not export an object.`);
                    continue;
                }
                 if (typeof command.execute !== 'function') {
                     this.logger.warn(`Skipping command in ${file}: Missing 'execute' function.`);
                     continue;
                 }

                // Determine command type and name
                let commandName;
                let commandType;
                let isSlash = false;

                // Check for discord.js Application Command data structure
                if (command.data && typeof command.data.toJSON === 'function') {
                    commandName = command.data.name;
                    isSlash = true;
                    switch (command.data.type) {
                        case ApplicationCommandType.ChatInput:
                        case undefined: // Default type is ChatInput
                            commandType = CommandType.SLASH;
                            break;
                        case ApplicationCommandType.User:
                            commandType = CommandType.USER;
                            break;
                        case ApplicationCommandType.Message:
                            commandType = CommandType.MESSAGE;
                            break;
                        default:
                            this.logger.warn(`Unsupported application command type (${command.data.type}) in ${file}. Skipping.`);
                            continue; // Skip unsupported types
                    }
                    slashCommandCount++;
                }
                // Check for legacy command structure (if prefix is enabled)
                else if (this.prefix && command.name && typeof command.name === 'string') {
                     commandName = command.name;
                     commandType = CommandType.LEGACY;
                     legacyCommandCount++;
                }
                 // Cannot determine command type
                 else {
                     this.logger.warn(`Could not determine command name/type for ${file}. Requires 'data' (for slash) or 'name' (for legacy). Skipping.`);
                     continue;
                 }


                 // Store command details
                 command.filePath = file; // Store path for debugging
                 command.type = commandType;

                 // Register the main command name
                 if (this.commands.has(commandName)) {
                     this.logger.warn(`Command name conflict: "${commandName}" from ${file} is already registered. Overwriting.`);
                 }
                 this.commands.set(commandName, command);
                 this.logger.debug(`Loaded ${commandType} command: ${commandName}`);
                 loadedCount++;

                 // Register legacy aliases if applicable
                 if (commandType === CommandType.LEGACY && command.aliases && Array.isArray(command.aliases)) {
                     command.aliases.forEach(alias => {
                         if (this.commands.has(alias)) {
                             this.logger.warn(`Alias conflict: "${alias}" for command "${commandName}" is already registered as a command or alias. Skipping alias.`);
                         } else {
                            this.commands.set(alias, command); // Point alias to the same command object
                            this.logger.debug(`Registered alias "${alias}" for legacy command "${commandName}"`);
                         }
                     });
                 }

            } catch (error) {
                this.logger.error(`Failed to load command file ${file}:`, error);
            }
        }
        this.logger.info(`Successfully loaded ${loadedCount} commands (${slashCommandCount} application, ${legacyCommandCount} legacy).`);
    }

    /**
     * Registers Application (Slash) Commands with Discord.
     * Uses `devGuildId` for guild-specific registration or registers globally.
     * Automatically called when the client is ready.
     */
    async registerSlashCommands() {
        const applicationCommandsData = this.commands
            .filter(cmd => cmd.type !== CommandType.LEGACY && cmd.data)
            .map(cmd => cmd.data.toJSON()); // Get the JSON representation for the API

        if (applicationCommandsData.length === 0) {
            this.logger.info("No application commands found to register.");
            return;
        }

        if (!this.client.token) {
            this.logger.error('Cannot register application commands: Client token is missing.');
            return;
        }
         if (!this.client.application?.id) {
            // This might happen if called before the client is fully ready
            this.logger.error('Cannot register application commands: Client application ID is missing. Ensure the client is ready.');
            // Optionally schedule a retry?
            return;
        }

        const rest = new REST({ version: '10' }).setToken(this.client.token);

        try {
            this.logger.info(`Registering ${applicationCommandsData.length} application command(s)...`);

            let registrationRoute;
            let locationDescription;

            if (this.devGuildId && !this.registerGlobally) {
                // Registering commands to a specific guild (faster updates for testing)
                registrationRoute = Routes.applicationGuildCommands(this.client.application.id, this.devGuildId);
                locationDescription = `in development guild ${this.devGuildId}`;
            } else {
                // Registering commands globally
                registrationRoute = Routes.applicationCommands(this.client.application.id);
                locationDescription = 'globally';
                 // --- DANGER ZONE ---
                 // Uncomment to clear all commands in the target scope (guild or global)
                 // Useful if command names/types change drastically. Use with extreme caution!
                 // this.logger.warn(`Clearing all application commands ${locationDescription}...`);
                 // await rest.put(registrationRoute, { body: [] });
                 // this.logger.info(`Successfully cleared application commands ${locationDescription}.`);
                 // return; // Stop here after clearing
                 // --- END DANGER ZONE ---
            }

            // Perform the registration (PUT request overwrites existing commands)
            const data = await rest.put(registrationRoute, { body: applicationCommandsData });

            this.logger.info(`Successfully registered ${data.length} application command(s) ${locationDescription}.`);

        } catch (error) {
            this.logger.error(`Failed to register application commands ${locationDescription}:`, error);
             // Log more detailed error info if available (e.g., response body)
             if (error.response?.data) {
                 this.logger.error("API Error Details:", error.response.data);
             }
        }
    }

    /**
     * Checks and handles command cooldowns for a user.
     * @param {object} command The command object being executed.
     * @param {string} userId The ID of the user executing the command.
     * @returns {number | false} The remaining cooldown time in seconds, or false if no cooldown is active.
     * @private
     */
    _handleCooldown(command, userId) {
        const cooldownDuration = command.cooldown;
        if (!cooldownDuration || cooldownDuration <= 0) return false; // No cooldown set

        const now = Date.now();
        // Ensure user has a cooldown collection
        if (!this.cooldowns.has(userId)) {
            this.cooldowns.set(userId, new Collection());
        }
        const userCooldowns = this.cooldowns.get(userId);
        const commandIdentifier = command.data?.name || command.name; // Get name for slash or legacy

        const expirationTime = (userCooldowns.get(commandIdentifier) || 0) + (cooldownDuration * 1000);

        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return timeLeft; // Cooldown is active, return remaining time
        }

        // Cooldown is not active or expired, set new cooldown
        userCooldowns.set(commandIdentifier, now);
        // Automatically remove the cooldown entry after it expires to prevent memory leaks
        setTimeout(() => userCooldowns.delete(commandIdentifier), cooldownDuration * 1000);

        return false; // Cooldown was not active
    }

    /**
     * Checks if the user and bot have the necessary permissions and roles to execute the command.
     * @param {object} command The command object.
     * @param {import('discord.js').GuildMember | null} member The GuildMember executing the command.
     * @returns {string | null} An error message string if checks fail, or null if checks pass.
     * @private
     */
    _checkPermissions(command, member) {
        // Guild Only Check
        if (command.guildOnly && !member) {
             return 'This command can only be used inside a server.';
        }

        // Owner Only Check
         if (command.devOnly && !this.ownerIds.includes(member?.id)) {
             return 'This command can only be used by the bot owner(s).';
         }

        // User Permissions Check (only applicable in guilds)
        if (member && command.permissions && command.permissions.length > 0) {
            const missingUserPerms = command.permissions.filter(perm => !PermissionUtils.hasPermission(member, perm));
            if (missingUserPerms.length > 0) {
                return `You lack the required permissions: \`${missingUserPerms.join(', ')}\``;
            }
        }

        // User Roles Check (only applicable in guilds)
        if (member && command.roles && command.roles.length > 0) {
            const hasRequiredRole = command.roles.some(roleResolvable => PermissionUtils.hasRole(member, roleResolvable));
            if (!hasRequiredRole) {
                // Try to resolve role names for a better message
                const requiredRoleNames = command.roles.map(r => {
                     const resolvedRole = typeof r === 'string' ? CommonUtils.resolveRole(member.guild, r) : r;
                     return resolvedRole ? resolvedRole.name : r; // Show name if resolved, otherwise show input
                 }).join(', ');
                return `You need one of the following roles to use this command: \`${requiredRoleNames}\``;
            }
        }

        // Bot Permissions Check (only applicable in guilds)
        if (member && command.botPermissions && command.botPermissions.length > 0) {
            const botMember = member.guild.members.me; // Get the bot's GuildMember object
             if (!botMember) return 'Could not verify bot permissions.'; // Should usually not happen
            const missingBotPerms = command.botPermissions.filter(perm => !PermissionUtils.hasPermission(botMember, perm));
             if (missingBotPerms.length > 0) {
                 return `I lack the required permissions for this command: \`${missingBotPerms.join(', ')}\``;
             }
        }

        return null; // All checks passed
    }

    /**
     * Sets up listeners for the 'interactionCreate' (for slash/context commands)
     * and 'messageCreate' (for legacy commands) events.
     * @private
     */
    _listen() {
        // Listener for Application Commands (Slash, User Context, Message Context)
        this.client.on('interactionCreate', async interaction => {
            let command;
            let commandType;
            let commandName;

            // Determine command type from interaction
            if (interaction.isChatInputCommand()) {
                commandType = CommandType.SLASH;
                commandName = interaction.commandName;
            } else if (interaction.isUserContextMenuCommand()) {
                commandType = CommandType.USER;
                commandName = interaction.commandName;
            } else if (interaction.isMessageContextMenuCommand()) {
                commandType = CommandType.MESSAGE;
                 commandName = interaction.commandName;
            } else {
                // Not a command interaction handled by this listener
                // (Buttons, etc., are handled by InteractionManager if used)
                return;
            }

            // Find the command in our collection
            command = this.commands.get(commandName);

            // Basic validation
            if (!command || command.type !== commandType) {
                this.logger.error(`Received interaction for unknown or mismatched command: ${commandName} (Type: ${commandType})`);
                 // Inform user if possible?
                 if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'An error occurred: Command not found or type mismatch.', ephemeral: true }).catch(() => {});
                 }
                return;
            }

            const userId = interaction.user.id;

            // --- Pre-Execution Checks ---

            // 1. Cooldown Check
            const cooldownTimeLeft = this._handleCooldown(command, userId);
            if (cooldownTimeLeft) {
                return interaction.reply({
                    content: `Please wait ${cooldownTimeLeft.toFixed(1)} more second(s) before reusing the \`${commandName}\` command.`,
                    ephemeral: true
                }).catch(e => this.logger.error(`Cooldown reply failed for ${commandName}:`, e));
            }

             // 2. Permission Check (includes guildOnly, devOnly, roles, user perms, bot perms)
             const permissionError = this._checkPermissions(command, interaction.member); // interaction.member is null in DMs
             if (permissionError) {
                 return interaction.reply({ content: permissionError, ephemeral: true })
                    .catch(e => this.logger.error(`Permission reply failed for ${commandName}:`, e));
             }

            // --- Execute Command ---
            try {
                this.logger.info(`Executing ${commandType} command "${commandName}" triggered by ${interaction.user.tag} (${userId})`);
                // Pass interaction to the command's execute function
                await command.execute(interaction);
            } catch (error) {
                this.logger.error(`Error executing ${commandType} command "${commandName}" (Source: ${command.filePath}):`, error);
                // Try to inform the user about the error
                 try {
                     const replyMethod = (interaction.replied || interaction.deferred) ? 'followUp' : 'reply';
                     await interaction[replyMethod]({ content: 'An error occurred while executing this command!', ephemeral: true });
                 } catch (e) {
                     this.logger.error(`Command execution error fallback reply failed for "${commandName}":`, e);
                 }
            }
        });

        // Listener for Legacy Prefix Commands (only if prefix is set)
        if (this.prefix) {
            this.client.on('messageCreate', async message => {
                // Basic checks: Ignore bots, DMs (unless configured otherwise), messages without prefix
                if (message.author.bot || !message.guild || !message.content.startsWith(this.prefix)) {
                    return;
                }

                // Parse arguments and command name
                const args = message.content.slice(this.prefix.length).trim().split(/ +/);
                const commandName = args.shift()?.toLowerCase(); // Get command name and remove it from args

                if (!commandName) return; // No command name provided after prefix

                // Find the command (could be main name or an alias)
                const command = this.commands.get(commandName);

                // Validate if it's a LEGACY command registered with this name/alias
                if (!command || command.type !== CommandType.LEGACY) {
                    return; // Not a valid legacy command or alias
                }

                const userId = message.author.id;

                 // --- Pre-Execution Checks ---

                // 1. Cooldown Check
                const cooldownTimeLeft = this._handleCooldown(command, userId);
                if (cooldownTimeLeft) {
                     return message.reply(`Please wait ${cooldownTimeLeft.toFixed(1)} more second(s) before reusing the \`${command.name}\` command.`)
                         .catch(e => this.logger.error(`Legacy cooldown reply failed for ${command.name}:`, e));
                 }

                 // 2. Permission Check (includes guildOnly, devOnly, roles, user perms, bot perms)
                 const permissionError = this._checkPermissions(command, message.member); // message.member exists because we checked message.guild
                 if (permissionError) {
                     return message.reply(permissionError)
                         .catch(e => this.logger.error(`Legacy permission reply failed for ${command.name}:`, e));
                 }

                // --- Execute Command ---
                try {
                    this.logger.info(`Executing ${CommandType.LEGACY} command "${command.name}" triggered by ${message.author.tag} (${userId})`);
                    // Pass message and args to the legacy command's execute function
                    await command.execute(message, args);
                } catch (error) {
                    this.logger.error(`Error executing ${CommandType.LEGACY} command "${command.name}" (Source: ${command.filePath}):`, error);
                     // Try to inform the user
                     await message.reply('An error occurred while executing this command!')
                         .catch(e => this.logger.error(`Legacy command execution error fallback reply failed for "${command.name}":`, e));
                }
            });
             this.logger.info(`Listening for legacy commands with prefix: "${this.prefix}"`);
        }
    }
}

module.exports = CommandHandler;