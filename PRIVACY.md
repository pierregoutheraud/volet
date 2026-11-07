# Volet privacy policy

Effective November 7, 2026.

Volet is a Chrome extension that shows your tabs in Chrome's side panel and sorts them into workspaces (Volets).
It runs entirely inside your browser. It has no server, no account, no analytics and no ads, and it never sends
anything to its developer or to anyone else.

## What Volet reads

To do its job, Volet reads, on your device only:

- **Your open tabs and tab groups**: their titles, addresses and icons, which tab is active, and when each tab was
  last used. This is what the sidebar shows, and how Volet knows which unused tabs to archive.
- **Your bookmarks**: Volet keeps your Volets, pinned tabs, folders and favorites as bookmarks in a folder named
  "Volet", and reads that folder to show them.
- **Page previews, only if you enable the recent tab switcher**: Volet captures the visible page after you visit a
  tab, and listens for shortcut modifier releases on websites. Previews are used only in the centered tab switcher.
- **An Arc sidebar file, only if you pick one** on the "Import from Arc" page. Volet reads it in the browser to
  import your Arc Spaces, and the file never leaves your computer.

When you search from Volet's palette, the search goes to your default search engine through Chrome, the same way as
a search typed in the address bar.

## Where it's kept

- **Bookmarks** (the "Volet" folder): your Volets, pins, folders and favorites.
- **Extension storage on your device**: archived tabs (title, address, Volet name, date), which folders are open,
  the titles Volet gave to pins, the preview-only close shortcut, and the content of an imported Arc sidebar.
- **Temporary storage**: which tab belongs to which pin and Volet, cleared when Chrome quits.
- **Temporary tab switcher data**: the five most recently visited or opened tab ids per window in session storage, plus up to
  ten page screenshots in service worker memory. Screenshots are never synced or written to disk by Volet, and are
  cleared when the worker stops or tab switching is disabled. Incognito pages are not captured.
- **Synced extension storage**: your Volets' colors and Volet's settings.

If you turned on Chrome Sync, Chrome copies your bookmarks and Volet's synced storage to your other computers through
your Google account. That is Chrome's own feature, covered by Google's privacy policy; Volet doesn't run or see it.

## What Volet never does

- It never sends your data anywhere: no server, no tracking, no analytics, no third parties.
- It never sells or shares your data, and never uses it for anything but the features above.
- It never loads or runs code from the internet.

## Removing your data

Removing Volet from Chrome deletes everything in its extension storage. Your bookmarks stay, including the "Volet"
folder, so nothing you pinned is lost; delete that folder in Chrome's bookmarks manager if you no longer want it.
Archived tabs can also be cleared from Volet's settings.

## Contact

Questions or concerns: open an issue at <https://github.com/pierregoutheraud/volet/issues>.
If this policy changes, the new version will be posted here with a new effective date.
