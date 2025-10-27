import { MicrophonePermissionAlert } from "@/components/MicrophonePermissionAlert";
import { SpeakerQueuePanel } from "@/components/SpeakerQueuePanel";
import { UnifiedTranscriptionPanel } from "@/components/UnifiedTranscriptionPanel";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import {
	type DeclarativeStatementModel,
	DeclarativeStatementORM,
	DeclarativeStatementStatementType,
	DeclarativeStatementVerificationStatus,
} from "@/components/data/orm/orm_declarative_statement";
import {
	type SpeakerQueueModel,
	SpeakerQueueORM,
	SpeakerQueueProcessingStatus,
} from "@/components/data/orm/orm_speaker_queue";
import {
	UserSessionMode,
	type UserSessionModel,
	UserSessionORM,
} from "@/components/data/orm/orm_user_session";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VerificationService, {
	type VerificationResult,
} from "@/services/verification-service";
import VoiceService, {
	type AudioLevelUpdate,
	type PermissionError,
	type PermissionStatus,
	type ProcessingStateUpdate,
	type TranscriptionResult,
} from "@/services/voice-service";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

export const Route = createFileRoute("/")({
	component: App,
});

function App() {
	const [isListening, setIsListening] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);
	const [audioLevel, setAudioLevel] = useState(0);
	const [isMultiUserMode, setIsMultiUserMode] = useState(true);
	const [transcriptions, setTranscriptions] = useState<TranscriptionResult[]>(
		[],
	);
	const [speakerQueue, setSpeakerQueue] = useState<SpeakerQueueModel[]>([]);
	const [verificationResults, setVerificationResults] = useState<
		VerificationResult[]
	>([]);
	const [currentSession, setCurrentSession] = useState<UserSessionModel | null>(
		null,
	);
	const [processingStatement, setProcessingStatement] = useState<
		SpeakerQueueModel | undefined
	>();
	const [permissionStatus, setPermissionStatus] =
		useState<PermissionStatus>("unknown");
	const [permissionError, setPermissionError] = useState<string | null>(null);
	const [lastAudioTime, setLastAudioTime] = useState<number>(Date.now());
	const [isCurrentlySpeaking, setIsCurrentlySpeaking] = useState(false);

	// Initialize ORMs
	const userSessionORM = UserSessionORM.getInstance();
	const speakerQueueORM = SpeakerQueueORM.getInstance();
	const declarativeStatementORM = DeclarativeStatementORM.getInstance();

	const handleStartListening = useCallback(async () => {
		// Clear any previous errors
		setPermissionError(null);
		setPermissionStatus("unknown");

		// Create new session
		const newSession: Partial<UserSessionModel> = {
			mode: isMultiUserMode
				? UserSessionMode.MultiUser
				: UserSessionMode.SingleUser,
			start_time: new Date().toISOString(),
			is_active: true,
		};

		try {
			const sessions = await userSessionORM.insertUserSession([
				newSession as UserSessionModel,
			]);
			if (sessions.length > 0) {
				setCurrentSession(sessions[0]);
				// Set session ID for voice service context tracking
				VoiceService.setSessionId(sessions[0].id);
			}
		} catch (error) {
			console.error("Failed to create session:", error);
		}

		// Set up audio level callback with break detection
		VoiceService.setAudioLevelCallback((update: AudioLevelUpdate) => {
			setAudioLevel(update.level);

			// Detect audio breaks (silence after speech)
			if (update.level > 0.1) {
				// User is speaking
				setIsCurrentlySpeaking(true);
				setLastAudioTime(Date.now());
			} else {
				// Check if silence after speaking - use callback to get current state
				setIsCurrentlySpeaking((speaking) => {
					setLastAudioTime((lastTime) => {
						if (speaking && Date.now() - lastTime > 1000) {
							// Silence for more than 1 second after speaking - audio break detected
							setTimeout(() => setIsCurrentlySpeaking(false), 0);
						}
						return lastTime;
					});
					return speaking;
				});
			}
		});

		// Set up processing state callback
		VoiceService.setProcessingStateCallback((update: ProcessingStateUpdate) => {
			setIsProcessing(update.isProcessing);
		});

		// Start voice input
		try {
			await VoiceService.startListening(handleTranscription);
			setIsListening(true);
			setPermissionStatus("granted"); // If we got here, permission was granted
		} catch (error) {
			const permError = error as PermissionError;
			console.error("Failed to start listening:", permError);

			setPermissionError(
				permError.message ||
					"Failed to access microphone. Please check your browser permissions.",
			);

			// Update permission status
			if (permError.permissionStatus) {
				setPermissionStatus(permError.permissionStatus);
			}
		}
	}, [isMultiUserMode, userSessionORM]);

	const handleStopListening = useCallback(async () => {
		// Stop voice input
		await VoiceService.stopListening();
		setIsListening(false);
		setIsProcessing(false);
		setAudioLevel(0);

		// Update session
		if (currentSession) {
			const updatedSession: UserSessionModel = {
				...currentSession,
				end_time: new Date().toISOString(),
				is_active: false,
			};

			try {
				await userSessionORM.setUserSessionById(
					currentSession.id,
					updatedSession,
				);
				setCurrentSession(null);
			} catch (error) {
				console.error("Failed to update session:", error);
			}
		}
	}, [currentSession, userSessionORM]);

	const handleTranscription = useCallback(
		async (result: TranscriptionResult) => {
			// Add to transcriptions display
			setTranscriptions((prev) => {
				const newTranscriptions = [...prev, result];
				console.log(
					`📥 [UI RECEIVED] Transcription: "${result.text}" (type: ${result.statementType})`,
				);
				console.log(
					`📊 [UI UPDATE] Total transcriptions: ${newTranscriptions.length}`,
				);
				return newTranscriptions;
			});

			// Only process declarative statements for fact-checking
			if (result.statementType === "declarative" && currentSession) {
				console.log(
					`✅ DECLARATIVE STATEMENT DETECTED - Queueing for fact-check: "${result.text}"`,
				);
				console.log("🔄 Adding to speaker queue for verification...");
				// Add to speaker queue
				const queueItem: Partial<SpeakerQueueModel> = {
					user_session_id: currentSession.id,
					speaker_id: result.speaker_id,
					statement_text: result.text,
					statement_timestamp: result.timestamp,
					processing_status: SpeakerQueueProcessingStatus.Pending,
				};

				try {
					const queueItems = await speakerQueueORM.insertSpeakerQueue([
						queueItem as SpeakerQueueModel,
					]);
					if (queueItems.length > 0) {
						console.log(
							`✅ Successfully queued statement (ID: ${queueItems[0].id})`,
						);
						setSpeakerQueue((prev) => [...prev, queueItems[0]]);

						// Process the statement - THIS TRIGGERS FACT-CHECKING
						console.log("🚀 Triggering fact-check verification...");
						processStatement(queueItems[0], result.text);
					}
				} catch (error) {
					console.error("❌ Failed to add to queue:", error);
				}

				// Store declarative statement
				const statement: Partial<DeclarativeStatementModel> = {
					user_session_id: currentSession.id,
					speaker_id: result.speaker_id,
					original_transcription: result.text,
					statement_timestamp: result.timestamp,
					statement_type: DeclarativeStatementStatementType.Declarative,
					verification_status: DeclarativeStatementVerificationStatus.Pending,
				};

				try {
					await declarativeStatementORM.insertDeclarativeStatement([
						statement as DeclarativeStatementModel,
					]);
				} catch (error) {
					console.error("Failed to store statement:", error);
				}
			}
		},
		[currentSession, speakerQueueORM, declarativeStatementORM],
	);

	const processStatement = useCallback(
		async (queueItem: SpeakerQueueModel, statementText: string) => {
			console.log(
				`⚙️ processStatement called for: "${statementText}" (ID: ${queueItem.id})`,
			);

			// Update queue item to processing
			const updatedItem: SpeakerQueueModel = {
				...queueItem,
				processing_status: SpeakerQueueProcessingStatus.Processing,
			};

			try {
				await speakerQueueORM.setSpeakerQueueById(queueItem.id, updatedItem);
				setSpeakerQueue((prev) =>
					prev.map((item) => (item.id === queueItem.id ? updatedItem : item)),
				);
				setProcessingStatement(updatedItem);
				console.log("🔄 Queue item status updated to PROCESSING");

				// Verify the statement CONCURRENTLY - don't block new input
				// This runs in the background while the user continues speaking
				console.log(
					`🔍 Starting multi-agent fact-check for: "${statementText}"`,
				);
				const verificationResult =
					await VerificationService.verifyStatement(statementText);
				console.log(`✅ Fact-check COMPLETE for: "${statementText}"`);
				console.log(
					`   📊 Result: ${verificationResult.consensus} (${verificationResult.isFalse ? "❌ FALSE" : "✅ TRUE/INCONCLUSIVE"})`,
				);
				console.log(
					`   🔢 Consensus Score: ${Math.round(verificationResult.lavaGatewayConsensus.consensusScore * 100)}%`,
				);
				setVerificationResults((prev) => [...prev, verificationResult]);

				// Update queue item to processed IMMEDIATELY after verification
				const processedItem: SpeakerQueueModel = {
					...updatedItem,
					processing_status: SpeakerQueueProcessingStatus.Processed,
				};

				await speakerQueueORM.setSpeakerQueueById(queueItem.id, processedItem);
				setSpeakerQueue((prev) =>
					prev.map((item) => (item.id === queueItem.id ? processedItem : item)),
				);
				setProcessingStatement(undefined);

				// If statement is false, queue TTS interjection AFTER verification completes
				// This happens asynchronously and doesn't block new transcriptions
				if (
					verificationResult.isFalse &&
					verificationResult.correctInformation
				) {
					// Wait for audio break in the background (non-blocking)
					(async () => {
						const waitForBreak = () => {
							return new Promise<void>((resolve) => {
								const checkBreak = setInterval(() => {
									if (
										!isCurrentlySpeaking &&
										Date.now() - lastAudioTime > 1000
									) {
										clearInterval(checkBreak);
										resolve();
									}
								}, 100);

								// Timeout after 10 seconds
								setTimeout(() => {
									clearInterval(checkBreak);
									resolve();
								}, 10000);
							});
						};

						await waitForBreak();

						// Interject with corrective information
						const correctionMessage = `Actually, that's not quite right. ${verificationResult.correctInformation}`;
						await VoiceService.speak(correctionMessage);
					})(); // Fire and forget - doesn't block
				}
			} catch (error) {
				console.error("Failed to process statement:", error);

				// Mark as failed
				const failedItem: SpeakerQueueModel = {
					...queueItem,
					processing_status: SpeakerQueueProcessingStatus.Failed,
				};

				await speakerQueueORM.setSpeakerQueueById(queueItem.id, failedItem);
				setSpeakerQueue((prev) =>
					prev.map((item) => (item.id === queueItem.id ? failedItem : item)),
				);
				setProcessingStatement(undefined);
			}
		},
		[speakerQueueORM, isCurrentlySpeaking, lastAudioTime],
	);

	const handleSpeak = useCallback(async (text: string) => {
		await VoiceService.speak(text);
	}, []);

	return (
		<div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-6">
			<div className="mx-auto max-w-7xl space-y-6">
				{/* Header */}
				<div className="text-center space-y-4">
					<h1 className="text-5xl font-bold tracking-tight">NoCap</h1>
					<p className="text-xl text-muted-foreground">
						Multi-User AI Mediator for Truth Verification
					</p>
					<div className="flex items-center justify-center gap-4">
						<Badge variant="outline" className="text-sm">
							Powered by Multi-Agent Consensus
						</Badge>
						<Badge variant="outline" className="text-sm">
							Lava Gateway Verified
						</Badge>
					</div>
				</div>

				{/* Mode selector */}
				<Card className="mx-auto max-w-md">
					<CardHeader>
						<CardTitle>Session Mode</CardTitle>
						<CardDescription>
							Choose between single-user or multi-user monitoring
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div className="space-y-0.5">
								<Label htmlFor="multi-user-mode" className="text-base">
									Multi-User Mode
								</Label>
								<p className="text-sm text-muted-foreground">
									Monitor multiple speakers simultaneously
								</p>
							</div>
							<Switch
								id="multi-user-mode"
								checked={isMultiUserMode}
								onCheckedChange={setIsMultiUserMode}
								disabled={isListening}
							/>
						</div>
					</CardContent>
				</Card>

				{/* Microphone permission alert */}
				{(permissionStatus === "denied" || permissionError) && (
					<div className="mx-auto max-w-3xl">
						<MicrophonePermissionAlert
							onPermissionChange={(status) => {
								setPermissionStatus(status);
								if (status === "granted") {
									setPermissionError(null);
								}
							}}
						/>
					</div>
				)}

				{/* Voice input button */}
				<div className="flex justify-center py-8">
					<VoiceInputButton
						onStart={handleStartListening}
						onStop={handleStopListening}
						isListening={isListening}
						isProcessing={isProcessing}
						audioLevel={audioLevel}
						error={permissionError}
					/>
				</div>

				{/* Main content */}
				{isListening && (
					<Tabs defaultValue="unified" className="w-full">
						<TabsList className="grid w-full grid-cols-2">
							<TabsTrigger value="unified">Live Transcription</TabsTrigger>
							<TabsTrigger value="queue">Speaker Queue</TabsTrigger>
						</TabsList>

						<TabsContent value="unified" className="mt-6">
							<UnifiedTranscriptionPanel
								transcriptions={transcriptions}
								verificationResults={verificationResults}
								onSpeak={handleSpeak}
							/>
						</TabsContent>

						<TabsContent value="queue" className="mt-6">
							<SpeakerQueuePanel
								queue={speakerQueue}
								currentlyProcessing={processingStatement}
							/>
						</TabsContent>
					</Tabs>
				)}

				{/* Architecture info */}
				{!isListening && (
					<Card className="mx-auto max-w-4xl">
						<CardHeader>
							<CardTitle>How NoCap Works</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="space-y-2">
									<h3 className="font-semibold">Voice Processing</h3>
									<ul className="text-sm text-muted-foreground space-y-1">
										<li>• Vapi captures multi-user speech</li>
										<li>
											• Grok Whisper (via Vapi) for accurate transcription
										</li>
										<li>• Chroma AI semantic analysis & clarification</li>
										<li>
											• Enhanced statement splitting (compound → individual)
										</li>
										<li>• Audio break detection for interjections</li>
									</ul>
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold">Verification Pipeline</h3>
									<ul className="text-sm text-muted-foreground space-y-1">
										<li>• Claude (Anthropic) analysis</li>
										<li>• Fetch.ai agent verification</li>
										<li>• Gemini (Google) fact-checking</li>
										<li>• Bright Data web validation</li>
										<li>• Llama AI (via Lava Portal)</li>
										<li>• Lava Gateway consensus</li>
									</ul>
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold">Queue Management</h3>
									<ul className="text-sm text-muted-foreground space-y-1">
										<li>• Janitor.ai maintains speaker queue</li>
										<li>• Time-ordered processing</li>
										<li>• Groups identical misinformation</li>
										<li>• One statement at a time</li>
									</ul>
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold">Voice Output</h3>
									<ul className="text-sm text-muted-foreground space-y-1">
										<li>• FishAudio text-to-speech</li>
										<li>• ElevenLabs voice synthesis</li>
										<li>• Waits for audio break to interject</li>
										<li>• Speaks corrections with citations</li>
									</ul>
								</div>
							</div>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}
