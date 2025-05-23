document.addEventListener("DOMContentLoaded", function () {
    // Initialize variables and flags
    let currentBPM = 0;
    const isCustomBPM = false;
    let customBPM = 0;
    const isPlaying = true;
    let lastKnownBPM = 0;
    let lastKnownSongDetails = "N/A";
    let customTrackURL = "";
    let bpmMultiplier = 1;
    let lastBPMMultiplied;
    let isSkipping = false;
    let songAndBPMUpdated = false;
    let isTransitionUpdated = false;
    const bpmElement = document.getElementById("bpm");
    const songTitleElement = document.getElementById("song-title");
    const customColorsInput = document.getElementById("custom-colors");
    const setColorsButton = document.getElementById("set-colors-button");
    const defaultColorsButton = document.getElementById("default-colors-button");
    let customFlashingColors = [];
    let savedExtractedColors = ["red", "orange", "yellow", "green", "blue", "indigo", "violet"];
    const defaultFlashingColors = ["red", "orange", "yellow", "green", "blue", "indigo", "violet"];
    let accessToken = getCookie("access_token");
    const loginButton = document.getElementById("login-button");
    const switchToCurrentlyPlayingButton = document.getElementById("switch-to-currently-playing-button");
    let isTokenExpired = false;
    let isFirstExecution = true; // Flag to track the first execution
    document.getElementById("skip-mode-container").style.display = "none";
    let isSkipInProgress = false; // Flag to track if a skip is already in progress
    let isShuffleEnabled = false;
    let shuffleFromPlaybackCheck = false;
    let currentSongUrl;
    let totalDuration = 0;
    let currentPosition = 0;
    let currentVolume = 0;
    let autoSaveEnabled = false;
    // Variables to track song and BPM changes for auto-saving
    let autoSaveLastSongDetails = "";
    let autoSaveLastBPM = 0;
    let autoSaveLastSongUrl = "";
    let autoSaveTimeStamp = 0;

    // BPM Detection Mode Implementation
    let audioContext = null;
    let analyser = null;
    let microphone = null;
    let animationFrame = null;
    let dataArray = null;
    let peakTimes = [];
    let lastPeakTime = 0;
    let bpmHistory = [];
    let startTime = null;
    let microphoneActive = false;
    let beatThreshold = 0.3;
    let flashOnBeat = false;
    let stableBpmUpdates = true;
    let lastBpmUpdateTime = 0;
    let bpmUpdateInterval = 5000; // 5 seconds
    let volumeGain = 1.0;
    let gainNode = null;
    
    // Make sure to initialize these UI elements as soon as the document loads
    document.addEventListener('DOMContentLoaded', function() {
        const thresholdSlider = document.getElementById('threshold-slider');
        const thresholdValue = document.getElementById('threshold-value');
        const beatFlashToggle = document.getElementById('beat-flash-toggle');
        const stableBpmToggle = document.getElementById('stable-bpm-toggle');
        
        if (thresholdSlider && thresholdValue) {
            thresholdSlider.value = beatThreshold;
            thresholdValue.textContent = beatThreshold;
        }
        
        if (beatFlashToggle) {
            beatFlashToggle.checked = flashOnBeat;
        }
        
        if (stableBpmToggle) {
            stableBpmToggle.checked = stableBpmUpdates;
        }
    });

    // Initialize BPM detection modes
    initializeBPMModeSwitcher();

    // Function to initialize the BPM mode selector
    function initializeBPMModeSwitcher() {
        const bpmModeSelector = document.querySelector('.bpm-mode-selector');
        if (!bpmModeSelector) return;
        
        const modeSections = document.querySelectorAll('.mode-section');
        
        bpmModeSelector.addEventListener('change', function() {
            const selectedMode = this.value;
            
            // Stop microphone if it's active and we're switching modes
            if (microphoneActive && selectedMode !== 'microphone') {
                stopMicrophoneAnalysis();
            }
            
            // Clear any BPM option buttons when switching modes
            clearBpmOptionButtons();
            
            // Hide all mode sections first
            modeSections.forEach(section => {
                section.style.display = 'none';
            });
            
            // Show the selected mode section
            const activeSection = document.querySelector(`.${selectedMode}-input`);
            if (activeSection) {
                activeSection.style.display = 'inline-flex';
            }
        });
        
        // Set up tap tempo functionality
        setupTapTempo();
        
        // Set up microphone analysis
        setupMicrophoneAnalysis();
        
        // Set up YouTube analysis
        setupYoutubeAnalysis();
        
        // Set up Tunebat analysis
        setupTunebatAnalysis();
    }

    // Function to set up tap tempo
    function setupTapTempo() {
        const tapButton = document.getElementById('tap-tempo');
        const clearTapsButton = document.getElementById('clear-taps');
        const tapInfo = document.querySelector('.tap-info');
        
        if (tapButton) {
            let tapTimes1 = [];
            
            tapButton.addEventListener('click', function() {

                const now = Date.now();
                tapTimes1.push(now);
                
                // Only keep the last 8 taps
                if (tapTimes1.length > 12) {
                    tapTimes1.shift();
                }
                
                // Calculate BPM if we have at least 4 taps
                if (tapTimes1.length >= 4) {
                    const bpm = calculateBPMFromTaps(tapTimes1);
                    if (bpm) {
                        document.getElementById("bpm").textContent = Math.round(bpm);
                        document.getElementById("bpm").setAttribute('data-bpm-display', Math.round(bpm));
                        tapInfo.textContent = "BPM detected! Keep tapping to refine";
                        tapInfo.style.display = 'block';
                        currentBPM = Math.round(bpm);
                        lastKnownBPM = Math.round(bpm);
                        // // isCustomBPM = true;
                        // updateBackgroundColor(bpm); // Use the existing function to update flashing
                    }
                } else {
                    tapInfo.textContent = `Tap at least 4 times, ${4-tapTimes1.length} more taps needed`;
                    tapInfo.style.display = 'block';
                }

            });
            
            if (clearTapsButton) {
                clearTapsButton.addEventListener('click', function() {
                    tapTimes1 = [];
                    tapInfo.textContent = "Taps cleared. Tap again to detect BPM";
                    tapInfo.style.display = 'block';
                });
            }
        }
    }

    // Function to calculate BPM from tap times
        function calculateBPMFromTaps(tapTimes) {
        if (tapTimes.length < 2) return null;
        
        const intervals = [];
        for (let i = 1; i < tapTimes.length; i++) {
            intervals.push(tapTimes[i] - tapTimes[i - 1]);
        }
        
        // Calculate the average interval
        const sum = intervals.reduce((a, b) => a + b, 0);
        const avgInterval = sum / intervals.length;
        
        // Convert to BPM
        return 60000 / avgInterval;
    }

    // Function to set up microphone analysis
    function setupMicrophoneAnalysis() {
        const startMicButton = document.getElementById('start-mic');
        const stopMicButton = document.getElementById('stop-mic');
        const micStatus = document.querySelector('.mic-status');
        const thresholdSlider = document.getElementById('threshold-slider');
        const thresholdValue = document.getElementById('threshold-value');
        const beatFlashToggle = document.getElementById('beat-flash-toggle');
        const stableBpmToggle = document.getElementById('stable-bpm-toggle');
        const volumeGainSlider = document.getElementById('volume-gain-slider');
        const volumeGainValue = document.getElementById('volume-gain-value');
        
        if (!startMicButton || !stopMicButton) return;
        
        // Set up threshold slider
        if (thresholdSlider && thresholdValue) {
            thresholdSlider.value = beatThreshold;
            thresholdValue.textContent = beatThreshold.toFixed(2);
            
            thresholdSlider.addEventListener('input', function() {
                beatThreshold = parseFloat(this.value);
                thresholdValue.textContent = beatThreshold.toFixed(2);
            });
        }
        
        // Set up volume gain slider
        if (volumeGainSlider && volumeGainValue) {
            volumeGainSlider.value = volumeGain;
            volumeGainValue.textContent = volumeGain.toFixed(2);
            
            volumeGainSlider.addEventListener('input', function() {
                volumeGain = parseFloat(this.value);
                volumeGainValue.textContent = volumeGain.toFixed(2);
                
                // Update gain node if active
                if (gainNode) {
                    gainNode.gain.value = volumeGain;
                }
            });
        }
        
        // Set up beat flash toggle
        if (beatFlashToggle) {
            beatFlashToggle.checked = flashOnBeat;
            
            beatFlashToggle.addEventListener('change', function() {
                flashOnBeat = this.checked;
            });
        }
        
        // Set up stable BPM toggle
        if (stableBpmToggle) {
            stableBpmToggle.checked = stableBpmUpdates;
            
            stableBpmToggle.addEventListener('change', function() {
                stableBpmUpdates = this.checked;
                if (!stableBpmUpdates) {
                    lastBpmUpdateTime = 0; // Allow immediate update if disabled
                }
            });
        }
        
        // Add BPM display near waveform
        const waveformContainer = document.querySelector('.waveform-container');
        if (waveformContainer && !document.querySelector('.bpm-display-confirmation')) {
            const bpmDisplay = document.createElement('div');
            bpmDisplay.className = 'bpm-display-confirmation';
            bpmDisplay.textContent = 'BPM: --';
            waveformContainer.appendChild(bpmDisplay);
        }
        
        startMicButton.addEventListener('click', async function() {
            await startMicrophoneAnalysis();
            startMicButton.disabled = true;
            stopMicButton.disabled = false;
            micStatus.textContent = "Analyzing audio...";
        });
        
        stopMicButton.addEventListener('click', function() {
            stopMicrophoneAnalysis();
            startMicButton.disabled = false;
            stopMicButton.disabled = true;
            micStatus.textContent = "Analysis stopped";
        });
    }

    // Function to set up YouTube analysis
    function setupYoutubeAnalysis() {
        const youtubeSection = document.querySelector('.youtube-input');
        if (!youtubeSection) return;
        
        const urlInput = youtubeSection.querySelector('.bpm-input');
        const analyzeButton = youtubeSection.querySelector('.analyze-btn');
        const infoDiv = youtubeSection.querySelector('.youtube-info');
        const progressBar = youtubeSection.querySelector('.progress-bar');
        
        if (!analyzeButton || !urlInput || !infoDiv) return;
        
        analyzeButton.addEventListener('click', async function() {
            const youtubeUrl = urlInput.value.trim();
            
            if (!youtubeUrl) {
                infoDiv.textContent = "Please enter a YouTube URL";
                return;
            }
            
            if (!isValidYoutubeUrl(youtubeUrl)) {
                infoDiv.textContent = "Invalid YouTube URL format";
                return;
            }
            
            infoDiv.textContent = "Analyzing... (This may take a minute)";
            progressBar.style.display = "block";
            progressBar.innerHTML = ""; // Clear any existing content
            
            // Create and add the progress element
            const progressElement = document.createElement("div");
            progressElement.style.width = "0%";
            progressElement.style.height = "100%";
            progressElement.style.backgroundColor = "rgba(0, 200, 200, 0.7)";
            progressElement.style.borderRadius = "5px";
            progressElement.style.transition = "width 0.3s ease";
            progressBar.appendChild(progressElement);
            
            // Simulate progress while waiting for server response
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += 2;
                progressElement.style.width = Math.min(progress, 95) + "%";
                if (progress >= 95) clearInterval(progressInterval);
            }, 300);
            
            try {
                // Use the server endpoint to analyze the YouTube video
                const response = await fetch(`/analyze-youtube-bpm?url=${encodeURIComponent(youtubeUrl)}`);
                clearInterval(progressInterval);
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "Server error");
                }
                
                const data = await response.json();
                progressElement.style.width = "100%";
                
                // Display results
                infoDiv.innerHTML = `
                    <p><strong>${data.title}</strong></p>
                    <p>Detected BPM: ${data.bpm}</p>
                    <p>Duration: ${Math.floor(data.duration / 60)}:${String(data.duration % 60).padStart(2, '0')}</p>
                `;
                
                // Update the BPM display
                const bpmElement = document.getElementById("bpm");
                if (bpmElement) {
                    bpmElement.textContent = data.bpm;
                    bpmElement.setAttribute('data-bpm-display', data.bpm);
                    currentBPM = data.bpm;
                    lastKnownBPM = data.bpm;
                    customBPM = data.bpm;
                    // isCustomBPM = true; // Enable custom BPM mode
                    
                    // // Update background color based on BPM
                    // updateBackgroundColor(data.bpm);
                }
                
                setTimeout(() => {
                    progressBar.style.display = "none";
                }, 1000);
                
            } catch (error) {
                clearInterval(progressInterval);
                console.error("YouTube analysis error:", error);
                infoDiv.textContent = "Error analyzing video: " + error.message;
                progressBar.style.display = "none";
            }
        });
    }
    
    // Function to validate YouTube URL
    function isValidYoutubeUrl(url) {
        // Basic YouTube URL validation - checks for youtube.com or youtu.be
        const regex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
        return regex.test(url);
    }
    
    // Function to set up Tunebat analysis
    function setupTunebatAnalysis() {
        const tunebatSection = document.querySelector('.tunebat-input');
        if (!tunebatSection) return;
        
        const titleInput = tunebatSection.querySelectorAll('.bpm-input')[0];
        const artistInput = tunebatSection.querySelectorAll('.bpm-input')[1];
        const searchButton = tunebatSection.querySelector('.analyze-btn');
        const currentSongButton = tunebatSection.querySelector('.current-song-btn');
        const infoDiv = tunebatSection.querySelector('.tunebat-info');
        const progressBar = tunebatSection.querySelector('.progress-bar');
        
        if (!searchButton || !titleInput || !artistInput || !infoDiv) return;
        
        // Add a note about using Google Search
        const googleSearchNote = document.createElement('p');
        googleSearchNote.textContent = 'This method uses Google Search to find BPM information.';
        googleSearchNote.style.fontSize = '12px';
        googleSearchNote.style.opacity = '0.8';
        googleSearchNote.style.marginTop = '5px';
        
        // Insert the note after the inputs
        tunebatSection.insertBefore(googleSearchNote, infoDiv);
        
        // Add event listener for the "Use Current Song" button
        if (currentSongButton) {
            currentSongButton.addEventListener('click', function() {
                if (lastKnownSongDetails && lastKnownSongDetails !== "N/A") {
                    populateTunebatFields(lastKnownSongDetails);
                } else {
                    infoDiv.textContent = "No current song playing";
                }
            });
        }
        
        searchButton.addEventListener('click', async function() {
            const songTitle = titleInput.value.trim();
            const artist = artistInput.value.trim();
            
            if (!songTitle || !artist) {
                infoDiv.textContent = "Please enter both song title and artist";
                return;
            }
            
            // Clear any existing BPM option buttons before starting a new search
            clearBpmOptionButtons();
            
            infoDiv.textContent = "Searching Tunebat...";
            progressBar.style.display = "block";
            progressBar.innerHTML = ""; // Clear any existing content
            
            // Create and add the progress element
            const progressElement = document.createElement("div");
            progressElement.style.width = "0%";
            progressElement.style.height = "100%";
            progressElement.style.backgroundColor = "rgba(0, 200, 200, 0.7)";
            progressElement.style.borderRadius = "5px";
            progressElement.style.transition = "width 0.3s ease";
            progressBar.appendChild(progressElement);
            
            // Simulate progress
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += 10;
                progressElement.style.width = Math.min(progress, 90) + "%";
                if (progress >= 90) clearInterval(progressInterval);
            }, 200);
            
            try {
                // Use the server endpoint to search Tunebat
                const response = await fetch(`/search-tunebat?title=${encodeURIComponent(songTitle)}&artist=${encodeURIComponent(artist)}`);
                clearInterval(progressInterval);
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "Server error");
                }
                
                const data = await response.json();
                progressElement.style.width = "100%";
                
                // Check if the BPM was found or not
                if (data.bpm === 'N/A' || !data.success) {
                    infoDiv.innerHTML = `
                        <p><strong>${data.title} by ${data.artist}</strong></p>
                        <p>BPM: Not found</p>
                        <p>No BPM data found via Google search</p>
                    `;
                } else {
                    // Include confidence if available
                    const confidenceInfo = data.confidence ? ` (confidence: ${data.confidence}%)` : '';
                    
                    // Display results
                    infoDiv.innerHTML = `
                        <p><strong>${data.title} by ${data.artist}</strong></p>
                        <p>BPM: ${data.bpm}${confidenceInfo}</p>
                        <p>Found via Google search</p>
                    `;
                    
                    // Update the BPM display
                    const bpmElement = document.getElementById("bpm");
                    if (bpmElement) {
                        bpmElement.textContent = data.bpm;
                        bpmElement.setAttribute('data-bpm-display', data.bpm);
                        currentBPM = data.bpm;
                        lastKnownBPM = data.bpm;
                        
                        // Update background color based on BPM
                        updateBackgroundColor(data.bpm);
                        updateTransition();
                        
                        // Display BPM cluster options if available
                        if (data.bpm_clusters && data.bpm_clusters.length > 0) {
                            displayBpmOptionButtons(data.bpm_clusters, data.bpm);
                        }
                    }
                }
                
                setTimeout(() => {
                    progressBar.style.display = "none";
                }, 1000);
                
            } catch (error) {
                clearInterval(progressInterval);
                console.error("Tunebat search error:", error);
                infoDiv.textContent = "Error searching: " + error.message;
                progressBar.style.display = "none";
            }
        });
    }
    
    // Simple string hash function for demonstration purposes
    function hashCode(str) {
        let hash = 0;
        if (str.length === 0) return hash;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

     // Start microphone analysis
     async function startMicrophoneAnalysis() {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256; // Small enough for efficiency
            
            // Create gain node for volume control
            gainNode = audioContext.createGain();
            gainNode.gain.value = volumeGain;
            
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
            
            microphone = audioContext.createMediaStreamSource(stream);
            
            // Connect microphone -> gain -> analyser
            microphone.connect(gainNode);
            gainNode.connect(analyser);
            
            dataArray = new Uint8Array(analyser.frequencyBinCount);
            peakTimes = [];
            bpmHistory = [];
            startTime = Date.now();
            lastPeakTime = 0;
            
            // Start the analysis loop
            microphoneActive = true;
            setupWaveformCanvas();
            requestAnimationFrame(analyzeAudio);
            
            // Set isCustomBPM to true to use microphone-detected BPM
            // isCustomBPM = true;
        } catch (error) {
            console.error("Error accessing microphone:", error);
            const micStatus = document.querySelector('.mic-status');
            if (micStatus) {
                micStatus.textContent = "Error: Could not access microphone";
            }
        }
    }

    // Stop microphone analysis
    function stopMicrophoneAnalysis() {
        if (audioContext) {
            if (microphone) {
                microphone.disconnect();
                microphone = null;
            }
            
            if (gainNode) {
                gainNode.disconnect();
                gainNode = null;
            }
            
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
                animationFrame = null;
            }
            
            microphoneActive = false;
            
            // Close the audio context to release resources
            if (audioContext.state !== 'closed') {
                audioContext.close().then(() => {
                    audioContext = null;
                    analyser = null;
                }).catch(err => console.error("Error closing audio context:", err));
            }
        }
    }

    // Setup canvas for waveform display
    function setupWaveformCanvas() {
        const canvas = document.getElementById('waveformCanvas');
        if (!canvas) return;
        
        // Set canvas dimensions
        const container = canvas.parentElement;
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
        
        // Clear the canvas
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Analyze audio from microphone
    function analyzeAudio() {
        if (!microphoneActive || !analyser) {
            return;
        }
        
        analyser.getByteTimeDomainData(dataArray);
        
        // Calculate volume level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const value = (dataArray[i] - 128) / 128;
            sum += value * value;
        }
        const volume = Math.sqrt(sum / dataArray.length);
        
        // Draw waveform
        drawWaveform(volume);
        
        // Detect beats
        detectBeats(volume);
        
        // Continue the loop
        animationFrame = requestAnimationFrame(analyzeAudio);
    }

    // Draw the audio waveform
    function drawWaveform(volume) {
        const canvas = document.getElementById('waveformCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear the canvas
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, width, height);
        
        // Draw the waveform
        ctx.lineWidth = 2;
        ctx.strokeStyle = volume > beatThreshold ? '#00FFFF' : '#00AAAA';
        ctx.beginPath();
        
        const sliceWidth = width / dataArray.length;
        let x = 0;
        
        for (let i = 0; i < dataArray.length; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * height / 2;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            
            x += sliceWidth;
        }
        
        ctx.stroke();
        
        // Draw volume meter
        ctx.fillStyle = volume > beatThreshold ? 'rgba(0, 255, 255, 0.7)' : 'rgba(0, 170, 170, 0.5)';
        ctx.fillRect(0, height - 5, volume * width, 5);
        
        // Draw threshold line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.moveTo(beatThreshold * width, 0);
        ctx.lineTo(beatThreshold * width, height);
        ctx.stroke();
    }

    // Detect beats from audio data
    function detectBeats(volume) {
        const now = Date.now();
        const micStatus = document.querySelector('.mic-status');
        const waveformContainer = document.querySelector('.waveform-container');
        const bpmDisplayConfirmation = document.querySelector('.bpm-display-confirmation');
        
        // Simple beat detection by threshold crossing
        if (volume > beatThreshold && now - lastPeakTime > 200) { // Minimum 200ms between beats to avoid double-triggering
            lastPeakTime = now;
            peakTimes.push(now);
            
            // Visual feedback for beat detection
            if (waveformContainer) {
                waveformContainer.classList.add('beat');
                setTimeout(() => {
                    waveformContainer.classList.remove('beat');
                }, 100);
            }
            
            // If flashOnBeat is enabled, flash on every detected beat
            if (flashOnBeat) {
                // Use random color from the current color palette for immediate visual feedback
                const colors = customFlashingColors.length > 0 ? customFlashingColors : savedExtractedColors;
                if (colors && colors.length > 0) {
                    const randomColor = colors[Math.floor(Math.random() * colors.length)];
                    document.body.style.backgroundColor = randomColor;
                    sendColorToSecondary(randomColor);
                }
            }
            
            // Keep only the last 30 seconds of peaks
            const thirtySecondsAgo = now - 30000;
            while (peakTimes.length > 0 && peakTimes[0] < thirtySecondsAgo) {
                peakTimes.shift();
            }
            
            // Calculate BPM once we have enough peaks
            if (peakTimes.length >= 4) {
                const intervals = [];
                for (let i = 1; i < peakTimes.length; i++) {
                    intervals.push(peakTimes[i] - peakTimes[i - 1]);
                }
                
                // Use the median interval to filter out outliers
                intervals.sort((a, b) => a - b);
                const medianInterval = intervals[Math.floor(intervals.length / 2)];
                
                // Filter intervals close to the median
                const validIntervals = intervals.filter(interval => 
                    Math.abs(interval - medianInterval) / medianInterval < 0.3
                );
                
                if (validIntervals.length > 0) {
                    // Calculate average of valid intervals
                    const avgInterval = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
                    const calculatedBPM = Math.round(60000 / avgInterval);
                    
                    // Only accept reasonable BPM values
                    if (calculatedBPM >= 60 && calculatedBPM <= 200) {
                        bpmHistory.push(calculatedBPM);
                        
                        // Keep history manageable
                        if (bpmHistory.length > 10) {
                            bpmHistory.shift();
                        }
                        
                        // Calculate the average BPM
                        const avgBPM = Math.round(bpmHistory.reduce((a, b) => a + b, 0) / bpmHistory.length);
                        
                        // Only update BPM if stable updates are disabled or if it's time for an update
                        const shouldUpdateBPM = !stableBpmUpdates || (now - lastBpmUpdateTime >= bpmUpdateInterval);
                        
                        if (shouldUpdateBPM) {
                            lastBpmUpdateTime = now;
                            
                            // Update the BPM display
                            const bpmElement = document.getElementById("bpm");
                            if (bpmElement) {
                                bpmElement.textContent = avgBPM;
                                bpmElement.setAttribute('data-bpm-display', avgBPM);
                                // Set customBPM and lastKnownBPM for use in other parts of the app
                                customBPM = avgBPM;
                                currentBPM = avgBPM;
                                lastKnownBPM = avgBPM;
                                
                                // Update the custom BPM input field for reference
                                const customBPMInput1 = document.getElementById("custom-bpm-input");
                                if (customBPMInput1) {
                                    customBPMInput1.value = avgBPM;
                                }
                                
                                // Update background color based on BPM only if not in flashOnBeat mode
                                if (!flashOnBeat) {
                                    updateBackgroundColor(avgBPM);
                                }
                            }
                            
                            // Update the BPM display near the waveform
                            if (bpmDisplayConfirmation) {
                                bpmDisplayConfirmation.textContent = `BPM: ${avgBPM}`;
                            }
                        }
                        
                        // Always update confidence in status
                        if (micStatus) {
                            const confidence = Math.min(100, Math.round((validIntervals.length / intervals.length) * 100));
                            const timeToNextUpdate = stableBpmUpdates ? 
                                Math.max(0, Math.round((bpmUpdateInterval - (now - lastBpmUpdateTime)) / 1000)) : 0;
                            
                            micStatus.textContent = `BPM: ${avgBPM} (${confidence}% confidence)` + 
                                (stableBpmUpdates && timeToNextUpdate > 0 ? ` - Update in ${timeToNextUpdate}s` : '');
                        }
                    }
                }
            }
        }
    }

    // Function to get a cookie value by name
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(";").shift();
    }
    // Function to delete a cookie
    function deleteCookie(name) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      console.log(`cookie ${name} deleted`);
    }
  
    // Function to redirect to Spotify login
    loginButton.addEventListener("click", function () {
        console.log("Login Clicked");
        window.location.href = "/login"; // Redirect to the "/login" URL
    });


  // Function to refresh the access token
  async function refreshAccessToken() {
      try {
          const response = await fetch('/refresh-token', {
              method: 'GET',
              // Add any headers or credentials if needed
          });

          if (response.status === 200) {
              console.log('Access token refreshed successfully');
              accessToken=getCookie("access_token");
              isTokenExpired = false;
              // You can perform any additional actions here
          } else {
              console.error('Error refreshing access token:', response.statusText);
          }
      } catch (error) {
          console.error('Error refreshing access token:', error);
      }
  }

  // Call the refreshAccessToken function initially
  refreshAccessToken();

  // Set up an interval to refresh the access token every 30 minutes (30 minutes * 60 seconds * 1000 milliseconds)
  const refreshInterval = 30 * 60 * 1000;

  setInterval(refreshAccessToken, refreshInterval);


        // Function to check if the access token is expired and refresh it if possible
    async function checkAndRefreshToken() {
      await refreshAccessToken();
        try {
            const response = await fetch("https://api.spotify.com/v1/me", {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                },
            });

            if (response.status === 401) {
                // Access token has expired or not provided
                handleTokenExpiration();
                document.getElementById("song-details").style.display = "none";
                console.log("Access token not accepted");
                isTokenExpired = true;
            }
        } catch (error) {
            console.error("Error checking/accessing token:", error);
        }
    }
  
    // Call the function on startup
    checkAndRefreshToken();
    
    async function isPlaybackActive() {
      if(isTokenExpired){
        await checkAndRefreshToken();
        if(isTokenExpired){
        handleTokenExpiration()
        Promise.resolve(false)
        return false;
        }
      }else{
        try {
            const response = await fetch('https://api.spotify.com/v1/me/player', {
                headers: {
                    Authorization: `Bearer ${accessToken}`, // Replace with your access token
                },
            });
    
            if (response.status === 200) {
                const data = await response.json();
                isShuffleEnabled = data.shuffle_state;
                shuffleFromPlaybackCheck = data.shuffle_state
                const shuffleIcon = document.getElementById("shuffle-icon");
                const unshuffleIcon = document.getElementById("unshuffle-icon");

              if(data.device && data.device.volume_percent){
              
              currentVolume = data.device.volume_percent;
              console.log("Current Volume:", currentVolume);
              updateVolumeSlider();
              }

              totalDuration = data.item.duration_ms;
              currentPosition = data.progress_ms;
              

              // Call the function to update the progress bar
              updateProgressBar(totalDuration, currentPosition);
              
                if (!isShuffleEnabled) {
                      unshuffleIcon.style.display = "none";
                      shuffleIcon.style = "";
                } else {
                      shuffleIcon.style.display = "none";
                      unshuffleIcon.style = "";
                    }
              togglePlayPauseIcon(data.is_playing); // Change icon to pause
                return data.is_playing;
            } else if(response.status === 401){
              await checkAndRefreshToken();
              await isPlaybackActive();
            }else {
              console.log(`resp stat in last else ${response.status}`)
                return false;
            }
        } catch (error) {
            console.error('Error checking playback state:', error);
            return false;
        }
      }
    }
  async function isShuffleActive() {
    if(isTokenExpired){
      await checkAndRefreshToken();
      if(isTokenExpired){
      handleTokenExpiration()
      Promise.resolve(false)
      return false;
      }
    }else{
      try {
          const response = await fetch('https://api.spotify.com/v1/me/player', {
              headers: {
                  Authorization: `Bearer ${accessToken}`, // Replace with your access token
              },
          });

          if (response.status === 200) {
              const data = await response.json();
              isShuffleEnabled = data.shuffle_state;
              shuffleFromPlaybackCheck = data.shuffle_state
              const shuffleIcon = document.getElementById("shuffle-icon");
              const unshuffleIcon = document.getElementById("unshuffle-icon");

              if (!isShuffleEnabled) {
                    unshuffleIcon.style.display = "none";
                    shuffleIcon.style = "";
              } else {
                    shuffleIcon.style.display = "none";
                    unshuffleIcon.style = "";
                  }
              return data.shuffle_state;
          } else if(response.status === 401){
            await checkAndRefreshToken();
            await isShuffleActive();
          }else {
            console.log(`resp stat in last else ${response.status}`)
              return false;
          }
      } catch (error) {
          console.error('Error checking playback state:', error);
          return false;
      }
    }
  }

    // Function to periodically check if playback is active
    async function checkPlaybackStatus() {
      if(!isTokenExpired && !(isCustomBPM || customTrackURL)){
//        isPlaying = await isPlaybackActive();
        console.log('Playback is active: ', isPlaying);
      }else{
        isPlaying=false;
      console.log('Playback is active: ', isPlaying);
      }
    }
    
    // Initialize isPlaying variable and perform initial check
    (async () => {
//        isPlaying = await isPlaybackActive();
        console.log('Playback is active:', isPlaying);
      
        const interval = setInterval(async () => {
            // checkPlaybackStatus();
            updateBPMOverlay();
        }, 30000);
    })();




  
  
      async function fetchTrackURL(accessToken) {
        if (isTokenExpired) {
          await checkAndRefreshToken();
          if(isTokenExpired){
            handleTokenExpiration();
            Promise.resolve("");
            return;
          }
        }
        try {
            const response = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                },
            });

                    if (response.status === 401) {
                // Access token has expired or not provided
                      await checkAndRefreshToken();
                      await fetchTrackURL(accessToken);
                // handleTokenExpiration();
                // console.log("Access token expired.");
                // isTokenExpired = true;
                // return 0;
            }

            const data = await response.json();

            if (data.item && data.item.external_urls && data.item.external_urls.spotify) {
                // Fetch audio features for the currently playing track
                const trackURLResp = data.item.external_urls.spotify;
                console.log(trackURLResp);
                return trackURLResp;
            }
        }catch (error) {
            console.error("Error fetching Spotify Currently Playing track URL:", error);
            return 0;
        }
      }



        
    // Function to fetch the BPM from Spotify using the access token
    async function fetchBPMFromSpotify(accessToken) {
        if (isTokenExpired) {
          await checkAndRefreshToken();
          if(isTokenExpired){
            handleTokenExpiration();
            Promise.resolve(0);
            return 0;
          }
        }
        try {
            const response = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                },
            });

            if (response.status === 401) {
                await checkAndRefreshToken();
                await fetchBPMFromSpotify(accessToken);
                // // Access token has expired or not provided
                // handleTokenExpiration();
                // console.log("Access token expired.");
                // isTokenExpired = true;
                // return 0;
            }

            const data = await response.json();

            if (data.item && data.item.id) {
                // Fetch audio features for the currently playing track
                const audioFeaturesResponse = await fetch(`https://api.spotify.com/v1/audio-features/${data.item.id}`, {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                    },
                });

                const audioFeatures = await audioFeaturesResponse.json();

                if (audioFeatures.tempo) {
                    // Reset the token expiration flag
                    isTokenExpired = false;
                    return audioFeatures.tempo;
                } else {
                    return 0;
                }
            } else {
                // No currently playing track, or data is missing
                return 0;
            }
        } catch (error) {
            console.error("Error fetching BPM from Spotify:", error);
            return 0;
        }
    }

    // Function to fetch the song title from Spotify using the access token
    async function fetchSongTitleFromSpotify(accessTokenIn) {
        if (isTokenExpired) {
          await checkAndRefreshToken();
          if(isTokenExpired){
            handleTokenExpiration();
            Promise.resolve("");
            return;
          }
        }
        if(!isPlaying){
            Promise.resolve(null);
            return;
        }
        try {
            const response = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${accessTokenIn}`,
                },
            });

            if (response.status === 401) {
                await checkAndRefreshToken();
                // // Access token has expired or not provided
                // handleTokenExpiration();
                // console.log("Access token expired.");
                // isTokenExpired = true;
                // return 0;
              await fetchSongTitleFromSpotify(accessToken);
            }
          
            const data = await response.json();
            if (data.item && data.item.name) {
              if(data.context && data.context.external_urls && data.context.external_urls.spotify){    
                  console.log("data.context.external_urls.spotify"+" - "+data.context.external_urls.spotify)
                        embedPlaylist(data.context.external_urls.spotify)
              }
              if(data.item.external_urls && data.item.external_urls.spotify){
                currentSongUrl=data.item.external_urls.spotify;
                  if(!(data.context && data.context.external_urls && data.context.external_urls.spotify)){   
                        embedPlaylist(data.item.external_urls.spotify)
                        }
            }else{
                currentSongUrl=null;
            }
              
              console.log(currentSongUrl+" currentsongurl");
                const songName = data.item.name;
                const artists = data.item.artists.map(artist => artist.name).join(', ');
              totalDuration = data.item.duration_ms;
              currentPosition = data.progress_ms;
              

              // Call the function to update the progress bar
              updateProgressBar(totalDuration, currentPosition);
                return `${artists} - ${songName}`;
            } else {
                return "N/A";
            }
          
        } catch (error) {
            console.error("Error fetching song title from Spotify:", error);
            return "N/A";
        }
    }

function updateVolumeSlider() {
  const volumeSlider = document.getElementById('volumeRange');
  
  // Set the value of the volume slider based on the current volume
  volumeSlider.value = currentVolume;
}

// Global variable to store the progress bar element
const progressRange = document.getElementById('progressRange');

// Function to update the progress bar smoothly
function updateProgressBar(totalDurationMillis, currentPositionMillis) {
    // Calculate the percentage of progress
    const progressPercentage = (currentPositionMillis / totalDurationMillis) * 100;

    // Update the value of the progress bar with a smooth animation
progressRange.style.transition = `value 0.5s ease-in 0.6s`;
progressRange.value = progressPercentage;
}

// Variable to store the timestamp of the last input event
let lastInputTimestamp1 = 0;

// Event listener for user interaction with the progress bar
progressRange.addEventListener('change', async function () {
    const currentTimestamp = new Date().getTime();

    // Calculate the time difference since the last input event
    const timeDifference = currentTimestamp - lastInputTimestamp1;

    // Update the last input timestamp
    lastInputTimestamp1 = currentTimestamp;

    // Check if the time difference is greater than a threshold (e.g., 100 milliseconds)
    if (timeDifference > 1000) {
        // Your existing logic here
        const selectedPercentage = progressRange.value;
        const newPosition = (selectedPercentage / 100) * totalDuration;
        updateProgressBar(totalDuration, newPosition);

        // Call the function to seek to the new position
        await seekToPosition(newPosition); // Replace with your actual seek function
    }
});



let isSongProg=false;
async function seekToPosition(position) {
  if(!isSongProg){
    isSongProg = true;
    if (isTokenExpired) {
        await checkAndRefreshToken();
        if (isTokenExpired) {
            handleTokenExpiration();
            return;
        }
    }

    try {
        const response = await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${parseInt(position,10)}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (response.status === 204) {
          currentPosition = parseInt(position,10);
          await waitMS(55);
          updateProgressBar(totalDuration, currentPosition)
            
  isSongProg = false;
          await isPlaybackActive();
            console.log('Seek successful.');
        } else if (response.status === 401) {
            await checkAndRefreshToken();
            console.log('Seek successful.');
        } else {
            console.error('Error seeking to position:', response.statusText);
        }
    } catch (error) {
        console.error('Error seeking to position:', error);
    }
  await waitMS(152);
  isSongProg = false;
  }
}

  
  
      async function embedPlaylist(url) {

        const contextDiv = document.getElementById('context-current-playlist');
        const iframeSrc = url.replace('open.spotify', 'embed.spotify');
        const existingIframe = contextDiv.querySelector(`iframe[src="${iframeSrc}"]`);
        if (existingIframe) {
          // If an iframe with the same source URL already exists, do nothing.
          return;
        }

        // If an iframe with the same source URL does not exist, clear the div context and append a new one.
        contextDiv.innerHTML = '';
        const iframe = document.createElement('iframe');
        const embed = document.createElement('embed');
        iframe.src = iframeSrc;
        iframe.width = 'inherit';
        iframe.height = '361';
        iframe.style.mixBlendMode = "multiply";
        iframe.style.border = "none";
        iframe.style.borderRadius = "10px";
        iframe.style.boxShadow = "0px 0px 10px rgba(0, 0, 0, 0.5)";
        iframe.style.backgroundColor = "rgba(1, 1, 1, 0.2)";
        contextDiv.style.border = "none";
        contextDiv.style.borderRadius = "10px";
        contextDiv.style.mixBlendMode = "add";
        contextDiv.style.backgroundColor = "rgba(1, 1, 1, 0.2)";
        // Attach the listener function to the load event of the iframe element
        iframe.addEventListener("load", listener);
        contextDiv.appendChild(iframe);

        function listener() {
          // Create an async function that waits for 7 seconds
async function wait7Seconds() {
  // Use the await keyword to pause the execution until the promise is resolved
  await new Promise((resolve) => setTimeout(resolve, 7000));
  // Return a value
  return "Done waiting!";
}

// Call the async function and use the .then() method to handle the promise
wait7Seconds().then((value) => {
  // Log the value to the console

          // Get the element with the custom attribute
          var element = document.querySelector('[id="context-current-playlist"]');

          // Get all of its children
          var children = element.children;
          
          // Loop through the children and set their background color to opacity 0
          for (var i = 0; i < children.length; i++) {
            children[i].style.backgroundColor = "rgba(0, 0, 0, 80)"; // transparent
          
            
          }

            console.log(value); // "Done waiting!"
});
        }



      }

  
    // Function to fetch BPM from a custom track URL
    async function fetchBPMFromCustomTrackURL(trackURL) {
        try {
            // Extract the track ID from the Spotify URL
            const trackId = extractTrackIdFromURL(trackURL);
            console.log(trackId);
            if (trackId) {
                // Fetch audio features for the track from the Spotify Web API
                const audioFeatures = await fetchAudioFeatures(trackId, accessToken);

                // Extract the BPM from the audio features
                const bpm = audioFeatures.tempo || "N/A";

                return bpm;
            } else {
                console.error("Invalid Spotify Track URL.");
                showAlert("Invalid Spotify Track URL.");
                return "N/A";
            }
        } catch (error) {
            console.error("Error fetching BPM from Custom Track URL:", error);
            return "N/A";
        }
    }

    // Function to extract the track ID from a Spotify track URL
    function extractTrackIdFromURL(trackURL) {
      
        // Use a regular expression to extract the track ID from the URL
        const match = trackURL.match(/\/track\/([a-zA-Z0-9]+)/);
        console.log(match + " extracted id")
        if (match && match[1]) {
            return match[1];
        } else {
            return null;
        }
    }

    // Function to fetch audio features for a track from the Spotify Web API
    async function fetchAudioFeatures(trackId, accessToken) {
        try {
        //     const response = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
        //         method: "GET",
        //         headers: {
        //             "Authorization": `Bearer ${accessToken}`,
        //         },
        //     });

                    const data = await fetchBPMFromTunebat(document.getElementById("tunebat-title").value, document.getElementById("tunebat-artist").value);
            data.tempo = data.bpm;

            return data;
        } catch (error) {
            console.error("Error fetching audio features:", error);
            throw error;
        }
    }

    // Function to fetch audio features for a track from the Spotify Web API
    async function fetchTrackInfo(trackId, accessToken) {
        try {
            const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                },
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Error fetching song details:", error);
            throw error;
        }
    }

    let runCount=0;
  
    // Function to update the overlay with BPM and song title
    async function updateBPMOverlay() {
      
        try {
            let bpm = 0;
            let songTitle = "custom";
            songAndBPMUpdated=false;
            isTransitionUpdated = true;
            const toggleChecked = document.getElementById("extract-toggle").checked;
  
            if (isCustomBPM) {
                // Use the custom BPM if set
                bpm = customBPM == 0 ? Math.round(document.getElementById("bpm").textContent.trim()) : customBPM;
                lastKnownBPM = bpm;
                // // Hide the "Now Playing" indicator when using custom BPM
                // document.getElementById("now-playing").style.display = "none";
                // document.getElementById("skip-mode-container").style.display = "none";
              let multipliedBPM = bpmMultiplier * lastKnownBPM;
              if(multipliedBPM !== lastBPMMultiplied){
                lastBPMMultiplied = multipliedBPM;
                updateBackgroundColor(lastBPMMultiplied);
                bpmElement.textContent = lastBPMMultiplied;
              }
                // Update the "Switch to Currently Playing" button
                updateSwitchToCurrentlyPlayingButton();
                if (customTrackURL === "") {
                    document.getElementById("song-details").style.display = "none";
                } else {
                    if (!isTokenExpired) {
                        document.getElementById("song-details").style.display = "block";
                        document.getElementById("toggle-container").style.display = "flex";
                        const trackId = extractTrackIdFromURL(customTrackURL);
                        const data = await fetchTrackInfo(trackId, accessToken);
                        if (data.name) {
                            const songName = data.name;
                            const artists = data.artists.map(artist => artist.name).join(', ');
                            songTitle = `${artists} - ${songName}`;
                            if(songTitle !== lastKnownSongDetails){
                            songTitleElement.textContent = songTitle;
                            lastKnownSongDetails = songTitle;
                            
                            // Update Tunebat fields when using custom track URL
                            populateTunebatFields(songTitle);
                            }
                        } else {
                            songTitle = "N/A";
                            songTitleElement.textContent = songTitle;
                        }
                    }
                }
            } else if (!isTokenExpired) {
                if(!isPlaying){
                  console.log(`${isPlaying} playing in if`);
                document.getElementById("song-details").style.display = "none";
                // document.getElementById("toggle-container").style.display = "flex";
                document.getElementById("now-playing").textContent = "Nothing currently playing";
                document.getElementById("now-playing").style.display = "block";
                }else{
                  console.log(`${isPlaying} playing in else`);
                  if(!isSkipping){
                document.getElementById("now-playing").textContent = "• Now Playing";
                  }
                // Fetch the currently playing song title
                songTitle = await fetchSongTitleFromSpotify(accessToken);
                  if(songTitle !== lastKnownSongDetails){
                      songTitleElement.textContent = songTitle;
                      try{
                        if(songTitle!=="custom" && songTitle!=="N/A" && bpmMultiplier !== 0){
                        bpm = await fetchBPMFromSpotify(accessToken);
                        lastKnownBPM = bpm;
                          songAndBPMUpdated=true;

                                        if(toggleChecked && document.getElementById("song-details").style.display!=="none"){
                                          if(!isSkipInProgress && toggleChecked){
                                          const currentlyPlayingURL = await fetchTrackURL(accessToken);
                                          // console.log(currentlyPlayingURL);
                                          await fetchAndExtractColorsForTrack(currentlyPlayingURL,accessToken);
                                          }
                                        }
                          document.getElementById("now-playing").textContent = "• Now Playing";
                          updateTransition();
                        }} catch (error) {
                    console.error("Error fetching BPM:", error);
                }

                    try{
                        if(songTitle!=="custom" && songTitle!=="N/A" && isSkipping && bpmMultiplier == 0){
                        bpm = Math.round(document.getElementById("bpm").textContent.trim()); //await fetchBPMFromSpotify(accessToken);
                        lastKnownBPM = bpm;
                          songAndBPMUpdated=true;
                          
                          updateTransition();
                          
                          const nowPl=document.getElementById("now-playing");
                          nowPl.style.display = "block";
                          nowPl.textContent = `• Now Playing Without Flash\n - \n${lastKnownBPM}`;
                        }} catch (error) {
                    console.error("Error fetching BPM in skipping mode:", error);
                      
                  }
              lastKnownSongDetails = songTitle;
                          
                          // Update Tunebat fields with the new song details
                          populateTunebatFields(songTitle);
                          
                          if (songAndBPMUpdated) {
                        // Call the function to listen for song changes
                        if(parseFloat(document.getElementById("bpm").textContent.trim()) !== 0){
                        listenForSongChanges();
                        }
                        autoSaveLastSongDetails = lastKnownSongDetails;
                        autoSaveLastBPM = lastKnownBPM;
                        autoSaveLastSongUrl = currentSongUrl;
                        autoSaveTimeStamp = Date.now();
                    }
                document.getElementById("song-details").style.display = "block";
                document.getElementById("toggle-container").style.display = "flex";

                if (bpmMultiplier == 0 && !isSkipping) {
                    // Hide the "Now Playing" indicator when using custom BPM
                    document.getElementById("now-playing").style.display = "none";
                } else {
                    if (!isTokenExpired) {
                        document.getElementById("now-playing").style.display = "block";
                    }
                }
            }
            
            }


            // Check if the fetched BPM is different from the last known BPM
            if (bpm !== lastKnownBPM && bpm !== 0) {
                lastKnownBPM = bpm;                
            }

          
            let multipliedBPM = bpmMultiplier * lastKnownBPM;
            if(multipliedBPM !== lastBPMMultiplied){
              lastBPMMultiplied = multipliedBPM;
              updateBackgroundColor(lastBPMMultiplied);
              bpmElement.textContent = lastBPMMultiplied;
            }
          
    console.log("skip is checking");
              if(isSkipping){
    await performSkipBasedOnMode();
              }
            // Update the "Switch to Currently Playing" button
            updateSwitchToCurrentlyPlayingButton();


          
            }
                      if(subCode){
              sendOverlayData();
              }
        }catch (error) {
            console.error("Error fetching BPM:", error);
            showAlert("Error fetching BPM. Please try again.");
        }
    }

    // // Function to update the overlay with BPM and song title
    // async function updateBPMOverlay() {
    //     try {
    //         let bpm = 0;
    //         let songTitle = "custom";
    //         songAndBPMUpdated = false;
    //         isTransitionUpdated = true;
    //         const toggleChecked = document.getElementById("extract-toggle").checked;
    
    //         if (isCustomBPM) {
    //             // Use the custom BPM if set
    //             bpm = customBPM;
    //             // Hide the "Now Playing" indicator when using custom BPM
    //             document.getElementById("now-playing").style.display = "none";
    //             if (customTrackURL === "") {
    //                 document.getElementById("song-details").style.display = "none";
    //             } else if (!isTokenExpired) {
    //                     document.getElementById("song-details").style.display = "block";
    //                     document.getElementById("toggle-container").style.display = "flex";
    //                     const trackId = extractTrackIdFromURL(customTrackURL);
    //                     const data = await fetchTrackInfo(trackId, accessToken);
    //                     if (data.name) {
    //                         const songName = data.name;
    //                         const artists = data.artists.map(artist => artist.name).join(', ');
    //                         songTitle = `${artists} - ${songName}`;
    //                         if (songTitle !== lastKnownSongDetails) {
    //                             songTitleElement.textContent = songTitle;
    //                             lastKnownSongDetails = songTitle;
    //                         }
    //                     } else {
    //                         songTitle = "N/A";
    //                         songTitleElement.textContent = songTitle;
    //                     }
    //                 }
    //         } else if (!isTokenExpired) {
    //             // Check if playback is active before fetching data
    //             if ((await isPlaying)===false) {
    //                 document.getElementById("song-details").style.display = "none";
    //                 document.getElementById("now-playing").textContent = "Nothing currently playing";
    //                 document.getElementById("now-playing").style.display = "block";
    //             } else {
    //                 if (isFirstExecution) {
    //                     // Introduce a delay of 100ms for the first execution
    //                     await new Promise(resolve => setTimeout(resolve, 100));
    //                     isFirstExecution = false; // Set the flag to false after the first execution
    //                 }
    //                 document.getElementById("now-playing").textContent = "• Now Playing";
    //                 // Fetch the currently playing song title
    //               if(isPlaying){
    //                 songTitle = await fetchSongTitleFromSpotify(accessToken);
    //               }
    //                 if (songTitle !== lastKnownSongDetails) {
    //                     songTitleElement.textContent = songTitle;
    //                     try {
    //                         if (songTitle !== "custom" && songTitle !== "N/A" && bpmMultiplier !== 0) {
    //                             bpm = await fetchBPMFromSpotify(accessToken);
    //                             lastKnownBPM = bpm;
    //                             songAndBPMUpdated = true;
    //                             document.getElementById("skip-mode-container").style.display = "none";
    //                             if (toggleChecked && document.getElementById("song-details").style.display == "block") {
    //                                 const currentlyPlayingURL = await fetchTrackURL(accessToken);
    //                                 console.log(currentlyPlayingURL);
    //                                 fetchAndExtractColorsForTrack(currentlyPlayingURL, accessToken);
    //                             }
    //                             updateTransition();
    //                         }
    //                     } catch (error) {
    //                         console.error("Error fetching BPM:", error);
    //                     }
    //                     lastKnownSongDetails = songTitle;
    //                 }
    
    //                 document.getElementById("song-details").style.display = "block";
    //                 document.getElementById("toggle-container").style.display = "flex";
    
    //                 if (bpmMultiplier == 0) {
    //                     // Hide the "Now Playing" indicator when using custom BPM
    //                     document.getElementById("now-playing").style.display = "none";
    //                 } else {
    //                     if (!isTokenExpired) {
    //                         document.getElementById("now-playing").style.display = "block";
    //                     }
    //                 }
    //             }
    //         }
    
    //         // Check if the fetched BPM is different from the last known BPM
    //         if (bpm !== lastKnownBPM && bpm !== 0) {
    //             lastKnownBPM = bpm;
    //         }
    
    //         let multipliedBPM = bpmMultiplier * lastKnownBPM;
    //         if (multipliedBPM !== lastBPMMultiplied) {
    //             lastBPMMultiplied = multipliedBPM;
    //             updateBackgroundColor(lastBPMMultiplied);
    //             bpmElement.textContent = lastBPMMultiplied;
    //         }
    
    //         // Update the "Switch to Currently Playing" button
    //         updateSwitchToCurrentlyPlayingButton();
    
    //         // Check if skipping is active and not in custom BPM mode
    //         if (isSkipping && !isCustomBPM) {
    //             const selectedMode = document.getElementById("skip-mode-dropdown").value;
    //             const bpmThresholdInput = document.getElementById("bpm-threshold");
    //             const lowRangeInput = document.getElementById("low-range");
    //             const highRangeInput = document.getElementById("high-range");
    
    //             switch (selectedMode) {
    //                 case "below":
    //                 case "above":
    //                     if (validateBPMThresholdInput(bpmThresholdInput.value)) {
    //                         // Call the appropriate skip update function for "below" and "above" modes here.
    //                         if (selectedMode === "below") {
    //                             await skipBelowBPM(bpmThresholdInput.value);
    //                         } else if (selectedMode === "above") {
    //                             await skipAboveBPM(bpmThresholdInput.value);
    //                         }
    //                     }
    //                     break;
    //                 case "outside":
    //                     if (validateRangeInputs(lowRangeInput.value, highRangeInput.value)) {
    //                         // Call the skip update function for "outside" mode here.
    //                         await skipOutsideBPMRange(lowRangeInput.value, highRangeInput.value);
    //                     }
    //                     break;
    //             }
    //         }
    //     } catch (error) {
    //         console.error("Error fetching BPM:", error);
    //         showAlert("Error fetching BPM. Please try again.");
    //     }
    // };


// Add an event listener to the skip button
const skipButton = document.getElementById("skip-button");
skipButton.addEventListener("click", () => toggleSkip(skipButton));

// Function to toggle the skip button text and isSkipping value
function toggleSkip(skipButton) {
  
    if (!isCustomBPM) {
        if (isSkipping) {
            skipButton.textContent = "Start Skipping";
        } else {
            skipButton.textContent = "Stop Skipping";
        }
        isSkipping = !isSkipping; // Toggle the isSkipping value
        isSkipping ? (console.log("skipping"), updateBPMOverlay()) : console.log("not skipping");
    }
}

    


    


    // // Function to validate the BPM threshold input
    // function validateBPMThresholdInput(inputValue) {
    //       if (!inputValue) {
    //     // No input, no need to display an alert
    //     return false;
    // }
    //     const bpmThreshold = parseFloat(inputValue);
    //     if (isNaN(bpmThreshold) || bpmThreshold <= 0 || bpmThreshold >= 10000) {
    //         alert("Please enter a valid BPM threshold (a positive number less than 10,000).");
    //         return false;
    //     }
    //     return true;
    // }
    
    // // Function to validate the low range input and high range input (for outside mode)
    // function validateRangeInputs(lowRangeInputValue, highRangeInputValue) {
    //           if (!lowRangeInputValue && !highRangeInputValue) {
    //     // Both fields are empty, no need to display an alert
    //     return false;
    // } else if (!lowRangeInputValue || !highRangeInputValue) {
    //     // One of the fields is empty, display an alert
    //     return false;
    // }
    //     const lowRange = parseFloat(lowRangeInputValue);
    //     const highRange = parseFloat(highRangeInputValue);
    
    //     if (
    //         isNaN(lowRange) || isNaN(highRange) ||
    //         lowRange < 0 || highRange < 0 ||
    //         lowRange >= 10000 || highRange >= 10000 ||
    //         lowRange > highRange
    //     ) {
    //         alert("Please enter valid BPM range values. Low range should be a positive number less than or equal to high range.");
    //         return false;
    //     }
    //     return true;
    // }

  

    // // Function to clear input fields
    // function clearInputFields() {
    //     document.getElementById("bpm-threshold").value = "";
    //     document.getElementById("low-range").value = "";
    //     document.getElementById("high-range").value = "";
    // }
    
    // // Add an event listener to the mode dropdown
    // const skipModeDropdown = document.getElementById("skip-mode-dropdown");
    // skipModeDropdown.addEventListener("change", () => {
    //   clearInputFields();

    //       // Toggle visibility of threshold and range inputs based on the selected mode
    // const selectedMode = skipModeDropdown.value;
    // const bpmThresholdInput = document.getElementById("bpm-threshold");
    // const lowRangeInput = document.getElementById("low-range");
    // const highRangeInput = document.getElementById("high-range");

    // if (selectedMode === "below" || selectedMode === "above") {
    //     bpmThresholdInput.style.display = "inline-block";
    //     lowRangeInput.style.display = "none";
    //     highRangeInput.style.display = "none";
    // } else if (selectedMode === "outside") {
    //     bpmThresholdInput.style.display = "none";
    //     lowRangeInput.style.display = "inline-block";
    //     highRangeInput.style.display = "inline-block";
    // }

    // });


  // Store the old mode and input
let oldMode = "";
let oldInput = "";

// Add an event listener to the mode dropdown
const skipModeDropdown = document.getElementById("skip-mode-dropdown");
skipModeDropdown.addEventListener("change", () => {
    // Get the selected mode
    const selectedMode = skipModeDropdown.value;

    // Get the input fields
    const bpmThresholdInput = document.getElementById("bpm-threshold");
    const lowRangeInput = document.getElementById("low-range");
    const highRangeInput = document.getElementById("high-range");

    // Check if the old mode matches the selected mode
    if (oldMode === selectedMode) {
        // Transfer the old input to the new input
        if (selectedMode === "below" || selectedMode === "above") {
            bpmThresholdInput.value = oldInput;
        } else if (selectedMode === "outside") {
            lowRangeInput.value = oldInput;
            highRangeInput.value = parseInt(oldInput) + 20;
        }
    }

    // Update the old mode and input
    oldMode = selectedMode;
    oldInput = selectedMode === "outside" ? lowRangeInput.value : bpmThresholdInput.value;

    // Toggle visibility of threshold and range inputs based on the selected mode
    if (selectedMode === "below" || selectedMode === "above") {
        bpmThresholdInput.style.display = "inline-block";
        lowRangeInput.style.display = "none";
        highRangeInput.style.display = "none";
    } else if (selectedMode === "outside") {
        bpmThresholdInput.style.display = "none";
        lowRangeInput.style.display = "inline-block";
        highRangeInput.style.display = "inline-block";
    }
});



    
    // // Function to handle skipping in "Above BPM" mode
    // async function skipAboveBPM(threshold) {
    //     if (!isSkipping || isSkipInProgress) return;
    
    //     isSkipInProgress = true; // Set the flag to indicate skip is in progress
    
    //     const currentBPM = lastKnownBPM;
    
    //     if (currentBPM !== null && currentBPM > threshold) {
    //         console.log("Skipping to the next song because BPM is above the threshold.");
    //         await skipToNext();
    //     }
    
    //     isSkipInProgress = false; // Reset the flag when skip is complete
    // }
    
    // // Function to handle skipping in "Outside BPM Range" mode
    // async function skipOutsideBPMRange(lowRange, highRange) {
    //     if (!isSkipping || isSkipInProgress) return;
    
    //     isSkipInProgress = true; // Set the flag to indicate skip is in progress
    
    //     const currentBPM = lastKnownBPM;
    
    //     if (currentBPM !== null && (currentBPM < lowRange || currentBPM > highRange)) {
    //         console.log("Skipping to the next song because BPM is outside the specified range.");
    //         await skipToNext();
    //     }
    
    //     isSkipInProgress = false; // Reset the flag when skip is complete
    // }
    
    // // Function to handle skipping in "Below BPM" mode
    // async function skipBelowBPM(threshold) {
    //     if (!isSkipping || isSkipInProgress) return;
    
    //     isSkipInProgress = true; // Set the flag to indicate skip is in progress
    
    //     const currentBPM = lastKnownBPM;
    
    //     if (currentBPM !== null && currentBPM < threshold) {
    //         console.log("Skipping to the next song because BPM is below the threshold." + ` ${currentBPM} BPM`);
    //         await skipToNext();
    //     }
    
    //     isSkipInProgress = false; // Reset the flag when skip is complete
    // }
    
    // // Function to update the skip check every 3 seconds
    // function updateSkipCheck() {
    //     setInterval(() => {
    //         // Check if skipping is active and not in custom BPM mode
    //         if (isSkipping && !isCustomBPM  && validateBPMThresholdInput(lastKnownBPM)) {
    //             const selectedMode = document.getElementById("skip-mode-dropdown").value;
    //             const bpmThresholdInput = document.getElementById("bpm-threshold");
    //             const lowRangeInput = document.getElementById("low-range");
    //             const highRangeInput = document.getElementById("high-range");
    
    //             switch (selectedMode) {
    //                 case "below":
    //                 case "above":
    //                     if (validateBPMThresholdInput(bpmThresholdInput.value)) {
    //                         // Call the appropriate skip update function for "below" and "above" modes here.
    //                         if (selectedMode === "below") {
    //                             skipBelowBPM(bpmThresholdInput.value);
    //                         } else if (selectedMode === "above") {
    //                             skipAboveBPM(bpmThresholdInput.value);
    //                         }
    //                     }
    //                     break;
    //                 case "outside":
    //                     if (
    //                         validateBPMThresholdInput(bpmThresholdInput.value) &&
    //                         validateRangeInputs(lowRangeInput.value, highRangeInput.value)
    //                     ) {
    //                         // Call the skip update function for "outside" mode here.
    //                         skipOutsideBPMRange(lowRangeInput.value, highRangeInput.value);
    //                     }
    //                     break;
    //             }
    //         }
    //     }, 3000); // Update skip check every 3 seconds
    // }
    
    // // Call the updateSkipCheck function to start updating skip checks
    // updateSkipCheck();





  

    // Function to update the "Switch to Currently Playing" button
    function updateSwitchToCurrentlyPlayingButton() {
        const switchButton = document.getElementById("switch-to-currently-playing-button");
        const BPMskip = document.getElementById("skip-mode-container");
        const skipButton = document.getElementById("skip-button");
      
        if (isCustomBPM || customTrackURL) {
            // Enable the button when custom BPM or custom track URL is set
            switchButton.disabled = false;
            skipButton.textContent = "Start Skipping";
            skipButton.disabled = false;
            BPMskip.style.display = "none";
            isSkipping = false; // Ensure skipping is turned off
            disableElements('.playback-controls')
            
        } else {
            switchButton.disabled = true;
            BPMskip.style.display = "block";
            enableElements(".playback-controls")
        }
    }

    // switchToCurrentlyPlayingButton.addEventListener("click", function () {
    //     // Clear custom BPM and custom track URL
    //     customBPM = 0;
    //     customTrackURL = "";
    //     // isCustomBPM = false;
    //     document.getElementById("toggle-container").style.display = "flex";
    //     enableElements(".playback-controls")

    //     // Disable the "Switch to Currently Playing" button
    //     switchToCurrentlyPlayingButton.disabled = true;
    //     getBackToInternalColors();
    //     // Update the BPM overlay and fetch the currently playing song
    //     lastKnownSongDetails= "";
    //     updateBPMOverlay();
    // });

    async function getBackToInternalColors(){
      try{
     const toggleChecked = document.getElementById("extract-toggle").checked;
      if(toggleChecked && document.getElementById("song-details").style.display=="block"){
            const currentlyPlayingURL = await fetchTrackURL(accessToken);
            console.log(currentlyPlayingURL);
            fetchAndExtractColorsForTrack(currentlyPlayingURL,accessToken);
        }
      }catch(error){
        console.log("Error getting back to otigical colors from GET BPM Colors: " + error)
      }
    }
  
    // Global variable to track the current color index position
    let globalColorIndex = 0;
    let oldCI = 0;
    
    // Global variables for color management
    let changeColorFunction;
    
    // Create a reusable changeColor function
    function createChangeColorFunction() {
        return async function() {
            const body = document.body;
  let rand = document.getElementById("extract-toggle1").checked;
          if(subCode){
                await sendColorToSecondary(customFlashingColors[globalColorIndex]);
            }
            body.style.backgroundColor = customFlashingColors[globalColorIndex];
            oldCI = globalColorIndex;
            
          // if random is true then make colour index some random number from custom flashing colours length
          if(rand){
                while(globalColorIndex == oldCI){
                    globalColorIndex = Math.floor(Math.random() * customFlashingColors.length);
            }
          }else{
                globalColorIndex = (globalColorIndex + 1) % customFlashingColors.length;
            }
        };
    }
    
    // Function to update the background color based on BPM
    function updateBackgroundColor(bpm) {
        const body = document.body;
        
        // Update base BPM in our tempo control system
        baseBPM = bpm;
        tempoMultiplier = 1;
    
        // Calculate interval in ms (BPM is beats per minute, so we convert it to beats per second)
        const interval = 60 / bpm * 1000;
    
        // Create the shared change color function
        changeColorFunction = createChangeColorFunction();

        // Clear the previous interval (if any) to avoid multiple flashing intervals
        clearInterval(body.intervalId);

        // Check if the BPM is valid and not 0 or N/A
        if (bpm > 0) {
            body.intervalId = setInterval(changeColorFunction, interval);
        } else {
            body.style.backgroundColor = "#424242";
            // Stop flashing if BPM is 0 or N/A
            clearInterval(body.intervalId);
        }
    }


async function sendColorToSecondary(color) {
    let transition = document.getElementById('transition-slider').value;

    try {
        // Use fetch to send a PUT request to the /updateColor route
        await fetch(`/updateColor/${encodeURIComponent(subCode)}/${encodeURIComponent(color)}/${encodeURIComponent(transition)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error sending color to /updateColor:', error);
    }
}

  let oldoverlay;
const overlayElement = document.getElementById('song-info');
async function sendOverlayData() {
  if(!oldoverlay){
    oldoverlay=overlayElement.innerHTML;
  }
  
  // Always refresh when using microphone to show current BPM
  const shouldUpdate = (overlayElement.innerHTML !== oldoverlay) || microphoneActive;
  
  if(shouldUpdate){
    let overlayHTML = overlayElement.innerHTML;

    // Add microphone status if active
    if (microphoneActive) {
        const micStatusElement = document.querySelector('.mic-status');
        const bpmDisplayElement = document.querySelector('.bpm-display-confirmation');
        
        // Create or update microphone status information
        let micInfo = '';
        if (micStatusElement) {
            micInfo += `<p class="mic-status-mirror">${micStatusElement.textContent}</p>`;
        }
        
        // Add waveform BPM display
        if (bpmDisplayElement) {
            micInfo += `<p class="bpm-display-mirror">${bpmDisplayElement.textContent}</p>`;
        }
        
        // Add the microphone info to the overlay
        overlayHTML += `<div class="microphone-info-mirror">${micInfo}</div>`;
    }

    // Check if currentSongUrl has a value
    if (currentSongUrl) {
        // Append a button with the URL if it has a value
        const playButton = `<div id="song-link-btn"><br><button id="song-link" class="hide-ui" style="opacity:0.88;" onclick="window.open('${currentSongUrl}', '_blank')">Play the Song</button></div>`;
        overlayHTML += playButton;
    }
    
    oldoverlay = overlayElement.innerHTML;
    
    fetch(`/saveoverlaydata?code=${encodeURIComponent(subCode)}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ overlayHTML }),
    })
        .then(response => response.text())
        .then(data => console.log(data))
        .catch(error => console.error('Error sending overlay data:', error));
    
  }
}





let subCode;
function generateRandomCode() {
  // Function to generate a random 6-character code with numbers and letters
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}
  
  const mirrorColor = document.getElementById('subscribe');
  mirrorColor.addEventListener('click', becomeMirror);
  const goToMirror = document.getElementById('goToMirror');
  goToMirror.addEventListener('click', subscribeToMirror);
function becomeMirror() {
  // Generate a random code
 subCode= generateRandomCode();
  // Append the code to the button text
  const button = document.getElementById('subscribe');
  button.textContent = `Mirror Colors Code 👇`;
 // Display the code for copying
  const codeDisplay = document.getElementById('code-display');
  codeDisplay.textContent = `Code: ${subCode}`;

  // Copy the code to the clipboard
  const dummyElement = document.createElement('textarea');
  dummyElement.value = subCode;
  document.body.appendChild(dummyElement);
  dummyElement.select();
  document.execCommand('copy');
  document.body.removeChild(dummyElement);


}
 function subscribeToMirror() {
   const codeDisplay = document.getElementById('code-display');
   codeDisplay.textContent
   // Redirect to /subscribe.html in a new window
   const newWindow = window.open(`/subscribe.html${codeDisplay.textContent.includes('Code: ')?`?code=${subCode}`:''}`, '_blank');
   newWindow.focus();
 } 

  
    const rangeElement = document.getElementById('transition-slider');
    const sliderValue = document.getElementById('slider-label');
    const body = document.body;
      // Add an event listener to the slider for input changes
    rangeElement.addEventListener('input', updateTransition);

    const bpmSpan = document.getElementById("bpm");
    const sliderLabel = document.getElementById("slider-label");

    function updateTransition(){
      updateStepBasedOnBPM();
      // Get the slider value
      const sliderVal = rangeElement.value;
    
      // Update the body's transition duration and the displayed value
      body.style.transition = `background-color ${sliderVal}s ease`;
      sliderValue.textContent = `Transition duration: ${sliderVal}s`;
      if(isTokenExpired){
        console.log('Token is expired in transition upd func')
        checkAndRefreshToken();
      }
    }

  
    // Function to update the step attribute of the range input and adjust the slider value
    function updateStepBasedOnBPM() {
      // Get the BPM value from the span and parse it as an integer
      const bpmValue = parseFloat(lastKnownBPM, 10);
      let transitionDurationSeconds;
    if(lastKnownBPM>0){
      // Calculate the transition duration in seconds based on BPM
      transitionDurationSeconds = 60 / bpmValue.toFixed(3);
    }else{
      // Set the transition duration to 0 if BPM is 0 or N/A
      transitionDurationSeconds = 1;
    }
      // Calculate the number of steps (always 8 steps)
      const numSteps = 8;
    
      // Calculate the step size based on the number of steps
      const stepSize = transitionDurationSeconds / numSteps;
    
      console.log("BPM Value:", bpmValue);
      console.log("Transition Duration (seconds):", transitionDurationSeconds);
      console.log("Division of millis:", numSteps);
      console.log("Step Size:", stepSize);
    
      // Get the current slider value
      const currentSliderValue = parseFloat(rangeElement.value);
    
      // Calculate the closest step value based on the user's set value
      const closestStep = thresholdRound(currentSliderValue / stepSize,0.5);
    
      console.log("Current Slider Value:", currentSliderValue);
      console.log("Closest Step:", closestStep);
    
      // Calculate the new slider value based on the closest step
      const newSliderValue = closestStep * stepSize;
    
      console.log("New Slider Value:", newSliderValue);
      console.log(`\n`);
      // Update the slider label with the new step value
      sliderLabel.textContent = `Transition Duration: ${stepSize.toFixed(3)}s`;
    
      // Update the slider value with the new calculated value
      rangeElement.value = newSliderValue.toFixed(3).toString();
    
      // Set the transition duration as the step for the range input
      rangeElement.step = stepSize.toFixed(3).toString();
    
      // Update the body's transition duration based on the new BPM
      body.style.transition = `background-color ${stepSize.toFixed(3)}s ease`;
      isTransitionUpdated = true;
    }

    // Add an event listener to the BPM span to trigger slider update when BPM changes
    bpmSpan.addEventListener("change", updateTransition);

    
    
  
    // Event listener for the "Set Colors" button
    setColorsButton.addEventListener("click", function () {
        try {
            // Get the custom colors from the input field
            const customColorsString = customColorsInput.value.trim();

            if (customColorsString) {
                // Split the input string by commas to get an array of custom colors
                const customColors = customColorsString.split(",");

                // Set the custom colors for flashing
                setCustomColors(customColors);
            } else {
                console.error("Custom Colors input is empty.");
                showAlert("Custom Colors input is empty.");
            }
        } catch (error) {
            console.error("Error setting custom colors:", error);
        }
    });

    // Event listener for the "Default Colors" button
    defaultColorsButton.addEventListener("click", function () {
        // Set the default colors for flashing
        setDefaultColors();
    });

  document.getElementById("random-colors-button").addEventListener("click", getRandomColors);

  function getRandomColors() {
      const numColors = Math.floor(Math.random() * (lastKnownBPM - 4 + 1)) + 4; // Random number between 4 and 15
      fetch(`/randomColors?numColors=${numColors}`)
          .then(response => response.json())
          .then(data => {
              const randomColors = data.randomColors;
              customFlashingColors = randomColors;
              console.log(randomColors);
          })
          .catch(error => console.error('Error fetching random colors:', error));
  }


    // Event listener for setting a custom BPM
    const setCustomBPMButton = document.getElementById("set-custom-bpm");
    setCustomBPMButton.addEventListener("click", function () {
        const customBPMInput2 = document.getElementById("custom-bpm-input");
        const inputBPM = parseFloat(customBPMInput2.value);

        if (!isNaN(inputBPM) && inputBPM > 0) {
            // Set the custom BPM and flag
            customBPM = inputBPM;
            // // isCustomBPM = true;
            customTrackURL = "";
            document.getElementById("toggle-container").style.display = "none";
            updateBPMOverlay();
        } else {
            showAlert("Please enter a valid BPM greater than 0.");
        }
    });

    // Event listener for the "Get BPM" button
    const getBPMButton = document.getElementById("get-bpm-button");
    getBPMButton.addEventListener("click", async function () {
        try {
            // Get the custom track URL from the input field
            const inputTrackURL = document.getElementById("custom-track-url").value.trim();

            if (inputTrackURL) {
                // Fetch BPM from the Spotify Web API using the custom track URL
                const bpm = await fetchBPMFromCustomTrackURL(inputTrackURL);
                if (!isNaN(bpm) && bpm > 0) {
                    // Set the custom BPM and flag
                    customBPM = bpm;
                    // // isCustomBPM = true;
                    customTrackURL = inputTrackURL;
                    document.getElementById("toggle-container").style.display = "none";
                    fetchAndExtractColorsForTrack(inputTrackURL, accessToken);
                  
                // Check if there is a change in song title or BPM
                if (songTitleElement.textContent !== "custom" || bpm !== lastKnownBPM) {
                    updateBPMOverlay();
                }
                } else {
                    showAlert("Custom URL BPM could not be fetched or is invalid.");
                }
            } else {
                console.error("Custom Track URL is empty.");
                showAlert("Custom Track URL is empty.");
            }
        } catch (error) {
            console.error("Error fetching BPM:", error);
        }
    });

    // Event listeners for tempo multiplier buttons were moved to the modifyTempo() implementation

    // Event listener for the "Switch to Currently Playing" button
    switchToCurrentlyPlayingButton.addEventListener("click", function () {
        // isCustomBPM = false; // Switch to currently playing mode
        updateBPMOverlay(); // Start fetching currently playing BPM
    });

    // Function to set custom colors for flashing
    function setCustomColors(colors) {
        // Update the colors array for flashing
        customFlashingColors = colors;
    }

    // Function to set default colors for flashing
    function setDefaultColors() {
        // Update the colors array for flashing with default colors
        customFlashingColors = defaultFlashingColors;
        document.getElementById("extract-toggle").checked = false;
    }


let vibrance = 0;
let brightness = 0;

// Get references to the sliders and their text elements
let saturationSlider = document.getElementById("color-saturation");
let vibranceSlider = document.getElementById("color-vibrance");
let brightnessSlider = document.getElementById("color-brightness");
let saturationText = document.getElementById("saturation-text");
let vibranceText = document.getElementById("vibrance-text");
let brightnessText = document.getElementById("brightness-text");
let submitButton = document.getElementById("submit-btn");



// Function to send colors and color adjustments to server
function sendColorsAndAdjustments() {
    let saturationChange = saturationSlider.value;
    let vibranceChange = vibranceSlider.value;
    let brightnessChange = brightnessSlider.value;

    // Ensure values are within valid range
    saturationChange = Math.min(100, Math.max(-100, saturationChange));
    vibranceChange = Math.min(100, Math.max(-100, vibranceChange));
    brightnessChange = Math.min(100, Math.max(-100, brightnessChange));

    fetch('/adjustColors', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            customFlashingColors,
            saturationChange,
            vibranceChange,
            brightnessChange,
        }),
    })
    .then(response => response.json())
    .then(data => {
        customFlashingColors = data.newColors;
        vibrance = data.newVibrance;
        brightness = data.newBrightness;
      

        console.log('New colors:', customFlashingColors);
        console.log('New vibrance:', vibrance);
        console.log('New brightness:', brightness);
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

// Function to update slider text
function updateSliderText(slider, textElement) {
    textElement.textContent = slider.value;
}

// Update adjustments whenever the sliders change
saturationSlider.oninput = function() {
    updateSliderText(saturationSlider, saturationText);
    // Avoid immediate changes, only trigger on button click
};

vibranceSlider.oninput = function() {
    updateSliderText(vibranceSlider, vibranceText);
    // Avoid immediate changes, only trigger on button click
};

brightnessSlider.oninput = function() {
    updateSliderText(brightnessSlider, brightnessText);
    // Avoid immediate changes, only trigger on button click
};

// Handle adjustments when the submit button is clicked
submitButton.onclick = function() {
    sendColorsAndAdjustments();

  // Reset sliders to 0
  saturationSlider.value = 0;
  vibranceSlider.value = 0;
  brightnessSlider.value = 0;

  // Update slider text to show 0
  updateSliderText(saturationSlider, saturationText);
  updateSliderText(vibranceSlider, vibranceText);
  updateSliderText(brightnessSlider, brightnessText);
};

  

    // Function to show an alert to the user
    function showAlert(message) {
        alert(message);
    }

    // Function to handle the "no token provided" or "Expired token" scenarios
    function handleTokenExpiration() {
        // Hide elements when there's no token or it's expired
        document.getElementById('now-playing').style.display = 'none';
        document.getElementById('song-details').style.display = 'none';

        // Show a message above the login button
        document.getElementById('login-message').textContent = 'Please login to get the currently playing song.';
        document.getElementById('login-message').style.display = 'block';

        // Set isCustomBPM to true to stop fetching currently playing details
        // isCustomBPM = true;
        customBPM = 0;
        lastKnownBPM = 0;
    }



    const hideUI = document.getElementById("hide-ui");
    const controlsContainer = document.querySelector(".controls-container");
    const overlayContainer = document.querySelector(".overlay-container");
    const forSpaceContainer = document.querySelector(".for-space");


    hideUI.addEventListener("click", function () {
      if (controlsContainer.classList.contains("hidden-controls")) {
          controlsContainer.classList.remove("hidden-controls");
          overlayContainer.style.marginTop = "5.5vh"; // Reset the margin
          forSpaceContainer.style.position = "relative";
          forSpaceContainer.style.paddingBottom = "0"; // Reset padding
      } else {
          controlsContainer.classList.add("hidden-controls");
          overlayContainer.style.marginTop = "25.65vh"; // Move overlay to the middle
          forSpaceContainer.style.position = "relative";
          forSpaceContainer.style.paddingBottom = "57%"; // No padding when controls are hidden
      }
    });



    // Function to fetch the best quality image URL for a Spotify track
    async function fetchBestQualityImageURL(trackId, accessToken) {
      try {
        // Fetch track details to get album ID
        const trackResponse = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        });
    
        const trackData = await trackResponse.json();
    
        if (trackData.album && trackData.album.images && trackData.album.images.length > 0) {
          // Sort images by size and get the last (largest) image
          const images = trackData.album.images.sort((a, b) => b.width - a.width);
          const bestQualityImageURL = images[0].url;
          return bestQualityImageURL;
        } else {
          console.error("No album images found.");
          return null;
        }
      } catch (error) {
        console.error("Error fetching best quality image URL:", error);
        return null;
      }
    }
    
    // Disable all elements with a specific class
function disableElements(a) {
    const elements = document.querySelectorAll(a);
    elements.forEach(element => {
        element.style.display="none"
    });
}
disableElements(".playback-controls")
// Enable all elements with a specific class
function enableElements(a) {
    const elements = document.querySelectorAll(a);
    elements.forEach(element => {
        element.style.display="inline-flex"
    });
}
    
    
    // Function to extract colors from an image URL and set custom colors for flashing
    async function extractColorsFromImage(imageURL) {
      try {
        // Update the URL to match the new route
        const imageUrl = encodeURIComponent(imageURL);
        const response = await fetch(`/getColors?url=${imageUrl}`);
        const data = await response.json();
    
            if (Object.keys(data).length > 0) {
              // Convert the response object into an array of colors
              const extractedColors = Object.values(data);
              // Check if the arrays are different
        const areColorsDifferent = !arraysEqual(extractedColors, customFlashingColors);
        
        if (areColorsDifferent && extractedColors.length > 0) {
            setCustomColors(extractedColors);
            savedExtractedColors = extractedColors;
        }
          console.log("Colors received from server:", extractedColors);
        } else {
          setCustomColors(defaultFlashingColors);
          console.error("No colors extracted from the image.");
          // showAlert("No colors extracted from the image.");
        }
      } catch (error) {
        console.error("Error fetching colors from image:", error);
      }
    }

  
    // Function to compare two arrays for equality
    function arraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) return false;
        }
        return true;
    }

    const extractToggle = document.getElementById('extract-toggle');
    
    extractToggle.addEventListener('change', function () {
        if (this.checked) {
              setCustomColors(savedExtractedColors);
          getBackToInternalColors();
          
        } else {
            setCustomColors(defaultFlashingColors);
        }
    });
    
    
    // Function to fetch the best quality image URL for a track and extract colors
    async function fetchAndExtractColorsForTrack(trackURL, accessToken) {
      if((isSkipping && ((Date.now() - lastSkipTimestamp) > 6250)) || !isSkipping) {
      try {
        const trackId = extractTrackIdFromURL(trackURL);
        const bestQualityImageURL = await fetchBestQualityImageURL(trackId, accessToken);
    
        if (bestQualityImageURL) {
          // Call the function to extract colors from the image URL
          extractColorsFromImage(bestQualityImageURL);
        } else {
          console.error("No best quality image URL found.");
          showAlert("No best quality image URL found.");
        }
      } catch (error) {
        console.error("Error fetching and extracting colors for track:", error);
      }
      }
    }


        // Event listener for custom BPM input field to work on hitting "Enter"
    const customBpmInput4 = document.getElementById("custom-bpm-input");
    customBpmInput4.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault(); // Prevent the default form submission
            setCustomBPMButton.click(); // Trigger the "Set BPM" button click
        }
    });
          // Event listener for custom BPM input field to work on hitting "Enter"
    const customTrackInput = document.getElementById("custom-track-url");
    customTrackInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault(); // Prevent the default form submission
            getBPMButton.click(); // Trigger the "Set BPM" button click
        }
    });
    // setColorsButton
  




    // Add event listeners for the playback control buttons
    document.getElementById('play-pause-button').addEventListener('click', playOrPause);
    document.getElementById('next-song-button').addEventListener('click', playNext);
    document.getElementById('prev-song-button').addEventListener('click', playPrevious);
    let playPauseMultiplier=1;
  
    // Function to play or pause the current track
    async function playOrPause() {
        try {
            const playPauseButton = document.getElementById('play-pause-button');
            const tempoControlButtons = document.querySelectorAll('.tempo-controls button');
    
            // Fetch the user's current playback state
            const response = await fetch('https://api.spotify.com/v1/me/player', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
    
            if (response.status === 200) {
                const data = await response.json();
                // Check the playback state
              if(data.device && data.device.volume_percent){

              currentVolume = data.device.volume_percent;
              console.log("Current Volume:", currentVolume);
              updateVolumeSlider();
              }
              if (data.is_playing) {
        // If currently playing, send a pause request
        const pauseResponse = await fetch('https://api.spotify.com/v1/me/player/pause', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });
    
        if (pauseResponse.status === 204) {
            console.log('Playback paused.');
            togglePlayPauseIcon(false); // Change icon to play
            isPlaying = false;
            playPauseMultiplier = bpmMultiplier;
            console.log(playPauseMultiplier);
            tempoControlButtons.forEach((button) => {
                if (button.textContent === `Stop`) {
                    button.click(); // Click the applicable tempo control button
                }
            });
        } else {
            console.error('Error pausing playback:', pauseResponse.statusText);
        }
    }
    else {
                    // If paused, send a play request
                    const playResponse = await fetch('https://api.spotify.com/v1/me/player/play', {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                        },
                    });
    
                    if (playResponse.status === 204) {
                        console.log('Playback started.');
                        togglePlayPauseIcon(true); // Change icon to pause
                        isPlaying = true;
    
                        tempoControlButtons.forEach((button) => {
                            if (button.textContent === `${playPauseMultiplier}x`) {
                                button.click(); // Click the applicable tempo control button
                            }
                        });
                    } else {
                        console.error('Error starting playback:', playResponse.statusText);
                    }
                }
            } else {
                console.error('Error fetching playback state:', response.statusText);
            }
        } catch (error) {
            console.error('Error toggling playback:', error);
        }
    }

    // Function to play the next track
    async function playNext() {
      if(isSkipping){
      await new Promise(resolve => setTimeout(resolve, 233));
      }

      
        // Send a request to play the next track
        fetch('https://api.spotify.com/v1/me/player/next', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        })
        .then(response => {
            if (response.status === 204) {
                // Status 204 indicates success with no content (empty response)
                console.log('Skipped to the next song successfully.');
               if(isSkipMixActive){
                 firstRunSkipMix = true
               }
            } else {
                // Handle other status codes or errors here
                console.error('Error skipping to the next song. Status code:', response.status);
            }
        })
        .catch(error => {
            console.error('Error skipping to the next song:', error);
        });
    }
    
    // Function to play the previous track
    function playPrevious() {
        // Send a request to play the previous track
        fetch('https://api.spotify.com/v1/me/player/previous', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        })
        .then(response => {
            if (response.status === 204) {
                // Status 204 indicates success with no content (empty response)
                console.log('Went back to the previous song successfully.');
              if(isSkipMixActive){
                firstRunSkipMix = true
              }
            } else {
                // Handle other status codes or errors here
                console.error('Error going back to the previous song. Status code:', response.status);
            }
        })
        .catch(error => {
            console.error('Error going back to the previous song:', error);
        });
    }


  // Function to toggle play/pause icon
  function togglePlayPauseIcon(isPlaying) {
      const playPauseButton = document.getElementById('play-pause-button');
      if (isPlaying) {
          playPauseButton.innerHTML = '<i class="fas fa-pause"></i>';
      } else {
          playPauseButton.innerHTML = '<i class="fas fa-play"></i>';
      }
  }

  
    togglePlayPauseIcon(true); 
let isVolChange = false;
  // Function to update the volume using the Spotify Web API
async  function updateVolume(volumePercent) {
  if(!isVolChange){
  isVolChange = true;
      // Calculate the volume value (0 to 100)
      const volumeValue = Math.min(Math.max(volumePercent, 0), 100);
  await waitMS(50)
      // Send a request to update the volume
      fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${volumeValue}`, {
          method: 'PUT',
          headers: {
              'Authorization': `Bearer ${accessToken}`,
          },
      })
      .then(response => {
          if (response.status === 204) {
              console.log('Volume updated successfully.');
          }else if (response.status === 401) {
              checkAndRefreshToken();
              console.log('Volume updated successfully.');
          } else {
              console.error('Error updating volume:', response.statusText);
          }
      })
      .catch(error => {
          console.error('Error updating volume:', error);
      });
    await waitMS(400);
    isVolChange = false;
  }
}

    // Listen for changes in the volume slider
    const volumeSlider = document.getElementById('volumeRange');
    volumeSlider.addEventListener('change', () => {
        const volumePercent = volumeSlider.value;
        updateVolume(volumePercent);
    });

        

let lastSkipTimestamp = 0; // Initialize the timestamp to 0
let bpmInSkip = null
let songInSkip = null
// Function to skip to the next song
async function skipToNext() {
  if (songInSkip!==lastKnownSongDetails && bpmInSkip !== lastKnownBPM){
    try {
        const currentTime = Date.now(); // Get the current timestamp
          console.log(`${currentTime - lastSkipTimestamp} OUTSIDE MMMMMMMMMMMMMMMMMM`);
        // Check if it's been less than 3 seconds since the last skip
        if (currentTime - lastSkipTimestamp > 1000) {
                  await playNext();
        console.log("Passed through PLAY_NEXT")
        
        songInSkip=lastKnownSongDetails
        bpmInSkip=lastKnownBPM
console.log(`${currentTime - lastSkipTimestamp} INSIDE------------`);
        // Update the last skip timestamp
        lastSkipTimestamp = Date.now();
        }
      console.log(`A second hasnt passed before next skip`);
        
        // Call the playNext function to skip to the next track


    } catch (error) {
        console.error("Error skipping to the next song:", error);
        showAlert("Error skipping to the next song. Please try again.");
    }
  }
  console.log("Passed through SKIP_TO_NEXT BUT song or bpm havent yet changed so no skip")
}






const shuffleIcon = document.getElementById("shuffle-icon");
const unshuffleIcon = document.getElementById("unshuffle-icon");


// Function to toggle shuffle state with debounce
async function shuffleToggleDebounced() {
  if (!shuffleProcess) {
    shuffleProcess = true;

    // Toggle the shuffle state
    isShuffleEnabled = !isShuffleEnabled;

    try {
      // Send a request to the Spotify API to toggle shuffle
      await toggleShuffleOnSpotify(isShuffleEnabled);

      // Update the shuffle icon
      if (!isShuffleEnabled) {
        unshuffleIcon.style.display = "none";
        shuffleIcon.style = "";
      } else {
        shuffleIcon.style.display = "none";
        unshuffleIcon.style = "";
      }
    } catch (error) {
      console.error("Error toggling shuffle state:", error);
      // Handle the error here as needed
    }

    setTimeout(() => {
      shuffleProcess = false;
    }, 500); // Set a timeout to allow the function to be called again after 1 second
  }
}

// Attach the debounced function to the button click event
document.getElementById('shuffle-toggle-button').addEventListener('click', shuffleToggleDebounced);


let shuffleProcess = false;

async function setShuffle(setShuffleState) {
  if (shuffleProcess) {
    return; // Do not proceed if the process is already running
  }

  try {
    shuffleProcess = true;
    
    // Send a request to the Spotify API to toggle shuffle
    await toggleShuffleOnSpotify(setShuffleState);

    // Update the shuffle icon
    if (!isShuffleEnabled) {
      unshuffleIcon.style.display = "none";
      shuffleIcon.style = "";
    } else {
      shuffleIcon.style.display = "none";
      unshuffleIcon.style = "";
    }
  } catch (error) {
    console.error("Error setting shuffle:", error);
  } finally {
    shuffleProcess = false;
  }
}

// Function to send a request to the Spotify API to toggle shuffle
async function toggleShuffleOnSpotify(shuffleState) {
  const apiUrl = `https://api.spotify.com/v1/me/player/shuffle?state=${shuffleState}`;

  const response = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  if (response.status === 204) {
    // Shuffle command sent successfully
    console.log("Shuffle state updated");
    isShuffleEnabled = shuffleState;
  } else {
    // Handle error cases
    isShuffleEnabled = !shuffleState;
    console.error("Error updating shuffle state");
  }
}

  
//         // Function to send a request to the Spotify API to toggle shuffle
//     function toggleShuffleOnSpotify(shuffleState) {
//         const apiUrl = `https://api.spotify.com/v1/me/player/shuffle?state=${shuffleState}`;

//         fetch(apiUrl, {
//             method: "PUT",
//             headers: {
//                 "Authorization": `Bearer ${accessToken}`,
//                 "Content-Type": "application/json"
//             }
//         })
//         .then(response => {
//             if (response.status === 204) {
//                 // Shuffle command sent successfully
//                 console.log("Shuffle state updated");
//             } else {
//                 // Handle error cases
//                 console.error("Error updating shuffle state");
//             }
//         })
//         .catch(error => {
//             console.error("Error updating shuffle state:", error);
//         });
//     }
// document.getElementById('shuffle-toggle-button').addEventListener('click', shuffleToggle);


  
// Function to validate BPM threshold input
function validateBPMThresholdInput(input) {
    const bpm = parseInt(input, 10);
    if (isNaN(bpm) || bpm < 1 || bpm > 300) {
        showAlert("Invalid BPM threshold. Please enter a number between 1 and 300.");
        console.log("Invalid BPM threshold. Please enter a number between 1 and 300.");
        return false;
    }
    return true;
}

// Function to validate range inputs
function validateRangeInputs(lowRange, highRange) {
    const low = parseInt(lowRange, 10);
    const high = parseInt(highRange, 10);

    if (isNaN(low) || isNaN(high) || low < 1 || low > 300 || high < 1 || high > 300 || low >= high) {
        showAlert("Invalid BPM range. Please enter valid low and high BPM values (1-300) where low is less than high.");
        console.log("Invalid BPM range. Please enter valid low and high BPM values (1-300) where low is less than high.");
        return false;
    }

    return true;
}

// // Helper function to determine if a skip should be performed based on BPM condition
// async function shouldSkip(input, currentBPM, operation) {
//   console.log("INsiDE SHOULD SKIPPPP ",input, currentBPM, operation)
//     switch(operation) {
//         case "above":
//             // For "above" mode
//             console.log("/////////////////////Checking 'above' mode. input:", input, "currentBPM:", currentBPM);
//             return input < currentBPM;
//         case "below":
//             // For "below" mode
//             console.log("====================Checking 'below' mode. input:", input, "currentBPM:", currentBPM);
//             return input > currentBPM;
//         case "outside":
//             // For "outside" mode
//             console.log("--------------------Checking 'outside' mode. input:", input, "currentBPM:", currentBPM);
//             return input.lowRange !== undefined && input.highRange !== undefined && (currentBPM < input.lowRange || currentBPM > input.highRange);
//         default:
//             console.log("Invalid operation");
//             return false;
//     }
// }


// Helper function to perform skip action after validating input and BPM condition
async function performSkipAction(input, skipFunction, operation) {
    if (!isSkipping || isSkipInProgress) return;

    isSkipInProgress = true; // Set the flag to indicate skip is in progress

    const currentBPM = lastKnownBPM;

    if (currentBPM !== null) {

      switch(operation) {
          case "above":
              // For "above" mode
              console.log("/////////////////////Checking 'above' mode. input:", input, "currentBPM:", currentBPM);
              if(input < currentBPM){
                console.log("\n Skipping to occur with data:", input, ", currentBPM:", currentBPM, ", operation:", operation);
                await skipToNext();
              }
              break;
          case "below":
              // For "below" mode
              console.log("====================Checking 'below' mode. input:", input, "currentBPM:", currentBPM);
              if (input > currentBPM){
                console.log("\n Skipping to occur with data:", input, ", currentBPM:", currentBPM, ", operation:", operation);
                await skipToNext();
              }
              break;
          case "outside":
              // For "outside" mode
              console.log("--------------------Checking 'outside' mode. input:", input, "currentBPM:", currentBPM);
              if (input.lowRange !== undefined && input.highRange !== undefined && (currentBPM < input.lowRange || currentBPM > input.highRange)){
                console.log("\n Skipping to occur with data:", input, ", currentBPM:", currentBPM, ", operation:", operation);
                await skipToNext();
              }
              break;
          default:
              console.log("Invalid operation");
              isSkipInProgress = false;
              return false;
      }
    }

    isSkipInProgress = false; // Reset the flag when skip is complete
}

// Main function to perform skip action based on selected mode
async function performSkipBasedOnMode() {
    // Check if song and BPM were updated before performing a skip
  songAndBPMUpdated = true;
  // log(`${songAndBPMUpdated} ${isSkipping}`, 'outside skip method');
    if (songAndBPMUpdated && isSkipping) {
      log(songAndBPMUpdated && isSkipping, 'inside skip method');
        songAndBPMUpdated = false; // Reset the flag
        setTimeout(async () => {
            // Check if skipping is active and not in custom BPM mode
            if (isSkipping && !isCustomBPM && isPlaying) {
                const selectedMode = document.getElementById("skip-mode-dropdown").value;
                const bpmThresholdInput = document.getElementById("bpm-threshold");
                const lowRangeInput = document.getElementById("low-range");
                const highRangeInput = document.getElementById("high-range");
              log(selectedMode, bpmThresholdInput.value, lowRangeInput.value, highRangeInput.value, 'inside skip method before switch');


                switch (selectedMode) {
                    case "below":
                        if (validateBPMThresholdInput(bpmThresholdInput.value)) {
                            // Call the appropriate skip update function for "below" mode
                            console.log("Performing 'below' mode skip.");
                            performSkipAction(parseInt(bpmThresholdInput.value, 10), 'skipBelowBPM', "below");
                        }
                        break;
                    case "above":
                        if (validateBPMThresholdInput(bpmThresholdInput.value)) {
                            // Call the appropriate skip update function for "above" mode
                            console.log("Performing 'above' mode skip.");
                            performSkipAction(parseInt(bpmThresholdInput.value, 10), 'skipAboveBPM', "above");
                        }
                        break;
                    case "outside":
                        if (validateRangeInputs(lowRangeInput.value, highRangeInput.value)) {
                            // Call the skip update function for "outside" mode
                            console.log("Performing 'outside' mode skip.");
                            performSkipAction(
                                {
                                    lowRange: parseInt(lowRangeInput.value, 10),
                                    highRange: parseInt(highRangeInput.value, 10),
                                },
                                'skipOutsideBPMRange',
                                "outside"
                            );
                        }
                        break;
                }
            }
        }, 1000); // Delay for 2 seconds before performing the skip
    }
}

// Call the main skip action function to start performing skips




// Define variables to manage the skip mix process
let isSkipMixActive = false;
let currentSkipTime = 0;
let lastTrackURI = null;
let runCountSkip = 0;

// Function to toggle Skip Mix
function toggleSkipMix() {
    isSkipMixActive = !isSkipMixActive;
    if (isSkipMixActive) {
        updateSkipMixButton("Stop Skip Mix");
        updateSkipMixMessage("Skip Mix Active \n");
        performSkipMix();
    } else {
        runCountSkip = 0;
        updateSkipMixButton("Start Skip Mix");
        updateSkipMixMessage("Skip Mix Inactive \n");
        currentTime=0;
        timeToSkip=0;
        currentTrack = null;
        firstRunSkipMix = true;
        currentSongInSkip =null;
        countRuns=0;
    }
}


  // Function to update the skip mix message
  function updateSkipMixMessage(message = "") {
      const messageField = document.getElementById("skip-mix-message");
      const existingMessage = messageField.textContent;
      const messages = existingMessage.split('\n');
      if (messages.length >= 2) {
          // Keep only the last two messages (latest and last older message)
          messages.splice(0, messages.length - 2);
      }
      const newMessage = messages.join('\n') + '\n' + message;
      messageField.textContent = newMessage;
  }


// Function to update the Skip Mix button text
function updateSkipMixButton(text) {
    const skipMixButton = document.getElementById("skip-mix-button");
    skipMixButton.textContent = text;
}

  let currentTime = 0;
  let timeToSkip = 0;
  let currentTrack = null;
  let firstRunSkipMix = true;
  let currentSongInSkip =null;
  let countRuns=0;
  let consecutiveRuns=0;
  let lastKnownBPM1;
  let shuffleToggled = false;





  
// async function performSkipMix() {
//   console.log(`Inside func start - Is it thyme 🤨 ${(Date.now() >= timeToSkip)}, if not how much time left: ${secondsToMinutesAndSeconds((timeToSkip - Date.now())/1000)}`)
//     if (isSkipMixActive && isPlaying) {
//         if (isTokenExpired) {
//             await checkAndRefreshToken();
//         }
//       currentTime=Date.now()

//         if (firstRunSkipMix) {
//             // On the first run, skip the currently playing song to the start of its second third
//             currentTime=Date.now()
//             currentTrack = await getCurrentTrack();
//             if (currentTrack) {
//               countRuns++;
//       console.log(`In the first iteration - Is it thyme 🤨 ${(Date.now() >= timeToSkip)}, if not how much time left: ${secondsToMinutesAndSeconds((timeToSkip - Date.now())/1000)}`)

              
//               // Get configuration values
//               const randomSeekPosition = document.getElementById("random-seek-position").checked;
//               const randomSkipPosition = document.getElementById("random-skip-position").checked;
              
//               // Calculate seek and skip positions
//               let seekPosition;
//               let timeToSkipPosition;
//               // Calculate seek and skip positions
//               if (randomSeekPosition && randomSkipPosition) {
//                 while(true){
//                 while (true) {
//                   seekPosition = getRandomSeconds(3, currentTrack.duration - 12);
//                   if (!(seekPosition > currentTrack.duration - 12)) {
//                     break;
//                   }
//                 }
//                 while (true) {
//                   timeToSkipPosition = getRandomMilliseconds(15000, (currentTrack.duration - seekPosition) * 1000);
//                   if (!(timeToSkipPosition > currentTrack.millis - 12000 && currentTrack.duration - seekPosition >= timeToSkipPosition / 1000)) {
//                     break;
//                   }
//                 }
//                   if(seekPosition*1000<=timeToSkipPosition){
//                     break;
//                   }
                    
//                 }
//               }else if (randomSeekPosition) {
//                 while(true){
//                   seekPosition = getRandomSeconds(3, currentTrack.duration /3);
                  
//                   if (seekPosition < (currentTrack.duration / 3)+12) {
//                     break;
//                 }
                  
                  
//                 }
//                 timeToSkipPosition=(currentTrack.millis/3*2)-(seekPosition*1000);
//               } else if (randomSkipPosition) {
//                 while(true){
//                               timeToSkipPosition = getRandomMilliseconds((currentTrack.millis/3)+(currentTrack.millis/3/2), currentTrack.millis -12000);
                  
//                   if (timeToSkipPosition > (currentTrack.millis / 3)+10) {
//                     break;
//                 }
                  
                  
//                 }
//                 seekPosition=currentTrack.duration/3;
//           } else {
//             // Neither seek nor skip are random
//             seekPosition = currentTrack.duration/3;
//             timeToSkipPosition = currentTrack.millis/3;
//           }






//                 const songName = currentTrack.name; // Get song name
//                 currentSongInSkip = currentTrack.name;
//                 const artists = currentTrack.artists.map(artist => artist.name).join(', '); // Get all artists
//                 console.log(`Currently playing: ${songName} by ${artists}`); // Log song and artists
//                 updateSkipMixMessage(`Currently playing: ${songName} by ${artists}`);
//                 await seekToTime(seekPosition);
//                 currentSkipTime = timeToSkipPosition/1000;
//                 currentTime=Date.now();
//                 timeToSkip = currentTime + timeToSkipPosition;
//                 const timeToSkipInSeconds = (timeToSkip - currentTime) / 1000;
//                 const timeToSkipInSong = (timeToSkipPosition) / 1000;
//                 // Inside the performSkipMix function
//                 const timeToSkipInMinutesAndSeconds = secondsToMinutesAndSeconds(timeToSkipInSeconds);
//                 const timeToSkipInSongInSeconds = timeToSkipInSong;
//                 const timeToSkipInSongMinutesAndSeconds = secondsToMinutesAndSeconds(timeToSkipInSongInSeconds);
//                               console.log(`${countRuns} FIRST RUN________seek in seconds: ${secondsToMinutesAndSeconds(seekPosition)}, when to skip in seconds ${secondsToMinutesAndSeconds(timeToSkipPosition/1000)}`);
//               console.log(`Is it thyme in first inside 🤨 ${(Date.now() >= timeToSkip)}, if not how much time left: ${secondsToMinutesAndSeconds((timeToSkip - Date.now())/1000)}`)
//                 updateSkipMixMessage(`\nFirst Seeked to: ${secondsToMinutesAndSeconds(seekPosition)}\nSkip will occur at ${secondsToMinutesAndSeconds(seekPosition+timeToSkipInSongInSeconds)} in the song duration\nThe song will play for ${secondsToMinutesAndSeconds((timeToSkip - Date.now())/1000)}\nCurrently playing song: ${songName} by ${artists}`);
//                 firstRunSkipMix = false;
//                 consecutiveRuns++;
//             }

//         } else if (Date.now() >= timeToSkip || secondsToMinutesAndSeconds((timeToSkip - Date.now())/1000).includes("-")) {
//           consecutiveRuns++;

 
//           console.log(`BEFORE consecutive ${consecutiveRuns} runs check`)
//             if (consecutiveRuns % 2 === 0 && consecutiveRuns > 0 && !shuffleToggled) {
//               const shuffleIsActive = await isShuffleActive();
          
//               if (shuffleIsActive) {
//                 console.log(`Shuffle TURN OFF FROM ON IN CONSECUTIVE RUNS ${consecutiveRuns} CHECK SHUFFLE CHECK`);
//                 await setShuffle(false);
//                 console.log(`Shuffle TURN ON FROM OFF FROM ON IN CONSECUTIVE RUNS ${consecutiveRuns} CHECK SHUFFLE CHECK`);
//                 await setShuffle(true);
//               } else {
//                 console.log(`Shuffle TURN ON FROM OFF  IN CONSECUTIVE RUNS ${consecutiveRuns} CHECK SHUFFLE CHECK`);
//                 await setShuffle(true);
//               }
          
//               shuffleToggled = true;
//             }
//           console.log(`AFTER consecutive ${consecutiveRuns} runs check`)
//             await skipToNextSong();
//             currentTrack = await getCurrentTrack();
//           if (currentTrack) {
//               countRuns++;

//               // Configuration object to store options
//           const options = {
//             maxOffset: 30000,
//             seekFraction: 1 / 3,
//             minInterval: 33,
//             seekSafety: 12,
//           };
          
//           // Get configuration values
//           const randomSeekPosition = document.getElementById("random-seek-position").checked;
//           const randomSkipPosition = document.getElementById("random-skip-position").checked;
          
//           // Function to generate a random offset within constraints
//           function getRandomOffset(maxOffset) {
//             return Math.floor(Math.random() * maxOffset);
//           }
          
//           // Calculate seek and skip positions
//           let seekPosition;
//           let timeToSkipPosition;
          
//           if (randomSeekPosition && randomSkipPosition) {
//             while(true){
//             while (true) {
//               seekPosition = getRandomSeconds(0, currentTrack.duration - 12);
//               if (!(seekPosition > currentTrack.duration - 12)) {
//                 break;
//               }
//             }
//             while (true) {
//               timeToSkipPosition = getRandomMilliseconds(15000, (currentTrack.duration - seekPosition) * 1000);
//               if (!(timeToSkipPosition > currentTrack.millis - 12000 && currentTrack.duration - seekPosition >= timeToSkipPosition / 1000)) {
//                 break;
//               }
//             }
//               if(seekPosition*1000<=timeToSkipPosition){
//                 break;
//               }

//             }
//           } else if (randomSeekPosition) {
//             // Only seek is random
//             while(true){
//                   seekPosition = getRandomSeconds(3, currentTrack.duration /3);
                  
//                   if (seekPosition < (currentTrack.duration / 3)+12) {
//                     break;
//                 }
                  
                  
//                 }
//             timeToSkipPosition=(currentTrack.millis/3*2)-(seekPosition*1000);
//           } else if (randomSkipPosition) {
//             while(true){
//                   timeToSkipPosition = getRandomMilliseconds((currentTrack.millis/3)+(currentTrack.millis/3/2), currentTrack.millis -12000);
                  
//                   if (timeToSkipPosition > (currentTrack.millis / 3)+10) {
//                     break;
//                 }
                  
                  
//                 }
//             seekPosition=currentTrack.duration/3;
//           } else {
//             // Neither seek nor skip are random
//             seekPosition = currentTrack.duration/3;
//             timeToSkipPosition = currentTrack.millis/3;
//           }


//             console.log(`${countRuns} CONSECUTIVE RUNS________seek in seconds: ${seekPosition}, when to skip in seconds ${timeToSkipPosition/1000}`) ;

            
//                 const songName = currentTrack.name; // Get song name
//                 currentSongInSkip = currentTrack.name;
//                 const artists = currentTrack.artists.map(artist => artist.name).join(', '); // Get all artists
//                 console.log(`Currently playing: ${songName} by ${artists}`); // Log song and artists
//                 updateSkipMixMessage(`Currently playing: ${songName} by ${artists}`);
//                 await seekToTime(seekPosition);
//                 currentSkipTime = timeToSkipPosition/1000;
//                 currentTime=Date.now();
//                 timeToSkip = currentTime + timeToSkipPosition;
//                 const timeToSkipInSeconds = (timeToSkip - currentTime) / 1000;
//                 const timeToSkipInSong = (timeToSkipPosition) / 1000;
//                 // Inside the performSkipMix function
//                 const timeToSkipInMinutesAndSeconds = secondsToMinutesAndSeconds(timeToSkipInSeconds);
//                 const timeToSkipInSongInSeconds = timeToSkipInSong;
//                 const timeToSkipInSongMinutesAndSeconds = secondsToMinutesAndSeconds(timeToSkipInSongInSeconds);

            
//          console.log(`In consecutive ${consecutiveRuns} - Is it thyme 🤨 ${(Date.now() >= timeToSkip)}, if not how much time left: ${secondsToMinutesAndSeconds((timeToSkip - Date.now())/1000)}`)
//             // In subsequent runs, when the scheduled time arrives, skip to the next song
            
//               console.log(`Is it thyme in consecutive 🤨 ${(Date.now() >= timeToSkip)}, if not how much time left: ${secondsToMinutesAndSeconds((timeToSkip - Date.now())/1000)}`)

            
//                 updateSkipMixMessage(`\nCONSECUTIVE Seeked to: ${secondsToMinutesAndSeconds(seekPosition)}\nSkip will occur at ${secondsToMinutesAndSeconds(seekPosition+timeToSkipInSongInSeconds)} in the song duration\nThe song will play for ${secondsToMinutesAndSeconds((timeToSkip - Date.now())/1000)}\nCurrently playing song: ${songName} by ${artists}`);
//             firstRunSkipMix = false;
//             }
//           // Reset shuffleToggled at the end of the run
//           shuffleToggled = false;
//         }
//         lastKnownBPM<=0 || !lastKnownBPM || isNaN(lastKnownBPM) ? lastKnownBPM1 = 100 : lastKnownBPM1 = lastKnownBPM;
//         currentTime = Date.now();
//         console.log(`At the end but insde skipmixactive plus is playing: bpm ${lastKnownBPM1} and timeout to be ${secondsToMinutesAndSeconds(6000/lastKnownBPM1)} and time current current time ${Date(currentTime*1)}`);
      
//         setTimeout(performSkipMix, 60000/lastKnownBPM1);
//     }else if(isSkipMixActive && !isPlaying){
//       console.log(`At the end but insde skipmixactive plus is NOT playing: bpm ${lastKnownBPM1} and timeout to be ${secondsToMinutesAndSeconds(6000/lastKnownBPM1)} and time current current time ${Date(currentTime)}`);
//       lastKnownBPM<=0 || !lastKnownBPM || isNaN(lastKnownBPM) ? lastKnownBPM1 = 100 : lastKnownBPM1 = lastKnownBPM;
//       while(!isPlaying){
//         lastKnownBPM<=0 || !lastKnownBPM || isNaN(lastKnownBPM) ? lastKnownBPM1 = 100 : lastKnownBPM1 = lastKnownBPM;
//         console.log("Not playing");
//         currentTime = Date.now();
//         console.log(`At the end but insde skipmixactive plus is NOT playing WHILE: bpm ${lastKnownBPM1} and timeout to be ${secondsToMinutesAndSeconds(6000/lastKnownBPM1)} and time current current time ${Date(currentTime)}`);
//         await wait(60000/lastKnownBPM1*3);
//       }
//       currentTime = Date.now();
//       performSkipMix();
//       console.log(`At the end but insde skipmixactive plus is playing NOW ACTIVE AFtER WHILE: bpm ${lastKnownBPM1} and timeout to be ${secondsToMinutesAndSeconds(6000/lastKnownBPM1)} and time current current time ${Date.parse(currentTime)}`);
//       setTimeout(performSkipMix, 60000/lastKnownBPM1);
//     }
// }

async function performSkipMix() {
    console.log(`Inside func start - Is it thyme 🤨 ${(Date.now() >= timeToSkip)}, if not how much time left: ${secondsToMinutesAndSeconds((timeToSkip - Date.now()) / 1000)}`);

    if (isSkipMixActive && isPlaying) {
        if (isTokenExpired) {
            await checkAndRefreshToken();
        }

        currentTime = Date.now();

        if (firstRunSkipMix) {
            await handleFirstRun();
        } else if (shouldSkip()) {
            await handleSubsequentRun();
        }

        lastKnownBPM <= 0 || !lastKnownBPM || isNaN(lastKnownBPM) ? lastKnownBPM1 = 100 : lastKnownBPM1 = lastKnownBPM;
        currentTime = Date.now();
        console.log(`At the end but inside skipmixactive plus is playing: bpm ${lastKnownBPM1} and timeout to be ${secondsToMinutesAndSeconds(6000 / lastKnownBPM1)} and time current current time ${Date(currentTime * 1)}`);

        setTimeout(performSkipMix, 60000 / lastKnownBPM1);
    } else if (isSkipMixActive && !isPlaying) {
        console.log(`At the end but inside skipmixactive plus is NOT playing: bpm ${lastKnownBPM1} and timeout to be ${secondsToMinutesAndSeconds(6000 / lastKnownBPM1)} and time current current time ${Date(currentTime)}`);
        lastKnownBPM <= 0 || !lastKnownBPM || isNaN(lastKnownBPM) ? lastKnownBPM1 = 100 : lastKnownBPM1 = lastKnownBPM;

        while (!isPlaying) {
            lastKnownBPM <= 0 || !lastKnownBPM || isNaN(lastKnownBPM) ? lastKnownBPM1 = 100 : lastKnownBPM1 = lastKnownBPM;
            console.log("Not playing");
            currentTime = Date.now();
            console.log(`At the end but inside skipmixactive plus is NOT playing WHILE: bpm ${lastKnownBPM1} and timeout to be ${secondsToMinutesAndSeconds(6000 / lastKnownBPM1)} and time current current time ${Date(currentTime)}`);
            await wait(60000 / lastKnownBPM1 * 3);
        }

        currentTime = Date.now();
        performSkipMix();
        console.log(`At the end but inside skipmixactive plus is playing NOW ACTIVE AFTER WHILE: bpm ${lastKnownBPM1} and timeout to be ${secondsToMinutesAndSeconds(6000 / lastKnownBPM1)} and time current current time ${Date.parse(currentTime)}`);
        setTimeout(performSkipMix, 60000 / lastKnownBPM1);
    }
}

async function handleFirstRun() {
    currentTime = Date.now();
    currentTrack = await getCurrentTrack();

    if (currentTrack) {
        countRuns++;
        const { seekPosition, timeToSkipPosition } = calculatePositions(currentTrack);
        const songName = currentTrack.name;
        const artists = currentTrack.artists.map(artist => artist.name).join(', ');

        console.log(`${countRuns} FIRST RUN________seek in seconds: ${secondsToMinutesAndSeconds(seekPosition)}, when to skip in seconds ${secondsToMinutesAndSeconds(timeToSkipPosition / 1000)}`);

        updateSkipMixMessage(`\nFirst Seeked to: ${secondsToMinutesAndSeconds(seekPosition)}\nSkip will occur at ${secondsToMinutesAndSeconds(seekPosition + timeToSkipPosition / 1000)} in the song duration\nThe song will play for ${secondsToMinutesAndSeconds(timeToSkipPosition / 1000)}\nCurrently playing song: ${songName} by ${artists}`);

        await seekToTime(seekPosition);
        currentSkipTime = timeToSkipPosition / 1000;
        currentTime = Date.now();
        timeToSkip = currentTime + timeToSkipPosition;
        const timeToSkipInSeconds = (timeToSkip - currentTime) / 1000;
        const timeToSkipInSong = timeToSkipPosition / 1000;
        const timeToSkipInMinutesAndSeconds = secondsToMinutesAndSeconds(timeToSkipInSeconds);
        const timeToSkipInSongInSeconds = timeToSkipInSong;
        const timeToSkipInSongMinutesAndSeconds = secondsToMinutesAndSeconds(timeToSkipInSongInSeconds);

        console.log(`In first iteration - Is it thyme 🤨 ${(Date.now() >= timeToSkip)}, if not how much time left: ${secondsToMinutesAndSeconds((timeToSkip - Date.now()) / 1000)}`);
        updateSkipMixMessage(`\nFirst Seeked to: ${secondsToMinutesAndSeconds(seekPosition)}\nSkip will occur at ${secondsToMinutesAndSeconds(seekPosition + timeToSkipInSongInSeconds)} in the song duration\nThe song will play for ${timeToSkipInSongMinutesAndSeconds}\nCurrently playing song: ${songName} by ${artists}`);

        firstRunSkipMix = false;
        consecutiveRuns++;
    }
}

async function handleSubsequentRun() {
    consecutiveRuns++;
    console.log(`BEFORE consecutive ${consecutiveRuns} runs check`);
            if (consecutiveRuns % 2 === 0 && consecutiveRuns > 0 && !shuffleToggled) {
              const shuffleIsActive = await isShuffleActive();
          
              if (shuffleIsActive) {
                console.log(`Shuffle TURN OFF FROM ON IN CONSECUTIVE RUNS ${consecutiveRuns} CHECK SHUFFLE CHECK`);
                await setShuffle(false);
                await waitMS(888);
                console.log(`Shuffle TURN ON FROM OFF FROM ON IN CONSECUTIVE RUNS ${consecutiveRuns} CHECK SHUFFLE CHECK`);
                await setShuffle(true);
              } else {
                console.log(`Shuffle TURN ON FROM OFF  IN CONSECUTIVE RUNS ${consecutiveRuns} CHECK SHUFFLE CHECK`);
                await setShuffle(true);
              }
          
              shuffleToggled = true;
            }

    console.log(`AFTER consecutive ${consecutiveRuns} runs check`);
    await skipToNextSong();
    const lastTrack = currentTrack;
    while (`${lastTrack.name},${lastTrack.artists.map(artist => artist.name).join(', ')}` === `${currentTrack.name},${currentTrack.artists.map(artist => artist.name).join(', ')}`){
      
      console.log(`Song hasn't yet changed \n${lastTrack.name} - ${lastTrack.artists.map(artist => artist.name).join(', ')} is same as \n${currentTrack.name} - ${currentTrack.artists.map(artist => artist.name).join(', ')}`)
      await waitMS(158);
    currentTrack = await getCurrentTrack();
    }
    if (currentTrack) {
        countRuns++;
        const { seekPosition, timeToSkipPosition } = calculatePositions(currentTrack);

        console.log(`${countRuns} CONSECUTIVE RUNS________seek in seconds: ${seekPosition}, when to skip in seconds ${secondsToMinutesAndSeconds(timeToSkipPosition / 1000)}`);

        const songName = currentTrack.name;
        const artists = currentTrack.artists.map(artist => artist.name).join(', ');

        updateSkipMixMessage(`\nCONSECUTIVE Seeked to: ${secondsToMinutesAndSeconds(seekPosition)}\nSkip will occur at ${secondsToMinutesAndSeconds(seekPosition + timeToSkipPosition / 1000)} in the song duration\nThe song will play for ${secondsToMinutesAndSeconds(timeToSkipPosition / 1000)}\nCurrently playing song: ${songName} by ${artists}`);

        await seekToTime(seekPosition);
        currentSkipTime = timeToSkipPosition / 1000;
        currentTime = Date.now();
        timeToSkip = currentTime + timeToSkipPosition;
        const timeToSkipInSeconds = (timeToSkip - currentTime) / 1000;
        const timeToSkipInSong = timeToSkipPosition / 1000;
        const timeToSkipInMinutesAndSeconds = secondsToMinutesAndSeconds(timeToSkipInSeconds);
        const timeToSkipInSongInSeconds = timeToSkipInSong;
        const timeToSkipInSongMinutesAndSeconds = secondsToMinutesAndSeconds(timeToSkipInSongInSeconds);

        console.log(`In consecutive ${consecutiveRuns} - Is it thyme 🤨 ${(Date.now() >= timeToSkip)}, if not how much time left: ${secondsToMinutesAndSeconds((timeToSkip - Date.now()) / 1000)}`);

        updateSkipMixMessage(`\nCONSECUTIVE Seeked to: ${secondsToMinutesAndSeconds(seekPosition)}\nSkip will occur at ${secondsToMinutesAndSeconds(seekPosition + timeToSkipInSongInSeconds)} in the song duration\nThe song will play for ${timeToSkipInSongMinutesAndSeconds}\nCurrently playing song: ${songName} by ${artists}`);
    }

    // Reset shuffleToggled at the end of the run
    shuffleToggled = false;
}

function shouldSkip() {
    return Date.now() >= timeToSkip || secondsToMinutesAndSeconds((timeToSkip - Date.now()) / 1000).includes("-");
}

function calculatePositions(currentTrack) {
    const options = {
        maxOffset: 30000,
        seekFraction: 1 / 3,
        minInterval: 33,
        seekSafety: 12,
    };

    let randomSeekPosition = document.getElementById("random-seek-position").checked;
    let randomSkipPosition = document.getElementById("random-skip-position").checked;

    let seekPosition;
    let timeToSkipPosition;

    if (randomSeekPosition && randomSkipPosition) {
        while (true) {
            while (true) {
                seekPosition = getRandomSeconds(3, currentTrack.duration - 12);
                if (!(seekPosition > currentTrack.duration - 12)) {
                    break;
                }
            }
            while (true) {
                timeToSkipPosition = getRandomMilliseconds(15000, (currentTrack.duration - seekPosition) * 1000);
                if (!(timeToSkipPosition > currentTrack.millis - 12000 && currentTrack.duration - seekPosition >= timeToSkipPosition / 1000)) {
                    break;
                }
            }
            if (seekPosition * 1000 <= timeToSkipPosition) {
                break;
            }
        }
    } else if (randomSeekPosition) {
        while (true) {
            seekPosition = getRandomSeconds(3, currentTrack.duration / 3);

            if (seekPosition < (currentTrack.duration / 3) + 12) {
                break;
            }
        }
        timeToSkipPosition = (currentTrack.millis / 3 * 2) - (seekPosition * 1000);
    } else if (randomSkipPosition) {
        while (true) {
            timeToSkipPosition = getRandomMilliseconds((currentTrack.millis / 3) + (currentTrack.millis / 3 / 2), currentTrack.millis - 12000);

            if (timeToSkipPosition > (currentTrack.millis / 3) + 10) {
                break;
            }
        }
        seekPosition = currentTrack.duration / 3;
    } else {
        seekPosition = currentTrack.duration / 3;
        timeToSkipPosition = currentTrack.millis / 3;
    }

    return { seekPosition, timeToSkipPosition };
}













function waitMS(ms) {
  console.log(`Waiting ${ms}ms`);
    return new Promise(resolve => setTimeout(resolve, ms));
}

  
// Function to convert seconds to minutes and seconds
function secondsToMinutesAndSeconds(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} minutes and ${remainingSeconds.toFixed(2)} seconds`;
}




// Function to get the current track's information from Spotify
async function getCurrentTrack() {
  await wait(200);
    try {
        const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (response.status === 200) {
            const data = await response.json();
            
            return {
                uri: data.item.uri,
                duration: data.item.duration_ms / 1000, // Duration in seconds
                millis: data.item.duration_ms,
                name: data.item.name,
                artists:data.item.artists
            };
        } else {
            console.error('Error getting currently playing track:', response.statusText);
            return null;
        }
    } catch (error) {
        console.error('Error getting currently playing track:', error);
        return null;
    }
}

// Function to seek to a specific time in the current track
async function seekToTime(timeInSeconds) {
//isSongProg
    try {
        const positionMs = Math.floor(timeInSeconds * 1000); // Convert to milliseconds
        const response = await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${positionMs}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (response.status === 204) {
            console.log(`Seeking to ${timeInSeconds} seconds in the track.`);
          currentPosition = positionMs;
          updateProgressBar(totalDuration, currentPosition)
            console.log('Seek successful.');
            await waitMS(200);
        } else {
            console.error('Error seeking to specified time:', response.statusText);
        }
    } catch (error) {
        console.error('Error seeking to specified time:', error);
    }

}

// Function to skip to the next song
async function skipToNextSong() {
    try {
        const response = await fetch('https://api.spotify.com/v1/me/player/next', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (response.status === 204) {
            console.log('Skipping to the next song.');
        }  else if (response.status === 401) {
              console.log('Refreshing token and retrying.');
            await checkAndRefreshToken();
            skipToNextSong()
          } 
        
        else {
            console.error('Error skipping to the next song:', response.statusText);
        }
    } catch (error) {
        console.error('Error skipping to the next song:', error);
    }
}

// Event listener for the Skip Mix button
document.getElementById('skip-mix-button').addEventListener('click', toggleSkipMix);

// Function to get a random time in seconds within the specified range
function getRandomSecondsFromSeconds(minSeconds, maxSeconds) {
    return Math.random() * (maxSeconds - minSeconds) + minSeconds;
}

// Function to get a random time in seconds from milliseconds within the specified range
function getRandomSecondsFromMilliseconds(minMillis, maxMillis) {
    const minSeconds = minMillis / 1000;
    const maxSeconds = maxMillis / 1000;
    return getRandomSecondsFromSeconds(minSeconds, maxSeconds);
}

// Function to get a random time in minutes from seconds within the specified range
function getRandomMinutesFromSeconds(minSeconds, maxSeconds) {
    const minMinutes = minSeconds / 60;
    const maxMinutes = maxSeconds / 60;
    return getRandomMinutes(minMinutes, maxMinutes);
}

// Function to get a random time in minutes from milliseconds within the specified range
function getRandomMinutesFromMilliseconds(minMillis, maxMillis) {
    const minMinutes = minMillis / 60000;
    const maxMinutes = maxMillis / 60000;
    return getRandomMinutes(minMinutes, maxMinutes);
}

// Function to get a random time in milliseconds within the specified range
function getRandomMillisecondsFromMilliseconds(minMillis, maxMillis) {
    return Math.random() * (maxMillis - minMillis) + minMillis;
}
// Function to get a random time in milliseconds from seconds within the specified range
function getRandomMillisecondsFromSeconds(minSeconds, maxSeconds) {
    const minMillis = minSeconds * 1000;
    const maxMillis = maxSeconds * 1000;
    return getRandomMilliseconds(minMillis, maxMillis)*1;
}

// Function to get a random time in milliseconds within the specified range
function getRandomMilliseconds(minMillis, maxMillis) {
    return 1*Math.random() * (maxMillis - minMillis) + minMillis;
}

function getRandomSeconds(minSeconds, maxSeconds) {
    return 1*Math.random() * (maxSeconds - minSeconds) + minSeconds;
}





 // Manual BPM Counter Variables
// Unified BPM tap system variables
let tapTimes = [];
const maxTapInterval = 3000; // Maximum time between taps
let lastSmoothedBPM;

// Log that the script file is loaded
console.log("SCRIPT FILE LOADED - DEBUG");

// Always add a window load handler for extra safety
window.addEventListener("load", function() {
    console.log("WINDOW FULLY LOADED - DEBUG");
    setupTapHandlers();
});

// Setup event listeners after DOM is loaded
document.addEventListener("DOMContentLoaded", function() {
    console.log("DOM CONTENT LOADED - DEBUG");
    setupTapHandlers();
});

// Main function to set up all tap handlers
function setupTapHandlers() {
    console.log("DOM loaded, setting up unified tap handlers");
    
    // Secondary tap tempo system (the one in the main card)
    const manualBpmButton = document.getElementById("manual-bpm-button");
    const manualBpmInput = document.getElementById("manual-bpm-input");
    const clearTapsButton = document.getElementById("clear-taps-button");
    
    // Main UI tap tempo system (in the mode selector)
    const mainTapButton = document.getElementById("tap-tempo");
    const mainClearButton = document.getElementById("clear-taps");
    
    // Set up SECONDARY tap system button (in the card)
    if (manualBpmButton) {
        console.log("Found manual-bpm-button, adding click listener");
        manualBpmButton.addEventListener("click", function(event) {
            console.log("SECONDARY TAP BUTTON CLICKED - DEBUG");
            console.warn("Tap detected!"); // Add an alert for debugging
            // Create and animate a temporary visual feedback element
            const tapFeedback = document.createElement('div');
            tapFeedback.style.cssText = `
                position: fixed;
                width: 20px;
                height: 20px;
                background: rgba(255, 255, 255, 0.8);
                border-radius: 50%;
                pointer-events: none;
                transform: translate(-50%, -50%);
                animation: tapFade 0.5s ease-out forwards;
            `;

            // Add the animation keyframes if they don't exist
            if (!document.querySelector('#tapFadeKeyframes')) {
                const style = document.createElement('style');
                style.id = 'tapFadeKeyframes';
                style.textContent = `
                    @keyframes tapFade {
                        0% { 
                            opacity: 1;
                            transform: translate(-50%, -50%) scale(0.5);
                        }
                        100% { 
                            opacity: 0;
                            transform: translate(-50%, -50%) scale(2);
                        }
                    }
                `;
                document.head.appendChild(style);
            }

            // Position the feedback element at click location
            tapFeedback.style.left = event.clientX + 'px';
            tapFeedback.style.top = event.clientY + 'px';

            // Add to DOM and remove after animation
            document.body.appendChild(tapFeedback);
            setTimeout(() => tapFeedback.remove(), 500);
            handleTapBPM();
        });
        console.log("Secondary tap button listener added");
    } else {
        console.error("Could not find manual-bpm-button");
        // Add debug info about all buttons in the document
        const allButtons = document.querySelectorAll("button");
        console.log("All buttons on page:", Array.from(allButtons).map(b => b.id || "unnamed button"));
    }
    
    // Set up MAIN tap button (in the mode selector)
    if (mainTapButton) {
        mainTapButton.addEventListener("click", function(event) {
            console.log("Main tap button clicked");
            handleTapBPM();
        });
        console.log("Main tap button listener added");
    }
    
    // Set up keyboard tap handling for SECONDARY input
    if (manualBpmInput) {
        manualBpmInput.addEventListener("input", function(event) {
            console.log("Keyboard tap detected");
            
            // Register the tap
            handleTapBPM();
            
            // Prevent the text from being added to the field
            setTimeout(() => {
                event.target.value = "";
                event.target.placeholder = "Use keyboard taps to set BPM";
            }, 10);
        });
        console.log("Keyboard tap listener added");
    } else {
        console.error("Could not find manual-bpm-input");
    }
    
    // Set up SECONDARY clear button
    if (clearTapsButton) {
        clearTapsButton.addEventListener("click", clearTaps);
        console.log("Secondary clear button listener added");
    } else {
        console.error("Could not find clear-taps-button");
    }
    
    // Set up MAIN clear button
    if (mainClearButton) {
        mainClearButton.addEventListener("click", clearTaps);
        console.log("Main clear button listener added");
    }
    
    // Set up the Set BPM button
    const setCustomBpmButton = document.getElementById("set-custom-bpm");
    if (setCustomBpmButton) {
        setCustomBpmButton.addEventListener("click", function() {
            const customBpmInput = document.getElementById("custom-bpm-input");
            if (customBpmInput) {
                const bpmValue = parseFloat(customBpmInput.value);
                if (!isNaN(bpmValue) && bpmValue > 0) {
                    applyCustomBPM(bpmValue);
                }
            }
        });
    }
}

// This function is now replaced with the inline implementation inside the event listener
// The old function has been removed to avoid confusion

// Unified tap BPM handler - used by all tap inputs (buttons and keyboard)
function handleTapBPM() {
    console.log("Tap detected for BPM calculation");
    const currentTime = new Date().getTime();
    tapTimes.push(currentTime);

    // Remove taps that are older than the maximum interval
    tapTimes = tapTimes.filter((tapTime) => currentTime - tapTime < maxTapInterval);

    // Get the custom BPM input field (define once and reuse)
    const customBPMInput = document.getElementById("custom-bpm-input");
    
    // Need at least 2 taps for a basic calculation, but 5 for optimal results
    if (tapTimes.length < 2) {
        // Update the custom BPM input field to show progress
        if (customBPMInput) {
            customBPMInput.value = `Tap 1 more time...`;
        }
        
        console.log(`Need 1 more tap for basic BPM calculation`);
        return;
    }
    
    // Show additional message for optimal results
    if (tapTimes.length < 5 && customBPMInput) {
        customBPMInput.value = `Tap ${5 - tapTimes.length} more for accuracy...`;
    }

    // Calculate raw BPM based on the time between taps
    const rawBPM = calculateBPM(tapTimes);

    if (rawBPM === 0) {
        console.log("No valid intervals found");
        return;
    }

    // Less aggressive smoothing - trust the raw values more
    let finalBPM;
    if (lastSmoothedBPM === undefined) {
        finalBPM = rawBPM; // First valid calculation
    } else {
        // Use a simple smoothing with more weight on new reading (80% new, 20% old)
        finalBPM = (rawBPM * 0.8) + (lastSmoothedBPM * 0.2); 
    }
    
    lastSmoothedBPM = finalBPM;
    
    // Round to whole number for display
    const roundedBPM = Math.round(finalBPM);
    
    console.log(`Calculated BPM: ${roundedBPM} (raw: ${rawBPM.toFixed(1)})`);
    
    // Update the custom BPM input field with the calculated value
    if (customBPMInput) {
        customBPMInput.value = roundedBPM;
    }
    
    // Check if we need to update just the flash rate or do a full BPM change
    const body = document.body;
    const isAlreadyFlashing = body.intervalId !== undefined;
    
    if (isAlreadyFlashing) {
        // Only update the interval rate directly without resetting the color sequence
        clearInterval(body.intervalId);
        const interval = 60 / roundedBPM * 1000;
        
        // Use the shared changeColorFunction
        body.intervalId = setInterval(changeColorFunction, interval);
        
        // Update global BPM variables
        customBPM = roundedBPM;
        lastKnownBPM = roundedBPM;
        currentBPM = roundedBPM;
        
        // Update BPM display
        const bpmDisplay = document.getElementById("bpm");
        if (bpmDisplay) {
            bpmDisplay.textContent = Math.round(roundedBPM);
        }
        
        // Update the transition
        updateTransition();
        
        // Update the document title
        document.title = `BPM Flash - ${Math.round(roundedBPM)} BPM`;
    } else {
        // Apply the BPM normally (first time)
        applyCustomBPM(roundedBPM);
    }
    
    // Visual feedback on the Set BPM button
    const setBpmButton = document.getElementById("set-custom-bpm");
    if (setBpmButton) {
        setBpmButton.classList.add("active");
        setTimeout(() => {
            setBpmButton.classList.remove("active");
        }, 200);
    }
}

// Function to calculate smoothed BPM based on the raw BPM
function calculateSmoothedBPM(rawBPM) {
    if (lastSmoothedBPM === undefined) {
        return rawBPM;
    }

    // Limit how much the BPM can change at once
    // Only apply smoothing if the change is significant
    const maxChange = 10; // Maximum allowed change in BPM
    const diff = Math.abs(rawBPM - lastSmoothedBPM);
    
    if (diff > maxChange) {
        // If change is too large, limit it
        const direction = rawBPM > lastSmoothedBPM ? 1 : -1;
        return lastSmoothedBPM + (direction * maxChange);
    } else {
        // For small changes, trust the raw value more
        const smoothingFactor = 0.7; // Higher value means more trust in new measurements
        const smoothedBPM = rawBPM * smoothingFactor + lastSmoothedBPM * (1 - smoothingFactor);
    lastSmoothedBPM = smoothedBPM;
    return smoothedBPM;
    }
}

// Unified function to clear tap data for all tap tempo systems
function clearTaps() {
    console.log("Clearing all tap data");
    
    // Reset the tap times array
    tapTimes = [];
    
    // Reset the smoothed BPM
    lastSmoothedBPM = undefined;

    // Clear the custom BPM input field
    const customBPMInput = document.getElementById("custom-bpm-input");
    if (customBPMInput) {
        customBPMInput.value = "";
        customBPMInput.placeholder = "Enter custom BPM";
    }
    
    // Show feedback in the tap info element if it exists
    const tapInfo = document.querySelector('.tap-info');
    if (tapInfo) {
        tapInfo.textContent = "Taps cleared. Tap again to detect BPM";
        tapInfo.style.display = 'block';
    }
    
    console.log("All tap data cleared");
}

// Function to apply the calculated BPM to the app
function applyCustomBPM(bpmValue) {
    if (!isNaN(bpmValue) && bpmValue > 0) {
        // Update the main BPM display
        const bpmDisplay = document.getElementById("bpm");
        if (bpmDisplay) {
            bpmDisplay.textContent = Math.round(bpmValue);
        }
        
        // Update global BPM variables for the application
        customBPM = bpmValue;
        lastKnownBPM = bpmValue;
        currentBPM = bpmValue;
        // Update the base BPM in our tempo control system
        baseBPM = bpmValue;
        tempoMultiplier = 1; // Reset multiplier when setting a new base BPM
        
        //isCustomBPM = true;
        customTrackURL = "";
        
        // Clear any BPM option buttons
        clearBpmOptionButtons();
        
        // Get the current interval ID to check if we're already flashing
        const body = document.body;
        const isAlreadyFlashing = body.intervalId !== undefined;
        
        if (isAlreadyFlashing) {
            // Just update the interval without resetting colors
            clearInterval(body.intervalId);
            const interval = 60 / bpmValue * 1000;
            body.intervalId = setInterval(changeColorFunction, interval);
        } else {
            // Full initialization of color flashing
            updateBackgroundColor(bpmValue);
        }
        
        updateTransition();
        
        // Update the document title to show the BPM
        document.title = `BPM Flash - ${Math.round(bpmValue)} BPM`;
        
        console.log(`BPM applied: ${bpmValue}`);
    } else {
        console.log("Invalid BPM value");
    }
}

// Function to calculate BPM based on tap times
function calculateBPM(tapTimes) {
    const numTaps = tapTimes.length;

    if (numTaps < 2) {
        return 0; // Not enough taps to calculate BPM
    }

    // Calculate the average interval between taps
    const averageInterval = tapTimes.reduce((sum, tapTime, index, array) => {
        if (index !== 0) {
            sum += tapTime - array[index - 1];
        }
        return sum;
    }, 0) / (numTaps - 1);

    // If there are fewer than five taps, return simple average
    if (numTaps < 5) {
        return 60000 / averageInterval;
    }

    // For 5+ taps, use a more sophisticated approach
    // Initialize an array to store averages of every five taps
    const intervalAverages = [];

    // Calculate the average of every five taps for better stability
    for (let i = 0; i < numTaps - 4; i++) {
        const fiveTapInterval = (tapTimes[i + 4] - tapTimes[i]) / 4;
        intervalAverages.push(fiveTapInterval);
    }

    // Include the remaining taps in the calculation
    const remainingTaps = numTaps % 5;
    if (remainingTaps > 1) { // Only include if there are at least 2 remaining taps
        const remainingAverage = (tapTimes[numTaps - 1] - tapTimes[numTaps - remainingTaps]) / (remainingTaps - 1);
        intervalAverages.push(remainingAverage);
    }

    // Filter out unreasonable intervals (30-300 BPM range)
    // 30 BPM = 2000ms, 300 BPM = 200ms
    const filteredIntervals = intervalAverages.filter(interval => interval >= 200 && interval <= 2000);
    
    if (filteredIntervals.length === 0) {
        return 60000 / averageInterval; // Fall back to simple average if all filtered
    }

    // Calculate the final BPM based on the average of filtered intervals
    const finalBPM = 60000 / (filteredIntervals.reduce((sum, interval) => sum + interval, 0) / filteredIntervals.length);

    return finalBPM;
}





  // // Function to listen for changes in song details and save the song to a playlist if auto-save is enabled V1
  // function listenForSongChanges() {
  //     // Check if auto-save is enabled and we have valid song details
  //     if (autoSaveEnabled && lastKnownSongDetails !== "" && lastKnownBPM !== 0) {
  //       const autoSaveToggleSpan = document.getElementById("autoSaveSpanText");
  //       const autoSaveToggleText = document.getElementById("extract-toggle2").checked ? "Auto save in<br>BPM Playlist" : "";
  //       autoSaveToggleSpan.innerHTML = autoSaveToggleText + " waiting for change";
  //         // Call function to save the song to a playlist
  //        console.log(currentSongUrl+" currentsongurl IN AUTO SAVE SONG")
  //         saveSongToPlaylist(lastKnownSongDetails, lastKnownBPM, currentSongUrl);
  //     }
  // }



  function listenForSongChanges() {
      // Check if Tunebat auto-fetch is enabled and we have valid song details
      const tunebatAutoToggle = document.getElementById('tunebat-auto-toggle');
      if (tunebatAutoToggle && tunebatAutoToggle.checked && lastKnownSongDetails !== "" && lastKnownSongDetails !== "N/A") {
          console.log("Auto-fetching BPM from Tunebat for song:", lastKnownSongDetails);
          handleTunebatAutoFetch(lastKnownSongDetails);
      }

      // Check if auto-save is enabled and we have valid song details
      if (autoSaveEnabled && lastKnownSongDetails !== "" && lastKnownSongDetails !== "N/A") {
        const currentBpmValue = Math.round(parseFloat(document.getElementById("bpm").textContent.trim()));
        
        // Only proceed if we have a valid BPM
        if (!isNaN(currentBpmValue) && currentBpmValue > 0) {
        const autoSaveToggleSpan = document.getElementById("autoSaveSpanText");
          const autoSaveToggleText = "Auto save in<br>BPM Manual Playlist";
          autoSaveToggleSpan.innerHTML = autoSaveToggleText + "<br>waiting for change";
          
          // Check if this is a new song+BPM combination
          const currentTimeStamp = Date.now();
          const currentCombo = `${lastKnownSongDetails}_${currentBpmValue}`;
          const lastSavedCombo = `${autoSaveLastSongDetails}_${autoSaveLastBPM}`;
          
          console.log(`Current combo: ${currentCombo}, Last saved: ${lastSavedCombo}, Time elapsed: ${currentTimeStamp - autoSaveTimeStamp}ms`);
          
          // Save if it's a new combination or enough time has passed
          if ((currentCombo !== lastSavedCombo && currentSongUrl !== autoSaveLastSongUrl) || 
              (currentTimeStamp - autoSaveTimeStamp >= 5666)) {
            
            console.log(`Saving new song/BPM combination: ${lastKnownSongDetails} - ${currentBpmValue}BPM`);
            saveSongToPlaylist(lastKnownSongDetails, currentBpmValue, currentSongUrl);
            
            // Update last saved info
            autoSaveLastSongDetails = lastKnownSongDetails;
            autoSaveLastBPM = currentBpmValue;
            autoSaveLastSongUrl = currentSongUrl;
              autoSaveTimeStamp = currentTimeStamp;
          }
        } else {
          console.log("Not auto-saving: BPM is invalid or zero");
        }
      }
  }


  


// Function to save the song to a playlist based on its BPM
async function saveSongToPlaylist(songTitle, bpm, trackURL) {
  // Skip if invalid input or BPM is zero
  if (!songTitle || !bpm || bpm <= 0) {
    console.log("Invalid song data for playlist: missing title or BPM is zero/invalid");
    return;
  }

  const autoSaveToggleSpan = document.getElementById("autoSaveSpanText");
  const autoSaveToggleText = document.getElementById("extract-toggle2").checked ? "Auto save in<br>BPM Playlist" : "";
    try {
        autoSaveToggleSpan.innerHTML = autoSaveToggleText + " ⏳";
        // Get the track ID from the Spotify URL
        const trackId = extractTrackIdFromURL(trackURL);
        
        if (!trackId) {
            console.log("Could not extract track ID from URL:", trackURL);
            autoSaveToggleSpan.innerHTML = autoSaveToggleText + " ❌ No track ID";
            setTimeout(() => {
                autoSaveToggleSpan.innerHTML = autoSaveToggleText;
            }, 7000);
            return;
        }
        
        // Add loading indicator
        autoSaveToggleSpan.innerHTML = autoSaveToggleText + " ⏳";
        // Create or get the playlist with the name based on BPM
        const playlistName = "~" + `${thresholdRound(bpm,0.495)} BPM Manual`;
        const playlistId = await getOrCreatePlaylist(playlistName);
        autoSaveToggleSpan.innerHTML = autoSaveToggleText + " ⏳";
        // Add the track to the playlist
        await addTrackToPlaylist(trackId, playlistId, accessToken);
        autoSaveToggleSpan.innerHTML = autoSaveToggleText + " ⏳";
                // Change to success indicator
        autoSaveToggleSpan.innerHTML = autoSaveToggleText+": "+ playlistName +"<br> ✅ " ;
        
        // Reset to default text after 5 seconds
        setTimeout(() => {
            autoSaveToggleSpan.innerHTML = autoSaveToggleText;
        }, 7000);
        console.log(`Song "${songTitle}" added to playlist "${playlistName}"`);
    } catch (error) {
        console.error("Error saving song to playlist:", error);
      // Change to error indicator
      autoSaveToggleSpan.innerHTML = autoSaveToggleText+" ❌ ";

      // Reset to default text after 5 seconds
      setTimeout(() => {
          autoSaveToggleSpan.innerHTML = autoSaveToggleText;
      }, 7000);
    }
}
  
// // Function to extract the track ID from a Spotify track URL
// function extractTrackIdFromURL(trackURL) {
//     // Use a regular expression to extract the track ID from the URL
//     const match = trackURL.match(/\/track\/([a-zA-Z0-9]+)/);

//     if (match && match[1]) {
//         return match[1];
//     } else {
//         return null;
//     }
// }

// async function getUserPlaylists(accessToken) {
//     try {
//         const response = await fetch("https://api.spotify.com/v1/me/playlists", {
//             method: "GET",
//             headers: {
//                 "Authorization": `Bearer ${accessToken}`,
//             },
//         });

//         if (response.ok) {
//             const data = await response.json();
//             return data.items;
//         } else {
//             throw new Error("Error fetching user playlists");
//         }
//     } catch (error) {
//         console.error("Error fetching user playlists:", error);
//         throw error;
//     }
// }

// // Function to get or create a playlist based on its name
// async function getOrCreatePlaylist(playlistName) {
//     try {
//         // Get user playlists
//         const playlists = await getUserPlaylists(accessToken);

//         // Check if the playlist already exists
//         for (const playlist of playlists) {
//             if (playlist.name === playlistName) {
//                 return playlist.id;
//             }
//         }

//         // If the playlist doesn't exist, create a new one
//         const response = await fetch("https://api.spotify.com/v1/me/playlists", {
//             method: "POST",
//             headers: {
//                 "Authorization": `Bearer ${accessToken}`,
//                 "Content-Type": "application/json",
//             },
//             body: JSON.stringify({
//                 name: playlistName,
//                 public: false,
//             }),
//         });

//         if (response.ok) {
//             const data = await response.json();
//             return data.id;
//         } else {
//             throw new Error("Error creating playlist");
//         }
//     } catch (error) {
//         console.error("Error getting or creating playlist:", error);
//         throw error;
//     }
// }
// Function to add a track to a playlist


  let allUserPlaylists = [];

  
  let lastKnowntrackId="";
async function addTrackToPlaylist(trackId, playlistId, accessToken) {
  if(trackId!==lastKnowntrackId){
    try {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                uris: [`spotify:track:${trackId}`],
            }),
        });

        if (!response.ok) {
            throw new Error("Error adding track to playlist");
        }else{
          lastKnowntrackId=trackId;
        }
    } catch (error) {
        console.error("Error adding track to playlist:", error);
        throw error;
    }
  }
}

// Function to get or create a playlist based on its name
async function getOrCreatePlaylist(playlistName, accessTokenParam) {
    try {
        // Use passed accessToken parameter or fall back to global accessToken
        const tokenToUse = accessTokenParam || accessToken;
        
        // Get user ID
        const userId = await getUserId();
        
        // Check if the playlist already exists
        const playlists = await getAllUserPlaylists(playlistName);
      if(playlists){
        for (const playlist of playlists) {
            if (playlist.name === playlistName) {
                return playlist.id;
            }
        }
      }
        // If the playlist doesn't exist, create a new one
        const response = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${tokenToUse}`,
                "Content-Type": "application/json",
            },
          body: JSON.stringify({
            name: playlistName,
            description: "Playlist created by BPM Flash app - @mihailv_ar | @mihailv_photos",
            public: true,
          }),
        });

        if (response.ok) {
            
            const data = await response.json();
          console.log(`Playlist made for ${playlistName}: ${data}`)
          allUserPlaylists = allUserPlaylists.concat(data)
            return data.id;
        } else {
            throw new Error("Error creating playlist: " + response.status + " - " + response.statusText);
        }
    } catch (error) {
        console.error("Error getting or creating playlist:", error);
        throw error;
    }
}




