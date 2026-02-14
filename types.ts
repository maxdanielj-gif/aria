export type View = 'chat' | 'settings' | 'journal' | 'gallery' | 'memories';

export type ArtStyle = 'photorealistic' | 'anime';

export interface CompanionSettings {
    name: string;
    persona: string;
    appearance: string;
    relationship: string;
    referenceImage: string | null; // base64 string
    artStyle: ArtStyle;
}

export interface UserSettings {
    name: string;
    bio: string;
}

export interface TTSConfig {
    enabled: boolean;
    gender: 'female' | 'male';
    pitch: number;
    speed: number;
}

export interface InterfaceSettings {
    uiSounds: boolean;
}

export type NotificationFrequency = 'off' | 'rarely' | 'occasionally' | 'frequently' | 'very_frequently';

export interface NotificationsConfig {
    enabled: boolean;
    frequency: NotificationFrequency;
}

export interface ImageMetadata {
    src: string; // base64 string
    prompt: string;
    timestamp: string;
    context?: string; // Snippet of chat history
    tags: string[];
}

export interface Message {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    timestamp: string;
    ooc?: boolean;
    image?: ImageMetadata;
    file?: {
        name: string;
        content: string;
    }
    grounding?: {
        type: 'web' | 'maps';
        uri: string;
        title: string;
        placeAnswerSources?: {
            reviewSnippets?: {
                uri: string;
                content: string;
            }[];
        };
    }[];
    link?: {
        url: string;
        title: string;
        description: string;
    };
    modelUrl?: string; // URL for a 3D model (.glb, .gltf)
}

export interface JournalEntry {
    id: string;
    date: string;
    content: string;
}

export interface MemoryEntry {
    id: string;
    date: string;
    content: string;
}

export interface AppState {
    companionSettings: CompanionSettings;
    userSettings: UserSettings;
    memories: MemoryEntry[];
    chatHistory: Message[];
    journal: JournalEntry[];
    ttsConfig: TTSConfig;
    notifications: NotificationsConfig;
    interfaceSettings: InterfaceSettings;
}