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
