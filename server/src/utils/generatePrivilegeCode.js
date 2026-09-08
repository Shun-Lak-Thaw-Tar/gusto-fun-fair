import crypto from "node:crypto";

export default function generatePrivilegeCode() {
  return `FF-PRIV-${crypto.randomBytes(24).toString("base64url")}`;
}
