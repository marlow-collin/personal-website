# Date Invitations – Future Expansion Notes

## Status

This file documents intentionally deferred ideas for the Date Invitations Secret Site and its admin area.

These items are **not part of Admin V1** and must not be implemented merely because they are listed here. The current live invitation behavior and design remain the reference until a future planning step explicitly changes them.

## Direction for a later expansion

A future version should allow each invitation to be configured more individually instead of relying mainly on today's fixed activity flow and a small set of invitation-level options.

Potential areas to plan later include:

- defining the available activities/undertakings individually per invitation;
- setting the wording/content for those activities per invitation;
- controlling the order and availability of activities;
- allowing more invitation-specific texts for individual steps and states;
- adding further appearance/configuration options where they provide a real benefit;
- preserving the existing individual preview/open flow for each invitation.

The exact feature set, data model and editing UX must be designed when this expansion is actually started.

## Preparation in the Admin V1 architecture

Admin V1 should avoid assumptions that make the future expansion unnecessarily difficult:

- keep Date Invitations in its own backend module instead of embedding its application logic in the global Worker entry point;
- keep the Date admin capable of growing beyond one large fixed form;
- allow future logical sections such as general settings, activities/content and appearance without showing empty placeholder sections today;
- do not redesign the live invitation pages as part of the Admin V1 work;
- do not add unused database fields or speculative configuration structures before the future feature is planned.

## Explicitly out of scope for Admin V1

- configurable activity builder;
- arbitrary per-step page builder;
- new invitation themes solely for this future expansion;
- database migration for future activity configuration;
- changes to the current recipient-facing invitation design or interaction flow.
