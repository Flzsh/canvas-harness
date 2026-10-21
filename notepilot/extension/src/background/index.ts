/**
 * MV3 service worker. Deliberately small: MV3 workers are suspended after ~30 s of inactivity and
 * alarms fire at most every 30 s, so continuous 2–5 s synchronization runs in the side panel page
 * (alive while visible). The worker only wires up the toolbar button and keyboard shortcut.
 */
const enablePanel = () => chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((e) => console.warn('[NotePilot]', e));

chrome.runtime.onInstalled.addListener(enablePanel);
chrome.runtime.onStartup.addListener(enablePanel);
