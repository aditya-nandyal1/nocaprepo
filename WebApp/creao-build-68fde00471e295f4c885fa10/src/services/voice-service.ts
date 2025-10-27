import { apiConfig } from "@/config/api-config";
import SemanticService from "@/services/semantic-service";

/**
 * Voice Input/Output Service
 *
 * Handles:
 * - Voice input capture via Vapi
 * - Speech-to-text transcription
 * - Text-to-speech via FishAudio and ElevenLabs
 * - Statement type classification (declarative vs opinion/question)
 */

export type StatementType = "declarative" | "opinion" | "question" | "other";

export type PermissionStatus = "granted" | "denied" | "prompt" | "unknown";

export interface TranscriptionResult {
	text: string;
	speaker_id: string;
	timestamp: string;
	statementType: StatementType;
	confidence: number;
}

export interface PermissionError extends Error {
	permissionStatus: PermissionStatus;
}

export interface AudioLevelUpdate {
	level: number; // 0-1 normalized volume level
	timestamp: string;
}

export interface ProcessingStateUpdate {
	isProcessing: boolean;
	stage: "capturing" | "transcribing" | "verifying" | "idle";
	timestamp: string;
}

interface VapiCall {
	id: string;
	status: "active" | "ended";
}

/**
 * Service for voice input capture and output
 */
export class VoiceService {
	private static instance: VoiceService | null = null;
	private isListening = false;
	private onTranscriptionCallback?: (result: TranscriptionResult) => void;
	private onAudioLevelCallback?: (update: AudioLevelUpdate) => void;
	private onProcessingStateCallback?: (update: ProcessingStateUpdate) => void;
	private vapiCall: VapiCall | null = null;
	private webSocket: WebSocket | null = null;
	private mediaRecorder: MediaRecorder | null = null;
	private audioStream: MediaStream | null = null;
	private audioChunks: Blob[] = [];
	private transcriptionInterval: number | null = null;
	private audioContext: AudioContext | null = null;
	private analyser: AnalyserNode | null = null;
	private audioLevelInterval: number | null = null;
	private transcriptionHistory: string[] = [];
	private currentSessionId: string | null = null;

	private constructor() {}

	public static getInstance(): VoiceService {
		if (!VoiceService.instance) {
			VoiceService.instance = new VoiceService();
		}
		return VoiceService.instance;
	}

	/**
	 * Check microphone permission status
	 */
	async checkMicrophonePermission(): Promise<PermissionStatus> {
		try {
			// Check if permissions API is available
			if (!navigator.permissions) {
				return "unknown";
			}

			const result = await navigator.permissions.query({
				name: "microphone" as PermissionName,
			});

			return result.state as PermissionStatus;
		} catch (error) {
			console.warn("Could not check microphone permission:", error);
			return "unknown";
		}
	}

