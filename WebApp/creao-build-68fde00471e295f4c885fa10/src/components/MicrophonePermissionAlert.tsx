import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import VoiceService, { type PermissionStatus } from "@/services/voice-service";
import { AlertCircle, CheckCircle, Mic, MicOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface MicrophonePermissionAlertProps {
	onPermissionChange?: (status: PermissionStatus) => void;
}

export function MicrophonePermissionAlert({
	onPermissionChange,
}: MicrophonePermissionAlertProps) {
	const [permissionStatus, setPermissionStatus] =
		useState<PermissionStatus>("unknown");
	const [isChecking, setIsChecking] = useState(false);

	const checkPermission = useCallback(async () => {
		const status = await VoiceService.checkMicrophonePermission();
		setPermissionStatus(status);
		onPermissionChange?.(status);
	}, [onPermissionChange]);

	const requestPermission = async () => {
		setIsChecking(true);
		const granted = await VoiceService.requestMicrophonePermission();
		setIsChecking(false);

		if (granted) {
			setPermissionStatus("granted");
			onPermissionChange?.("granted");
		} else {
			await checkPermission();
		}
	};

	useEffect(() => {
		checkPermission();

		// Listen for permission changes if supported
		if (navigator.permissions) {
			navigator.permissions
				.query({ name: "microphone" as PermissionName })
				.then((result) => {
					result.addEventListener("change", checkPermission);
					return () => result.removeEventListener("change", checkPermission);
				})
				.catch((error) => {
					console.warn("Could not listen to permission changes:", error);
				});
		}
	}, [checkPermission]);

	if (permissionStatus === "granted") {
		return (
			<Alert className="border-green-500 bg-green-50 dark:bg-green-950">
				<CheckCircle className="h-4 w-4 text-green-600" />
				<AlertTitle>Microphone Access Granted</AlertTitle>
				<AlertDescription>
					You can now use voice input for the NoCap application.
				</AlertDescription>
			</Alert>
		);
	}

	if (permissionStatus === "denied") {
		return (
			<Alert variant="destructive">
				<MicOff className="h-4 w-4" />
				<AlertTitle>Microphone Access Denied</AlertTitle>
				<AlertDescription className="space-y-3">
					<p>
						You previously denied microphone access. To use voice input, you
						need to allow microphone access in your browser settings.
					</p>

					<div className="space-y-2 text-sm">
						<p className="font-semibold">How to fix this:</p>
						<ol className="list-decimal pl-5 space-y-1">
							<li>
								Click the lock icon or info icon (
								<Mic className="inline h-3 w-3" />) in your browser's address
								bar
							</li>
							<li>
								Find "Microphone" in the permissions list and change it to
								"Allow"
							</li>
							<li>Refresh this page</li>
						</ol>
					</div>

					<div className="flex gap-2">
						<Button onClick={checkPermission} variant="outline" size="sm">
							Check Again
						</Button>
						<Button
							onClick={() => window.location.reload()}
							variant="outline"
							size="sm"
						>
							Refresh Page
						</Button>
					</div>
				</AlertDescription>
			</Alert>
		);
	}

	if (permissionStatus === "prompt") {
		return (
			<Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
				<AlertCircle className="h-4 w-4 text-blue-600" />
				<AlertTitle>Microphone Permission Needed</AlertTitle>
				<AlertDescription className="space-y-3">
					<p>
						NoCap needs access to your microphone to capture and transcribe
						speech.
					</p>
					<Button
						onClick={requestPermission}
						disabled={isChecking}
						size="sm"
						className="bg-blue-600 hover:bg-blue-700"
					>
						<Mic className="mr-2 h-4 w-4" />
						{isChecking ? "Requesting..." : "Allow Microphone Access"}
					</Button>
				</AlertDescription>
			</Alert>
		);
	}

	return null;
}
