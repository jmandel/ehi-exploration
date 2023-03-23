// extract_json.ts
import { parse } from "https://deno.land/std/html/mod.ts";

const html = `
<!-- Your provided HTML code goes here -->
`;

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
    const description = row.nextElementSibling?.querySelector("td")?.textContent?.trim() ?? "";
    
    if (!name) return null;
    
    return {
      index: index + 1,
      name,
      type,
      discontinued,
      description
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

