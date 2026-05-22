import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const inputPath = path.join(repoRoot, "docs", "frd", "EC2_FRD.md");
const outputPath = path.join(repoRoot, "docs", "frd", "EC2_FRD.pdf");

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatInline = (raw) => {
  let text = escapeHtml(raw);

  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, src) => {
    const label = (alt || "Screenshot placeholder").trim() || "Screenshot placeholder";
    const source = src.trim();
    return `<div class=\"img-ph\"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(source)}</span></div>`;
  });
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  return text;
};

const flushTable = (tableRows, htmlParts) => {
  if (tableRows.length === 0) return;
  const parsedRows = tableRows
    .map((row) => row.trim())
    .filter((row) => row.startsWith("|") && row.endsWith("|"))
    .map((row) => row.slice(1, -1).split("|").map((cell) => formatInline(cell.trim())));

  if (parsedRows.length < 2) {
    tableRows.forEach((line) => htmlParts.push(`<p>${formatInline(line)}</p>`));
    tableRows.length = 0;
    return;
  }

  const header = parsedRows[0];
  const body = parsedRows.slice(2);

  const thead = `<thead><tr>${header.map((cell) => `<th>${cell}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${body
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("")}</tbody>`;

  htmlParts.push(`<table>${thead}${tbody}</table>`);
  tableRows.length = 0;
};

const markdownToHtml = (markdown) => {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const htmlParts = [];
  const listStack = [];
  const tableRows = [];

  const closeListsTo = (targetDepth = 0) => {
    while (listStack.length > targetDepth) {
      const tag = listStack.pop();
      htmlParts.push(`</${tag}>`);
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      closeListsTo(0);
      tableRows.push(line);
      continue;
    }

    flushTable(tableRows, htmlParts);

    if (trimmed.length === 0) {
      closeListsTo(0);
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      closeListsTo(0);
      const level = headingMatch[1].length;
      htmlParts.push(`<h${level}>${formatInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    const listMatch = /^(\s*)([-*]|\d+\.)\s+(.+)$/.exec(line);
    if (listMatch) {
      const indent = listMatch[1].length;
      const depth = Math.floor(indent / 2) + 1;
      const isOrdered = /\d+\./.test(listMatch[2]);
      const tag = isOrdered ? "ol" : "ul";

      while (listStack.length < depth) {
        listStack.push(tag);
        htmlParts.push(`<${tag}>`);
      }
      while (listStack.length > depth) {
        const closeTag = listStack.pop();
        htmlParts.push(`</${closeTag}>`);
      }
      if (listStack[listStack.length - 1] !== tag) {
        const closeTag = listStack.pop();
        htmlParts.push(`</${closeTag}>`);
        listStack.push(tag);
        htmlParts.push(`<${tag}>`);
      }

      htmlParts.push(`<li>${formatInline(listMatch[3])}</li>`);
      continue;
    }

    closeListsTo(0);
    htmlParts.push(`<p>${formatInline(trimmed)}</p>`);
  }

  flushTable(tableRows, htmlParts);
  closeListsTo(0);

  return htmlParts.join("\n");
};

const buildHtmlDocument = (bodyHtml) => `<!doctype html>
<html>
  <head>
    <meta charset=\"utf-8\" />
    <title>EC2 FRD</title>
    <style>
      @page { margin: 32mm 16mm 18mm; }
      body { font-family: "Segoe UI", Arial, sans-serif; color: #1f2937; line-height: 1.5; font-size: 11.5pt; }
      .title-page { min-height: 90vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; page-break-after: always; }
      .title-page h1 { font-size: 32px; margin: 0 0 18px; }
      .title-page p { font-size: 16px; margin: 6px 0; color: #374151; }
      h1, h2, h3, h4, h5, h6 { color: #0f172a; margin: 20px 0 10px; }
      h1 { font-size: 24px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
      h2 { font-size: 19px; }
      h3 { font-size: 16px; }
      p { margin: 8px 0; }
      ul, ol { margin: 8px 0 8px 22px; }
      li { margin: 4px 0; }
      table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 10.5pt; }
      th, td { border: 1px solid #d1d5db; padding: 7px 8px; vertical-align: top; }
      th { background: #f3f4f6; font-weight: 700; }
      code { background: #f3f4f6; border-radius: 4px; padding: 1px 4px; font-family: Consolas, "Courier New", monospace; font-size: 0.95em; }
      a { color: #0b63ce; text-decoration: none; }
      .img-ph { border: 1px dashed #9ca3af; background: #f9fafb; border-radius: 6px; padding: 10px; margin: 10px 0; display: flex; flex-direction: column; gap: 4px; }
      .img-ph strong { font-size: 10.5pt; color: #111827; }
      .img-ph span { font-size: 9.5pt; color: #6b7280; word-break: break-all; }
    </style>
  </head>
  <body>
    <section class=\"title-page\">
      <h1>EC2 Functional Requirement Document</h1>
      <p>KCX FinOps Platform</p>
      <p>Version 1.0</p>
    </section>
    <main>${bodyHtml}</main>
  </body>
</html>`;

const footerTemplate = `
  <div style="font-size:9px;width:100%;padding:0 16mm;color:#6b7280;display:flex;justify-content:flex-end;">
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>
`;

const run = async () => {
  const markdown = await fs.readFile(inputPath, "utf8");
  const htmlBody = markdownToHtml(markdown);
  const html = buildHtmlDocument(htmlBody);

  const browser = await puppeteer.launch({
    headless: true,
    timeout: 120000,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate,
      margin: { top: "24mm", right: "16mm", bottom: "18mm", left: "16mm" },
    });
  } finally {
    await browser.close();
  }

  console.log(`Generated PDF: ${outputPath}`);
};

run().catch((error) => {
  console.error("Failed to generate EC2 FRD PDF", error);
  process.exitCode = 1;
});
