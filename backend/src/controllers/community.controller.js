import crypto from "crypto";
import mongoose from "mongoose";
import Community from "../models/Community.js";
import User from "../models/User.js";
import {
  addCommunityChannelMember,
  createCommunityChannel,
  deleteCommunityChannel,
  removeCommunityChannelMember,
  updateCommunityChannel,
  upsertStreamUser,
} from "../lib/stream.js";

const MEMBER_PROJECTION =
  "fullName profilePic bio nativeLanguage learningLanguage location";

const createInviteToken = () => crypto.randomBytes(32).toString("base64url");
const hashInviteToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const publicCommunity = (community, includeMembers = false) => {
  const data = community.toObject ? community.toObject() : { ...community };
  delete data.inviteTokenHash;
  data.memberCount = data.members?.length || 0;
  if (!includeMembers) delete data.members;
  return data;
};

const findMember = (community, userId) =>
  community.members.find(
    (member) => member.user.toString() === userId.toString(),
  );

const isAdmin = (community, userId) => {
  const member = findMember(community, userId);
  return member?.role === "owner" || member?.role === "admin";
};

const loadMemberCommunity = async (communityId, userId) => {
  if (!mongoose.isValidObjectId(communityId)) return null;
  const community = await Community.findOne({
    _id: communityId,
    "members.user": userId,
  });
  return community;
};

const invitePreview = (community) => ({
  _id: community._id,
  name: community.name,
  description: community.description,
  avatar: community.avatar,
  category: community.category,
  privacy: community.privacy,
  owner: community.owner,
  memberCount: community.members.length,
  inviteEnabled: community.inviteEnabled,
});

export async function getMyCommunities(req, res) {
  try {
    const communities = await Community.find({ "members.user": req.user._id })
      .select(
        "name description avatar category privacy owner members streamChannelId createdAt updatedAt",
      )
      .sort({ updatedAt: -1 })
      .lean();
    return res.status(200).json({
      communities: communities.map((community) => publicCommunity(community)),
    });
  } catch (error) {
    console.error("Error getting communities", error.message);
    return res.status(500).json({ message: "Unable to load communities" });
  }
}

