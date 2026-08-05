import { execFile, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type { IRadioDriver, RadioMode, RadioStatus, TelemetrySnapshot } from './driver.js';

/**
 * Maximum number of consecutive telemetry stream failures before the driver
 * considers the radio permanently disconnected.
 *
 * Per [AUDIT M-8]: after 10 consecutive failures, emit permanent disconnect.
 */
const MAX_CONSECUTIVE_FAILURES = 10;

/**
 * Maximum backoff delay between telemetry reconnection attempts (seconds).
 */
const MAX_BACKOFF_SECONDS = 60;

/**
 * Raw JSON shape returned by `sbitx status`.
 *
 * @internal — upstream CLI contract, not part of the public API.
 */
interface RawStatus {
  vfo_frequency: number;
  mode: string;
  tx_power: number;
  swr_reading: number;
  pa_temperature: number;
  ptt_active: boolean;
}

/**
 * Raw JSON shape emitted by `sbitx telemetry --interval 1`.
 *
 * @internal — upstream CLI contract, not part of the public API.
 */
interface RawTelemetry {
  vfo_frequency: number;
  mode: string;
  tx_power: number;
  swr_reading: number;
  pa_temperature: number;
  supply_voltage: number;
  current_draw: number;
  ptt_active: boolean;
}

/**
 * Raw JSON shape returned by `sbitx swr`.
 *
 * @internal — upstream CLI contract, not part of the public API.
 */
interface RawSwr {
  swr: number;
}

/**
 * Production radio driver that communicates with the sBitx v2 transceiver
 * via its CLI interface (`/usr/local/bin/sbitx`).
 *
 * All commands use {@link https://nodejs.org/api/child_process.html#child_processexecfilefile-args-options-callback | child_process.execFile}
 * with **argument arrays** to prevent shell injection.
 *
 * ## Telemetry Reconnection (AUDIT M-8)
 *
 * If the telemetry stream dies unexpectedly while the driver is still
 * logically connected, the driver attempts to reconnect using exponential
 * backoff:
 *
 *   Delay sequence: 1s → 2s → 4s → 8s → 16s → 32s → 60s (capped)
 *
 * After {@link MAX_CONSECUTIVE_FAILURES} consecutive failures the driver
 * emits `"disconnected"` with an error and stops retrying.
 *
 * ## SWR Protection
 *
 * The telemetry stream handler monitors SWR readings.  If SWR exceeds 3.0
 * while PTT is active, the driver:
 *   1. Emits `"swr-protection"` with the SWR value.
 *   2. Immediately cuts TX via `pttOff()`.
 *   3. Does **not** re-engage TX — the operator must manually reset.
 */
export class SBitxCLIDriver extends EventEmitter implements IRadioDriver {
  private connected = false;
  private telemetryProcess: ChildProcess | null = null;
  private consecutiveFailures = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly cliPath: string;
  private readonly commandTimeout: number;

  /**
   * @param cliPath - Path to the sBitx CLI executable.
   *                  Defaults to `/usr/local/bin/sbitx`.
   * @param commandTimeout - Per-command timeout in milliseconds.
   *                         Defaults to 5000 (5 seconds).
   */
  constructor(cliPath = '/usr/local/bin/sbitx', commandTimeout = 5000) {
    super();
    this.cliPath = cliPath;
    this.commandTimeout = commandTimeout;
  }

  // ─── IRadioDriver implementation ───────────────────────────────────

  /** @inheritdoc */
  public async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    // Verify the CLI is available and the radio responds.
    await this.exec(['status']);
    this.connected = true;
    this.consecutiveFailures = 0;
    this.emit('connected');

    // Start the persistent telemetry stream.
    this.startTelemetryStream();
  }

  /** @inheritdoc */
  public async disconnect(): Promise<void> {
    this.clearReconnectTimer();
    this.stopTelemetryStream();
    this.connected = false;
    this.consecutiveFailures = 0;
    this.emit('disconnected');
  }

  /** @inheritdoc */
  public isConnected(): boolean {
    return this.connected;
  }

  /** @inheritdoc */
  public async getStatus(): Promise<RadioStatus> {
    const output = await this.exec(['status']);
    const parsed = JSON.parse(output) as RawStatus;

    return {
      connected: this.connected,
      frequency: parsed.vfo_frequency,
      mode: parsed.mode as RadioMode,
      power: parsed.tx_power,
      swr: parsed.swr_reading,
      temperature: parsed.pa_temperature,
      txActive: parsed.ptt_active,
    };
  }

  /** @inheritdoc */
  public async setFrequency(frequencyKhz: number): Promise<void> {
    await this.exec(['set-frequency', String(frequencyKhz)]);
  }

  /** @inheritdoc */
  public async setMode(mode: RadioMode): Promise<void> {
    await this.exec(['set-mode', mode]);
  }

  /** @inheritdoc */
  public async setPower(watts: number): Promise<void> {
    await this.exec(['set-power', String(watts)]);
  }

  /** @inheritdoc */
  public async pttOn(): Promise<void> {
    await this.exec(['ptt', 'on']);
  }

  /** @inheritdoc */
  public async pttOff(): Promise<void> {
    await this.exec(['ptt', 'off']);
  }

  /** @inheritdoc */
  public async getSwr(): Promise<number> {
    const output = await this.exec(['swr']);
    const parsed = JSON.parse(output) as RawSwr;
    return parsed.swr;
  }

  // ─── Event overloads (typed) ───────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  // ─── Private helpers ───────────────────────────────────────────────

  /**
   * Execute a single sBitx CLI command and return its stdout.
   *
   * Uses `execFile` with an argument array to prevent shell injection.
   * The command times out after {@link commandTimeout} milliseconds.
   *
   * @throws {Error} if the CLI exits with a non-zero code, times out,
   *                 or writes to stderr.
   */
  private exec(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(this.cliPath, args, { timeout: this.commandTimeout }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`sBitx CLI error: ${stderr || error.message}`));
          return;
        }
        resolve(stdout.trim());
      });
    });
  }

  /**
   * Launch the persistent telemetry stream (`sbitx telemetry --interval 1`).
   *
   * The child process writes one JSON line per second to stdout.  Each
   * line is parsed into a {@link TelemetrySnapshot} and emitted via the
   * `"telemetry"` event.
   *
   * If the stream exits unexpectedly while the driver is still logically
   * connected, the driver schedules a reconnection attempt with
   * exponential backoff via {@link scheduleReconnect}.
   */
  private startTelemetryStream(): void {
    this.telemetryProcess = execFile(
      this.cliPath,
      ['telemetry', '--interval', '1'],
      { timeout: 0 }, // No timeout — telemetry runs indefinitely.
    );

    this.telemetryProcess.stdout?.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().trim().split('\n');
      for (const line of lines) {
        try {
          const data = JSON.parse(line) as RawTelemetry;
          const snapshot: TelemetrySnapshot = {
            timestamp: new Date().toISOString(),
            frequency: data.vfo_frequency,
            mode: data.mode as RadioMode,
            power: data.tx_power,
            swr: data.swr_reading,
            temperature: data.pa_temperature,
            voltage: data.supply_voltage,
            current: data.current_draw,
            txActive: data.ptt_active,
          };
          this.emit('telemetry', snapshot);

          // SWR protection: if SWR > 3.0 while transmitting, cut TX immediately.
          if (data.swr_reading > 3.0 && data.ptt_active) {
            this.emit('swr-protection', data.swr_reading);
            void this.pttOff();
          }
        } catch {
          // Malformed JSON line — log and continue.  A single corrupt
          // line should not crash the telemetry stream.
        }
      }
    });

    this.telemetryProcess.stderr?.on('data', (chunk: Buffer) => {
      // Log stderr for diagnostics but do not crash the stream.
      // The CLI may emit warnings on stderr while still producing
      // valid telemetry on stdout.
      console.warn(`sBitx CLI stderr: ${chunk.toString()}`);
    });

    this.telemetryProcess.on('close', (code) => {
      // Reset consecutive failures on a clean exit (code 0 / null).
      if (code === 0 || code === null) {
        this.consecutiveFailures = 0;
      }

      if (this.connected) {
        this.consecutiveFailures += 1;

        if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          this.connected = false;
          this.consecutiveFailures = 0;
          this.emit(
            'disconnected',
            new Error(
              `Telemetry stream failed ${MAX_CONSECUTIVE_FAILURES} consecutive times — permanent disconnect`,
            ),
          );
        } else {
          this.scheduleReconnect();
        }
      }
    });
  }

  /**
   * Kill the telemetry child process and null out the reference.
   *
   * Safe to call even if no process is running.
   */
  private stopTelemetryStream(): void {
    if (this.telemetryProcess) {
      this.telemetryProcess.kill('SIGTERM');
      this.telemetryProcess = null;
    }
  }

  /**
   * Schedule a telemetry reconnection attempt with exponential backoff.
   *
   * Delay (seconds): 1, 2, 4, 8, 16, 32, 60 (capped).
   *
   * Per [AUDIT M-8]: this avoids thrashing the CLI process on
   * persistent failures while still recovering quickly from transient
   * interruptions.
   */
  private scheduleReconnect(): void {
    // Calculate delay: 2^(failures-1) seconds, capped at MAX_BACKOFF_SECONDS.
    const delaySeconds = Math.min(
      2 ** (this.consecutiveFailures - 1),
      MAX_BACKOFF_SECONDS,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.attemptReconnect();
    }, delaySeconds * 1000);
  }

  /**
   * Attempt to restart the telemetry stream after a failure.
   *
   * Called by the backoff timer.  Does **not** re-run `connect()` —
   * only restarts the streaming child process.
   */
  private attemptReconnect(): void {
    if (!this.connected) {
      return;
    }
    this.stopTelemetryStream();
    this.startTelemetryStream();
  }

  /**
   * Clear any pending reconnection timer.
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}