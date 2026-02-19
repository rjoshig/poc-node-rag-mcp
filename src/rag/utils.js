function chunkText(text, chunkSize = 500, overlap = 50) {
  const chunks = [];
  const cleanText = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleanText) return chunks;

  let start = 0;
  while (start < cleanText.length) {
    const end = Math.min(start + chunkSize, cleanText.length);
    const chunk = cleanText.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    start += Math.max(1, chunkSize - overlap);
  }
  return chunks;
}

module.exports = { chunkText };
