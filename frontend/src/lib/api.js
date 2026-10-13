import { axiosInstance } from "./axios.js";

export const signup = async (signupData) => {
  const res = await axiosInstance.post("/auth/signup", signupData);
  return res.data;
};

export const login = async (loginData) => {
  const res = await axiosInstance.post("/auth/login", loginData);
  return res.data;
};

export const sendVerificationOTP = async () => {
  const res = await axiosInstance.post("/auth/verify-email/send");
  return res.data;
};

export const resendVerificationOTP = async () => {
  const res = await axiosInstance.post("/auth/verify-email/resend");
  return res.data;
};

export const verifyEmailOTP = async (otp) => {
  const res = await axiosInstance.post("/auth/verify-email/verify", { otp });
  return res.data;
};

export const forgotPassword = async (email) => {
  const res = await axiosInstance.post("/auth/forgot-password", { email });
  return res.data;
};

export const resetPassword = async ({ token, password }) => {
  const res = await axiosInstance.post(`/auth/reset-password/${token}`, {
    password,
  });
  return res.data;
};

export const getStories = async () => {
  const res = await axiosInstance.get("/stories");
  return res.data;
};

export const createStory = async (
  mediaUrl,
  mediaType = "image",
  text = "",
  options = {},
) => {
  const caption = typeof text === "string" ? text.trim() : "";
  const res = await axiosInstance.post("/stories", {
    mediaUrl,
    mediaType,
    ...(options.prompt ? { prompt: options.prompt } : {}),
    ...(options.privacy ? { privacy: options.privacy } : {}),
    ...(Number.isFinite(options.mediaSize)
      ? { mediaSize: options.mediaSize }
      : {}),
    ...(Number.isFinite(options.durationSeconds)
      ? { durationSeconds: options.durationSeconds }
      : {}),
    ...(caption ? { text: caption } : {}),
  });
  return res.data;
};

export const getHiddenStoryUsers = async () => {
  const res = await axiosInstance.get("/stories/hidden-users");
  return res.data;
};

export const hideStoriesFromUser = async (userId) => {
  const res = await axiosInstance.post(`/stories/hide/${userId}`);
  return res.data;
};

export const unhideStoriesFromUser = async (userId) => {
  const res = await axiosInstance.delete(`/stories/hide/${userId}`);
  return res.data;
};

export const reportStory = async (storyId, reason) => {
  const res = await axiosInstance.post(`/stories/${storyId}/report`, {
    reason,
  });
  return res.data;
};

export const viewStory = async (storyId) => {
  const res = await axiosInstance.post(`/stories/${storyId}/view`);
  return res.data;
};

export const getStoryViewers = async (storyId) => {
  const res = await axiosInstance.get(`/stories/${storyId}/viewers`);
  return res.data;
};

export const deleteStory = async (storyId) => {
  const res = await axiosInstance.delete(`/stories/${storyId}`);
  return res.data;
};

export const addStoryReaction = async (storyId, type) => {
  const res = await axiosInstance.post(`/stories/${storyId}/reaction`, {
    type,
  });
  return res.data;
};

export const removeStoryReaction = async (storyId) => {
  const res = await axiosInstance.delete(`/stories/${storyId}/reaction`);
  return res.data;
};

export const logout = async () => {
  const res = await axiosInstance.post("/auth/logout");
  return res.data;
};

// export const chat = async (chatData) => {
//   const res = await axiosInstance.post("/auth/chat", chatData);
//   return res.data;
// };

export const getAuthUser = async () => {
  try {
    const res = await axiosInstance.get("/auth/me");
    return res.data;
  } catch (error) {
    if (error?.response?.status !== 401) {
      console.warn("Authentication check failed", {
        status: error?.response?.status || null,
        code: error?.code || null,
      });
    }
    return null;
  }
};

export const getNotificationPreferences = async () => {
  const res = await axiosInstance.get("/users/me/notification-preferences");
  return res.data.preferences;
};

export const updateNotificationPreferences = async (preferences) => {
  const res = await axiosInstance.patch(
    "/users/me/notification-preferences",
    preferences,
  );
  return res.data.preferences;
};

export const getNotifications = async ({ page = 1, limit = 20 } = {}) => {
  const res = await axiosInstance.get("/notifications", {
    params: { page, limit },
  });
  return res.data;
};

export const markNotificationAsRead = async (notificationId) => {
  const res = await axiosInstance.patch(
    `/notifications/${notificationId}/read`,
  );
  return res.data;
};

export const markAllNotificationsAsRead = async () => {
  const res = await axiosInstance.patch("/notifications/read-all");
  return res.data;
};

export const deleteNotification = async (notificationId) => {
  const res = await axiosInstance.delete(`/notifications/${notificationId}`);
  return res.data;
};

export const completeOnboarding = async (userData) => {
  const res = await axiosInstance.post("/auth/onboarding", userData);
  return res.data;
};

