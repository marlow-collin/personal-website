# Personal Check-ins – Future Expansion Notes

## Status

`/x/und-wie-wars/` is currently the first concrete Check-in implementation. It should not yet be treated as the final definition of a generic Check-in system.

Admin V1 should manage the existing functionality while preparing the architecture to address Check-ins by their `slug`. A generic Check-in builder is intentionally deferred.

## Long-term direction

A later version should make it possible to create and manage additional Check-in pages through the Check-ins admin area.

A future planning step should evaluate configurable properties such as:

- internal name and public title;
- slug / public URL;
- introductory/question text;
- buttons or answer options;
- ordering of answer options;
- texts shown after a selected answer;
- optional emphasis/supporting text belonging to an answer result;
- recipient-related settings;
- notification/mail behavior;
- other behavior that proves useful after further Check-in use cases exist.

The exact schema must be derived from real future Check-in requirements instead of turning the current first implementation into a premature universal page builder.

## Likely conceptual separation

A future data model may need to distinguish between:

1. **Check-in definition** – identity, texts, settings and behavior.
2. **Answer/options definition** – selectable options and their result content.
3. **Events/responses** – the historical interaction data that already belongs to the operational side of a Check-in.

This is a planning direction only, not a final schema.

## Preparation in Admin V1

Admin V1 should:

- provide a Check-ins overview rather than hard-coding the admin UI exclusively to `und-wie-wars`;
- use the existing Check-in `slug` as the administrative identifier where appropriate;
- allow multiple existing Check-ins to be listed later without redesigning the whole admin area;
- keep the current recipient-facing `/x/und-wie-wars/` design unchanged;
- avoid showing a `New Check-in` action until the generic content/configuration model has been planned.

## Explicitly out of scope for Admin V1

- `New Check-in` builder;
- generic page-layout editor;
- arbitrary component/page builder;
- speculative schema migration for configurable buttons/texts;
- redesign of `/x/und-wie-wars/`.
