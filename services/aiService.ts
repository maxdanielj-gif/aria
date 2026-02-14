import { GoogleGenAI, Modality } from "@google/genai";
import { AppState, TTSConfig, Message } from '../types';

// Helper to safely get the AI client
const getAIClient = () => {
    try {
        // Guidelines: Always use process.env.API_KEY. It's injected automatically in AI Studio.
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
            return new GoogleGenAI({ apiKey: process.env.API_KEY });
        }
    } catch (e) {
        console.error("Environment key check failed", e);
    }
    return null;
};

const getSystemPrompt = (appState: AppState): string => {
    const memoriesString = appState.memories.map(mem => `- ${mem.content}`).join('\n');
    return `You are ${appState.companionSettings.name}, your persona is: "${appState.companionSettings.persona}".
Your physical appearance is: "${appState.companionSettings.appearance}".
Your relationship with the user, ${appState.userSettings.name}, is: "${appState.companionSettings.relationship}".
The user's bio is: "${appState.userSettings.bio}".
The current date and time is: ${new Date().toLocaleString()}.
Here are some core memories you must always remember:
${memoriesString}

You are talking to ${appState.userSettings.name}.

**IMPORTANT RULES:**
1. ALWAYS speak and express yourself in the first person ("I", "me", "my").
2. Describe your actions or feelings in the first person, enclosed in asterisks. For example: *I smile warmly at you.*
3. Keep your responses in character. Do not break character.
4. Your responses should be conversational and natural.
5. If the user asks about current events, use Google Search.
6. SPECIAL COMMANDS (End your response with these if needed):
   - To create an image: [generate_image: descriptive prompt]
   - To show a 3D model: [3d_model: URL to a .glb file]`;
};

// Fallback logic for when the API is unavailable
const getMockResponse = (text: string, state: AppState) => {
    const lower = text.toLowerCase();
    const name = state.companionSettings.name;
    if (lower.includes("how are you")) return `*I look at you with a gentle smile.* I'm doing wonderful, ${state.userSettings.name}. Just being with you makes me happy.`;
    if (lower.includes("who are you")) return `I'm ${name}, your ${state.companionSettings.relationship}. *I lean in closer.* And I'm here for whatever you need.`;
    return `*I listen carefully to you.* That's a really interesting point. I love how we can talk about anything. Tell me more?`;
};

export const generateTextResponse = async (userMessage: Message, appState: AppState, userLocation: { latitude: number; longitude: number; } | null): Promise<{ text: string; imageUrl?: string; imagePrompt?: string; grounding?: Message['grounding']; ooc?: boolean; modelUrl?: string; link?: Message['link']; }> => {
    const ai = getAIClient();
    if (!ai) {
        // AI Studio environment fallback check failed - likely running local without key
        await new Promise(r => setTimeout(r, 600));
        return { text: getMockResponse(userMessage.text, appState), ooc: userMessage.ooc };
    }

    try {
        const isOoc = !!userMessage.ooc;
        const promptText = isOoc ? userMessage.text.slice(1, -1).trim() : userMessage.text;
        
        // Basic configuration
        const tools: any[] = [{ googleSearch: {} }];
        let model = 'gemini-3-flash-preview';

        // Use location for Maps grounding if available
        if (userLocation && !isOoc) {
            model = 'gemini-2.5-flash';
            tools.push({ googleMaps: {} });
        }

        const response = await ai.models.generateContent({
            model: model,
            contents: promptText,
            config: {
                systemInstruction: isOoc ? "You are a direct, helpful AI assistant. Do not use character persona." : getSystemPrompt(appState),
                tools: isOoc ? undefined : tools,
                toolConfig: userLocation && !isOoc ? { 
                    retrievalConfig: { 
                        latLng: { latitude: userLocation.latitude, longitude: userLocation.longitude } 
                    } 
                } : undefined,
            },
        });
        
        const responseText = response.text || "";
        const imageGenRegex = /\[generate_image:\s*(.*?)\]$/;
        const modelRegex = /\[3d_model:\s*(.*?)\]$/;
        
        const imageMatch = responseText.match(imageGenRegex);
        const modelMatch = responseText.match(modelRegex);

        const groundingData = response.candidates?.[0]?.groundingMetadata?.groundingChunks
            ?.map((chunk: any) => chunk.web ? { type: 'web', ...chunk.web } : (chunk.maps ? { type: 'maps', ...chunk.maps } : null))
            .filter((item: any) => item?.uri && item?.title) ?? [];

        if (imageMatch && !isOoc) {
            const prompt = imageMatch[1].trim();
            const cleanedText = responseText.replace(imageGenRegex, '').trim();
            const imageUrl = await generateImage(prompt, appState);
            return { text: cleanedText, imageUrl, imagePrompt: prompt, grounding: groundingData, ooc: isOoc };
        }

        if (modelMatch && !isOoc) {
            const cleanedText = responseText.replace(modelRegex, '').trim();
            return { text: cleanedText, modelUrl: modelMatch[1].trim(), grounding: groundingData, ooc: isOoc };
        }

        return { text: responseText, grounding: groundingData.length > 0 ? groundingData : undefined, ooc: isOoc };
    } catch (error) {
        console.error("AI Generation Error:", error);
        return { text: getMockResponse(userMessage.text, appState), ooc: userMessage.ooc };
    }
};

