# Interactive lesson pilot

Entry: `/aulas/piloto-binario`, linked from Today, Trail and Practice (including the old guided URL). This is a separate authored pilot, not a silent migration of generated courses.

## Teaching contract

One objective: compose and interpret unsigned binary values using positional weights. Six alternating hands-on activities, including one guided exploration and five checks. Templates: weighted switches, prediction choices, matching and actual ordering (tap to insert/remove; no drag dependency). Switches expose a running sum only during exploration; independent challenges reveal it after submission. Feedback responds to the misconception where known. Two contextual hints per help reason remain inside the step. No chat, arbitrary HTML, keyword heuristics or model calls in this pilot.

`AuthoredLesson` separates activity configuration, expected answer, feedback and help. `publicLesson` strips solution keys/hints from initial client props. Only server actions evaluate submissions. Content generation for other courses is deliberately unchanged until this authored pattern has been tested with a learner. Future generation should emit/validate this contract against source material; changing a prompt alone is not sufficient.

## Persistence and compatibility

Migration `0002` only adds `interactive_sessions`; no existing data is rewritten. Auth uses the existing single-account guard. Sessions are currently scoped to that same single admin account; add explicit user ownership with the planned multi-user authentication work, before opening registration.

Answers append to an immutable attempt history per step. First-attempt/no-hint accuracy is separate from assisted correction. Exploration is not counted as an independent check. Row locking and revision checks prevent double scoring and stale tabs overwriting newer progress. Completion and the existing `study_sessions` history entry are transactional and share a unique ID for idempotency. The pilot never changes topic mastery or creates a review schedule automatically.

Server checkpoints after responses, hints, retries and advancement survive refresh/devices under the existing account. Unsaved selections use an optional tab-local draft; storage failure does not block server persistence. Measured foreground seconds exclude hidden tabs and are capped by server time and at 120 seconds per event (long idle periods are intentionally not fully credited). This is a learning aid, not an exam/anti-cheating or precise time-tracking system.

Legacy lessons keep their current content and actions. `LessonRunner` dispatches the opt-in structured pilot and shares the focus/progress UI. The old tutor no longer silently drops blocks after the sixth card; it is not represented as having become interactive.

## Verification

`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.

Browser acceptance: start → toggle → wrong prediction → retry → contextual hint → answer → refresh → match → order → independent challenge → result → Practice → Progress. Check 320/360/390/430 px and desktop; keyboard focus, touch targets, no clipping, no bottom-nav in focus, light/dark theme, persisted result and first-attempt counts. Verify legacy lesson/tutor routes still open.

Next step after user feedback: refine the learning sequence from observed mistakes, then add source-backed generation of the structured contract. Do not auto-convert all historic lessons or add a new mastery algorithm in this pilot.
