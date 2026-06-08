# 🎙️ Voice to Ticket Agent

A web application that transcribes uploaded WAV/MP3 support calls, extracts structured ticket information using LLM analysis, and generates support tickets automatically.

## Features

- 🎵 Upload WAV/MP3 audio files of support calls
- 📝 Auto-transcription of audio content
- 🤖 LLM-powered extraction of ticket details (title, description, category, priority)
- 🗄️ Saves tickets to database
- 🔖 Returns a unique confirmation number for each ticket

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **UI**: Responsive design with modern glassmorphism styling
- **Audio**: Web Audio API / File Upload

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/SenthilLoganathan30/Voice-to-Text.git
   ```

2. Open `index.html` in your browser, or serve with any static web server.

## Files

| File | Description |
|------|-------------|
| `index.html` | Main application interface |
| `app.js` | Application logic and API integrations |
| `style.css` | Styling and animations |

## Usage

1. Open the application in your browser
2. Upload a WAV or MP3 audio file of a support call
3. The app will transcribe and analyze the audio
4. A structured support ticket is generated with a confirmation number

## License

MIT License — feel free to use and modify.
