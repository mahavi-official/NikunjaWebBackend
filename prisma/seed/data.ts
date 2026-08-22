/**
 * Sample content for local development, staging, and QA.
 *
 * Everything here is fictional. It exists so that every `/api/v1/public/*`
 * endpoint, the homepage aggregate, search, and the admin dashboard return
 * something realistic instead of empty arrays.
 *
 * Two rules keep the seed safe to re-run and safe to remove:
 *   - every row has a stable natural key (slug / email / setting key), so
 *     seeding is an upsert rather than an insert;
 *   - every media row lives under the `seed/` blob-name prefix, which is how
 *     `--clean` finds seeded media without touching real uploads.
 */

export const SEED_MEDIA_PREFIX = "seed/";

/** Marks the demo accounts the seed creates, so cleanup can find them. */
export const SEED_USER_EMAIL_DOMAIN = "@seed.radhakundah.test";

// ═══════════════════════════════════════════════════════════════
// MEDIA
// ═══════════════════════════════════════════════════════════════

/**
 * No files are uploaded to Blob Storage. Each row points at picsum.photos, which serves
 * a stable image per `seed` string, so covers and galleries actually render in
 * the frontend while staying obviously placeholder.
 */
export interface MediaSeed {
  key: string;
  fileName: string;
  folder: string;
  alt: string;
  width: number;
  height: number;
}

const media = (
  key: string,
  folder: string,
  alt: string,
  width = 1600,
  height = 900
): MediaSeed => ({ key, fileName: `${key}.jpg`, folder, alt, width, height });

export const mediaSeed: MediaSeed[] = [
  // site chrome
  media("site-logo", "/branding", "Radhakundah wordmark", 512, 512),
  media("seo-default-og", "/branding", "Radhakundah default social share image", 1200, 630),

  // hero
  media("hero-kunda-dawn", "/hero", "Stone steps leading down to the water at first light"),
  media("hero-kartik-lamps", "/hero", "Rows of oil lamps set out along a ghat during Kartik"),
  media("hero-manuscript-table", "/hero", "Palm-leaf folios laid out on a conservation table"),
  media("hero-monsoon-ghats", "/hero", "Monsoon clouds over the ghats"),

  // post covers
  media("post-parikrama", "/posts", "Pilgrims walking a circumambulation path at dawn"),
  media("post-manjari", "/posts", "Devotional painting detail in ochre and indigo"),
  media("post-rupa-goswami", "/posts", "Open Sanskrit commentary beside a reading lamp"),
  media("post-aryaghat-restoration", "/posts", "Masons refacing weathered stone steps"),
  media("post-archive-folios", "/posts", "Numbered folios stacked in an archive box"),
  media("post-kartik-guide", "/posts", "Evening crowd gathered for lamp offerings"),
  media("post-digitisation-year", "/posts", "Overhead camera rig above an open manuscript"),
  media("post-kirtan-sound", "/posts", "Hand drum and cymbals resting on a woven mat"),
  media("post-winter-series", "/posts", "Empty lecture hall set with chairs"),

  // author portraits
  media("author-sharma", "/authors", "Portrait of a researcher in a library", 800, 800),
  media("author-dasgupta", "/authors", "Portrait of a scholar outdoors", 800, 800),
  media("author-verma", "/authors", "Portrait of an academic at a desk", 800, 800),
  media("author-oconnell", "/authors", "Portrait of a fieldworker with notebook", 800, 800),
  media("author-mishra", "/authors", "Portrait of a conservator at work", 800, 800),

  // research social images
  media("research-water", "/research", "Historic water channel cut into stone", 1200, 630),
  media("research-manuscripts", "/research", "Bound manuscript spines on a shelf", 1200, 630),
  media("research-mobility", "/research", "Buses and pilgrims at a seasonal transit stop", 1200, 630),
  media("research-kirtan", "/research", "Ensemble seated in a circle mid-performance", 1200, 630),

  // gallery covers
  media("gallery-kartik-cover", "/gallery", "Lamps reflected in still water"),
  media("gallery-aryaghat-cover", "/gallery", "Scaffolding against a restored ghat wall"),
  media("gallery-conservation-cover", "/gallery", "Gloved hands lifting a fragile folio"),
  media("gallery-monsoon-cover", "/gallery", "Rain falling on flooded steps"),

  // gallery images — kartik
  media("kartik-1", "/gallery/kartik", "Pilgrims setting lamps afloat at dusk"),
  media("kartik-2", "/gallery/kartik", "A child shielding a lamp flame from the wind"),
  media("kartik-3", "/gallery/kartik", "Marigold garlands piled for the evening offering"),
  media("kartik-4", "/gallery/kartik", "Procession moving along the parikrama path"),
  media("kartik-5", "/gallery/kartik", "Singers gathered under a canopy at night"),
  media("kartik-6", "/gallery/kartik", "Lamps burning down to their last oil before dawn"),

  // gallery images — aryaghat
  media("aryaghat-1", "/gallery/aryaghat", "Weathered steps before restoration work began"),
  media("aryaghat-2", "/gallery/aryaghat", "Stonemason cutting a replacement block"),
  media("aryaghat-3", "/gallery/aryaghat", "Lime mortar being mixed on site"),
  media("aryaghat-4", "/gallery/aryaghat", "Survey markers set along the retaining wall"),
  media("aryaghat-5", "/gallery/aryaghat", "The finished section of refaced steps"),

  // gallery images — conservation
  media("conservation-1", "/gallery/conservation", "Folio measured against a reference scale"),
  media("conservation-2", "/gallery/conservation", "Tear repaired with tissue and wheat starch paste"),
  media("conservation-3", "/gallery/conservation", "Cleaned folios drying under weights"),
  media("conservation-4", "/gallery/conservation", "Boxed manuscript labelled for the archive"),

  // gallery images — monsoon (unpublished segment)
  media("monsoon-1", "/gallery/monsoon", "Water rising over the lower steps"),
  media("monsoon-2", "/gallery/monsoon", "Umbrellas along a flooded lane"),
  media("monsoon-3", "/gallery/monsoon", "Clouds breaking over the treeline"),
];

// ═══════════════════════════════════════════════════════════════
// TAXONOMY
// ═══════════════════════════════════════════════════════════════

export interface CategorySeed {
  scope: "ARTICLE" | "BLOG" | "RESEARCH";
  name: string;
  slug: string;
  description: string;
  order: number;
}

