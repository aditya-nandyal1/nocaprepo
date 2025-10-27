import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { VerificationResult } from "@/services/verification-service";
import type { TranscriptionResult } from "@/services/voice-service";
import {
	AlertCircle,
	CheckCircle2,
	ExternalLink,
	Volume2,
	XCircle,
} from "lucide-react";

interface UnifiedTranscriptionPanelProps {
	transcriptions: TranscriptionResult[];
	verificationResults: VerificationResult[];
	onSpeak?: (text: string) => void;
}

/**
 * Unified panel showing transcriptions with inline verification results
 * Combines the transcription display with validity checking in one view
 */
export function UnifiedTranscriptionPanel({
	transcriptions,
	verificationResults,
	onSpeak,
}: UnifiedTranscriptionPanelProps) {
	const getStatementTypeBadgeVariant = (type: string) => {
		switch (type) {
			case "declarative":
				return "default";
			case "opinion":
				return "secondary";
			case "question":
				return "outline";
			default:
				return "outline";
		}
	};

	const getVerificationForTranscription = (
		index: number,
	): VerificationResult | undefined => {
		// Match verification results by index (verification order matches transcription order for declarative statements)
		// Count how many declarative statements came before this one
		const declarativeCount = transcriptions
			.slice(0, index + 1)
			.filter((t) => t.statementType === "declarative").length;
		return verificationResults[declarativeCount - 1];
	};

	const getConsensusIcon = (consensus: string) => {
		switch (consensus) {
			case "verified_true":
				return <CheckCircle2 className="size-4 text-green-500" />;
			case "verified_false":
				return <XCircle className="size-4 text-red-500" />;
			case "inconclusive":
				return <AlertCircle className="size-4 text-yellow-500" />;
			default:
				return <AlertCircle className="size-4 text-gray-500" />;
		}
	};

	const getConsensusBadge = (consensus: string) => {
		switch (consensus) {
			case "verified_true":
				return <Badge className="bg-green-500 text-xs">Verified True</Badge>;
			case "verified_false":
				return (
					<Badge variant="destructive" className="text-xs">
						Verified False
					</Badge>
				);
			case "inconclusive":
				return (
					<Badge variant="secondary" className="text-xs">
						Inconclusive
					</Badge>
				);
			default:
				return (
					<Badge variant="outline" className="text-xs">
						Unknown
					</Badge>
				);
		}
	};

	return (
		<Card className="w-full">
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>Live Transcription & Verification</CardTitle>
						<CardDescription>
							Real-time transcription with multi-agent fact-checking
						</CardDescription>
					</div>
					{transcriptions.length > 0 && (
						<Badge variant="outline" className="text-xs">
							{transcriptions.length} statement
							{transcriptions.length !== 1 ? "s" : ""}
						</Badge>
					)}
				</div>
			</CardHeader>
			<CardContent>
				<ScrollArea className="h-[600px] w-full rounded-md border p-4">
					{transcriptions.length === 0 ? (
						<div className="flex h-full items-center justify-center text-muted-foreground">
							<p>
								No transcriptions yet. Start speaking to see text appear here.
							</p>
						</div>
					) : (
						<div className="space-y-4">
							{transcriptions.map((transcription, index) => {
								const verification = getVerificationForTranscription(index);

								return (
									<div
										key={`${transcription.speaker_id}-${transcription.timestamp}-${index}`}
										className="rounded-lg border bg-card shadow-sm transition-all hover:shadow-md"
									>
										{/* Transcription Header */}
										<div className="p-3 pb-2">
											<div className="mb-2 flex items-center justify-between">
												<div className="flex items-center gap-2">
													<span className="text-sm font-medium">
														Speaker {transcription.speaker_id}
													</span>
													<Badge
														variant={getStatementTypeBadgeVariant(
															transcription.statementType,
														)}
													>
														{transcription.statementType}
													</Badge>
													{verification && (
														<div className="flex items-center gap-1">
															{getConsensusIcon(verification.consensus)}
															{getConsensusBadge(verification.consensus)}
														</div>
													)}
												</div>
												<span className="text-xs text-muted-foreground">
													{new Date(
														transcription.timestamp,
													).toLocaleTimeString()}
												</span>
											</div>

											{/* Transcription Text */}
											<p className="text-sm mb-2">{transcription.text}</p>
										</div>

										{/* Verification Status Identifier (for declarative statements) */}
										{transcription.statementType === "declarative" &&
											verification && (
												<div className="border-t border-b px-3 py-3 bg-muted/30">
													<div className="flex items-center justify-between">
														<div className="flex items-center gap-2">
															<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
																Fact-Check:
															</span>
															{verification.consensus === "verified_true" ? (
																<Badge className="bg-green-600 hover:bg-green-700 flex items-center gap-1.5 text-sm font-bold px-3 py-1">
																	<CheckCircle2 className="size-4" />
																	TRUE
																</Badge>
															) : verification.consensus ===
																"verified_false" ? (
																<Badge
																	variant="destructive"
																	className="bg-red-600 hover:bg-red-700 flex items-center gap-1.5 text-sm font-bold px-3 py-1"
																>
																	<XCircle className="size-4" />
																	FALSE
																</Badge>
															) : (
																<Badge
																	variant="secondary"
																	className="flex items-center gap-1.5 text-sm font-bold px-3 py-1"
																>
																	<AlertCircle className="size-4" />
																	INCONCLUSIVE
																</Badge>
															)}
														</div>
													</div>
												</div>
											)}

										{/* Verification Results (if declarative and verified) */}
										{verification &&
											transcription.statementType === "declarative" && (
												<div className="border-t">
													{/* Corrective Information - Enhanced Display */}
													{verification.consensus === "verified_false" &&
														verification.correctInformation && (
															<div className="p-4 bg-red-50 dark:bg-red-950/20">
																<div className="mb-3 flex items-center justify-between">
																	<span className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
																		<XCircle className="size-4" />
																		Corrective Information
																	</span>
																	{onSpeak && (
																		<Button
																			size="sm"
																			variant="ghost"
																			onClick={() =>
																				onSpeak(
																					verification.correctInformation || "",
																				)
																			}
																		>
																			<Volume2 className="size-4" />
																		</Button>
																	)}
																</div>
																<p className="text-sm text-red-900 dark:text-red-200 mb-3 leading-relaxed">
																	{verification.correctInformation}
																</p>

																{/* Citations - Enhanced Display */}
																{verification.citations &&
																	verification.citations.length > 0 && (
																		<div className="pt-3 border-t border-red-200 dark:border-red-800">
																			<span className="text-xs font-semibold text-red-700 dark:text-red-400 mb-2 block uppercase tracking-wide">
																				Sources & Citations:
																			</span>
																			<ul className="space-y-2">
																				{verification.citations.map(
																					(citation) => (
																						<li
																							key={citation}
																							className="flex items-start gap-2 text-xs text-red-800 dark:text-red-300 p-2 rounded bg-red-100 dark:bg-red-900/30"
																						>
																							<ExternalLink className="size-3 mt-0.5 flex-shrink-0" />
																							<a
																								href={citation}
																								target="_blank"
																								rel="noopener noreferrer"
																								className="break-all hover:underline"
																							>
																								{citation}
																							</a>
																						</li>
																					),
																				)}
																			</ul>
																		</div>
																	)}
															</div>
														)}

													{/* Agent Verdicts - Compact View */}
													<div className="p-3 bg-muted/30">
														<span className="text-xs font-medium mb-2 block">
															Agent Verdicts:
														</span>
														<div className="grid grid-cols-3 gap-1.5">
															{verification.agents.map((agent) => (
																<div
																	key={agent.name}
																	className="rounded-md border bg-background p-1.5 text-center"
																>
																	<div className="text-xs font-medium truncate">
																		{agent.name}
																	</div>
																	<Badge
																		variant={
																			agent.verdict === "true"
																				? "outline"
																				: agent.verdict === "false"
																					? "destructive"
																					: "secondary"
																		}
																		className="text-xs mt-1"
																	>
																		{agent.verdict}
																	</Badge>
																</div>
															))}
														</div>
													</div>
												</div>
											)}
									</div>
								);
							})}
						</div>
					)}
				</ScrollArea>
			</CardContent>
		</Card>
	);
}
