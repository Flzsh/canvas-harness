# Study with AI

Open **Tools → AI** on a signed-in Canvas page. The AI tool stays beside your coursework. Canvas Harness 2.21.0 uses AI providers' normal websites; you sign in directly on the provider site.

## Ask a question

Choose ChatGPT, Claude or Gemini, or find Grok, DeepSeek, Kimi, Qwen and Z.ai (GLM) under **More**.

1. Open **Open website / sign in** if you need to sign in to the provider. This opens a normal browser tab. Opening it alone sends no Canvas text.
2. In Canvas Harness, select the coursework you want to share using the small selection circles beside assignments or materials. An assignment you opened is selected by default. You can also ask a question with no Canvas material selected.
3. Type your question. Press **Review text to share** to see the material that will be added, including any missing or shortened parts.
4. Click **Send** (or press **Enter** in the question box). On first use, your browser may ask for optional scripting and website access limited to that provider. If a separate permission page appears, allow access, return to Canvas, and click Send again.
5. The selected text and your question are inserted into the provider's chat draft. Review it and submit it there. If you turn on **Send automatically after inserting**, Canvas Harness also tries to submit the newly inserted message.

**Enter** submits your question from the Canvas Harness composer; **Shift + Enter** adds a new line. Automatic website submission is off by default. It can fail if the provider changes its chat editor or the message would combine with existing draft text. Check the provider page before trying again; uncertain sends are not retried automatically.

**Clicking Send transfers the prepared text into the provider website's draft.** The provider site may receive that text before you submit the chat. Its own privacy terms and account settings apply. Use **Copy** to paste manually if insertion fails or you prefer not to grant website permission.

## What can be shared

- Opening an assignment selects its instructions. From Home or other views, select individual assignments, teacher home pages, announcements, course pages or files. **Load materials** loads the available list for a chosen course.
- **Include this assignment's linked pages & small files** gathers same-course links from the opened assignment, up to two levels deep and 30 sources. **Include attached assignment PDFs** is on by default for selected assignments; you can turn it off.
- **Review text to share** shows the gathered text and warnings. If anything is missing or cut short, you must review and explicitly accept the available text before sending.
- Text from small PDFs is extracted locally. You can add a PDF from your device with **+ PDF**. Each PDF is limited to 2 MiB, 20 pages and 60,000 characters of extracted text. The combined context is limited to 100,000 characters, and your question to 20,000 characters. These are text extracts, not binary PDF uploads to the AI website.
- Scanned PDFs may contain no extractable text. Password-protected, broken, blocked or oversized documents may fail. If Canvas won't provide a file directly, download it from Canvas and attach a small PDF yourself.
- Plain-text files can also be read. External Google/Microsoft documents and arbitrary web links are not fetched. Scripts, forms and embedded content in documents are not executed.

Canvas Harness selects instructional content, not grades, GPA calculations, submissions, your private plans or notes, account tokens, or course rosters. Teacher materials may still contain names or private details, so read the preview. Source URLs have query strings and fragments removed.

The question draft and extracted attached-PDF text are held in the open AI panel, not saved as a conversation or included in the Canvas Harness personal backup. Switching Canvas accounts or views resets the selected sources and attached PDFs while preserving your unsent question. Website chat history is controlled by the provider.

## Permissions

The extension reads Canvas through your signed-in school site: one on `*.instructure.com`, or your school's own Canvas address if you added it in the popup. Local PDF reading uses the browser's offscreen permission. Website insertion needs the optional `scripting` permission and the exact website origin you choose (for example, `https://chatgpt.com/*`). It does not require access to every website. You can revoke a provider's access from its permission page, if open, or your browser's extension site settings.

The extension does not request cookies, debugger, native-messaging, or all-sites permissions. There is no AI API key or separate AI account connection to set up. Clicking **Copy** needs no provider-site permission.

## If sending does not work

Finish signing in on the provider website, return to Canvas Harness, and try **Send** again. If the provider moved its chat field or your browser blocks insertion, use **Copy** and paste into the website. Permissions do not queue or repeat a failed send. Provider editors and school Canvas settings may change, so behavior needs a live check with your own account. The artificial preview never sends AI requests.

For local storage, third-party sites and data handling, see the [Privacy notice](PRIVACY.md).