// // Function to fetch user's playlists from Spotify v1
//   async function getAllUserPlaylists(playlistName) {
//     try {
//       let allPlaylists = [];

//       let nextUrl = `https://api.spotify.com/v1/me/playlists?limit=40`;

//       while (nextUrl) {
//         const response = await fetch(nextUrl, {
//           method: 'GET',
//           headers: {
//             'Authorization': `Bearer ${accessToken}`,
//           },
//         });

//         if (response.ok) {
//           const playlistsBatch = await response.json();
//           // Check if the playlist already exists
//           for (const playlist of playlistsBatch.items) {
//               if (playlist.name === playlistName) {
//                   return [playlist]; // Playlist found, return all playlists
//               }
//           }
//           allPlaylists = allPlaylists.concat(playlistsBatch.items);
//           // Generate random cooldown time between 0.5 and 2 seconds
//           const cooldownTime = Math.random() * (1.875 - 0.87) + 0.87;
//           await new Promise(resolve => setTimeout(resolve, cooldownTime * 1000)); // Convert to milliseconds
//           console.log('Done with chunk:', nextUrl, "next page: ", playlistsBatch.next);
//           nextUrl = playlistsBatch.next; // Get the next URL for pagination
//         } else {
//           console.error('Error fetching user playlists:', response.statusText, "next page of fail: ", nextUrl);
//           return null;
//         }
//       }

