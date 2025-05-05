const { EmbedBuilder } = require('discord.js');
const CommonUtils = require('./CommonUtils');

// Default template functions
const defaultTemplates = {
    success: (data = {}) => ({
        color: 0x57F287, // Discord Green
        title: data.title || '✅ Success!',
        description: data.description || null,
    }),
    error: (data = {}) => ({
        color: 0xED4245, // Discord Red
        title: data.title || '❌ Error!',
        description: data.description || 'An unexpected error occurred.',
    }),
    warning: (data = {}) => ({
        color: 0xFEE75C, // Discord Yellow
        title: data.title || '⚠️ Warning!',
        description: data.description || null,
    }),
    info: (data = {}) => ({
        color: 0x5865F2, // Discord Blue
        title: data.title || 'ℹ️ Information',
        description: data.description || null,
    }),
};

/**
 * An enhanced EmbedBuilder with built-in and custom templating support.
 * Extends discord.js EmbedBuilder.
 */
class SuiteEmbed extends EmbedBuilder {
    /**
     * Creates a new SuiteEmbed instance.
     * @param {object} [data] Initial embed data (same as EmbedBuilder).
     * @param {object} [customTemplates={}] Custom template functions to merge with defaults.
     *                                     Template function signature: (data = {}) => ({ title, description, color, ... })
     */
    constructor(data = {}, customTemplates = {}) {
        super(data);
        // Merge default and custom templates, prioritizing custom ones
        this.templates = { ...defaultTemplates, ...customTemplates };

        // Apply defaults if not provided in initial data
        if (this.data.color === undefined) { // Check specifically for undefined, 0 is a valid color
            this.setColor(CommonUtils.randomColor()); // Default to a random color
        }
        if (this.data.timestamp === undefined) {
           this.setTimestamp(); // Default to current time
        }
    }

    /**
     * Applies a predefined or custom template to the embed.
     * @param {keyof defaultTemplates | string} templateName The name of the template to use.
     * @param {object} [data={}] Data to pass to the template function (e.g., { title: 'Override', description: '...' }).
     * @returns {this} The SuiteEmbed instance for chaining.
     */
    useTemplate(templateName, data = {}) {
        const templateBuilder = this.templates[templateName];
        if (!templateBuilder || typeof templateBuilder !== 'function') {
            console.warn(`[SuiteEmbed] Template "${templateName}" not found or is not a function.`);
            return this;
        }

        try {
            const templateData = templateBuilder(data);
            // Apply template properties if they exist
            if (templateData.color !== undefined) this.setColor(templateData.color);
            if (templateData.title !== undefined) this.setTitle(templateData.title);
            if (templateData.description !== undefined) this.setDescription(templateData.description);
            if (templateData.author !== undefined) this.setAuthor(templateData.author);
            if (templateData.thumbnail !== undefined) this.setThumbnail(templateData.thumbnail.url);
             if (templateData.image !== undefined) this.setImage(templateData.image.url);
            if (templateData.footer !== undefined) this.setFooter(templateData.footer);
            if (templateData.fields !== undefined && Array.isArray(templateData.fields)) {
                 // Clear existing fields before adding template fields? Or add to them?
                 // this.data.fields = []; // Option 1: Replace fields
                 this.addFields(templateData.fields); // Option 2: Add fields
             }
            // Add more template properties as needed
        } catch (error) {
            console.error(`[SuiteEmbed] Error applying template "${templateName}":`, error);
        }
        return this;
    }

    // Static helper methods for easy template usage
    static success(description, title) {
        return new SuiteEmbed().useTemplate('success', { description, title });
    }
    static error(description, title) {
        return new SuiteEmbed().useTemplate('error', { description, title });
    }
    static warning(description, title) {
        return new SuiteEmbed().useTemplate('warning', { description, title });
    }
    static info(description, title) {
        return new SuiteEmbed().useTemplate('info', { description, title });
    }
}

module.exports = SuiteEmbed;