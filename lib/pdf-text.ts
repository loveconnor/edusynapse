import { MAX_COACH_ATTACHMENT_TEXT_LENGTH } from "./ai-coach";

function normalizePdfText(value: string) {
  return value
    .replace(/[\t ]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractPdfText(file: File, remainingCharacters: number) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
    stopAtErrors: true,
    useSystemFonts: true,
  });

  const document = await loadingTask.promise;
  let text = "";
  let truncated = false;

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) =>
          "str" in item ? `${item.str}${item.hasEOL ? "\n" : " "}` : "",
        )
        .join("");

      if (text.length + pageText.length > remainingCharacters) {
        text += pageText.slice(0, Math.max(0, remainingCharacters - text.length));
        truncated = true;
        break;
      }

      text += `${pageText}\n\n`;
    }
  } finally {
    await document.destroy();
  }

  return {
    text: normalizePdfText(text).slice(0, MAX_COACH_ATTACHMENT_TEXT_LENGTH),
    truncated,
  };
}
