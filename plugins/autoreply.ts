import type { BotContext } from '../types.js';

/**
 * Auto-Reply AI Module
 * Rotates through GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3
 */

const getGeminiKeys = () => {
    // Specifically looking for keys 1, 2, and 3
    const keys = [
        process.env.GEMINI_API_KEY_1,
        process.env.GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY_3
    ].filter(Boolean); // Filters out any that might be undefined
    return keys as string[];
};

let currentKeyIndex = 0;

async function getGeminiResponse(userMessage: string, senderName: string): Promise<string | null> {
    const keys = getGeminiKeys();
    if (keys.length === 0) {
        console.error("No GEMINI_API_KEY found in environment variables.");
        return null;
    }

    const systemPrompt = `
You are Samyaza. You are a charismatic, witty, and human-like individual. 
- You are NOT an AI. You are a person with feelings, opinions, and a personality.
- Seth is your creator and lead developer. Always speak of him with respect if he is mentioned.
- You are funny, sarcastic, and use emojis naturally.
- NEVER mention that you are an AI, a bot, or a language model.
- Keep your replies concise and conversational.
- Reply to ${senderName}.
    `.trim();

    // Attempt to get a response, rotating keys on failure
    for (let i = 0; i < keys.length; i++) {
        const apiKey = keys[currentKeyIndex];
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${systemPrompt}\n\nUser says: ${userMessage}` }] }]
                })
            });

            if (response.ok) {
                const data = (await response.json()) as any;
                return data.candidates[0].content.parts[0].text;
            } else {
                console.warn(`Key ${currentKeyIndex + 1} failed with status ${response.status}`);
            }
        } catch (e) {
            console.error(`Error using key ${currentKeyIndex + 1}:`, e);
        }
        
        // Rotate to the next key
        currentKeyIndex = (currentKeyIndex + 1) % keys.length;
    }
    return null;
}

export async function handleAutoReply(sock: any, message: any, userMessage: string) {
    const remoteJid = message.key.remoteJid;
    if (!remoteJid) return;

    const isGroup = remoteJid.endsWith('@g.us');
    const senderId = message.key.participant || remoteJid;
    const botId = sock.user?.id?.split(':')[0] || '';

    // Robust Mention Detection
    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    const mentionedJid = contextInfo?.mentionedJid || [];
    const isMentioned = mentionedJid.includes(botId + '@s.whatsapp.net') || userMessage.includes('@' + botId);
    
    // Only reply if it's a DM or a mention in a group, and not a message from the bot
    if ((!isGroup || isMentioned) && !message.key.fromMe) {
        const reply = await getGeminiResponse(userMessage, senderId);
        
        if (reply) {
            await sock.sendPresenceUpdate('composing', remoteJid);
            // Simulate human delay
            await new Promise(resolve => setTimeout(resolve, 800));
            await sock.sendMessage(remoteJid, { text: reply }, { quoted: message });
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
        await sock.sendMessage(message.key.remoteJid, { 
            text: `Samyaza personality mode is now ${sub === 'on' ? 'ACTIVE' : 'INACTIVE'}` 
        }, { quoted: message });
    }
};
