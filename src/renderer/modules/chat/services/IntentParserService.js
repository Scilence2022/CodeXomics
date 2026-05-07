// @ts-check
/**
 * IntentParserService - Extracted from ChatManager
 */
class IntentParserService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

  parseToolCall(response) {
    // Early return for null/undefined responses but NOT empty strings
    if (response === null || response === undefined) {
      return null;
    }

    // Handle empty strings differently - they might be valid in some contexts
    if (response === '') {
      // Empty string - continue with parsing logic
    }

    try {
      // Clean the response by removing any leading/trailing whitespace
      let cleanResponse = response.trim();

      // If response contains thinking tags, extract content after them
      if (cleanResponse.includes('</think>')) {
        const thinkEndIndex = cleanResponse.lastIndexOf('</think>');
        cleanResponse = cleanResponse.substring(thinkEndIndex + 8).trim();
      }

      // Remove any potential code block markers
      cleanResponse = cleanResponse.replace(/```json\s*|\s*```/gi, '').trim();
      cleanResponse = cleanResponse.replace(/```\s*|\s*```/g, '').trim();

      // If the response starts with non-JSON text (like "✅"), check if there's a JSON after it
      if (!cleanResponse.startsWith('{')) {
        const jsonMatch = cleanResponse.match(/\{[^{}]*"tool_name"[^{}]*"parameters"[^{}]*\}/);
        if (jsonMatch) {
          cleanResponse = jsonMatch[0];
        } else {
          // Check if this is a confirmation message that should have been a tool call
          if (cleanResponse.includes('Navigated to') || cleanResponse.includes('✅')) {
            return null;
          }
        }
      }

      // Try to parse the entire response as JSON first (most direct approach)
      try {
        const parsed = JSON.parse(cleanResponse);

        // ENHANCED: Fix malformed parameters if needed
        if (parsed.tool_name && parsed.parameters !== undefined) {
          // Fix malformed parameters for set_working_directory
          if (parsed.tool_name === 'set_working_directory' && typeof parsed.parameters === 'object') {
            const paramKeys = Object.keys(parsed.parameters);
            if (
              paramKeys.length === 1 &&
              !paramKeys.includes('directory_path') &&
              !paramKeys.includes('use_home_directory')
            ) {
              const pathValue = paramKeys[0];
              if (pathValue.startsWith('/') || pathValue.startsWith('~') || pathValue.includes('\\')) {
                parsed.parameters = {
                  directory_path: pathValue,
                };
              }
            }
          }

          return parsed;
        }
      } catch (e) {
        // Continue to other parsing methods if direct parse fails
      }

      // Try to extract JSON from potential markdown or mixed content
      const jsonMatches = cleanResponse.match(/\{[^{}]*"tool_name"[^{}]*"parameters"[^{}]*\}/);
      if (jsonMatches) {
        try {
          const parsed = JSON.parse(jsonMatches[0]);

          // ENHANCED: Fix malformed parameters if needed
          if (parsed.tool_name && parsed.parameters !== undefined) {
            // Fix malformed parameters for set_working_directory
            if (parsed.tool_name === 'set_working_directory' && typeof parsed.parameters === 'object') {
              const paramKeys = Object.keys(parsed.parameters);
              if (
                paramKeys.length === 1 &&
                !paramKeys.includes('directory_path') &&
                !paramKeys.includes('use_home_directory')
              ) {
                const pathValue = paramKeys[0];
                if (pathValue.startsWith('/') || pathValue.startsWith('~') || pathValue.includes('\\')) {
                  parsed.parameters = {
                    directory_path: pathValue,
                  };
                }
              }
            }

            return parsed;
          }
        } catch (e) {
          // Continue to next method
        }
      }

      // Try a more flexible JSON extraction that can handle nested braces
      const startIndex = cleanResponse.indexOf('{');
      if (startIndex !== -1) {
        let braceCount = 0;
        let endIndex = startIndex;

        for (let i = startIndex; i < cleanResponse.length; i++) {
          if (cleanResponse[i] === '{') braceCount++;
          if (cleanResponse[i] === '}') braceCount--;
          if (braceCount === 0) {
            endIndex = i;
            break;
          }
        }

        if (braceCount === 0) {
          const jsonCandidate = cleanResponse.substring(startIndex, endIndex + 1);
          try {
            const parsed = JSON.parse(jsonCandidate);

            // ENHANCED: Fix malformed parameters if needed
            if (parsed.tool_name && parsed.parameters !== undefined) {
              // Fix malformed parameters for set_working_directory
              if (parsed.tool_name === 'set_working_directory' && typeof parsed.parameters === 'object') {
                // If parameters is an object but doesn't have proper keys, try to fix it
                const paramKeys = Object.keys(parsed.parameters);
                if (
                  paramKeys.length === 1 &&
                  !paramKeys.includes('directory_path') &&
                  !paramKeys.includes('use_home_directory')
                ) {
                  // The parameter seems to be a path value without proper key
                  const pathValue = paramKeys[0];
                  if (pathValue.startsWith('/') || pathValue.startsWith('~') || pathValue.includes('\\')) {
                    parsed.parameters = {
                      directory_path: pathValue,
                    };
                  }
                }
              }

              return parsed;
            }
          } catch (e) {
            // Continue to next method
          }
        }
      }

      // Try to find any valid JSON object that has tool_name and parameters
      const allJsonMatches = cleanResponse.match(/\{[^}]*\}/g);
      if (allJsonMatches) {
        for (let i = 0; i < allJsonMatches.length; i++) {
          const match = allJsonMatches[i];
          try {
            const parsed = JSON.parse(match);
            if (parsed.tool_name && parsed.parameters !== undefined) {
              return parsed;
            }
          } catch (e) {
            // Continue to next match
          }
        }
      }

      // If no valid tool call found, return null
      return null;
      return null;
    } catch (error) {
      console.error('=== parseToolCall ERROR ===');
      console.error('Error:', error);
      console.error('Stack:', error.stack);
      console.error('=======================');
      console.warn('Error parsing potential tool call:', error);
      return null;
    }
  }

  parseMultipleToolCalls(response) {
    const toolCalls = [];

    try {
      let cleanResponse = response.trim();

      // Remove thinking tags if present
      if (cleanResponse.includes('</think>')) {
        const thinkEndIndex = cleanResponse.lastIndexOf('</think>');
        cleanResponse = cleanResponse.substring(thinkEndIndex + 8).trim();
      }

      // Remove code block markers but preserve structure for multiple JSON objects
      cleanResponse = cleanResponse.replace(/```json\s*/gi, '').replace(/\s*```/g, '');

      // Clean up residual 'json' text that might remain between objects
      // Handle cases like: }json{ and standalone 'json' strings
      cleanResponse = cleanResponse.replace(/}\s*json\s*{/g, '}\n{');
      cleanResponse = cleanResponse.replace(/^json\s*/, '').replace(/\s*json\s*$/, '');
      cleanResponse = cleanResponse.replace(/}\s*json\s*/g, '}\n');
      cleanResponse = cleanResponse.replace(/\s*json\s*{/g, '\n{');

      // Try to parse as array first (if properly formatted)
      if (cleanResponse.startsWith('[')) {
        try {
          const parsedArray = JSON.parse(cleanResponse);
          if (Array.isArray(parsedArray)) {
            const validTools = parsedArray.filter(
              item => item && typeof item === 'object' && item.tool_name && item.parameters !== undefined
            );
            return validTools;
          }
        } catch (e) {
          // Continue to other parsing methods
        }
      }

      // Find all JSON objects in the response using flexible regex
      // This handles both simple and nested JSON objects
      const jsonMatches = [];
      let index = 0;

      while (index < cleanResponse.length) {
        const start = cleanResponse.indexOf('{', index);
        if (start === -1) break;

        let braceCount = 0;
        let end = start;

        // Find matching closing brace
        for (let i = start; i < cleanResponse.length; i++) {
          if (cleanResponse[i] === '{') braceCount++;
          if (cleanResponse[i] === '}') braceCount--;
          if (braceCount === 0) {
            end = i;
            break;
          }
        }

        if (braceCount === 0) {
          const jsonCandidate = cleanResponse.substring(start, end + 1);
          jsonMatches.push(jsonCandidate);
          index = end + 1;
        } else {
          // Unmatched braces, move to next position
          index = start + 1;
        }
      }

      // Parse each JSON object and validate
      for (let i = 0; i < jsonMatches.length; i++) {
        const match = jsonMatches[i];
        try {
          const parsed = JSON.parse(match);
          if (parsed.tool_name && parsed.parameters !== undefined) {
            toolCalls.push(parsed);
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    } catch (error) {
      // Continue with empty toolCalls array
    }

    return toolCalls;
  }
}

window.IntentParserService = IntentParserService;
