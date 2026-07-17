import { Command } from "commander";
import { PostNitroClient } from "../lib/client.js";
import { resolveApiKey } from "../lib/config-store.js";
import { printResult, action } from "../lib/output.js";
import { readJsonFile } from "../lib/json-file.js";
import type { BrandInput } from "../lib/types.js";

function getClient(cmd: Command): Promise<PostNitroClient> {
  const opts = cmd.optsWithGlobals();
  return resolveApiKey(opts.apiKey).then((apiKey) => new PostNitroClient(apiKey));
}

/**
 * Builds a BrandInput from a full brand object (--data inline JSON, then --file), or from
 * --name/--handle/--image + boolean flags. --data wins over --file, which wins over the flags.
 */
async function resolveBrandInput(opts: Record<string, any>): Promise<BrandInput> {
  let brand: Partial<BrandInput> | undefined;
  if (opts.data !== undefined) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(opts.data);
    } catch (e) {
      throw new Error(`--data must be valid JSON: ${(e as Error).message}`);
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("--data must be a JSON object.");
    }
    brand = parsed as Partial<BrandInput>;
  } else if (opts.file) {
    brand = await readJsonFile<Partial<BrandInput>>(opts.file);
  }

  if (brand) {
    if (!brand.name || !brand.handle || !brand.image) {
      throw new Error("Brand JSON must include at least name, handle, and image.");
    }
    return {
      name: brand.name,
      handle: brand.handle,
      image: brand.image,
      isCompanyDetail: brand.isCompanyDetail ?? false,
      showName: brand.showName ?? true,
      showHandle: brand.showHandle ?? true,
      showImage: brand.showImage ?? true,
    };
  }

  if (!opts.name || !opts.handle || !opts.image) {
    throw new Error("Provide --name, --handle, and --image (or --data '<json>' / --file <path> with a brand object).");
  }

  return {
    name: opts.name,
    handle: opts.handle,
    image: opts.image,
    isCompanyDetail: !!opts.companyDetail,
    showName: opts.showName,
    showHandle: opts.showHandle,
    showImage: opts.showImage,
  };
}

function addBrandInputOptions(cmd: Command): Command {
  return cmd
    .option("--file <path>", "Path to a JSON file with the full brand object (overridden by --data)")
    .option(
      "--data <json>",
      "Full brand object as inline JSON, e.g. '{\"name\":\"...\",\"handle\":\"@...\",\"image\":\"https://...\"}' (overrides --file and the brand flags)"
    )
    .option("--name <name>", "Brand display name")
    .option("--handle <handle>", "Social handle, e.g. '@postnitroai'")
    .option("--image <url>", "Logo image URL")
    .option("--company-detail", "Treat as a company brand (vs personal)", false)
    .option("--no-show-name", "Do not render the name on slides")
    .option("--no-show-handle", "Do not render the handle on slides")
    .option("--no-show-image", "Do not render the logo on slides");
}

export function registerBrandCommands(program: Command): void {
  const brand = program.command("brand").description("Manage brand kits (logo, name, handle stamped on carousels)");

  brand
    .command("list")
    .description("List available brand configurations")
    .option("--page <n>", "Page number", "1")
    .option("--limit <n>", "Results per page (max 50)", "10")
    .action(
      action(async (opts, cmd: Command) => {
        const client = await getClient(cmd);
        const response = await client.listBrands(Number(opts.page), Number(opts.limit));
        const brands = response.data.brands;
        printResult({
          count: brands.length,
          brands: brands.map((b) => ({ id: b.id, name: b.name, handle: b.handle, isCompanyDetail: b.isCompanyDetail })),
          page: Number(opts.page),
          limit: Number(opts.limit),
        });
      })
    );

  brand
    .command("get <id>")
    .description("Fetch a single brand kit by ID")
    .action(
      action(async (id: string, _opts, cmd: Command) => {
        const client = await getClient(cmd);
        const response = await client.getBrand(id);
        printResult({ brand: response.data.brand });
      })
    );

  addBrandInputOptions(
    brand
      .command("create")
      .description("Create a new brand kit. Required: --name, --handle, --image (or --file)")
  ).action(
    action(async (opts, cmd: Command) => {
      const client = await getClient(cmd);
      const input = await resolveBrandInput(opts);
      const response = await client.createBrand(input);
      printResult({ success: true, message: "Brand created.", brand: response.data.brand });
    })
  );

  addBrandInputOptions(
    brand
      .command("update <id>")
      .description("Update an existing brand kit. All fields are required by the API — fetch current values with `brand get` first")
  ).action(
    action(async (id: string, opts, cmd: Command) => {
      const client = await getClient(cmd);
      const input = await resolveBrandInput(opts);
      const response = await client.updateBrand(id, input);
      printResult({ success: true, message: "Brand updated.", brand: response.data.brand });
    })
  );
}
