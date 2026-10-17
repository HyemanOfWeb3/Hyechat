import assert from "node:assert/strict";
import test from "node:test";
import { CallingState } from "@stream-io/video-client";
import {
  activateCallMedia,
  buildCallUrl,
  createAndRingChatCall,
  getCallConnectionLabel,
  getCallChatId,
  getIncomingCallType,
  getCallJoinErrorMessage,
  joinStreamCall,
  leaveStreamCall,
} from "./callSession.js";

test("call URL preserves room, mode, and chat return context", () => {
  const url = new URL(
    buildCallUrl("https://hyechat.example", "room-1", "voice", "dm:one:two"),
  );
  assert.equal(url.pathname, "/call/room-1");
  assert.equal(url.searchParams.get("type"), "voice");
  assert.equal(url.searchParams.get("chatId"), "dm:one:two");
});

test("incoming calls recover chat context from call metadata and safely fall back when absent", () => {
  assert.equal(
    getCallChatId({ state: { custom: { hyechat_chat_id: "dm-1" } } }),
    "dm-1",
  );
  assert.equal(getCallChatId({ state: { custom: {} } }), "");
  assert.equal(getCallChatId(null), "");
});

test("incoming call mode reads Stream call custom/settings metadata with legacy fallback", () => {
  assert.equal(
    getIncomingCallType({ call: { custom: { hyechat_call_type: "voice" } } }),
    "voice",
  );
  assert.equal(
    getIncomingCallType({ call: { settings: { video: { enabled: false } } } }),
    "voice",
  );
  assert.equal(getIncomingCallType({ video: true }), "video");
});

test("outgoing voice and video calls create the expected default room and ring the chat peer", async () => {
  for (const callType of ["voice", "video"]) {
    let callArguments;
    let request;
    const call = {
      getOrCreate: async (value) => {
        request = value;
      },
    };
    const client = {
      call: (...args) => {
        callArguments = args;
        return call;
      },
    };

    assert.equal(
      await createAndRingChatCall({
        client,
        callId: `room-${callType}`,
        chatId: "dm-1",
        targetUserId: "peer-1",
        callType,
      }),
      call,
    );
    assert.deepEqual(callArguments, ["default", `room-${callType}`]);
    assert.equal(request.ring, true);
    assert.equal(request.video, callType === "video");
    assert.deepEqual(request.data.members, [{ user_id: "peer-1" }]);
    assert.deepEqual(request.data.custom, {
      hyechat_chat_id: "dm-1",
      hyechat_call_type: callType,
    });
  }
});

test("duplicate join requests share one in-flight join and never create a URL-supplied room", async () => {
  let resolveJoin;
  let joinCalls = 0;
  const call = {
    state: { callingState: CallingState.IDLE },
    join: (options) => {
      joinCalls += 1;
      assert.deepEqual(options, { create: false });
      return new Promise((resolve) => {
        resolveJoin = resolve;
      });
    },
  };

  const first = joinStreamCall(call);
  const second = joinStreamCall(call);
  assert.equal(joinCalls, 1);
  resolveJoin();
  assert.equal(await first, call);
  assert.equal(await second, call);
});

test("failed joins can be retried", async () => {
  let joinCalls = 0;
  const call = {
    state: { callingState: CallingState.IDLE },
    join: async () => {
      joinCalls += 1;
      if (joinCalls === 1) throw new Error("network unavailable");
    },
  };

  await assert.rejects(joinStreamCall(call), /network unavailable/);
  await joinStreamCall(call);
  assert.equal(joinCalls, 2);
});

test("leaving stops the call once and ignores an already-left call", async () => {
  let leaveCalls = 0;
  const call = {
    state: { callingState: CallingState.JOINED },
    leave: async (options) => {
      leaveCalls += 1;
      assert.deepEqual(options, { reason: "local" });
      call.state.callingState = CallingState.LEFT;
    },
  };

  assert.equal(await leaveStreamCall(call), true);
  assert.equal(await leaveStreamCall(call), false);
  assert.equal(leaveCalls, 1);
  assert.equal(await leaveStreamCall(null), false);
});

test("call errors distinguish denied permissions, missing devices, and invalid tokens", () => {
  assert.match(
    getCallJoinErrorMessage({ name: "NotAllowedError" }, "voice"),
    /Microphone access was denied/,
  );
  assert.match(
    getCallJoinErrorMessage({ name: "NotFoundError" }, "video"),
    /camera or microphone was not found/i,
  );
  assert.match(
    getCallJoinErrorMessage({ response: { status: 401 } }, "video"),
    /session expired or is unauthorized/,
  );
  assert.equal(getCallConnectionLabel(CallingState.JOINED, false), "Connected");
  assert.equal(getCallConnectionLabel(CallingState.JOINING, true), "Joining");
});

test("voice activation enables audio and never enables camera; video enables both tracks", async () => {
  const voiceCalls = [];
  const voiceErrors = await activateCallMedia(
    {
      microphone: { enable: async () => voiceCalls.push("mic-on") },
      camera: {
        disable: async (options) => voiceCalls.push(["camera-off", options]),
      },
    },
    "voice",
  );
  assert.deepEqual(voiceCalls, [["camera-off", { forceStop: true }], "mic-on"]);
  assert.deepEqual(voiceErrors, []);

  const videoCalls = [];
  const videoErrors = await activateCallMedia(
    {
      microphone: { enable: async () => videoCalls.push("mic-on") },
      camera: { enable: async () => videoCalls.push("camera-on") },
    },
    "video",
  );
  assert.deepEqual(videoCalls, ["mic-on", "camera-on"]);
  assert.deepEqual(videoErrors, []);
});

test("media permission denial is returned to the call UI without ending the session", async () => {
  const call = {
    microphone: {
      enable: async () => {
        throw Object.assign(new Error("denied"), { name: "NotAllowedError" });
      },
    },
    camera: {
      enable: async () => {
        throw Object.assign(new Error("denied"), { name: "NotAllowedError" });
      },
    },
  };
  assert.deepEqual(await activateCallMedia(call, "video"), [
    "Camera or microphone access was denied. Allow access in your browser settings, then retry.",
  ]);
});
