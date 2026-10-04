# Bakery notebook

The admin notebook opens **Cake Items** first, followed by **Baking Instructions**
and **Other**. Every category has its own page list. Give pages a title, add pages,
or use **Move page to** to organize an existing page.

## Existing notes

- The original `shopNotepad/pages` path and page keys are retained.
- Pages without a category display under Cake Items. Opening the notebook does
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

## Helpers

- Shopping checklist: add an item/quantity and check it as bought. It sits beside
  existing free-text notes; old notes are not parsed or replaced.
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
