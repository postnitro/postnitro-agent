export interface PostNitroApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface InitiateResponseData {
  embedPostId: string;
  status: "PENDING";
}

export interface AiGenerationConfig {
  type: "text" | "article" | "x";
  context: string;
  instructions?: string;
}

/** Post kind. Must be sent uppercase — the API rejects lowercase values. */
export type PostType = "CAROUSEL" | "IMAGE" | "VIDEO";

/**
 * Output format. `DESIGN` skips rendering (no PDF/PNG/MP4 artifact) and just creates
 * the editable design — faster/lighter for scheduling and editor-based flows.
 * `MP4` is VIDEO-only, and VIDEO accepts nothing but `MP4` or `DESIGN`.
 */
export type ResponseType = "PDF" | "PNG" | "DESIGN" | "MP4";

/** The two formats a VIDEO post can be produced as. */
export type VideoResponseType = "MP4" | "DESIGN";

/**
 * What may be stored as a saved default. MP4 is excluded deliberately: it only
 * applies to VIDEO posts, so saving it would break every carousel and image
 * call. The video commands take it per call instead — which is also why the
 * resolvers never have to handle a saved MP4.
 */
export type SavedResponseType = Exclude<ResponseType, "MP4">;

/**
 * Render settings for a VIDEO post. Required when the response type is `MP4`
 * (a render needs a length), optional for `DESIGN`, rejected for other post types.
 *
 * Same shape as a scheduled reel's `postSettings` — the API reuses a video's own
 * settings when it's scheduled as a reel.
 */
export interface VideoSettings {
  /** Seconds. At least 5 and under 60. */
  videoDuration: number;
  /** Media id of an audio track — an id, not a URL. From `postnitro audio list`. */
  audioId?: string;
}

export type ImagePlacement = "auto" | "background" | "in-line";
export type ImageStrategy = "strategic" | "all";

/**
 * Opt-in AI image generation. Sending this object enables it (best-effort);
 * omit it entirely to leave images off. Only these three fields are accepted —
 * `editorType`, image model, and copy config are resolved server-side.
 */
export interface GenerateImagesConfig {
  /** Topic/brief guiding the image prompts. On generate, falls back to `aiGeneration.context`. */
  context?: string;
  /** `auto` (AI decides per slide), `background`, or `in-line`. Default `auto`. */
  imagePlacement?: ImagePlacement;
  /** `strategic` (~50% of slides) or `all` (every eligible slide). Default `strategic`. */
  imageStrategy?: ImageStrategy;
}

export interface GenerateRequest {
  postType: PostType;
  requestorId?: string;
  templateId: string;
  brandId: string;
  presetId: string;
  responseType?: ResponseType;
  aiGeneration: AiGenerationConfig;
  generateImages?: GenerateImagesConfig;
  /** VIDEO posts only. */
  videoSettings?: VideoSettings;
}

export interface Slide {
  type: "starting_slide" | "body_slide" | "ending_slide";
  heading: string;
  sub_heading?: string;
  description?: string;
  image?: string;
  background_image?: string;
  cta_button?: string;
  layoutType?: "default" | "infographic";
  layoutConfig?: InfographicLayoutConfig;
}

export interface InfographicLayoutConfig {
  hasHeader?: boolean;
  columnCount?: 1 | 2 | 3;
  displayCounterAs?: "none" | "counter";
  columnDisplay?: "cycle" | "grid";
  columnData?: InfographicColumnData[];
}

export interface InfographicColumnData {
  /** Caller-provided and required — the API stores it as-is (not auto-generated). */
  id: string;
  header: string;
  content: InfographicContentItem[];
}

export interface InfographicContentItem {
  /** Caller-provided and required — the API stores it as-is (not auto-generated). */
  id: string;
  title: string;
  /** HTML string, e.g. `<p dir="ltr">Description</p>`. */
  description: string;
  icon?: string | null;
  titleEnabled?: boolean;
  descriptionEnabled?: boolean;
}

/**
 * A single IMAGE slide. Restricted field set — the API returns a 422 for any
 * field outside this list (notably `type` is NOT allowed). `layoutType`/`layoutConfig`
 * ARE allowed, for the infographic layout.
 */
export interface ImageSlide {
  heading: string;
  sub_heading?: string;
  description?: string;
  cta_button?: string;
  image?: string;
  background_image?: string;
  layoutType?: "default" | "infographic";
  layoutConfig?: InfographicLayoutConfig;
}

export interface ImportCarouselRequest {
  postType: "CAROUSEL";
  requestorId?: string;
  templateId: string;
  brandId: string;
  responseType?: ResponseType;
  /** CAROUSEL takes an array of typed slides (1 starting, ≥1 body, 1 ending). */
  slides: Slide[];
  generateImages?: GenerateImagesConfig;
}

/**
 * VIDEO shares the carousel import shape — an array of typed slides, one per
 * scene — plus `videoSettings` for the render.
 */
export interface ImportVideoRequest {
  postType: "VIDEO";
  requestorId?: string;
  templateId: string;
  brandId: string;
  responseType?: ResponseType;
  slides: Slide[];
  generateImages?: GenerateImagesConfig;
  videoSettings?: VideoSettings;
}

export interface ImportImageRequest {
  postType: "IMAGE";
  requestorId?: string;
  templateId: string;
  brandId: string;
  responseType?: ResponseType;
  /** IMAGE takes a single slide object (not an array). */
  slides: ImageSlide;
  generateImages?: GenerateImagesConfig;
}

/** Shape is strictly enforced per `postType`: array for CAROUSEL/VIDEO, object for IMAGE. */
export type ImportRequest = ImportCarouselRequest | ImportVideoRequest | ImportImageRequest;

