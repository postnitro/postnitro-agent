import type {
  PostNitroApiResponse,
  GenerateRequest,
  ImportRequest,
  InitiateResponseData,
  PostStatusData,
  PostOutputData,
  TemplateItem,
  BrandItem,
  BrandInput,
  PresetItem,
  AudioItem,
  SocialAccountsData,
  SocialAccountDetailData,
  ScheduledPostRequest,
  ScheduledPost,
} from "./types.js";

const BASE_URL = "https://embed-api.postnitro.ai";

export class PostNitroApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody?: string
  ) {
    super(message);
    this.name = "PostNitroApiError";
  }
}

export class PostNitroClient {
  constructor(private apiKey: string) {}

  private async request<T>(
    path: string,
    options: { method: "GET" | "POST" | "PUT" | "DELETE"; body?: Record<string, unknown> }
  ): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const headers: Record<string, string> = { "embed-api-key": this.apiKey };

    if (options.body) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new PostNitroApiError(
        `PostNitro API error (${response.status}): ${responseText}`,
        response.status,
        responseText
      );
    }

    try {
      return JSON.parse(responseText) as T;
    } catch {
      throw new PostNitroApiError(
        `Failed to parse PostNitro API response: ${responseText}`,
        response.status,
        responseText
      );
    }
  }

  // ============================================================
  // Carousel creation
  // ============================================================

  initiateGenerate(request: GenerateRequest): Promise<PostNitroApiResponse<InitiateResponseData>> {
    return this.request("/post/initiate/generate", { method: "POST", body: request as unknown as Record<string, unknown> });
  }

  initiateImport(request: ImportRequest): Promise<PostNitroApiResponse<InitiateResponseData>> {
    return this.request("/post/initiate/import", { method: "POST", body: request as unknown as Record<string, unknown> });
  }

  // ============================================================
  // Status & output
  // ============================================================

  getPostStatus(embedPostId: string): Promise<PostNitroApiResponse<PostStatusData>> {
    return this.request(`/post/status/${embedPostId}`, { method: "GET" });
  }

  getPostOutput(embedPostId: string): Promise<PostNitroApiResponse<PostOutputData>> {
    return this.request(`/post/output/${embedPostId}`, { method: "GET" });
  }

  // ============================================================
  // List endpoints
  // ============================================================

  listTemplates(page = 1, limit = 10): Promise<PostNitroApiResponse<{ templates: TemplateItem[] }>> {
    return this.request(`/template?page=${page}&limit=${limit}`, { method: "GET" });
  }

  listBrands(page = 1, limit = 10): Promise<PostNitroApiResponse<{ brands: BrandItem[] }>> {
    return this.request(`/brand?page=${page}&limit=${limit}`, { method: "GET" });
  }

  listAiPresets(page = 1, limit = 10): Promise<PostNitroApiResponse<{ presets: PresetItem[] }>> {
    return this.request(`/ai-preset?page=${page}&limit=${limit}`, { method: "GET" });
  }

  // ============================================================
  // Brands (create / read / update)
  // ============================================================

  createBrand(brand: BrandInput): Promise<PostNitroApiResponse<{ brand: BrandItem }>> {
    return this.request("/brand", { method: "POST", body: brand as unknown as Record<string, unknown> });
  }

  getBrand(brandId: string): Promise<PostNitroApiResponse<{ brand: BrandItem }>> {
    return this.request(`/brand/${brandId}`, { method: "GET" });
  }

  updateBrand(brandId: string, brand: BrandInput): Promise<PostNitroApiResponse<{ brand: BrandItem }>> {
    return this.request(`/brand/${brandId}`, { method: "PUT", body: brand as unknown as Record<string, unknown> });
  }

  // ============================================================
  // Audio
  // ============================================================

  listAudios(page = 1, limit = 10): Promise<PostNitroApiResponse<{ audios: AudioItem[] }>> {
    return this.request(`/audio?page=${page}&limit=${limit}`, { method: "GET" });
  }

  deleteAudio(audioId: string): Promise<PostNitroApiResponse<unknown>> {
    return this.request(`/audio/${audioId}`, { method: "DELETE" });
  }

  // ============================================================
  // Social accounts
  // ============================================================

  listSocialAccounts(): Promise<PostNitroApiResponse<SocialAccountsData>> {
    return this.request("/social-account", { method: "GET" });
  }

  getSocialAccount(socialAccountId: string): Promise<PostNitroApiResponse<SocialAccountDetailData>> {
    return this.request(`/social-account/${socialAccountId}`, { method: "GET" });
  }

  disconnectSocialAccount(socialAccountId: string): Promise<PostNitroApiResponse<unknown>> {
    return this.request(`/social-account/${socialAccountId}`, { method: "DELETE" });
  }

  // ============================================================
  // Scheduling
  // ============================================================

  /**
   * `socialAccountIds` filters the posts, not the accounts inside them: a post is
   * returned when it targets at least one of the ids, and it still reports every
   * account it targets. The API takes them comma-separated; omitted means no filter.
   */
  listScheduledPosts(
    fromDate: string,
    toDate: string,
    socialAccountIds?: string[]
  ): Promise<PostNitroApiResponse<ScheduledPost[]>> {
    const query = new URLSearchParams({ fromDate, toDate });
    if (socialAccountIds && socialAccountIds.length > 0) {
      query.set("socialAccountIds", socialAccountIds.join(","));
    }
    return this.request(`/schedule?${query.toString()}`, { method: "GET" });
  }

  createScheduledPost(request: ScheduledPostRequest): Promise<PostNitroApiResponse<ScheduledPost>> {
    return this.request("/schedule", { method: "POST", body: request as unknown as Record<string, unknown> });
  }

  getScheduledPost(scheduledPostId: string): Promise<PostNitroApiResponse<ScheduledPost>> {
    return this.request(`/schedule/${scheduledPostId}`, { method: "GET" });
  }

  updateScheduledPost(scheduledPostId: string, request: ScheduledPostRequest): Promise<PostNitroApiResponse<ScheduledPost>> {
    return this.request(`/schedule/${scheduledPostId}`, { method: "PUT", body: request as unknown as Record<string, unknown> });
  }

  deleteScheduledPost(scheduledPostId: string): Promise<PostNitroApiResponse<{ message: string }>> {
    return this.request(`/schedule/${scheduledPostId}`, { method: "DELETE" });
  }

  // ============================================================
  // Polling helper
  // ============================================================

  async pollUntilComplete(
    embedPostId: string,
    options: { maxAttempts?: number; intervalMs?: number } = {}
  ): Promise<PostNitroApiResponse<PostStatusData>> {
    const maxAttempts = options.maxAttempts ?? 60;
    const intervalMs = options.intervalMs ?? 3000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const statusResponse = await this.getPostStatus(embedPostId);
      const status = statusResponse.data.embedPost.status;

      if (status === "COMPLETED") return statusResponse;

      if (status === "FAILED") {
        const lastLog = statusResponse.data.logs[statusResponse.data.logs.length - 1];
        throw new PostNitroApiError(`Post generation failed: ${lastLog?.message ?? "Unknown error"}`, 500);
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new PostNitroApiError(
      `Post generation timed out after ${(maxAttempts * intervalMs) / 1000}s. ` +
        `Use "postnitro <carousel|image|video> status ${embedPostId}" — whichever matches the post — to check later.`,
      408
    );
  }
}

/** Extracts the design ID a completed carousel's output must be scheduled with (NOT the generation embedPostId). */
export function extractDesignId(output: PostOutputData): string | undefined {
  if (output.result.designId) return output.result.designId;
  const url = Array.isArray(output.result.data) ? output.result.data[0] : output.result.data;
  if (typeof url === "string") {
    const match = url.match(/\/embed-api\/[^/]+\/([^/]+)\/[^/]+$/);
    if (match) return match[1];
  }
  return undefined;
}
