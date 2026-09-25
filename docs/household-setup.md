# Household setup: adding a second person

This is the manual part of letting a second person use FeedMe. The code change is already done. What's left is settings in Google and Vercel that only you can change.

Once it's done:

- Only the emails you list can sign in. Anyone else gets an "Access denied" page. (Before this change, any Google account could sign in.)
- You both see and edit the same pantry, recipes, meal plan and shopping list.
- "Push to calendar" goes to a shared **FeedMe meals** calendar that you both see, and either of you can push.

Allow about 15 minutes.

---

## ⚠️ Do the steps in this order

**Set the Vercel variables (step 3) before merging the pull request.** The new code refuses every sign-in until `HOUSEHOLD_EMAILS` is set. If you merge first, you'll be locked out until you add it and redeploy.

If you do end up locked out, add the variable and redeploy (step 3). Nothing is lost. Your data is untouched.

---

## Step 1: Let her through Google's sign-in

Google lets an app in "Testing" mode sign in only the accounts you've listed.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and pick the FeedMe project (top-left dropdown).
2. Open **APIs & Services → OAuth consent screen**. Newer versions of the console call this **Google Auth Platform → Audience**.
3. Look at **Publishing status**.
   - **Testing:** under **Test users**, click **Add users**, enter her Google email and save.
   - **In production:** nothing to do here.

If you skip this, she'll see Google's own "Access blocked: FeedMe has not completed the Google verification process" page. It's Google blocking her, not FeedMe.

## Step 2: Create the shared calendar

Do this from a computer. The Google Calendar phone app can't create or share calendars.

1. Open [calendar.google.com](https://calendar.google.com) signed in as you.
2. In the left sidebar, next to **Other calendars**, click **+ → Create new calendar**.
3. Name it **FeedMe meals**. Leave the time zone as London. Click **Create calendar**.
4. In the left sidebar, find **FeedMe meals** under **My calendars**, hover, click **⋮ → Settings and sharing**.
5. Under **Share with specific people or groups**, click **Add people and groups**, enter her email, set permission to **Make changes to events**, click **Send**.
   - "Make changes to events" is required. With "See all event details" she can see meals but pushing from her account fails.
6. Still in settings, scroll to **Integrate calendar** and copy the **Calendar ID**. It looks like `abc123...@group.calendar.google.com`. You need it in step 3.

She'll get an email invite. She should click the link in it to add the calendar to her Google Calendar.

**Showing or hiding it:** each of you can tick or untick **FeedMe meals** in the Google Calendar sidebar. Unticking hides it for that person only.

## Step 3: Add the settings in Vercel

1. Go to [vercel.com](https://vercel.com) → the **feedme** project → **Settings → Environment Variables**.
2. Add `HOUSEHOLD_EMAILS`:
   - Value: `ben.flowers91@gmail.com,<her email>`
   - **Your email must be first.** All existing data is stored under the first email. If hers is first, you'll both see an empty app. Nothing is deleted, but it looks that way until you swap them back.
   - Commas between emails. Spaces and capitals don't matter.
   - Environments: tick **Production** (and **Preview** if you ever use preview links).
3. Add `HOUSEHOLD_CALENDAR_ID`:
   - Value: the Calendar ID from step 2.
   - Same environments.
4. Save both.

Vercel doesn't apply new variables to a deploy that's already running. If you set them before merging, the merge's deploy picks them up. If you set them after, go to **Deployments**, open the latest production one, **⋮ → Redeploy**.

## Step 4: Merge and deploy

Merge the pull request on GitHub. Vercel deploys `main` automatically. Wait for the deployment to show **Ready**.

## Step 5: Her first sign-in

1. She opens FeedMe and signs in with Google.
2. Google shows a consent screen that asks for calendar access. **She must tick the calendar box.** Without it, pushing to the calendar fails for her with a "sign out and back in" message. Everything else works.
3. She should see your pantry, recipes, plan and shopping list.

If she already has FeedMe on her phone's home screen from before, she should close and reopen it once.

## Step 6: Clear out old calendar events (optional)

Meals you pushed before this change are in your **main** calendar, not FeedMe meals. The app doesn't touch them.

1. In Google Calendar, search for `Planned in FeedMe`. Every pushed event has that in its description.
2. Delete the ones you don't want.
3. On the Plan page, push the current week again. It'll land in FeedMe meals.

---

## Checklist: did it work?

- [ ] You sign in and see your usual pantry and plan.
- [ ] She signs in and sees **the same** pantry and plan.
- [ ] Add a pantry item on one phone, refresh on the other, and it's there.
- [ ] Push a week to the calendar. The meals appear in **FeedMe meals** for both of you.
- [ ] She pushes the same week again. No duplicates appear.
- [ ] Optional: a Google account that isn't on the list gets "Access denied".

---

## Troubleshooting

| What you see | Likely cause | Fix |
|---|---|---|
| "Access denied" on FeedMe's sign-in page | That email isn't in `HOUSEHOLD_EMAILS`, or the variable isn't set yet | Check the spelling in Vercel, then redeploy |
| Everyone gets "Access denied" | `HOUSEHOLD_EMAILS` missing, or the deploy predates it | Add it, then **Redeploy** |
| "Access blocked … has not completed the Google verification process" | She isn't a test user in Google Cloud | Step 1 |
| You both see an empty app | Her email is first in `HOUSEHOLD_EMAILS` | Put yours first, redeploy |
| Calendar push error mentioning 403 or 404 | Calendar not shared with her, shared as view-only, or wrong Calendar ID | Step 2 (permission must be "Make changes to events"), then check the ID in Vercel |
| Calendar push says "sign out and back in" | She didn't tick calendar access at sign-in | Sign out of FeedMe, sign back in, tick the calendar box |
| Meals still go to your main calendar | `HOUSEHOLD_CALENDAR_ID` not set, or not redeployed since | Step 3, then redeploy |
| Both tick items on the shopping list at the same time and one tick seems lost | Last write wins. There's no live sync between phones | Refresh the page |
