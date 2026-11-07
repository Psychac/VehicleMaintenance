/**
 * Page scroll position at the moment a route change starts. The app scrolls to the top on every
 * navigation, which would make the screen that is still animating out jump up with it. The leaving
 * layer reads this to stay where it visually was.
 */
let leaveScroll = 0;

export function rememberLeaveScroll(): void {
  leaveScroll = typeof window === 'undefined' ? 0 : window.scrollY;
}

export function getLeaveScroll(): number {
  return leaveScroll;
}