export interface PostStatusData {
  embedPostId: string;
  embedPost: {
    id: string;
    postType: string;
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
    createdAt: string;
    updatedAt: string;
  };
  logs: Array<{
    id: string;
    embedPostId: string;
    step: string;
    status: string;
    message: string;
    timestamp: string;
  }>;
}

export interface PostOutputData {
  embedPost: {
    id: string;
    postType: string;
    responseType: ResponseType;
    status: string;
    credits: number;
    createdAt: string;
    updatedAt: string;
  };
  result: {
    designId?: string;
    name: string;
    size: { id: string; dimensions: { width: number; height: number } };
    /** Deep link to open the design in the editor. Null if it can't be resolved. Present for all response types. */
    editorUrl?: string | null;
    // Rendered-artifact fields — present for PDF, PNG, and MP4. DESIGN omits them.
    type?: string;
    mimeType?: string;
    /** A single URL for PDF and MP4 (one artifact each); one URL per slide for PNG. */
    data?: string | string[];
  };
}

export interface TemplateItem {
  id: string;
  name: string;
  size: { id: string; dimensions: { width: number; height: number } };
}

export interface BrandItem {
  id: string;
  name: string;
  image: string;
  handle: string;
  isCompanyDetail: boolean;
  showHandle: boolean;
  showImage: boolean;
  showName: boolean;
}

export interface PresetItem {
  id: string;
  socialPlatform: string;
  tone: string;
  audience: string;
  language: string;
  slides: number;
  model: string;
}

// ============================================================
// Brands
// ============================================================

export interface BrandInput {
  name: string;
  handle: string;
  image: string;
  isCompanyDetail: boolean;
  showName: boolean;
  showHandle: boolean;
  showImage: boolean;
}

// ============================================================
// Audio
// ============================================================

/**
 * An audio file in the workspace. Uploaded in the PostNitro app — the API only
 * lists and deletes. `id` is what `videoSettings.audioId` (video posts) and
 * `postSettings.audioId` (reels) expect.
 */
export interface AudioItem {
  id: string;
  name: string;
  url: string;
  /** Track length in seconds, when the uploader recorded one. */
  duration: number | null;
  artistName: string | null;
  source: string;
  createdAt: string;
}

// ============================================================
// Social accounts
// ============================================================

export type SocialPlatform = "linkedin" | "instagram" | "tiktok" | "threads";

export interface SocialAccountSummary {
  id: string;
  platformType: string;
  accountHandle: string;
  accountType?: string;
  accountName: string;
  accountLogo: string;
  accessTokenStatus: string;
}

export interface SocialAccountsData {
  socialAccounts: Record<SocialPlatform, SocialAccountSummary[]>;
}

export interface SocialAccountDetail {
  id: string;
  organizationId: string;
  workspaceId: string;
  platformType: string;
  accountHandle: string;
  accountName: string;
  accountLogo: string;
  accessTokenStatus: string;
  tokenExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SocialAccountDetailData {
  socialAccount: SocialAccountDetail;
  usage: Array<{ status: string; _count: number }>;
}

// ============================================================
// Scheduling
// ============================================================

export type ScheduleStatus = "DRAFT" | "SCHEDULED";

export interface SchedulePostContent {
  common?: string;
  linkedin?: string;
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  threads?: string;
}

export interface InstagramPostSettings {
  postType: "carousel" | "image" | "reel";
  postAsStory: boolean;
}

export interface TiktokPostSettings {
  postType: "carousel" | "reel";
  privacyLevel?: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY";
  canComment: boolean;
  canDuet?: boolean;
  canStitch?: boolean;
  autoAddMusic?: boolean;
  postTitle?: string | null;
  isBrandedContent: boolean;
  isYourBrand: boolean;
  isThirdPartyBrand: boolean;
  isAIGeneratedContent: boolean;
}

export interface LinkedinPostSettings {
  postType: "carousel" | "document" | "image" | "reel";
  postTitle?: string | null;
}

export interface ThreadsPostSettings {
  postType: "carousel" | "image" | "reel";
}

/**
 * A scheduled reel's video render settings — the same shape as a VIDEO post's
 * {@link VideoSettings}. Optional: when omitted, the API fills each field from the
 * settings the attached design was generated with, then from 30 seconds / no audio.
 */
export interface ReelPostSettings {
  videoDuration: number;
  audioId?: string;
}

export interface ScheduledPostRequest {
  status: ScheduleStatus;
  scheduledAt: string;
  designId?: string | null;
  postContent?: SchedulePostContent;
  selectedAccounts?: string[];
  instagramPostSettings?: InstagramPostSettings;
  tiktokPostSettings?: TiktokPostSettings;
  linkedinPostSettings?: LinkedinPostSettings;
  threadsPostSettings?: ThreadsPostSettings;
  postSettings?: ReelPostSettings;
}

export interface ScheduledPost {
  id: string;
  designId: string | null;
  labels: string[] | null;
  status: ScheduleStatus;
  scheduledFor: string;
  publishedAt: string | null;
  errorMessage: string | null;
  postSettings: ReelPostSettings | null;
  instagramPostSettings: InstagramPostSettings | null;
  linkedinPostSettings: LinkedinPostSettings | null;
  tiktokPostSettings: TiktokPostSettings | null;
  threadsPostSettings: ThreadsPostSettings | null;
  postContents: Array<{ platform: string; text: string; hashtags: string[] }>;
  designDetails: {
    id: string;
    name: string;
    designType: string;
    source: string;
  } | null;
  socialAccounts: Array<{
    socialAccountId: string;
    liveLink: string | null;
    errorMessage: string | null;
    status: string;
    publishedAt: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}
