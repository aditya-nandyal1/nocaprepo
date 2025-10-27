/**
 * Authentication Integration Utilities
 *
 * This file provides utilities for built pages to receive and handle
 * authentication tokens from the parent Build Studio application.
 *
 * Usage in built pages:
 * 1. Include this file in your built application
 * 2. Call initializeAuthIntegration() when your app starts
 * 3. Use getAuthToken() to get the current token for API calls
 */

interface AuthMessage {
	type: "CREAO_AUTH_TOKEN";
	token: string;
	origin: string;
}

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

// Configuration for token validation
const API_BASE_URL = import.meta.env.VITE_API_BASE_PATH;

class AuthIntegration {
	private state: AuthState = {
		token: null,
		status: "loading",
		parentOrigin: null,
	};

	private listeners: Set<(state: AuthState) => void> = new Set();
	private validationPromise: Promise<boolean> | null = null;
	private initializationPromise: Promise<void> | null = null;

	constructor() {
		this.initializationPromise = this.initialize();
	}

	/**
	 * Initialize the authentication system
	 */
	private async initialize(): Promise<void> {
		console.log("Auth initialization started");
		try {
			await this.initializeFromStorage();
			await this.initializeFromUrl();
			this.setupMessageListener();

			// If still loading after initialization, set to unauthenticated
			if (this.state.status === "loading") {
				console.log(
					"Auth initialization complete - setting to unauthenticated",
				);
				this.state.status = "unauthenticated";
				this.notifyListeners();
			} else {
				console.log(
					"Auth initialization complete - status:",
					this.state.status,
				);
			}
		} catch (error) {
			console.error("Auth initialization failed:", error);
			this.state.status = "unauthenticated";
			this.notifyListeners();
		}
	}

	/**
	 * Ensure initialization is complete before proceeding
	 */
	private async ensureInitialized(): Promise<void> {
		if (this.initializationPromise) {
			await this.initializationPromise;
		}
	}

	/**
	 * Initialize authentication from localStorage
	 */
	private async initializeFromStorage(): Promise<void> {
		console.log("Initializing auth from storage...");
		const storedToken = localStorage.getItem("creao_auth_token");
		if (storedToken) {
			console.log("Found stored token, validating...");
			// Validate the stored token
			const isValid = await this.validateToken(storedToken);
			if (isValid) {
				console.log("Stored token is valid");
				this.state.token = storedToken;
				this.state.status = "authenticated";
				this.notifyListeners();
			} else {
				console.log("Stored token is invalid, clearing...");
				// Clear invalid token
				localStorage.removeItem("creao_auth_token");
				this.state.status = "invalid_token";
				this.notifyListeners();
			}
		} else {
			console.log("No stored token found");
			this.state.status = "unauthenticated";
			this.notifyListeners();
		}
	}

	/**
	 * Initialize authentication from URL parameters
	 */
	private async initializeFromUrl(): Promise<void> {
		const urlParams = new URLSearchParams(window.location.search);
		const authToken = urlParams.get("auth_token");

		if (authToken) {
			await this.setToken(authToken);
			// Clean up URL to remove token
			this.cleanupUrl();
		}
	}

	/**
	 * Setup listener for postMessage from parent window
	 */
	private setupMessageListener(): void {
		window.addEventListener("message", async (event: MessageEvent) => {
			try {
				const data = event.data as AuthMessage;

				if (data.type === "CREAO_AUTH_TOKEN" && data.token) {
					await this.setToken(data.token, event.origin);
				}
			} catch (error) {
				console.warn("Error processing auth message:", error);
			}
		});
	}

