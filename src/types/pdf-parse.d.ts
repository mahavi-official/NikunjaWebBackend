declare module "pdf-parse" {
  export default function pdfParse(
    dataBuffer: Buffer,
    options?: any
  ): Promise<{ text: string; numpages: number; [key: string]: any }>;
}