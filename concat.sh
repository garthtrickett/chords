#!/bin/bash

# Define the name for the output file
OUTPUT_FILE="a.txt"

# Inform the user that the script is starting
echo "📦 Bundling project files into $OUTPUT_FILE..."

# Start with an empty file
> "$OUTPUT_FILE"

# Use find to locate all relevant files, excluding specified directories and files.
# -path './<dir>' -prune -o: This is the standard way to exclude entire directories.
# -name '<file>' -prune -o: This is how we exclude specific files.
# -type f -print: This ensures we only process files.
find . -path './node_modules' -prune -o \
     -path './dist' -prune -o \
     -path './.git' -prune -o \
     -name 'chords.db' -prune -o \
     -name 'bun.lockb' -prune -o \
     -type f -print | grep -vF "$OUTPUT_FILE" | while IFS= read -r file; do
    
    # Append the file path as a header
    echo "File: $file" >> "$OUTPUT_FILE"
    echo "------------------------" >> "$OUTPUT_FILE"
    
    # Append the content of the file
    cat "$file" >> "$OUTPUT_FILE"
    
    # Add two newlines for spacing between files
    echo "" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
done

echo "✅ Done! Project content is in $OUTPUT_FILE"
echo "You can now copy the contents of that file and paste it in the chat."
