import pdfParse from "pdf-parse";

export interface PDFExtractResult {
  text: string;
  pageCount: number;
}

export async function extractPdfText(buffer: Buffer): Promise<PDFExtractResult> {
  try {
    const data = await pdfParse(buffer);
    return {
      text: data.text,
      pageCount: data.numpages,
    };
  } catch (error) {
    console.error("PDF extraction error:", error);
    return {
      text: "",
      pageCount: 0,
    };
  }
}

export function truncatePdfText(text: string, maxLength: number = 50000): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength);
}
