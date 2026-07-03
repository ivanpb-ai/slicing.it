#!/usr/bin/env node
/**
 * pptx-to-html — Convert a NorthStar PowerPoint slide into an interactive
 * Telia-branded HTML page with corpus-sourced explanations.
 *
 * Usage:
 *   node cli.mjs input.pptx                        # all slides
 *   node cli.mjs input.pptx --slide 3              # single slide
 *   node cli.mjs input.pptx -o output.html         # custom output path
 *   node cli.mjs input.pptx --no-enrich            # skip NorthStar API
 *   node cli.mjs input.pptx --dry-run              # print parsed structure
 *   node cli.mjs input.pptx --descriptions desc.json  # use pre-built descriptions
 *
 * Environment:
 *   API_URL   override the NorthStar API endpoint
 */

import { writeFile, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { parsePptx } from "./parse-pptx.mjs";
import { enrichSlide } from "./enrich.mjs";
import { generateHtml } from "./generate-html.mjs";

function usage() {
  console.error(`
Usage: node cli.mjs <input.pptx> [options]

Options:
  --slide <n>              Convert only slide number n (1-based)
  -o, --output <path>      Output HTML file path (default: <title>.html)
  --api <mode>             Enrichment source: northstar (default, corpus-
                           grounded), generic (plain Perplexity), or none
  --no-enrich              Alias for --api none
  --dry-run                Print parsed slide structure as JSON, no HTML
  --descriptions <file>    Load descriptions from a JSON file instead of API
  --title <text>           Override the page title
  --back-link <url>        URL for the back link (default: index.html)
  --list                   List all slides with their titles

Examples:
  node cli.mjs deck.pptx --list
  node cli.mjs deck.pptx --slide 4 -o digital-arena.html
  node cli.mjs deck.pptx --slide 4 --dry-run > structure.json
  node cli.mjs deck.pptx --slide 4 --descriptions descs.json -o page.html
`);
  process.exit(1);
}

// ---- Parse args ----
const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help") || args.includes("-h")) usage();

let inputFile = null;
let slideNum = null;
let outputPath = null;
let apiChoice = "northstar";
let dryRun = false;
let descFile = null;
let titleOverride = null;
let backLink = "index.html";
let listMode = false;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--slide" && args[i + 1]) {
    slideNum = parseInt(args[++i], 10);
  } else if ((a === "-o" || a === "--output") && args[i + 1]) {
    outputPath = args[++i];
  } else if (a === "--api" && args[i + 1]) {
    apiChoice = args[++i];
    if (!["northstar", "generic", "none"].includes(apiChoice)) {
      console.error(`Invalid --api mode: ${apiChoice} (expected northstar, generic, or none)`);
      usage();
    }
  } else if (a === "--no-enrich") {
    apiChoice = "none";
  } else if (a === "--dry-run") {
    dryRun = true;
  } else if (a === "--descriptions" && args[i + 1]) {
    descFile = args[++i];
  } else if (a === "--title" && args[i + 1]) {
    titleOverride = args[++i];
  } else if (a === "--back-link" && args[i + 1]) {
    backLink = args[++i];
  } else if (a === "--list") {
    listMode = true;
  } else if (!a.startsWith("-")) {
    inputFile = a;
  } else {
    console.error(`Unknown option: ${a}`);
    usage();
  }
}

if (!inputFile) {
  console.error("Error: no input file specified");
  usage();
}

// ---- Main ----
async function main() {
  console.error(`📄 Parsing ${basename(inputFile)}…`);
  const slides = await parsePptx(resolve(inputFile));
  console.error(`   Found ${slides.length} slide(s)\n`);

  if (listMode) {
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i];
      const shapes = s.shapes || [];
      const texts = shapes.filter((x) => x.textPlain).length;
      const imgs = shapes.filter((x) => x.kind === "image").length;
      const lines = shapes.filter((x) => x.kind === "line").length;
      console.log(
        `  ${String(i + 1).padStart(2)}. ${s.title || "(untitled)"}  — ${shapes.length} shape(s): ${texts} text, ${imgs} image(s), ${lines} line(s)`
      );
    }
    return;
  }

  // Select slide(s)
  const targets = slideNum
    ? [{ idx: slideNum - 1, slide: slides[slideNum - 1] }]
    : slides.map((slide, idx) => ({ idx, slide }));

  if (slideNum && !slides[slideNum - 1]) {
    console.error(
      `Error: slide ${slideNum} not found (deck has ${slides.length} slides)`
    );
    process.exit(1);
  }

  for (const { idx, slide } of targets) {
    const title = titleOverride || slide.title || `Slide ${idx + 1}`;
    console.error(`🔷 Processing slide ${idx + 1}: "${title}"`);

    if (dryRun) {
      console.log(
        JSON.stringify(
          slide,
          (k, v) =>
            k === "dataUri" ? `[${(v.length / 1024).toFixed(0)} KB data uri]` : v,
          2
        )
      );
      continue;
    }

    // Get descriptions
    let descriptions = new Map();
    if (descFile) {
      const raw = JSON.parse(await readFile(resolve(descFile), "utf8"));
      descriptions = new Map(Object.entries(raw));
      console.error(`   Loaded ${descriptions.size} descriptions from ${descFile}`);
    } else if (apiChoice !== "none") {
      console.error(
        `   Querying ${apiChoice === "generic" ? "generic Perplexity" : "NorthStar"} API for component descriptions…`
      );
      descriptions = await enrichSlide(slide, {
        apiUrl: process.env.API_URL,
        mode: apiChoice,
      });
      console.error(`   Got ${descriptions.size} description(s)`);
    }

    // Generate HTML
    const html = generateHtml(slide, descriptions, {
      pageTitle: title,
      backLink,
    });

    const outFile =
      outputPath ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") + ".html";

    await writeFile(outFile, html, "utf8");
    console.error(`   ✅ Written to ${outFile}\n`);
  }
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
