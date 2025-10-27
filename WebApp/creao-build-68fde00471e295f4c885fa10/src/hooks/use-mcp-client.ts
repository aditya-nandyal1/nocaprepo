import { useAuth } from "@/hooks/use-auth";
import { useReportToParentWindow } from "@/lib/report-parent-window";
import { useCallback } from "react";
import { useAppConfig } from "./use-app-config";

const API_BASE_PATH = import.meta.env.VITE_MCP_API_BASE_PATH;

export interface MCPRequest {
	jsonrpc: "2.0";
	id: string;
	method: string;
	params?: unknown;
}

export interface MCPResponse {
	jsonrpc: "2.0";
	id: string;
	result?: unknown;
	error?: {
		code: number;
		message: string;
		data?: unknown;
	};
}

/**
 * Standard MCP tool response format that wraps actual tool data
 * CRITICAL: MCP tools return data wrapped in content[0].text as JSON string
 */
export interface MCPToolResponse {
	content: Array<{
		type: "text";
		text: string; // JSON string containing actual tool data
	}>;
}

/**
 * Custom hook for making MCP calls with automatic reporting to parent window
 * Reports all MCP requests and responses to the parent window via postMessage
 *
 * IMPORTANT: MCP tools return wrapped responses in MCPToolResponse format
 * Use callTool<MCPToolResponse, InputParams>() and parse content[0].text JSON
 */
export function useMCPClient() {
	const { token, isAuthenticated } = useAuth();

	// Use the utility hook for reporting to parent window
	const { reportParent } = useReportToParentWindow();

	const callMCP = useCallback(
		async (
			serverUrl: string,
			mcpId: string,
			request: MCPRequest,
			transportType = "streamable_http",
		): Promise<unknown> => {
			if (!isAuthenticated) {
				throw new Error("User not authenticated");
			}

			// Base object with common fields for reporting
			const baseReportData = {
				serverUrl,
				method: request.method,
				params: request.params,
				url: `${API_BASE_PATH}/execute-mcp/v2`,
				transportType,
			};

			try {
				// Build headers object, conditionally adding task and project IDs when they're not null
				const headers: Record<string, string> = {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
					"X-CREAO-MCP-ID": mcpId,
				};

				const { taskId, projectId } = useAppConfig();
				if (taskId) headers["X-CREAO-API-TASK-ID"] = taskId;
				if (projectId) headers["X-CREAO-API-PROJECT-ID"] = projectId;

				const response = await fetch(`${API_BASE_PATH}/execute-mcp/v2`, {
					method: "POST",
					headers,
					body: JSON.stringify({
						transportType,
						serverUrl,
						request,
					}),
				});

				if (!response.ok) {
					const errorMessage = `HTTP error! status: ${response.status}`;
					// Report error response to parent window
					reportParent({
						type: "mcp",
						subType: "http-error",
						success: false,
						payload: {
							...baseReportData,
							error: {
								message: errorMessage,
								type: "http",
								status: response.status,
							},
						},
					});
					throw new Error(errorMessage);
				}

				const data: MCPResponse = await response.json();

				if (data.error) {
					const errorMessage = data.error.message || "MCP request failed";
					// Report MCP error to parent window
					reportParent({
						type: "mcp",
						subType: "data-error",
						success: false,
						payload: {
							...baseReportData,
							error: {
								message: errorMessage,
								type: "mcp-data",
								code: data.error.code,
								data: data.error.data,
							},
						},
					});
					throw new Error(errorMessage);
				}

				// Report successful response to parent window
				reportParent({
					type: "mcp",
					subType: "response-success",
					success: true,
					payload: {
						...baseReportData,
						response: data,
					},
				});

				return data.result;
			} catch (error) {
				// Report any unexpected errors
				if (error instanceof Error) {
					reportParent({
						type: "mcp",
						subType: "runtime-error",
						success: false,
						payload: {
							...baseReportData,
							error: {
								message: error.message,
								type: "runtime",
							},
						},
					});
				}
				throw error;
			}
		},
		[token, isAuthenticated, reportParent],
	);

	const listTools = useCallback(
		async (serverUrl: string, mcpId: string) => {
			return callMCP(serverUrl, mcpId, {
				jsonrpc: "2.0",
				id: `list-tools-${Date.now()}`,
				method: "tools/list",
			});
		},
		[callMCP],
	);

	const callTool = useCallback(
		async <TOutput = unknown, TInput = Record<string, unknown>>(
			serverUrl: string,
			mcpId: string,
			toolName: string,
			args: TInput,
		): Promise<TOutput> => {
			return callMCP(serverUrl, mcpId, {
				jsonrpc: "2.0",
				id: `call-tool-${Date.now()}`,
				method: "tools/call",
				params: {
					name: toolName,
					arguments: args,
				},
			}) as Promise<TOutput>;
		},
		[callMCP],
	);

	// No need for message queue processing - handled by useReportToParentWindow

	return {
		listTools,
		callTool,
	};
}
