# Collaborative Kanban

A shared product board for tracking tasks from to-do through completion, with live presence and Socket.IO updates.

## Features

- Create, edit, and delete tasks with assignee, due date, priority, description, and labels.
- Move tasks between columns with drag-and-drop or the task editor.
- Search, filter, sort, and switch between board and list views.
- Live workspace presence and synchronized board updates.
- Atomic JSON file writes for local task persistence.
- Responsive layout, keyboard-accessible task editing, and `/` to focus search.

## Run

```powershell
cd .\collaborative-kanban
npm install
npm run dev
```

Open the Vite URL printed in the terminal. Run `npm test` for the two-client persistence/realtime integration test and `npm run build` for a production build.

## Notes

The demo has no authentication or per-board authorization. Its JSON data file is ignored by Git and stored under `server/data/`; the file system must be persistent if deployed. Add authentication, access controls, and a managed database before using it with private or important data.