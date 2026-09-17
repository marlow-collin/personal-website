const PUBLIC_FIELDS = `
  token, first_name, personal_message, final_message, theme, status, no_attempts,
  activity, day_preference, time_preference, ride_preference,
  accepted_at, completed_at
`;

export async function getInvitation(env, token, publicOnly = false) {
  const fields = publicOnly ? PUBLIC_FIELDS : "*";
  return env.DB.prepare(`SELECT ${fields} FROM invitations WHERE token = ?`).bind(token).first();
}

export async function markInvitationOpened(env, token) {
  return env.DB.prepare(`
    UPDATE invitations
    SET opened_at = COALESCE(opened_at, CURRENT_TIMESTAMP),
        status = CASE WHEN status = 'created' THEN 'opened' ELSE status END
    WHERE token = ?
  `).bind(token).run();
}

export async function incrementNoAttempts(env, token) {
  return env.DB.prepare("UPDATE invitations SET no_attempts = no_attempts + 1 WHERE token = ?")
    .bind(token).run();
}

export async function acceptInvitation(env, token) {
  return env.DB.prepare(`
    UPDATE invitations
    SET accepted_at = COALESCE(accepted_at, CURRENT_TIMESTAMP),
        status = CASE WHEN status IN ('created','opened') THEN 'accepted' ELSE status END
    WHERE token = ?
  `).bind(token).run();
}

export async function setActivity(env, token, value) {
  return env.DB.prepare("UPDATE invitations SET activity = ? WHERE token = ?").bind(value, token).run();
}

export async function setDayPreference(env, token, value) {
  return env.DB.prepare("UPDATE invitations SET day_preference = ? WHERE token = ?").bind(value, token).run();
}

export async function setTimePreference(env, token, value) {
  return env.DB.prepare("UPDATE invitations SET time_preference = ? WHERE token = ?").bind(value, token).run();
}

export async function setRidePreference(env, token, value) {
  return env.DB.prepare("UPDATE invitations SET ride_preference = ? WHERE token = ?").bind(value, token).run();
}

export async function completeInvitation(env, token) {
  return env.DB.prepare(`
    UPDATE invitations
    SET completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
        status = 'completed'
    WHERE token = ?
  `).bind(token).run();
}

export async function claimNotification(env, token, claimId) {
  return env.DB.prepare(`
    UPDATE invitations
    SET notification_sent_at = ?
    WHERE token = ? AND notification_sent_at IS NULL
  `).bind(claimId, token).run();
}

export async function finishNotificationClaim(env, token, claimId) {
  return env.DB.prepare(`
    UPDATE invitations
    SET notification_sent_at = CURRENT_TIMESTAMP
    WHERE token = ? AND notification_sent_at = ?
  `).bind(token, claimId).run();
}

export async function releaseNotificationClaim(env, token, claimId) {
  return env.DB.prepare(`
    UPDATE invitations
    SET notification_sent_at = NULL
    WHERE token = ? AND notification_sent_at = ?
  `).bind(token, claimId).run();
}

export async function listInvitations(env) {
  const result = await env.DB.prepare(`
    SELECT token, first_name, internal_label, personal_message, final_message, theme, status,
           no_attempts, activity, day_preference, time_preference, ride_preference,
           created_at, opened_at, accepted_at, completed_at, notification_sent_at
    FROM invitations
    ORDER BY created_at DESC
  `).all();
  return result.results || [];
}

export async function insertInvitation(env, invitation) {
  return env.DB.prepare(`
    INSERT INTO invitations
      (token, first_name, internal_label, personal_message, final_message, theme, status)
    VALUES (?, ?, ?, ?, ?, ?, 'created')
  `).bind(
    invitation.token,
    invitation.firstName,
    invitation.internalLabel,
    invitation.personalMessage,
    invitation.finalMessage,
    invitation.theme
  ).run();
}

export async function resetInvitation(env, token) {
  return env.DB.prepare(`
    UPDATE invitations SET status='created', no_attempts=0, activity=NULL,
      day_preference=NULL, time_preference=NULL, ride_preference=NULL,
      opened_at=NULL, accepted_at=NULL, completed_at=NULL,
      notification_sent_at=NULL WHERE token=?
  `).bind(token).run();
}

export async function deleteInvitation(env, token) {
  return env.DB.prepare("DELETE FROM invitations WHERE token=?").bind(token).run();
}