	/**
	 * Validate token by making a request to the /me endpoint
	 */
	private async validateToken(token: string): Promise<boolean> {
		console.log("Validating token...", { API_BASE_URL });

		if (!API_BASE_URL) {
			console.error("API_BASE_URL is not set");
			return false;
		}

		try {
			const response = await fetch(`${API_BASE_URL}/me`, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			});

			console.log("Token validation response:", response.status, response.ok);
			return response.ok;
		} catch (error) {
			console.warn("Token validation failed:", error);
			return false;
		}
	}

	/**
	 * Set the authentication token (async now to validate)
	 */
	private async setToken(token: string, origin?: string): Promise<void> {
		// Validate the token first
		const isValid = await this.validateToken(token);

		if (isValid) {
			this.state = {
				token,
				status: "authenticated",
				parentOrigin: origin || this.state.parentOrigin,
			};

			// Store in localStorage for persistence
			localStorage.setItem("creao_auth_token", token);
		} else {
			// Token is invalid, clear it
			this.state = {
				token: null,
				status: "invalid_token",
				parentOrigin: origin || this.state.parentOrigin,
			};
			localStorage.removeItem("creao_auth_token");
		}

		// Notify listeners
		this.notifyListeners();
	}

	/**
	 * Clean up URL parameters
	 */
	private cleanupUrl(): void {
		const url = new URL(window.location.href);
		url.searchParams.delete("auth_token");
		window.history.replaceState({}, document.title, url.toString());
	}

	/**
	 * Notify all listeners of state changes
	 */
	private notifyListeners(): void {
		for (const listener of this.listeners) {
			try {
				listener({ ...this.state });
			} catch (error) {
				console.error("Error in auth state listener:", error);
			}
		}
	}

	/**
	 * Get the current authentication token
	 */
	public async getAuthToken(): Promise<string | null> {
		await this.ensureInitialized();
		return this.state.token;
	}

	/**
	 * Get the current authentication token (sync version)
	 */
	public getAuthTokenSync(): string | null {
		return this.state.token;
	}

	/**
	 * Check if user is authenticated (async to validate token if needed)
	 */
	public async isAuthenticated(): Promise<boolean> {
		await this.ensureInitialized();

		// If we already know we're not authenticated, return false
		if (!this.state.token) {
			return false;
		}

		// If we think we're authenticated, double-check by validating the token
		if (this.state.status === "authenticated") {
			return true;
		}

		// If we have a token but haven't validated it, validate now
		if (this.state.token && !this.validationPromise) {
			this.validationPromise = this.validateToken(this.state.token);
			const isValid = await this.validationPromise;
			this.validationPromise = null;

			if (isValid) {
				this.state.status = "authenticated";
				this.notifyListeners();
				return true;
			}
			// Clear invalid token
			await this.clearAuth();
			return false;
		}

		// Default case - if we get here, return false
		return false;
	}

	/**
	 * Synchronous version of isAuthenticated (returns current state without validation)
	 */
	public isAuthenticatedSync(): boolean {
		return this.state.status === "authenticated" && !!this.state.token;
	}

	/**
	 * Get the current auth status
	 */
	public async getAuthStatus(): Promise<AuthStatus> {
		await this.ensureInitialized();
		return this.state.status;
	}

	/**
	 * Get the current auth status (sync version)
	 */
	public getAuthStatusSync(): AuthStatus {
		return this.state.status;
	}

	/**
	 * Check if token is invalid
	 */
	public async hasInvalidToken(): Promise<boolean> {
		await this.ensureInitialized();
		return this.state.status === "invalid_token";
	}

	/**
	 * Check if token is invalid (sync version)
	 */
	public hasInvalidTokenSync(): boolean {
		return this.state.status === "invalid_token";
	}

	/**
	 * Check if no token is provided
	 */
	public async hasNoToken(): Promise<boolean> {
		await this.ensureInitialized();
		return this.state.status === "unauthenticated";
	}

	/**
	 * Check if no token is provided (sync version)
	 */
	public hasNoTokenSync(): boolean {
		return this.state.status === "unauthenticated";
	}

	/**
	 * Check if auth is still loading
	 */
	public isLoading(): boolean {
		return this.state.status === "loading";
	}

	/**
	 * Get the current auth state
	 */
	public getAuthState(): AuthState {
		return { ...this.state };
	}

	/**
	 * Add a listener for auth state changes
	 */
	public addAuthStateListener(
		listener: (state: AuthState) => void,
	): () => void {
		this.listeners.add(listener);

		// Immediately notify with current state
		listener({ ...this.state });

		// Return cleanup function
		return () => this.listeners.delete(listener);
	}

	/**
	 * Create authenticated fetch function
	 */
	public createAuthenticatedFetch() {
		return async (
			url: string,
			options: RequestInit = {},
		): Promise<Response> => {
			const token = this.getAuthToken();

			const headers = new Headers(options.headers);
			if (token) {
				headers.set("Authorization", `Bearer ${token}`);
			}

			return fetch(url, {
				...options,
				headers,
			});
		};
	}

	/**
	 * Clear authentication
	 */
	public async clearAuth(): Promise<void> {
		this.state = {
			token: null,
			status: "unauthenticated",
			parentOrigin: null,
		};
		localStorage.removeItem("creao_auth_token");
		this.notifyListeners();
	}

	/**
	 * Refresh authentication state by re-validating the current token
	 */
	public async refreshAuth(): Promise<boolean> {
		if (!this.state.token) {
			return false;
		}

		const isValid = await this.validateToken(this.state.token);
		if (!isValid) {
			this.state.status = "invalid_token";
			localStorage.removeItem("creao_auth_token");
			this.notifyListeners();
			return false;
		}

		this.state.status = "authenticated";
		this.notifyListeners();
		return true;
	}
}

