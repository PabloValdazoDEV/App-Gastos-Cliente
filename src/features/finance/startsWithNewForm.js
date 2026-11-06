// "Añadir gasto" links open each page with ?nuevo=1 so the creation form is
// already open: one tap fewer. Read from window.location so pages also work
// when rendered outside a router (tests).
export function startsWithNewForm() {
  try {
    return new URLSearchParams(window.location.search).get('nuevo') === '1';
  } catch {
    return false;
  }
}
