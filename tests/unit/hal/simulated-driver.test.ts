import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SimulatedRadioDriver } from '../../../src/hal/simulated-driver.js';
import type { TelemetrySnapshot } from '../../../src/hal/driver.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SimulatedRadioDriver', () => {
  // -- constructor ----------------------------------------------------

  describe('constructor', () => {
    it('should use sensible defaults when no initialState is provided', () => {
      const driver = new SimulatedRadioDriver();

      expect(driver.isConnected()).toBe(false);

      // Verify defaults via getStatus().
      void driver.getStatus().then((status) => {
        expect(status.connected).toBe(false);
        expect(status.frequency).toBe(7100);
        expect(status.mode).toBe('USB');
        expect(status.power).toBe(10);
        expect(status.swr).toBe(1.2);
        expect(status.temperature).toBe(35);
        expect(status.txActive).toBe(false);
      });
    });

    it('should merge initialState overrides', () => {
      const driver = new SimulatedRadioDriver({
        frequency: 14200,
        mode: 'CW',
        power: 50,
      });

      void driver.getStatus().then((status) => {
        expect(status.frequency).toBe(14200);
        expect(status.mode).toBe('CW');
        expect(status.power).toBe(50);
        // Unspecified fields keep defaults.
        expect(status.swr).toBe(1.2);
        expect(status.temperature).toBe(35);
      });
    });
  });

  // -- connect() ------------------------------------------------------

  describe('connect()', () => {
    it('should emit "connected" and start telemetry', async () => {
      const driver = new SimulatedRadioDriver();
      const connectedSpy = vi.fn();
      driver.on('connected', connectedSpy);

      await driver.connect();

      expect(driver.isConnected()).toBe(true);
      expect(connectedSpy).toHaveBeenCalledOnce();
    });

    it('should be idempotent (already connected does nothing)', async () => {
      const driver = new SimulatedRadioDriver();
      const connectedSpy = vi.fn();
      driver.on('connected', connectedSpy);

      await driver.connect();
      expect(connectedSpy).toHaveBeenCalledOnce();

      await driver.connect();
      // Should still only have been called once.
      expect(connectedSpy).toHaveBeenCalledOnce();
    });
  });

  // -- disconnect() ---------------------------------------------------

  describe('disconnect()', () => {
    it('should emit "disconnected" and stop telemetry', async () => {
      const driver = new SimulatedRadioDriver();

      await driver.connect();
      expect(driver.isConnected()).toBe(true);

      const disconnectedSpy = vi.fn();
      driver.on('disconnected', disconnectedSpy);

      await driver.disconnect();

      expect(driver.isConnected()).toBe(false);
      expect(disconnectedSpy).toHaveBeenCalledOnce();
    });

    it('should be safe to call when not connected', async () => {
      const driver = new SimulatedRadioDriver();
      const disconnectedSpy = vi.fn();
      driver.on('disconnected', disconnectedSpy);

      await driver.disconnect();

      expect(driver.isConnected()).toBe(false);
      expect(disconnectedSpy).toHaveBeenCalledOnce();
    });
  });

  // -- getStatus() ----------------------------------------------------

  describe('getStatus()', () => {
    it('should return a snapshot of the current radio state', async () => {
      const driver = new SimulatedRadioDriver({ frequency: 7150, mode: 'LSB' });

      const status = await driver.getStatus();

      expect(status).toMatchObject({
        connected: false,
        frequency: 7150,
        mode: 'LSB',
        power: 10,
        txActive: false,
      });
      expect(status.swr).toBeGreaterThan(0);
      expect(status.temperature).toBeGreaterThan(0);
    });

    it('should reflect state changes after setter calls', async () => {
      const driver = new SimulatedRadioDriver();

      await driver.setFrequency(14200);
      await driver.setMode('CW');
      await driver.pttOn();

      const status = await driver.getStatus();
      expect(status.frequency).toBe(14200);
      expect(status.mode).toBe('CW');
      expect(status.txActive).toBe(true);
    });

    it('should reflect connected state', async () => {
      const driver = new SimulatedRadioDriver();

      const beforeConnect = await driver.getStatus();
      expect(beforeConnect.connected).toBe(false);

      await driver.connect();
      const afterConnect = await driver.getStatus();
      expect(afterConnect.connected).toBe(true);

      await driver.disconnect();
      const afterDisconnect = await driver.getStatus();
      expect(afterDisconnect.connected).toBe(false);
    });
  });

  // -- setFrequency() / setMode() / setPower() ------------------------

  describe('command setters', () => {
    it('should update frequency', async () => {
      const driver = new SimulatedRadioDriver();

      await driver.setFrequency(14200);
      const status = await driver.getStatus();
      expect(status.frequency).toBe(14200);
    });

    it('should update mode', async () => {
      const driver = new SimulatedRadioDriver();

      await driver.setMode('FM');
      const status = await driver.getStatus();
      expect(status.mode).toBe('FM');
    });

    it('should update power', async () => {
      const driver = new SimulatedRadioDriver();

      await driver.setPower(100);
      const status = await driver.getStatus();
      expect(status.power).toBe(100);
    });

    it('should support chaining multiple setters', async () => {
      const driver = new SimulatedRadioDriver();

      await driver.setFrequency(28000);
      await driver.setMode('AM');
      await driver.setPower(50);

      const status = await driver.getStatus();
      expect(status.frequency).toBe(28000);
      expect(status.mode).toBe('AM');
      expect(status.power).toBe(50);
    });
  });

  // -- pttOn() / pttOff() ---------------------------------------------

  describe('pttOn() / pttOff()', () => {
    it('should set txActive to true on pttOn', async () => {
      const driver = new SimulatedRadioDriver();

      await driver.pttOn();
      const status = await driver.getStatus();
      expect(status.txActive).toBe(true);
    });

    it('should set txActive to false on pttOff', async () => {
      const driver = new SimulatedRadioDriver();

      await driver.pttOn();
      await driver.pttOff();
      const status = await driver.getStatus();
      expect(status.txActive).toBe(false);
    });
  });

  // -- getSwr() -------------------------------------------------------

  describe('getSwr()', () => {
    it('should return the current SWR value', async () => {
      const driver = new SimulatedRadioDriver();

      const swr = await driver.getSwr();
      expect(swr).toBeGreaterThanOrEqual(1.0);
      expect(swr).toBeLessThanOrEqual(1.5);
    });

    it('should reflect the default SWR', async () => {
      // The initial SWR is 1.2 — but getSwr returns the mutable
      // state which could have been changed by telemetry simulation.
      // Test before connect so no telemetry has run.
      const driver = new SimulatedRadioDriver();
      const swr = await driver.getSwr();
      expect(swr).toBe(1.2);
    });
  });

  // -- Telemetry stream -----------------------------------------------

  describe('telemetry stream', () => {
    it('should emit telemetry with valid snapshot shape', async () => {
      const driver = new SimulatedRadioDriver();
      const telemetrySpy = vi.fn<(snapshot: TelemetrySnapshot) => void>();
      driver.on('telemetry', telemetrySpy);

      await driver.connect();

      // Advance by 1 second to trigger the first telemetry emission.
      await vi.advanceTimersByTimeAsync(1000);

      expect(telemetrySpy).toHaveBeenCalledOnce();
      const snapshot = telemetrySpy.mock.calls[0][0];
      expect(snapshot).toBeDefined();
      // Validate TelemetrySnapshot shape.
      expect(typeof snapshot.timestamp).toBe('string');
      expect(snapshot.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(typeof snapshot.frequency).toBe('number');
      expect(snapshot.mode).toBe('USB');
      expect(typeof snapshot.power).toBe('number');
      expect(typeof snapshot.swr).toBe('number');
      expect(snapshot.swr).toBeGreaterThan(0);
      expect(typeof snapshot.temperature).toBe('number');
      expect(typeof snapshot.voltage).toBe('number');
      expect(snapshot.voltage).toBeGreaterThan(10); // plausible voltage
      expect(typeof snapshot.current).toBe('number');
      expect(typeof snapshot.txActive).toBe('boolean');
    });

    it('should emit telemetry at approximately 1 Hz', async () => {
      const driver = new SimulatedRadioDriver();
      const telemetrySpy = vi.fn<(snapshot: TelemetrySnapshot) => void>();
      driver.on('telemetry', telemetrySpy);

      await driver.connect();

      // Advance 3 seconds.
      await vi.advanceTimersByTimeAsync(3000);

      // With setInterval at 1000ms, we should have 3 emissions (±1 due to timing).
      expect(telemetrySpy.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(telemetrySpy.mock.calls.length).toBeLessThanOrEqual(4);
    });

    it('should stop telemetry after disconnect', async () => {
      const driver = new SimulatedRadioDriver();
      const telemetrySpy = vi.fn<(snapshot: TelemetrySnapshot) => void>();
      driver.on('telemetry', telemetrySpy);

      await driver.connect();
      await vi.advanceTimersByTimeAsync(2000);
      expect(telemetrySpy).toHaveBeenCalled();

      const callCountBeforeDisconnect = telemetrySpy.mock.calls.length;

      await driver.disconnect();
      // Advance more time — no additional telemetry should fire.
      await vi.advanceTimersByTimeAsync(3000);

      expect(telemetrySpy.mock.calls.length).toBe(callCountBeforeDisconnect);
    });

    it('should reflect voltage dip and higher current when TX is active', async () => {
      const driver = new SimulatedRadioDriver();
      const telemetrySpy = vi.fn<(snapshot: TelemetrySnapshot) => void>();
      driver.on('telemetry', telemetrySpy);

      await driver.connect();
      await driver.pttOn();

      await vi.advanceTimersByTimeAsync(1000);

      const snapshot = telemetrySpy.mock.calls[0][0];
      expect(snapshot.txActive).toBe(true);
      // Under TX load, voltage should be lower (around 12.3–13.3).
      expect(snapshot.voltage).toBeLessThan(13.8);
      // Current should be higher during TX (around 14–18 A).
      expect(snapshot.current).toBeGreaterThan(10);
    });
  });

  // -- SWR protection -------------------------------------------------

  describe('SWR protection', () => {
    it('should emit "swr-protection" when SWR > 3.0 while PTT active', async () => {
      const driver = new SimulatedRadioDriver();

      // Override the private SWR generation by injecting a high SWR
      // into the initial state and disabling the normal random variation.
      // We test this indirectly by advancing many seconds — the 5% spike
      // probability means we'll eventually hit a high SWR when PTT is on.

      const swrProtectionSpy = vi.fn<(swr: number) => void>();
      driver.on('swr-protection', swrProtectionSpy);

      // We need to force a high SWR scenario. The simplest approach:
      // connect, enable PTT, then advance enough seconds for the 5%
      // spike to trigger. We'll advance 120 seconds to be sure.
      await driver.connect();
      await driver.pttOn();

      // Advance 120 seconds (120 telemetry ticks). At 5% spike
      // probability, we expect ~6 high SWR events.
      await vi.advanceTimersByTimeAsync(120_000);

      expect(swrProtectionSpy).toHaveBeenCalled();
      // swr-protection should emit swr > 3.0.
      const swrValue = swrProtectionSpy.mock.calls[0][0];
      expect(swrValue).toBeGreaterThan(3.0);
    });

    it('should NOT trigger SWR protection when PTT is not active', async () => {
      const driver = new SimulatedRadioDriver();

      const swrProtectionSpy = vi.fn<(swr: number) => void>();
      driver.on('swr-protection', swrProtectionSpy);

      // With PTT off, even if SWR spikes randomly, swr-protection
      // should never fire because txActive is false in the snapshot
      // AND the protection check requires both conditions.
      // Actually — the driver checks snapshot.swr > 3.0 && snapshot.txActive.
      // The 5% spike modifies this.state.swr but txActive is false,
      // so protection never fires.
      await driver.connect();
      // PTT is NOT enabled.
      await vi.advanceTimersByTimeAsync(120_000);

      expect(swrProtectionSpy).not.toHaveBeenCalled();
    });

    it('should cut TX (pttOff) when SWR protection triggers', async () => {
      const driver = new SimulatedRadioDriver();

      await driver.connect();
      await driver.pttOn();

      // Advance many ticks to hit the spike probability.
      await vi.advanceTimersByTimeAsync(120_000);

      // After protection, TX should be off.
      const status = await driver.getStatus();
      expect(status.txActive).toBe(false);
    });
  });
});