export async function discoverCommunities(req, res) {
  const query = typeof req.query.query === "string" ? req.query.query.trim() : "";
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const filter = { privacy: "public" };

  if (query) {
    const search = { $regex: escapeRegex(query), $options: "i" };
    filter.$or = [{ name: search }, { description: search }, { category: search }];
  }

  try {
    const [communities, total] = await Promise.all([
      Community.find(filter)
        .select("name description avatar category privacy owner members createdAt updatedAt")
        .populate("owner", "fullName profilePic")
        .sort({ updatedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Community.countDocuments(filter),
    ]);
    return res.status(200).json({
      communities: communities.map((community) => ({
        ...publicCommunity(community),
        isMember: Boolean(findMember(community, req.user._id)),
      })),
      pagination: { page, limit, hasMore: page * limit < total },
    });
  } catch (error) {
    console.error("Error discovering communities", error.message);
    return res.status(500).json({ message: "Unable to discover communities" });
  }
}

export async function joinPublicCommunity(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Community not found" });
  }

  try {
    const community = await Community.findOne({
      _id: req.params.id,
      privacy: "public",
    });
    if (!community) {
      return res.status(404).json({ message: "Public community not found" });
    }
    if (findMember(community, req.user._id)) {
      return res.status(200).json({
        success: true,
        community: publicCommunity(community),
        alreadyMember: true,
      });
    }

    const blocked = await User.findOne({
      $or: [
        { _id: req.user._id, blockedUsers: community.owner },
        { _id: community.owner, blockedUsers: req.user._id },
      ],
    });
    if (blocked) {
      return res.status(403).json({ message: "You cannot join this community" });
    }

    const joinedCommunity = await Community.findOneAndUpdate(
      { _id: community._id, privacy: "public", "members.user": { $ne: req.user._id } },
      { $push: { members: { user: req.user._id, role: "member" } } },
      { new: true, runValidators: true },
    );
    if (!joinedCommunity) {
      const current = await Community.findById(community._id);
      return res.status(200).json({
        success: true,
        community: publicCommunity(current),
        alreadyMember: true,
      });
    }

    try {
      await addCommunityChannelMember({
        channelId: joinedCommunity.streamChannelId,
        userId: req.user._id,
      });
    } catch (streamError) {
      await Community.updateOne(
        { _id: joinedCommunity._id },
        { $pull: { members: { user: req.user._id } } },
      );
      throw streamError;
    }

    return res.status(200).json({
      success: true,
      community: publicCommunity(joinedCommunity),
    });
  } catch (error) {
    console.error("Error joining public community", error.message);
    return res.status(500).json({ message: "Unable to join community" });
  }
}

export async function createCommunity(req, res) {
  const {
    name,
    description = "",
    avatar = "",
    category = "",
    rules = "",
    privacy = "private",
  } = req.body || {};
  const cleanName = typeof name === "string" ? name.trim() : "";
  if (cleanName.length < 2 || cleanName.length > 80) {
    return res
      .status(400)
      .json({ message: "Community name must be between 2 and 80 characters" });
  }

  const inviteToken = createInviteToken();
  const community = new Community({
    name: cleanName,
    description: typeof description === "string" ? description.trim() : "",
    avatar: typeof avatar === "string" ? avatar.trim() : "",
    category: typeof category === "string" ? category.trim() : "",
    rules: typeof rules === "string" ? rules.trim() : "",
    privacy: privacy === "public" ? "public" : "private",
    owner: req.user._id,
    members: [{ user: req.user._id, role: "owner" }],
    streamChannelId: `community_${new mongoose.Types.ObjectId().toString()}`,
    inviteTokenHash: hashInviteToken(inviteToken),
  });

  try {
    await community.validate();
    await upsertStreamUser({
      id: req.user._id.toString(),
      name: req.user.fullName,
      image: req.user.profilePic || "",
    });
    await createCommunityChannel({
      channelId: community.streamChannelId,
      ownerId: req.user._id,
      memberIds: [req.user._id],
      name: community.name,
      image: community.avatar,
      communityId: community._id,
    });
    try {
      await community.save();
    } catch (databaseError) {
      await deleteCommunityChannel(community.streamChannelId);
      throw databaseError;
    }
    return res.status(201).json({
      success: true,
      community: publicCommunity(community, true),
      inviteToken,
    });
  } catch (error) {
    console.error("Error creating community", error.message);
    return res.status(500).json({ message: "Unable to create community" });
  }
}

export async function getCommunity(req, res) {
  try {
    const community = await loadMemberCommunity(req.params.id, req.user._id);
    if (!community)
      return res.status(404).json({ message: "Community not found" });
    await community.populate("members.user", MEMBER_PROJECTION);
    return res
      .status(200)
      .json({ success: true, community: publicCommunity(community, true) });
  } catch (error) {
    console.error("Error getting community", error.message);
    return res.status(500).json({ message: "Unable to load community" });
  }
}

export async function getInvitePreview(req, res) {
  const token = typeof req.params.token === "string" ? req.params.token : "";
  if (!token || token.length > 128)
    return res
      .status(404)
      .json({ message: "Invite link is invalid or expired" });
  try {
    const community = await Community.findOne({
      inviteTokenHash: hashInviteToken(token),
      inviteEnabled: true,
    }).select(
      "name description avatar category privacy owner members inviteEnabled",
    );
    if (!community)
      return res
        .status(404)
        .json({ message: "Invite link is invalid or expired" });
    await community.populate("owner", "fullName profilePic");
    return res
      .status(200)
      .json({ success: true, community: invitePreview(community) });
  } catch (error) {
    console.error("Error previewing community invite", error.message);
    return res.status(500).json({ message: "Unable to load invite" });
  }
}

export async function joinByInvite(req, res) {
  const token = typeof req.params.token === "string" ? req.params.token : "";
  if (!token || token.length > 128)
    return res
      .status(404)
      .json({ message: "Invite link is invalid or expired" });
  try {
    const community = await Community.findOne({
      inviteTokenHash: hashInviteToken(token),
      inviteEnabled: true,
    });
    if (!community)
      return res
        .status(404)
        .json({ message: "Invite link is invalid or expired" });
    const existingMember = findMember(community, req.user._id);
    if (existingMember)
      return res.status(200).json({
        success: true,
        community: publicCommunity(community),
        alreadyMember: true,
      });

    const blocked = await User.findOne({
      $or: [
        { _id: req.user._id, blockedUsers: community.owner },
        { _id: community.owner, blockedUsers: req.user._id },
      ],
    });
    if (blocked)
      return res
        .status(403)
        .json({ message: "You cannot join this community" });

    const joinedCommunity = await Community.findOneAndUpdate(
      {
        _id: community._id,
        "members.user": { $ne: req.user._id },
      },
      { $push: { members: { user: req.user._id, role: "member" } } },
      { new: true, runValidators: true },
    );
    if (!joinedCommunity) {
      const existing = await Community.findById(community._id);
      return res.status(200).json({
        success: true,
        community: publicCommunity(existing),
        alreadyMember: true,
      });
    }
    try {
      await addCommunityChannelMember({
        channelId: joinedCommunity.streamChannelId,
        userId: req.user._id,
      });
    } catch (streamError) {
      await Community.updateOne(
        { _id: joinedCommunity._id },
        { $pull: { members: { user: req.user._id } } },
      );
      throw streamError;
    }
    return res
      .status(200)
      .json({ success: true, community: publicCommunity(joinedCommunity) });
  } catch (error) {
    console.error("Error joining community", error.message);
    return res.status(500).json({ message: "Unable to join community" });
  }
}

export async function updateCommunity(req, res) {
  try {
    const community = await loadMemberCommunity(req.params.id, req.user._id);
    if (!community)
      return res.status(404).json({ message: "Community not found" });
    if (!isAdmin(community, req.user._id))
      return res
        .status(403)
        .json({ message: "Only community admins can update this community" });
    const allowed = ["name", "description", "avatar", "category", "rules"];
    for (const field of allowed) {
      if (typeof req.body?.[field] === "string")
        community[field] = req.body[field].trim();
    }
    if (community.name.length < 2 || community.name.length > 80)
      return res
        .status(400)
        .json({
          message: "Community name must be between 2 and 80 characters",
        });
    if (community.description.length > 500)
      return res
        .status(400)
        .json({ message: "Description cannot exceed 500 characters" });
    await community.save();
    await updateCommunityChannel({
      channelId: community.streamChannelId,
      name: community.name,
      image: community.avatar,
      communityId: community._id,
    });
    return res
      .status(200)
      .json({ success: true, community: publicCommunity(community) });
  } catch (error) {
    console.error("Error updating community", error.message);
    return res.status(500).json({ message: "Unable to update community" });
  }
}

export async function regenerateInvite(req, res) {
  try {
    const community = await loadMemberCommunity(req.params.id, req.user._id);
    if (!community)
      return res.status(404).json({ message: "Community not found" });
    if (!isAdmin(community, req.user._id))
      return res
        .status(403)
        .json({ message: "Only community admins can manage invites" });
    const inviteToken = createInviteToken();
    community.inviteTokenHash = hashInviteToken(inviteToken);
    community.inviteCreatedAt = new Date();
    community.inviteEnabled = true;
    await community.save();
    return res.status(200).json({ success: true, inviteToken });
  } catch (error) {
    console.error("Error regenerating invite", error.message);
    return res.status(500).json({ message: "Unable to regenerate invite" });
  }
}

export async function revokeInvite(req, res) {
  try {
    const community = await loadMemberCommunity(req.params.id, req.user._id);
    if (!community)
      return res.status(404).json({ message: "Community not found" });
    if (!isAdmin(community, req.user._id))
      return res
        .status(403)
        .json({ message: "Only community admins can manage invites" });
    community.inviteEnabled = false;
    await community.save();
    return res
      .status(200)
      .json({ success: true, message: "Invite link revoked" });
  } catch (error) {
    console.error("Error revoking invite", error.message);
    return res.status(500).json({ message: "Unable to revoke invite" });
  }
}

export async function leaveCommunity(req, res) {
  try {
    const community = await loadMemberCommunity(req.params.id, req.user._id);
    if (!community)
      return res.status(404).json({ message: "Community not found" });
    const member = findMember(community, req.user._id);
    if (member.role === "owner")
      return res
        .status(400)
        .json({ message: "The owner cannot leave this community" });
    await Community.updateOne(
      { _id: community._id },
      { $pull: { members: { user: req.user._id } } },
    );
    await removeCommunityChannelMember({
      channelId: community.streamChannelId,
      userId: req.user._id,
    });
    return res
      .status(200)
      .json({ success: true, message: "You left the community" });
  } catch (error) {
    console.error("Error leaving community", error.message);
    return res.status(500).json({ message: "Unable to leave community" });
  }
}

export async function removeCommunityMember(req, res) {
  try {
    const community = await loadMemberCommunity(req.params.id, req.user._id);
    if (!community)
      return res.status(404).json({ message: "Community not found" });
    if (!isAdmin(community, req.user._id))
      return res
        .status(403)
        .json({ message: "Only community admins can manage members" });
    if (!mongoose.isValidObjectId(req.params.userId))
      return res.status(400).json({ message: "Invalid member" });
    const target = findMember(community, req.params.userId);
    if (!target || target.role === "owner")
      return res.status(400).json({ message: "Member cannot be removed" });
    if (req.params.userId.toString() === req.user._id.toString())
      return res
        .status(400)
        .json({ message: "Use leave community to remove yourself" });
    await Community.updateOne(
      { _id: community._id },
      { $pull: { members: { user: req.params.userId } } },
    );
    await removeCommunityChannelMember({
      channelId: community.streamChannelId,
      userId: req.params.userId,
    });
    return res.status(200).json({ success: true, message: "Member removed" });
  } catch (error) {
    console.error("Error removing community member", error.message);
    return res.status(500).json({ message: "Unable to remove member" });
  }
}

export async function setCommunityMemberRole(req, res) {
  try {
    const community = await loadMemberCommunity(req.params.id, req.user._id);
    if (!community)
      return res.status(404).json({ message: "Community not found" });
    if (community.owner.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Only the owner can change admin roles" });
    }
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: "Invalid member" });
    }
    const member = findMember(community, req.params.userId);
    const role = req.body?.role;
    if (
      !member ||
      member.role === "owner" ||
      !["admin", "member"].includes(role)
    ) {
      return res.status(400).json({ message: "Invalid member role change" });
    }
    member.role = role;
    await community.save();
    return res
      .status(200)
      .json({ success: true, message: "Member role updated" });
  } catch (error) {
    console.error("Error updating community member role", error.message);
    return res.status(500).json({ message: "Unable to update member role" });
  }
}