export async function getUserFriends() {
  const res = await axiosInstance.get("/users/friends");
  return res.data;
}

export async function getFriendsPage({ page = 1, limit = 20 } = {}) {
  const res = await axiosInstance.get("/users/friends-page", {
    params: { page, limit },
  });
  return res.data;
}

export async function discoverUsers({ query = "", page = 1, limit = 20 } = {}) {
  const res = await axiosInstance.get("/users/discover", {
    params: { query, page, limit },
  });
  return res.data;
}

export async function searchGlobalCategory(
  category,
  { query, page = 1, limit = 8 } = {},
) {
  const allowedCategories = ["people", "communities", "marketplace"];
  if (!allowedCategories.includes(category)) {
    throw new Error("Unsupported search category");
  }
  const res = await axiosInstance.get(`/search/${category}`, {
    params: { query, page, limit },
  });
  return res.data;
}

export async function getDiscoverableCommunities({
  query = "",
  page = 1,
  limit = 20,
} = {}) {
  const res = await axiosInstance.get("/communities/explore", {
    params: { query, page, limit },
  });
  return res.data;
}

export async function joinPublicCommunity(communityId) {
  const res = await axiosInstance.post(`/communities/${communityId}/join`);
  return res.data;
}

export async function getRelationshipRequests() {
  const res = await axiosInstance.get("/users/relationship-requests");
  return res.data;
}

export async function getBlockedUsers({ page = 1, limit = 20 } = {}) {
  const res = await axiosInstance.get("/users/blocked", {
    params: { page, limit },
  });
  return res.data;
}

export async function unblockUser(userId) {
  const res = await axiosInstance.delete(`/users/${userId}/block`);
  return res.data;
}

export async function getIncomingFriendRequestCount() {
  const res = await axiosInstance.get("/users/relationship-requests");
  return res.data?.incoming?.length || 0;
}

export async function getMyProfile() {
  const res = await axiosInstance.get("/users/me");
  return res.data;
}

export async function getPublicUserProfile(userId) {
  const res = await axiosInstance.get(
    `/users/${encodeURIComponent(userId)}/profile`,
  );
  return res.data;
}

export async function updateMyProfile(profileData) {
  const res = await axiosInstance.patch("/users/me", profileData);
  return res.data;
}

export async function changeMyPassword(passwordData) {
  const res = await axiosInstance.post("/users/me/password", passwordData);
  return res.data;
}

export async function deleteMyAccount(currentPassword) {
  const res = await axiosInstance.delete("/users/me", {
    data: { currentPassword },
  });
  return res.data;
}

export async function getRecommendedUsers() {
  const res = await axiosInstance.get("/users");
  return res.data;
}

export async function getOutgoingFriendReqs() {
  const res = await axiosInstance.get("/users/outgoing-friend-requests");
  return res.data;
}

export async function sendFriendRequest(userId) {
  const res = await axiosInstance.post(`/users/friend-request/${userId}`);
  return res.data;
}

export async function getFriendRequests() {
  const res = await axiosInstance.get("/users/friend-requests");
  return res.data;
}

export async function acceptFriendRequest(requestId) {
  const res = await axiosInstance.put(
    `/users/friend-request/${requestId}/accept`,
  );
  return res.data;
}

export async function declineFriendRequest(requestId) {
  const res = await axiosInstance.put(
    `/users/friend-request/${requestId}/decline`,
  );
  return res.data;
}

export async function cancelFriendRequest(requestId) {
  const res = await axiosInstance.delete(`/users/friend-request/${requestId}`);
  return res.data;
}

export async function removeFriend(userId) {
  const res = await axiosInstance.delete(`/users/${userId}/friend`);
  return res.data;
}

export async function blockUser(userId) {
  const res = await axiosInstance.post(`/users/${userId}/block`);
  return res.data;
}

export async function getMyCommunities() {
  const res = await axiosInstance.get("/communities");
  return res.data;
}

export async function getMarketplaceListings({
  query = "",
  type = "",
  category = "",
  minPrice = "",
  maxPrice = "",
  location = "",
  seller = "",
  page = 1,
  limit = 20,
} = {}) {
  const res = await axiosInstance.get("/marketplace", {
    params: {
      query,
      type,
      category,
      minPrice,
      maxPrice,
      location,
      seller,
      page,
      limit,
    },
  });
  return res.data;
}

export async function getMarketplaceListing(listingId) {
  const res = await axiosInstance.get(`/marketplace/${listingId}`);
  return res.data;
}

export async function getMarketplaceCategories() {
  const res = await axiosInstance.get("/marketplace/categories");
  return res.data;
}

export async function getMyMarketplaceListings({ page = 1, limit = 20 } = {}) {
  const res = await axiosInstance.get("/marketplace/mine", {
    params: { page, limit },
  });
  return res.data;
}

export async function getSavedMarketplaceListingIds() {
  const res = await axiosInstance.get("/marketplace/saved/ids");
  return res.data;
}

