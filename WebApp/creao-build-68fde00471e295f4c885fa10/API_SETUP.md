# NoCap - API Setup Guide

## Overview

NoCap is fully integrated with real API services. The voice input and verification systems are now production-ready!

## Quick Start

1. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Add your API keys to `.env`**

3. **Start the application:**
   ```bash
   npm run check:safe  # Validate everything works
   ```

## API Integration Status

### ✅ Fully Implemented Services

| Service | Purpose | Status | Fallback |
|---------|---------|--------|----------|
| **Vapi** | Voice input & transcription | ✅ Implemented | Browser MediaRecorder |
| **Claude (Anthropic)** | AI fact-checking | ✅ Implemented | - |
| **Gemini (Google)** | AI fact-checking | ✅ Implemented | - |
| **Fetch.ai** | Agent-based verification | ✅ Implemented | - |
| **Bright Data** | Web scraping for facts | ✅ Implemented | - |
| **Lava Gateway** | Consensus verification | ✅ Implemented | Local consensus algorithm |
| **FishAudio** | Text-to-speech | ✅ Implemented | Browser SpeechSynthesis |
| **ElevenLabs** | Text-to-speech (backup) | ✅ Implemented | Browser SpeechSynthesis |

### 🎯 How It Works

#### 1. Voice Input (Vapi)

When you provide your Vapi API key, the application will:
- Create a real-time voice session with Vapi
- Use Deepgram for high-quality transcription
- Connect via WebSocket for instant results
- Support multi-speaker identification

**Fallback:** If no Vapi key is provided, the browser's MediaRecorder API captures audio (transcription requires additional setup).

#### 2. Multi-Agent Verification

Each declarative statement is verified by up to 4 AI agents in parallel:

##### Claude (Anthropic)
- **Endpoint:** `POST https://api.anthropic.com/v1/messages`
- **Model:** `claude-3-5-sonnet-20241022` (configurable)
- **Purpose:** Advanced reasoning and fact analysis

##### Gemini (Google)
- **Endpoint:** `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent`
- **Model:** `gemini-2.0-flash-exp` (configurable)
- **Purpose:** Fast, efficient fact-checking with Google's knowledge

##### Fetch.ai
- **Endpoint:** `POST https://agentverse.ai/api/v1/verify`
- **Purpose:** Decentralized agent-based verification via Agentverse

##### Bright Data
- **Endpoint:** `POST https://api.brightdata.com/v1/search`
- **Purpose:** Real-time web scraping to find supporting evidence

#### 3. Consensus (Lava Gateway)

After all agents provide their verdicts:
- **Endpoint:** `POST https://gateway.lavanet.xyz/v1/consensus`
- **Purpose:** Aggregate results into a single trusted verdict
- **Threshold:** 60% agreement required for definitive true/false

**Fallback:** If Lava Gateway is unavailable, local consensus algorithm calculates the verdict.

#### 4. Text-to-Speech

When a false statement is detected, corrective information is spoken:

##### FishAudio (Primary)
- **Endpoint:** `POST https://api.fish.audio/v1/tts`
- **Format:** MP3
- **Quality:** High-quality natural speech

##### ElevenLabs (Backup)
- **Endpoint:** `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`
- **Model:** `eleven_monolingual_v1`
- **Voice ID:** Configurable (default: `21m00Tcm4TlvDq8ikWAM`)

**Fallback:** Browser's SpeechSynthesis API provides basic TTS.

## Configuration Reference

### Required API Keys

**Minimum for basic functionality:**
```env
VITE_VAPI_API_KEY=your_vapi_key
VITE_ANTHROPIC_API_KEY=your_anthropic_key
VITE_FISHAUDIO_API_KEY=your_fishaudio_key
```

**Recommended for full multi-agent consensus:**
```env
VITE_VAPI_API_KEY=your_vapi_key
VITE_ANTHROPIC_API_KEY=your_anthropic_key
VITE_GEMINI_API_KEY=your_gemini_key
VITE_FETCHAI_API_KEY=your_fetchai_key
VITE_BRIGHTDATA_API_KEY=your_brightdata_key
VITE_LAVA_API_KEY=your_lava_key
VITE_FISHAUDIO_API_KEY=your_fishaudio_key
```

### Where to Get API Keys

