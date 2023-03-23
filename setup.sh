#!/bin/sh

wget https://open.epic.com/EHITables/Download -O tables.zip
unzip tables.zip
mkdir output

find . -name "*.htm" | xargs -I {} -P "$(nproc)" sh -c "deno run --allow-read extract_json.ts \"{}\" >   output/\$(basename \"{}\" .htm).json"
