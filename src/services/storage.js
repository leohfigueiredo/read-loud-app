import localforage from 'localforage';

// Store actual file contents (Blob/ArrayBuffer)
export const booksDB = localforage.createInstance({
  name: 'ReadLoudApp',
  storeName: 'books_files'
});

// Store book metadata (Title, Author, Progress, etc)
export const metaDB = localforage.createInstance({
  name: 'ReadLoudApp',
  storeName: 'books_metadata'
});

// Store user preferences (Theme, Font size, API Keys)
export const settingsDB = localforage.createInstance({
  name: 'ReadLoudApp',
  storeName: 'user_settings'
});

// Store daily API usage for cost tracking
export const usageDB = localforage.createInstance({
  name: 'ReadLoudApp',
  storeName: 'api_usage'
});

// Gemini pricing constants (USD per 1M characters, approximate)
export const PRICING = {
  ttsPerChar:  0.50  / 1_000_000, // Gemini 2.5 Flash audio output
  textPerChar: 0.075 / 4_000_000, // Gemini 2.5 Flash input (~4 chars/token)
};

export async function trackApiUsage(type, chars) {
  const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
  const key = `day_${today}`;
  const existing = await usageDB.getItem(key) || { date: today, ttsChars: 0, textChars: 0 };
  if (type === 'tts')  existing.ttsChars  += chars;
  if (type === 'text') existing.textChars += chars;
  await usageDB.setItem(key, existing);
}

export async function getAllUsage() {
  const days = [];
  await usageDB.iterate((value) => { days.push(value); });
  return days.sort((a, b) => b.date.localeCompare(a.date));
}

export async function clearUsage() {
  await usageDB.clear();
}

export async function saveBook(file, id, metadata) {
  await booksDB.setItem(id, file);
  await metaDB.setItem(id, { 
    ...metadata, 
    id, 
    progress: 0, 
    addedAt: Date.now() 
  });
}

export async function getBook(id) {
  const file = await booksDB.getItem(id);
  const metadata = await metaDB.getItem(id);
  return { file, metadata };
}

export async function getAllBooksMetadata() {
  const books = [];
  await metaDB.iterate((value) => {
    books.push(value);
  });
  return books.sort((a, b) => b.addedAt - a.addedAt);
}

export async function updateProgress(id, progressLocation, percent) {
  const meta = await metaDB.getItem(id);
  if (meta) {
    meta.progressLocation = progressLocation; // e.g. epubcfi or page number
    meta.progressPercent = percent;
    meta.lastReadAt = Date.now();
    await metaDB.setItem(id, meta);
  }
}

export async function deleteBook(id) {
  await booksDB.removeItem(id);
  await metaDB.removeItem(id);
}