//       return allPlaylists;
//     } catch (error) {
//       console.error('Error fetching user playlists:', error);
//       return null;
//     }
//   }

  // Function to fetch user's playlists from Spotify
  async function getAllUserPlaylists(playlistName) {
    try {
      if (allUserPlaylists.length === 0) {
        // Fetch all playlists if the local cache is empty
        await fetchAndUpdatePlaylists();
      }

      // Check if the playlist already exists
      const existingPlaylist = allUserPlaylists.find(playlist => playlist.name === playlistName);
      if (existingPlaylist) {
        console.log(`Playlist "${playlistName}" found in local cache.`);
        return [existingPlaylist];
      } else {
        console.log(`Playlist "${playlistName}" not found in local cache. Fetching all playlists...`);
        await fetchAndUpdatePlaylists();
        const updatedPlaylist = allUserPlaylists.find(playlist => playlist.name === playlistName);
        if (updatedPlaylist) {
          console.log(`Playlist "${playlistName}" found after update.`);
          return [updatedPlaylist];
        } else {
          console.log(`Playlist "${playlistName}" still not found.`);
          return null;
        }
      }
    } catch (error) {
      console.error('Error fetching user playlists:', error);
      return null;
    }
  }

  // Function to fetch and update user's playlists from Spotify
  async function fetchAndUpdatePlaylists() {
    try {
      let allPlaylists = [];
      let nextUrl = `https://api.spotify.com/v1/me/playlists?limit=40`;

      while (nextUrl) {
        const response = await fetch(nextUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          console.error('Error fetching user playlists:', response.statusText);
          return;
        }

        const playlistsBatch = await response.json();
        allPlaylists = allPlaylists.concat(playlistsBatch.items);
        nextUrl = playlistsBatch.next; // Get the next URL for pagination

        // Generate random cooldown time between 0.777 and 1.77 seconds
        const cooldownTime = Math.random() * (1.77 - 0.777) + 0.777;
        await new Promise(resolve => setTimeout(resolve, cooldownTime * 1000)); // Convert to milliseconds
      }

      allUserPlaylists = allPlaylists;
      localStorage.setItem('userPlaylists', JSON.stringify(allPlaylists));
      console.log('User playlists updated and saved to local storage.');
    } catch (error) {
      console.error('Error fetching user playlists:', error);
    }
  }



  

