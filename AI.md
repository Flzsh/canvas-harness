# Study with AI

Canvas Harness 4.0 Preview 1 adds **Your AI**. It reads your Canvas the way the rest of Canvas Harness does, writes a message for an AI, and turns the reply into Help cards, a Today list and study aids on your page. Canvas Harness has no AI of its own and no server. The answer comes from an AI you choose, reached in one of three ways:

- **Web AI** (the default): the AI's own website, in a browser tab where you are signed in. ChatGPT, Claude and Gemini are listed first; Grok, DeepSeek, Kimi, Qwen and Z.ai (GLM) are under **More**.
- **API**: your own API key for Anthropic, OpenAI, Google or an OpenAI-compatible service. The provider bills you for each request.
- **Overnight**: Canvas Harness writes the message as a file in a folder you pick, and an AI tool that you run yourself writes its answer into the same folder.

Choose the way in **Tools → AI → ··· → Way**. Your AI is part of the Full preset, which is the default, and is left out of Lite. Its main switch, **Your AI**, is in the same ··· menu and starts **on**. **Prepare every day**, beside it, starts **off**, also for anyone who used an earlier preview: until you turn it on, Your AI sends nothing unless you press one of its buttons.

## What it makes

- **Help cards** in the Help band on Home. **Daily AI help** asks for today's help now. **Help with this** on an assignment, or **Help with…** on the band for up to three assignments, asks about those items. A card can be a practice test, a reading breakdown, translation help, worked examples or an explanation. On a card, **Ask** asks a follow-up, **More** adds questions or problems, **Check my work** sends the work you type for checking, **Remember** saves a note that goes with later requests, **Paste** adds text you copied (for example from a linked Google Doc), and **Done** archives the card.
- **Prepare** reads your courses and picks what to help with. Daily AI help uses it, and so does the automatic daily run if you choose **Every day**.
- **Ask your AI** in **Tools → AI** asks about your coming days. Its answer can set **Today** on Home (one to four items) and make other changes to Canvas Harness's own data; see [What your AI can change](#what-your-ai-can-change).
- **Study aids**: practice set, reading guide, lab checklist, rubric checklist, fix list, notes outline, steps, writing outline, draft message, summary and flashcards, saved beside their assignment.

## When something is sent

The first time the Help band shows on Home, it asks once whether Daily AI help may run on its own, in one sentence that says what is sent and how often, with two choices: **Every day** or **Only when I ask**. Until you choose, and after **Only when I ask**, Prepare runs only when you press **Daily AI help**. You can change it later with **Prepare every day** in **Tools → AI → ···**.

| You do | What happens | Sent without another click? |
| --- | --- | --- |
| Open Canvas after choosing **Every day** (**Prepare every day** on) | Prepare checks Canvas on the first visit of the day, and again when your assignments, files, announcements, Inbox or calendar change, up to **Daily cap** runs a day (3 unless you change it; 0 stops automatic runs). | Yes, once the way is ready (below) |
| Open Canvas without choosing **Every day** | Nothing is sent. | Nothing is sent |
| **Daily AI help** | A Prepare run now. It runs even when the daily cap is reached, and it counts toward the cap. | Yes |
| **Help with this**, **Help with…**, or **Ask**, **More** or **Check my work** on a card | A run about that item or card: one or more requests. | Yes |
| **Ask your AI** in Tools → AI | One run about your coming days. It can take a few rounds. | Yes |
| **Send** in Tools → AI for a study aid, a PDF's pages or a question from Biscuit | Web AI: the text is put in the website's chat box. API: it is sent with your key. | Web AI: no, unless **Send automatically** is on. API: yes |
| **Prepare now** with the Overnight way | Today's prep file is written to your folder. | Written to the folder |

"Ready" means: for Web AI, you have already allowed Canvas Harness on that AI website; for API, you saved a key and allowed that API address; for Overnight, you chose a folder and allowed it. Until then, the Prepare scan stays on this device and the Help band says what is missing, for example **Allow access to your AI website**. After that, if you chose **Every day**, the automatic run sends on its own each day. Allowing a website once, for example to send one question, does not turn it on. To stop it, choose **Only when I ask** (turn **Prepare every day** off), turn **Your AI** off, or set **Daily cap** to 0.

Your AI does not run on a quiz-taking page. Changing any Your AI setting, **Show grades** or **Teacher feedback** stops a run that is in progress. **Stop** in Tools → AI stops one too.

## Web AI, step by step

