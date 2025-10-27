import { APP_CONFIG } from "@/main";

/**
 * Hook to access global app configuration parsed from URL
 * Pattern: {base_url}/builds/{userId}/{projectId}/{taskId}/dist
 */
export function useAppConfig() {
	return {
		userId: APP_CONFIG.userId,
		projectId: APP_CONFIG.projectId,
		taskId: APP_CONFIG.taskId,
		workspaceId: APP_CONFIG.workspaceId,
		uploadFolder: APP_CONFIG.uploadFolder,
		baseUrl: APP_CONFIG.baseUrl,
		isValidBuildUrl: APP_CONFIG.isValidBuildUrl,

		// Check if we're in a valid build environment
		isInBuildEnvironment: () => APP_CONFIG.isValidBuildUrl,
	};
}

// You can also access directly via window.APP_CONFIG if needed
export { APP_CONFIG } from "@/main";
