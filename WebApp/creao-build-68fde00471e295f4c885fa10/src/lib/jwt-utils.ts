export interface JWTPayload {
	sub?: string; // Subject (user ID)
	user_id?: string; // Alternative user ID field
	userId?: string; // Another alternative user ID field
	id?: string; // Direct ID field
	email?: string; // User email
	username?: string; // Username
	exp?: number; // Expiration time
	iat?: number; // Issued at time
	[key: string]: unknown; // Allow other fields with unknown type for safety
}

/**
 * Decode a JWT token and extract the payload
 * @param token - The JWT token to decode
 * @returns The decoded payload or null if invalid
 */
export function decodeJWT(token: string): JWTPayload | null {
	try {
		// JWT structure: header.payload.signature
		const parts = token.split(".");
		if (parts.length !== 3) {
			return null;
		}

		// Decode the payload (second part)
		const payload = parts[1];

		// Add padding if needed for proper base64 decoding
		const paddedPayload = payload + "=".repeat((4 - (payload.length % 4)) % 4);

		// Decode from base64
		const decodedPayload = atob(
			paddedPayload.replace(/-/g, "+").replace(/_/g, "/"),
		);

		// Parse JSON
		return JSON.parse(decodedPayload);
	} catch (error) {
		console.error("Error decoding JWT:", error);
		return null;
	}
}

/**
 * Extract user ID from JWT token
 * Tries multiple common fields where user ID might be stored
 * @param token - The JWT token
 * @returns The user ID or null if not found
 */
export function getUserIdFromToken(token: string): string {
	const payload = decodeJWT(token);
	if (!payload) {
		return "";
	}

	// Try common fields for user ID
	const userId = payload.sub || payload.user_id || payload.userId || payload.id;
	return typeof userId === "string" ? userId : "";
}

/**
 * Extract user email from JWT token
 * @param token - The JWT token
 * @returns The user email or null if not found
 */
export function getUserEmailFromToken(token: string): string | null {
	const payload = decodeJWT(token);
	if (!payload) {
		return null;
	}

	const email = payload.email;
	return typeof email === "string" ? email : null;
}

/**
 * Extract username from JWT token
 * @param token - The JWT token
 * @returns The username or null if not found
 */
export function getUsernameFromToken(token: string): string | null {
	const payload = decodeJWT(token);
	if (!payload) {
		return null;
	}

	const username = payload.username || payload.name;
	return typeof username === "string" ? username : null;
}

/**
 * Check if JWT token is expired
 * @param token - The JWT token
 * @returns True if expired, false if valid, null if cannot determine
 */
export function isTokenExpired(token: string): boolean | null {
	const payload = decodeJWT(token);
	if (!payload || !payload.exp) {
		return null;
	}

	const currentTime = Math.floor(Date.now() / 1000);
	return payload.exp < currentTime;
}

/**
 * Get all user information from JWT token
 * @param token - The JWT token
 * @returns Object with user information or null if invalid
 */
export function getUserInfoFromToken(token: string): {
	userId: string | null;
	email: string | null;
	username: string | null;
	isExpired: boolean | null;
	payload: JWTPayload | null;
} | null {
	const payload = decodeJWT(token);
	if (!payload) {
		return null;
	}

	return {
		userId: getUserIdFromToken(token),
		email: getUserEmailFromToken(token),
		username: getUsernameFromToken(token),
		isExpired: isTokenExpired(token),
		payload,
	};
}
