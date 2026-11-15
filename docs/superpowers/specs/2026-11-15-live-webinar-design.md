# PhysioHead Live Webinars: design

Date: 15 November 2026. Status: awaiting approval.

## What this is and why

PhysioHead runs webinars in Zoom. Today the audience has to be in Zoom too, and the
recording only reaches the website afterwards. The SIG wants the audience on
physiohead itself: watching the live broadcast there and taking part through Q&A,
polls and chat, in PhysioHead's own look. Speakers and moderators keep working in
Zoom exactly as they do now.

Expected audience: 800–900 people watching at once.

## Goals

- A live page on the site that plays the Zoom broadcast and carries Q&A, polls and chat.
- Questions are moderated before the audience or the speakers see them.
- Moderators run everything from a page on the site, with no code edits on webinar day.
- It looks and feels like the rest of PhysioHead (navy, teal, Cormorant Garamond headings).
- Running cost stays at or near zero.
- If the interactive part ever fails, the video keeps playing.

## Not in this version

- Attendance certificates.
- Downloadable resources and slides tab.
- Individual attendee accounts or registration.
- More than one webinar live at the same time.
- Presenting from the website (speakers stay in Zoom).
- A React or Tailwind rewrite. The site stays plain HTML, CSS and JavaScript.

## What would make it a failure

- The audience is sent to YouTube or Zoom to take part.
- An unmoderated question or an abusive chat message can't be removed quickly.
- A surprise bill, or the webinar dying mid-session because a free limit was hit.
- The page looks like a bolted-on third-party widget.

## Approaches considered

| Approach | Trade-off | Outcome |
|---|---|---|
| Zoom embedded in the page (Zoom Meeting SDK) | Audience is inside the Zoom session, so size is capped by the Zoom licence (about 100 on Pro) and needs a signing server | Rejected: does not fit 800–900 people |
| Paid streaming relay (Mux, Cloudflare Stream) with own player | Unbranded player, but costs money per viewer-hour | Rejected for now: cost. Kept as a one-setting swap for later |
| **Zoom → unlisted YouTube stream → player on physiohead, with Q&A, polls and chat on Firebase** | Small YouTube logo on the player; 10–30 s delay; Firebase needs a card on file | **Chosen by Berkant** |
| Own Q&A server on Cloudflare's free plan instead of Firebase | Guaranteed free, but daily limits make open chat risky | Considered, Berkant chose Firebase |
| Everything on Supabase free tier | About 200 simultaneous connections | Rejected: too small |

## How it works on webinar day

1. A moderator creates an unlisted live stream on the PhysioHead YouTube channel and
   pastes its stream key into Zoom's "Live on Custom Live Streaming Service".
2. On the moderator page they paste the YouTube video ID, check the title and start
   time, and press **Go live**. The live page switches from countdown to player for everyone.
3. The audience watches on `live.html`, enters a name and profession once, and takes part.
4. Moderators approve questions and read the top ones out in Zoom (or paste them into
   Zoom chat). Speakers can keep the speaker view open on a second screen.
5. A moderator presses **End webinar**. The page switches to "Watch the replay", which
   plays the same YouTube video, and Q&A, polls and chat become read-only.

## The pages

### Live page (`live.html`, public)

Desktop: two columns. Left about 68%: status bar (LIVE badge or countdown, webinar
title), the 16:9 player on a dark surround, then the title, date, speakers and
description. Right about 32%: a fixed-height panel with three tabs, **Q&A**, **Polls**,
**Chat**. Q&A is the default tab.

Mobile: the player sticks to the top of the screen; the tabbed panel fills the rest.

States:

- **Scheduled:** countdown to the start time, "The webinar will start shortly" once it passes.
- **Live:** player plus full interaction.
- **Ended:** replay plus read-only Q&A and poll results.
- **No webinar planned:** a short note and a link to the webinar library.
- **Interaction unavailable:** video keeps playing; the panel shows "Q&A is temporarily unavailable".

Taking part:

- Watching needs nothing. To post, a person enters name and profession once (kept in
  that browser). Shown as, for example, "Dr. Ayşe Demir · Physiotherapist".