// Create singleton instance
const authIntegration = new AuthIntegration();

/**
 * Initialize authentication integration for built pages
 * Call this when your built application starts
 */
export async function initializeAuthIntegration(): Promise<void> {
	// Integration is automatically initialized via constructor
	console.log("Auth integration initialized");
}

/**
 * Get the current authentication token
 */
export function getAuthToken(): string | null {
	return authIntegration.getAuthTokenSync();
}

/**
 * Get the current authentication token (async - ensures initialization)
 */
export async function getAuthTokenAsync(): Promise<string | null> {
	return authIntegration.getAuthToken();
}

/**
 * Check if user is authenticated (async - validates token)
 */
export async function isAuthenticated(): Promise<boolean> {
	return authIntegration.isAuthenticated();
}

/**
 * Check if user is authenticated (sync - returns current state without validation)
 */
export function isAuthenticatedSync(): boolean {
	return authIntegration.isAuthenticatedSync();
}

/**
 * Get the current auth status
 */
export function getAuthStatus(): AuthStatus {
	return authIntegration.getAuthStatusSync();
}

/**
 * Get the current auth status (async - ensures initialization)
 */
export async function getAuthStatusAsync(): Promise<AuthStatus> {
	return authIntegration.getAuthStatus();
}

/**
 * Check if token is invalid
 */
export function hasInvalidToken(): boolean {
	return authIntegration.hasInvalidTokenSync();
}

/**
 * Check if token is invalid (async - ensures initialization)
 */
export async function hasInvalidTokenAsync(): Promise<boolean> {
	return authIntegration.hasInvalidToken();
}

/**
 * Check if no token is provided
 */
export function hasNoToken(): boolean {
	return authIntegration.hasNoTokenSync();
}

/**
 * Check if no token is provided (async - ensures initialization)
 */
export async function hasNoTokenAsync(): Promise<boolean> {
	return authIntegration.hasNoToken();
}

/**
 * Check if auth is still loading
 */
export function isLoading(): boolean {
	return authIntegration.isLoading();
}

/**
 * Get the current auth state
 */
export function getAuthState(): AuthState {
	return authIntegration.getAuthState();
}

/**
 * Add a listener for auth state changes
 */
export function addAuthStateListener(
	listener: (state: AuthState) => void,
): () => void {
	return authIntegration.addAuthStateListener(listener);
}

/**
 * Create an authenticated fetch function that automatically includes auth headers
 */
export function createAuthenticatedFetch(): (
	url: string,
	options?: RequestInit,
) => Promise<Response> {
	return authIntegration.createAuthenticatedFetch();
}

/**
 * Direct authenticated fetch function - simpler to use than createAuthenticatedFetch
 */
export async function authenticatedFetch(
	url: string,
	options: RequestInit = {},
): Promise<Response> {
	const token = getAuthToken();

	const headers = new Headers(options.headers);
	if (token) {
		headers.set("Authorization", `Bearer ${token}`);
	}
	if (!headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}

	return fetch(url, {
		...options,
		headers,
	});
}

/**
 * Clear authentication
 */
export async function clearAuth(): Promise<void> {
	return authIntegration.clearAuth();
}

/**
 * Refresh authentication state by re-validating the current token
 */
export async function refreshAuth(): Promise<boolean> {
	return authIntegration.refreshAuth();
}

/**
 * For non-React environments, export a simple API client
 */
export const authApi = {
	get: async (url: string, options?: RequestInit) => {
		return authenticatedFetch(url, { ...options, method: "GET" });
	},

	post: async (url: string, data?: unknown, options?: RequestInit) => {
		return authenticatedFetch(url, {
			...options,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...options?.headers,
			},
			body: data ? JSON.stringify(data) : undefined,
		});
	},

	put: async (url: string, data?: unknown, options?: RequestInit) => {
		return authenticatedFetch(url, {
			...options,
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				...options?.headers,
			},
			body: data ? JSON.stringify(data) : undefined,
		});
	},

	delete: async (url: string, options?: RequestInit) => {
		return authenticatedFetch(url, { ...options, method: "DELETE" });
	},
};

export default authIntegration;