// Function to toggle auto-save
function toggleAutoSave() {
  autoSaveEnabled = !autoSaveEnabled;
}

// Event listener for the auto-save toggle switch
const autoSaveToggle = document.getElementById("extract-toggle2");
autoSaveToggle.addEventListener("change", function () {
  toggleAutoSave();
  if(autoSaveEnabled){
    if(parseFloat(document.getElementById("bpm").textContent.trim()) !== 0){
    listenForSongChanges();
    }
  }
});

// Function to get the Spotify user's ID
async function getUserId() {
  try {
    const response = await fetch("https://api.spotify.com/v1/me", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });
    if (response.ok) {
      const userData = await response.json();
      return userData.id;
    } else {
      console.error("Error fetching user ID:", response.statusText);
      return null;
    }
  } catch (error) {
    console.error("Error fetching user ID:", error);
    return null;
  }
}


  document.getElementById("manual-check-add").addEventListener("click", async function() {
      try {
        // Change button text to indicate adding
        this.innerHTML = "⏳";
        const manualSongTitle = fetchSongTitleFromSpotify(accessToken);
              const currentlyPlayingURL = await fetchTrackURL(accessToken);
              const trackId = extractTrackIdFromURL(currentlyPlayingURL);
              const bpm = Math.round(document.getElementById("bpm").textContent.trim()); // removed fetchBPMFromSpotify(accessToken) as spotify no longer allows bpm get;
              const playlistName = "~" + thresholdRound(bpm,0.495) + " BPM Manual";
              const playlistId = await getOrCreatePlaylist(playlistName, accessToken);
              await addTrackToPlaylist(trackId, playlistId, accessToken);
              console.log(`Song ${manualSongTitle} added to playlist ${playlistName} ---MANUALLY--- successfully.`);
        // Change button text to indicate successful addition
        this.innerHTML = "✅ to " + playlistName;

        // Change button text back to normal after a delay
        setTimeout(() => {
            this.innerHTML = "Add in BPM Playlist";
        }, 7000);
          }catch (error) {
          console.error("Error checking and adding song to playlist:", error);

        // Change button text to indicate failure
        this.innerHTML = "❌ to " + playlistName;
        
        // Change button text back to normal after a delay
        setTimeout(() => {
            this.innerHTML = "Add in BPM Playlist";
        }, 7000);
    }
  });


