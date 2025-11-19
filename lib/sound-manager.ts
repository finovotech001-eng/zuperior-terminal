"use client"

/**
 * Sound Manager for playing notification sounds
 * Uses Web Audio API with fallback to HTML5 Audio
 */

type SoundType = 'price-alert' | 'closing'

class SoundManager {
  private audioContext: AudioContext | null = null
  private sounds: Map<SoundType, AudioBuffer | HTMLAudioElement> = new Map()
  private enabled: boolean = true

  constructor() {
    // Initialize Web Audio API if available
    if (typeof window !== 'undefined') {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        if (AudioContextClass) {
          this.audioContext = new AudioContextClass()
        }
      } catch (e) {
        console.warn('[SoundManager] Web Audio API not available, using HTML5 Audio fallback')
      }
    }
  }

  /**
   * Enable or disable sound playback
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  /**
   * Play a sound using Web Audio API
   */
  private async playWithWebAudio(type: SoundType, buffer: AudioBuffer) {
    if (!this.audioContext || !this.enabled) return

    try {
      // Resume context if suspended (required by some browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      const source = this.audioContext.createBufferSource()
      source.buffer = buffer
      source.connect(this.audioContext.destination)
      source.start(0)
    } catch (e) {
      console.warn('[SoundManager] Failed to play sound with Web Audio API:', e)
    }
  }

  /**
   * Play a sound using HTML5 Audio
   */
  private playWithHTML5Audio(audio: HTMLAudioElement) {
    if (!this.enabled) return

    try {
      audio.currentTime = 0
      audio.play().catch(e => {
        console.warn('[SoundManager] Failed to play HTML5 audio:', e)
      })
    } catch (e) {
      console.warn('[SoundManager] Error playing HTML5 audio:', e)
    }
  }

  /**
   * Generate a simple beep tone using Web Audio API
   */
  private generateBeep(frequency: number, duration: number, type: 'price-alert' | 'closing'): AudioBuffer | null {
    if (!this.audioContext) return null

    try {
      const sampleRate = this.audioContext.sampleRate
      const numSamples = Math.floor(sampleRate * duration)
      const buffer = this.audioContext.createBuffer(1, numSamples, sampleRate)
      const data = buffer.getChannelData(0)

      // Generate tone with envelope for smooth start/end
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate
        // Apply envelope (fade in/out)
        const envelope = Math.min(1, Math.min(t * 20, (duration - t) * 20))
        // For closing sound, use a lower frequency and longer duration
        const freq = type === 'closing' ? frequency * 0.7 : frequency
        data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.3
      }

      return buffer
    } catch (e) {
      console.warn('[SoundManager] Failed to generate beep:', e)
      return null
    }
  }

  /**
   * Initialize sounds
   */
  async initialize() {
    if (this.audioContext) {
      // Generate beep sounds using Web Audio API
      const priceAlertBuffer = this.generateBeep(800, 0.2, 'price-alert')
      const closingBuffer = this.generateBeep(600, 0.3, 'closing')

      if (priceAlertBuffer) {
        this.sounds.set('price-alert', priceAlertBuffer)
      }
      if (closingBuffer) {
        this.sounds.set('closing', closingBuffer)
      }
    }

    // Fallback: Create HTML5 Audio elements
    if (this.sounds.size === 0) {
      // Create simple audio elements (we'll use data URIs or generate tones)
      const priceAlertAudio = new Audio()
      priceAlertAudio.src = this.createDataURITone(800, 0.2)
      this.sounds.set('price-alert', priceAlertAudio)

      const closingAudio = new Audio()
      closingAudio.src = this.createDataURITone(600, 0.3)
      this.sounds.set('closing', closingAudio)
    }
  }

  /**
   * Create a data URI for a simple tone (fallback)
   */
  private createDataURITone(frequency: number, duration: number): string {
    // This is a simplified approach - in production, you might want to use actual audio files
    // For now, we'll use a silent audio data URI as placeholder
    // In a real implementation, you'd load actual sound files
    return 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OSfTQ8MUqfk8LZjHAY4kdfyzHksBSR3x/DdkEAKFF606euoVRQKRp/g8r5sIQUrgc7y2Yk2CBtpvfDkn00PDFKn5PC2YxwGOJHX8sx5LAUkd8fw3ZBAC'
  }

  /**
   * Play a sound
   */
  async play(type: SoundType) {
    if (!this.enabled) return

    const sound = this.sounds.get(type)
    if (!sound) {
      // Initialize if not already done
      await this.initialize()
      const initializedSound = this.sounds.get(type)
      if (!initializedSound) return
      return this.play(type)
    }

    if (sound instanceof AudioBuffer) {
      // Web Audio API
      await this.playWithWebAudio(type, sound)
    } else if (sound instanceof HTMLAudioElement) {
      // HTML5 Audio
      this.playWithHTML5Audio(sound)
    }
  }

  /**
   * Play price alert sound
   */
  playPriceAlert() {
    return this.play('price-alert')
  }

  /**
   * Play closing sound (TP/SL/SO)
   */
  playClosing() {
    return this.play('closing')
  }
}

// Export singleton instance
export const soundManager = new SoundManager()

// Initialize on first import (client-side only)
if (typeof window !== 'undefined') {
  soundManager.initialize().catch(e => {
    console.warn('[SoundManager] Initialization error:', e)
  })
}





