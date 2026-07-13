#!/usr/bin/env node

import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerDefaultsCommands } from "./commands/defaults.js";
import { registerTemplateCommands } from "./commands/template.js";
import { registerBrandCommands } from "./commands/brand.js";
import { registerPresetCommands } from "./commands/preset.js";
import { registerCarouselCommands } from "./commands/carousel.js";
import { registerImageCommands } from "./commands/image.js";
import { registerSocialCommands } from "./commands/social.js";
import { registerScheduleCommands } from "./commands/schedule.js";
import { registerGenerateAndScheduleCommand } from "./commands/generate-and-schedule.js";

const program = new Command();

program
  .name("postnitro")
  .description(
    "CLI for AI agents and scripts to generate and manage PostNitro content (carousels, brands, scheduling) via the PostNitro Embed API.\n\n" +
      "Every command prints JSON on success (stdout, exit 0) or JSON on failure (stderr, exit 1) — safe to pipe and parse."
  )
  .version("1.1.0")
  .option("--api-key <key>", "PostNitro API key (falls back to POSTNITRO_API_KEY env var, then saved config)")
  .option("--base-url <url>", "Override the PostNitro API base URL (falls back to POSTNITRO_API_BASE_URL env var)");

registerAuthCommands(program);
registerDefaultsCommands(program);
registerTemplateCommands(program);
registerBrandCommands(program);
registerPresetCommands(program);
registerCarouselCommands(program);
registerImageCommands(program);
registerSocialCommands(program);
registerScheduleCommands(program);
registerGenerateAndScheduleCommand(program);

program.parseAsync(process.argv);
