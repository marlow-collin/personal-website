export const ADMIN_MODULES = Object.freeze([
  Object.freeze({
    id: "daily",
    label: "Daily Content",
    description: "Content health and daily rotation management",
    manageUrl: "/x/admin2/",
    siteUrl: "/x/daily/"
  }),
  Object.freeze({
    id: "conversation",
    label: "Conversation Roulette",
    description: "Question library and content health",
    manageUrl: "/x/admin4/",
    siteUrl: "/x/conversation/"
  }),
  Object.freeze({
    id: "date",
    label: "Date Invitations",
    description: "Private invitation management",
    manageUrl: "/x/admin/date/",
    siteUrl: null,
    quickActions: Object.freeze([
      Object.freeze({ label: "New Invitation", href: "/x/admin/date/?new=1" })
    ])
  }),
  Object.freeze({
    id: "checkins",
    label: "Personal Check-ins",
    description: "Responses, recipient and notification settings",
    manageUrl: "/x/admin/checkins/",
    siteUrl: "/x/und-wie-wars/"
  }),
  Object.freeze({
    id: "decide",
    label: "Decide",
    description: "Client-side · No configuration required",
    manageUrl: null,
    siteUrl: "/x/decide/"
  }),
  Object.freeze({
    id: "poker",
    label: "Poker Companion",
    description: "Client-side · No configuration required",
    manageUrl: null,
    siteUrl: "/x/poker/"
  })
]);

export function getAdminModule(id) {
  return ADMIN_MODULES.find((module) => module.id === id) || null;
}
