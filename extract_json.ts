// extract_json.ts
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

const html = Deno.readTextFileSync(Deno.args[0]);

const parser = new DOMParser();
const doc = parser.parseFromString(html, "text/html");

const table_name = doc.querySelector(".Header2 td")?.textContent?.trim() ?? "";
const description = doc.querySelector(".T1Value")?.textContent?.trim() ?? "";

const [primary_key_information, column_information] = Array.from(
  doc.querySelectorAll("table.SubHeader3 + table.List")
);
const pks = Array.from(
  primary_key_information.querySelectorAll("tbody > tr:nth-child(n+2)")
);

const pkCols = [];
for (const k of pks) {
  const kcells = Array.from(k.querySelectorAll("td:nth-last-child(n+2)"));
  const [colname, colposition] = kcells.map((td) => td.innerText);
  pkCols.push({
    columnName: colname,
    ordinalPosition: parseInt(colposition),
  });
}

const colRows = Array.from(
  column_information.querySelectorAll(
    ":scope > tbody > tr > td.T1Head:nth-child(1)"
  )
).map((td) => td.parentElement);

const cols = [];
for (const c of colRows) {
  const [ordinalPosition, name, type, discontinuedText] = Array.from(
    c.querySelectorAll(":scope > td")
  ).map((c) => c.innerText);
  const colDescComponents = c.nextElementSibling.querySelector("table.SubList");
  const colDesc: string = colDescComponents
    .querySelector(":scope > tbody > tr:nth-child(2)")
    .innerText.trim();
  const entriesCells = colDescComponents.querySelectorAll(
    ":scope > tbody > tr:nth-child(n+5)"
  );
  const linksTo = colDesc.match(/links? to (?:the )([A-Z_]+)/);
  const entries = Array.from(entriesCells).map((e) => e.innerText.trim());
  cols.push({
    ordinalPosition: parseInt(ordinalPosition),
    name,
    type,
    discontinued: discontinuedText !== "No",
    description: colDesc,
    linksTo: linksTo?.[1],
    entries: entries.length ? entries : undefined
  });
}
const output = {
  name: table_name,
  description,
  primaryKey: pkCols,
  columns: cols,
};

console.log(JSON.stringify(output, null, 2));
