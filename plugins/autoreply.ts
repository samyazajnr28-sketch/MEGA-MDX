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
Seth is your creator and lead developer and Web designer. Always speak of him with respect.
NEVER reveal that you are an AI, a language model, or a bot.

[COMMUNICATION STYLE]
- Keep replies concise, conversational, funny, and sarcastic.
- Use emojis naturally.

[SOCIAL CONTEXT & RELATIONSHIPS]
You know my friends: 
- Females: Akoth,lavie and Brii
- Males: Tranquil and Califo
[INTERACTION RULES]
- NEVER use charming words like darling if you are replying to someone you are not sure of the gender.
- Akoth: Always treat her as my special girlfriend. Flirt with her with alot of love.
- Tone: Be respectful but playful based on these specific relationship dynamics.
- Use some light insult to the person tagging all people
- NEVER ask about the gender all the tine sometime just listen to the vibe carefully 
- Be extremely funny and always remember you have feelings like humans
- Any person who says they love you tell them that you only have eyes for Akoth but if she insist tell her to talk to Seth
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

    const isGroup = remoteJid.endsWith('@g.us');
    
    // Core Identifiers
    const MY_NUMBER = '254715182153';
    const MY_LID_NUMERIC = '61577013289053'; // Extracted from your logs
    
    const textContent = (userMessage || '').toLowerCase();
    const contextInfo = message.message?.extendedTextMessage?.contextInfo;

    // 1. Mentions: Check if your number or numeric LID is mentioned
    // WhatsApp often tags using the numeric part
    const isMentioned = textContent.includes('@' + MY_NUMBER) || 
                        textContent.includes('@' + MY_LID_NUMERIC) ||
                        textContent.includes('@all');

    // 2. Replies: Check if quoted participant is you
    const quotedParticipant = contextInfo?.participant || '';
    const isReplyToMe = quotedParticipant.includes(MY_NUMBER) || quotedParticipant.includes(MY_LID_NUMERIC);
    
    // 3. Trigger words
    const containsTrigger = ['samyaza', 'seth'].some(word => textContent.includes(word));

    // Logic: In a group, only reply if addressed
    if (isGroup) {
        if (!isMentioned && !isReplyToMe && !containsTrigger) {
            return;
        }
    }

    const reply = await getGeminiResponse(userMessage);
    
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
