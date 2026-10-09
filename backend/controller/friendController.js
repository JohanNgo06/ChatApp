import FriendRequest from "../model/friendRequestModel.js";
import User from "../model/userModel.js";
import { io, getReceiverSocketId } from "../lib/socket.js"; // BỔ SUNG IMPORT SOCKET

const USER_FIELDS = "name email profilePic publicKey"; // Đã bỏ dấu phẩy thừa ở publicKey

export const getFriends = async (req, res) => {
  try {
    const me = req.user._id;
    const rels = await FriendRequest.find({
      status: "accepted",
      $or: [{ sender: me }, { receiver: me }],
    })
      .populate("sender receiver", USER_FIELDS)
      .sort({ updatedAt: -1 });

    const friends = rels.map((r) =>
      r.sender._id.equals(me) ? r.receiver : r.sender,
    );
    res.json(friends);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const getRequests = async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      receiver: req.user._id,
      status: "pending",
    })
      .populate("sender", USER_FIELDS)
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const searchUsers = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json([]);
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [{ email: q.toLowerCase() }, { name: new RegExp(safe, "i") }],
    })
      .select(USER_FIELDS)
      .limit(10);
    res.json(users);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const getSuggestions = async (req, res) => {
  try {
    const me = req.user._id;
    const rels = await FriendRequest.find({
      $or: [{ sender: me }, { receiver: me }],
    });
    const exclude = [me, ...rels.flatMap((r) => [r.sender, r.receiver])];
    const users = await User.find({ _id: { $nin: exclude } })
      .select(USER_FIELDS)
      .limit(5);
    res.json(users);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const sendRequest = async (req, res) => {
  try {
    const me = req.user._id;
    const { userId } = req.params;
    if (me.equals(userId))
      return res
        .status(400)
        .json({ message: "Không thể tự kết bạn với chính mình" });

    const target = await User.findById(userId);
    if (!target)
      return res.status(404).json({ message: "Không tìm thấy người dùng" });

    const existed = await FriendRequest.findOne({
      $or: [
        { sender: me, receiver: userId },
        { sender: userId, receiver: me },
      ],
    });
    if (existed)
      return res
        .status(400)
        .json({ message: "Đã tồn tại lời mời hoặc đã là bạn bè" });

    const request = await FriendRequest.create({
      sender: me,
      receiver: userId,
    });

    // BỔ SUNG REAL-TIME: Populate thông tin người gửi để Frontend có avatar và tên
    const populatedRequest = await request.populate("sender", USER_FIELDS);

    // Gửi tín hiệu đến người nhận (nếu họ đang online)
    const receiverSocketId = getReceiverSocketId(userId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newFriendRequest", populatedRequest);
    }

    res.status(201).json(populatedRequest);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const acceptRequest = async (req, res) => {
  try {
    const request = await FriendRequest.findOneAndUpdate(
      { _id: req.params.requestId, receiver: req.user._id, status: "pending" },
      { status: "accepted" },
      { new: true },
    ).populate("sender receiver", USER_FIELDS); // BỔ SUNG BẮT BUỘC: Lấy thông tin cả 2 người

    if (!request)
      return res.status(404).json({ message: "Không tìm thấy lời mời" });

    // BỔ SUNG REAL-TIME: Báo cho người gửi biết là mình đã đồng ý
    // request.sender._id là ID của người đã gửi lời mời ban đầu
    const senderSocketId = getReceiverSocketId(request.sender._id.toString());
    if (senderSocketId) {
      // Gửi thông tin của mình (receiver) để người kia thêm vào danh sách bạn bè
      io.to(senderSocketId).emit("friendRequestAccepted", request.receiver);
    }

    res.json(request);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const rejectRequest = async (req, res) => {
  try {
    const request = await FriendRequest.findOneAndDelete({
      _id: req.params.requestId,
      receiver: req.user._id,
      status: "pending",
    });
    if (!request)
      return res.status(404).json({ message: "Không tìm thấy lời mời" });
    res.json({ message: "Đã từ chối" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
