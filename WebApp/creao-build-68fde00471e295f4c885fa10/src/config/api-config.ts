/**
 * API Configuration
 *
 * Centralized configuration for all external API integrations.
 * Set your API keys and base URLs here.
 */

export interface ApiConfig {
	// Voice Services
	vapi: {
		apiKey: string;
		baseUrl: string;
		assistantId?: string;
		transcriber?: {
			provider: "deepgram" | "grok-whisper";
			model?: string;
			language?: string;
		};
	};

	// AI Verification Services
	anthropic: {
		apiKey: string;
		baseUrl: string;
		model: string;
	};

	gemini: {
		apiKey: string;
		baseUrl: string;
		model: string;
	};

	fetchAI: {
		apiKey: string;
		agentverseUrl: string;
		asiOneUrl: string;
	};

	brightData: {
		apiKey: string;
		baseUrl: string;
	};

	lavaGateway: {
		apiKey: string;
		baseUrl: string;
	};

	// Text-to-Speech Services
	fishAudio: {
		apiKey: string;
		baseUrl: string;
	};

	elevenLabs: {
		apiKey: string;
		baseUrl: string;
		voiceId?: string;
	};

	// Subtitle Generation & Transcription
	groq: {
		apiKey: string;
		baseUrl: string;
		model: string;
		transcriptionModel: string;
	};

	// Additional Services
	chromaAI: {
		apiKey: string;
		baseUrl: string;
	};

	composio: {
		apiKey: string;
		baseUrl: string;
	};

	janitor: {
		apiKey: string;
		baseUrl: string;
	};
}

/**
 * Default API configuration
 * Replace these with your actual API keys and endpoints
 */
export const apiConfig: ApiConfig = {
	vapi: {
		apiKey: import.meta.env.VITE_VAPI_API_KEY || "",
		baseUrl: import.meta.env.VITE_VAPI_BASE_URL || "https://api.vapi.ai",
		assistantId: import.meta.env.VITE_VAPI_ASSISTANT_ID,
		transcriber: {
			provider:
				(import.meta.env.VITE_VAPI_TRANSCRIBER_PROVIDER as
					| "deepgram"
					| "grok-whisper") || "grok-whisper",
			model: import.meta.env.VITE_VAPI_TRANSCRIBER_MODEL || "whisper-large-v3",
			language: import.meta.env.VITE_VAPI_TRANSCRIBER_LANGUAGE || "en",
		},
	},

	anthropic: {
		apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY || "",
		baseUrl:
			import.meta.env.VITE_ANTHROPIC_BASE_URL || "https://api.anthropic.com",
		model: import.meta.env.VITE_ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
	},

	gemini: {
		apiKey: import.meta.env.VITE_GEMINI_API_KEY || "",
		baseUrl:
			import.meta.env.VITE_GEMINI_BASE_URL ||
			"https://generativelanguage.googleapis.com",
		model: import.meta.env.VITE_GEMINI_MODEL || "gemini-2.0-flash-exp",
	},

	fetchAI: {
		apiKey: import.meta.env.VITE_FETCHAI_API_KEY || "",
		agentverseUrl:
			import.meta.env.VITE_FETCHAI_AGENTVERSE_URL ||
			"https://agentverse.ai/api",
		asiOneUrl: import.meta.env.VITE_FETCHAI_ASIONE_URL || "https://asi.one/api",
	},

	brightData: {
		apiKey: import.meta.env.VITE_BRIGHTDATA_API_KEY || "",
		baseUrl:
			import.meta.env.VITE_BRIGHTDATA_BASE_URL || "https://api.brightdata.com",
	},

	lavaGateway: {
		apiKey: import.meta.env.VITE_LAVA_API_KEY || "",
		baseUrl:
			import.meta.env.VITE_LAVA_BASE_URL || "https://gateway.lavanet.xyz",
	},

	fishAudio: {
		apiKey: import.meta.env.VITE_FISHAUDIO_API_KEY || "",
		baseUrl:
			import.meta.env.VITE_FISHAUDIO_BASE_URL || "https://api.fish.audio",
	},

	elevenLabs: {
		apiKey: import.meta.env.VITE_ELEVENLABS_API_KEY || "",
		baseUrl:
			import.meta.env.VITE_ELEVENLABS_BASE_URL || "https://api.elevenlabs.io",
		voiceId: import.meta.env.VITE_ELEVENLABS_VOICE_ID,
	},

	groq: {
		apiKey: import.meta.env.VITE_GROQ_API_KEY || "",
		baseUrl:
			import.meta.env.VITE_GROQ_BASE_URL || "https://api.groq.com/openai/v1",
		model: import.meta.env.VITE_GROQ_MODEL || "whisper-large-v3",
		transcriptionModel:
			import.meta.env.VITE_GROQ_TRANSCRIPTION_MODEL || "whisper-large-v3-turbo",
	},

	chromaAI: {
		apiKey: import.meta.env.VITE_CHROMA_AI_API_KEY || "",
		baseUrl:
			import.meta.env.VITE_CHROMA_AI_BASE_URL || "https://api.chroma-ai.com",
	},

	composio: {
		apiKey: import.meta.env.VITE_COMPOSIO_API_KEY || "",
		baseUrl:
			import.meta.env.VITE_COMPOSIO_BASE_URL || "https://api.composio.dev",
	},

	janitor: {
		apiKey: import.meta.env.VITE_JANITOR_API_KEY || "",
		baseUrl:
			import.meta.env.VITE_JANITOR_BASE_URL || "https://api.janitorai.com",
	},
};

/**
 * Helper to check if an API is configured
 */
export function isApiConfigured(service: keyof ApiConfig): boolean {
	const config = apiConfig[service] as Record<string, string | undefined>;
	if (!config) return false;

	// Check if API key is set (most services require it)
	if ("apiKey" in config && typeof config.apiKey === "string") {
		return config.apiKey.length > 0;
	}

	// For services without API keys, check baseUrl
	if ("baseUrl" in config && typeof config.baseUrl === "string") {
		return config.baseUrl.length > 0;
	}

	return false;
}

/**
 * Get missing API configurations
 */
export function getMissingConfigs(): string[] {
	const required: (keyof ApiConfig)[] = [
		"vapi",
		"anthropic",
		"gemini",
		"fetchAI",
		"brightData",
		"lavaGateway",
		"fishAudio",
	];

	return required.filter((service) => !isApiConfigured(service));
}
