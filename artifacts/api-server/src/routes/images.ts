import { Router, type IRouter } from "express";
import { SearchImagesBody } from "@workspace/api-zod";

const router: IRouter = Router();

const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with","by",
  "from","is","was","are","were","be","been","being","have","has","had","do",
  "does","did","will","would","could","should","may","might","shall","there",
  "this","that","these","those","it","he","she","they","we","you","i","who",
  "which","what","when","where","how","if","as","so","such","also","then",
  "than","about","into","up","out","not","no","its","his","her","their","our",
  "my","your","all","one","two","three","very","just","once","upon","time",
  "little","now","after","before","while","during","through","over","under",
  "again","still","always","never","ever","some","any","each","every","few",
  "more","most","other","same","too","can","get","go","went","got","said",
  "came","come","see","saw","look","looked","know","knew","take","took",
  "make","made","like","want","need","find","found","tell","told","ask",
  "asked","seem","try","tried","feel","felt","put","keep","kept","run","ran",
  "much","many","well","back","way","day","year","old","new","big","small",
  "long","right","left","good","great","first","last","own","next","used",
  "give","gave","think","thought","let","show","showed","hear","heard",
]);

function extractKeywords(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  // Return up to 4 meaningful words
  return words.slice(0, 4).join(" ");
}

function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation or newlines
  const raw = text
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
  return raw;
}

async function searchPexels(
  query: string,
  count: number,
  key: string
): Promise<{ url: string; title: string; thumbnailUrl: string | null }[]> {
  if (!query.trim()) return [];
  const params = new URLSearchParams({ query: query.trim(), per_page: String(count) });
  const response = await fetch(`https://api.pexels.com/v1/search?${params.toString()}`, {
    headers: { Authorization: key },
  });
  if (!response.ok) return [];
  const data = await response.json() as {
    photos?: Array<{
      id: number;
      alt: string;
      src: { large: string; medium: string };
    }>;
  };
  return (data.photos ?? []).map((photo) => ({
    url: photo.src.large,
    title: photo.alt || `Photo ${photo.id}`,
    thumbnailUrl: photo.src.medium,
  }));
}

router.post("/images/search", async (req, res): Promise<void> => {
  const parsed = SearchImagesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const pexelsKey = process.env.PEXELS_API_KEY;
  if (!pexelsKey) {
    res.status(500).json({ error: "PEXELS_API_KEY is not set" });
    return;
  }

  const { prompt, count = 8 } = parsed.data;
  const safeCount = Math.min(Math.max(1, count), 20);

  // Split story into sentences and search per sentence for narrative order
  const sentences = splitIntoSentences(prompt);

  let images: { url: string; title: string; thumbnailUrl: string | null }[] = [];

  if (sentences.length <= 1) {
    // Single sentence or short prompt — simple keyword search
    const keywords = extractKeywords(prompt) || prompt.slice(0, 60);
    images = await searchPexels(keywords, safeCount, pexelsKey);
  } else {
    // Multiple sentences — fetch 2 photos per sentence in narrative order
    const perSentence = Math.max(2, Math.ceil(safeCount / sentences.length));
    const usedSentences = sentences.slice(0, Math.ceil(safeCount / 2));

    const results = await Promise.all(
      usedSentences.map((sentence) => {
        const keywords = extractKeywords(sentence) || sentence.slice(0, 40);
        return searchPexels(keywords, perSentence, pexelsKey);
      })
    );

    // Interleave: take photos in sentence order so they match the story
    const seenUrls = new Set<string>();
    for (const batch of results) {
      for (const img of batch) {
        if (!seenUrls.has(img.url)) {
          seenUrls.add(img.url);
          images.push(img);
          if (images.length >= safeCount) break;
        }
      }
      if (images.length >= safeCount) break;
    }

    // Pad with fallback full-prompt search if we didn't get enough
    if (images.length < safeCount) {
      const fallbackQuery = extractKeywords(prompt) || prompt.slice(0, 60);
      const fallback = await searchPexels(fallbackQuery, safeCount - images.length, pexelsKey);
      const seenUrlsSet = new Set(images.map((i) => i.url));
      for (const img of fallback) {
        if (!seenUrlsSet.has(img.url)) images.push(img);
        if (images.length >= safeCount) break;
      }
    }
  }

  res.json({ images, query: prompt });
});

export default router;
