/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
// Runs only where background.js registered it: a school Canvas address the student added and the
// browser allowed. It lets this page's origin count as a Canvas site, like *.instructure.com does.
globalThis.ReserveSite?.trustSites([location.origin]);
