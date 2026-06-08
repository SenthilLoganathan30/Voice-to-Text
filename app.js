/* ==========================================================================
   Voice-to-Ticket Agent Core Application Logic
   Features: sql.js, WAV recording, Audio visualizer, SpeechSynthesis TTS,
             OpenAI API integration, and SQLite Database console query engine.
   ========================================================================== */

// Global App State
let db = null;
let SQL = null;
let mediaRecorder = null;
let audioContext = null;
let analyser = null;
let micStream = null;
let scriptNode = null;
let audioBuffer = [];
let sampleRate = 44100;
let isRecording = false;
let recordedAudioBlob = null;
let simulatedText = null;
let currentScenario = null;
let animationId = null;

// DOM Elements
const navButtons = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');
const systemStatus = document.getElementById('systemStatus');
const consoleLogs = document.getElementById('consoleLogs');
const dbSizeText = document.getElementById('dbSizeText');

// Stepper DOM Elements
const steps = document.querySelectorAll('.step');
const stepLines = document.querySelectorAll('.step-line');

// Dashboard DOM Elements
const statTotalTickets = document.getElementById('statTotalTickets');
const statHighPriority = document.getElementById('statHighPriority');
const statTranscribed = document.getElementById('statTranscribed');
const dashboardTicketsTable = document.getElementById('dashboardTicketsTable');
const btnRefreshDashboard = document.getElementById('btnRefreshDashboard');

// Call Processor DOM Elements
const canvas = document.getElementById('visualizer');
const canvasCtx = canvas.getContext('2d');
const recordTimer = document.getElementById('recordTimer');
const btnRecord = document.getElementById('btnRecord');
const btnStopRecord = document.getElementById('btnStopRecord');
const fileUpload = document.getElementById('fileUpload');
const btnUploadTrigger = document.getElementById('btnUploadTrigger');
const uploadFileName = document.getElementById('uploadFileName');
const btnStartPipeline = document.getElementById('btnStartPipeline');
const pipelineStatusBanner = document.getElementById('pipelineStatusBanner');
const resTicketNum = document.getElementById('resTicketNum');
const resTitle = document.getElementById('resTitle');
const resCategory = document.getElementById('resCategory');
const resPriority = document.getElementById('resPriority');
const resCallerName = document.getElementById('resCallerName');
const resTranscription = document.getElementById('resTranscription');
const resultCard = document.getElementById('resultCard');
const resultPlaceholder = resultCard.querySelector('.result-placeholder');
const resultDetails = resultCard.querySelector('.result-details');

// Settings DOM Elements
const apiKeyInput = document.getElementById('apiKeyInput');
const btnSaveSettings = document.getElementById('btnSaveSettings');
const btnClearSettings = document.getElementById('btnClearSettings');
const btnToggleApiKey = document.getElementById('btnToggleApiKey');
const delayInput = document.getElementById('delayInput');

// Console DOM Elements
const sqlQueryText = document.getElementById('sqlQueryText');
const btnExecuteSql = document.getElementById('btnExecuteSql');
const btnExportDb = document.getElementById('btnExportDb');
const btnResetDb = document.getElementById('btnResetDb');
const queryOutput = document.getElementById('queryOutput');
const templatesDropdown = document.getElementById('templatesDropdown');

// Mock Scenarios Data
const scenarios = {
    wifi: {
        speech: "Hi, yes, I'm calling because the WiFi in my office has stopped working. The router lights are blinking red, and my name is Sarah Jenkins. I need this resolved immediately because I have a client presentation starting in ten minutes.",
        transcript: "Hi, yes, I'm calling because the WiFi in my office has stopped working. The router lights are blinking red, and my name is Sarah Jenkins. I need this resolved immediately because I have a client presentation starting in ten minutes.",
        extracted: {
            title: "Office WiFi Outage",
            description: "The primary office WiFi connection has dropped. Router lights are blinking red. Client presentation is starting in 10 minutes.",
            category: "Technical",
            priority: "Urgent",
            caller_name: "Sarah Jenkins"
        }
    },
    billing: {
        speech: "Hello, my name is Michael Ross. I was reviewing my billing statement this morning and noticed that I was charged twice for my premium subscription this month. The invoice numbers are 4051 and 4052. Please refund the duplicate charge.",
        transcript: "Hello, my name is Michael Ross. I was reviewing my billing statement this morning and noticed that I was charged twice for my premium subscription this month. The invoice numbers are 4051 and 4052. Please refund the duplicate charge.",
        extracted: {
            title: "Duplicate Subscription Charge",
            description: "Customer noticed a double billing charge for their premium subscription (Invoice 4051 and 4052) and requested a refund.",
            category: "Billing",
            priority: "High",
            caller_name: "Michael Ross"
        }
    },
    account: {
        speech: "Hey there, this is David Carter. I tried logging in to my customer portal today but it says my account has been locked due to too many failed attempts. I need to access my files as soon as possible. Can you unlock my account?",
        transcript: "Hey there, this is David Carter. I tried logging in to my customer portal today but it says my account has been locked due to too many failed attempts. I need to access my files as soon as possible. Can you unlock my account?",
        extracted: {
            title: "Account Lockout Support",
            description: "Caller is locked out of their customer portal after multiple incorrect password attempts and requires urgent account unlock to access files.",
            category: "Security",
            priority: "Medium",
            caller_name: "David Carter"
        }
    }
};

