#!/bin/sh

wget https://open.epic.com/EHITables/Download -O tables.zip
unzip tables.zip
mkdir -p output

# Run the find command in the background and process files in parallel
find . -name "*.htm" | xargs -I {} -P "$(nproc)" sh -c "deno run --allow-read extract_json.ts \"{}\" > output/\$(basename \"{}\" .htm).json" &

# Get the process ID of the background find command
find_pid=$!

# Count the total number of files in output every 5 seconds
while true; do
  sleep 10
  file_count=$(find output -type f | wc -l)
  echo "Files in output: $file_count"

  # Check if the find command has finished running
  if ! kill -0 "$find_pid" 2> /dev/null; then
    break
  fi
done

# Final count of files in output
echo "Total files in output: $(find output -type f | wc -l)"
