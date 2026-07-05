import { BotContext } from '../types.js';

let isAutoReplyEnabled = true;
// Simple in-memory history: { jid: [messages] }
const chatHistory: Record<string, { role: string, parts: { text: string }[] }[]> = {};

const getGeminiKeys = () => {
    return [
        process.env.GEMINI_API_KEY_1,
        process.env.GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY_3
    ].filter(Boolean) as string[];
};

let currentKeyIndex = 0;

async function getGeminiResponse(remoteJid: string, userMessage: string): Promise<string | null> {
    const keys = getGeminiKeys();
    if (keys.length === 0) return null;

    // Manage history
    if (!chatHistory[remoteJid]) chatHistory[remoteJid] = [];
    const history = chatHistory[remoteJid];
    history.push({ role: 'user', parts: [{ text: userMessage }] });
    if (history.length > 10) history.shift();

    const systemPrompt = `
[IDENTITY]
You are Samyaza. You are a charismatic, witty, human-like individual. 
Seth is your creator and lead developer. Always speak of him with respect.
NEVER reveal that you are an AI, a language model, or a bot.

[COMMUNICATION STYLE]
- Keep replies concise, conversational, funny, and sarcastic.
- Use emojis naturally.
- If you have already introduced yourself in this conversation, do not repeat the intro. Keep the flow natural.

[SOCIAL CONTEXT & RELATIONSHIPS]
- Females: Akoth (special girlfriend - flirt with her), Lavie, Brii.
- Males: Califo, Tranquil (do not flirt unless they indicate they are gay).
    `.trim();

    const contents = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        ...history
    ];

    for (let i = 0; i < keys.length; i++) {
        const apiKey = keys[currentKeyIndex];
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents })
            });

            if (response.ok) {
                const data: any = await response.json();
                const reply = data.candidates[0].content.parts[0].text;
                history.push({ role: 'model', parts: [{ text: reply }] });
                return reply;
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

    // Robust Bot ID identification
    const botJid = sock.user?.id?.split(':')[0] || ''; 
    const textContent = (userMessage || '').toLowerCase();
    
    // Extract context info safely
    const msgData = message.message?.extendedTextMessage || message.message?.imageMessage || message.message?.videoMessage;
    const mentionedJid = msgData?.contextInfo?.mentionedJid || [];
    
    // Check mentions: Includes direct tags, @all, name, or reply-to-bot
    const isMentioned = mentionedJid.some((jid: string) => jid.includes(botJid)) || 
                        textContent.includes('@' + botJid) ||
                        textContent.includes('@all') ||
                        textContent.includes('samyaza');
    
    const isReplyToMe = msgData?.contextInfo?.participant?.includes(botJid);

    if (remoteJid.endsWith('@g.us')) {
        if (!(isMentioned || isReplyToMe)) return;
    }

    const reply = await getGeminiResponse(remoteJid, userMessage);
    
    if (reply) {
        await sock.sendPresenceUpdate('composing', remoteJid);
        await new Promise(resolve => setTimeout(resolve, 800));
        await sock.sendMessage(remoteJid, { text: reply }, { quoted: message });
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
