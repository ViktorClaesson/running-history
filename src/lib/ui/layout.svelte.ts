/**
 * Phone or desktop. One app, one code base: below PHONE_MAX_PX the page switches to the
 * phone layout (readout strip, tabs, on-screen view buttons). Reactive, so rotating a
 * tablet or resizing a window switches live.
 */
export const PHONE_QUERY = '(max-width: 700px)';

class LayoutStore {
  phone = $state(typeof matchMedia === 'undefined' ? false : matchMedia(PHONE_QUERY).matches);

  constructor() {
    if (typeof matchMedia === 'undefined') return;
    matchMedia(PHONE_QUERY).addEventListener('change', (e) => (this.phone = e.matches));
  }
}

export const layout = new LayoutStore();
