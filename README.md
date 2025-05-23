# BPM Flash

A dynamic web application that detects and visualizes music tempo through synchronized color flashing, with multiple BPM detection methods.

![BPM Flash](https://github.com/mihailv-v/bpmflash/raw/main/pb/images/bpm-flash-preview.png)

## Features

- **Multiple BPM Detection Methods:**

  - Spotify API integration
  - Manual tap tempo
  - Microphone audio analysis
  - YouTube video analysis
  - Tunebat lookup
- **Visual BPM Feedback:**

  - Color-flashing background synchronized to detected BPM
  - Customizable color schemes
  - Adjustable transition effects
- **Advanced Tap Tempo:**

  - Smart BPM calculation with outlier detection
  - Visual tap feedback
  - Keyboard tap support
  - Real-time BPM updates
- **Spotify Integration:**

  - Automatic BPM detection from current Spotify track
  - Playback controls (play/pause, skip, volume)
  - Auto-save songs to BPM-categorized playlists
  - Album artwork color extraction
- **Multi-Device Support:**

  - Mirror mode for synchronizing multiple devices
  - Secondary screen support
  - Shareable session codes
- **Skip Mix Feature:**

  - Automatically skips to specific song sections
  - Customizable skip parameters
  - Multiple skip modes (intro, chorus, etc.)

## Getting Started

### Prerequisites

- A Spotify account (for Spotify integration features)
- A modern web browser
- Node.js and npm (for local development)

### Installation

1. Clone this repository:

   ```
   git clone https://github.com/mihailv-v/bpmflash.git
   ```
2. Navigate to the project directory:

   ```
   cd bpmflash
   ```
3. Install dependencies:

   ```
   npm install
   ```
4. Create a `.env` file with your Spotify API credentials:

   ```
   CLIENT_ID=your_spotify_client_id
   CLIENT_SECRET=your_spotify_client_secret
   REDIRECT_URI=http://localhost:9999/callback
   GOOGLE_API_KEY=
   GOOGLE_CSE_ID=
   ```
5. Start the application:

   ```
   node index.js
   ```
6. Open your browser and navigate to:

   ```
   http://localhost:9999
   ```

## Usage

### BPM Detection Methods

- **Spotify:** Connect to your Spotify account to automatically detect BPM from currently playing track (now deprecated as audio-deatures endpoint from their API is no loger available, thus cannot get tempo for current track_id)
- **Tap Tempo:** Use the "Tap in the tempo of the music" button to manually tap along with the beat
- **Microphone:** Allow microphone access to detect beats from ambient audio
- **YouTube:** Paste a YouTube URL to analyze the audio from the video //TODO
- **Google Search APi:** Enter artist and song title to look up BPM from aggregated search results for the currently playing song from Spotify or one manually entered

### BPM Visualization

- The background will flash in sync with the detected BPM
- Use the color controls to customize the color scheme
- Adjust transition effects with the slider
- Toggle random color mode for varied visual experience

### Mirror Mode

1. On your main device, click "Generate Code"
2. On secondary devices, go to /subscribe, enter the code and click "Subscribe", via the ready to use generated link
3. All devices will now synchronize their color flashing

## Keyboard Utility

- **Spacebar/Keyboard: use keyboard to tap more accuratelly using the text field**

## Acknowledgements

- Spotify API for music metadata
- Google Seatch API for BPM lookup functionality
