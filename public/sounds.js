// Sound system for SpeedWurdz game
// Uses Web Audio API to generate sounds programmatically

class GameSounds {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
        this.volume = 0.3; // Default volume (30%)
        
        this.initAudioContext();
    }
    
    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
            this.enabled = false;
        }
    }
    
    // Resume audio context if suspended (required by browser policies)
    async resumeContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }
    
    // Generate a simple beep sound
    playBeep(frequency = 440, duration = 0.1, volume = null) {
        if (!this.enabled || !this.audioContext) return;
        
        this.resumeContext();
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        const actualVolume = volume !== null ? volume : this.volume;
        gainNode.gain.setValueAtTime(actualVolume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }
    
    // Tile drag start sound - quiet, soft
    playTileDragStart() {
        this.playBeep(600, 0.05, 0.15); // Higher pitch, very short, quiet
    }
    
    // Tile drop sound - slightly louder click
    playTileDrop() {
        if (!this.enabled || !this.audioContext) return;
        
        this.resumeContext();
        
        // Create a click sound with noise burst
        const bufferSize = this.audioContext.sampleRate * 0.05; // 50ms
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        // Generate click sound (short burst of filtered noise)
        for (let i = 0; i < bufferSize; i++) {
            const decay = Math.pow(1 - (i / bufferSize), 2);
            data[i] = (Math.random() * 2 - 1) * decay * 0.3;
        }
        
        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        
        source.buffer = buffer;
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        gainNode.gain.setValueAtTime(this.volume * 0.8, this.audioContext.currentTime);
        
        source.start();
    }
    
    // Whoosh sound for returning tiles to hand
    playWhoosh() {
        if (!this.enabled || !this.audioContext) return;
        
        this.resumeContext();
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Whoosh: sweeping frequency from high to low
        oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.3);
        
        oscillator.type = 'sawtooth';
        
        // Volume envelope for whoosh effect
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.volume * 0.5, this.audioContext.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.3);
    }
    
    // Happy fanfare for winner
    playWinFanfare() {
        if (!this.enabled || !this.audioContext) return;
        
        this.resumeContext();
        
        // Play a series of ascending notes
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        const noteDuration = 0.25;
        
        notes.forEach((frequency, index) => {
            setTimeout(() => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.frequency.value = frequency;
                oscillator.type = 'triangle';
                
                gainNode.gain.setValueAtTime(this.volume * 0.7, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + noteDuration);
                
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + noteDuration);
            }, index * 150);
        });
    }
    
    // Sad trombone for loser
    playLoseTrombone() {
        if (!this.enabled || !this.audioContext) return;
        
        this.resumeContext();
        
        // Play descending "sad trombone" notes
        const notes = [440, 415.30, 392, 369.99, 349.23]; // A4 to F4 with some flat notes
        const noteDuration = 0.4;
        
        notes.forEach((frequency, index) => {
            setTimeout(() => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.frequency.value = frequency;
                oscillator.type = 'sawtooth'; // More "trombone-like" than sine
                
                gainNode.gain.setValueAtTime(this.volume * 0.6, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + noteDuration);
                
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + noteDuration);
            }, index * 250);
        });
    }
    
    // Enable/disable sounds
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    
    // Player joined table sound - welcoming chime
    playPlayerJoined() {
        if (!this.enabled || !this.audioContext) return;
        
        this.resumeContext();
        
        // Play two pleasant notes in sequence (like a doorbell)
        const notes = [523.25, 659.25]; // C5, E5
        const noteDuration = 0.2;
        
        notes.forEach((frequency, index) => {
            setTimeout(() => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.frequency.value = frequency;
                oscillator.type = 'sine';
                
                gainNode.gain.setValueAtTime(this.volume * 0.4, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + noteDuration);
                
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + noteDuration);
            }, index * 100);
        });
    }
    
    // Countdown tick sound - subtle beep for each second
    playCountdownTick() {
        if (!this.enabled || !this.audioContext) return;
        
        this.resumeContext();
        
        // Short, gentle beep
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = 800; // High pitched but not harsh
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(this.volume * 0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.08);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.08);
    }
    
    // Final countdown sound - more urgent for last few seconds
    playCountdownUrgent() {
        if (!this.enabled || !this.audioContext) return;
        
        this.resumeContext();
        
        // Double beep for urgency
        for (let i = 0; i < 2; i++) {
            setTimeout(() => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.frequency.value = 1000; // Higher pitch for urgency
                oscillator.type = 'triangle';
                
                gainNode.gain.setValueAtTime(this.volume * 0.5, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
                
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.1);
            }, i * 60);
        }
    }
    
    // Game start sound - triumphant start signal
    playGameStart() {
        if (!this.enabled || !this.audioContext) return;
        
        this.resumeContext();
        
        // Rising arpeggio to signal game start
        const notes = [261.63, 329.63, 392.00]; // C4, E4, G4
        const noteDuration = 0.15;
        
        notes.forEach((frequency, index) => {
            setTimeout(() => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.frequency.value = frequency;
                oscillator.type = 'triangle';
                
                gainNode.gain.setValueAtTime(this.volume * 0.6, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + noteDuration);
                
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + noteDuration);
            }, index * 80);
        });
    }
    
    // Set volume (0.0 to 1.0)
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }
}

// Create global sound manager
const gameSounds = new GameSounds();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameSounds;
}