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
import {
	AlertCircle,
	CheckCircle2,
	ExternalLink,
	Volume2,
	XCircle,
} from "lucide-react";

interface VerificationResultsPanelProps {
	results: VerificationResult[];
	onSpeak?: (text: string) => void;
}

/**
 * Verification results display panel
 * Shows multi-agent consensus and corrective information
 */
export function VerificationResultsPanel({
	results,
	onSpeak,
}: VerificationResultsPanelProps) {
	const getConsensusIcon = (consensus: string) => {
		switch (consensus) {
			case "verified_true":
				return <CheckCircle2 className="size-5 text-green-500" />;
			case "verified_false":
				return <XCircle className="size-5 text-red-500" />;
			case "inconclusive":
				return <AlertCircle className="size-5 text-yellow-500" />;
			default:
				return <AlertCircle className="size-5 text-gray-500" />;
		}
	};

	const getConsensusBadge = (consensus: string) => {
		switch (consensus) {
			case "verified_true":
				return <Badge className="bg-green-500">Verified True</Badge>;
			case "verified_false":
				return <Badge variant="destructive">Verified False</Badge>;
			case "inconclusive":
				return <Badge variant="secondary">Inconclusive</Badge>;
			default:
				return <Badge variant="outline">Unknown</Badge>;
		}
	};

	return (
		<Card className="w-full">
			<CardHeader>
				<CardTitle>Verification Results</CardTitle>
				<CardDescription>
					Multi-agent consensus via Lava Gateway
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ScrollArea className="h-[500px] w-full rounded-md border p-4">
					{results.length === 0 ? (
						<div className="flex h-full items-center justify-center text-muted-foreground">
							<p>No verification results yet</p>
						</div>
					) : (
						<div className="space-y-4">
							{results.map((result) => (
								<div
									key={result.statementId}
									className="rounded-lg border bg-card p-4 shadow-sm"
								>
									<div className="mb-3 flex items-center justify-between">
										<div className="flex items-center gap-2">
											{getConsensusIcon(result.consensus)}
											{getConsensusBadge(result.consensus)}
										</div>
										<span className="text-xs text-muted-foreground">
											Consensus:{" "}
											{(
												result.lavaGatewayConsensus.consensusScore * 100
											).toFixed(0)}
											%
										</span>
									</div>

									{result.isFalse && result.correctInformation && (
										<div className="mb-3 rounded-md bg-red-50 dark:bg-red-950/20 p-3 border border-red-200 dark:border-red-800">
											<div className="mb-2 flex items-center justify-between">
												<span className="text-sm font-semibold text-red-700 dark:text-red-400">
													Corrective Information
												</span>
												{onSpeak && (
													<Button
														size="sm"
														variant="ghost"
														onClick={() =>
															onSpeak(result.correctInformation || "")
														}
													>
														<Volume2 className="size-4" />
													</Button>
												)}
											</div>
											<p className="text-sm text-red-900 dark:text-red-200">
												{result.correctInformation}
											</p>
											{result.citations && result.citations.length > 0 && (
												<div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
													<span className="text-xs font-semibold text-red-700 dark:text-red-400 mb-2 block">
														Citations:
													</span>
													<ul className="space-y-1">
														{result.citations.map((citation) => (
															<li
																key={citation}
																className="flex items-start gap-2 text-xs text-red-800 dark:text-red-300"
															>
																<ExternalLink className="size-3 mt-0.5 flex-shrink-0" />
																<span className="break-all">{citation}</span>
															</li>
														))}
													</ul>
												</div>
											)}
										</div>
									)}

									<div className="space-y-2">
										<span className="text-sm font-medium">Agent Verdicts:</span>
										<div className="grid grid-cols-2 gap-2">
											{result.agents.map((agent) => (
												<div
													key={agent.name}
													className="rounded-md border bg-background p-2"
												>
													<div className="mb-1 flex items-center justify-between">
														<span className="text-xs font-medium">
															{agent.name}
														</span>
														<Badge
															variant={
																agent.verdict === "true"
																	? "outline"
																	: agent.verdict === "false"
																		? "destructive"
																		: "secondary"
															}
															className="text-xs"
														>
															{agent.verdict}
														</Badge>
													</div>
													<div className="text-xs text-muted-foreground">
														Confidence: {(agent.confidence * 100).toFixed(0)}%
													</div>
												</div>
											))}
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</ScrollArea>
			</CardContent>
		</Card>
	);
}
