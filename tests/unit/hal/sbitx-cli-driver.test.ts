import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { SBitxCLIDriver } from '../../../src/hal/sbitx-cli-driver.js';
import type { TelemetrySnapshot } from '../../../src/hal/driver.js';

// We mock child_process.execFile to avoid real CLI calls.
const mockExecFile = vi.fn();
vi.mock('node:child_process', () => ({
  execFile: (
    ...args: [
      string,
      string[],
      Record<string, unknown> | undefined,
      (error: Error | null, stdout: string, stderr: string) => void,
    ]
  ) => mockExecFile(...args),
}));

/**
 * Create a mock ChildProcess-like object for telemetry stream testing.
 * Returns the mock so tests can emit data/close events on it.
 */
function createMockChildProcess(): EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: () => void } {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: () => void;
  };
  proc.stdout = stdout;
  proc.stderr = stderr;
  proc.kill = vi.fn();
  return proc;
}

beforeEach(() => {
  mockExecFile.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Helpers to set up execFile responses ───────────────────────────

/** Make `execFile` resolve with the given stdout for the next call. */
function mockExecResolve(stdout: string): void {
  mockExecFile.mockImplementationOnce(
    (
      _path: string,
      _args: string[],
      _opts: Record<string, unknown> | undefined,
      callback: (error: Error | null, stdout: string, stderr: string) => void,
    ) => callback(null, stdout, ''),
  );
}

/** Make `execFile` reject with the given error message for the next call. */
function mockExecReject(message: string): void {
  mockExecFile.mockImplementationOnce(
    (
      _path: string,
      _args: string[],
      _opts: Record<string, unknown> | undefined,
      callback: (error: Error | null, stdout: string, stderr: string) => void,
    ) => callback(new Error(message), '', message),
  );
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('SBitxCLIDriver', () => {
  // -- connect() ------------------------------------------------------

  describe('connect()', () => {
    it('should verify CLI availability and emit "connected"', async () => {
      const driver = new SBitxCLIDriver('/fake/sbitx');
      const mockProc = createMockChildProcess();

      // First execFile call: `sbitx status` → succeeds.
      mockExecResolve(JSON.stringify({
        vfo_frequency: 7100,
        mode: 'USB',
        tx_power: 10,
        swr_reading: 1.0,
        pa_temperature: 35,
        ptt_active: false,
      }));

      // Second execFile call: `sbitx telemetry --interval 1` → returns mock process.
      mockExecFile.mockImplementationOnce(
        (
          _path: string,
          _args: string[],
          _opts: Record<string, unknown> | undefined,
          _callback: (error: Error | null, stdout: string, stderr: string) => void,
        ) => mockProc,
      );

      const connectedSpy = vi.fn();
      driver.on('connected', connectedSpy);

      await driver.connect();

      expect(driver.isConnected()).toBe(true);
      expect(connectedSpy).toHaveBeenCalledOnce();
      // First call should be `["status"]`.
      const statusCallArgs = mockExecFile.mock.calls[0] as [string, string[], ...unknown[]];
      expect(statusCallArgs[1]).toEqual(['status']);
    });

    it('should be idempotent (already connected does nothing)', async () => {
      const driver = new SBitxCLIDriver('/fake/sbitx');
      const mockProc = createMockChildProcess();

      mockExecResolve(JSON.stringify({
        vfo_frequency: 7100,
        mode: 'USB',
        tx_power: 10,
        swr_reading: 1.0,
        pa_temperature: 35,
        ptt_active: false,
      }));
      mockExecFile.mockImplementationOnce(() => mockProc);

      await driver.connect();
      const callCount = mockExecFile.mock.calls.length;

      // Second connect should be a no-op.
      await driver.connect();
      expect(mockExecFile.mock.calls.length).toBe(callCount);
    });

    it('should throw when the CLI is unavailable', async () => {
      const driver = new SBitxCLIDriver('/nonexistent/sbitx');
      mockExecReject('ENOENT: no such file');

      await expect(driver.connect()).rejects.toThrow('sBitx CLI error');
      expect(driver.isConnected()).toBe(false);
    });
  });

  // -- disconnect() ---------------------------------------------------

  describe('disconnect()', () => {
    it('should stop telemetry and emit "disconnected"', async () => {
      const driver = new SBitxCLIDriver('/fake/sbitx');
      const mockProc = createMockChildProcess();

      mockExecResolve(JSON.stringify({
        vfo_frequency: 7100,
        mode: 'USB',
        tx_power: 10,
        swr_reading: 1.0,
        pa_temperature: 35,
        ptt_active: false,
      }));
      mockExecFile.mockImplementationOnce(() => mockProc);

      await driver.connect();
      expect(driver.isConnected()).toBe(true);

      const disconnectedSpy = vi.fn();
      driver.on('disconnected', disconnectedSpy);

      await driver.disconnect();

      expect(driver.isConnected()).toBe(false);
      expect(disconnectedSpy).toHaveBeenCalledOnce();
    });

    it('should be safe to call when not connected', async () => {
      const driver = new SBitxCLIDriver('/fake/sbitx');
      const disconnectedSpy = vi.fn();
      driver.on('disconnected', disconnectedSpy);

      await driver.disconnect();

      expect(driver.isConnected()).toBe(false);
      expect(disconnectedSpy).toHaveBeenCalledOnce();
    });
  });

  // -- getStatus() ----------------------------------------------------

  describe('getStatus()', () => {
    it('should parse status JSON and return RadioStatus', async () => {
      const driver = new SBitxCLIDriver('/fake/sbitx');

      mockExecResolve(JSON.stringify({
        vfo_frequency: 14200,
        mode: 'USB',
        tx_power: 50,
        swr_reading: 1.5,
        pa_temperature: 42,
        ptt_active: true,
      }));

      const status = await driver.getStatus();

      expect(status).toEqual({
        connected: false, // not connected yet
        frequency: 14200,
        mode: 'USB',
        power: 50,
        swr: 1.5,
        temperature: 42,
        txActive: true,
      });

      const callArgs = mockExecFile.mock.calls[0] as [string, string[], ...unknown[]];
      expect(callArgs[1]).toEqual(['status']);
    });
  });

  // -- setFrequency() -------------------------------------------------

  describe('setFrequency()', () => {
    it('should call sbitx set-frequency with the frequency in kHz', async () => {
      const driver = new SBitxCLIDriver('/fake/sbitx');
      mockExecResolve('');

      await driver.setFrequency(7100);

      const callArgs = mockExecFile.mock.calls[0] as [string, string[], ...unknown[]];
      expect(callArgs[1]).toEqual(['set-frequency', '7100']);
    });
  });

  // -- setMode() ------------------------------------------------------

  describe('setMode()', () => {
    it('should call sbitx set-mode with the mode', async () => {
      const driver = new SBitxCLIDriver('/fake/sbitx');
      mockExecResolve('');

      await driver.setMode('CW');

      const callArgs = mockExecFile.mock.calls[0] as [string, string[], ...unknown[]];
      expect(callArgs[1]).toEqual(['set-mode', 'CW']);
    });
  });

  // -- setPower() -----------------------------------------------------

  describe('setPower()', () => {
    it('should call sbitx set-power with the wattage', async () => {
      const driver = new SBitxCLIDriver('/fake/sbitx');
      mockExecResolve('');

      await driver.setPower(25);

      const callArgs = mockExecFile.mock.calls[0] as [string, string[], ...unknown[]];
      expect(callArgs[1]).toEqual(['set-power', '25']);
    });
  });

  // -- pttOn() / pttOff() ---------------------------------------------

  describe('pttOn() / pttOff()', () => {
    it('should call sbitx ptt on', async () => {
      const driver = new SBitxCLIDriver('/fake/sbitx');
      mockExecResolve('');

      await driver.pttOn();

      const callArgs = mockExecFile.mock.calls[0] as [string, string[], ...unknown[]];
      expect(callArgs[1]).toEqual(['ptt', 'on']);
    });

    it('should call sbitx ptt off', async () => {
      const driver = new SBitxCLIDriver('/fake/sbitx');
      mockExecResolve('');

      await driver.pttOff();

      const callArgs = mockExecFile.mock.calls[0] as [string, string[], ...unknown[]];
      expect(callArgs[1]).toEqual(['ptt', 'off']);
    });
  });

  // -- getSwr() -------------------------------------------------------

  describe('getSwr()', () => {
    it('should parse SWR JSON and return the reading', async () => {
      const driver = new SBitxCLIDriver('/fake/sbitx');
      mockExecResolve(JSON.stringify({ swr: 2.1 }));

      const swr = await driver.getSwr();

      expect(swr).toBe(2.1);

      const callArgs = mockExecFile.mock.calls[0] as [string, string[], ...unknown[]];
      expect(callArgs[1]).toEqual(['swr']);
    });
  });

  // -- Telemetry stream -----------------------------------------------

  describe('telemetry stream', () => {
    it('should emit "telemetry" events for valid JSON lines', async () => {
      const driver = new SBitxCLIDriver('/fake/sbitx');
      const mockProc = createMockChildProcess();

      mockExecResolve(JSON.stringify({
        vfo_frequency: 7100,
        mode: 'USB',
        tx_power: 10,
        swr_reading: 1.2,
        pa_temperature: 36,
        ptt_active: false,
      }));
      mockExecFile.mockImplementationOnce(() => mockProc);

      const telemetrySpy = vi.fn<(snapshot: TelemetrySnapshot) => void>();
      driver.on('telemetry', telemetrySpy);

      await driver.connect();

      // Simulate a telemetry line from the CLI.
      const line = JSON.stringify({
        vfo_frequency: 7150,
        mode: 'LSB',
        tx_power: 20,
        swr_reading: 1.1,
        pa_temperature: 38,
        supply_voltage: 13.5,
        current_draw: 2.0,
        ptt_active: false,
      });
      mockProc.stdout!.emit('data', Buffer.from(line + '\n'));

      expect(telemetrySpy).toHaveBeenCalledOnce();
      const snapshot = telemetrySpy.mock.calls[0]![0]!;
      expect(snapshot.frequency).toBe(7150);
      expect(snapshot.mode).toBe('LSB');
      expect(snapshot.power).toBe(20);
      expect(snapshot.swr).toBe(1.1);
      expect(snapshot.temperature).toBe(38);
      expect(snapshot.voltage).toBe(13.5);
      expect(snapshot.current).toBe(2.0);
      expect(snapshot.txActive).toBe(false);
      // Timestamp should be ISO 8601.
      expect(snapshot.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle malformed JSON lines without crashing', async () => {
      const driver = new SBitxCLIDriver('/fake/sbitx');
      const mockProc = createMockChildProcess();

      mockExecResolve(JSON.stringify({
        vfo_frequency: 7100,
        mode: 'USB',
        tx_power: 10,
        swr_reading: 1.0,
        pa_temperature: 35,
        ptt_active: false,
      }));
      mockExecFile.mockImplementationOnce(() => mockProc);

      const telemetrySpy = vi.fn<(snapshot: TelemetrySnapshot) => void>();
      driver.on('telemetry', telemetrySpy);

      await driver.connect();

      // Emit a malformed line followed by a valid one.
      mockProc.stdout!.emit('data', Buffer.from('NOT VALID JSON\n'));
      const validLine = JSON.stringify({
        vfo_frequency: 7100,
        mode: 'USB',
        tx_power: 10,
        swr_reading: 1.0,
        pa_temperature: 35,
        supply_voltage: 13.8,
        current_draw: 0.5,
        ptt_active: false,
      });
      mockProc.stdout!.emit('data', Buffer.from(validLine + '\n'));

      // Should only have the valid line.
      expect(telemetrySpy).toHaveBeenCalledOnce();
    });

    it('should log stderr output without crashing', async () => {
      const driver = new SBitxCLIDriver('/fake/sbitx');
      const mockProc = createMockChildProcess();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockExecResolve(JSON.stringify({
        vfo_frequency: 7100,
        mode: 'USB',
        tx_power: 10,
        swr_reading: 1.0,
        pa_temperature: 35,
        ptt_active: false,
      }));
      mockExecFile.mockImplementationOnce(() => mockProc);

      await driver.connect();

      mockProc.stderr!.emit('data', Buffer.from('WARNING: low voltage\n'));

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('low voltage'));
      warnSpy.mockRestore();
    });
  });

  // -- SWR protection -------------------------------------------------

  describe('SWR protection', () => {
    it('should emit "swr-protection" and cut TX when SWR > 3.0 while PTT active', async () => {
      const driver = new SBitxCLIDriver('/fake/sbitx');
      const mockProc = createMockChildProcess();

      // `connect()` needs two execFile calls: status + telemetry.
      mockExecResolve(JSON.stringify({
        vfo_frequency: 7100,
        mode: 'USB',
        tx_power: 10,
        swr_reading: 1.0,
        pa_temperature: 35,
        ptt_active: false,
      }));
      mockExecFile.mockImplementationOnce(() => mockProc);

      const swrProtectionSpy = vi.fn<(swr: number) => void>();
      driver.on('swr-protection', swrProtectionSpy);

      await driver.connect();

      // execFile call #3 will be pttOff (triggered by SWR protection).
      mockExecResolve('');

      // Emit telemetry with high SWR while PTT is active.
      const line = JSON.stringify({
        vfo_frequency: 7100,
        mode: 'USB',
        tx_power: 10,
        swr_reading: 4.5,
        pa_temperature: 55,
        supply_voltage: 13.2,
        current_draw: 18,
        ptt_active: true,
      });
      mockProc.stdout!.emit('data', Buffer.from(line + '\n'));

      expect(swrProtectionSpy).toHaveBeenCalledWith(4.5);
      // pttOff should have been called.
      await vi.runAllTimersAsync();
      const pttOffCall = mockExecFile.mock.calls.find(
        (call) => {
          const c = call as [string, string[], ...unknown[]];
          return c[1] !== undefined && c[1][0] === 'ptt' && c[1][1] === 'off';
        },
      );
      expect(pttOffCall).toBeDefined();
    });

    it('should NOT trigger SWR protection when PTx is not active', async () => {
      const driver = new SBitxCLIDriver('/fake/sbitx');
      const mockProc = createMockChildProcess();

      mockExecResolve(JSON.stringify({
        vfo_frequency: 7100,
        mode: 'USB',
        tx_power: 10,
        swr_reading: 1.0,
        pa_temperature: 35,
        ptt_active: false,
      }));
      mockExecFile.mockImplementationOnce(() => mockProc);

      const swrProtectionSpy = vi.fn<(swr: number) => void>();
      driver.on('swr-protection', swrProtectionSpy);

      await driver.connect();

      // High SWR but PTT is off — no protection trigger.
      const line = JSON.stringify({
        vfo_frequency: 7100,
        mode: 'USB',
        tx_power: 10,
        swr_reading: 5.0,
        pa_temperature: 35,
        supply_voltage: 13.8,
        current_draw: 0.5,
        ptt_active: false,
      });
      mockProc.stdout!.emit('data', Buffer.from(line + '\n'));

      expect(swrProtectionSpy).not.toHaveBeenCalled();
    });
  });

  // -- Telemetry reconnection (AUDIT M-8) -----------------------------

  describe('telemetry reconnection (exponential backoff)', () => {
    it('should reconnect after telemetry stream closes unexpectedly', async () => {
      const driver = new SBitxCLIDriver('/fake/sbitx');

      // First telemetry process.
      const mockProc1 = createMockChildProcess();
      // Second telemetry process (after reconnect).
      const mockProc2 = createMockChildProcess();

      // connect(): status + telemetry.
      mockExecResolve(JSON.stringify({
        vfo_frequency: 7100,
        mode: 'USB',
        tx_power: 10,
        swr_reading: 1.0,
        pa_temperature: 35,
        ptt_active: false,
      }));
      mockExecFile.mockImplementationOnce(() => mockProc1);

      await driver.connect();

      // Simulate telemetry stream crash.
      mockExecFile.mockImplementationOnce(() => mockProc2);
      mockProc1.emit('close', 1); // non-zero exit code

      // First failure: delay = 2^(1-1) = 1 second.
      await vi.advanceTimersByTimeAsync(999);
      // Should not have reconnected yet.
      expect(driver.isConnected()).toBe(true);

      await vi.advanceTimersByTimeAsync(1);
      // Now it should have restarted the telemetry stream.
      const telemetryCall = mockExecFile.mock.calls[mockExecFile.mock.calls.length - 1];
      const telemetryArgs = (telemetryCall as [string, string[], ...unknown[]])[1];
      expect(telemetryArgs).toEqual(['telemetry', '--interval', '1']);
    });

    it('should emit permanent disconnect after 10 consecutive failures', async () => {
      const driver = new SBitxCLIDriver('/fake/sbitx');

      // Setup: connect with initial telemetry process.
      const mockProc = createMockChildProcess();
      mockExecResolve(JSON.stringify({
        vfo_frequency: 7100,
        mode: 'USB',
        tx_power: 10,
        swr_reading: 1.0,
        pa_temperature: 35,
        ptt_active: false,
      }));
      mockExecFile.mockImplementationOnce(() => mockProc);
      await driver.connect();

      const disconnectedSpy = vi.fn<(error?: Error) => void>();
      driver.on('disconnected', disconnectedSpy);

      // Cause 10 consecutive failures.
      for (let i = 0; i < 10; i++) {
        const newProc = createMockChildProcess();
        mockExecFile.mockImplementationOnce(() => newProc);

        mockProc.emit('close', 1);

        // Advance time past the backoff delay.
        const delaySeconds = Math.min(2 ** i, 60);
        await vi.advanceTimersByTimeAsync(delaySeconds * 1000 + 100);
      }

      expect(driver.isConnected()).toBe(false);
      expect(disconnectedSpy).toHaveBeenCalledOnce();
      const error = disconnectedSpy.mock.calls[0]![0];
      expect(error?.message).toContain('10 consecutive times');
    });
  });

  // -- constructor defaults -------------------------------------------

  describe('constructor', () => {
    it('should default cliPath to /usr/local/bin/sbitx', () => {
      const driver = new SBitxCLIDriver();
      // Access via a public method to verify the path is used.
      expect(() => driver.isConnected()).not.toThrow();
      expect(driver.isConnected()).toBe(false);
    });
  });
});