export async function transferCommunityOwnership(req, res) {
  try {
    const community = await loadMemberCommunity(req.params.id, req.user._id);
    if (!community)
      return res.status(404).json({ message: "Community not found" });
    if (community.owner.toString() !== req.user._id.toString())
      return res
        .status(403)
        .json({ message: "Only the owner can transfer ownership" });
    if (!mongoose.isValidObjectId(req.params.userId))
      return res.status(400).json({ message: "Invalid member" });
    if (req.params.userId.toString() === req.user._id.toString())
      return res
        .status(400)
        .json({ message: "You already own this community" });
    const target = findMember(community, req.params.userId);
    if (!target)
      return res
        .status(400)
        .json({ message: "Ownership can only be transferred to a member" });
    const previousOwner = findMember(community, req.user._id);
    previousOwner.role = "admin";
    target.role = "owner";
    community.owner = target.user;
    await community.save();
    return res
      .status(200)
      .json({ success: true, community: publicCommunity(community, true) });
  } catch (error) {
    console.error("Error transferring community ownership", error.message);
    return res
      .status(500)
      .json({ message: "Unable to transfer community ownership" });
  }
}

export async function deleteCommunity(req, res) {
  try {
    const community = await loadMemberCommunity(req.params.id, req.user._id);
    if (!community)
      return res.status(404).json({ message: "Community not found" });
    if (community.owner.toString() !== req.user._id.toString())
      return res
        .status(403)
        .json({ message: "Only the owner can delete this community" });
    await deleteCommunityChannel(community.streamChannelId);
    await Community.deleteOne({ _id: community._id, owner: req.user._id });
    return res
      .status(200)
      .json({ success: true, message: "Community deleted" });
  } catch (error) {
    console.error("Error deleting community", error.message);
    return res.status(500).json({ message: "Unable to delete community" });
  }
}