export const categoriesSeed: CategorySeed[] = [
  { scope: "ARTICLE", name: "Pilgrimage", slug: "pilgrimage", description: "Routes, seasons, and the practice of walking them.", order: 0 },
  { scope: "ARTICLE", name: "Philosophy", slug: "philosophy", description: "Doctrine, commentary, and their modern readings.", order: 1 },
  { scope: "ARTICLE", name: "History", slug: "history", description: "How the sites and their communities came to be.", order: 2 },
  { scope: "ARTICLE", name: "Practice", slug: "practice", description: "Ritual, music, and daily observance.", order: 3 },

  { scope: "BLOG", name: "Field Notes", slug: "field-notes", description: "Short dispatches from ongoing work.", order: 0 },
  { scope: "BLOG", name: "Updates", slug: "updates", description: "Progress on projects and programmes.", order: 1 },
  { scope: "BLOG", name: "Announcements", slug: "announcements", description: "Events, publications, and calls for participation.", order: 2 },
  { scope: "BLOG", name: "Stories", slug: "stories", description: "People, places, and the occasional detour.", order: 3 },

  { scope: "RESEARCH", name: "Manuscript Studies", slug: "manuscript-studies", description: "Codicology, transmission, and cataloguing.", order: 0 },
  { scope: "RESEARCH", name: "Ethnography", slug: "ethnography", description: "Fieldwork among practising communities.", order: 1 },
  { scope: "RESEARCH", name: "Textual Analysis", slug: "textual-analysis", description: "Close readings of primary sources.", order: 2 },
  { scope: "RESEARCH", name: "Historical Survey", slug: "historical-survey", description: "Long-range studies of sites and institutions.", order: 3 },
];

export interface VideoCategorySeed {
  name: string;
  slug: string;
  description: string;
  order: number;
}

export const videoCategoriesSeed: VideoCategorySeed[] = [
  { name: "Lectures", slug: "lectures", description: "Recorded talks and seminar sessions.", order: 0 },
  { name: "Kirtan", slug: "kirtan", description: "Devotional music recordings.", order: 1 },
  { name: "Documentaries", slug: "documentaries", description: "Longer-form films about the sites and their people.", order: 2 },
  { name: "Interviews", slug: "interviews", description: "Conversations with scholars and practitioners.", order: 3 },
];

/** Kept in one place so seeding and cleanup always derive the same slug. */
export const tagSlug = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Shared by posts and research; created on demand by name. */
export const tagsSeed = [
  "Radha Kunda",
  "Vraja",
  "Bhakti",
  "Manuscripts",
  "Pilgrimage",
  "Kirtan",
  "Sanskrit",
  "Ethnography",
  "Conservation",
  "Oral History",
  "Festivals",
  "Architecture",
];

// ═══════════════════════════════════════════════════════════════
// POSTS
// ═══════════════════════════════════════════════════════════════

export interface PostSeed {
  slug: string;
  title: string;
  placement: "ARTICLE" | "BLOG" | "BOTH";
  /** null = draft; negative = published this many days ago; positive = scheduled. */
  publishedDaysAgo: number | null;
  isFeatured: boolean;
  excerpt: string;
  content: string;
  coverKey: string;
  categorySlugs: string[];
  tagNames: string[];
  viewCount: number;
  commentsEnabled: boolean;
  metaTitle: string;
  metaDescription: string;
}

