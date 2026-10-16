import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test, { after, before } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let vite;
let OnboardingProfilePicturePicker;

before(async () => {
  const frontendRoot = fileURLToPath(new URL("../../", import.meta.url));
  vite = await createServer({
    configFile: fileURLToPath(new URL("../../vite.config.js", import.meta.url)),
    root: frontendRoot,
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
    logLevel: "error",
  });
  ({ default: OnboardingProfilePicturePicker } = await vite.ssrLoadModule(
    "/src/components/OnboardingProfilePicturePicker.jsx",
  ));
});

after(async () => {
  await vite?.close();
});

const renderPicker = (props) =>
  renderToStaticMarkup(
    createElement(OnboardingProfilePicturePicker, {
      name: "Learner Name",
      userId: "user-1",
      onSelect() {},
      onRemove() {},
      ...props,
    }),
  );

test("shows an accessible optional image picker and existing picture preview", () => {
  const markup = renderPicker({ src: "https://cdn.example.test/current.png" });
  assert.match(markup, /Profile picture/);
  assert.match(markup, /\(optional\)/);
  assert.match(markup, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(markup, /Choose a profile picture from your device/);
  assert.match(markup, /https:\/\/cdn.example.test\/current.png/);
  assert.match(markup, /Change photo/);
  assert.match(markup, /Remove photo/);
});

test("shows a fallback with no image and displays upload progress/errors", () => {
  const emptyMarkup = renderPicker({ src: "" });
  assert.match(emptyMarkup, /Choose photo/);
  assert.match(emptyMarkup, /aria-label="Profile picture preview"/);
  assert.doesNotMatch(emptyMarkup, /Remove photo/);

  const pendingMarkup = renderPicker({
    src: "blob:profile-preview",
    hasSelectedFile: true,
    isUploading: true,
    uploadProgress: 38,
    error: "Upload failed. Retry.",
  });
  assert.match(pendingMarkup, /blob:profile-preview/);
  assert.match(pendingMarkup, /38%/);
  assert.match(pendingMarkup, /role="alert"/);
  assert.match(pendingMarkup, /Upload failed\. Retry\./);
  assert.match(pendingMarkup, /Remove selection/);
});
