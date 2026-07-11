/**
 * Simple language detector based on stopwords frequency.
 * Supports: pt, en, es, fr, de, it, nl
 */

const STOPWORDS = {
  pt: ['que', 'não', 'uma', 'por', 'mais', 'como', 'mas', 'foi', 'ele', 'ela', 'dos', 'das', 'com', 'seu', 'sua', 'para', 'são', 'mas', 'isso', 'este', 'essa', 'também', 'quando', 'muito', 'bem', 'ser', 'tinha', 'estava', 'havia'],
  en: ['the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this', 'but', 'his', 'her', 'from', 'they', 'she', 'been', 'would', 'there', 'their', 'what', 'all', 'were', 'when', 'which', 'said', 'each', 'into', 'could'],
  es: ['que', 'una', 'por', 'más', 'como', 'pero', 'fue', 'él', 'ella', 'los', 'las', 'con', 'sus', 'para', 'son', 'eso', 'este', 'esta', 'también', 'cuando', 'muy', 'bien', 'ser', 'tenía', 'estaba', 'había', 'todo', 'no'],
  fr: ['que', 'les', 'des', 'pour', 'pas', 'avec', 'vous', 'dans', 'mais', 'son', 'une', 'sur', 'est', 'par', 'aussi', 'plus', 'bien', 'comme', 'tout', 'elle', 'nous', 'était', 'très', 'entre', 'aux', 'lui', 'même', 'ont'],
  de: ['die', 'und', 'der', 'das', 'ist', 'mit', 'von', 'nicht', 'sich', 'den', 'auf', 'dem', 'ein', 'eine', 'auch', 'für', 'war', 'als', 'aber', 'aus', 'wird', 'nach', 'bei', 'noch', 'sein', 'wie', 'über', 'mehr'],
  it: ['che', 'non', 'una', 'per', 'più', 'come', 'ma', 'era', 'lui', 'lei', 'dei', 'delle', 'con', 'suo', 'sua', 'sono', 'questo', 'questa', 'anche', 'quando', 'molto', 'bene', 'essere', 'aveva', 'stati', 'tutto'],
};

// Detect language from a text sample
export function detectLanguage(text = '') {
  if (!text || text.trim().length < 50) return 'en';

  const words = text
    .toLowerCase()
    .replace(/[^a-záéíóúàèìòùâêîôûäëïöüãõñçß\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);

  if (words.length === 0) return 'en';

  const wordSet = new Set(words);
  const scores = {};

  for (const [lang, stopwords] of Object.entries(STOPWORDS)) {
    scores[lang] = stopwords.filter(sw => wordSet.has(sw)).length;
  }

  const detected = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return detected[1] > 0 ? detected[0] : 'en';
}

// Map detected language to BCP-47 locale for SpeechSynthesis
export function langToLocale(lang) {
  const map = {
    pt: 'pt',
    en: 'en',
    es: 'es',
    fr: 'fr',
    de: 'de',
    it: 'it',
    nl: 'nl',
  };
  return map[lang] || 'en';
}

// Pick the best available voice for a detected language
export function pickBestVoice(voices, lang) {
  if (!voices || voices.length === 0) return null;
  const locale = langToLocale(lang);

  // 1. Google voice in that language
  const googleExact = voices.find(v =>
    v.name.toLowerCase().includes('google') &&
    v.lang.toLowerCase().startsWith(locale)
  );
  if (googleExact) return googleExact;

  // 2. Any voice in that language
  const anyExact = voices.find(v => v.lang.toLowerCase().startsWith(locale));
  if (anyExact) return anyExact;

  // 3. Fallback: Google English
  const googleEn = voices.find(v =>
    v.name.toLowerCase().includes('google') && v.lang.toLowerCase().startsWith('en')
  );
  if (googleEn) return googleEn;

  // 4. Any voice
  return voices[0];
}
