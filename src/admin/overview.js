function bindingState(value) {
  return value ? "configured" : "missing";
}

export function buildAdminOverviewFoundation(env) {
  return {
    ok: true,
    version: 1,
    status: "foundation-ready",
    system: {
      access: "authenticated",
      bindings: {
        assets: bindingState(env.ASSETS),
        dateDatabase: bindingState(env.DB),
        dailyDatabase: bindingState(env.DAILY_DB),
        checkinDatabase: bindingState(env.CHECKIN_DB),
        conversationDatabase: bindingState(env.CONVERSATION_DB)
      }
    }
  };
}
