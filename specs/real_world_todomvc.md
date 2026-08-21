# TodoMVC VanillaJS — Acceptance Verification Suite

## Step 1: Create Todo Item
Type "Automate web app with KaneFlow" into the todo input box with placeholder "What needs to be done?".
Press Enter.
Assert that the todo list item "Automate web app with KaneFlow" is visible.

## Step 2: Complete Todo Item
Click the checkbox toggle next to "Automate web app with KaneFlow".
Assert that the completed count or clear completed button is displayed.
Assert that the todo item is marked completed.

## Step 3: Filter Active Items
Click the "Active" filter link.
Assert that the completed task is hidden from the active view.
Assert that the items left counter displays "0 items left".
