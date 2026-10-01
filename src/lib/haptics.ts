export function vibrateSuccess() {
  if (typeof window !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([100, 50, 100]);
  }
}

export function vibrateError() {
  if (typeof window !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([50, 50, 50, 50, 50]);
  }
}

export function vibrateTap() {
  if (typeof window !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(10);
  }
}
