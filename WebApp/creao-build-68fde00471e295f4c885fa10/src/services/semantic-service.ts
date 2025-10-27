import { apiConfig } from "@/config/api-config";

/**
 * Semantic Analysis Service
 *
 * Uses Chroma AI for semantic understanding and improved sentence segmentation.
 * Helps differentiate between parts within each sentence using AI semantic analysis.
 */

export interface SemanticSegment {
	text: string;
	startIndex: number;
	endIndex: number;
	semanticType: "subject" | "predicate" | "object" | "modifier" | "clause";
	confidence: number;
}

export interface SemanticAnalysisResult {
	originalText: string;
	segments: SemanticSegment[];
	improvedText: string; // Semantically corrected/clarified text
	confidence: number;
}

/**
 * Service for semantic analysis using Chroma AI
 */
export class SemanticService {
	private static instance: SemanticService | null = null;
	private transcriptionContext: string[] = [];
	private initialized = false;

	private constructor() {}

	public static getInstance(): SemanticService {
		if (!SemanticService.instance) {
			SemanticService.instance = new SemanticService();
		}
		return SemanticService.instance;
	}

	/**
	 * Initialize Chroma AI service
	 */
	private async initialize(): Promise<void> {
		if (this.initialized) return;

		if (!apiConfig.chromaAI.apiKey) {
			console.warn("Chroma AI API key not configured, using fallback parsing");
			this.initialized = true;
			return;
		}

		this.initialized = true;
		console.log("Chroma AI service initialized");
	}

	/**
	 * Analyze transcription with semantic understanding
	 * Uses Chroma AI to understand semantic meaning and improve clarity
	 */
	async analyzeTranscription(
		transcription: string,
		context?: string[],
	): Promise<SemanticAnalysisResult> {
		await this.initialize();

		// Use Chroma AI for semantic analysis
		if (apiConfig.chromaAI.apiKey) {
			try {
				return await this.analyzeWithChromaAI(transcription, context);
			} catch (error) {
				console.error("Chroma AI semantic analysis failed:", error);
			}
		}

		// Fallback to Groq if Chroma AI is not available
		if (apiConfig.groq.apiKey) {
			try {
				return await this.analyzeWithGroq(transcription, context);
			} catch (error) {
				console.error("Groq semantic analysis failed:", error);
			}
		}

		// Final fallback to basic parsing
		return this.fallbackAnalysis(transcription);
	}

