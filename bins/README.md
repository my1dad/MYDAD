# Over Drive OS — Local Workspace Bins

This folder is the on-disk home for everything you create in the app.

When you run the dev server, data is saved here automatically. When you package the app as a Mac `.dmg`, the installed app writes to:

`~/Library/Application Support/Over Drive OS/bins/`

## Layout

| Folder / file | Stores |
|---|---|
| `projects/project-bin.json` | All projects, phases, and project metadata |
| `tasks/tasks.json` | Standalone and linked tasks |
| `calendar/events.json` | Calendar events |
| `team/members.json` | Team members |
| `files/file-bin.json` | File manager index (metadata) |
| `files/attachments/` | Uploaded attachment files (images, PDFs, etc.) |
| `dreamboard/items.json` | Dreamboard items |
| `settings/workspace.json` | Workspace settings (tags, preferences) |
| `settings/migration.json` | Internal migration marker |
| `drafts/onboarding.json` | In-progress project onboarding draft |

JSON bins hold structured data. Large files live in `files/attachments/` so projects and tasks stay fast to load.

## Notes

- `.gitkeep` files preserve the folder structure in git; your actual workspace data is ignored by git.
- Back up this entire `bins/` folder to move your workspace to another machine.
- Do not edit JSON files while the app is open unless you know what you are doing.
