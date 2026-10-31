/**
 * Web Audio Physics Sonification Engine
 * Synthesizes dynamic auditory feedback from kinematic velocity and energy dissipation.
 */

class PhysicsAudioEngine {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private isEnabled: boolean = false;
  private lastThetaSign: number = 0;

  constructor() {
    // Lazy initialized on first user interaction
  }

  private initContext() {
    if (this.ctx || typeof window === 'undefined') return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Main Oscillator
      this.osc = this.ctx.createOscillator();
      this.osc.type = 'triangle'; // Warm, pleasant harmonic profile
      this.osc.frequency.setValueAtTime(220, this.ctx.currentTime);

      // Low-pass filter to soften timbre
      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(800, this.ctx.currentTime);

      // Gain Envelope
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);

      this.osc.connect(this.filterNode);
      this.filterNode.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);

      this.osc.start();
    } catch (e) {
      console.warn('Web Audio API not supported in this environment.', e);
    }
  }

  public toggle(): boolean {
    this.isEnabled = !this.isEnabled;
    if (this.isEnabled) {
      this.initContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    } else {
      if (this.gainNode && this.ctx) {
        this.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }
    }
    return this.isEnabled;
  }

  public setEnabled(enabled: boolean) {
    if (this.isEnabled === enabled) return;
    this.toggle();
  }

  public getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Updates sonification parameters based on current twin simulation frame
   * @param omegaRad instantaneous angular velocity (rad/s)
   * @param thetaRad instantaneous displacement angle (rad)
   * @param energyRatio relative total mechanical energy (0.0 to 1.0)
   */
  public updatePhysicsAudio(
    omegaRad: number,
    thetaRad: number,
    energyRatio: number = 1.0
  ) {
    if (!this.isEnabled || !this.ctx || !this.osc || !this.gainNode) return;

    const now = this.ctx.currentTime;
    const absOmega = Math.abs(omegaRad);

    // Dynamic pitch: base 160 Hz + up to 520 Hz based on angular velocity
    const targetFreq = Math.min(680, 160 + absOmega * 85);
    this.osc.frequency.setTargetAtTime(targetFreq, now, 0.03);

    // Volume modulated by total mechanical energy & velocity
    const targetGain = Math.min(0.08, 0.015 + (absOmega / 6) * 0.05) * Math.max(0.1, Math.min(1.0, energyRatio));
    this.gainNode.gain.setTargetAtTime(targetGain, now, 0.04);

    // Zero-crossing acoustic tick (bottom dead center click)
    const currentSign = Math.sign(thetaRad);
    if (this.lastThetaSign !== 0 && currentSign !== this.lastThetaSign && absOmega > 0.3) {
      this.playZeroCrossingClick(now);
    }
    this.lastThetaSign = currentSign;
  }

  private playZeroCrossingClick(time: number) {
    if (!this.ctx) return;
    try {
      const clickOsc = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();

      clickOsc.type = 'sine';
      clickOsc.frequency.setValueAtTime(880, time);
      clickOsc.frequency.exponentialRampToValueAtTime(220, time + 0.02);

      clickGain.gain.setValueAtTime(0.04, time);
      clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);

      clickOsc.connect(clickGain);
      clickGain.connect(this.ctx.destination);

      clickOsc.start(time);
      clickOsc.stop(time + 0.025);
    } catch {
      // Ignore click interruption
    }
  }

  public stop() {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }
}

export const physicsAudio = new PhysicsAudioEngine();
