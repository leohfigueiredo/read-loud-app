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

// Store notebook drawings (canvas data URL)
export const notebookDB = localforage.createInstance({
  name: 'ReadLoudApp',
  storeName: 'notebook'
});

export async function saveNotebookData(dataUrl) {
  await notebookDB.setItem('canvas_data', dataUrl);
}

export async function getNotebookData() {
  return await notebookDB.getItem('canvas_data');
}

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
  let fileData = file;
  if (file instanceof Blob) {
    fileData = await file.arrayBuffer();
  }
  await booksDB.setItem(id, fileData);
  await metaDB.setItem(id, { 
    ...metadata, 
    id, 
    progress: 0, 
    addedAt: Date.now(),
    shelf: metadata.shelf || 'Todas'
  });
}

export async function updateBookShelf(id, shelf) {
  const meta = await metaDB.getItem(id);
  if (meta) {
    meta.shelf = shelf;
    await metaDB.setItem(id, meta);
  }
}

export async function getBook(id) {
  let file = await booksDB.getItem(id);
  const metadata = await metaDB.getItem(id);
  if (file && file instanceof ArrayBuffer) {
    const mimeType = metadata.type === 'pdf' ? 'application/pdf' : 'application/epub+zip';
    file = new Blob([file], { type: mimeType });
  }
  return { file, metadata };
}

export async function getAllBooksMetadata() {
  const books = [];
  await metaDB.iterate((value) => {
    books.push(value);
  });
  return books.sort((a, b) => b.addedAt - a.addedAt);
}

export async function updateProgress(id, progressLocation, percent, ttsParagraphIndex = undefined) {
  const meta = await metaDB.getItem(id);
  if (meta) {
    if (String(meta.progressLocation) !== String(progressLocation)) {
      meta.ttsParagraphIndex = ttsParagraphIndex !== undefined ? ttsParagraphIndex : 0;
    } else if (ttsParagraphIndex !== undefined) {
      meta.ttsParagraphIndex = ttsParagraphIndex;
    }
    meta.progressLocation = progressLocation; // e.g. epubcfi or page number
    if (percent !== undefined && percent !== null) {
      meta.progressPercent = percent;
    }
    meta.lastReadAt = Date.now();
    await metaDB.setItem(id, meta);
  }
}

export async function deleteBook(id) {
  await booksDB.removeItem(id);
  await metaDB.removeItem(id);
}