| Service | Sign Up URL |
|---------|-------------|
| Vapi | https://vapi.ai/dashboard |
| Anthropic (Claude) | https://console.anthropic.com/ |
| Google (Gemini) | https://makersuite.google.com/app/apikey |
| Fetch.ai | https://agentverse.ai/ |
| Bright Data | https://brightdata.com/ |
| Lava Network | https://lavanet.xyz/ |
| FishAudio | https://fish.audio/ |
| ElevenLabs | https://elevenlabs.io/ |

## Advanced Configuration

### Custom API Base URLs

Override the default API endpoints:

```env
VITE_ANTHROPIC_BASE_URL=https://your-proxy.com
VITE_GEMINI_BASE_URL=https://your-proxy.com
```

### Custom Models

Change the AI models used:

```env
VITE_ANTHROPIC_MODEL=claude-3-opus-20240229
VITE_GEMINI_MODEL=gemini-pro
```

### Vapi Assistant

Use a pre-configured Vapi assistant:

```env
VITE_VAPI_ASSISTANT_ID=your_assistant_id
```

### ElevenLabs Voice

Use a custom voice:

```env
VITE_ELEVENLABS_VOICE_ID=your_voice_id
```

## Testing API Integration

### 1. Test Voice Input

```javascript
// Browser console
const voiceService = VoiceService.getInstance();
await voiceService.startListening((result) => {
  console.log("Transcription:", result);
});
```

### 2. Test Verification

```javascript
// Browser console
const verificationService = VerificationService.getInstance();
const result = await verificationService.verifyStatement("The Earth is flat");
console.log(result);
```

### 3. Test Text-to-Speech

```javascript
// Browser console
const voiceService = VoiceService.getInstance();
await voiceService.speak("This is a test");
```

## Error Handling

All services include comprehensive error handling:

1. **Network errors** → Automatic fallback to next provider
2. **API rate limits** → Graceful degradation
3. **Invalid API keys** → Clear console warnings
4. **Missing services** → Automatic fallback to browser APIs

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface                        │
│              (VoiceInputButton + Panels)                 │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│                  Service Layer                           │
│  ┌──────────────────┐      ┌────────────────────────┐   │
│  │  VoiceService    │      │  VerificationService   │   │
│  │  - Vapi          │      │  - Claude              │   │
│  │  - MediaRecorder │      │  - Gemini              │   │
│  │  - FishAudio     │      │  - Fetch.ai            │   │
│  │  - ElevenLabs    │      │  - Bright Data         │   │
│  └──────────────────┘      │  - Lava Gateway        │   │
│                             └────────────────────────┘   │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│                  Data Layer (ORM)                        │
│  - UserSessionORM                                        │
│  - SpeakerQueueORM                                       │
│  - DeclarativeStatementORM                               │
│  - VerificationResultORM                                 │
└─────────────────────────────────────────────────────────┘
```

## Production Deployment

### Environment Variables

Set these in your hosting platform:

**Vercel/Netlify:**
```
Settings → Environment Variables → Add each VITE_* variable
```

**Docker:**
```dockerfile
ENV VITE_VAPI_API_KEY=your_key
ENV VITE_ANTHROPIC_API_KEY=your_key
# ... etc
```

### Security Best Practices

1. **Never commit `.env` files** (already in `.gitignore`)
2. **Use different keys for dev/production**
3. **Rotate keys regularly**
4. **Monitor API usage** via provider dashboards
5. **Set up rate limiting** in your hosting environment

## Troubleshooting

### Voice input not working
- Check if Vapi API key is set correctly
- Verify microphone permissions in browser
- Check browser console for errors

### Verification always returns "inconclusive"
- Ensure at least one AI API key is configured
- Check API key validity via provider dashboard
- Verify network connectivity to API endpoints

### No audio output
- Check if FishAudio or ElevenLabs key is set
- Verify browser supports audio playback
- Check browser console for TTS errors

### CORS errors
- API keys should be for client-side access
- Some services may require proxy setup
- Check API documentation for CORS policies

## Support

For issues or questions:
1. Check the browser console for detailed error messages
2. Verify API keys are active and have sufficient credits
3. Review API provider documentation
4. Check service status pages

## Next Steps

1. **Configure your APIs** in `.env`
2. **Run the validation:** `npm run check:safe`
3. **Test voice input** by clicking the microphone button
4. **Make a test statement** to see multi-agent verification in action
5. **Review results** in the Verification panel

The system will gracefully handle missing API keys by falling back to simpler alternatives, but full functionality requires all services to be configured.
