// ============================================================
// CHAT API — warstwa komunikacji z AI chatbotem
// ============================================================

export interface ChatFilters {
  types: ('film' | 'serial')[];
  minYear: number;
  minRating: number;
  includedGenres: string[];
  excludedGenres: string[];
  excludedCountries: string[];
  selectedDays: string[] | null;
  weekOffset: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  reply: string;
  filters: ChatFilters | null;
}

export async function sendChatMessage(
  message: string,
  history: ChatMessage[]
): Promise<ChatResponse> {
  const res = await fetch('/api/ai-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}
