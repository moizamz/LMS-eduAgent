/**
 * Hard-coded rotating copy for long-running AI / practice flows.
 * Shuffled by index over time so the UI feels alive without extra network calls.
 */
export const LLM_WAIT_MESSAGES = [
  'Teaching the neurons to speed-read your PDFs…',
  'Brewing fresh multiple-choice from lecture atoms…',
  'Convincing tensors that procrastination is not a valid loss function…',
  'Stitching concepts into questions like a semantic tailor…',
  'Asking the model to think deeply—but not so deeply that it misses lunch…',
  'Distilling pages into sharp “gotcha” distractors…',
  'Running a mini debate club inside the GPU…',
  'Almost there: aligning JSON brackets with the stars…',
];

export const PRACTICE_WAIT_MESSAGES = [
  'Spinning up your adaptive practice lane…',
  'Negotiating with the question bank for fair picks…',
  'Tuning difficulty so it stings just enough to teach…',
  'Plotting your next challenge on the learning curve…',
  'Sharpening hints without giving away the crown jewels…',
  'Counting neurons firing in your favor…',
];

export const CHAT_WAIT_MESSAGES = [
  'Routing your message through the fastest tutor lane…',
  'Cross-referencing your files with curiosity…',
  'Packaging an answer that fits in one breath…',
  'Polishing wording so it lands clearly…',
];

export function pickEngagementMessage(list, tick) {
  if (!list?.length) return '';
  const i = Math.abs(Math.floor(tick)) % list.length;
  return list[i];
}
