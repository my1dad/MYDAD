import { setDadSessionId } from "./dadProfileStorage";

export function logoutDollarADay() {
  setDadSessionId(null);
  window.location.replace(new URL("./dollaraday.html", window.location.href).href);
}
