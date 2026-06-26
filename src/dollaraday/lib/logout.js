import { getActiveDadProfile, setDadSessionId } from "./dadProfileStorage";
import { logProfileActivity } from "./profileActivity";
import { syncProfileToMemberRegistry } from "./profileRegistry";

export function logoutDollarADay() {
  const profile = getActiveDadProfile();
  if (profile) {
    logProfileActivity({
      profileId: profile.id,
      proId: profile.proId,
      type: "logout",
      summary: "Signed out of dashboard",
    });
    syncProfileToMemberRegistry(profile, { lastLogoutAt: new Date().toISOString() });
  }
  setDadSessionId(null);
  window.location.replace(new URL("./dollaraday.html", window.location.href).href);
}
