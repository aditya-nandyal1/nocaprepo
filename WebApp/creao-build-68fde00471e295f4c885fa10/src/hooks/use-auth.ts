import {
	addAuthStateListener,
	clearAuth,
	createAuthenticatedFetch,
	getAuthState,
	getAuthStatus,
	getAuthToken,
	hasInvalidToken,
	hasNoToken,
	isAuthenticatedSync,
	isLoading,
} from "@/lib/auth-integration";
import { useEffect, useState } from "react";

// Define AuthState type to match the one in auth-integration
type AuthStatus =
	| "authenticated"
	| "unauthenticated"
	| "invalid_token"
	| "loading";

interface AuthState {
	token: string | null;
	status: AuthStatus;
	parentOrigin: string | null;
}

/**
 * React hook for auth state integration
 *
 * Automatically subscribes to auth state changes and provides auth utilities.
 * This hook will keep your component's auth state synchronized with the global
 * auth state, including changes from localStorage, URL parameters, or postMessage.
 *
 * @returns {Object} Auth state and utilities
 * @returns {string|null} token - Current authentication token
 * @returns {AuthStatus} status - Current authentication status: "authenticated" | "unauthenticated" | "invalid_token" | "loading"
 * @returns {boolean} isAuthenticated - Whether user is currently authenticated
 * @returns {boolean} hasInvalidToken - Whether token exists but is invalid
 * @returns {boolean} hasNoToken - Whether no token is provided
 * @returns {boolean} isLoading - Whether auth is still initializing
 * @returns {string|null} parentOrigin - Origin of parent window (if embedded)
 * @returns {Function} getAuthToken - Function to get current auth token
 * @returns {Function} createAuthenticatedFetch - Function to create authenticated fetch
 * @returns {Function} clearAuth - Function to clear authentication
 * @returns {AuthState} authState - Complete auth state object
 *
 */
export function useAuth() {
	// Initialize with current auth state to prevent race conditions
	const [authState, setAuthState] = useState<AuthState>(() => getAuthState());

	useEffect(() => {
		// Subscribe to auth state changes
		const cleanup = addAuthStateListener(setAuthState);
		return cleanup;
	}, []);

	return {
		// State
		token: authState.token,
		status: authState.status,
		isAuthenticated: isAuthenticatedSync(),
		hasInvalidToken: hasInvalidToken(),
		hasNoToken: hasNoToken(),
		isLoading: isLoading(),
		parentOrigin: authState.parentOrigin,

		// Utilities
		getAuthToken,
		getAuthStatus,
		isAuthenticatedSync,
		createAuthenticatedFetch,
		clearAuth,

		// For convenience
		authState,
	};
}
