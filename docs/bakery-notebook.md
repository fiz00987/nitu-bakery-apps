# Bakery notebook

The admin notebook opens the original **Basic notebook** first: a simple shopping
notepad with page switching, photos, and free text. The **Advanced notebook** tab
opens the current workspace, which starts on **Baking Items**, followed by
**Baking Instructions** and **Other**. Only one notebook surface is shown at a
time. Every advanced category has its own page list. Give pages a title, add
pages, or use **Move page to** to organize an existing page.

## Existing notes

- The original `shopNotepad/pages` path and page keys are retained.
- Pages without a category display under Baking Items. The visible category name is
  Baking Items, while the existing stored category value remains `cake`; opening the notebook does
  not rewrite, reorder, delete, or automatically classify their text or photos.
- `category`, `title`, and shopping `items` are additive page fields.
- Legacy single-string `shopNotepad/text` is displayed without a migration write.
  The first explicit edit/page addition imports it using a transaction only if
  the page collection is still empty.
- Edits transact against one page and retain unknown fields and photos. New
  pages are appended against the latest server snapshot, retaining all keys.
- Text/title conflicts preserve the cloud version and a user-scoped local draft.
  **Save draft as new page** retains both versions. Network failures can be retried.
- The legacy text mirror is updated only after a successful text edit.
- **Backup all notes** downloads pages, photos, extra fields, and local drafts.

## Baking items and expense totals

- The Baking Items page has one add row with **name**, **quantity**, and an
  optional total **price**. Press **＋** to save the row and add another; a page
  accepts at most 30 items even when their prices are still blank. For example:
  `Everwhip whipped cream · 4 piece · ৳2300`, then
  `Baking powder · 500 gram · [price pending]`.
- Entering a valid price shows a green **✓ Priced** mark beside that row and
  adds the price to the expense list. Pricing never removes or hides the row:
  rows remain until the admin removes one with its **×** control or uses
  **Remove all** for the current page.
- A newly entered price is dated automatically for the day it is saved, so the
  price is included in that month's dashboard total. Editing the price keeps
  its existing expense date.
- The dashboard's **Total Expense** card adds every dated Baking Items price
  once and shows the itemized monthly breakdown. A notepad
  `notepad-expenses-changed` event refreshes the totals without changing the
  existing event payload contract.
- **Additional Info** is an editable free-text box for snacks, vegetables, or
  other shop reminders that do not need a Baking Items row. Text in this box is
  not automatically treated as a priced expense; add a separate Baking Items
  row when a purchase should be included in Total Expense.

## Helpers

- Baking-item list: add a name, quantity, and optional price, then check an
  item as bought if useful. Existing free-text notes remain in Additional Info;
  old notes are not parsed or replaced.
- Calculator: addition, subtraction, multiplication, division, decimals,
  parentheses and Bengali digits. Results can be appended to a note.
- Recipe scaling: `ingredient quantity × target size ÷ original size`. Use the
  same size unit for the original and target; ingredient units are retained.
- Recipe outline: appends headings for ingredients, oven temperature, time,
  method and cooling/decorating to a Baking Instructions page.

The local sample preview is `_ui-demos/bakery-notebook-preview.html`. It uses
in-memory sample data and never initializes Firebase or touches cloud notes.

Run `npm test` for the DOM integration and calculator/data-preservation tests.
Deploy with `firebase deploy --only hosting:admin --project nitusbakingplanv2`.