function iterativeRounding(num) {
  let tempNum = Math.round(num * 100) / 100; // Round to two decimal places
  tempNum = Math.round(tempNum * 10) / 10;   // Round to one decimal place
  tempNum = Math.round(tempNum * 10) / 10;   // Round to one decimal place
  tempNum = Math.round(tempNum);            // Round to nearest whole number
  return tempNum;
}
function thresholdRound(number, threshold) {
  // Extract the digits after the decimal point
  let decimalPart = number - Math.floor(number);
  
  // Check if the decimal part is greater than or equal to the threshold
  if (decimalPart >= threshold) {
    // If so, round up
    return Math.ceil(number);
  } else {
    // If not, round down
    return Math.floor(number);
  }
}
  

  
function log(message) {
    console.log(message);
}

function log(variable, message) {
    const formattedMessage = typeof message === 'string' ? message : JSON.stringify(message);
    console.log(`${variable}: ${formattedMessage}`);
}

function log(...args) {
  console.log(args.map(arg => {
    if (typeof arg === 'string') {
      return `"${arg}"`;
    } else {
      return arg;
    }
  }).join(': '));
}
  
  // Function to trigger the logout
              function logout() {
                deleteCookie('access_token');
                accessToken = getCookie('access_token');
                fetch('/logout', {
                  method: 'GET',
                })
                  .then((response) => {
                    if (response.status === 200) {
                      console.log('Logout successful');
                      isTokenExpired = true;
                      handleTokenExpiration();
                      deleteCookie('access_token');
                      accessToken = '';
                      isTokenExpired = true;
                      alert(`Logout successful`)
                    } else {
                      console.error('Error logging out:', response.statusText);
                    }
                  })
                  .catch((error) => {
                    console.error('Error logging out:', error);
                  });
              }


  // Attach a click event listener to the logout button
  document.getElementById('logout-button').addEventListener('click', logout);
  
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

    let updOverlayTime;

    // Call the updateBPMOverlay function on an interval
    setDefaultColors();
    updateBPMOverlay();
    if (!isTokenExpired) {
        if (accessToken !== "" && accessToken) {
                updOverlayTime = setInterval(updateBPMOverlay, 7130); // 30,000 milliseconds = 30 seconds

    }
}

