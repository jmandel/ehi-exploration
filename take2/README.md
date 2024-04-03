# Epic EHI Processing

This repository contains scripts for processing Electronic Health Information (EHI) data exported from Epic systems. The scripts are designed to extract, redact, and merge data from various tables based on efficient column correspondences.

## Problem

EHI data from Epic systems are often fragmented across many tables, making it challenging to understand how the tables are expected to be joined together based on the documentation alone. Foreign keys and links between tables are not always well documented, which can lead to difficulties in merging related data accurately.

## Processing Pipeline

The processing pipeline for EHI data consists of the following steps:

1. **Extraction of export .zip file** (`00-extract.js`): The EHI data is exported from the Epic system as a .zip file, which is then extracted to access the individual data files in TSV format.

2. **Redaction of sensitive data** (`01-redact.js`): Before processing the data further, any sensitive information is redacted to protect patient privacy. Specific terms are removed from all TSV files.

3. **JSON conversion** (`02-make-json.js`): All TSV files are concatenated into a single JSON file, with `$meta.schemas` containing the table schemas and a top-level array for each TSV table.

4. **Data merging** (`03-merge-related-tables.js`): The script uses a two-phase approach to merge EHI data:
  1. **Name-based merging**: Merge tables based on a naming heuristic (e.g., Epic uses PAT_ENC, PAT_ENC_2, etc. for columns about the same encounter). This phase uses the documented primary keys for merging.
  2. **Heuristic merging**: After performing the name-based merges, the script applies the following steps to merge tables based on efficient column correspondences:
     - For each pair of tables:
       - Determine every "entity" (i.e., column value) that occurs, and all the (table, row, column) positions in which the entity occurs.
       - Find (T1.columnX, T2.columnY) tuples that occur in more than one entity, to generate a list of candidate single-column correspondences.
       - For every candidate column correspondence, calculate the "efficiency" by mapping every row of T1 into the value for colX, and every row in T2 into the value for colY, and then take the product over unique values, accumulating the product in such a way that a "perfect" mapping would have a total product of 1, a "valid but poor" mapping would have a high total, and an "invalid mapping" would have a value of 0.
       - Pick the best candidate pair, eliminating any zero-score pairs, and then try to extend T1.X, T2.Y with every other potential candidate, to make cardinality-2 mapping functions. If the mapping is "better" (lower without hitting zero), continue this algorithm recursively trying to extend with every other candidate until they're all worse.
       - Find the best column set (1 or more cols from T1 mapping to an equal number of cols from T2) using this recursive process.
       - Record these, then eliminate these cols from the running and try the algorithm again to see if there's anything good.
     - Filter out any proposed merges if the source table fits equally well with multiple targets.
     - Perform a topological sort on the tables based on their discovered join keys to determine the order of merging.

## Flowchart

```mermaid
%%{init: {"flowchart": {"htmlLabels": false}} }%%
flowchart TD
   A[Load EHI data] --> B[Name-based merging]
   B --> C{For each pair of tables}
   subgraph Heuristic Merging
   C --> D[Find entity occurrences]
   D --> E[Generate candidate single-column correspondences]
   E --> F[Calculate efficiency for each candidate]
   F --> G[Pick the best candidate pair]
   G --> H{Extend mapping recursively}
   H -- Adding terms improves mapping --> H
   H -- Mapping efficiency has plateaued --> I[Record best column set]
   I --> J{More candidates?}
   J -- Yes --> C
   J -- No --> K[Filter out proposed merges]
   K --> L[Topological sort of tables]
   L --> M[Merge tables based on discovered join keys]
   end
   M --> N[Output merged tables and schemas]
   ```

## Additional Heuristics

The merging script includes additional heuristics to avoid incorrect matches:

* Filter out any proposed merges if the source table fits equally well with multiple targets.
* Skip merging tables that only have primary key columns when merging based on efficient column correspondences.

## Usage

To process EHI data, follow these steps:

* `00-extract.js`: Extract the exported .zip file
* `01-redact.js`: Redact sensitive data from the extracted TSV files
* `02-make-json.js`: Convert the redacted TSV files into a single JSON file
* `03-merge-related-tables.js`: output the merged tables and schemas based on efficient column correspondences and naming heuristics

