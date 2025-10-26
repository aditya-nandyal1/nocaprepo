No Cap! — Live Fact-Checking & Opinion Detector (SwiftUI)

A SwiftUI app that listens to live speech, segments it into statements, and classifies each as either:

Declarative (objective, verifiable) → labeled TRUE or FALSE, with an explanation if false

Opinion (subjective) → labeled OPINION

It supports single-speaker and multi-party modes, shows the live transcript, and logs results in a slick, dark UI.

Stack: SwiftUI · AVFoundation · Speech · URLSession
APIs: Anthropic Claude (primary), Janitor AI (optional first-try), Vapi (optional transcription assist)

✨ Features

🎙️ Live speech capture with partial results and auto-restart on errors

🧠 Unified fact-checker: tries Janitor AI once, permanently falls back to Claude on auth/parse failures

🔁 Silence-based segmentation (configurable) for natural, sentence-like chunks

👥 Multi-party mode (Speaker 1 / Speaker 2 toggling) or single-speaker mode

📋 Live analysis log with badges: TRUE / FALSE / OPINION and inline explanations

🛡️ Resilient networking with explicit error surfacing in the UI

🖼️ Screens

Mode Selector → Single vs Multi-party

Record/Stop → Big mic or stop button

Current Speech → Live transcript

Live Analysis Log → Reverse chronological cards with badges and timestamps
