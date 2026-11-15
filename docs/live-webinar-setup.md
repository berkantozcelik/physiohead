# PhysioHead Live: setup and webinar-day guide

This guide takes the live webinar section from preview mode to a real broadcast.
Part A is done once. Part B is the checklist for every webinar.

Until Part A is finished the pages run in **preview mode** with sample data that
only exists in your own browser. You can try everything safely:

- Audience page: `live.html?demo=1`
- Moderator desk: `live-moderator.html?demo=1` (any email, password `demo`)
- Speaker view: `live-speaker.html?demo=1`

Menu names in Zoom, YouTube and Firebase change from time to time. If a label
below is slightly different on your screen, look for the closest match.

---

## Part A: one-time setup

### A1. Zoom: allow custom live streaming (needs a paid Zoom plan)

1. Sign in at zoom.us and open **Settings**.
2. Under **Meeting → In Meeting (Advanced)**, turn on **Allow livestreaming of meetings**.
3. Tick **Custom Live Streaming Service** and save.

Only speakers and moderators join Zoom, so the audience size does not count
against your Zoom plan.

### A2. YouTube: enable live streaming (free)

1. Open YouTube Studio with the PhysioHead channel and click **Create → Go live**.
2. The first time, YouTube asks you to verify the channel and then makes you
   **wait about 24 hours**. Do this well before the first webinar.

### A3. Firebase: create the project (this is the step with a card on file)

Firebase carries the questions, polls and chat. The video does not go through it.

1. Go to console.firebase.google.com and click **Add project**. Name it, for
   example, `physiohead-live`. Google Analytics is not needed.
2. **Build → Realtime Database → Create database.** Choose the location nearest
   your audience (Europe is a sensible choice) and start in **locked mode**.
3. **Build → Authentication → Get started → Sign-in method.** Enable
   **Anonymous** and **Email/Password**.
4. **Upgrade the plan to Blaze (pay as you go).** This is required: the free
   Spark plan allows only 100 people connected at once. Blaze still includes a
   free monthly allowance. **Check the current prices on firebase.google.com/pricing
   before you confirm**; the figures discussed during planning were estimates.
5. In the billing screen, **create a budget alert of 5 USD**. An alert only
   emails you; it does not switch anything off.

### A4. Publish the security rules

The rules decide who may do what (for example: only moderators approve
questions; one vote per person). Without them the database stays locked.

1. Open the file `firebase/database.rules.json` in this project and copy all of it.
2. In Firebase: **Realtime Database → Rules**. Replace everything there with
   what you copied and click **Publish**.

Do not edit `database.rules.json` by hand. It is generated from
`firebase/build-rules.mjs` and checked by automatic tests.

### A5. Connect the website to Firebase

1. In Firebase: **Project settings (gear icon) → General → Your apps → Web (`</>`)**.
   Register an app called `PhysioHead site`. Firebase Hosting is not needed.
2. Firebase shows a block starting with `const firebaseConfig = {`. Copy the
   values.
3. Open `assets/js/live/config.js` and replace `null` with those values, as shown
   in the example inside that file. Make sure `databaseURL` is included; if the
   block does not show it, copy it from the top of the Realtime Database page.
4. Publish the website as usual.

These values are not secret. They only identify the project; the rules from A4
are what protect the data.

### A6. Create the moderator accounts

1. **Authentication → Users → Add user.** Enter the moderator's email and a
   strong password. Repeat for each moderator.
2. Copy that user's **User UID** from the list.
3. **Realtime Database → Data.** Hover the top line, click **+**, and add:
   - Key: `moderators`
   - then inside it, key: *the User UID you copied*, value: `true`
4. Repeat step 2–3 for every moderator. To remove a moderator, delete their line.

Moderators can only be added here, never from the website.

### A7. Lock the project to your website

1. **Authentication → Settings → Authorized domains.** Add the domain your site
   is published on. Leave `localhost` if you want to keep testing on your computer.
2. In Google Cloud console (console.cloud.google.com), choose the same project,
   then **APIs & Services → Credentials → Browser key → Website restrictions**
   and add your site's address (for example `https://your-domain/*`). Add
   `http://localhost:8765/*` as well if you want to keep testing on your computer.

### A8. Test broadcast (do not skip)

Run a private rehearsal at least a few days before the first real webinar.
Two things can only be confirmed this way:

- that YouTube allows the PhysioHead channel to **embed a live stream** on your site;
- that the website talks to your real Firebase project.