/* ==========================================================================
   Initialization & Setup
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Initial UI Setup
    initTabs();
    initSettings();
    initDatabase();
    initVisualizer();
    
    // Add Event Listeners
    btnRecord.addEventListener('click', startRecording);
    btnStopRecord.addEventListener('click', stopRecording);
    btnUploadTrigger.addEventListener('click', () => fileUpload.click());
    fileUpload.addEventListener('change', handleFileUpload);
    btnStartPipeline.addEventListener('click', runPipeline);
    btnRefreshDashboard.addEventListener('click', refreshDashboard);
    btnExecuteSql.addEventListener('click', executeSqlQuery);
    btnExportDb.addEventListener('click', exportDatabase);
    btnResetDb.addEventListener('click', resetDatabase);
    btnSaveSettings.addEventListener('click', saveSettings);
    btnClearSettings.addEventListener('click', clearSettings);
    btnToggleApiKey.addEventListener('click', toggleApiKeyVisibility);
    document.getElementById('btnClearConsole').addEventListener('click', () => {
        consoleLogs.innerHTML = '<div class="log-line text-muted">[CONSOLE CLEARED]</div>';
    });
    
    // Scenario Buttons
    document.querySelectorAll('.btn-scenario').forEach(btn => {
        btn.addEventListener('click', () => {
            const scenarioKey = btn.dataset.scenario;
            triggerScenario(scenarioKey);
        });
    });

    // Console Query Templates
    document.querySelectorAll('#templatesDropdown span').forEach(item => {
        item.addEventListener('click', (e) => {
            sqlQueryText.value = e.target.dataset.query;
            templatesDropdown.style.display = 'none';
            // Simple display toggle workaround
            setTimeout(() => templatesDropdown.style.removeAttribute('style'), 500);
        });
    });
});

// Tab Navigation
function initTabs() {
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            
            navButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const activeContent = document.getElementById(targetTab);
            activeContent.classList.add('active');
            
            log(`Navigated to ${targetTab.toUpperCase()} tab`, "muted");
            
            if (targetTab === 'dashboard') {
                refreshDashboard();
            }
        });
    });
}

// Logging Utility
function log(msg, type = 'info') {
    const line = document.createElement('div');
    line.className = `log-line text-${type}`;
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    line.textContent = `[${time}] ${msg}`;
    consoleLogs.appendChild(line);
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

// HTML Escaper
function escapeHtml(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ==========================================================================
   SQLite Engine & Persistence (localStorage base64)
   ========================================================================== */

