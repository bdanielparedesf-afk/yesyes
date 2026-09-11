export async function translateEnToEs(text: string): Promise<string> {
  const clean = (text || "").trim();
  if (clean.length < 2) return text;
  const noImg = clean.replace(/<img[^>]*>/gi, '');
  if (noImg.length < 2) return '';
  if (noImg.length > 500) {
    const parts = noImg.match(/.{1,400}/g) || [noImg];
    const translatedParts = await Promise.all(parts.map(p => translateEnToEs(p)));
    return translatedParts.join(" ");
  }
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(noImg)}&langpair=en|es`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const json: any = await res.json();
    const t = json?.responseData?.translatedText;
    if (t && t.length > 2) return t;
    return noImg;
  } catch {
    return noImg;
  }
}
