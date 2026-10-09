# Canvas Harness local AI protocol (v1)

Native host: `org.flzsh.canvas_harness_ai`. Use one long-lived `chrome.runtime.connectNative` port from the extension service worker. No external runtime dependencies; Node.js 22 or newer. Only the extension IDs explicitly supplied to the installer may connect. Host stdout contains native-messaging frames only (4-byte unsigned little-endian UTF-8 byte length, then one JSON object). Maximum inbound frame: 262144 bytes. Maximum outbound frame: 65536 bytes. Malformed framing closes the port.

Every request has a unique `id` (1–80 characters, ASCII letters/digits/underscore/hyphen) and `op`. Do not reuse IDs during a port connection. Unknown fields are rejected, including tools, URLs, tokens, paths and API request overrides. Errors are terminal for that request: `{id,type:"error",code,message,...}`. Replies never contain tokens, authentication callback URLs or raw provider response bodies.

| Request | Replies |
| --- | --- |
| `{id,op:"status"}` | `{id,type:"status",protocol:1,host,authorized,verified,account,storage,planUsageEnabled,busy}` |
| `{id,op:"authenticate"}` | `{id,type:"auth",state:"opening_browser"}` then terminal `{id,type:"auth",state:"authorized",...statusFields}` or error. May include `reauthorize:true` to repeat consent for missing plan permission. |
| `{id,op:"models"}` | `{id,type:"models",models:[{id,name}],verified:false}` or error. Catalog visibility is not proof of inference access. |
| `{id,op:"chat",model,messages:[{role:"user"\|"assistant",content:string}]}` | Zero or more `{id,type:"delta",text}` followed by `{id,type:"done",reason:"completed",verified:true}` only after a successful `response.completed`; otherwise error. |
| `{id,op:"cancel",targetId}` | `{id,type:"done",reason:"cancelled",targetId,cancelled:boolean}`. The target emits terminal `error` with code `CANCELLED` if still active. Cancellation does not undo provider usage. |
| `{id,op:"signout"}` | `{id,type:"auth",state:"signed_out",authorized:false,verified:false,remoteRevoked:boolean}`; failed remote revocation adds `warning`. Cancels active auth/chat before clearing credentials. |

`account` is null or `{label:string}` (validated email when available, otherwise a neutral label). `storage` is `windows-dpapi` or `memory-only`; memory-only sign-in expires when the port/process ends and no plaintext credentials are written. `authorized` means a validated token set is present, not that inference works. `verified` becomes true only after completed inference in this process, resets on sign-in/signout and admission failures. `busy` is null or `authenticate`, `chat`, `models`, `signout`. Status does not contact OpenAI or launch a browser. No automatic authentication, context capture or inference occurs.

One foreground operation is allowed at a time. Status and cancel remain available. Signout interrupts the active operation and waits for it to stop; another signout/authentication cannot race token rotation. A second native host process for the same profile fails with `HOST_BUSY`; keep one service-worker port and multiplex requests. Reconnect after an actual disconnect; do not blindly replay chat/authenticate.

Chat accepts 1–80 messages, at most 196608 UTF-8 bytes per message and 196608 bytes total; at least one user message, with a user message last. Model IDs are 1–160 safe ASCII identifier characters. Total streamed text is limited to 1048576 bytes. The host constructs the complete API body itself with `store:false`, `stream:true` and no tools. Supply only context explicitly selected by the user. Partial text on error is incomplete; never mark it as an answer that finished successfully. Chat is never automatically retried.

Useful error codes: `INVALID_REQUEST`, `DUPLICATE_ID`, `BUSY`, `HOST_BUSY`, `AUTH_REQUIRED`, `PLAN_PERMISSION_REQUIRED`, `AUTH_DENIED`, `AUTH_INVALID`, `AUTH_TIMEOUT`, `CANCELLED`, `RATE_LIMITED`, `NOT_ELIGIBLE`, `FORBIDDEN`, `UNAVAILABLE`, `MODEL_UNAVAILABLE`, `STREAM_INCOMPLETE`, `STREAM_FAILED`, `TOOL_RESPONSE_REJECTED`, `LIMIT_EXCEEDED`, `NETWORK`, `STORAGE`, `INTERNAL`. Provider errors may include sanitized `httpStatus`, `providerCode`, `requestId`, `retryAfterSeconds` and `bodyShape`. Render messages as text. `RATE_LIMITED` may link to `https://chatgpt.com/settings/usage`; no reset time is inferred. Show error actions without silently changing billing, model or retrying a prompt.

Browser disconnection aborts work and ends the process. Browser-held account cookies are never read. The companion owns dynamic-agent registration, loopback OAuth, token validation/refresh and protected storage; the extension owns context preview, conversation history and rendering. No shell, MCP, Codex or other agent tools are exposed to the model.