export const postsSeed: PostSeed[] = [
  {
    slug: "walking-the-parikrama-a-field-guide",
    title: "Walking the Parikrama: A Field Guide",
    placement: "ARTICLE",
    publishedDaysAgo: 4,
    isFeatured: true,
    excerpt:
      "The circuit takes most people a little under two hours. What follows is a practical account of the route, the seasons that change it, and the etiquette that holds it together.",
    content: `<p>The path around the kunda is short enough to walk before breakfast and old enough that nobody agrees on when it was first marked. Most pilgrims complete the circuit in a little under two hours, though that figure means very little in Kartik, when the same distance can take an entire evening.</p>
<h2>The route</h2>
<p>Begin at the northern steps and keep the water on your right. The surface alternates between dressed stone, packed earth, and — for a stretch of about three hundred metres — a paved road shared with traffic. Footwear matters more than guidebooks admit.</p>
<p>Three points along the way reward a pause: the small shrine at the northeast corner, the grove halfway down the eastern side, and the wide landing on the south bank where most groups stop to sing.</p>
<h2>Seasons</h2>
<p>In the monsoon the lower steps go under water and the eastern path becomes impassable for days at a time; local practice is simply to walk the upper road and rejoin the circuit further on. In the dry months the walk is dusty but complete.</p>
<blockquote><p>Ask before photographing anyone at prayer. It is a small courtesy and it is almost always granted.</p></blockquote>
<h2>Etiquette</h2>
<p>Walk barefoot if you are comfortable doing so, keep to the right so faster groups can pass, and do not step over anyone seated on the path. None of this is enforced. All of it is noticed.</p>`,
    coverKey: "post-parikrama",
    categorySlugs: ["pilgrimage"],
    tagNames: ["Radha Kunda", "Pilgrimage", "Vraja"],
    viewCount: 1284,
    commentsEnabled: true,
    metaTitle: "Walking the Parikrama: A Practical Field Guide",
    metaDescription:
      "Route, seasons, and etiquette for the circuit around Radha Kunda, written for first-time visitors.",
  },
  {
    slug: "what-the-manjari-tradition-teaches-about-attention",
    title: "What the Manjari Tradition Teaches About Attention",
    placement: "ARTICLE",
    publishedDaysAgo: 11,
    isFeatured: true,
    excerpt:
      "A tradition built entirely on sustained imaginative attention has more to say to a distracted century than it is usually given credit for.",
    content: `<p>It is easy to read the manjari literature as devotional ornament and miss what it is actually doing: training attention, in fine detail, over long periods, on something that yields nothing measurable.</p>
<h2>A discipline, not a mood</h2>
<p>The instruction is specific. Hold a scene. Hold your position within it. Notice when the mind substitutes a summary for the thing itself, and return. Anyone who has attempted a contemplative practice will recognise the mechanics, even where they do not share the theology.</p>
<p>What distinguishes the tradition is its insistence that the object of attention be particular — a place, an hour, a gesture — rather than abstract. Abstraction is treated as a failure mode.</p>
<h2>Why it reads differently now</h2>
<p>We have built an economy around the opposite skill: rapid, shallow, interruptible attention distributed across many objects. Set beside that, a six-hundred-year-old manual on sustained imaginative focus stops looking quaint.</p>
<p>None of which is an argument for the theology. It is an argument for reading the texts as technical literature about a human capacity, which is how their authors seem to have understood them.</p>`,
    coverKey: "post-manjari",
    categorySlugs: ["philosophy", "practice"],
    tagNames: ["Bhakti", "Sanskrit"],
    viewCount: 742,
    commentsEnabled: true,
    metaTitle: "What the Manjari Tradition Teaches About Attention",
    metaDescription:
      "Reading the manjari literature as technical writing about sustained attention rather than devotional ornament.",
  },
  {
    slug: "reading-rupa-goswami-in-the-twenty-first-century",
    title: "Reading Rupa Goswami in the Twenty-First Century",
    placement: "ARTICLE",
    publishedDaysAgo: 19,
    isFeatured: false,
    excerpt:
      "Four centuries of commentary sit between us and the text. That layer is not an obstacle to reading it — it is most of what there is to read.",
    content: `<p>Every serious edition of the <em>Bhakti-rasamrita-sindhu</em> arrives wrapped in commentary, and students are routinely advised to read the root text first and the commentary after. The advice is well meant and mostly wrong.</p>
<h2>The commentary is the tradition</h2>
<p>The root verses are compressed to the point of being mnemonic. They were never intended to be self-sufficient; they were intended to be unpacked by a teacher. Reading them stripped of that apparatus produces a text that is clean, quotable, and considerably less interesting than the thing itself.</p>
<h2>Where the disagreements are</h2>
<p>Commentators disagree, sometimes sharply, and those disagreements are the most useful part of the record. They mark exactly where the tradition found its own text difficult — which is where a modern reader should be paying attention too.</p>
<p>A practical approach: read the verse, then read two commentators who dislike each other, then read the verse again.</p>`,
    coverKey: "post-rupa-goswami",
    categorySlugs: ["philosophy"],
    tagNames: ["Sanskrit", "Bhakti", "Manuscripts"],
    viewCount: 511,
    commentsEnabled: true,
    metaTitle: "Reading Rupa Goswami in the Twenty-First Century",
    metaDescription:
      "Why the commentarial layer around the Bhakti-rasamrita-sindhu is the tradition, not an obstacle to it.",
  },
  {
    slug: "the-ghats-of-aryaghat-restoration-notes",
    title: "The Ghats of Aryaghat: Restoration Notes",
    placement: "BOTH",
    publishedDaysAgo: 6,
    isFeatured: true,
    excerpt:
      "Eighteen months of stonework, one collapsed retaining wall, and a long argument about lime mortar.",
    content: `<p>The eastern retaining wall gave way in the second week of the monsoon, taking eleven steps with it. What followed was eighteen months of work and a useful education in why the original builders did things the way they did.</p>
<h2>Lime, not cement</h2>
<p>The first proposal was a cement repair: fast, cheap, and structurally confident. It was also the reason the previous repair failed. Cement is harder than the surrounding sandstone and does not breathe; water that gets behind it stays there and works on the softer stone until something moves.</p>
<p>Lime mortar is slower to set, more expensive to source, and forgiving in exactly the ways this wall needs. The argument took four months. The lime won.</p>
<h2>What we recorded</h2>
<p>Every block removed was numbered, photographed in place, and logged against a survey grid before it moved. Roughly a third proved reusable. The replacements were cut locally from the same bed, which will look mismatched for about a decade and then stop.</p>
<h2>What is left</h2>
<p>The northern section has the same fault line and has not yet failed. It will. Scheduling that work before the water does it for us is the next phase.</p>`,
    coverKey: "post-aryaghat-restoration",
    categorySlugs: ["history", "field-notes"],
    tagNames: ["Architecture", "Conservation", "Radha Kunda"],
    viewCount: 967,
    commentsEnabled: true,
    metaTitle: "The Ghats of Aryaghat: Restoration Notes",
    metaDescription:
      "Eighteen months of stone conservation work at Aryaghat, and why lime mortar beat cement.",
  },
  {
    slug: "notes-from-the-archive-cataloguing-400-folios",
    title: "Notes from the Archive: Cataloguing 400 Folios",
    placement: "BLOG",
    publishedDaysAgo: 2,
    isFeatured: false,
    excerpt:
      "Three months, four hundred folios, and one manuscript that turned out to be two manuscripts.",
    content: `<p>The box arrived labelled as a single incomplete work. It contained at least two, possibly three, and the person who bound them together clearly knew something we do not.</p>
<h2>The count</h2>
<p>Four hundred and six folios, of which three hundred and eighty-one are legible without imaging support. Twenty-five need raking light or nothing at all will come off them.</p>
<h2>The complication</h2>
<p>Two distinct hands, two paper stocks, and a numbering sequence that restarts at folio 212 — which is where the second work begins, though the binder made no distinction. Whether they were bound together by intent or by accident is now the interesting question.</p>
<p>Cataloguing continues. The revised finding aid should be ready before the end of the quarter.</p>`,
    coverKey: "post-archive-folios",
    categorySlugs: ["field-notes"],
    tagNames: ["Manuscripts", "Conservation"],
    viewCount: 318,
    commentsEnabled: true,
    metaTitle: "Notes from the Archive: Cataloguing 400 Folios",
    metaDescription:
      "A quarterly dispatch from the manuscript archive, including one volume that turned out to be two.",
  },
  {
    slug: "kartik-at-radha-kunda-what-to-expect",
    title: "Kartik at Radha Kunda: What to Expect",
    placement: "BLOG",
    publishedDaysAgo: 27,
    isFeatured: false,
    excerpt:
      "Crowds, lamps, and very little sleep. A practical note for anyone visiting during the month.",
    content: `<p>Kartik changes the place completely. If your only experience of the kunda is the quiet of the dry season, the month will be a surprise, and it is worth arriving prepared for it.</p>
<h2>Crowds</h2>
<p>Expect the parikrama path to be busy from late afternoon until well past midnight. Mornings before seven are the closest thing to normal.</p>
<h2>Lamps</h2>
<p>Lamp offerings run every evening. Oil, wicks, and clay lamps are sold along the approach roads; buying them near the water costs more and supports the same families, so pick whichever bothers you less.</p>
<h2>Practicalities</h2>
<ul>
<li>Accommodation books out roughly two months ahead.</li>
<li>Nights are cooler than visitors expect — bring a layer.</li>
<li>Most kitchens observe the month's dietary restrictions; ask before assuming.</li>
</ul>
<p>Go if you can. It is the one time of year the site is doing exactly what it was built to do.</p>`,
    coverKey: "post-kartik-guide",
    categorySlugs: ["stories"],
    tagNames: ["Festivals", "Pilgrimage", "Radha Kunda"],
    viewCount: 2410,
    commentsEnabled: true,
    metaTitle: "Kartik at Radha Kunda: What to Expect",
    metaDescription:
      "Crowds, lamp offerings, and practical advice for visiting Radha Kunda during the month of Kartik.",
  },
  {
    slug: "our-digitisation-programme-one-year-on",
    title: "Our Digitisation Programme, One Year On",
    placement: "BLOG",
    publishedDaysAgo: 40,
    isFeatured: false,
    excerpt:
      "Twelve thousand images, two camera rigs, and a storage bill nobody budgeted for.",
    content: `<p>A year ago we set out to image every manuscript in the collection at archival quality. We are about a third of the way through, which is roughly half the pace we projected and about twice the pace anyone with experience predicted.</p>
<h2>By the numbers</h2>
<ul>
<li>12,400 images captured at 600 dpi</li>
<li>1,900 folios fully described</li>
<li>2 camera rigs, one of which is on its second sensor</li>
</ul>
<h2>What we got wrong</h2>
<p>Storage. Archival TIFFs at this resolution are large, and the derivative pipeline — service copies, thumbnails, OCR inputs — multiplies the footprint by roughly four. The budget assumed one copy.</p>
<h2>What we got right</h2>
<p>Describing as we image, rather than promising to come back later. Nobody ever comes back later.</p>`,
    coverKey: "post-digitisation-year",
    categorySlugs: ["updates"],
    tagNames: ["Manuscripts", "Conservation"],
    viewCount: 605,
    commentsEnabled: false,
    metaTitle: "Our Digitisation Programme, One Year On",
    metaDescription:
      "Progress, costs, and lessons from the first year of imaging the manuscript collection.",
  },
  {
    slug: "sound-and-silence-in-kirtan-ensembles",
    title: "Sound and Silence in Kirtan Ensembles",
    placement: "ARTICLE",
    publishedDaysAgo: null, // draft — must not appear on any public endpoint
    isFeatured: false,
    excerpt:
      "A working draft on what happens in the gaps between phrases, and why they are not empty.",
    content: `<p>This is an unfinished draft. It is seeded deliberately so that draft visibility can be tested: it must never appear in a public listing, a sitemap, or a search result.</p>
<p>The argument, such as it is, concerns the rests between call and response — how long they run, who controls them, and what an ensemble does with a silence that lasts a beat longer than expected.</p>`,
    coverKey: "post-kirtan-sound",
    categorySlugs: ["practice"],
    tagNames: ["Kirtan", "Ethnography"],
    viewCount: 0,
    commentsEnabled: true,
    metaTitle: "Sound and Silence in Kirtan Ensembles",
    metaDescription: "A working draft on rests, timing, and control in kirtan performance.",
  },
  {
    slug: "winter-lecture-series-announced",
    title: "Winter Lecture Series Announced",
    placement: "BLOG",
    publishedDaysAgo: -7, // scheduled — published, but dated a week into the future
    isFeatured: false,
    excerpt:
      "Six evenings, six speakers, beginning next month. Seeded with a future date to exercise scheduled publishing.",
    content: `<p>The winter series runs over six consecutive Thursday evenings. Speakers and titles are listed below; attendance is free and unticketed.</p>
<p>This post carries a publication date one week in the future. Until that date passes it must not appear on any public endpoint — which is exactly what it is here to test.</p>`,
    coverKey: "post-winter-series",
    categorySlugs: ["announcements"],
    tagNames: ["Festivals"],
    viewCount: 0,
    commentsEnabled: true,
    metaTitle: "Winter Lecture Series Announced",
    metaDescription: "Six evening lectures across six weeks, beginning next month.",
  },
];

