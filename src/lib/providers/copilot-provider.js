// GitHub Copilot Provider (via GitHub Models API - OpenAI compatible)

import { BaseProvider } from './base-provider.js';

export class CopilotProvider extends BaseProvider {
  constructor(config) {
    super('Copilot', config);
    this.baseUrl = 'https://models.github.ai/inference';
    this.model = config.model || 'openai/gpt-4.1';
  }

  getAvailableModels() {
    return [
      // --- OpenAI ---
      { id: 'openai/gpt-4.1', name: 'GPT-4.1', group: 'OpenAI' },
      { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini', group: 'OpenAI' },
      { id: 'openai/gpt-4.1-nano', name: 'GPT-4.1 Nano', group: 'OpenAI' },
      { id: 'openai/gpt-4o', name: 'GPT-4o', group: 'OpenAI' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', group: 'OpenAI' },
      { id: 'openai/gpt-5', name: 'GPT-5', group: 'OpenAI' },
      { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', group: 'OpenAI' },
      { id: 'openai/o3', name: 'o3', group: 'OpenAI' },
      { id: 'openai/o3-mini', name: 'o3-mini', group: 'OpenAI' },
      { id: 'openai/o4-mini', name: 'o4-mini', group: 'OpenAI' },
      // --- DeepSeek ---
      { id: 'deepseek/DeepSeek-R1', name: 'DeepSeek R1', group: 'DeepSeek' },
      { id: 'deepseek/DeepSeek-R1-0528', name: 'DeepSeek R1 0528', group: 'DeepSeek' },
      { id: 'deepseek/DeepSeek-V3-0324', name: 'DeepSeek V3', group: 'DeepSeek' },
      // --- Meta Llama ---
      { id: 'Meta-Llama-3.1-405B-Instruct', name: 'Llama 3.1 405B', group: 'Meta' },
      { id: 'Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B', group: 'Meta' },
      { id: 'Llama-3.2-90B-Vision-Instruct', name: 'Llama 3.2 90B Vision', group: 'Meta' },
      // --- xAI ---
      { id: 'xai/grok-3', name: 'Grok 3', group: 'xAI' },
      { id: 'xai/grok-3-mini', name: 'Grok 3 Mini', group: 'xAI' },
      // --- Mistral ---
      { id: 'mistral/Mistral-Medium-3', name: 'Mistral Medium 3', group: 'Mistral' },
      { id: 'mistral/Mistral-Small-3.1', name: 'Mistral Small 3.1', group: 'Mistral' },
      // --- Cohere ---
      { id: 'cohere/Command-A', name: 'Command A', group: 'Cohere' },
      { id: 'cohere/Command-R-Plus-08-2024', name: 'Command R+', group: 'Cohere' },
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
