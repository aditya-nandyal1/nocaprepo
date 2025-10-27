import {
	type SpeakerQueueModel,
	SpeakerQueueProcessingStatus,
} from "@/components/data/orm/orm_speaker_queue";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Clock, Users } from "lucide-react";

interface SpeakerQueuePanelProps {
	queue: SpeakerQueueModel[];
	currentlyProcessing?: SpeakerQueueModel;
}

/**
 * Speaker queue visualization component
 * Shows time-ordered queue with processing status
 * Groups users who stated identical misinformation
 */
export function SpeakerQueuePanel({
	queue,
	currentlyProcessing,
}: SpeakerQueuePanelProps) {
	const getStatusBadge = (status: SpeakerQueueProcessingStatus) => {
		switch (status) {
			case SpeakerQueueProcessingStatus.Pending:
				return <Badge variant="outline">Pending</Badge>;
			case SpeakerQueueProcessingStatus.Processing:
				return <Badge variant="default">Processing</Badge>;
			case SpeakerQueueProcessingStatus.Processed:
				return <Badge variant="secondary">Processed</Badge>;
			case SpeakerQueueProcessingStatus.Failed:
				return <Badge variant="destructive">Failed</Badge>;
			default:
				return <Badge variant="outline">Unknown</Badge>;
		}
	};

	const pendingCount = queue.filter(
		(item) => item.processing_status === SpeakerQueueProcessingStatus.Pending,
	).length;

	const processingCount = queue.filter(
		(item) =>
			item.processing_status === SpeakerQueueProcessingStatus.Processing,
	).length;

	return (
		<Card className="w-full">
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<Users className="size-5" />
							Speaker Queue
						</CardTitle>
						<CardDescription>
							Time-ordered processing queue for statements
						</CardDescription>
					</div>
					<div className="flex gap-2">
						<Badge variant="outline">{pendingCount} Pending</Badge>
						<Badge variant="default">{processingCount} Processing</Badge>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{currentlyProcessing && (
					<div className="mb-4 rounded-lg border-2 border-primary bg-primary/10 p-4">
						<div className="mb-2 flex items-center gap-2">
							<AlertTriangle className="size-5 text-primary" />
							<span className="font-semibold">Currently Verifying</span>
						</div>
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium">
									Speaker {currentlyProcessing.speaker_id}
								</span>
								{getStatusBadge(currentlyProcessing.processing_status)}
							</div>
							<p className="text-sm text-muted-foreground">
								{currentlyProcessing.statement_text}
							</p>
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<Clock className="size-3" />
								{new Date(
									currentlyProcessing.statement_timestamp,
								).toLocaleTimeString()}
							</div>
						</div>
					</div>
				)}

				<ScrollArea className="h-[300px] w-full rounded-md border p-4">
					{queue.length === 0 ? (
						<div className="flex h-full items-center justify-center text-muted-foreground">
							<p>No statements in queue</p>
						</div>
					) : (
						<div className="space-y-3">
							{queue.map((item) => (
								<div
									key={item.id}
									className="rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md"
								>
									<div className="mb-2 flex items-center justify-between">
										<span className="text-sm font-medium">
											Speaker {item.speaker_id}
										</span>
										{getStatusBadge(item.processing_status)}
									</div>
									<p className="text-sm text-muted-foreground line-clamp-2">
										{item.statement_text}
									</p>
									<div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
										<Clock className="size-3" />
										{new Date(item.statement_timestamp).toLocaleTimeString()}
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