// ═══════════════════════════════════════════════════════════════
// AUTHORS & RESEARCH
// ═══════════════════════════════════════════════════════════════

export interface AuthorSeed {
  slug: string;
  name: string;
  affiliation: string;
  bio: string;
  email: string;
  orcid: string;
  photoKey: string;
}

export const authorsSeed: AuthorSeed[] = [
  {
    slug: "anjali-sharma",
    name: "Anjali Sharma",
    affiliation: "Department of History, University of Delhi",
    bio: "Works on water infrastructure and land records in early modern Braj. Currently completing a monograph on tank management under regional patronage.",
    email: "a.sharma@seed.radhakundah.test",
    orcid: "0000-0002-1825-0097",
    photoKey: "author-sharma",
  },
  {
    slug: "rohan-dasgupta",
    name: "Rohan Dasgupta",
    affiliation: "School of Oriental Studies, Kolkata",
    bio: "Codicologist. Interested in how devotional manuscripts travelled between regional collections, and what their bindings record about that movement.",
    email: "r.dasgupta@seed.radhakundah.test",
    orcid: "0000-0001-5109-3700",
    photoKey: "author-dasgupta",
  },
  {
    slug: "meera-verma",
    name: "Meera Verma",
    affiliation: "Centre for Religious Studies, Jaipur",
    bio: "Ethnographer of pilgrimage economies. Has spent nine seasons documenting seasonal labour around the Braj circuit.",
    email: "m.verma@seed.radhakundah.test",
    orcid: "0000-0003-4832-1194",
    photoKey: "author-verma",
  },
  {
    slug: "james-oconnell",
    name: "James O'Connell",
    affiliation: "Institute of Ethnomusicology, Edinburgh",
    bio: "Records and analyses devotional ensemble music in South Asia, with a particular interest in tempo negotiation between lead and chorus.",
    email: "j.oconnell@seed.radhakundah.test",
    orcid: "0000-0002-9981-2210",
    photoKey: "author-oconnell",
  },
  {
    slug: "sunita-mishra",
    name: "Sunita Mishra",
    affiliation: "National Manuscript Conservation Centre",
    bio: "Paper and palm-leaf conservator. Advises regional archives on humidity control and low-intervention repair.",
    email: "s.mishra@seed.radhakundah.test",
    orcid: "0000-0001-7742-6650",
    photoKey: "author-mishra",
  },
];

