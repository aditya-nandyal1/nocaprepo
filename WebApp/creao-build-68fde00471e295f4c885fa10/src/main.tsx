import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

import reportWebVitals from "./reportWebVitals.ts";
import "./styles.css";

// Import and initialize auth integration
import { initializeAuthIntegration } from "@/lib/auth-integration";

// Global URL parsing and variable setup
interface GlobalAppConfig {
	userId: string | null;
	projectId: string | null;
	taskId: string | null;
	workspaceId: string | null; // Combined projectId-taskId
	uploadFolder: string | null; // Upload folder path
	baseUrl: string | null;
	isValidBuildUrl: boolean;
}

function parseCurrentUrl(): GlobalAppConfig {
	const currentUrl = window.location.href;

	// Pattern: {base_url}/builds/{userId}/{projectId}/{taskId}/dist
	const buildUrlRegex =
		/^(https?:\/\/[^\/]+)\/builds\/([^\/]+)\/([^\/]+)\/([^\/]+)\/dist/;
	const match = currentUrl.match(buildUrlRegex);

	if (match) {
		const [, baseUrl, userId, projectId, taskId] = match;
		const workspaceId = `${projectId}-${taskId}`;
		return {
			userId,
			projectId,
			taskId,
			workspaceId,
			uploadFolder: "resources",
			baseUrl,
			isValidBuildUrl: true,
		};
	}

	// If not a build URL, return nulls
	return {
		userId: null,
		projectId: null,
		taskId: null,
		workspaceId: null,
		uploadFolder: null,
		baseUrl: null,
		isValidBuildUrl: false,
	};
}

// Parse URL and set global variables
const appConfig = parseCurrentUrl();

// Add to window global object for easy access
declare global {
	interface Window {
		APP_CONFIG: GlobalAppConfig;
	}
}

window.APP_CONFIG = appConfig;

// Also export for module imports
export const APP_CONFIG = appConfig;

// Log the parsed configuration
console.log("App Configuration:", {
	userId: appConfig.userId,
	projectId: appConfig.projectId,
	taskId: appConfig.taskId,
	workspaceId: appConfig.workspaceId,
	uploadFolder: appConfig.uploadFolder,
	baseUrl: appConfig.baseUrl,
	isValidBuildUrl: appConfig.isValidBuildUrl,
	currentUrl: window.location.href,
});

// Initialize auth integration automatically when app starts
initializeAuthIntegration();

// Create a QueryClient instance
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 5 * 60 * 1000, // 5 minutes
			gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
			retry: 1,
			refetchOnWindowFocus: false,
		},
	},
});

// Create a new router instance
const router = createRouter({
	routeTree,
	context: {},
	defaultPreload: "intent",
	scrollRestoration: true,
	defaultStructuralSharing: true,
	defaultPreloadStaleTime: 0,
	basepath: import.meta.env.TENANT_ID ? `/${import.meta.env.TENANT_ID}` : "/",
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

// Render the app
const rootElement = document.getElementById("app");
if (rootElement && !rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(
		<StrictMode>
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} />
			</QueryClientProvider>
		</StrictMode>,
	);
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
