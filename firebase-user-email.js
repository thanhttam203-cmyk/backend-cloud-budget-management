
const { getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

async function getUserEmail(uid) {
  if (typeof uid !== "string" || !uid.trim()) {
    throw new Error("UID khong hop le");
  }

  if (!getApps().length) {
    initializeApp();
  }

  const user = await getAuth().getUser(uid);

  if (user.disabled || !user.email || !user.emailVerified) {
    return null;
  }

  return user.email;
}

module.exports = { getUserEmail };
