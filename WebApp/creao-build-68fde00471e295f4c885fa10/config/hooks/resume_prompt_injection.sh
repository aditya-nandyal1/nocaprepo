#!/usr/bin/env bash
#
# This script provides implementation injection when resuming conversation based on existing codebase:
# - If NEEDS_DATA_SCHEMA is true in .env.local, inject ORM_INJECTION_PROMPT
# - If src/components/api is not empty, inject API_INJECTION_PROMPT
# - If src/components/mcp is not empty, inject MCP_INJECTION_PROMPT
#
set -euo pipefail

# Define prompt variables
ORM_INJECTION_PROMPT="## DATA LAYER

- FIRST, check for existing data layer implementation in \`src/components/data/\`, this is the exclusive location for data layer access.
- If the directory is empty or doesn't exist, there is no data layer in this project yet.
- If you need to create or update the data layer, use the 'data-layer-generation' subagent."

API_INJECTION_PROMPT="## API HOOKS

- FIRST, check if API hooks have already been written in \`src/hooks/\` for all APIs present in \`src/components/api/\`. If so, you may not need to generate new hooks.
- If any APIs in \`src/components/api/\` do not have corresponding hooks in \`src/hooks/\`, you should create or update the missing hooks.
- If you need to create or update API hooks, use the 'api-hook-enforcer' subagent."

MCP_INJECTION_PROMPT="## MCP HOOKS

- FIRST, check if MCP hooks have already been written in \`src/hooks/\` for all MCPs present in \`src/components/mcp/\`. If so, you may not need to generate new hooks.
- If any MCPs in \`src/components/mcp/\` do not have corresponding hooks in \`src/hooks/\`, you should create or update the missing hooks.
- If you need to create or update MCP hooks, use the 'mcp-hook-enforcer' subagent."

# Initialize context array
context_parts=()

# Check if NEEDS_DATA_SCHEMA is true in .env.local or data layer directories exist
if [ -f ".env.local" ] && grep -q "^NEEDS_DATA_SCHEMA=true" ".env.local"; then
  context_parts+=("$ORM_INJECTION_PROMPT")
fi

# Check if src/components/api exists and is not empty
if [ -d "src/components/api" ] && ls -A src/components/api/ 2>/dev/null | grep -q .; then
  context_parts+=("$API_INJECTION_PROMPT")
fi

# Check if src/components/mcp exists and is not empty
if [ -d "src/components/mcp" ] && ls -A src/components/mcp/ 2>/dev/null | grep -q .; then
  context_parts+=("$MCP_INJECTION_PROMPT")
fi

# Output context if any conditions were met
if [ ${#context_parts[@]} -gt 0 ]; then
  # Output guidance header first
  echo "=== RESUMING SESSION - MODIFICATION GUIDANCE ==="
  echo
  # Join array elements with newlines
  printf '%s\n\n' "${context_parts[@]}"
  echo "=== END OF MODIFICATION GUIDANCE ==="
fi

# Always exit successfully to allow the prompt to proceed
exit 0