	/**
	 * Request microphone permission explicitly
	 */
	async requestMicrophonePermission(): Promise<boolean> {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: true,
			});
			// Stop the stream immediately, we just wanted to trigger the permission
			for (const track of stream.getTracks()) {
				track.stop();
			}
			return true;
		} catch (error) {
			const permissionError = error as PermissionError;
			console.error("Microphone permission denied:", permissionError);
			return false;
		}
	}

	/**
	 * Set callback for audio level updates
	 */
	setAudioLevelCallback(callback: (update: AudioLevelUpdate) => void): void {
		this.onAudioLevelCallback = callback;
	}

	/**
	 * Set callback for processing state updates
	 */
	setProcessingStateCallback(
		callback: (update: ProcessingStateUpdate) => void,
	): void {
		this.onProcessingStateCallback = callback;
	}

	/**
	 * Emit processing state update
	 */
	private emitProcessingState(
		isProcessing: boolean,
		stage: ProcessingStateUpdate["stage"],
	): void {
		if (this.onProcessingStateCallback) {
			this.onProcessingStateCallback({
				isProcessing,
				stage,
				timestamp: new Date().toISOString(),
			});
		}
	}

	/**
	 * Set the current session ID for context tracking
	 */
	setSessionId(sessionId: string): void {
		this.currentSessionId = sessionId;
	}

	/**
	 * Start voice input capture using Vapi
	 */
	async startListening(
		callback: (result: TranscriptionResult) => void,
	): Promise<void> {
		this.isListening = true;
		this.onTranscriptionCallback = callback;
		this.emitProcessingState(false, "idle");
		this.transcriptionHistory = []; // Reset history for new session

		try {
			// Check if API key is configured
			if (!apiConfig.vapi.apiKey) {
				console.warn(
					"Vapi API key not configured, using browser audio fallback",
				);
				await this.startBrowserAudioCapture();
				return;
			}

			// Initialize Vapi session
			await this.initializeVapiSession();
		} catch (error) {
			console.error("Failed to start Vapi session:", error);
			// Fallback to browser audio
			await this.startBrowserAudioCapture();
		}
	}

	/**
	 * Initialize Vapi session with WebSocket connection
	 */
	private async initializeVapiSession(): Promise<void> {
		// Get transcriber configuration
		const transcriberConfig =
			apiConfig.vapi.transcriber?.provider === "grok-whisper"
				? {
						provider: "custom-whisper", // Use custom provider for Grok Whisper
						model: apiConfig.vapi.transcriber.model || "grok-whisper-large-v3",
						language: apiConfig.vapi.transcriber.language || "en",
						// Additional settings for better accuracy
						temperature: 0.0, // More deterministic transcription
						word_timestamps: true, // Get precise word timings
						vad_enabled: true, // Voice Activity Detection to filter silence
						smart_format: true, // Automatic punctuation and formatting
					}
				: {
						provider: "deepgram",
						model: "nova-2",
						language: "en",
					};

		const response = await fetch(`${apiConfig.vapi.baseUrl}/v1/calls`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiConfig.vapi.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				assistant: apiConfig.vapi.assistantId
					? { id: apiConfig.vapi.assistantId }
					: {
							model: {
								provider: "openai",
								model: "gpt-4",
								messages: [
									{
										role: "system",
										content:
											"You are a transcription assistant. Transcribe speech accurately and identify speakers.",
									},
								],
							},
							voice: {
								provider: "11labs",
								voiceId: "premade-voice-1",
							},
						},
				transcriber: transcriberConfig,
			}),
		});

		if (!response.ok) {
			throw new Error(`Vapi API error: ${response.statusText}`);
		}

		this.vapiCall = await response.json();

		// Connect to Vapi WebSocket for real-time transcription
		this.connectVapiWebSocket();

		console.log(
			`Vapi session started with ${transcriberConfig.provider}:`,
			this.vapiCall?.id,
		);
	}

	/**
	 * Connect to Vapi WebSocket for real-time transcription events
	 */
	private connectVapiWebSocket(): void {
		if (!this.vapiCall) return;

		const wsUrl = `${apiConfig.vapi.baseUrl.replace("https://", "wss://")}/v1/calls/${this.vapiCall.id}/stream`;

		this.webSocket = new WebSocket(wsUrl);

		this.webSocket.onmessage = (event) => {
			const data = JSON.parse(event.data);

			// Handle transcription events
			if (data.type === "transcript" && data.transcript) {
				this.handleTranscription(data.transcript, data.speaker || "user-1");
			}
		};

		this.webSocket.onerror = (error) => {
			console.error("Vapi WebSocket error:", error);
		};

		this.webSocket.onclose = () => {
			console.log("Vapi WebSocket closed");
		};
	}

	/**
	 * Set up audio level monitoring with adaptive speech pattern tracking
	 */
	private setupAudioLevelMonitoring(stream: MediaStream): void {
		try {
			this.audioContext = new AudioContext();
			const source = this.audioContext.createMediaStreamSource(stream);
			this.analyser = this.audioContext.createAnalyser();
			this.analyser.fftSize = 256;
			source.connect(this.analyser);

			const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
			let lastIsSpeaking = false;

			// Monitor audio level every 100ms
			this.audioLevelInterval = window.setInterval(() => {
				if (this.analyser) {
					this.analyser.getByteFrequencyData(dataArray);

					// Calculate average volume (0-255)
					const average =
						dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

					// Normalize to 0-1
					const normalizedLevel = Math.min(1, average / 128);

					// Detect speech activity (LOWERED threshold from 0.05 to 0.03 for BETTER detection)
					const isSpeaking = normalizedLevel > 0.03;

					// Track speech state changes
					if (isSpeaking !== lastIsSpeaking) {
						lastIsSpeaking = isSpeaking;
					}

					// Emit audio level update
					if (this.onAudioLevelCallback) {
						this.onAudioLevelCallback({
							level: normalizedLevel,
							timestamp: new Date().toISOString(),
						});
					}
				}
			}, 100);
		} catch (error) {
			console.warn("Failed to set up audio level monitoring:", error);
		}
	}

	/**
	 * Fallback: Use browser MediaRecorder API for audio capture with Groq Whisper transcription
	 */
	private async startBrowserAudioCapture(): Promise<void> {
		try {
			this.audioStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					channelCount: 1,
					sampleRate: 16000,
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true, // Automatically boost quiet audio
				} as MediaTrackConstraints,
			});

			// Set up audio level monitoring
			this.setupAudioLevelMonitoring(this.audioStream);

			this.mediaRecorder = new MediaRecorder(this.audioStream, {
				mimeType: "audio/webm;codecs=opus",
			});

			this.audioChunks = [];

			this.mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					this.audioChunks.push(event.data);
					console.log("Audio chunk captured:", event.data.size, "bytes");
					this.emitProcessingState(true, "capturing");
				}
			};

			// Start with 300ms chunks for FAST response
			this.mediaRecorder.start(300);

			// Set up interval to transcribe accumulated audio using FIXED FAST timing
			const transcribeAudio = async () => {
				if (this.audioChunks.length > 0) {
					const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
					const blobSize = audioBlob.size;
					this.audioChunks = []; // Clear chunks

					// Only process if blob has meaningful size (>256 bytes to avoid silence, lowered for sensitivity)
					if (blobSize > 256) {
						console.log(
							`🎙️ [AUDIO CAPTURE] Processing ${blobSize} bytes → Groq Whisper`,
						);
						this.emitProcessingState(true, "transcribing");
						await this.transcribeWithGroqWhisper(audioBlob);
						this.emitProcessingState(false, "idle");
					} else {
						console.log(
							`⏭️ [AUDIO CAPTURE] Skipping ${blobSize} bytes (too small, likely silence)`,
						);
						this.emitProcessingState(false, "idle");
					}
				}

				// Schedule next transcription with FIXED 500ms interval for speed
				if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
					this.transcriptionInterval = window.setTimeout(transcribeAudio, 500);
				}
			};

			// Start the fast transcription loop with 500ms interval
			this.transcriptionInterval = window.setTimeout(transcribeAudio, 500);

			console.log("========================================");
			console.log("🎤 TRANSCRIPTION ACTIVE");
			console.log("========================================");
			console.log("✅ Audio Capture: Browser MediaRecorder");
			console.log("✅ Transcription: Groq Whisper API");
			console.log("✅ Model: whisper-large-v3-turbo");
			console.log("✅ Processing: Every 500ms");
			console.log("✅ Chunk Size: 300ms");
			console.log("========================================");
			console.log("🎙️ Speak now - transcription will appear in real-time");
			console.log("========================================");
		} catch (error) {
			const permissionError = error as PermissionError;

			// Determine permission status from the actual getUserMedia error
			if (error instanceof DOMException) {
				if (error.name === "NotAllowedError") {
					permissionError.permissionStatus = "denied";
					permissionError.message =
						"Microphone access denied. Please allow microphone access in your browser settings.";
				} else if (error.name === "NotFoundError") {
					permissionError.permissionStatus = "denied";
					permissionError.message =
						"No microphone found. Please connect a microphone and try again.";
				} else if (error.name === "NotReadableError") {
					permissionError.permissionStatus = "denied";
					permissionError.message =
						"Microphone is being used by another application. Please close other apps and try again.";
				} else {
					permissionError.permissionStatus = "unknown";
					permissionError.message = `Microphone error: ${error.message}`;
				}
			} else {
				// Fallback: check permission status via API
				const status = await this.checkMicrophonePermission();
				permissionError.permissionStatus = status;
			}

			console.error("Failed to access microphone:", permissionError);
			throw permissionError;
		}
	}

	/**
	 * Transcribe audio using Groq Whisper AI
	 */
	private async transcribeWithGroqWhisper(audioBlob: Blob): Promise<void> {
		if (!apiConfig.groq.apiKey) {
			console.warn("Groq API key not configured, skipping transcription");
			return;
		}

		try {
			// Convert webm to a format Whisper can handle
			const formData = new FormData();
			formData.append("file", audioBlob, "audio.webm");
			// Use whisper-large-v3-turbo for FASTER transcription (2x faster than v3)
			formData.append(
				"model",
				apiConfig.groq.transcriptionModel || "whisper-large-v3-turbo",
			);
			formData.append("language", "en");
			formData.append("response_format", "json");
			// Add temperature 0 for more accurate, deterministic transcription
			formData.append("temperature", "0");

			const response = await fetch(
				`${apiConfig.groq.baseUrl}/audio/transcriptions`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${apiConfig.groq.apiKey}`,
					},
					body: formData,
				},
			);

			if (!response.ok) {
				const errorText = await response.text();
				console.error(
					"Groq Whisper API error:",
					response.statusText,
					errorText,
				);
				return;
			}

			const data = await response.json();
			const transcribedText = data.text?.trim();

			// Only process if we got actual text (not empty or just silence)
			if (transcribedText && transcribedText.length > 0) {
				console.log(
					"🎤 [TRANSCRIPTION] Raw text from Groq Whisper:",
					transcribedText,
				);
				this.handleTranscription(transcribedText, "user-1");
			} else {
				console.log(
					"⏭️ [TRANSCRIPTION] Skipped - no text detected (silence or empty)",
				);
			}
		} catch (error) {
			console.error("Groq Whisper transcription error:", error);
		}
	}

	/**
	 * Process transcription and classify statement type using AI
	 */
	private async handleTranscription(
		text: string,
		speakerId: string,
	): Promise<void> {
		// Use semantic analysis to improve transcription accuracy
		const semanticResult = await SemanticService.analyzeTranscription(
			text,
			this.transcriptionHistory.slice(-5), // Use last 5 transcriptions for context
		);

		// Split compound statements into individual statements for better verification
		const statements = await SemanticService.splitStatements(
			semanticResult.improvedText,
			this.transcriptionHistory.slice(-5),
		);

		console.log(
			`📝 [TRANSCRIPTION PROCESSING] Analyzing ${statements.length} statement(s)`,
		);

		// Process each statement separately
		for (const statement of statements) {
			console.log(
				`🔍 [STATEMENT ${statements.indexOf(statement) + 1}/${statements.length}] "${statement}"`,
			);

			// Use Claude to classify if this is truly a declarative statement
			const classification = await SemanticService.classifyStatementWithClaude(
				statement,
				this.transcriptionHistory.slice(-5),
			);

			console.log(
				`📊 Statement classification: "${statement}" -> ${classification.isDeclarative ? "✅ DECLARATIVE" : "❌ NON-DECLARATIVE"} (${Math.round(classification.confidence * 100)}% confidence)`,
			);
			console.log(`💡 Reasoning: ${classification.reasoning}`);

			// Store improved text in history
			this.transcriptionHistory.push(statement);
			if (this.transcriptionHistory.length > 10) {
				this.transcriptionHistory.shift(); // Keep only last 10
			}

			// Store in ChromaDB for future context
			if (this.currentSessionId) {
				await SemanticService.storeTranscription(statement, {
					timestamp: new Date().toISOString(),
					speaker_id: speakerId,
					session_id: this.currentSessionId,
				});
			}

			// Use Claude's classification, but keep basic fallback as backup
			const statementType = classification.isDeclarative
				? "declarative"
				: this.classifyStatementType(statement);

			const result: TranscriptionResult = {
				text: statement, // Use split and semantically improved text
				speaker_id: speakerId,
				timestamp: new Date().toISOString(),
				statementType,
				confidence: Math.max(
					semanticResult.confidence,
					classification.confidence,
				),
			};

			// ALWAYS process callback - this enables continuous input
			console.log(
				`✅ [TRANSCRIPTION COMPLETE] Sending to UI: "${result.text}" (${result.statementType})`,
			);
			this.onTranscriptionCallback?.(result);
		}
	}

	/**
	 * Stop voice input capture
	 */
	async stopListening(): Promise<void> {
		this.isListening = false;
		this.onTranscriptionCallback = undefined;
		this.onAudioLevelCallback = undefined;
		this.onProcessingStateCallback = undefined;

		// Clear transcription interval
		if (this.transcriptionInterval) {
			clearInterval(this.transcriptionInterval);
			this.transcriptionInterval = null;
		}

		// Clear audio level monitoring
		if (this.audioLevelInterval) {
			clearInterval(this.audioLevelInterval);
			this.audioLevelInterval = null;
		}

		// Clean up audio context
		if (this.audioContext) {
			await this.audioContext.close();
			this.audioContext = null;
			this.analyser = null;
		}

		// Clean up Vapi session
		if (this.vapiCall && apiConfig.vapi.apiKey) {
			try {
				await fetch(
					`${apiConfig.vapi.baseUrl}/v1/calls/${this.vapiCall.id}/end`,
					{
						method: "POST",
						headers: {
							Authorization: `Bearer ${apiConfig.vapi.apiKey}`,
						},
					},
				);
			} catch (error) {
				console.error("Failed to end Vapi call:", error);
			}
			this.vapiCall = null;
		}

		// Clean up WebSocket
		if (this.webSocket) {
			this.webSocket.close();
			this.webSocket = null;
		}

		// Clean up browser audio
		if (this.mediaRecorder) {
			this.mediaRecorder.stop();
			this.mediaRecorder = null;
		}

		if (this.audioStream) {
			for (const track of this.audioStream.getTracks()) {
				track.stop();
			}
			this.audioStream = null;
		}

		// Clear audio chunks
		this.audioChunks = [];

		console.log("Voice input stopped");
	}

	/**
	 * Check if currently listening
	 */
	isActive(): boolean {
		return this.isListening;
	}

	/**
	 * Classify statement type using AI-powered semantic analysis
	 * This is now a simplified wrapper - the heavy lifting happens in SemanticService
	 */
	classifyStatementType(text: string): StatementType {
		const normalized = text.trim().toLowerCase();

		// Strong question indicators
		if (
			normalized.endsWith("?") ||
			normalized.startsWith("how ") ||
			normalized.startsWith("what ") ||
			normalized.startsWith("when ") ||
			normalized.startsWith("where ") ||
			normalized.startsWith("who ") ||
			normalized.startsWith("why ") ||
			normalized.startsWith("could you ") ||
			normalized.startsWith("would you ") ||
			normalized.startsWith("can you ")
		) {
			return "question";
		}

		// Strong opinion indicators
		if (
			normalized.includes("i think") ||
			normalized.includes("i believe") ||
			normalized.includes("in my opinion") ||
			normalized.includes("i feel") ||
			normalized.includes("i prefer") ||
			normalized.startsWith("i like") ||
			normalized.startsWith("i dislike") ||
			normalized.startsWith("i love") ||
			normalized.startsWith("i hate")
		) {
			return "opinion";
		}

		// Default to declarative for statements with factual structure
		// The semantic service will refine this further
		const hasFactualStructure =
			normalized.includes(" is ") ||
			normalized.includes(" are ") ||
			normalized.includes(" was ") ||
			normalized.includes(" were ") ||
			normalized.includes(" has ") ||
			normalized.includes(" have ") ||
			normalized.includes(" will ") ||
			normalized.includes(" can ") ||
			normalized.includes(" does ") ||
			normalized.includes(" did ") ||
			/\b(the|it|this|that|they|there)\b/.test(normalized) ||
			/\d/.test(normalized); // Contains numbers

		if (hasFactualStructure) {
			return "declarative";
		}

		return "other";
	}

	/**
	 * Speak text using text-to-speech
	 */
	async speak(
		text: string,
		provider: "fishaudio" | "elevenlabs" = "fishaudio",
	): Promise<void> {
		try {
			if (provider === "fishaudio" && apiConfig.fishAudio.apiKey) {
				await this.speakWithFishAudio(text);
			} else if (provider === "elevenlabs" && apiConfig.elevenLabs.apiKey) {
				await this.speakWithElevenLabs(text);
			} else {
				// Fallback to browser speech synthesis
				await this.speakWithBrowser(text);
			}
		} catch (error) {
			console.error(`TTS error with ${provider}:`, error);
			// Fallback to browser speech
			await this.speakWithBrowser(text);
		}
	}

	/**
	 * Speak using FishAudio API
	 */
	private async speakWithFishAudio(text: string): Promise<void> {
		const response = await fetch(`${apiConfig.fishAudio.baseUrl}/v1/tts`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiConfig.fishAudio.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				text,
				voice: "default",
				format: "mp3",
				speed: 1.1, // Slightly faster for more natural corrections
				pitch: 0, // Normal pitch
				emotion: "serious", // Serious tone for fact corrections
				sample_rate: 24000, // Higher quality audio
			}),
		});

		if (!response.ok) {
			throw new Error(`FishAudio API error: ${response.statusText}`);
		}

		const audioBlob = await response.blob();
		await this.playAudioBlob(audioBlob);
	}

	/**
	 * Speak using ElevenLabs API
	 */
	private async speakWithElevenLabs(text: string): Promise<void> {
		const voiceId = apiConfig.elevenLabs.voiceId || "21m00Tcm4TlvDq8ikWAM"; // Default voice

		const response = await fetch(
			`${apiConfig.elevenLabs.baseUrl}/v1/text-to-speech/${voiceId}`,
			{
				method: "POST",
				headers: {
					"xi-api-key": apiConfig.elevenLabs.apiKey,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					text,
					model_id: "eleven_monolingual_v1",
					voice_settings: {
						stability: 0.5,
						similarity_boost: 0.75,
					},
				}),
			},
		);

		if (!response.ok) {
			throw new Error(`ElevenLabs API error: ${response.statusText}`);
		}

		const audioBlob = await response.blob();
		await this.playAudioBlob(audioBlob);
	}

	/**
	 * Fallback: Use browser SpeechSynthesis API
	 */
	private async speakWithBrowser(text: string): Promise<void> {
		return new Promise((resolve) => {
			const utterance = new SpeechSynthesisUtterance(text);
			utterance.onend = () => resolve();
			utterance.onerror = () => resolve(); // Resolve even on error
			window.speechSynthesis.speak(utterance);
		});
	}

	/**
	 * Play audio blob through browser
	 */
	private async playAudioBlob(blob: Blob): Promise<void> {
		return new Promise((resolve, reject) => {
			const audio = new Audio(URL.createObjectURL(blob));
			audio.onended = () => {
				URL.revokeObjectURL(audio.src);
				resolve();
			};
			audio.onerror = (error) => {
				URL.revokeObjectURL(audio.src);
				reject(error);
			};
			audio.play().catch(reject);
		});
	}

	/**
	 * Generate subtitles for spoken text (using Groq)
	 */
	async generateSubtitles(text: string): Promise<string> {
		// In a real implementation, this would call Groq API for subtitle generation
		return text;
	}
}

export default VoiceService.getInstance();
