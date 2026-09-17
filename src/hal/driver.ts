import type { EventEmitter } from 'node:events';

/**
 * Hardware Abstraction Layer — Radio Driver Interface
 * =====================================================
 *
 * All radio hardware communication goes through this interface. Two
 * implementations are provided:
 *
 * | Driver               | Purpose                     | Requires Hardware |
 * |----------------------|-----------------------------|:-----------------:|
 * | `SBitxCLIDriver`     | Production driver for sBitx v2 | Yes             |
 * | `SimulatedRadioDriver`| Development and testing     | No                |
 *
 * The driver is selected at startup via the `RADIO_DRIVER` environment
 * variable (see `src/shared/config.ts`).
 *
 * ## Design
 *
 * `IRadioDriver` extends `EventEmitter` because radio hardware is inherently
 * event-driven (telemetry streams, connection state changes, SWR alerts).
 * Consumers subscribe to typed events rather than polling.
 *
 * See docs/architecture/hardware-integration.md for the full HAL design.
 */

/**
 * Operating mode for the HF transceiver.
 *
 * Values are restricted to modes supported by the sBitx v2 hardware.
 */
export type RadioMode = 'USB' | 'LSB' | 'AM' | 'FM' | 'CW';

/**
 * Point-in-time snapshot of the radio's current state.
 * Returned by `getStatus()` and served via `GET /radio/status`.
 */
export interface RadioStatus {
  /** Whether the driver currently has an active connection to the hardware */
  connected: boolean;
  /** Current VFO frequency in kHz */
  frequency: number;
  /** Current operating mode */
  mode: RadioMode;
  /** TX power setting in watts */
  power: number;
  /** Standing Wave Ratio (SWR) reading */
  swr: number;
  /** Power amplifier temperature in °C */
  temperature: number;
  /** Whether the transmitter is currently active (PTT engaged) */
  txActive: boolean;
}

/**
 * Telemetry snapshot emitted at 1 Hz by the radio driver.
 *
 * Contains all metrics needed for real-time monitoring dashboards and
 * historical telemetry recording (Phase 3: D3.8 telemetry tables).
 */
export interface TelemetrySnapshot {
  /** ISO 8601 timestamp of when this snapshot was captured */
  timestamp: string;
  /** Current VFO frequency in kHz */
  frequency: number;
  /** Current operating mode */
  mode: RadioMode;
  /** TX power setting in watts */
  power: number;
  /** Standing Wave Ratio (SWR) reading */
  swr: number;
  /** Power amplifier temperature in °C */
  temperature: number;
  /** Supply voltage in volts */
  voltage: number;
  /** Current draw in amperes */
  current: number;
  /** Whether the transmitter is currently active (PTT engaged) */
  txActive: boolean;
}

/**
 * Typed event map for `IRadioDriver.on()` / `IRadioDriver.emit()`.
 *
 * Using a string-indexed map avoids `any` on listener signatures while
 * keeping the interface compatible with Node's `EventEmitter`.
 */
export interface RadioDriverEvents {
  /** Emitted every 1 second with a new telemetry snapshot */
  telemetry: (data: TelemetrySnapshot) => void;
  /** Emitted when the driver successfully connects to the radio */
  connected: () => void;
  /** Emitted when the driver disconnects (optionally with an error cause) */
  disconnected: (error?: Error) => void;
  /** Emitted when SWR exceeds the protection threshold (3.0) while TX is active */
  'swr-protection': (swr: number) => void;
}

/**
 * Hardware Abstraction Layer interface for radio transceiver control.
 *
 * All radio operations — status queries, frequency/mode/power changes,
 * PTT control, and SWR monitoring — go through this interface.
 *
 * Implementations:
 * - `SBitxCLIDriver` — wraps `child_process.execFile` calls to sBitx CLI
 * - `SimulatedRadioDriver` — fake radio with plausible synthetic data
 *
 * @example
 * ```typescript
 * const driver: IRadioDriver = createRadioDriver(config.radioDriver);
 * driver.on('telemetry', (snapshot) => {
 *   console.log(`Freq: ${snapshot.frequency} kHz, SWR: ${snapshot.swr}`);
 * });
 * await driver.connect();
 * await driver.setFrequency(7100);
 * ```
 */
export interface IRadioDriver extends EventEmitter {
  /** Establish connection to the radio hardware */
  connect(): Promise<void>;

  /** Disconnect from the radio hardware and stop telemetry streaming */
  disconnect(): Promise<void>;

  /** Return whether the driver currently has an active connection */
  isConnected(): boolean;

  /** Get a point-in-time snapshot of radio status */
  getStatus(): Promise<RadioStatus>;

  /** Set the VFO frequency in kHz (e.g., 7100 for 40m band) */
  setFrequency(frequencyKhz: number): Promise<void>;

  /** Set the operating mode (USB, LSB, AM, FM, CW) */
  setMode(mode: RadioMode): Promise<void>;

  /** Set the TX power in watts */
  setPower(watts: number): Promise<void>;

  /** Engage push-to-talk (start transmitting) */
  pttOn(): Promise<void>;

  /** Release push-to-talk (stop transmitting) */
  pttOff(): Promise<void>;

  /** Get the current SWR reading */
  getSwr(): Promise<number>;

  // Event overloads — typed signatures matching RadioDriverEvents map

  /** Subscribe to telemetry snapshots (1 Hz) */
  on(event: 'telemetry', listener: (data: TelemetrySnapshot) => void): this;

  /** Subscribe to connection established events */
  on(event: 'connected', listener: () => void): this;

  /** Subscribe to disconnection events */
  on(event: 'disconnected', listener: (error?: Error) => void): this;

  /** Subscribe to SWR protection threshold breach events */
  on(event: 'swr-protection', listener: (swr: number) => void): this;
}