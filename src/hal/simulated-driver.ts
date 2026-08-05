import { EventEmitter } from 'node:events';
import type { IRadioDriver, RadioMode, RadioStatus, TelemetrySnapshot } from './driver.js';

/**
 * Simulated (fake) radio driver for development and testing.
 *
 * Implements {@link IRadioDriver} with plausible synthetic data —
 * no hardware required. Frequencies, SWR, temperature, and voltage
 * are all simulated with small random variations to mimic real
 * telemetry.
 *
 * Telemetry is emitted at 1 Hz via `setInterval` while connected.
 *
 * ## SWR Protection
 *
 * The simulated driver replicates the same SWR protection behavior
 * as {@link SBitxCLIDriver}: if SWR exceeds 3.0 while PTT is active,
 * the driver emits `"swr-protection"` and cuts TX immediately via
 * {@link pttOff}.
 *
 * @example
 * ```typescript
 * const driver = new SimulatedRadioDriver({ frequency: 7100, mode: 'LSB' });
 * driver.on('telemetry', (snapshot) => {
 *   console.log(`Freq: ${snapshot.frequency} kHz, SWR: ${snapshot.swr}`);
 * });
 * await driver.connect();
 * ```
 */
export class SimulatedRadioDriver extends EventEmitter implements IRadioDriver {
  private connected = false;
  private telemetryInterval: ReturnType<typeof setInterval> | null = null;
  private state: RadioStatus;

  /**
   * @param initialState - Override default radio state for testing scenarios.
   *                       Defaults to typical 40m band USB settings.
   */
  constructor(initialState?: Partial<RadioStatus>) {
    super();
    this.state = {
      connected: false,
      frequency: 7100,
      mode: 'USB',
      power: 10,
      swr: 1.2,
      temperature: 35,
      txActive: false,
      ...initialState,
    };
  }

  // ─── IRadioDriver implementation ───────────────────────────────────

  /** @inheritdoc */
  public connect(): Promise<void> {
    if (this.connected) {
      return Promise.resolve();
    }

    this.connected = true;
    this.state.connected = true;
    this.emit('connected');
    this.startTelemetrySimulation();
    return Promise.resolve();
  }

  /** @inheritdoc */
  public disconnect(): Promise<void> {
    this.stopTelemetrySimulation();
    this.connected = false;
    this.state.connected = false;
    this.emit('disconnected');
    return Promise.resolve();
  }

  /** @inheritdoc */
  public isConnected(): boolean {
    return this.connected;
  }

  /** @inheritdoc */
  public getStatus(): Promise<RadioStatus> {
    return Promise.resolve({ ...this.state });
  }

  /** @inheritdoc */
  public setFrequency(frequencyKhz: number): Promise<void> {
    this.state.frequency = frequencyKhz;
    return Promise.resolve();
  }

  /** @inheritdoc */
  public setMode(mode: RadioMode): Promise<void> {
    this.state.mode = mode;
    return Promise.resolve();
  }

  /** @inheritdoc */
  public setPower(watts: number): Promise<void> {
    this.state.power = watts;
    return Promise.resolve();
  }

  /** @inheritdoc */
  public pttOn(): Promise<void> {
    this.state.txActive = true;
    return Promise.resolve();
  }

  /** @inheritdoc */
  public pttOff(): Promise<void> {
    this.state.txActive = false;
    return Promise.resolve();
  }

  /** @inheritdoc */
  public getSwr(): Promise<number> {
    return Promise.resolve(this.state.swr);
  }

  // ─── Event overloads (typed) ───────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  // ─── Private helpers ───────────────────────────────────────────────

  /**
   * Start periodic telemetry simulation at 1 Hz.
   *
   * Produces plausible synthetic data by adding small random
   * variations to temperature, SWR, voltage, and current draw.
   * If PTT is active and SWR exceeds 3.0, emits `"swr-protection"`
   * and cuts TX — matching the behavior of the real sBitx CLI driver.
   */
  private startTelemetrySimulation(): void {
    this.telemetryInterval = setInterval(() => {
      // Simulate gradual thermal drift: ±0.25°C per second.
      this.state.temperature += (Math.random() - 0.5) * 0.5;

      // Simulate SWR fluctuation: 1.0–1.5 typical, but with a
      // 5% chance of a high SWR spike (up to 5.0) to exercise
      // SWR protection in tests.
      if (Math.random() < 0.05) {
        this.state.swr = 3.0 + Math.random() * 2.0; // 3.0–5.0
      } else {
        this.state.swr = 1.0 + Math.random() * 0.5;
      }

      const snapshot: TelemetrySnapshot = {
        timestamp: new Date().toISOString(),
        frequency: this.state.frequency,
        mode: this.state.mode,
        power: this.state.power,
        swr: Math.round(this.state.swr * 100) / 100,
        temperature: Math.round(this.state.temperature * 10) / 10,
        voltage: this.state.txActive
          ? 12.8 + (Math.random() - 0.5) * 1.0 // Voltage dips under TX load
          : 13.8 + (Math.random() - 0.5) * 0.4,
        current: this.state.txActive
          ? 15 + Math.random() * 3 // Higher current draw during TX
          : 0.5 + Math.random() * 0.2,
        txActive: this.state.txActive,
      };

      this.emit('telemetry', snapshot);

      // SWR protection: match real driver behavior.
      // If SWR > 3.0 while transmitting, emit warning and cut TX.
      if (snapshot.swr > 3.0 && snapshot.txActive) {
        this.emit('swr-protection', snapshot.swr);
        void this.pttOff();
      }
    }, 1000);
  }

  /**
   * Stop the telemetry simulation interval.
   *
   * Safe to call when no interval is active.
   */
  private stopTelemetrySimulation(): void {
    if (this.telemetryInterval !== null) {
      clearInterval(this.telemetryInterval);
      this.telemetryInterval = null;
    }
  }
}