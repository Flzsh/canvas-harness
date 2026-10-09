# Canvas Harness optional local AI companion

This is a local native-messaging host for the Canvas Harness extension. It implements OpenAI's documented **Sign in with ChatGPT for open-source/local apps** using its own dynamic-agent OAuth registration and the public Responses API. It does not use Codex, tools, MCP, borrowed client IDs, browser cookies, or another application's tokens. No account is connected until the user explicitly signs in and grants plan usage.

Node.js **22 or newer** is required. There are no npm dependencies and nothing to download at runtime. The code is covered by the repository's MIT license. The extension panel and service worker are separate components; see [CONTRACT.md](CONTRACT.md) for their exact integration contract.

## Install on Windows (explicit user action)

1. Install a current supported Node.js release from its official distribution if needed. Find its actual full `node.exe` path (`Get-Command node` in PowerShell).
2. Load/install Canvas Harness in Chrome or Edge. Copy its actual extension ID from `chrome://extensions` or `edge://extensions`. It is 32 lowercase letters from a–p. Unpacked extension IDs can differ across installations or browsers.
3. Keep this complete `companion` folder together. In PowerShell, run a preview with your actual values, replacing both placeholders:

   ```powershell
   & 'C:\Program Files\nodejs\node.exe' .\companion\install.cjs --extension-id YOUR_ACTUAL_EXTENSION_ID --node 'C:\Program Files\nodejs\node.exe'
   ```

   The command only prints an installation preview unless `--install` is present. Use `--destination 'D:\Tools\CanvasHarnessAI'` to select another dedicated local folder. Do not use a shared folder, a filesystem root, a network path, or an existing folder containing other work.

4. After reviewing the preview, run the same command with `--install`. For two different IDs, repeat `--extension-id` once per ID. The installer copies the companion to `%LOCALAPPDATA%\CanvasHarnessAI` by default, restricts its folder to the current Windows user and SYSTEM, and registers this host under **HKCU** for Chrome and Edge. It neither signs in nor makes inference requests. It does not require an administrator account. It deliberately refuses a running profile lock.
5. Reload/reconnect Canvas Harness. Open its integrated AI panel and choose **Sign in with ChatGPT**. The normal system browser opens OpenAI's consent flow. Register this installation as **Canvas Harness**, grant ChatGPT plan usage, and return to the panel. This creates the user's own app registration; no client secret or developer-owned client ID is needed.
6. Select a model and explicitly send a small message. Only a completed response verifies inference access. A saved authorization or populated model list is not proof that the account can use a particular model.

The Node launcher passes fixed, bundled PowerShell helper code through `-Command`, with all input data on stdin. It does not change execution policy, request `ExecutionPolicy Bypass`, or interpolate input into commands. The `.ps1` files are reviewable helper source. If organizational policy blocks PowerShell or the required .NET operations, respect that policy: secure storage falls back explicitly to memory-only, and a blocked browser helper prevents sign-in. Registration can also be blocked by managed-browser policy.

Check the runtime without installing or accessing an account:

```powershell
& 'C:\Program Files\nodejs\node.exe' .\companion\host.cjs --check
```

The check writes its result to stderr, checks the running Node version, and does not read credentials, register a host, sign in or call OpenAI.

## What is stored and where

The installation's `data` directory contains non-secret host/registration metadata (`registration.json`) and, on Windows when available, `tokens.dpapi`. The latter contains **DPAPI CurrentUser ciphertext**, bound to this Windows user and this companion. Token material enters the PowerShell DPAPI helper through stdin, never command-line arguments. No token is exposed to the extension. Temporary credential files contain ciphertext only and are atomically renamed.

If DPAPI is unavailable, the status reports `storage: "memory-only"` with a warning. Credentials exist only for that native-port connection, so closing the browser/port requires another sign-in. This implementation also uses explicit memory-only storage on macOS/Linux; Keychain/Secret Service support has not been implemented, and there is no plaintext fallback.

The Windows installer protects the installation and its normally inherited data-folder ACL. Native messaging authenticates the allowed extension origin, not arbitrary processes already running as the same OS user. Malware or another process acting as that user is outside this security boundary. Keep the installed code, configuration and Node executable trusted.

One profile stores one ChatGPT user/workspace registration. Its issued client ID and stable opaque host ID survive signout, so routine sign-in reuses the same registration. To switch to another account/workspace, sign out and use a separate installation/profile; an in-panel multi-account picker is not implemented. Never distribute `data`, personal credentials, or registrations as part of the companion package.

Signout attempts revocation, then clears local tokens even if the network fails; the panel receives an explicit warning if remote revocation is unconfirmed. Disconnect **Canvas Harness** in ChatGPT Settings to revoke it there. Usage shares the account's applicable plan limits, and app-specific permissions/limits can reject a request. There is no alternate-billing fallback.

