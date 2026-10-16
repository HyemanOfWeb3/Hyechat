import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_PROFILE_PICTURE_SIZE,
  inspectProfilePictureFile,
  validateProfilePictureFile,
} from "./profilePicture.js";
import {
  buildOnboardingPayload,
  uploadOnboardingProfilePicture,
} from "./onboarding.js";

const restoreGlobal = (key, descriptor) => {
  if (descriptor) Object.defineProperty(globalThis, key, descriptor);
  else delete globalThis[key];
};

test("accepts JPEG, PNG, and WebP up to the 5 MB limit", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    assert.equal(
      validateProfilePictureFile({ type, size: MAX_PROFILE_PICTURE_SIZE }),
      "",
    );
  }
});

test("rejects empty, unsupported, and oversized profile pictures", () => {
  assert.match(validateProfilePictureFile(null), /non-empty/);
  assert.match(
    validateProfilePictureFile({ type: "image/svg+xml", size: 100 }),
    /JPG, PNG, or WebP/,
  );
  assert.match(
    validateProfilePictureFile({
      type: "image/jpeg",
      size: MAX_PROFILE_PICTURE_SIZE + 1,
    }),
    /5 MB or smaller/,
  );
});

test("inspects image decodability and releases bitmap resources", async (context) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "createImageBitmap");
  context.after(() => restoreGlobal("createImageBitmap", original));
  let closed = false;
  globalThis.createImageBitmap = async () => ({
    width: 24,
    height: 24,
    close: () => { closed = true; },
  });

  assert.equal(await inspectProfilePictureFile({}), "");
  assert.equal(closed, true);

  globalThis.createImageBitmap = async () => {
    throw new Error("decode failed");
  };
  assert.match(await inspectProfilePictureFile({}), /corrupt or could not be read/);
});

test("onboarding omits an unchanged optional picture and only clears on intent", () => {
  const values = { fullName: "Learner", bio: "About me" };
  const noPicture = buildOnboardingPayload(values);
  assert.deepEqual(noPicture, values);
  assert.equal(Object.hasOwn(noPicture, "profilePic"), false);

  assert.equal(
    buildOnboardingPayload(values, {
      profilePic: " https://cdn.example.test/photo.png ",
    }).profilePic,
    "https://cdn.example.test/photo.png",
  );
  assert.equal(
    buildOnboardingPayload(values, { removePicture: true }).profilePic,
    "",
  );
  assert.deepEqual(values, { fullName: "Learner", bio: "About me" });
});

test("uses the authenticated Stream client, returns its image URL, and reports progress", async () => {
  const file = { name: "profile.jpg", type: "image/jpeg" };
  let uploadedArgs;
  const progressValues = [];
  const streamClient = {
    userID: "user-1",
    uploadFile: async (...args) => {
      uploadedArgs = args;
      args[4].onUploadProgress({ loaded: 4, total: 10 });
      return { file: "https://cdn.stream-io-cdn.com/users/profile.jpg" };
    },
  };

  const url = await uploadOnboardingProfilePicture({
    file,
    streamClient,
    userId: "user-1",
    onProgress: (value) => progressValues.push(value),
  });

  assert.equal(url, "https://cdn.stream-io-cdn.com/users/profile.jpg");
  assert.deepEqual(uploadedArgs.slice(0, 4), [file, "profile.jpg", "image/jpeg", undefined]);
  assert.deepEqual(progressValues, [40]);
});

test("refuses an unconnected or mismatched Stream user and missing upload URLs", async () => {
  let uploadCalls = 0;
  const file = { name: "profile.jpg", type: "image/jpeg" };
  await assert.rejects(
    uploadOnboardingProfilePicture({
      file,
      userId: "user-1",
      streamClient: { userID: "another-user", uploadFile: async () => { uploadCalls += 1; } },
    }),
    /Secure photo upload is not ready/,
  );
  assert.equal(uploadCalls, 0);

  await assert.rejects(
    uploadOnboardingProfilePicture({
      file,
      userId: "user-1",
      streamClient: { userID: "user-1", uploadFile: async () => ({}) },
    }),
    /did not return an image URL/,
  );
});