1. In **Tools → AI**, choose the website. **Open website / sign in** opens it in a normal tab. Opening it sends nothing.
2. Press **Send** in Tools → AI once with that website. Your browser asks to allow Canvas Harness on that one site. Prepare, Help cards and Ask your AI wait until it is allowed; they do not ask on their own. They use the website picked in Tools → AI, which is ChatGPT until you pick another.
3. For Prepare and Help cards, Canvas Harness opens the site in a background tab beside Canvas, starts a new chat for each request, puts the message in the chat box, presses the site's Send button and waits for the reply. On ChatGPT these are temporary chats and on Claude incognito chats, which those sites keep out of your chat history; the other sites use normal chats. **Ask your AI** does the same in the website tab Canvas Harness opened from this Canvas tab (or a new one), brings that tab to the front, and uses a normal chat.
4. It reads the reply from the page. For Prepare and Help cards on ChatGPT and Claude, it can also read the reply from the site's own record of that chat, using your signed-in session, so it finds the answer while the tab sleeps. To find a new ChatGPT chat whose address the tab has not shown yet, it lists your six newest chats (their names and times, not their messages) and reads only the one created when its message was sent. On Claude it looks up your account's organizations to reach the chat it started. It keeps only the reply that follows its own message and does not open your other chats. Your session token is used for these reads and not saved.
5. If the site needs you (a sign-in, a dialog, an error, or text already in the chat box), Canvas Harness stops and the Help band shows a button such as **Open chat** or **Review draft**. A message that may already have been sent is never sent again automatically. **Try again** starts a fresh chat.

With **Send** in Tools → AI, the text goes into the chat box and you check it and submit it there. **Send automatically** (off by default) also presses the site's Send button. **Bring answers back** (on by default) lets Canvas Harness read the reply back into the panel. The website receives the text as soon as it is in its chat box, even before you submit. **Copy** puts the prepared text on your clipboard instead and needs no website access.

## API key, step by step

1. **Tools → AI → ··· → Way → API**.
2. Choose the **Provider**: Anthropic, OpenAI, Google, or OpenAI-compatible. For OpenAI-compatible, enter its **HTTPS base address**.
3. Paste your **Key** and choose a **Model**. **Models** loads the provider's list with your key. For Anthropic the model starts as claude-opus-5-5.
4. Set the **Daily limit**: 20 requests a day unless you change it, from 0 to 100,000.
5. Choose **Save**. Your browser asks to allow Canvas Harness on that API address only: `api.anthropic.com`, `api.openai.com`, `generativelanguage.googleapis.com`, or the address you entered.

**Where the key is kept.** In the extension's own database on this device, separately for each Canvas site and account, provider and address. Canvas pages never receive it. Only the extension's background worker reads it, and only to put it in the request header for that provider; requests send no cookies and do not follow redirects. Canvas Harness shows the key's last four characters. The key is not in personal backups and is never sent to the developer. **Remove key** deletes the key for the chosen provider.

**Costs.** Canvas Harness charges nothing; the provider bills your account under its own prices. Each request asks for an answer of up to 16,000 output tokens. **Estimate** shows about how many tokens your message is: for Anthropic it asks Anthropic's token-counting service, which receives the message; for the others it divides the number of characters by four. The **Daily limit** counts answer requests per Canvas account per calendar day. Estimates, model lists and the one automatic retry after a busy or rate-limited reply do not count. A Prepare run makes several requests: one to choose what to help with, then one for each item it helps with, plus one check for translation help. If a request may have reached the provider but its answer was lost, Canvas Harness does not send it again; it asks you.

**Photos.** With API, **Add a photo** sends up to six photos (PNG, JPEG, WebP or GIF, up to 8 MiB each) with the message, if the model accepts images. With Web AI, Canvas Harness only reminds you to attach the photo yourself on the website.

OpenAI requests ask OpenAI not to store the response. What each provider keeps is governed by its own terms.

## Overnight, step by step