## Boundaries and failure behavior

- Only an exact installed extension origin can launch the host. The service worker should own one shared native port and validate its own callers. An origin argument check is defense in depth; it does not authenticate a local OS process pretending to be the browser.
- OAuth listens only on a randomly allocated `127.0.0.1` port at `/auth/callback`, for at most 5 minutes. PKCE S256, state, nonce, the issued client ID, issuer, audience, expiry, signature and plan scopes are validated. ID tokens accept RS256 and ES256 with compatible published JWKS keys; unexpected algorithms or endpoint changes fail closed.
- Tokens remain local to the companion. The only outbound network destinations are fixed OpenAI authentication/API origins. Redirects are refused. The host exposes no arbitrary fetch, path, command, code execution or tool dispatch operation.
- The complete input history is explicitly supplied by the extension for each request. `store:false` is an API option, not a promise about all provider retention. This route does not import ChatGPT history, saved memories or website conversations.
- Text-only Responses requests use `store:false`, `stream:true`, no tools, no additional-tool inputs, and no automatic retries. Only `response.completed` with a completed status succeeds. Truncation, cancellation, rate limits and partial answers remain distinguishable failures. Cancellation does not undo usage already incurred.
- A single foreground operation and a single native host per profile prevent rotating-refresh-token races. Requests are bounded by byte length, count and time. Unknown fields, tool injection and invalid frames are rejected. Sanitized diagnostics exclude raw provider bodies, prompts, tokens and OAuth URLs.
- Native stdout is reserved for framed JSON. The installer preview has normal human-readable stdout; it is not the native host.

## macOS/Linux

The runtime supports Node.js 22+ and the system browser (`/usr/bin/open` or `/usr/bin/xdg-open`) with **memory-only credentials**. The included installer is Windows-only. For an advanced manual setup, create a dedicated private installation, an executable launcher that calls the absolute Node path with `host.cjs --config /absolute/host-config.json "$@"`, and a browser native-host manifest named `org.flzsh.canvas_harness_ai.json`. Use `type: "stdio"`, the absolute launcher path, and exact `allowed_origins` entries. The config must contain:

```json
{
  "host": "org.flzsh.canvas_harness_ai",
  "protocol": 1,
  "allowedOrigins": ["chrome-extension://YOUR_ACTUAL_EXTENSION_ID/"],
  "dataDir": "/absolute/installation/data",
  "storageMode": "memory-only"
}
```

`dataDir` must be the `data` subdirectory beside the config file. Put the native-host manifest in the browser's documented per-user NativeMessagingHosts directory. The uppercase placeholder above is intentionally invalid; replace it with your actual ID. Manual browser installation on these platforms has not been tested here.

## Troubleshooting and removal

- **Host not found:** install with the actual browser extension ID and absolute Node path; check that the installed folder still exists, then reconnect the extension.
- **HOST_BUSY:** close other Canvas Harness native connections. A forced process termination can leave `data/runtime.lock`. After closing the browser and confirming the recorded process is no longer running, remove only that stale lock and reconnect. The host never guesses that a lock is stale or deletes another live process's lock.
- **Sign-in but no plan permission:** explicitly repeat consent through the panel (`authenticate` with `reauthorize:true`). Identity sign-in alone does not authorize inference.
- **Rate limit or model restriction:** inspect ChatGPT Settings → Usage, refresh the model list, and respect account/workspace policy. No silent retries or billing changes occur.
- **Storage warning:** session-only sign-in is available. Windows DPAPI/PowerShell failures never cause plaintext-token persistence. Disconnect the app in ChatGPT Settings if a previous encrypted credential cannot be decrypted and remote revocation cannot be confirmed.
- **Uninstall:** sign out, close the companion port/browser, remove only the `org.flzsh.canvas_harness_ai` registry subkey from `HKCU\Software\Google\Chrome\NativeMessagingHosts` and `HKCU\Software\Microsoft\Edge\NativeMessagingHosts`, then remove the dedicated installation directory. No uninstall or registry operations run automatically from chat.

## Verification

From the repository root, run `node --test --test-isolation=none tests/ai-companion.test.cjs`. The suite uses synthetic tokens, locally generated signing keys, mocked provider responses and a loopback callback. It never starts real authentication or inference and never runs the installer. Native process tests use temporary private fixtures with memory-only storage. Loopback/process tests need an environment that permits localhost sockets and child processes.

Official references, checked 2026-10-09:

- [Open-source ChatGPT plan usage](https://developers.openai.com/siwc/token-sharing-open-source)
- [Registration and sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)
- [Accounts, refresh and revocation](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions)
- [Token reference](https://developers.openai.com/siwc/token-sharing-open-source/token-reference)
- [Models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)
- [Preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)
- [Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
