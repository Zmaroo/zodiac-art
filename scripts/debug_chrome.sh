#!/bin/bash

/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.opencode-chrome" \
  --new-window http://localhost:5173