export interface ResearchSeed {
  slug: string;
  title: string;
  abstract: string;
  categorySlug: string;
  /** null = draft; days before today otherwise. */
  publishedDaysAgo: number | null;
  isFeatured: boolean;
  doi: string;
  journal: string;
  volume: string;
  issue: string;
  pages: string;
  publicationYear: number;
  keywords: string[];
  tagNames: string[];
  /** [authorSlug, isCorresponding] in byline order. */
  authors: Array<[string, boolean]>;
  ogImageKey: string;
  viewCount: number;
  /** Stands in for text pulled out of the PDF; feeds full-text search only. */
  extractedText: string;
  fileLabel: string;
  filePages: number;
  fileSizeBytes: number;
}

export const researchSeed: ResearchSeed[] = [
  {
    slug: "water-management-at-radha-kunda-a-historical-survey",
    title: "Water Management at Radha Kunda: A Historical Survey, 1650–1950",
    abstract:
      "Three centuries of records — endowment deeds, revenue settlements, and repair accounts — describe a tank maintained through repeated cycles of silting, desilting, and renegotiated patronage. This survey reconstructs that maintenance history and argues that the physical form of the site is best read as the accumulated residue of its funding arrangements rather than as the product of any single building campaign.",
    categorySlug: "historical-survey",
    publishedDaysAgo: 21,
    isFeatured: true,
    doi: "10.5281/zenodo.7710001",
    journal: "Journal of South Asian Material History",
    volume: "18",
    issue: "2",
    pages: "114–147",
    publicationYear: 2024,
    keywords: ["water management", "Braj", "patronage", "endowments", "material history"],
    tagNames: ["Radha Kunda", "Architecture", "Vraja"],
    authors: [["anjali-sharma", true], ["sunita-mishra", false]],
    ogImageKey: "research-water",
    viewCount: 892,
    extractedText:
      "Water management at Radha Kunda between 1650 and 1950 is documented across endowment deeds, revenue settlements and repair accounts held in three regional archives. Desilting appears as a recurring obligation attached to specific endowments rather than as an occasional emergency measure. Repair accounts record masons, lime, and cartage in sufficient detail to reconstruct the scale of each campaign. The retaining walls show at least four distinct phases of intervention.",
    fileLabel: "Full paper (PDF)",
    filePages: 34,
    fileSizeBytes: 2_412_000,
  },
  {
    slug: "manuscript-transmission-in-the-gaudiya-tradition",
    title: "Manuscript Transmission in the Gaudiya Tradition: Evidence from Three Braj Collections",
    abstract:
      "A comparison of 214 devotional manuscripts across three Braj collections, examining paper stock, watermark evidence, scribal hands, and binding practice. The distribution suggests two distinct transmission routes rather than the single diffusion model assumed by earlier catalogues, and dates the divergence to the late eighteenth century.",
    categorySlug: "manuscript-studies",
    publishedDaysAgo: 63,
    isFeatured: true,
    doi: "10.5281/zenodo.7710002",
    journal: "Studies in Indic Codicology",
    volume: "9",
    issue: "1",
    pages: "3–58",
    publicationYear: 2023,
    keywords: ["codicology", "manuscript transmission", "watermarks", "Gaudiya", "Braj"],
    tagNames: ["Manuscripts", "Sanskrit", "Bhakti"],
    authors: [["rohan-dasgupta", true], ["sunita-mishra", false], ["anjali-sharma", false]],
    ogImageKey: "research-manuscripts",
    viewCount: 1345,
    extractedText:
      "Two hundred and fourteen manuscripts were examined across three collections. Watermark evidence separates the corpus into two paper groups with almost no overlap. Scribal hands cluster along the same division. Binding practice reinforces it. The most economical explanation is two transmission routes diverging in the late eighteenth century, rather than the single diffusion model proposed in earlier catalogues.",
    fileLabel: "Full paper (PDF)",
    filePages: 56,
    fileSizeBytes: 4_180_000,
  },
  {
    slug: "pilgrim-mobility-and-seasonal-economies-in-vraja",
    title: "Pilgrim Mobility and Seasonal Economies in Vraja",
    abstract:
      "Drawing on nine seasons of fieldwork, this paper tracks how pilgrim arrival patterns shape labour, credit, and housing markets across the Braj circuit. Seasonal peaks produce a workforce that is neither local nor migrant in the conventional sense, and existing policy categories fail to describe it.",
    categorySlug: "ethnography",
    publishedDaysAgo: 9,
    isFeatured: true,
    doi: "10.5281/zenodo.7710003",
    journal: "Contemporary South Asia Review",
    volume: "31",
    issue: "4",
    pages: "402–431",
    publicationYear: 2025,
    keywords: ["pilgrimage", "seasonal labour", "informal economy", "fieldwork", "Vraja"],
    tagNames: ["Pilgrimage", "Ethnography", "Vraja"],
    authors: [["meera-verma", true]],
    ogImageKey: "research-mobility",
    viewCount: 421,
    extractedText:
      "Nine seasons of fieldwork across the Braj circuit record arrival patterns, accommodation pricing, and short-term labour hire. Peak months draw a workforce that returns annually without settling, occupying a category between local and migrant that current policy instruments do not recognise. Credit arrangements follow the same annual rhythm.",
    fileLabel: "Full paper (PDF)",
    filePages: 30,
    fileSizeBytes: 1_960_000,
  },
  {
    slug: "sonic-practice-an-ethnography-of-kirtan-ensembles",
    title: "Sonic Practice: An Ethnography of Kirtan Ensembles",
    abstract:
      "Close analysis of forty recorded sessions shows that tempo in kirtan performance is negotiated continuously between lead and chorus rather than set by the lead alone. The paper proposes a vocabulary for describing these negotiations and tests it against sessions from four ensembles.",
    categorySlug: "ethnography",
    publishedDaysAgo: 140,
    isFeatured: false,
    doi: "10.5281/zenodo.7710004",
    journal: "Ethnomusicology Quarterly",
    volume: "47",
    issue: "3",
    pages: "221–256",
    publicationYear: 2022,
    keywords: ["kirtan", "ethnomusicology", "tempo", "performance", "call and response"],
    tagNames: ["Kirtan", "Ethnography", "Oral History"],
    authors: [["james-oconnell", true], ["meera-verma", false]],
    ogImageKey: "research-kirtan",
    viewCount: 668,
    extractedText:
      "Forty recorded sessions from four ensembles were analysed for tempo variation across call and response cycles. Acceleration originates in the chorus as often as in the lead. The paper introduces terms for anticipation, resistance, and settling, and applies them to annotated excerpts.",
    fileLabel: "Full paper (PDF)",
    filePages: 36,
    fileSizeBytes: 2_740_000,
  },
  {
    slug: "lime-mortar-in-riverbank-conservation",
    title: "Lime Mortar in Riverbank Conservation: A Working Paper",
    abstract:
      "An unpublished working paper on mortar selection for waterlogged sandstone masonry. Seeded as a draft so that draft visibility can be verified — it must not appear on any public endpoint.",
    categorySlug: "historical-survey",
    publishedDaysAgo: null,
    isFeatured: false,
    doi: "",
    journal: "",
    volume: "",
    issue: "",
    pages: "",
    publicationYear: 2026,
    keywords: ["conservation", "lime mortar", "masonry"],
    tagNames: ["Conservation", "Architecture"],
    authors: [["sunita-mishra", true]],
    ogImageKey: "research-water",
    viewCount: 0,
    extractedText:
      "Draft working paper on mortar selection for waterlogged sandstone masonry. Not for circulation.",
    fileLabel: "Working draft (PDF)",
    filePages: 12,
    fileSizeBytes: 640_000,
  },
];