1. **Tools → AI → ··· → Way → Overnight**. **Choose folder** opens a Canvas Harness page where your browser's folder picker asks for read and write access to one folder.
2. Browsers can drop that access, for example after a restart. **Allow the prep folder** asks again; Canvas Harness asks at most once a day.
3. Optionally type the folder's path on that page. It is used only to fill in a one-line instruction that you can **Copy** into your own AI tool's daily schedule.
4. **Prepare now** writes `prep-YYYY-MM-DD.json`. For each assignment due within the next two days that is not done or locked, it holds the kind of study aid, the course name, the assignment name, the due date and the full study message: the assignment's instructions and attached PDF text, plus teacher feedback when that switch is on. Your tool writes `prep-YYYY-MM-DD.answers.json`; Canvas Harness reads it the next time you press **Prepare now** and saves the answers as study aids.
5. **Ask your AI** writes `agent-YYYY-MM-DD.json`, and so does a Canvas visit if you chose **Every day**, under the same rules and daily cap as the automatic Prepare run. It holds the same message that Ask your AI sends (below). Your tool writes `agent-YYYY-MM-DD.actions.json`; Canvas Harness reads it on a later Canvas visit and applies the changes, each with Undo. Follow-up rounds add `-1`, `-2` and so on to the file names.

Canvas Harness never deletes these files and never uploads them; they stay in your folder until you remove them. What your own tool does with them is up to that tool. No browser alarm or background schedule is used for Overnight.

## What is shared

### Prepare, Help cards and card questions

The **Canvas brief**, built on this device, up to 24,000 characters:

- your course names, shortened;
- work that is overdue and not handed in, and work due in the next three weeks: name, course, due date, points possible, how it is handed in, and Canvas's missing or late mark;
- the instructions (up to 1,500 characters each) for work due in the next seven days;
- announcements from the last ten days (up to 600 characters each) and course calendar events in the next 14 days;
- Canvas Inbox conversations with activity in the last seven days whose newest message is by a teacher or TA of that course, as Canvas lists the course's staff: the subject and the start (up to 300 characters) of that message, with classmates' names in the conversation replaced by `[classmate]`. A conversation whose newest message is by a classmate, by you, or by someone Canvas Harness cannot show to be course staff is left out;
- the names of recent files and pages in courses with work due soon;
- with **Teacher feedback** on: the latest comment by a teacher or TA on your submission (up to 400 characters) for assignments due from two weeks ago onward. Your own comments are never included.

Before the brief leaves, lines that look like login details (a password, username or access code) are replaced, email addresses are removed and web addresses lose their query strings. The brief contains no scores or grades.

For each item it helps with, Canvas Harness adds the teacher's instructions, up to four files or pages attached to the item, the course home page or syllabus, course files the AI asks for from a list of up to 40 titles, text you pasted, and on GitHub installs the Google Docs the item links (below). Your instructions for Prepare go with each request, and Remember notes go with later requests for the same item or kind of card (or every request, if saved for all). A question adds your words (up to 2,000 characters), the item's name and instructions, and the card you asked about. PDF text is extracted on this device; files are not uploaded as files. In these materials, classmates' names that appear in Canvas data are replaced with `[classmate]`, and score-like text is removed unless both **Show grades** and **Let the AI see my grades** are on.

**Google Docs.** On GitHub (unpacked) installs, **Read** on a card asks your browser for access to `docs.google.com`; with it, Canvas Harness reads the text of up to three Google Docs an assignment links, using your Google sign-in. Chrome Web Store installs never ask; paste the text on the card instead.

### Ask your AI and the Overnight agent file

A snapshot of your coming days: your courses (name, term, late policy); upcoming assignments with their instructions (up to 2,000 characters), rubric, points, whether they are handed in, and, with **Teacher feedback** on, comments by a teacher or TA on your submissions (up to eight per assignment; never your own); what changed since the last run; course calendar events; Inbox messages from the course's teachers or TAs in the last 14 days (a classmate's message is never sent); your planner, finished work and bookmarks; your notes (up to 6,000 characters); a summary of your focus timer; your Home layout; your AI's memory; your recent study aids, including practice questions you missed; and your answers to its questions. Score-like text is removed unless both **Show grades** and **Let the AI see my grades** are on; with both on, your course grades are added too. The AI can ask Canvas Harness to read up to six more items a round, for up to four rounds.

### Send in Tools → AI

What you choose with the selection circles. An opened assignment starts selected. **Include this assignment's linked pages & small files** adds same-course links from it, up to 30 sources in all. **Include attached assignment PDFs** is on by default. **Add a PDF** reads a PDF from your device. Each PDF is limited to 2 MiB, 20 pages and 60,000 characters of extracted text, and the material to 500,000 characters by default; your question to 20,000 characters. **Review text to share** shows exactly what goes, including anything missing or shortened, and you must accept missing or shortened text before sending. With **Teacher feedback** on, the teacher's comments on a selected assignment can be added. With **Show grades** off, score-like text is removed, even from your own question.

The question draft and extracted PDF text stay in the open panel. They are not saved as a conversation or put in a personal backup.

## What your AI can change