// Function to fetch BPM from Google Search
async function fetchBPMFromTunebat(title, artist) {
    if (!title || !artist) {
        console.error("Title and artist are required for BPM search");
        return null;
    }

    try {
        // Clean up the title and artist - remove possible "feat." parts and parentheses
        const cleanTitle = title.split(' - ')[0]
            .replace(/\(feat\..*?\)/i, '')
            .replace(/\(ft\..*?\)/i, '')
            .replace(/\(with.*?\)/i, '')
            .replace(/\[.*?\]/g, '')
            .trim();
            
        const cleanArtist = artist.split(',')[0].trim();
        
        console.log(`Searching for BPM via Google for ${cleanTitle} by ${cleanArtist}`);
        
        // Clear any existing BPM option buttons
        clearBpmOptionButtons();
        
        // Call the server endpoint
        const response = await fetch(`/search-tunebat?title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}`);
        
        if (response.ok) {
            const data = await response.json();
            
            if (data && data.bpm && data.bpm !== 'N/A') {
                console.log(`BPM found via Google: ${data.bpm} (confidence: ${data.confidence || 'unknown'}%)`);
                
                // If we have BPM clusters, display them as options
                if (data.bpm_clusters && data.bpm_clusters.length > 0) {
                    displayBpmOptionButtons(data.bpm_clusters, data.bpm);
                }
                
                return {
                    bpm: data.bpm,
                    key: data.key || 'Unknown',
                    title: data.title,
                    artist: data.artist,
                    method: 'google_search',
                    confidence: data.confidence,
                    bpm_clusters: data.bpm_clusters
                };
            } else {
                console.error("No BPM data found via Google search");
                return {
                    bpm: 0,
                    key: 'Unknown',
                    title: title,
                    artist: artist,
                    method: 'google_search',
                    success: false
                };
            }
        } else {
            console.error(`Error fetching BPM: ${response.status}`);
            return {
                bpm: 0,
                key: 'Unknown',
                title: title,
                artist: artist,
                method: 'google_search',
                success: false
            };
        }
    } catch (error) {
        console.error("Error in BPM search:", error);
        return {
            bpm: 0,
            key: 'Unknown',
            title: title,
            artist: artist,
            method: 'google_search',
            success: false
        };
    }
}