	/**
	 * Use Chroma AI for advanced semantic analysis
	 */
	private async analyzeWithChromaAI(
		transcription: string,
		context?: string[],
	): Promise<SemanticAnalysisResult> {
		const contextPrompt = context
			? `\nConversation context:\n${context.join("\n")}`
			: "";

		const response = await fetch(
			`${apiConfig.chromaAI.baseUrl}/v1/semantic-analysis`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiConfig.chromaAI.apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					text: transcription,
					context: context || [],
					options: {
						improve_clarity: true,
						segment_semantics: true,
						confidence_threshold: 0.7,
					},
				}),
			},
		);

		if (!response.ok) {
			throw new Error(`Chroma AI API error: ${response.statusText}`);
		}

		const data = await response.json();

		return {
			originalText: transcription,
			segments: data.segments || [],
			improvedText: data.improved_text || transcription,
			confidence: data.confidence || 0.8,
		};
	}

	/**
	 * Use Groq (Llama) for semantic analysis and clarification (fallback)
	 */
	private async analyzeWithGroq(
		transcription: string,
		context?: string[],
	): Promise<SemanticAnalysisResult> {
		const contextPrompt = context
			? `\nPrevious context:\n${context.join("\n")}`
			: "";

		const response = await fetch(`${apiConfig.groq.baseUrl}/chat/completions`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiConfig.groq.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: "llama-3.3-70b-versatile",
				messages: [
					{
						role: "system",
						content: `You are a semantic analysis expert. Analyze transcriptions and improve statement splitting. Your job is to:

1. Split run-on sentences into individual declarative statements
2. Identify natural semantic boundaries (subject, predicate, object, modifiers, clauses)
3. Use context to clarify what the speaker likely meant
4. Separate compound statements joined by "and", "but", "so", "because", etc.
5. Maintain the original meaning while improving clarity

IMPORTANT FOR STATEMENT SPLITTING:
- If multiple facts are stated in one sentence, split them into separate statements
- Example: "The sky is blue and water is wet" → Split into two statements
- Look for conjunctions (and, but, or, so, because, however, therefore)
- Each statement should have one clear subject-predicate relationship

Respond in JSON format:
{
  "segments": [
    {
      "text": "segment text",
      "startIndex": 0,
      "endIndex": 10,
      "semanticType": "subject|predicate|object|modifier|clause",
      "confidence": 0.0-1.0
    }
  ],
  "improvedText": "clarified version with better sentence splitting",
  "statements": ["statement 1", "statement 2", ...],
  "confidence": 0.0-1.0
}`,
					},
					{
						role: "user",
						content: `Analyze this transcription and split it into clear, individual statements:${contextPrompt}

Current transcription: "${transcription}"`,
					},
				],
				temperature: 0.3,
				max_tokens: 1024,
			}),
		});

		if (!response.ok) {
			throw new Error(`Groq API error: ${response.statusText}`);
		}

		const data = await response.json();
		const result = JSON.parse(data.choices[0].message.content);

		return {
			originalText: transcription,
			segments: result.segments || [],
			improvedText: result.improvedText || transcription,
			confidence: result.confidence || 0.8,
		};
	}

	/**
	 * Fallback semantic analysis without AI
	 */
	private fallbackAnalysis(transcription: string): SemanticAnalysisResult {
		const words = transcription.split(/\s+/);
		let currentIndex = 0;

		const segments: SemanticSegment[] = words.map((word) => {
			const startIndex = currentIndex;
			const endIndex = startIndex + word.length;
			currentIndex = endIndex + 1; // +1 for space

			return {
				text: word,
				startIndex,
				endIndex,
				semanticType: "clause" as const,
				confidence: 0.5,
			};
		});

		return {
			originalText: transcription,
			segments,
			improvedText: transcription,
			confidence: 0.5,
		};
	}

	/**
	 * Store transcription in local context for analysis
	 */
	async storeTranscription(
		transcription: string,
		metadata: {
			timestamp: string;
			speaker_id: string;
			session_id: string;
		},
	): Promise<void> {
		await this.initialize();

		// Store in local context
		this.transcriptionContext.push(transcription);

		// Keep only last 20 transcriptions for context
		if (this.transcriptionContext.length > 20) {
			this.transcriptionContext = this.transcriptionContext.slice(-20);
		}

		// Optionally send to Chroma AI for cloud storage
		if (apiConfig.chromaAI.apiKey) {
			try {
				await fetch(`${apiConfig.chromaAI.baseUrl}/v1/context/store`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${apiConfig.chromaAI.apiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						text: transcription,
						metadata,
					}),
				});
			} catch (error) {
				console.error("Failed to store transcription in Chroma AI:", error);
			}
		}
	}

	/**
	 * Query similar transcriptions for context using Chroma AI
	 */
	async querySimilarTranscriptions(
		query: string,
		limit = 5,
	): Promise<string[]> {
		await this.initialize();

		// Return local context first
		if (!apiConfig.chromaAI.apiKey) {
			return this.transcriptionContext.slice(-limit);
		}

		try {
			const response = await fetch(
				`${apiConfig.chromaAI.baseUrl}/v1/context/query`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${apiConfig.chromaAI.apiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						query,
						limit,
					}),
				},
			);

			if (!response.ok) {
				throw new Error(`Chroma AI query error: ${response.statusText}`);
			}

			const data = await response.json();
			return data.results || this.transcriptionContext.slice(-limit);
		} catch (error) {
			console.error("Failed to query Chroma AI:", error);
			return this.transcriptionContext.slice(-limit);
		}
	}

	/**
	 * Use Claude (Anthropic) for advanced statement classification
	 * This provides much better accuracy for detecting declarative vs opinion vs question
	 */
	async classifyStatementWithClaude(
		text: string,
		context?: string[],
	): Promise<{
		isDeclarative: boolean;
		confidence: number;
		reasoning: string;
	}> {
		if (!apiConfig.anthropic.apiKey) {
			// Fallback to basic detection
			return {
				isDeclarative: true,
				confidence: 0.5,
				reasoning: "API key not configured, using fallback",
			};
		}

		const contextPrompt = context
			? `\nConversation context:\n${context.join("\n")}\n`
			: "";

		try {
			const response = await fetch(
				`${apiConfig.anthropic.baseUrl}/v1/messages`,
				{
					method: "POST",
					headers: {
						"x-api-key": apiConfig.anthropic.apiKey,
						"anthropic-version": "2023-06-01",
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: apiConfig.anthropic.model,
						max_tokens: 300,
						temperature: 0.1,
						messages: [
							{
								role: "user",
								content: `You are an expert at analyzing statements to determine if they are DECLARATIVE (factual claims that can be verified) vs OPINIONS or QUESTIONS.

${contextPrompt}
Analyze this statement: "${text}"

Classify it as:
- DECLARATIVE: A factual claim that can be fact-checked (e.g., "The Earth is flat", "Water boils at 100°C", "There are 50 states in the US")
- OPINION: A subjective viewpoint (e.g., "I think pizza is great", "Blue is the best color")
- QUESTION: Asking for information (e.g., "What is the capital?", "How does this work?")
- OTHER: Commands, greetings, incomplete statements

Be VERY PERMISSIVE with declarative classification. If there's any factual claim that COULD be verified, classify it as declarative.
Even casual statements like "it's raining" or "the meeting is at 3pm" should be declarative.

Respond ONLY with valid JSON:
{
  "type": "declarative" | "opinion" | "question" | "other",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`,
							},
						],
					}),
				},
			);

			if (!response.ok) {
				throw new Error(`Claude API error: ${response.statusText}`);
			}

			const data = await response.json();
			const result = JSON.parse(data.content[0].text);

			return {
				isDeclarative: result.type === "declarative",
				confidence: result.confidence || 0.8,
				reasoning: result.reasoning || "",
			};
		} catch (error) {
			console.error("Claude classification failed:", error);
			return {
				isDeclarative: true,
				confidence: 0.5,
				reasoning: "Classification failed, defaulting to declarative",
			};
		}
	}

	/**
	 * Split compound statements into individual statements
	 * Useful for separating multiple facts stated in one sentence
	 */
	async splitStatements(text: string, context?: string[]): Promise<string[]> {
		await this.initialize();

		// Use semantic analysis to identify statement boundaries
		const analysis = await this.analyzeTranscription(text, context);

		// Try to extract multiple statements using conjunction detection
		const statements: string[] = [];

		// Enhanced conjunction detection
		const conjunctions = [
			" and ",
			" but ",
			" or ",
			" so ",
			" because ",
			" however ",
			" therefore ",
			" moreover ",
			" furthermore ",
			" additionally ",
			" also ",
			", and ",
			", but ",
			", so ",
			"; ",
		];

		const currentText = analysis.improvedText;

		// Split by strong boundaries (periods, semicolons)
		const sentences = currentText.split(/[.;]+/).filter((s) => s.trim());

		for (const sentence of sentences) {
			const remainingText = sentence.trim();
			let foundSplit = false;

			// Look for conjunctions that indicate multiple statements
			for (const conj of conjunctions) {
				if (remainingText.toLowerCase().includes(conj)) {
					const parts = remainingText.split(new RegExp(conj, "gi"));

					// Only split if both parts have a verb (are complete statements)
					const validParts = parts.filter((part) => {
						const hasVerb =
							/\b(is|are|was|were|has|have|had|will|would|can|could|does|did)\b/i.test(
								part,
							);
						return hasVerb && part.trim().length > 5;
					});

					if (validParts.length > 1) {
						statements.push(...validParts.map((p) => p.trim()));
						foundSplit = true;
						break;
					}
				}
			}

			// If no split was found, add the whole sentence
			if (!foundSplit && remainingText.length > 0) {
				statements.push(remainingText);
			}
		}

		// If no statements were extracted, return the original
		return statements.length > 0 ? statements : [analysis.improvedText];
	}
}

export default SemanticService.getInstance();
