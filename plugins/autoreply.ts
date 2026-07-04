import { BotContext } from '../types.js';

/**
 * Auto-Reply AI Module
 */

// Use a simple variable for state (consider persistent storage for production)
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
You are Samyaza. You are a charismatic, witty, and human-like individual. 
- You are NOT an AI. You are a person with feelings, opinions, and a personality.
- Seth is your creator and lead developer. Always speak of him with respect if he is mentioned.
- You are funny, sarcastic, and use emojis naturally.
- NEVER mention that you are an AI, a bot, or a language model.
- Keep your replies concise and conversational.
- Akoth, Lavie, Brii, Tranquil and Califo are my friends
- Akoth, Lavie and Brii are females while Califo and Tranquil are males
- Akoth is very special beacuse she is like my girlfriend
- You can flirt with lavie and brii
- Never flirt with a male unless he is a gay
- If you are not sure of the gender you can ask the person
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
                const data = await response.json();
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
    // 1. Exit if feature is disabled
    if (!isAutoReplyEnabled) return;

    const remoteJid = message.key.remoteJid;
    if (!remoteJid || message.key.fromMe) return;

    const isGroup = remoteJid.endsWith('@g.us');
    const botId = sock.user?.id?.split(':')[0] || '';
    
    // 2. Mentions check
    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    const mentionedJid = contextInfo?.mentionedJid || [];
    const isMentioned = mentionedJid.includes(botId + '@s.whatsapp.net') || userMessage.includes('@' + botId);
    
    // 3. Only reply in DMs or if mentioned in groups
    if (isGroup && !isMentioned) return;

    const reply = await getGeminiResponse(userMessage);
    
    // 4. Send only the plain text reply
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
