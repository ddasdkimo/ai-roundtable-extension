// Claude (Anthropic) AI Provider

import { BaseProvider } from './base-provider.js';

export class ClaudeProvider extends BaseProvider {
  constructor(config) {
    super('Claude', config);
    this.baseUrl = 'https://api.anthropic.com/v1';
    this.model = config.model || 'claude-sonnet-4-5-20250929';
  }

  getAvailableModels() {
    return [
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
    ];
  }

  async sendMessage(messages, options = {}) {
    const { system, conversation } = this._formatMessages(messages);

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options.maxTokens || 4096,
        system: system || undefined,
        messages: conversation,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Claude API error: ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  async streamMessage(messages, onChunk, options = {}) {
    const { system, conversation } = this._formatMessages(messages);

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options.maxTokens || 4096,
        stream: true,
        system: system || undefined,
        messages: conversation,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Claude API error: ${err.error?.message || response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullText += parsed.delta.text;
              onChunk(parsed.delta.text);
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    }

    return fullText;
  }

  async validateKey() {
    try {
      await this.sendMessage([{ role: 'user', content: 'Hi' }], { maxTokens: 10 });
      return true;
    } catch {
      return false;
    }
  }

  _formatMessages(messages) {
    let system = '';
    const conversation = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        system = msg.content;
      } else {
        conversation.push({ role: msg.role, content: msg.content });
      }
    }

    return { system, conversation };
  }
}