async function initDatabase() {
    try {
        log("Loading SQLite WASM Engine...", "info");
        SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });
        
        const savedDbB64 = localStorage.getItem('ticket_agent_db');
        if (savedDbB64) {
            log("Restoring existing database from localStorage...", "info");
            const binary = base64ToUint8(savedDbB64);
            db = new SQL.Database(binary);
        } else {
            log("No saved database found. Initializing new tables...", "info");
            db = new SQL.Database();
            db.run(`
                CREATE TABLE IF NOT EXISTS tickets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticket_num TEXT UNIQUE,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    category TEXT NOT NULL,
                    priority TEXT NOT NULL,
                    caller_name TEXT,
                    transcription TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            saveDatabase();
        }
        log("SQLite database engine ready.", "success");
        updateDbSizeText();
        refreshDashboard();
    } catch (err) {
        log("Error initializing SQLite: " + err.message, "danger");
        console.error(err);
    }
}

function saveDatabase() {
    if (!db) return;
    try {
        const binary = db.export();
        const base64 = uint8ToBase64(binary);
        localStorage.setItem('ticket_agent_db', base64);
        updateDbSizeText();
    } catch (err) {
        log("Failed to persist database changes: " + err.message, "danger");
    }
}

function updateDbSizeText() {
    if (!db) return;
    try {
        const bytes = db.export().byteLength;
        const sizeStr = (bytes / 1024).toFixed(2) + " KB";
        dbSizeText.textContent = sizeStr;
    } catch (e) {
        dbSizeText.textContent = "Unknown";
    }
}

function resetDatabase() {
    if (!confirm("Are you sure you want to delete all tickets and reset the database?")) return;
    try {
        db = new SQL.Database();
        db.run(`
            CREATE TABLE IF NOT EXISTS tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_num TEXT UNIQUE,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT NOT NULL,
                priority TEXT NOT NULL,
                caller_name TEXT,
                transcription TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        saveDatabase();
        log("Database reset completed successfully.", "success");
        refreshDashboard();
        queryOutput.innerHTML = '<span class="placeholder-text">Database cleared.</span>';
        queryOutput.classList.remove('has-data');
    } catch (e) {
        log("Failed to reset database: " + e.message, "danger");
    }
}

