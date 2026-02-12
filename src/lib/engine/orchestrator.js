// Meeting Orchestration Engine

import { createProvider, PROVIDER_REGISTRY } from '../providers/index.js';
import { PromptTemplates } from './prompts.js';

const MEETING_PHASES = {
  IDLE: 'idle',
  SETUP: 'setup',
  DISCUSSION: 'discussion',
  EVALUATION: 'evaluation',
  SUMMARY: 'summary',
  COMPLETED: 'completed',
  PAUSED: 'paused',
};

export class MeetingOrchestrator {
  constructor(config, providerConfigs) {
    this.topic = config.topic;
    this.rounds = config.rounds || 2;
    this.evaluationMode = config.evaluationMode || 'cross';
    this.turnOrder = config.turnOrder || 'sequential'; // 'sequential' | 'random'
    this.language = config.language || 'zh-TW';

    this.providers = {};
    this.participants = [];
    for (const [id, provConfig] of Object.entries(providerConfigs)) {
      this.providers[id] = createProvider(id, provConfig);
      this.participants.push({
        id,
        name: PROVIDER_REGISTRY[id].name,
        color: PROVIDER_REGISTRY[id].color,
        icon: PROVIDER_REGISTRY[id].icon,
      });
    }

    this.phase = MEETING_PHASES.IDLE;
    this.currentRound = 0;
    this.transcript = [];
    this.evaluations = [];
    this.summaryText = '';
    this._updateCallbacks = [];
    this._paused = false;
  }

  onUpdate(callback) {
    this._updateCallbacks.push(callback);
  }

  _emit(update) {
    for (const cb of this._updateCallbacks) {
      cb(update);
    }
  }

  getState() {
    return {
      phase: this.phase,
      topic: this.topic,
      currentRound: this.currentRound,
      totalRounds: this.rounds,
      participants: this.participants,
      transcript: this.transcript,
      evaluations: this.evaluations,
      summary: this.summaryText,
    };
  }

  async start() {
    this.phase = MEETING_PHASES.DISCUSSION;
    this._emit({ type: 'PHASE_CHANGE', phase: this.phase });

    for (let round = 1; round <= this.rounds; round++) {
      if (this._paused) {
        await this._waitForResume();
      }

      this.currentRound = round;
      this._emit({ type: 'ROUND_START', round });

      const order = this._getParticipantOrder();

      for (const participant of order) {
        if (this._paused) {
          await this._waitForResume();
        }

        this._emit({
          type: 'TURN_START',
          participant: participant.id,
          round,
        });

        const messages = this._buildDiscussionPrompt(participant.id, round);
        const provider = this.providers[participant.id];

        let response = '';
        try {
          response = await provider.streamMessage(messages, (chunk) => {
            this._emit({
              type: 'STREAM_CHUNK',
              participant: participant.id,
              chunk,
            });
          });
        } catch (error) {
          response = `[Error: ${error.message}]`;
        }

        this.transcript.push({
          participant: participant.id,
          participantName: participant.name,
          round,
          content: response,
          timestamp: Date.now(),
        });

        this._emit({
          type: 'TURN_END',
          participant: participant.id,
          round,
          content: response,
        });
      }

      this._emit({ type: 'ROUND_END', round });
    }

    // Evaluation phase
    if (this.evaluationMode !== 'none') {
      await this._runEvaluation();
    }

    // Summary phase
    await this._runSummary();

    this.phase = MEETING_PHASES.COMPLETED;
    const record = this.getMeetingRecord();
    this._emit({ type: 'PHASE_CHANGE', phase: this.phase, meetingRecord: record });
  }

  pause() {
    this._paused = true;
    this.phase = MEETING_PHASES.PAUSED;
    this._emit({ type: 'PHASE_CHANGE', phase: this.phase });
  }

  async resume() {
    this._paused = false;
    this.phase = MEETING_PHASES.DISCUSSION;
    this._emit({ type: 'PHASE_CHANGE', phase: this.phase });
    if (this._resumeResolve) {
      this._resumeResolve();
    }
  }

  async stop() {
    this._paused = false;
    if (this._resumeResolve) this._resumeResolve();
    this.phase = MEETING_PHASES.COMPLETED;
    this._emit({ type: 'PHASE_CHANGE', phase: this.phase });
    return this.getMeetingRecord();
  }

