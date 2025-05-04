import { requestUrl } from 'obsidian';
import { linkbreakPrompt } from '../prompts/linkbreak';

export interface SectionBoundary {
  section_start: string;
  section_end: string;
  title: string;
  reason: string;
}

/**
 * Calls the LLM with the linkbreak prompt and parses the section boundaries.
 * @param llmEndpoint The LLM API endpoint
 * @param llmModel The LLM model name
 * @param noteContent The note content to analyze
 * @returns Array of section boundaries
 */
export async function getSectionBoundariesFromLLM(
  llmEndpoint: string,
  llmModel: string,
  noteContent: string
): Promise<SectionBoundary[]> {
  const response = await requestUrl({
    method: 'POST',
    url: llmEndpoint,
    body: JSON.stringify({
      prompt: linkbreakPrompt(noteContent),
      model: llmModel,
      stream: false,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Try to parse the response as JSON
  console.log('LLM response:', response.text);
  const data = JSON.parse(response.text);
  const responseText = data.response;
  const jsonMatch = responseText.match(/\{([\s\S]*)\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse suggestions from LLM response');
  }

  return JSON.parse(jsonMatch[0]).suggestions;
}