function exportDatabase() {
    if (!db) return;
    try {
        log("Exporting SQLite database binary...", "info");
        const binaryDb = db.export();
        const blob = new Blob([binaryDb], { type: "application/x-sqlite3" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = "voice_tickets.db";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        log("Database downloaded successfully.", "success");
    } catch (e) {
        log("Export database failed: " + e.message, "danger");
    }
}

function refreshDashboard() {
    if (!db) return;
    try {
        // Query Stats
        const totalRes = db.exec("SELECT COUNT(*) FROM tickets");
        const total = totalRes.length > 0 ? totalRes[0].values[0][0] : 0;
        statTotalTickets.textContent = total;
        
        const highRes = db.exec("SELECT COUNT(*) FROM tickets WHERE priority IN ('High', 'Urgent')");
        const high = highRes.length > 0 ? highRes[0].values[0][0] : 0;
        statHighPriority.textContent = high;
        
        const transRes = db.exec("SELECT COUNT(*) FROM tickets WHERE transcription IS NOT NULL AND transcription != ''");
        const trans = transRes.length > 0 ? transRes[0].values[0][0] : 0;
        statTranscribed.textContent = trans;
        
        // Load recent 5 tickets
        const recentRes = db.exec(`
            SELECT ticket_num, title, category, priority, caller_name, created_at 
            FROM tickets 
            ORDER BY id DESC 
            LIMIT 5
        `);
        
        const tbody = dashboardTicketsTable.querySelector('tbody');
        tbody.innerHTML = '';
        
        if (recentRes.length > 0) {
            const rows = recentRes[0].values;
            rows.forEach(row => {
                const tr = document.createElement('tr');
                const tNum = row[0];
                const title = row[1];
                const cat = row[2];
                const pri = row[3];
                const caller = row[4] || 'N/A';
                const created = row[5];
                
                // Format Date
                const dateObj = new Date(created + 'Z');
                const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                tr.innerHTML = `
                    <td style="font-family:'Fira Code'; font-weight:600; color:var(--accent-cyan);">${tNum}</td>
                    <td>${escapeHtml(title)}</td>
                    <td><span class="badge badge-${cat.toLowerCase()}">${cat}</span></td>
                    <td><span class="badge badge-${pri.toLowerCase()}">${pri}</span></td>
                    <td>${escapeHtml(caller)}</td>
                    <td style="font-size:12px; color:var(--text-muted);">${dateStr}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center placeholder-text">No tickets in database. Process a support call to log one.</td>
                </tr>
            `;
        }
    } catch (e) {
        log("Dashboard refresh error: " + e.message, "danger");
    }
}

// ArrayBuffer converters helper
function uint8ToBase64(bytes) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i += 8192) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return btoa(binary);
}

function base64ToUint8(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

/* ==========================================================================
   Audio Input & Visualizer
   ========================================================================== */

function initVisualizer() {
    canvas.width = canvas.parentElement.clientWidth;
    // Window resize handle
    window.addEventListener('resize', () => {
        canvas.width = canvas.parentElement.clientWidth;
    });
    
    // Start idle visualizer state
    startVisualizerAnim();
}

let timerInterval;
function startRecordingTimer() {
    let sec = 0;
    recordTimer.textContent = "00:00";
    timerInterval = setInterval(() => {
        sec++;
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        recordTimer.textContent = `${m}:${s}`;
    }, 1000);
}

function stopRecordingTimer() {
    clearInterval(timerInterval);
}

async function startRecording() {
    try {
        log("Requesting microphone permissions...", "info");
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        log("Microphone access granted. Initializing Audio Context...", "info");
        
        audioBuffer = [];
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        sampleRate = audioContext.sampleRate;
        
        const source = audioContext.createMediaStreamSource(micStream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        
        // Script Processor Node to buffer PCM raw samples
        scriptNode = audioContext.createScriptProcessor(4096, 1, 1);
        analyser.connect(scriptNode);
        scriptNode.connect(audioContext.destination);
        
        scriptNode.onaudioprocess = (e) => {
            if (!isRecording) return;
            const inputData = e.inputBuffer.getChannelData(0);
            audioBuffer.push(new Float32Array(inputData));
            
            // Silence buffer output to prevent speakers loopback feedback
            const outputData = e.outputBuffer.getChannelData(0);
            for (let i = 0; i < outputData.length; i++) {
                outputData[i] = 0.0;
            }
        };
        
        isRecording = true;
        recordedAudioBlob = null;
        simulatedText = null;
        currentScenario = null;
        
        btnRecord.classList.add('recording');
        btnRecord.querySelector('span').textContent = 'Recording Call...';
        btnRecord.disabled = true;
        btnStopRecord.disabled = false;
        btnStartPipeline.disabled = true;
        btnUploadTrigger.disabled = true;
        uploadFileName.textContent = '';
        
        resetStepper();
        updateStepper(0); // Set Audio to active
        startRecordingTimer();
        
        pipelineStatusBanner.className = "pipeline-status-banner processing";
        pipelineStatusBanner.querySelector('.banner-text').textContent = "Microphone active. Recording support call...";
        log("Microphone recording started.", "info");
    } catch (err) {
        log("Failed to start recording: " + err.message, "danger");
        console.error(err);
    }
}

function stopRecording() {
    if (!isRecording) return;
    log("Stopping microphone recording. Flattening buffer...", "info");
    
    isRecording = false;
    stopRecordingTimer();
    
    btnRecord.classList.remove('recording');
    btnRecord.querySelector('span').textContent = 'Record Microphone';
    btnRecord.disabled = false;
    btnStopRecord.disabled = true;
    btnUploadTrigger.disabled = false;
    
    // Stop tracks
    if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
    }
    // Disconnect nodes
    if (scriptNode) {
        scriptNode.disconnect();
    }
    if (audioContext) {
        audioContext.close();
    }
    
    // Flatten buffer samples
    let totalLength = 0;
    for (let i = 0; i < audioBuffer.length; i++) {
        totalLength += audioBuffer[i].length;
    }
    
    const samples = new Float32Array(totalLength);
    let offset = 0;
    for (let i = 0; i < audioBuffer.length; i++) {
        samples.set(audioBuffer[i], offset);
        offset += audioBuffer[i].length;
    }
    
    recordedAudioBlob = encodeWAV(samples, sampleRate);
    log(`Recording complete. Created WAV blob: ${(recordedAudioBlob.size / 1024).toFixed(1)} KB`, "success");
    
    uploadFileName.textContent = `Mic_Record_${Date.now()}.wav (${(recordedAudioBlob.size / 1024).toFixed(1)} KB)`;
    btnStartPipeline.disabled = false;
    
    pipelineStatusBanner.className = "pipeline-status-banner";
    pipelineStatusBanner.querySelector('.banner-text').textContent = "Audio captured. Click 'Start Pipeline Extraction' to process.";
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    recordedAudioBlob = file;
    simulatedText = null;
    currentScenario = null;
    
    log(`Audio file loaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, "info");
    uploadFileName.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    btnStartPipeline.disabled = false;
    
    resetStepper();
    updateStepper(0); // Mark step 1 (Audio) complete
    
    pipelineStatusBanner.className = "pipeline-status-banner";
    pipelineStatusBanner.querySelector('.banner-text').textContent = "File uploaded. Ready to extract.";
}

// WAV Encoder Helper (PCM 16-Bit Mono)
function encodeWAV(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    
    const writeUTF = (v, offset, str) => {
        for (let i = 0; i < str.length; i++) {
            v.setUint8(offset + i, str.charCodeAt(i));
        }
    };
    
    writeUTF(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeUTF(view, 8, 'WAVE');
    writeUTF(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM Format (1)
    view.setUint16(22, 1, true); // Channels (Mono)
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    writeUTF(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);
    
    // Float to 16-bit signed PCM
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    
    return new Blob([view], { type: 'audio/wav' });
}

// Canvas animation loops
function startVisualizerAnim() {
    if (animationId) cancelAnimationFrame(animationId);
    
    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    
    function draw() {
        animationId = requestAnimationFrame(draw);
        
        const width = canvas.width;
        const height = canvas.height;
        
        // Background
        canvasCtx.fillStyle = '#04060b';
        canvasCtx.fillRect(0, 0, width, height);
        
        if (isRecording && analyser) {
            // Draw Real-time Mic Wave
            analyser.getByteTimeDomainData(dataArray);
            
            canvasCtx.lineWidth = 3;
            canvasCtx.strokeStyle = '#00e5ff';
            canvasCtx.shadowBlur = 12;
            canvasCtx.shadowColor = '#00e5ff';
            canvasCtx.beginPath();
            
            const sliceWidth = width / analyser.frequencyBinCount;
            let x = 0;
            
            for (let i = 0; i < analyser.frequencyBinCount; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * (height / 2);
                
                if (i === 0) {
                    canvasCtx.moveTo(x, y);
                } else {
                    canvasCtx.lineTo(x, y);
                }
                x += sliceWidth;
            }
            canvasCtx.lineTo(width, height / 2);
            canvasCtx.stroke();
            canvasCtx.shadowBlur = 0;
        } else if (window.speechSynthesis && window.speechSynthesis.speaking) {
            // Simulated Active Speech Wave
            canvasCtx.lineWidth = 3;
            canvasCtx.strokeStyle = '#9c27b0';
            canvasCtx.shadowBlur = 12;
            canvasCtx.shadowColor = '#9c27b0';
            canvasCtx.beginPath();
            
            const time = Date.now() * 0.012;
            canvasCtx.moveTo(0, height / 2);
            
            for (let x = 0; x < width; x += 6) {
                const wave1 = Math.sin(x * 0.04 + time) * 25;
                const wave2 = Math.cos(x * 0.015 - time * 0.4) * 15;
                const envelope = Math.sin(x / width * Math.PI); // Fade sides
                
                // speaking activity variation
                const speakAmp = Math.sin(time * 0.6) * 0.4 + 0.6;
                const noise = (Math.random() - 0.5) * 4;
                
                const y = (height / 2) + (wave1 + wave2 + noise) * envelope * speakAmp;
                canvasCtx.lineTo(x, y);
            }
            canvasCtx.lineTo(width, height / 2);
            canvasCtx.stroke();
            canvasCtx.shadowBlur = 0;
        } else {
            // Idle Pulse Wave
            canvasCtx.lineWidth = 2;
            canvasCtx.strokeStyle = '#2d3b55';
            canvasCtx.beginPath();
            canvasCtx.moveTo(0, height / 2);
            
            const time = Date.now() * 0.002;
            for (let x = 0; x < width; x += 10) {
                const y = (height / 2) + Math.sin(x * 0.015 + time) * 3;
                canvasCtx.lineTo(x, y);
            }
            canvasCtx.lineTo(width, height / 2);
            canvasCtx.stroke();
        }
    }
    
    draw();
}

/* ==========================================================================
   Speech Simulator (Mock Call Scenarios)
   ========================================================================== */

function triggerScenario(key) {
    if (isRecording || (window.speechSynthesis && window.speechSynthesis.speaking)) {
        window.speechSynthesis.cancel();
    }
    
    const scenario = scenarios[key];
    if (!scenario) return;
    
    currentScenario = scenario;
    simulatedText = scenario.transcript;
    recordedAudioBlob = null; // Override physical audio
    uploadFileName.textContent = '';
    
    log(`Triggering scenario: ${key.toUpperCase()}. Generating synthetic voice...`, "info");
    
    resetStepper();
    updateStepper(0);
    
    // Disable inputs during playback
    disableControls(true);
    
    pipelineStatusBanner.className = "pipeline-status-banner processing";
    pipelineStatusBanner.querySelector('.banner-text').textContent = "Playing simulated call audio text-to-speech...";
    
    const utterance = new SpeechSynthesisUtterance(scenario.speech);
    
    // Find custom english voice if available
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.includes('EN') || v.lang.includes('en'));
    if (englishVoice) utterance.voice = englishVoice;
    
    utterance.rate = 1.0;
    utterance.pitch = 0.95;
    
    utterance.onend = () => {
        log("Simulated customer voice call playback completed.", "success");
        pipelineStatusBanner.className = "pipeline-status-banner";
        pipelineStatusBanner.querySelector('.banner-text').textContent = "Call recorded. Ready to extract ticket details.";
        btnStartPipeline.disabled = false;
        disableControls(false);
    };
    
    utterance.onerror = (e) => {
        log("Synthesizer playback error: " + e.error, "danger");
        disableControls(false);
    };
    
    window.speechSynthesis.speak(utterance);
}

function disableControls(state) {
    btnRecord.disabled = state;
    btnUploadTrigger.disabled = state;
    document.querySelectorAll('.btn-scenario').forEach(btn => btn.disabled = state);
}

/* ==========================================================================
   Pipeline Engine (Simulation vs API Mode)
   ========================================================================== */

function resetStepper() {
    steps.forEach(s => s.className = 'step');
    stepLines.forEach(l => l.className = 'step-line');
}

function updateStepper(stepIndex) {
    steps.forEach((step, idx) => {
        step.classList.remove('active', 'completed');
        if (idx < stepIndex) {
            step.classList.add('completed');
        } else if (idx === stepIndex) {
            step.classList.add('active');
        }
    });
    
    stepLines.forEach((line, idx) => {
        line.classList.remove('active', 'completed');
        if (idx < stepIndex) {
            line.classList.add('completed');
        } else if (idx === stepIndex) {
            line.classList.add('active');
        }
    });
}

async function runPipeline() {
    btnStartPipeline.disabled = true;
    disableControls(true);
    
    // Check if key is available
    const apiKey = localStorage.getItem('openai_api_key');
    const isApiMode = !!apiKey;
    
    log(`Starting pipeline execution. Mode: ${isApiMode ? 'OPENAI API' : 'OFFLINE SIMULATOR'}`, "info");
    
    try {
        let transcript = "";
        let extractedData = null;
        
        // ---------------- STT STAGE ----------------
        updateStepper(1); // STT active
        pipelineStatusBanner.className = "pipeline-status-banner processing";
        pipelineStatusBanner.querySelector('.banner-text').textContent = "Speech-to-Text: Transcribing support call audio...";
        
        const latency = parseInt(delayInput.value) || 1500;
        
        if (isApiMode) {
            if (recordedAudioBlob) {
                log("[STT] Uploading WAV blob to OpenAI Whisper API...", "info");
                transcript = await callWhisperAPI(recordedAudioBlob, apiKey);
                log(`[STT] Transcription resolved: "${transcript}"`, "success");
            } else if (simulatedText) {
                // If it's a simulated call but user runs API mode, we use the simulated script
                log("[STT] Simulated scenario script provided, skipping raw upload.", "muted");
                transcript = simulatedText;
                log(`[STT] Script content loaded: "${transcript}"`, "info");
            } else {
                throw new Error("No audio payload detected.");
            }
        } else {
            // Simulator STT delay
            await new Promise(r => setTimeout(r, latency));
            if (currentScenario) {
                transcript = currentScenario.transcript;
            } else {
                // Mock default recording transcription
                transcript = "Hi, my name is John Doe. I'm calling because I need help resetting my password. I keep getting a credential mismatch error on the dashboard. This is a medium priority issue, please assist.";
            }
            log(`[STT] (Simulation) Generated transcript: "${transcript}"`, "success");
        }
        
        // ---------------- LLM STAGE ----------------
        updateStepper(2); // LLM active
        pipelineStatusBanner.querySelector('.banner-text').textContent = "LLM Parsing: Extracting ticket fields with AI...";
        
        if (isApiMode) {
            log("[LLM] Sending transcript payload to GPT-4o Chat Completions...", "info");
            extractedData = await callGPTAPI(transcript, apiKey);
            log("[LLM] Structured extraction completed.", "success");
        } else {
            // Simulator LLM delay
            await new Promise(r => setTimeout(r, latency));
            if (currentScenario) {
                extractedData = currentScenario.extracted;
            } else {
                // Mock rule-based extraction on template text
                extractedData = {
                    title: "Portal Password Reset Issue",
                    description: "User is experiencing login credential errors on the dashboard and requests password reset assistance.",
                    category: "Security",
                    priority: "Medium",
                    caller_name: "John Doe"
                };
            }
            log(`[LLM] (Simulation) Extracted details: ${JSON.stringify(extractedData)}`, "success");
        }
        
        // ---------------- DATABASE STAGE ----------------
        updateStepper(3); // DB active
        pipelineStatusBanner.querySelector('.banner-text').textContent = "SQLite Commit: Persisting ticket metadata...";
        
        // Sim database delay
        await new Promise(r => setTimeout(r, isApiMode ? 200 : latency));
        
        if (!db) throw new Error("SQLite engine not initialized.");
        
        // Generate Unique Ticket Number
        const maxIdRes = db.exec("SELECT MAX(id) FROM tickets");
        const nextId = (maxIdRes.length > 0 && maxIdRes[0].values[0][0] ? maxIdRes[0].values[0][0] : 0) + 1;
        const ticketNum = `TIC-${1000 + nextId}`;
        
        // Insert DB
        db.run(`
            INSERT INTO tickets (ticket_num, title, description, category, priority, caller_name, transcription)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            ticketNum,
            extractedData.title,
            extractedData.description,
            extractedData.category,
            extractedData.priority,
            extractedData.caller_name || null,
            transcript
        ]);
        
        saveDatabase();
        log(`[DB] Successfully created ticket entry: ${ticketNum} (Row ID: ${nextId})`, "success");
        
        // Update Result Panel
        resultPlaceholder.style.display = 'none';
        resultDetails.style.display = 'flex';
        resTicketNum.textContent = ticketNum;
        resTitle.textContent = extractedData.title;
        resCategory.textContent = extractedData.category;
        resCategory.className = `detail-val badge badge-${extractedData.category.toLowerCase()}`;
        resPriority.textContent = extractedData.priority;
        resPriority.className = `detail-val badge badge-${extractedData.priority.toLowerCase()}`;
        resCallerName.textContent = extractedData.caller_name || 'Anonymous';
        resTranscription.textContent = `"${transcript}"`;
        
        // ---------------- TTS STAGE ----------------
        updateStepper(4); // TTS active
        pipelineStatusBanner.querySelector('.banner-text').textContent = "Text-to-Speech: Speaking database ticket confirmation...";
        
        // Speak ticket back to user
        const confirmationMsg = `Ticket ${ticketNum.replace('-', ' ')} created successfully. Priority is ${extractedData.priority}. Category is ${extractedData.category}.`;
        log(`[TTS] Speaking confirmation: "${confirmationMsg}"`, "info");
        
        await speakConfirmation(confirmationMsg);
        
        updateStepper(5); // Complete
        pipelineStatusBanner.className = "pipeline-status-banner";
        pipelineStatusBanner.querySelector('.banner-text').textContent = `Success! Created ticket ${ticketNum}.`;
        
        log(`Pipeline extraction completed successfully. Saved to database.`, "success");
        
    } catch (err) {
        log("Pipeline processing failed: " + err.message, "danger");
        pipelineStatusBanner.className = "pipeline-status-banner";
        pipelineStatusBanner.querySelector('.banner-text').textContent = "Error: " + err.message;
        resetStepper();
    } finally {
        disableControls(false);
    }
}

// SpeechSynthesis wrapper
function speakConfirmation(text) {
    return new Promise((resolve) => {
        if (!window.speechSynthesis) {
            resolve();
            return;
        }
        
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Select standard system voice
        const voices = window.speechSynthesis.getVoices();
        const systemVoice = voices.find(v => v.lang.includes('EN') || v.lang.includes('en'));
        if (systemVoice) utterance.voice = systemVoice;
        
        utterance.rate = 1.0;
        
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        
        window.speechSynthesis.speak(utterance);
    });
}

/* ==========================================================================
   OpenAI API Client Integrations
   ========================================================================== */

async function callWhisperAPI(audioBlob, apiKey) {
    const formData = new FormData();
    // Wrap raw WAV blob in a file
    const audioFile = new File([audioBlob], "recording.wav", { type: "audio/wav" });
    
    formData.append("file", audioFile);
    formData.append("model", "whisper-1");
    
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`
        },
        body: formData
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Whisper API Error (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    return result.text;
}

async function callGPTAPI(transcript, apiKey) {
    const systemPrompt = `You are a support ticket agent. Analyze the phone call transcript and extract structured details in JSON format. 
The JSON must strictly conform to this schema:
{
    "title": "A short summary of the issue",
    "description": "A detailed description of the customer's problem",
    "category": "Must be one of: Technical, Billing, Security, General",
    "priority": "Must be one of: Low, Medium, High, Urgent",
    "caller_name": "The name of the caller (null if not mentioned)"
}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "gpt-4o",
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Transcript:\n"${transcript}"` }
            ]
        })
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GPT API Error (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    const contentText = result.choices[0].message.content;
    
    try {
        const parsed = JSON.parse(contentText);
        // Fallback validation
        if (!parsed.title || !parsed.description || !parsed.category || !parsed.priority) {
            throw new Error("Missing required JSON properties from extraction.");
        }
        return parsed;
    } catch (e) {
        throw new Error("Failed to parse GPT response JSON: " + e.message + ". Content: " + contentText);
    }
}

/* ==========================================================================
   SQLite Database Console Runner
   ========================================================================== */

function executeSqlQuery() {
    const query = sqlQueryText.value.trim();
    if (!query) return;
    
    log("Running user query: " + query, "info");
    queryOutput.innerHTML = '';
    
    try {
        if (!db) throw new Error("SQLite engine not initialized.");
        
        const res = db.exec(query);
        saveDatabase(); // Save automatically in case of mutations
        updateDbSizeText();
        refreshDashboard();
        
        if (res.length > 0) {
            queryOutput.classList.add('has-data');
            const table = document.createElement('table');
            table.className = 'sql-result-table';
            
            // Header columns
            const thead = document.createElement('thead');
            const trHead = document.createElement('tr');
            res[0].columns.forEach(col => {
                const th = document.createElement('th');
                th.textContent = col;
                trHead.appendChild(th);
            });
            thead.appendChild(trHead);
            table.appendChild(thead);
            
            // Rows values
            const tbody = document.createElement('tbody');
            res[0].values.forEach(row => {
                const tr = document.createElement('tr');
                row.forEach(val => {
                    const td = document.createElement('td');
                    td.textContent = val !== null ? val : 'NULL';
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            queryOutput.appendChild(table);
            
            log(`Query executed. ${res[0].values.length} rows returned.`, "success");
        } else {
            queryOutput.classList.remove('has-data');
            queryOutput.innerHTML = '<span class="placeholder-text">Query executed. No records returned.</span>';
            log("Query executed. No records returned.", "success");
        }
    } catch (err) {
        queryOutput.classList.remove('has-data');
        queryOutput.innerHTML = `<span class="text-danger font-monospace">${escapeHtml(err.message)}</span>`;
        log("SQL Query Error: " + err.message, "danger");
    }
}

/* ==========================================================================
   Settings Management
   ========================================================================== */

function initSettings() {
    const savedKey = localStorage.getItem('openai_api_key');
    if (savedKey) {
        apiKeyInput.value = savedKey;
        setSystemStatusMode(true);
    } else {
        setSystemStatusMode(false);
    }
}

function setSystemStatusMode(isApi) {
    const dot = systemStatus.querySelector('.status-dot');
    const label = systemStatus.querySelector('.status-label');
    
    if (isApi) {
        dot.className = "status-dot active pulsing";
        label.textContent = "API Mode Active";
    } else {
        dot.className = "status-dot pulsing";
        label.textContent = "Simulation Mode";
    }
}

function saveSettings() {
    const key = apiKeyInput.value.trim();
    if (key && !key.startsWith('sk-')) {
        log("Warning: Key format doesn't look like a typical OpenAI key (should start with 'sk-')", "warning");
    }
    
    if (key) {
        localStorage.setItem('openai_api_key', key);
        setSystemStatusMode(true);
        log("OpenAI API Key saved successfully. System switched to live extraction mode.", "success");
    } else {
        localStorage.removeItem('openai_api_key');
        setSystemStatusMode(false);
        log("Saved key removed. System switched to Simulation Mode.", "info");
    }
}

function clearSettings() {
    apiKeyInput.value = '';
    localStorage.removeItem('openai_api_key');
    setSystemStatusMode(false);
    log("Settings cleared. Switched to Simulation Mode.", "info");
}

function toggleApiKeyVisibility() {
    const type = apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
    apiKeyInput.setAttribute('type', type);
    
    const icon = document.getElementById('eyeIcon');
    if (type === 'password') {
        icon.className = "fa-solid fa-eye";
    } else {
        icon.className = "fa-solid fa-eye-slash";
    }
}
