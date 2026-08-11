import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "img",
  "pre",
  "code",
];

const ALLOWED_ATTRIBUTES = {
  a: ["href", "title", "target"],
  img: ["src", "alt", "title"],
  "*": ["class"],
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto"],
    disallowedTagsMode: "discard",
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    },
    nonTextTags: ["style", "script", "textarea", "option"],
  });
}

export function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

export function truncateText(text: string, length: number = 160): string {
  if (text.length <= length) return text;
  return text.substring(0, length).trim() + "…";
}