export async function getSavedMarketplaceListings({
  page = 1,
  limit = 20,
} = {}) {
  const res = await axiosInstance.get("/marketplace/saved", {
    params: { page, limit },
  });
  return res.data;
}

export async function createMarketplaceListing(listingData) {
  const res = await axiosInstance.post("/marketplace", listingData);
  return res.data;
}

export async function cleanupMarketplaceMedia(paths) {
  const res = await axiosInstance.post("/marketplace/media/cleanup", { paths });
  return res.data;
}

export async function saveMarketplaceListing(listingId) {
  const res = await axiosInstance.post(`/marketplace/${listingId}/save`);
  return res.data;
}

export async function unsaveMarketplaceListing(listingId) {
  const res = await axiosInstance.delete(`/marketplace/${listingId}/save`);
  return res.data;
}

export async function reportMarketplaceListing(listingId, report) {
  const res = await axiosInstance.post(
    `/marketplace/${listingId}/report`,
    report,
  );
  return res.data;
}

export async function updateMarketplaceListingStatus(listingId, status) {
  const res = await axiosInstance.patch(`/marketplace/${listingId}/status`, {
    status,
  });
  return res.data;
}

export async function getMarketplaceModerationReports() {
  const res = await axiosInstance.get("/marketplace/moderation/reports");
  return res.data;
}

export async function resolveMarketplaceModerationReport(reportId, decision) {
  const res = await axiosInstance.patch(
    `/marketplace/moderation/reports/${reportId}`,
    { decision },
  );
  return res.data;
}

export async function createCommunity(communityData) {
  const res = await axiosInstance.post("/communities", communityData);
  return res.data;
}

export async function getCommunity(communityId) {
  const res = await axiosInstance.get(`/communities/${communityId}`);
  return res.data;
}

export async function getCommunityInvitePreview(token) {
  const res = await axiosInstance.get(`/communities/invite/${token}`);
  return res.data;
}

export async function joinCommunityByInvite(token) {
  const res = await axiosInstance.post(`/communities/invite/${token}/join`);
  return res.data;
}

export async function updateCommunity(communityId, data) {
  const res = await axiosInstance.patch(`/communities/${communityId}`, data);
  return res.data;
}

export async function regenerateCommunityInvite(communityId) {
  const res = await axiosInstance.post(
    `/communities/${communityId}/invite/regenerate`,
  );
  return res.data;
}

export async function revokeCommunityInvite(communityId) {
  const res = await axiosInstance.post(
    `/communities/${communityId}/invite/revoke`,
  );
  return res.data;
}

export async function leaveCommunity(communityId) {
  const res = await axiosInstance.post(`/communities/${communityId}/leave`);
  return res.data;
}

export async function deleteCommunity(communityId) {
  const res = await axiosInstance.delete(`/communities/${communityId}`);
  return res.data;
}

export async function removeCommunityMember(communityId, userId) {
  const res = await axiosInstance.delete(
    `/communities/${communityId}/members/${userId}`,
  );
  return res.data;
}

export async function setCommunityMemberRole(communityId, userId, role) {
  const res = await axiosInstance.patch(
    `/communities/${communityId}/members/${userId}/role`,
    { role },
  );
  return res.data;
}

export async function transferCommunityOwnership(communityId, userId) {
  const res = await axiosInstance.patch(
    `/communities/${communityId}/owner/${userId}`,
  );
  return res.data;
}

export async function getStreamToken() {
  try {
    const res = await axiosInstance.get("/chat/token", {
      timeout: 15000,
    });
    return res?.data ?? null;
  } catch (error) {
    console.warn("Could not fetch Stream token:", error);
    return null;
  }
}

export async function startCallHistory(data) {
  const res = await axiosInstance.post("/call-history/start", data);
  return res.data;
}

export async function endCallHistory(roomId) {
  const res = await axiosInstance.patch(`/call-history/${roomId}/end`);
  return res.data;
}

export async function getCallHistory(params = {}) {
  const res = await axiosInstance.get("/call-history", { params });
  return res.data;
}

export async function deleteCallHistory(callId) {
  const res = await axiosInstance.delete(`/call-history/${callId}`);
  return res.data;
}

export async function syncStreamUsers(users) {
  try {
    const res = await axiosInstance.post("/chat/users/sync", { users });
    return res.data;
  } catch (error) {
    console.warn("Could not sync Stream users:", error);
    throw error;
  }
}

export async function getTranslationLanguages() {
  const res = await axiosInstance.get("/translation/languages");
  return res.data;
}

export async function translateMessage({ text, targetLanguage }) {
  const res = await axiosInstance.post(
    "/translation/text",
    { text, targetLanguage },
    { timeout: 25000 },
  );
  return res.data;
}

export async function transcribeVoiceNote({ messageId }) {
  const res = await axiosInstance.post(
    "/translation/voice/transcribe",
    { messageId },
    { timeout: 90000 },
  );
  return res.data;
}
