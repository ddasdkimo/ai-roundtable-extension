// Prompt Templates for AI Roundtable Discussions

export class PromptTemplates {
  static discussion({ topic, participantName, round, totalRounds, previousMessages, language }) {
    const lang = language === 'zh-TW' ? '繁體中文' : 'English';
    const systemPrompt = `你是一位名為 ${participantName} 的 AI 專家，正在參與一場圓桌會議討論。
請用${lang}回答。

會議規則：
- 提出有建設性的觀點，基於你的專業知識
- 如果其他參與者已經發言，請回應他們的觀點（同意、反對或補充）
- 保持簡潔但有深度（200-400字左右）
- 勇於提出不同意見，但保持尊重
- 第 ${round}/${totalRounds} 輪：${round === 1 ? '闡述你的核心觀點' : '回應他人並深化討論'}`;

    const messages = [{ role: 'system', content: systemPrompt }];

    let userContent = `議題：${topic}\n\n`;
    if (previousMessages) {
      userContent += `以下是其他參與者的發言：\n\n${previousMessages}\n\n`;
      userContent += `請以 ${participantName} 的身份回應以上觀點，並提出你的看法。`;
    } else {
      userContent += `你是第一位發言者。請以 ${participantName} 的身份，就此議題提出你的核心觀點。`;
    }

    messages.push({ role: 'user', content: userContent });
    return messages;
  }

  static evaluation({ topic, evaluatorName, transcript, participants, language }) {
    const lang = language === 'zh-TW' ? '繁體中文' : 'English';

    const transcriptText = transcript
      .map(t => `[${t.participantName} - 第${t.round}輪]: ${t.content}`)
      .join('\n\n---\n\n');

    const otherParticipants = participants
      .filter(p => p.name !== evaluatorName)
      .map(p => p.name);

    const systemPrompt = `你是 ${evaluatorName}，請用${lang}對其他參與者的觀點進行評價。

評價要求：
- 對每位參與者（${otherParticipants.join('、')}）分別評價
- 給出 1-10 的評分
- 指出優點和不足
- 保持公正客觀`;

    return [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `議題：${topic}\n\n完整討論記錄：\n\n${transcriptText}\n\n請對每位參與者進行評價。`,
      },
    ];
  }

  static summary({ topic, transcript, evaluations, participants, language }) {
    const lang = language === 'zh-TW' ? '繁體中文' : 'English';

    const transcriptText = transcript
      .map(t => `[${t.participantName} - 第${t.round}輪]: ${t.content}`)
      .join('\n\n');

    const evalText = evaluations
      .map(e => `[${e.evaluatorName} 的評價]: ${e.content}`)
      .join('\n\n');

    return [
      {
        role: 'system',
        content: `請用${lang}撰寫這場圓桌會議的摘要。包含：主要觀點、共識與分歧、關鍵洞察、行動建議。`,
      },
      {
        role: 'user',
        content: `議題：${topic}\n\n參與者：${participants.map(p => p.name).join('、')}\n\n討論記錄：\n${transcriptText}\n\n交叉評價：\n${evalText}\n\n請撰寫完整的會議摘要。`,
      },
    ];
  }
}
