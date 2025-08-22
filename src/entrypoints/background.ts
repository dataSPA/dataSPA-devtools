export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id });
  browser.storage.session.setAccessLevel({
    accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS",
  });
});
