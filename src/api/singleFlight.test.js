import { describe, expect, it, vi } from 'vitest';

import { createSingleFlight } from './singleFlight';

describe('createSingleFlight', () => {
  it('comparte una sola ejecución entre llamadas concurrentes', async () => {
    let finishTask;
    const task = vi.fn(
      () =>
        new Promise((resolve) => {
          finishTask = resolve;
        }),
    );
    const run = createSingleFlight(task);

    const first = run();
    const second = run();
    const third = run();

    expect(first).toBe(second);
    expect(second).toBe(third);

    await Promise.resolve();
    expect(task).toHaveBeenCalledTimes(1);

    finishTask('sesión renovada');
    await expect(first).resolves.toBe('sesión renovada');
  });

  it('permite una nueva ejecución después de terminar', async () => {
    const task = vi.fn().mockResolvedValue('ok');
    const run = createSingleFlight(task);

    await run();
    await run();

    expect(task).toHaveBeenCalledTimes(2);
  });
});
