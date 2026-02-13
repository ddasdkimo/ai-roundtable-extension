// GitHub Copilot Provider (via GitHub Models API - OpenAI compatible)

import { BaseProvider } from './base-provider.js';

export class CopilotProvider extends BaseProvider {
  constructor(config) {
    super('Copilot', config);
    this.baseUrl = 'https://models.inference.ai.github.com';
    this.model = config.model || 'gpt-4o';
  }

  getAvailableModels() {
    return [
      { id: 'gpt-4o', name: 'GPT-4o (GitHub)' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (GitHub)' },
      { id: 'o3-mini', name: 'o3-mini (GitHub)' },
      { id: 'Mistral-Large-2411', name: 'Mistral Large' },
      { id: 'Meta-Llama-3.1-405B-Instruct', name: 'Llama 3.1 405B' },
    ];
  }

  async sendMessage(messages, options = {}) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options.maxTokens || 4096,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`GitHub Models API error: ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async streamMessage(messages, onChunk, options = {}) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options.maxTokens || 4096,
        stream: true,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`GitHub Models API error: ${err.error?.message || response.statusText}`);
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
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              onChunk(delta);
            }
          } catch {
            // skip
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
}