- **Q&A:** submit a question (300 characters max). The author sees it marked "Awaiting
  moderator" and nobody else does. Approved questions appear for everyone, sorted by
  upvotes, one upvote per person. Answered questions move to an "Answered" group.
- **Polls:** when a moderator launches a poll it appears with a dot on the tab. One vote
  per person; after voting (or when the poll closes) percentage bars are shown.
- **Chat:** newest messages at the bottom, last 100 loaded. Slow mode and lock are
  controlled by moderators. 300 characters max. Emoji work through the device keyboard;
  there is no custom emoji picker.

### Moderator page (`live-moderator.html`)

Sign-in with an email and password. Only accounts on the moderator list get through,
and this is enforced by the database, not just by the page.

- **Webinar setup:** title, date and time, speakers, description, YouTube video ID.
  Buttons: Go live, End webinar, Reset for next webinar (archives the old Q&A and chat).
- **Question queue:** pending questions with Approve and Reject; approved ones with
  Mark answered and Remove.
- **Chat control:** delete any message, set slow mode (off, 10 s, 30 s, 60 s), lock chat.
- **Polls:** create a poll with 2–6 options, launch it, close it, see results.
- **People connected now:** a count, shown to moderators only.

### Speaker view (`live-speaker.html`)

Large-type list of approved, unanswered questions, most upvoted first, plus the active
poll result. Read-only, no sign-in, nothing to click.

### Entry points

- The Webinars tab on the Activities page gets a card at the top: "Live now" or
  "Next webinar: date", linking to the live page. Hidden when nothing is planned.
- No new item in the main navigation.

## Behind the pages

- **Video:** YouTube privacy-enhanced embed, the same way the Activities page already
  plays webinars. The video source sits behind one small function so a different
  relay can replace it later.
- **Data:** Firebase Realtime Database on the pay-as-you-go plan, with a $5 budget alert.
  Chosen over Firestore because it bills by data volume, not per message delivered,
  which suits 900 people receiving the same chat.
- **Identity:** each audience browser signs in anonymously, which gives it a stable
  hidden ID. That ID is what enforces one vote per person and chat slow mode.
- **Moderators:** email and password accounts Berkant creates in the Firebase console,
  plus a moderator list in the database.
- **Rules enforced by the database itself:** only moderators change webinar settings,
  approve or delete; pending questions are readable only by their author and
  moderators; one upvote and one poll vote per person; length limits; slow mode and lock.
- **Code:** plain JavaScript modules, Firebase loaded from Google's CDN, no build step.
  New styles in their own stylesheet using the site's existing colour and type tokens.
- **Preview mode:** `live.html?demo=1` runs everything inside the browser with sample
  data and no Firebase, so the pages can be seen and tested before the Firebase project
  exists. Several tabs on one computer talk to each other in this mode.

## What Berkant has to do (cannot be done for him)

1. Confirm the Zoom account is on a paid plan with custom live streaming enabled.
2. Enable live streaming on the PhysioHead YouTube channel (first time takes about 24 hours).
3. Create a Firebase project, switch it to pay-as-you-go, set the budget alert, and
   paste the project's settings into one config file. A step-by-step guide will be written.
4. Create the moderator accounts.
5. Run one private test broadcast before the first real webinar.

## Calls made by Claude, open to correction

- The live page is public; anyone with the link can watch and take part.
- Names are self-declared, not verified.
- One webinar at a time; "Reset" clears the room for the next one.
- Viewer count is shown to moderators only, to keep traffic low.
- Speaker view has no password, since it only shows questions the audience already sees.
- Interface text is in English, like the rest of the site.
- Q&A is the default tab, ahead of chat.

## Known risks

- **Embedding the live stream:** not yet confirmed that the PhysioHead channel may
  embed a live stream on another site. The test broadcast settles this. If it fails,
  the fallback is the paid relay.
- **Unlisted is not private:** anyone with the YouTube link can watch there.
- **Firebase side is untested until the project exists.** The database rules will be
  tested locally with Firebase's emulator; the real connection is checked during the
  test broadcast.
- **Pricing and limits** quoted in discussion were from memory and need checking at sign-up.

## Left to the builder

File layout, database paths, exact wording, animation details, and how the old room
is archived on reset.