// ═══════════════════════════════════════════════════════════════
// VIDEOS
// ═══════════════════════════════════════════════════════════════

/**
 * The YouTube ids are real, public videos, chosen only because their thumbnails
 * and embeds resolve — so the frontend player can actually be tested. The
 * titles and descriptions here are placeholders and do not describe them.
 */
export interface VideoSeed {
  slug: string;
  title: string;
  youtubeId: string;
  description: string;
  categorySlug: string;
  durationSec: number;
  publishedDaysAgo: number | null;
  isFeatured: boolean;
  viewCount: number;
}

export const videosSeed: VideoSeed[] = [
  {
    slug: "reading-the-ghats-a-site-walkthrough",
    title: "Reading the Ghats: A Site Walkthrough",
    youtubeId: "jNQXAC9IVRw",
    description:
      "A walking tour of the eastern steps, pointing out four phases of stonework and where each one failed.",
    categorySlug: "documentaries",
    durationSec: 1_140,
    publishedDaysAgo: 5,
    isFeatured: true,
    viewCount: 3_204,
  },
  {
    slug: "evening-kirtan-at-the-south-landing",
    title: "Evening Kirtan at the South Landing",
    youtubeId: "y6120QOlsfU",
    description: "An unedited recording of a single evening session, from first call to last response.",
    categorySlug: "kirtan",
    durationSec: 2_460,
    publishedDaysAgo: 13,
    isFeatured: true,
    viewCount: 5_781,
  },
  {
    slug: "manuscript-conservation-in-practice",
    title: "Manuscript Conservation in Practice",
    youtubeId: "dQw4w9WgXcQ",
    description:
      "Sunita Mishra demonstrates tissue repair on a torn folio and explains why less intervention is usually better.",
    categorySlug: "lectures",
    durationSec: 1_820,
    publishedDaysAgo: 24,
    isFeatured: false,
    viewCount: 1_492,
  },
  {
    slug: "interview-anjali-sharma-on-water-records",
    title: "Interview: Anjali Sharma on Water Records",
    youtubeId: "9bZkp7q19f0",
    description:
      "Forty minutes on endowment deeds, revenue settlements, and what repair accounts reveal about patronage.",
    categorySlug: "interviews",
    durationSec: 2_380,
    publishedDaysAgo: 34,
    isFeatured: false,
    viewCount: 908,
  },
  {
    slug: "kartik-lamps-a-short-film",
    title: "Kartik Lamps: A Short Film",
    youtubeId: "3JZ_D3ELwOQ",
    description: "Six minutes from a single Kartik evening, shot from the northern steps.",
    categorySlug: "documentaries",
    durationSec: 372,
    publishedDaysAgo: 48,
    isFeatured: false,
    viewCount: 12_640,
  },
  {
    slug: "seminar-transmission-routes-and-watermarks",
    title: "Seminar: Transmission Routes and Watermarks",
    youtubeId: "fJ9rUzIMcZQ",
    description:
      "Rohan Dasgupta presents the watermark evidence behind the two-route transmission argument, with questions.",
    categorySlug: "lectures",
    durationSec: 3_540,
    publishedDaysAgo: 70,
    isFeatured: false,
    viewCount: 655,
  },
  {
    slug: "unlisted-rushes-monsoon-footage",
    title: "Unlisted Rushes: Monsoon Footage",
    youtubeId: "L_jWHffIx5E",
    description:
      "Unedited rushes, seeded as a draft so that draft visibility can be verified on the video endpoints.",
    categorySlug: "documentaries",
    durationSec: 900,
    publishedDaysAgo: null,
    isFeatured: false,
    viewCount: 0,
  },
];

// ═══════════════════════════════════════════════════════════════
// GALLERY
// ═══════════════════════════════════════════════════════════════

export interface GallerySegmentSeed {
  slug: string;
  name: string;
  description: string;
  coverKey: string;
  order: number;
  isPublished: boolean;
  images: Array<{ mediaKey: string; caption: string }>;
}

