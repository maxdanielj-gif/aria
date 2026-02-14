class AudioService {
    private audioContext: AudioContext | null = null;
    private isInitialized = false;

    private initialize = () => {
        if (!this.isInitialized && typeof window !== 'undefined') {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContext) {
                this.audioContext = new AudioContext();
            }
            // A user interaction is required to start the audio context.
            // We assume this will happen before a sound is played.
            // If not, the first sound might be silent.
            this.isInitialized = true;
        }
    };
    
    private resumeContext = () => {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    private playSound(type: 'sine' | 'square' | 'sawtooth' | 'triangle', frequency: number, duration: number, volume: number) {
        this.initialize();
        this.resumeContext();

        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + duration);

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    public playMessageSentSound() {
        this.playSound('sine', 600, 0.1, 0.2);
    }

    public playMessageReceivedSound() {
        this.playSound('triangle', 800, 0.15, 0.25);
    }
}

export const audioService = new AudioService();