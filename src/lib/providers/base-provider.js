// Base AI Provider Interface

export class BaseProvider {
  constructor(name, config) {
    this.name = name;
    this.config = config;
    this.apiKey = config.apiKey || '';
    this.model = config.model || '';
  }

  get displayName() {
    return this.name;
  }

  get avatar() {
    return `${this.name.toLowerCase()}.svg`;
  }

  /**
   * Send a message and get a complete response
   * @param {Array<{role: string, content: string}>} messages
   * @param {object} options
   * @returns {Promise<string>}
   */
  async sendMessage(messages, options = {}) {
    throw new Error('sendMessage must be implemented by subclass');
  }

  /**
   * Send a message and stream the response
   * @param {Array<{role: string, content: string}>} messages
   * @param {function} onChunk - callback for each chunk
   * @param {object} options
   * @returns {Promise<string>} - full response when done
   */
  async streamMessage(messages, onChunk, options = {}) {
    throw new Error('streamMessage must be implemented by subclass');
  }

  /**
   * Validate the API key
   * @returns {Promise<boolean>}
   */
  async validateKey() {
    throw new Error('validateKey must be implemented by subclass');
  }

  /**
   * Get available models for this provider
   * @returns {Array<{id: string, name: string}>}
   */
  getAvailableModels() {
    throw new Error('getAvailableModels must be implemented by subclass');
  }
}