Follow Part B with two or three colleagues. Check each of these:

- [ ] The video plays on `live.html` on a computer and on a phone.
- [ ] A question sent from a phone appears on the moderator desk.
- [ ] After approval it appears for everyone and on the speaker view.
- [ ] A poll can be launched and voted on.
- [ ] Chat works, and Pause chat stops it.
- [ ] Someone who is not a moderator cannot sign in to the moderator desk.

If the video refuses to play on your site but plays on YouTube, embedding is
blocked for the channel or the stream. Check **Allow embedding** on the stream
(B1). If it still fails, tell whoever maintains the site: the fallback is a
paid video relay, and the page was built so that swap is a small change.

---

## Part B: every webinar

### B1. Before the day

1. YouTube Studio → **Create → Go live → Stream** (or schedule a stream).
   - Visibility: **Unlisted**
   - Audience: **No, it's not made for kids** (otherwise embedding and chat features are restricted)
   - **Allow embedding**: on
2. Copy the stream's **watch link** (looks like `https://www.youtube.com/live/…` or
   `https://youtu.be/…`), plus the **Stream URL** and **Stream key**.
3. Open `live-moderator.html` on your site and sign in.
4. Under **Webinar**, fill in title, start time, speakers and description, paste
   the YouTube watch link, and click **Save details**. The audience page now shows
   a countdown, and the Activities page shows a "Next webinar" card.
5. Prepare polls under **Polls → New poll**. They stay hidden as drafts.
6. Send speakers the speaker view link: `live-speaker.html`.

Remember that "unlisted" is not private: anyone who has the YouTube link can
watch there.

### B2. Going live

1. Start the Zoom meeting or webinar.
2. In Zoom: **More → Live on Custom Live Streaming Service**. Paste the Stream
   URL, the Stream key and the YouTube watch link, then **Go Live**.
3. Wait until YouTube Studio shows the stream as live (usually under a minute).
4. On the moderator desk press **Go live**. Every open audience page switches
   from the countdown to the video.

The audience sees and hears everything **10–30 seconds after** it happens in
Zoom. Allow for that when you invite questions.

### B3. During the webinar

- **Questions:** new ones appear under *Waiting for you*. **Approve** shows a
  question to everyone; **Reject** removes it quietly. Approved questions are
  ordered by audience upvotes.
- **Passing questions to speakers:** read the top ones aloud in Zoom, paste them
  into Zoom chat, or have speakers keep the speaker view open.
- Click **Mark answered** once a question has been dealt with.
- **Polls:** click **Launch** on a draft. **Close** freezes the result.
- **Chat:** **Delete** removes a message. **Slow mode** limits how often each
  person can post. **Pause chat** stops it for everyone.
- **Connected now** (top of the desk) shows roughly how many browsers have the
  live, moderator or speaker pages open. Treat it as an estimate.

If the Q&A side ever fails, the video carries on and the audience sees
"Q&A is temporarily unavailable".

### B4. Ending

1. End the live stream in Zoom.
2. Press **End webinar** on the moderator desk. The page shows the replay (the
   same YouTube video) and Q&A, polls and chat become read-only.
3. To add the recording to the webinar library, copy the card in
   `activities.html` as its comment explains, using the same video ID.
4. When the replay no longer needs to be on the live page, press **Reset for
   next webinar**. Questions and polls are moved to an archive in Firebase
   (`archive` in the database); chat is deleted; the webinar details are cleared
   and the live page shows "No live webinar is planned" until you set up the next one.

---

## Good to know

- **Names are self-declared.** Anyone with the link can watch and take part
  under the name they type. Moderation is the safeguard.
- **Votes are honest-audience counts, not secure ballots.** "One vote per person"
  really means one per browser. Someone determined could vote again from a
  private window. Use upvotes and polls as a guide, not as a formal vote.
- **Personal data.** Names, professions, questions and chat messages are stored
  in your Firebase project. Consider mentioning this in the site's terms.
- **Costs.** YouTube: free. Zoom: your existing paid plan. Firebase: pay as you
  go, expected to stay within or near the free allowance for text; watch the
  budget alert after the first webinar to see your real figure.
- **Preview mode stays available** at any time by adding `?demo=1` to a page address.
- **For developers.** `npm test` runs the logic tests; `npm run test:rules` and
  `npm run test:firebase` run the security-rule and Firebase tests on the local
  emulator (needs Node and Java).