Only Canvas Harness's own data on this device: the Today list, planner blocks, bookmarks, a note added to your notes, reminders from Biscuit, which Home modules show and in what order, up to three AI modules on Home, highlights in a course PDF, study aids, review dates, its memory (up to 30 facts), and one multiple-choice question for you per run. It cannot write to Canvas: no submissions, posts, messages or grade changes. Every change is listed under **What your AI did** in Tools → AI, with **Undo** and **Undo all**. **Memory** lists what it remembers, each with **Delete**. Prepare and Help with this save cards only.

## Switches

In **Tools → AI → ···**:

- **Your AI** (on): Prepare, Help cards and Ask your AI. Off stops runs, and these send nothing. **Send** for a study aid, a PDF's pages or a Biscuit question still works.
- **Prepare every day** (off): lets Prepare run on its own when you open Canvas, as in the table above. The Help band's **Every day** and **Only when I ask** set the same switch.
- **Let the AI see my grades** (off): needs **Show grades** on in the workspace as well.
- **Daily cap** (3): Prepare runs a day before automatic runs stop, 0 to 20. Daily AI help still runs past it; questions and Help with this are not counted.
- **Your instructions for Prepare** (up to 600 characters): sent with every Prepare and Help request.
- **Teacher feedback** (off), **Send automatically** (off), **Bring answers back** (on) and **Level** (high school).

## Turn it off

- Choose **Only when I ask**, or turn **Prepare every day** off. Nothing runs on its own; the buttons still work.
- Switch **Your AI** off. Nothing runs and Help cards stop.
- Set **Daily cap** to 0 to keep only the requests you click.
- In the popup's **Features**, turn off **Your AI & study aids**, or choose Lite. Its code is not loaded after you reload Canvas.
- Remove a website's or API address's access in your browser's extension site settings. Without it, nothing is sent there. Use **Remove key** to delete an API key.
- For Overnight, change **Way** back to Web AI or API, or turn **Your AI** off; no more files are written. Files already in the folder stay until you delete them.

## What stays on this device

- Your Canvas session. Canvas is read with GET requests from your open Canvas page; Inbox messages are read without marking them read.
- API keys, except in requests to their own provider.
- GPA calculations and what-if grades. Scores and grades too, unless the grade switches described above are on.
- Classmates' discussion posts. Discussions add only the teacher's posts and your own.
- Your submitted files and text, PDF annotations, files in My links & files, artwork, and personal backups.

## Saved on this device

- **Help cards and study aids**, per Canvas site and account: each day's Help cards are kept, back to 30 days before your newest card; other saved aids keep the newest 40. If the record grows past about 900 KB, the oldest go first. Your instructions and Remember notes (the latest 40) are kept with them. These are not in personal backups.
- **Run records** in the extension's database: a run's messages and replies are removed about ten minutes after it finishes; the day's Canvas brief is kept so a later question can reuse it; finished runs are deleted after 14 days. A run that is waiting for you keeps its messages until it finishes, is replaced by a newer run or is stopped.
- **Your AI's history**, in your account's Canvas Harness data: your settings, the runs of the last 14 days with the snapshot text each used and what it changed, Today, memory and questions. These are included in personal backups, so keep backups private.
- **API settings**: provider, address, model, daily limit, the key's last four characters and today's request count. The key itself is in the extension's database. None of these are in backups.
- **Overnight**: the folder access, the path you typed and a record of the files written and read. Not in backups.
- **Browser session storage**: which tab holds the AI chat. It holds no message text and is cleared when the browser closes.

Removing the extension generally removes all of these. Files in your Overnight folder and exported backups stay where they are.

## Permissions

Your AI asks for website and API access one site at a time, when you first use it: the eight AI websites listed above, the three API addresses, and for an OpenAI-compatible service the one HTTPS address you enter. It keeps one browser **alarm**, a minute ahead, only while a run is unfinished, so the run can continue if the browser pauses the extension's background worker; the alarm is cleared when no run is unfinished and never starts a new run. An unfinished run also continues when the browser starts again; it waits for an open Canvas page before reading Canvas.

## If sending does not work

Finish signing in on the website, then press the button the Help band shows. If the website moved its chat box or your browser blocks insertion, use **Copy** and paste the text yourself. A reply that is not in the expected form can be pasted into Tools → AI and read with **Read it**. Websites, providers and school Canvas settings change, so check results with your own account. The artificial preview never contacts an AI.

For local storage, third-party sites and data handling, see the [Privacy notice](PRIVACY.md).
