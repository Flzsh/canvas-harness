# Study with AI

Open **Tools → AI**. The dock stays beside Canvas, so you can read instructions and use the tools together.

## Use your provider's website

Choose ChatGPT, Claude or Gemini, or find Grok, DeepSeek, Kimi, Qwen and Z.ai (GLM) under **More**.

1. Choose **Alongside → Open website** and sign in on the provider's own page. The website opens in a separate window or tab because these services do not generally permit embedding.
2. Write your question there, or in CH's optional prompt field.
3. Review **Context**, then choose **Inject context**. On first use, CH opens a permission page where you can allow draft insertion for that provider only. Return to Canvas and click Inject again.
4. Review the combined draft on the provider website and send it yourself.

Insertion preserves the existing draft and never presses Send. It works only in a recognized, unambiguous composer in a window CH opened for this Canvas tab. If a provider changes its editor, login is incomplete, or browser policy blocks insertion, use **Copy** and paste manually. Permission approval never queues or automatically retries an insertion.

**Injecting shares the selected text with the provider website immediately**, before you press its Send button. The provider's account terms and data controls apply. Opening the website alone does not send Canvas context.

## Chat inside the dock

**Connected chat** currently supports the official [Sign in with ChatGPT for open-source/local apps](https://developers.openai.com/siwc/token-sharing-open-source) flow. It requires the optional [local companion](https://github.com/Flzsh/canvas-harness/blob/main/companion/README.md). A Windows installer is included; setup is an explicit local action using the actual installed extension ID.

The companion registers this installation as Canvas Harness, handles consent and token refresh locally, and uses eligible ChatGPT plan usage through OpenAI's public API. Account eligibility, available models and usage limits are determined by OpenAI. A successful sign-in is not a guarantee that inference is available. CH lists the models actually returned for the signed-in account and shows access errors.

After setup, choose **Connected chat → Sign in with ChatGPT**, complete the official consent flow, select a model and write your question. **Send** automatically attaches the selected context. **Stop** cancels an active response; incomplete answers remain marked incomplete. Requests are never automatically retried. **Clear chat** removes the in-memory conversation.

Claude, Gemini and the other providers use Alongside. CH does not borrow client IDs, reuse another app's credentials, collect passwords or extract subscription tokens from provider websites.

## Choose the context

- An assignment explicitly opened in CH, or a native Canvas assignment page, starts with that assignment's instructions selected.
- Home and other views start with nothing selected. Choose individual assignments, teacher home pages, announcements, course pages or files. **Load materials** reads the chosen course's available material list.
- **Include assignment's linked materials** gathers that assignment and its same-course page/file links, to a depth of two and at most 30 sources. It does not collect every course.
- **Preview selected text** shows the text, its sources and anything missing or shortened. Context is gathered again immediately before sharing. A changed page or Canvas account invalidates the collection.
- Small text PDFs and plain-text files can be read locally. PDFs are limited to 2 MiB, 20 pages and 60,000 characters each. Total Canvas context is limited to 100,000 characters; conversation transport also has a byte limit.
- Scanned PDFs have no text to extract; there is no OCR. Password-protected, malformed, oversized or blocked documents are reported. If Canvas redirects a file to an external download service, download it in Canvas and use **Attach PDF**.
- External Google/Microsoft documents and arbitrary web links are not crawled. No document scripts, PDF forms or attachments execute during extraction.

CH selects instructional fields, not grades, submissions, private planner notes, account tokens or a course roster. Course document text may itself contain personal information, so review it before sharing. Source URLs have query strings and fragments removed.

Prompts and responses live in an extension-origin frame, separate from the Canvas page. They remain in memory and are not included in CH backups. Reloading clears the conversation and attached PDFs. Switching Canvas scope clears the previous conversation and PDFs while retaining the unsent prompt. The local companion keeps tokens out of the page; on Windows it uses protected storage, with an explicit memory-only fallback if protected storage is unavailable.

## Permissions

The normal Canvas dashboard remains read-only on the current school's instructure.com origin. The extension adds local offscreen processing for PDFs. AI website insertion asks for optional scripting access and the chosen provider's exact origin; each permission page also offers removal. Connected chat separately asks for optional native messaging access.

No cookies permission, debugger access, arbitrary-site host access or externally connectable extension endpoint is used. The companion cannot run model tools, shell commands or Canvas changes. It submits text-only inference requests with store disabled; this flag does not replace the provider's retention policy.

## Verification limits

Automated tests cover local selection, account and origin boundaries, bounded PDF extraction, draft insertion, OAuth validation and stream handling. The artificial preview makes no AI requests. An account's consent flow, inference eligibility and each signed-in provider's current editor still require a live check by that account's user.