  getMeetingRecord() {
    return {
      id: `meeting-${Date.now()}`,
      topic: this.topic,
      participants: this.participants.map(p => ({ id: p.id, name: p.name })),
      rounds: this.rounds,
      transcript: this.transcript,
      evaluations: this.evaluations,
      summary: this.summaryText,
      markdown: this.exportTranscript(),
      createdAt: Date.now(),
    };
  }

  exportTranscript() {
    let md = `# AI 圓桌會議記錄\n\n`;
    md += `**議題**: ${this.topic}\n`;
    md += `**參與者**: ${this.participants.map(p => p.name).join(', ')}\n`;
    md += `**日期**: ${new Date().toLocaleString('zh-TW')}\n\n`;
    md += `---\n\n`;

    for (let r = 1; r <= this.rounds; r++) {
      md += `## 第 ${r} 輪討論\n\n`;
      const roundEntries = this.transcript.filter(t => t.round === r);
      for (const entry of roundEntries) {
        md += `### ${entry.participantName}\n\n${entry.content}\n\n`;
      }
    }

    if (this.evaluations.length > 0) {
      md += `## 交叉評價\n\n`;
      for (const ev of this.evaluations) {
        md += `### ${ev.evaluatorName} 的評價\n\n${ev.content}\n\n`;
      }
    }

    if (this.summaryText) {
      md += `## 會議摘要\n\n${this.summaryText}\n`;
    }

    return md;
  }

  _getParticipantOrder() {
    const order = [...this.participants];
    if (this.turnOrder === 'random') {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }
    return order;
  }

  _buildDiscussionPrompt(participantId, round) {
    const previousMessages = this.transcript
      .filter(t => t.round < round || (t.round === round && t.participant !== participantId))
      .map(t => `[${t.participantName}]: ${t.content}`)
      .join('\n\n');

    return PromptTemplates.discussion({
      topic: this.topic,
      participantName: PROVIDER_REGISTRY[participantId].name,
      round,
      totalRounds: this.rounds,
      previousMessages,
      language: this.language,
    });
  }

  async _runEvaluation() {
    this.phase = MEETING_PHASES.EVALUATION;
    this._emit({ type: 'PHASE_CHANGE', phase: this.phase });

    for (const participant of this.participants) {
      this._emit({ type: 'EVAL_START', participant: participant.id });

      const messages = PromptTemplates.evaluation({
        topic: this.topic,
        evaluatorName: participant.name,
        transcript: this.transcript,
        participants: this.participants,
        language: this.language,
      });

      const provider = this.providers[participant.id];
      let response = '';
      try {
        response = await provider.streamMessage(messages, (chunk) => {
          this._emit({
            type: 'STREAM_CHUNK',
            participant: participant.id,
            chunk,
            phase: 'evaluation',
          });
        });
      } catch (error) {
        response = `[Error: ${error.message}]`;
      }

      this.evaluations.push({
        evaluator: participant.id,
        evaluatorName: participant.name,
        content: response,
        timestamp: Date.now(),
      });

      this._emit({ type: 'EVAL_END', participant: participant.id, content: response });
    }
  }

  async _runSummary() {
    this.phase = MEETING_PHASES.SUMMARY;
    this._emit({ type: 'PHASE_CHANGE', phase: this.phase });

    // Use the first available provider for summary
    const firstProvider = this.providers[this.participants[0].id];
    const messages = PromptTemplates.summary({
      topic: this.topic,
      transcript: this.transcript,
      evaluations: this.evaluations,
      participants: this.participants,
      language: this.language,
    });

    try {
      this.summaryText = await firstProvider.streamMessage(messages, (chunk) => {
        this._emit({ type: 'STREAM_CHUNK', participant: 'summary', chunk, phase: 'summary' });
      });
    } catch (error) {
      this.summaryText = `[Summary generation failed: ${error.message}]`;
    }

    this._emit({ type: 'SUMMARY_COMPLETE', content: this.summaryText });
  }

  _waitForResume() {
    return new Promise((resolve) => {
      this._resumeResolve = resolve;
    });
  }
}
