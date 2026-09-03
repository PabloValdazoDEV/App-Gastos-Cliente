/**
 * Ensures that concurrent calls share one promise. Once it settles, a later
 * call starts a new task. This prevents a burst of 401 responses from causing
 * multiple refresh requests.
 */
export function createSingleFlight(task) {
  let inFlight = null;

  return (...args) => {
    if (!inFlight) {
      inFlight = Promise.resolve()
        .then(() => task(...args))
        .finally(() => {
          inFlight = null;
        });
    }

    return inFlight;
  };
}
