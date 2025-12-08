// Celebration sounds utility using Web Audio API
// Generates celebration sounds programmatically without external audio files

class CelebrationSoundManager {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  private async resumeContext() {
    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    return ctx;
  }

  // Short success chime - for completing activities
  async playSuccess() {
    if (!this.enabled) return;
    try {
      const ctx = await this.resumeContext();
      const now = ctx.currentTime;

      // Create pleasant ascending notes
      const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5
      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.value = freq;
        osc.type = 'sine';
        
        const startTime = now + i * 0.08;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.25);
        
        osc.start(startTime);
        osc.stop(startTime + 0.3);
      });
    } catch (e) {
      console.warn('Could not play success sound:', e);
    }
  }

  // Achievement/goal met fanfare - for hitting hourly goals
  async playAchievement() {
    if (!this.enabled) return;
    try {
      const ctx = await this.resumeContext();
      const now = ctx.currentTime;

      // Triumphant fanfare notes
      const notes = [
        { freq: 523.25, start: 0, duration: 0.15 },     // C5
        { freq: 659.25, start: 0.12, duration: 0.15 },  // E5
        { freq: 783.99, start: 0.24, duration: 0.15 },  // G5
        { freq: 1046.50, start: 0.36, duration: 0.4 },  // C6 (held)
      ];

      notes.forEach(({ freq, start, duration }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.value = freq;
        osc.type = 'triangle';
        
        const startTime = now + start;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.03);
        gain.gain.setValueAtTime(0.2, startTime + duration - 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        osc.start(startTime);
        osc.stop(startTime + duration + 0.1);
      });
    } catch (e) {
      console.warn('Could not play achievement sound:', e);
    }
  }

  // Level up celebration - for monthly challenge level ups
  async playLevelUp() {
    if (!this.enabled) return;
    try {
      const ctx = await this.resumeContext();
      const now = ctx.currentTime;

      // Epic ascending arpeggio with shimmer
      const notes = [
        { freq: 392.00, start: 0 },      // G4
        { freq: 493.88, start: 0.08 },   // B4
        { freq: 587.33, start: 0.16 },   // D5
        { freq: 783.99, start: 0.24 },   // G5
        { freq: 987.77, start: 0.32 },   // B5
        { freq: 1174.66, start: 0.40 },  // D6
        { freq: 1567.98, start: 0.48 },  // G6
      ];

      notes.forEach(({ freq, start }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.value = freq;
        osc.type = 'sine';
        
        const startTime = now + start;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);
        
        osc.start(startTime);
        osc.stop(startTime + 0.6);
      });

      // Add shimmer effect
      for (let i = 0; i < 5; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.value = 2000 + Math.random() * 2000;
        osc.type = 'sine';
        
        const startTime = now + 0.5 + i * 0.06;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.05, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);
        
        osc.start(startTime);
        osc.stop(startTime + 0.2);
      }
    } catch (e) {
      console.warn('Could not play level up sound:', e);
    }
  }

  // Daily goal complete - triumphant
  async playDailyGoalComplete() {
    if (!this.enabled) return;
    try {
      const ctx = await this.resumeContext();
      const now = ctx.currentTime;

      // Victory fanfare
      const melody = [
        { freq: 523.25, start: 0, duration: 0.12 },      // C5
        { freq: 523.25, start: 0.12, duration: 0.12 },   // C5
        { freq: 523.25, start: 0.24, duration: 0.12 },   // C5
        { freq: 659.25, start: 0.36, duration: 0.36 },   // E5
        { freq: 587.33, start: 0.72, duration: 0.12 },   // D5
        { freq: 659.25, start: 0.84, duration: 0.12 },   // E5
        { freq: 783.99, start: 0.96, duration: 0.5 },    // G5
      ];

      melody.forEach(({ freq, start, duration }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.value = freq;
        osc.type = 'triangle';
        
        const startTime = now + start;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
        gain.gain.setValueAtTime(0.2, startTime + duration - 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        osc.start(startTime);
        osc.stop(startTime + duration + 0.1);
      });

      // Add bass note
      const bass = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bass.connect(bassGain);
      bassGain.connect(ctx.destination);
      bass.frequency.value = 130.81; // C3
      bass.type = 'sine';
      bassGain.gain.setValueAtTime(0, now);
      bassGain.gain.linearRampToValueAtTime(0.15, now + 0.05);
      bassGain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
      bass.start(now);
      bass.stop(now + 1.6);
    } catch (e) {
      console.warn('Could not play daily goal sound:', e);
    }
  }

  // Quick notification blip
  async playNotification() {
    if (!this.enabled) return;
    try {
      const ctx = await this.resumeContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.linearRampToValueAtTime(1200, now + 0.1);
      osc.type = 'sine';
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      
      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {
      console.warn('Could not play notification sound:', e);
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

// Singleton instance
export const celebrationSounds = new CelebrationSoundManager();