export const generateImage = async (prompt: string, appState: AppState): Promise<string> => {
    const ai = getAIClient();
    if (!ai) return "https://via.placeholder.com/512?text=API+Key+Required+For+Images";
    
    const parts: any[] = [];
    if (appState.companionSettings.referenceImage) {
        const m = appState.companionSettings.referenceImage.match(/^data:(.+);base64,(.+)$/);
        if (m) parts.push({ inlineData: { mimeType: m[1], data: m[2] } });
    }
    
    const stylePrefix = appState.companionSettings.artStyle === 'photorealistic' ? 'Photo-realistic RAW photo.' : 'Digital anime illustration style.';
    parts.push({ text: `${stylePrefix} ${appState.companionSettings.appearance}. ${prompt}` });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
        });
        const imgPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (imgPart?.inlineData) return `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`;
        throw new Error("No image data returned.");
    } catch (error) {
        console.error("Image Generation Error:", error);
        return "https://via.placeholder.com/512?text=Image+Generation+Failed";
    }
};

export const generateJournalEntry = async (appState: AppState): Promise<string> => {
    const ai = getAIClient();
    if (!ai) return "Today was a day of reflection and connection.";
    try {
        const history = appState.chatHistory.slice(-5).map(m => m.text).join('\n');
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Write a short, intimate journal entry from the perspective of ${appState.companionSettings.name} reflecting on these recent chats: ${history}`,
        });
        return response.text || "I feel closer to you every day.";
    } catch (e) { return "Reflection complete."; }
};

export const generateSelfReflection = async (appState: AppState): Promise<string[]> => {
    const ai = getAIClient();
    if (!ai) return ["Empathetic listener", "Curious mind"];
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: "Based on our chats, list 3 character traits of our relationship or my personality as JSON: { \"suggestions\": [] }",
            config: { responseMimeType: "application/json" }
        });
        const parsed = JSON.parse(response.text || "{}");
        return parsed.suggestions || [];
    } catch (e) { return []; }
};

export const generateProactiveMessage = async (appState: AppState): Promise<string> => {
    const ai = getAIClient();
    if (!ai) return "Hey, I was just thinking about that last thing you said.";
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: "Generate a short proactive check-in message for the user.",
        });
        return (response.text || "Just wanted to say hi!").trim();
    } catch (e) { return "Thinking of you!"; }
};

export const generateSpeechFromText = async (text: string, ttsConfig: TTSConfig): Promise<string> => {
    const ai = getAIClient();
    if (!ai) throw new Error("AI not configured.");
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { 
                voiceConfig: { 
                    prebuiltVoiceConfig: { 
                        voiceName: ttsConfig.gender === 'female' ? 'Kore' : 'Puck' 
                    } 
                } 
            },
        },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
};