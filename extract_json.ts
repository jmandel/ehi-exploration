// extract_json.ts
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";


const html = Deno.readTextFileSync(Deno.args[0])

const parser = new DOMParser();
const doc = parser.parseFromString(html, "text/html");

const table_name = doc.querySelector(".Header2 td")?.textContent?.trim() ?? "";
const description = doc.querySelector(".T1Value")?.textContent?.trim() ?? "";
const primary_key_column_name = doc.querySelector(".List tbody tr td")?.textContent?.trim() ?? "";
const primary_key_ordinal_position = doc.querySelector(".List tbody tr td:nth-child(2)")?.textContent?.trim() ?? "";

const column_rows = Array.from(doc.querySelectorAll(".SubList.List tr"));
const columns = column_rows
  .map((row, index) => {
    const name = row.querySelector(".T1Head:nth-child(2)")?.textContent?.trim() ?? "";
    const type = row.querySelector(".T1Head:nth-child(3)")?.textContent?.trim() ?? "";
    const discontinued = row.querySelector("td:nth-child(4)")?.textContent?.trim() === "No" ? false : true;
    const descriptionRow = row.nextElementSibling;
    const description = descriptionRow?.querySelector("td:nth-child(2)")?.textContent?.trim() ?? "";
    
    if (!name) return null;

    // Extract category entries
    const entries = [];
    let entriesRow = Array.from(descriptionRow.querySelectorAll("td td")).find(td => td.textContent.includes("Category Entries"));
    if (entriesRow) {
      entriesRow = entriesRow.parentElement.nextElementSibling;
      while (entriesRow && entriesRow.querySelector("td[style]")) {

        entries.push(entriesRow.querySelector("td[style]").textContent.trim());
        entriesRow = entriesRow.nextElementSibling;
      }
    }
    
    return {
      index: index + 1,
      name,
      type,
      discontinued,
      description,
      entries,
    };
  })
  .filter(column => column !== null);

const table_json = {
  table_name,
  description,
  primary_key: {
    column_name: primary_key_column_name,
    ordinal_position: primary_key_ordinal_position,
  },
  columns,
};

console.log(JSON.stringify(table_json, null, 2));
