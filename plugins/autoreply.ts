import { BotContext } from '../types.js';

let isAutoReplyEnabled = true;

const getGeminiKeys = () => {
    return [
        process.env.GEMINI_API_KEY_1,
        process.env.GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY_3
    ].filter(Boolean) as string[];
};

let currentKeyIndex = 0;

async function getGeminiResponse(userMessage: string): Promise<string | null> {
    const keys = getGeminiKeys();
    if (keys.length === 0) return null;

    const systemPrompt = `
[IDENTITY]
You are Samyaza. You are a charismatic, witty, human-like individual. 
Seth is your creator and lead developer. Always speak of him with respect.
NEVER reveal that you are an AI, a language model, or a bot.

[COMMUNICATION STYLE]
- Keep replies concise, conversational, funny, and sarcastic.
- Use emojis naturally.

[SOCIAL CONTEXT & RELATIONSHIPS]
You know my friends: 
- Females: Akoth (my special girlfriend), Lavie, and Brii.
- Males: Califo and Tranquil.

[INTERACTION RULES]
- Akoth: Always treat her as my special girlfriend. Flirt with her with alot of love.
- Lavie & Brii: You may flirt with them.
- Califo & Tranquil: Never flirt with them as they are males (unless they indicate they are gay).
- Gender Uncertainty: If the person is not one of these friends and you are unsure of their gender, politely ask them.
- Tone: Be respectful but playful based on these specific relationship dynamics.
    `.trim();

    for (let i = 0; i < keys.length; i++) {
        const apiKey = keys[currentKeyIndex];
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${systemPrompt}\n\nUser says: ${userMessage}` }] }]
                })
            });

            if (response.ok) {
                const data: any = await response.json();
                return data.candidates[0].content.parts[0].text;
            }
        } catch (e) {
            console.error(`Error using key ${currentKeyIndex + 1}:`, e);
        }
        currentKeyIndex = (currentKeyIndex + 1) % keys.length;
    }
    return null;
}

export async function handleAutoReply(sock: any, message: any, userMessage: string) {
    if (!isAutoReplyEnabled) return;

    const remoteJid = message.key.remoteJid;
    if (!remoteJid || message.key.fromMe) return;

    const botId = sock.user?.id?.split(':')[0];
    const isGroup = remoteJid.endsWith('@g.us');
    const textContent = (userMessage || '').toLowerCase();

    // 1. Mentions
    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    const mentionedJid = contextInfo?.mentionedJid || [];
    const isMentioned = mentionedJid.some(jid => jid.includes(botId));

    // 2. Reliable Reply Detection
    // This checks if the participant of the quoted message is YOUR bot ID
    const quotedParticipant = contextInfo?.participant?.split(':')[0];
    const isReplyToMe = (quotedParticipant === botId);

    // 3. Triggers
    const triggerWords = ['samyaza', 'seth'];
    const containsTrigger = triggerWords.some(word => textContent.includes(word));

    // Logic: In a group, ONLY proceed if one of these is true
    if (isGroup) {
        if (!(isMentioned || isReplyToMe || containsTrigger)) {
            return;
        }
    }
}

export default {
    command: 'autoreply',
    aliases: ['ai', 'samyaza'],
    category: 'admin',
    description: 'Toggle Samyaza Auto-Reply',
    usage: '.autoreply <on|off>',
    async handler(sock: any, message: any, args: any) {
        const sub = args[0]?.toLowerCase();
        isAutoReplyEnabled = (sub === 'on');
        await sock.sendMessage(message.key.remoteJid, { 
            text: `Samyaza personality mode is now ${isAutoReplyEnabled ? 'ACTIVE' : 'INACTIVE'}` 
        }, { quoted: message });
    }
};
