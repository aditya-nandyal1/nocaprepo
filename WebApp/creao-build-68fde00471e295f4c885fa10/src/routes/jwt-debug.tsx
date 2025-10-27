import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../hooks/use-auth";
import { type JWTPayload, getUserInfoFromToken } from "../lib/jwt-utils";

interface DecodedJWTInfo {
	userId: string | null;
	email: string | null;
	username: string | null;
	isExpired: boolean | null;
	payload: JWTPayload | null;
}

export const Route = createFileRoute("/jwt-debug")({
	component: JwtDebug,
});

function JwtDebug() {
	const { token: authHookToken } = useAuth();
	// Initialize manualJwtToken with authHookToken if present, otherwise empty string
	const [manualJwtToken, setManualJwtToken] = useState<string>(
		authHookToken || "",
	);
	const [decodedInfo, setDecodedInfo] = useState<DecodedJWTInfo | null>(null);
	const [error, setError] = useState<string | null>(null);

	// If authHookToken changes, update manualJwtToken to reflect it
	useEffect(() => {
		if (authHookToken) {
			setManualJwtToken(authHookToken);
		}
	}, [authHookToken]);

	// Determine the effective JWT token to parse
	const effectiveJwtToken = manualJwtToken;

	useEffect(() => {
		if (effectiveJwtToken) {
			try {
				const info = getUserInfoFromToken(effectiveJwtToken);
				setDecodedInfo(info);
				setError(null);
			} catch (e: unknown) {
				setError(e instanceof Error ? e.message : String(e));
				setDecodedInfo(null);
			}
		} else {
			setDecodedInfo(null);
			setError(null);
		}
	}, [effectiveJwtToken]);

	const renderDecodedInfo = (info: DecodedJWTInfo | null) => {
		if (!info) return null;

		return (
			<div className="space-y-4">
				<Card>
					<CardHeader>
						<CardTitle>Parsed JWT Information</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<Label className="font-semibold">User ID:</Label>
								<p>{info.userId || "N/A"}</p>
							</div>
							<div>
								<Label className="font-semibold">Email:</Label>
								<p>{info.email || "N/A"}</p>
							</div>
							<div>
								<Label className="font-semibold">Username:</Label>
								<p>{info.username || "N/A"}</p>
							</div>
							<div>
								<Label className="font-semibold">Expired:</Label>
								<p>{(info.isExpired ?? "N/A").toString()}</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{info.payload && (
					<Card>
						<CardHeader>
							<CardTitle>Raw Payload</CardTitle>
						</CardHeader>
						<CardContent>
							<pre className="whitespace-pre-wrap break-all text-sm bg-gray-100 p-4 rounded-md overflow-auto">
								{JSON.stringify(info.payload, null, 2)}
							</pre>
						</CardContent>
					</Card>
				)}
			</div>
		);
	};

	return (
		<div className="container mx-auto p-4 max-w-4xl">
			<h1 className="text-3xl font-bold mb-6 text-center">JWT Debugger</h1>
			<div className="grid gap-4">
				<div className="space-y-2 mx-auto max-w-lg">
					<Label htmlFor="jwt-token">JWT Token:</Label>
					<Textarea
						id="jwt-token"
						value={manualJwtToken}
						onChange={(e) => setManualJwtToken(e.target.value)}
						rows={6}
						className="font-mono w-full"
						placeholder="Paste your JWT token here or it will be populated from URL/session..."
					/>
				</div>
				{!effectiveJwtToken && (
					<div className="text-blue-500 font-medium text-center">
						No JWT token found. Please paste a token above, or navigate to this
						page with a token, e.g., `/jwt-debug?auth_token=YOUR_JWT_HERE`.
					</div>
				)}
				{error && (
					<div className="text-red-500 font-medium text-center">
						Error: {error}
					</div>
				)}
				{decodedInfo && renderDecodedInfo(decodedInfo)}
			</div>
		</div>
	);
}
