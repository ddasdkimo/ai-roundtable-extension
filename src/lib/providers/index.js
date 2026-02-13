// AI Provider Registry

import { ClaudeProvider } from './claude-provider.js';
import { ChatGPTProvider } from './chatgpt-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import { CopilotProvider } from './copilot-provider.js';

export const PROVIDER_REGISTRY = {
  claude: {
    id: 'claude',
    name: 'Claude',
    providerClass: ClaudeProvider,
    color: '#D97757',
    icon: '🟠',
  },
  chatgpt: {
    id: 'chatgpt',
    name: 'ChatGPT',
    providerClass: ChatGPTProvider,
    color: '#10A37F',
    icon: '🟢',
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    providerClass: GeminiProvider,
    color: '#4285F4',
    icon: '🔵',
  },
  copilot: {
    id: 'copilot',
    name: 'Copilot',
    providerClass: CopilotProvider,
    color: '#8B5CF6',
    icon: '🟣',
  },
};

export function createProvider(providerId, config) {
  const entry = PROVIDER_REGISTRY[providerId];
  if (!entry) throw new Error(`Unknown provider: ${providerId}`);
  return new entry.providerClass(config);
}

export { ClaudeProvider, ChatGPTProvider, GeminiProvider, CopilotProvider };