// Function to display BPM option buttons
function displayBpmOptionButtons(bpmClusters, selectedBpm) {
    const container = document.getElementById('bpm-buttons-container');
    if (!container) return;
    
    // Clear any existing buttons
    container.innerHTML = '<br><strong>Other BPM options:</strong><br>';
    
    // Create buttons for each BPM cluster
    bpmClusters.forEach(cluster => {
        const buttonText = `${cluster.bpm} BPM (${cluster.count})`;
        const button = document.createElement('button');
        button.textContent = buttonText;
        button.className = 'bpm-option-btn';
        button.dataset.bpm = cluster.bpm;
        
        // Style the button
        button.style.margin = '3px';
        button.style.padding = '5px 10px';
        button.style.borderRadius = '4px';
        button.style.border = '1px solid #444';
        button.style.background = cluster.bpm == selectedBpm ? '#6c5ce7' : '#333';
        button.style.color = '#fff';
        button.style.cursor = 'pointer';
        
        // Add click event listener
        button.addEventListener('click', function() {
            setBpmFromOption(cluster.bpm);
        });
        
        container.appendChild(button);
    });
    
    // Show the container
    container.style.display = 'inline-grid';
}

// Function to set BPM from option button
function setBpmFromOption(bpmValue) {
    const bpmElement = document.getElementById('bpm');
    if (!bpmElement) return;
    
    // Update the BPM display
    bpmElement.textContent = bpmValue;
    
    // Highlight the selected button
    const buttons = document.querySelectorAll('.bpm-option-btn');
    buttons.forEach(btn => {
        if (parseInt(btn.dataset.bpm) === parseInt(bpmValue)) {
            btn.style.background = '#6c5ce7';
        } else {
            btn.style.background = '#333';
        }
    });
    
    // Update the background color based on the new BPM
    updateBackgroundColor(bpmValue);
    
    // Update other components that depend on BPM
    lastKnownBPM = bpmValue;
    updateTransition();
    
    console.log(`BPM manually set to ${bpmValue} from options`);
}