export const gallerySeed: GallerySegmentSeed[] = [
  {
    slug: "kartik-parikrama",
    name: "Kartik Parikrama",
    description: "One month of evenings on the circuit, from the first lamp to the last.",
    coverKey: "gallery-kartik-cover",
    order: 0,
    isPublished: true,
    images: [
      { mediaKey: "kartik-1", caption: "The first lamps go out onto the water just after sunset." },
      { mediaKey: "kartik-2", caption: "Wind is the enemy of a clay lamp; hands are the usual solution." },
      { mediaKey: "kartik-3", caption: "Garlands arrive by the cartload and are gone within the hour." },
      { mediaKey: "kartik-4", caption: "The procession takes almost three hours to complete the circuit." },
      { mediaKey: "kartik-5", caption: "Singing continues under the canopy long after the crowd thins." },
      { mediaKey: "kartik-6", caption: "By four in the morning only the last of the oil is still burning." },
    ],
  },
  {
    slug: "aryaghat-restoration",
    name: "Aryaghat Restoration",
    description: "Eighteen months of stonework on the eastern retaining wall, documented block by block.",
    coverKey: "gallery-aryaghat-cover",
    order: 1,
    isPublished: true,
    images: [
      { mediaKey: "aryaghat-1", caption: "The eastern steps before work began, two weeks after the collapse." },
      { mediaKey: "aryaghat-2", caption: "Replacement blocks were cut locally from the same sandstone bed." },
      { mediaKey: "aryaghat-3", caption: "Lime mortar mixed on site — slower to set, kinder to the stone." },
      { mediaKey: "aryaghat-4", caption: "Survey markers along the wall, set before a single block moved." },
      { mediaKey: "aryaghat-5", caption: "The finished section. The colour will match in about a decade." },
    ],
  },
  {
    slug: "manuscript-conservation",
    name: "Manuscript Conservation",
    description: "Inside the conservation room: measuring, repairing, drying, boxing.",
    coverKey: "gallery-conservation-cover",
    order: 2,
    isPublished: true,
    images: [
      { mediaKey: "conservation-1", caption: "Every folio is measured against a reference scale before handling." },
      { mediaKey: "conservation-2", caption: "Tears are closed with tissue and wheat starch paste — both reversible." },
      { mediaKey: "conservation-3", caption: "Cleaned folios dry flat under weights for a minimum of two days." },
      { mediaKey: "conservation-4", caption: "Boxed, labelled, and back on the shelf with a revised finding aid." },
    ],
  },
  {
    slug: "monsoon-drafts",
    name: "Monsoon Drafts",
    description:
      "Unpublished segment, seeded so that the isPublished filter can be verified on the gallery endpoints.",
    coverKey: "gallery-monsoon-cover",
    order: 3,
    isPublished: false,
    images: [
      { mediaKey: "monsoon-1", caption: "Water over the lower steps by the second week of rain." },
      { mediaKey: "monsoon-2", caption: "The approach lane, briefly a canal." },
      { mediaKey: "monsoon-3", caption: "Clouds breaking, an hour before they closed again." },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// HOMEPAGE HERO
// ═══════════════════════════════════════════════════════════════

export interface HeroSeed {
  title: string;
  subtitle: string;
  imageKey: string;
  ctaLabel: string;
  ctaUrl: string;
  order: number;
  isActive: boolean;
}

export const heroSeed: HeroSeed[] = [
  {
    title: "Radha Kunda, before the day begins",
    subtitle: "Field guides, research, and a photographic record of a site under constant repair.",
    imageKey: "hero-kunda-dawn",
    ctaLabel: "Start with the field guide",
    ctaUrl: "/articles/walking-the-parikrama-a-field-guide",
    order: 0,
    isActive: true,
  },
  {
    title: "A month of lamps",
    subtitle: "Kartik at the kunda, photographed across four seasons of the festival.",
    imageKey: "hero-kartik-lamps",
    ctaLabel: "View the gallery",
    ctaUrl: "/gallery/kartik-parikrama",
    order: 1,
    isActive: true,
  },
  {
    title: "Four hundred folios, one box",
    subtitle: "Cataloguing, conservation, and the manuscripts that turn out to be two manuscripts.",
    imageKey: "hero-manuscript-table",
    ctaLabel: "Read the research",
    ctaUrl: "/research/manuscript-transmission-in-the-gaudiya-tradition",
    order: 2,
    isActive: true,
  },
  {
    title: "Monsoon (inactive slide)",
    subtitle: "Seeded inactive so the isActive filter on /public/hero can be verified.",
    imageKey: "hero-monsoon-ghats",
    ctaLabel: "",
    ctaUrl: "",
    order: 3,
    isActive: false,
  },
];

// ═══════════════════════════════════════════════════════════════
// SITE CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export const settingsSeed: Record<string, unknown> = {
  "site.title": "Radhakundah",
  "site.description": "Research publications, articles, and a multimedia record of Radha Kunda and Vraja.",
  "site.logo": "", // filled in by the seeder with the seeded logo media URL
  "seo.defaultOgImage": "", // filled in by the seeder
  "contact.email": "contact@radhakundah.test",
  "contact.phone": "+91 11 4000 0000",
  "contact.address": "Radhakundah Research Trust, Aryaghat Road, Mathura District, Uttar Pradesh 281504",
  "contact.mapEmbed": "https://www.openstreetmap.org/export/embed.html?bbox=77.48%2C27.52%2C77.52%2C27.55",
  "social.twitter": "https://twitter.com/radhakundah",
  "social.facebook": "https://facebook.com/radhakundah",
  "social.linkedin": "https://linkedin.com/company/radhakundah",
  "social.instagram": "https://instagram.com/radhakundah",
  "analytics.ga4": "",
};

export const aboutPageSeed = {
  key: "about",
  title: "About Us",
  metaTitle: "About the Radhakundah Research Trust",
  metaDescription:
    "Who we are, what we work on, and how the research, conservation, and photographic programmes fit together.",
  sections: {
    about:
      "The Radhakundah Research Trust documents a single site and the tradition that maintains it. We publish peer-reviewed research, keep a photographic record of conservation work, and run a manuscript digitisation programme out of a small archive on the Aryaghat road.",
    mission:
      "To record what is here accurately, publish it openly, and make sure the record outlasts the people keeping it.",
    vision:
      "A complete, freely available account of the site — textual, architectural, and musical — that scholars and practitioners both recognise as their own.",
    objectives: [
      "Digitise the full manuscript collection at archival quality by 2030.",
      "Publish conservation records for every intervention on the ghats, including the failures.",
      "Maintain an open photographic archive of the annual festival cycle.",
      "Support fieldwork by scholars without institutional funding.",
    ],
    team: [
      {
        name: "Anjali Sharma",
        role: "Director of Research",
        bio: "Historian of water infrastructure and land records in early modern Braj.",
      },
      {
        name: "Sunita Mishra",
        role: "Head of Conservation",
        bio: "Paper and palm-leaf conservator; advises regional archives on low-intervention repair.",
      },
      {
        name: "Rohan Dasgupta",
        role: "Archive Lead",
        bio: "Codicologist responsible for the cataloguing and digitisation programme.",
      },
      {
        name: "Meera Verma",
        role: "Field Programme Lead",
        bio: "Ethnographer working on pilgrimage economies across the Braj circuit.",
      },
    ],
    journey: [
      { year: "2014", title: "Founded", description: "Established as a small archive with a single reading room." },
      { year: "2018", title: "First conservation season", description: "Survey work began on the eastern ghats." },
      { year: "2021", title: "Research programme", description: "First peer-reviewed papers published under the trust." },
      { year: "2024", title: "Digitisation begins", description: "Two imaging rigs installed; 12,000 folios captured in year one." },
      { year: "2026", title: "Open archive", description: "Public catalogue and image archive brought online." },
    ],
    contact:
      "Write to us at contact@radhakundah.test. Research enquiries and requests to consult the archive are answered within a week; visits need two weeks' notice.",
  },
};

// ═══════════════════════════════════════════════════════════════
// ENGAGEMENT, INBOX, AND OPERATIONS
// ═══════════════════════════════════════════════════════════════

/** Signed-in members, so comments and likes have somewhere to hang. */
export const memberUsersSeed = [
  { email: `priya.nair${SEED_USER_EMAIL_DOMAIN}`, name: "Priya Nair" },
  { email: `daniel.fischer${SEED_USER_EMAIL_DOMAIN}`, name: "Daniel Fischer" },
  { email: `arjun.rao${SEED_USER_EMAIL_DOMAIN}`, name: "Arjun Rao" },
];

export interface CommentSeed {
  postSlug: string;
  memberIndex: number;
  body: string;
  isHidden: boolean;
  daysAgo: number;
}

export const commentsSeed: CommentSeed[] = [
  {
    postSlug: "walking-the-parikrama-a-field-guide",
    memberIndex: 0,
    body: "The note about footwear is the most useful thing I have read about this walk. Three hundred metres of shared road is exactly right.",
    isHidden: false,
    daysAgo: 3,
  },
  {
    postSlug: "walking-the-parikrama-a-field-guide",
    memberIndex: 1,
    body: "Did the circuit last November and it took closer to four hours in the evening. Worth saying the two-hour figure is a dry-season number.",
    isHidden: false,
    daysAgo: 2,
  },
  {
    postSlug: "walking-the-parikrama-a-field-guide",
    memberIndex: 2,
    body: "Seeded as a hidden comment so moderation can be tested — it must not appear on /public/comments.",
    isHidden: true,
    daysAgo: 1,
  },
  {
    postSlug: "the-ghats-of-aryaghat-restoration-notes",
    memberIndex: 2,
    body: "Four months to win the lime argument sounds fast, honestly. Glad it went that way.",
    isHidden: false,
    daysAgo: 4,
  },
  {
    postSlug: "kartik-at-radha-kunda-what-to-expect",
    memberIndex: 0,
    body: "Second the point about booking early. Two months ahead was already tight last year.",
    isHidden: false,
    daysAgo: 20,
  },
  {
    postSlug: "what-the-manjari-tradition-teaches-about-attention",
    memberIndex: 1,
    body: "The framing of abstraction as a failure mode is going to stay with me.",
    isHidden: false,
    daysAgo: 8,
  },
];

/** [postSlug, memberIndex] */
export const likesSeed: Array<[string, number]> = [
  ["walking-the-parikrama-a-field-guide", 0],
  ["walking-the-parikrama-a-field-guide", 1],
  ["walking-the-parikrama-a-field-guide", 2],
  ["what-the-manjari-tradition-teaches-about-attention", 0],
  ["what-the-manjari-tradition-teaches-about-attention", 2],
  ["the-ghats-of-aryaghat-restoration-notes", 1],
  ["kartik-at-radha-kunda-what-to-expect", 0],
  ["kartik-at-radha-kunda-what-to-expect", 1],
  ["notes-from-the-archive-cataloguing-400-folios", 2],
];

export interface ContactMessageSeed {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  isRead: boolean;
  daysAgo: number;
}

export const contactMessagesSeed: ContactMessageSeed[] = [
  {
    name: "Ravi Menon",
    email: "ravi.menon@example.com",
    phone: "+91 98200 11223",
    subject: "Archive visit in March",
    message:
      "I am completing a dissertation on tank endowments and would like to consult the repair accounts. Would a two-day visit in the first week of March be possible?",
    isRead: false,
    daysAgo: 1,
  },
  {
    name: "Helen Whitmore",
    email: "h.whitmore@example.com",
    phone: "",
    subject: "Image licensing",
    message:
      "We would like to use two of the Kartik photographs in a museum panel. What are your terms for print use?",
    isRead: false,
    daysAgo: 3,
  },
  {
    name: "Anonymous",
    email: "someone@example.com",
    phone: "",
    subject: "",
    message: "Is the parikrama path accessible with a wheelchair for any part of the route?",
    isRead: true,
    daysAgo: 9,
  },
  {
    name: "Sanjay Gupta",
    email: "sanjay.gupta@example.com",
    phone: "+91 99100 44556",
    subject: "Volunteering",
    message:
      "I am a retired civil engineer living in Mathura and would be glad to help with survey work on a voluntary basis.",
    isRead: true,
    daysAgo: 16,
  },
  {
    name: "Clara Ibáñez",
    email: "c.ibanez@example.com",
    phone: "",
    subject: "Broken link in the sitemap",
    message: "The link to the 2023 codicology paper returns a 404 from your sitemap. Thought you would want to know.",
    isRead: true,
    daysAgo: 30,
  },
];

export const subscribersSeed = [
  { email: "reader.one@example.com", isActive: true, daysAgo: 2 },
  { email: "reader.two@example.com", isActive: true, daysAgo: 14 },
  { email: "reader.three@example.com", isActive: true, daysAgo: 45 },
  { email: "reader.four@example.com", isActive: true, daysAgo: 91 },
  { email: "unsubscribed.reader@example.com", isActive: false, daysAgo: 120 },
];

/**
 * `fromPath` values point at slugs that no longer exist, which is what a real
 * auto-redirect looks like after a rename. The BOTH-placement rule mirrors what
 * the platform writes for posts published under both sections.
 */
export const redirectsSeed = [
  { fromPath: "/articles/parikrama-guide", toPath: "/articles/walking-the-parikrama-a-field-guide", statusCode: 301, isAuto: true },
  { fromPath: "/blogs/aryaghat-restoration-notes", toPath: "/articles/the-ghats-of-aryaghat-restoration-notes", statusCode: 301, isAuto: true },
  { fromPath: "/research/water-management-survey", toPath: "/research/water-management-at-radha-kunda-a-historical-survey", statusCode: 301, isAuto: false },
];

/** Recent activity for the admin dashboard's audit view. */
export const auditLogSeed = [
  { action: "post.publish", entityType: "post", entitySlug: "notes-from-the-archive-cataloguing-400-folios", hoursAgo: 3 },
  { action: "research.publish", entityType: "research", entitySlug: "pilgrim-mobility-and-seasonal-economies-in-vraja", hoursAgo: 26 },
  { action: "gallery.segment.create", entityType: "gallerySegment", entitySlug: "manuscript-conservation", hoursAgo: 52 },
  { action: "media.upload", entityType: "media", entitySlug: "kartik-6", hoursAgo: 74 },
  { action: "settings.update", entityType: "setting", entitySlug: "site.description", hoursAgo: 96 },
  { action: "user.login", entityType: "user", entitySlug: "super-admin", hoursAgo: 120 },
];
