import Conversation from "../model/conversationModel.js";

export const getConversations = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;

    let conversations = await Conversation.find({
      participants: { $in: [currentUserId] },
    })
      .populate("participants", "-password")
      .populate("lastMessage")
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    next(error);
  }
};

export const accessConversation = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const partnerId = req.params.partnerId;

    let conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, partnerId] },
    }).populate("participants", "-password");

    res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
};

export const createGroupChat = async (req, res, next) => {
  try {
    const { groupName, users } = req.body;
    // users là mảng ID các thành viên được mời (chưa bao gồm người tạo)

    if (!users || users.length === 0) {
      return res
        .status(400)
        .json({
          message: "Vui lòng chọn ít nhất 1 thành viên khác để tạo nhóm",
        });
    }

    // Thêm chính người tạo vào danh sách participants
    const participants = [...users, req.user.id];

    const groupChat = await Conversation.create({
      participants,
      isGroupChat: true,
      groupName: groupName || "Nhóm mới",
      groupAdmin: req.user.id,
    });

    // Populate thông tin thành viên để trả về cho Frontend hiển thị ngay
    const fullGroupChat = await Conversation.findById(groupChat._id).populate(
      "participants",
      "-password -privateKey",
    );

    res.status(200).json({
      success: true,
      data: fullGroupChat,
    });
  } catch (error) {
    next(error);
  }
};