// Function to clear BPM option buttons
function clearBpmOptionButtons() {
    const container = document.getElementById('bpm-buttons-container');
    if (container) {
        container.innerHTML = '';
        container.style.display = 'none';
    }
}

// Legacy function maintained for backward compatibility
// Now just redirects to the new unified BPM system
function handleManualBPM() {
    console.log("Legacy handleManualBPM called - redirecting to handleTapBPM");
    handleTapBPM();
}

// Add this to the end of the document to set up the toggle listener
const tunebatAutoToggle = document.getElementById('tunebat-auto-toggle');
if (tunebatAutoToggle) {
    tunebatAutoToggle.addEventListener('change', function() {
        if (this.checked) {
            console.log("Auto-fetch from Tunebat enabled");
            
            // Try to fetch immediately for current song if playing
            if (lastKnownSongDetails !== "N/A" && lastKnownSongDetails !== "") {
                handleTunebatAutoFetch(lastKnownSongDetails);
            }
        } else {
            console.log("Auto-fetch from Tunebat disabled");
        }
    });
}

// Set up the "Set BPM" button to apply the custom BPM value
document.addEventListener("DOMContentLoaded", function() {
    const setCustomBpmButton = document.getElementById("set-custom-bpm");
    if (setCustomBpmButton) {
        setCustomBpmButton.addEventListener("click", function() {
            const customBpmInput3 = document.getElementById("custom-bpm-input");
            if (customBpmInput3) {
                const bpmValue = parseFloat(customBpmInput3.value);
                if (!isNaN(bpmValue) && bpmValue > 0) {
                    // Update the main BPM display
                    const bpmDisplay = document.getElementById("bpm");
                    if (bpmDisplay) {
                        bpmDisplay.textContent = Math.round(bpmValue.toFixed(2));
                    }
                    
                    // Update variables
                    customBPM = bpmValue;
                    lastKnownBPM = bpmValue;
                    currentBPM = bpmValue;
                    customTrackURL = "";
                    
                    // Clear any BPM option buttons
                    clearBpmOptionButtons();
                    
                    // Update background color based on new BPM
                    // updateBackgroundColor(bpmValue);
                    updateTransition();
                    
                    console.log(`BPM manually set to ${bpmValue}`);
                } else {
                    console.log("Invalid BPM value");
                }
            }
        });
        console.log("Set custom BPM button listener added");
    } else {
        console.error("Could not find set-custom-bpm button");
    }
});

// Function to handle auto fetching via Google Search
async function handleTunebatAutoFetch(songDetails) {
    if (!songDetails || songDetails === "N/A") return;
    
    // Split song details into artist and title
    const parts = songDetails.split(' - ');
    if (parts.length < 2) return;
    
    const artist = parts[0];
    const title = parts.slice(1).join(' - ');
    
    // Show loading indicator in BPM display
    const bpmElement = document.getElementById("bpm");
    const oldBpm = bpmElement.textContent;
    bpmElement.textContent = "...";
    
    // Clear any existing BPM option buttons
    clearBpmOptionButtons();
    
    // Fetch BPM via Google Search
    const result = await fetchBPMFromTunebat(title, artist);
    
    if (result && result.bpm && result.bpm > 0) {
        // Update the BPM display
        bpmElement.textContent = result.bpm;
        
        // Update other necessary UI elements and variables
        lastKnownBPM = result.bpm;
        updateBackgroundColor(result.bpm);
        updateTransition();
        
        console.log(`Auto-fetched BPM: ${result.bpm}`);
    } else {
        // If no result was found, restore the old BPM
        bpmElement.textContent = oldBpm;
        console.log("No BPM found via auto-fetch");
    }
}

// Find the actual listenForSongChanges function and replace it

// Function to populate the Tunebat search fields with current song
function populateTunebatFields(songDetails) {
    if (!songDetails || songDetails === "N/A") return;
    
    // Split song details into artist and title
    const parts = songDetails.split(' - ');
    if (parts.length < 2) return;
    
    const artist = parts[0];
    const title = parts.slice(1).join(' - ');
    
    // Find the Tunebat input fields and populate them
    const tunebatSection = document.querySelector('.tunebat-input');
    if (tunebatSection) {
        const titleInput = tunebatSection.querySelectorAll('.bpm-input')[0];
        const artistInput = tunebatSection.querySelectorAll('.bpm-input')[1];
        
        if (titleInput && artistInput) {
            titleInput.value = title;
            artistInput.value = artist;
            console.log(`Populated Tunebat fields with "${title}" by "${artist}"`);
        }
    }
}

// Add this function to update Tunebat fields whenever the song changes
function updateTunebatFieldsWithCurrentSong() {
    if (lastKnownSongDetails && lastKnownSongDetails !== "N/A") {
        populateTunebatFields(lastKnownSongDetails);
    }
}

// Add to updateBPMOverlay function to call this whenever a song changes
function addTunebatPopulateToUpdateBPMOverlay() {
    // This is a placeholder - we'll use search_replace to modify updateBPMOverlay directly
}

// Legacy function maintained for backward compatibility
// Now just redirects to the unified clearTaps function
function clearSecondaryTaps() {
    console.log("Legacy clearSecondaryTaps called - redirecting to clearTaps");
    clearTaps();
}

    // Set up event listeners for tempo control buttons
    const tempoStopButton = document.getElementById("stop-button");
    const tempoHalfButton = document.getElementById("half-button");
    const tempoDoubleButton = document.getElementById("double-button");
    const tempoQuadrupleButton = document.getElementById("quadruple-button");
    const tempoResetButton = document.getElementById("reset-button");
    
    // Additional tempo buttons
    const tempoOneThirdButton = document.getElementById("one-third-button");
    const tempoTwoThirdsButton = document.getElementById("two-thirds-button");
    const tempoThreeQuartersButton = document.getElementById("three-quarters-button");
    const tempoTwoHalfButton = document.getElementById("two-half-button");
    const tempoTripleButton = document.getElementById("triple-button");
    const saveBaseBpmButton = document.getElementById("save-base-bpm");

    // Variables to track tempo and BPM
    let tempoMultiplier = 1;
    let baseBPM = 0;
    
    tempoStopButton.addEventListener("click", function() {
        modifyTempo(0);
    });
    
    tempoHalfButton.addEventListener("click", function() {
        modifyTempo(0.5);
    });
    
    tempoDoubleButton.addEventListener("click", function() {
        modifyTempo(2);
    });
    
    tempoQuadrupleButton.addEventListener("click", function() {
        modifyTempo(4);
    });
    
    tempoResetButton.addEventListener("click", function() {
        modifyTempo(1);
    });
    
    // Add event listeners for additional tempo buttons
    tempoOneThirdButton.addEventListener("click", function() {
        modifyTempo(1/3);
    });
    
    tempoTwoThirdsButton.addEventListener("click", function() {
        modifyTempo(2/3);
    });
    
    tempoThreeQuartersButton.addEventListener("click", function() {
        modifyTempo(0.75);
    });
    
    tempoTwoHalfButton.addEventListener("click", function() {
        modifyTempo(2.5);
    });
    
    tempoTripleButton.addEventListener("click", function() {
        modifyTempo(3);
    });
    
    // Add event listener for save base BPM button
    saveBaseBpmButton.addEventListener("click", function() {
        const bpmElement = document.getElementById("bpm");
        if (!bpmElement) return;
        
        const currentBPM = parseFloat(bpmElement.textContent);
        if (isNaN(currentBPM) || currentBPM <= 0) return;
        
        // Update base BPM and reset the multiplier
        baseBPM = currentBPM;
        tempoMultiplier = 1;
        
        // Update UI to reflect the new base
        bpmElement.textContent = Math.round(baseBPM);
        
        // Update interval without resetting color sequence
        updateFlashingInterval(baseBPM);
        
        console.log(`New base BPM set: ${baseBPM}`);
    });
    
    // Function to modify tempo without resetting the color sequence
    function modifyTempo(multiplier) {
        tempoMultiplier = multiplier;
        
        const bpmElement = document.getElementById("bpm");
        if (!bpmElement) return;
        
        // If baseBPM isn't set yet, initialize it
        if (baseBPM <= 0) {
            baseBPM = parseFloat(bpmElement.textContent);
            if (isNaN(baseBPM) || baseBPM <= 0) return;
        }
        
        // Calculate the new displayed BPM
        const displayBPM = multiplier === 0 ? 0 : baseBPM * multiplier;
        
        // Update the display to show the modified BPM
        bpmElement.textContent = Math.round(displayBPM);
        
        // Update the flashing interval
        updateFlashingInterval(displayBPM);
    }
    
    // Function to update the flashing interval without resetting color sequence
    function updateFlashingInterval(bpm) {
        const body = document.body;
        
        // Clear any existing interval
        clearInterval(body.intervalId);
        
        // If BPM is 0 (stop), just clear the interval and set dark gray background
        if (bpm <= 0) {
            body.style.backgroundColor = "#424242";
            return;
        }
        
        // Calculate new interval with the BPM
        const interval = 60 / bpm * 1000;
        
        // Set a new interval with the existing changeColorFunction (don't reset color sequence)
        body.intervalId = setInterval(changeColorFunction, interval);
    }

    // Initialize the drag functionality for the BPM balloon
    initializeBpmBalloon();
    
    // Original DOMContentLoaded code continues...
    
    // Make BPM balloon draggable
    function initializeBpmBalloon() {
        const balloon = document.getElementById("bpm-balloon");
        const balloonBpm = document.getElementById("balloon-bpm");
        
        if (!balloon || !balloonBpm) return;
        
        // Initial BPM sync
        updateBalloonBpm();
        
        // Set up MutationObserver to watch for changes to the main BPM element
        const bpmElement = document.getElementById("bpm");
        if (bpmElement) {
            const observer = new MutationObserver(() => {
                updateBalloonBpm();
            });
            
            observer.observe(bpmElement, { 
                childList: true,
                characterData: true,
                subtree: true 
            });
        }
        
        // Function to update the balloon BPM
        function updateBalloonBpm() {
            const bpmElement = document.getElementById("bpm");
            if (bpmElement) {
                balloonBpm.textContent = bpmElement.textContent;
            }
        }
        
        // Variables for drag functionality
        let isDragging = false;
        let offsetX, offsetY;
        
        // Mouse event listeners
        balloon.addEventListener("mousedown", startDrag);
        document.addEventListener("mousemove", drag);
        document.addEventListener("mouseup", stopDrag);
        
        // Touch event listeners for mobile
        balloon.addEventListener("touchstart", startDragTouch);
        document.addEventListener("touchmove", dragTouch);
        document.addEventListener("touchend", stopDragTouch);
        
        function startDrag(e) {
            isDragging = true;
            offsetX = e.clientX - balloon.getBoundingClientRect().left;
            offsetY = e.clientY - balloon.getBoundingClientRect().top;
            balloon.style.opacity = "0.7"; // Visual feedback
        }
        
        function drag(e) {
            if (!isDragging) return;
            e.preventDefault();
            
            balloon.style.left = (e.clientX - offsetX) + "px";
            balloon.style.top = (e.clientY - offsetY) + "px";
        }
        
        function stopDrag() {
            isDragging = false;
            balloon.style.opacity = "1";
        }
        
        function startDragTouch(e) {
            isDragging = true;
            const touch = e.touches[0];
            offsetX = touch.clientX - balloon.getBoundingClientRect().left;
            offsetY = touch.clientY - balloon.getBoundingClientRect().top;
            balloon.style.opacity = "0.7"; // Visual feedback
        }
        
        function dragTouch(e) {
            if (!isDragging) return;
            e.preventDefault();
            
            const touch = e.touches[0];
            balloon.style.left = (touch.clientX - offsetX) + "px";
            balloon.style.top = (touch.clientY - offsetY) + "px";
        }
        
        function stopDragTouch() {
            isDragging = false;
            balloon.style.opacity = "1";
        }
    }

});