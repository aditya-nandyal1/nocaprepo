import { Button } from "@/components/ui/button";
import { AlertCircle, Mic, MicOff } from "lucide-react";
import { useState } from "react";

// Static array for audio level bars (never reorders)
const AUDIO_BARS = [
	{ id: "bar-1", threshold: 0, height: 8 },
	{ id: "bar-2", threshold: 0.2, height: 12 },
	{ id: "bar-3", threshold: 0.4, height: 16 },
	{ id: "bar-4", threshold: 0.6, height: 20 },
	{ id: "bar-5", threshold: 0.8, height: 24 },
];

interface VoiceInputButtonProps {
	onStart: () => void;
	onStop: () => void;
	isListening: boolean;
	isProcessing?: boolean;
	audioLevel?: number;
	error?: string | null;
}

/**
 * Simple activation button for voice input
 * Supports both single-user and multi-user modes
 */
export function VoiceInputButton({
	onStart,
	onStop,
	isListening,
	isProcessing = false,
	audioLevel = 0,
	error,
}: VoiceInputButtonProps) {
	const [isHovered, setIsHovered] = useState(false);

	const handleClick = () => {
		if (isListening) {
			onStop();
		} else {
			onStart();
		}
	};

	const hasError = error !== null && error !== undefined;

	return (
		<div className="flex flex-col items-center gap-4">
			<div className="relative">
				{/* Audio level visualization ring */}
				{isListening && !hasError && (
					<div
						className="absolute inset-0 size-32 rounded-full border-4 border-green-500/50 transition-all duration-100"
						style={{
							transform: `scale(${1 + audioLevel * 0.3})`,
							opacity: Math.max(0.3, audioLevel),
						}}
					/>
				)}

				<Button
					size="icon"
					variant={
						hasError ? "outline" : isListening ? "destructive" : "default"
					}
					className="size-32 rounded-full transition-all duration-300 hover:scale-110 relative"
					onClick={handleClick}
					onMouseEnter={() => setIsHovered(true)}
					onMouseLeave={() => setIsHovered(false)}
					disabled={hasError}
				>
					{hasError ? (
						<AlertCircle className="size-16 text-destructive" />
					) : isListening ? (
						<MicOff className="size-16" />
					) : (
						<Mic className="size-16" />
					)}
				</Button>
			</div>

			<div className="text-center">
				<p className="text-lg font-semibold">
					{hasError
						? "Permission Error"
						: isListening
							? "Recording..."
							: "Start Session"}
				</p>
				<p className="text-sm text-muted-foreground">
					{hasError
						? "See instructions below"
						: isListening
							? "Click to stop voice input"
							: "Click to begin monitoring statements"}
				</p>
			</div>

			{isListening && !hasError && (
				<div className="flex items-center gap-4">
					<div className="flex items-center gap-2">
						<div className="size-2 rounded-full bg-red-500 animate-pulse" />
						<span className="text-sm text-muted-foreground">Recording</span>
					</div>

					{/* Audio level indicator */}
					<div className="flex items-center gap-1">
						{AUDIO_BARS.map((bar) => (
							<div
								key={bar.id}
								className={`w-1 rounded-full transition-all duration-100 ${
									audioLevel > bar.threshold ? "bg-green-500" : "bg-gray-300"
								}`}
								style={{
									height: `${bar.height}px`,
								}}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
