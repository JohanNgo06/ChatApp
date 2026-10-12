import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LogOut, Home, Search, Image as ImageIcon, Send, X, Loader2, MessageSquare, Lock, Paperclip, FileText, Download, Check, CheckCheck, Users, Plus, ChevronLeft
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { useFriendStore } from '../store/useFriendStore';
import CreateGroupModal from '../components/CreateGroupModal';

const MAX_IMAGE_SIZE = 3 * 1024 * 1024;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const Avatar = ({ user, size = 'w-10 h-10' }) => {
  if (user?.isGroupChat) {
    return (
      <div className={`${size} rounded-full bg-gradient-to-br from-[#5c40e8] to-[#8f7bf0] text-white flex items-center justify-center shrink-0 shadow-sm`}>
        <Users className="w-5 h-5" />
      </div>
    );
  }
  return user?.profilePic ? (
    <img src={user.profilePic} alt={user.name} className={`${size} rounded-full object-cover shrink-0 shadow-sm`} />
  ) : (
    <div className={`${size} rounded-full bg-indigo-100 text-[#5c40e8] font-bold flex items-center justify-center shrink-0 shadow-sm`}>
      {user?.name?.[0]?.toUpperCase() || '?'}
    </div>
  );
};

const formatTime = (date) =>
  new Date(date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

const ChatPage = () => {
  const navigate = useNavigate();

  const { authUser, signout, onlineUsers, socket } = useAuthStore();
  const {
    messages, selectedUser, setSelectedUser, getMessages, sendMessage, downloadFile,
    subscribeToMessages, unsubscribeFromMessages, isMessagesLoading, sendError, isTyping,
    conversations, getConversations, isConversationsLoading
  } = useChatStore();
  const { friends, fetchAll } = useFriendStore();

  const [filter, setFilter] = useState('');
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [file, setFile] = useState(null);
  const [localError, setLocalError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [downloadingMsgId, setDownloadingMsgId] = useState(null);
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [activeTab, setActiveTab] = useState('chats');
  
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

  const imageRef = useRef(null);
  const fileRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetchAll();
    getConversations(); 
  }, [fetchAll, getConversations]);

  const conversationList = conversations.map(conv => {
    if (conv.isGroupChat) {
      return {
        _id: conv._id,
        isGroupChat: true,
        name: conv.groupName,
        participants: conv.participants,
        lastMessage: conv.lastMessage,
        updatedAt: conv.updatedAt
      };
    } else {
      const partner = conv.participants.find(p => p._id !== authUser._id);
      return {
        ...partner,
        isGroupChat: false,
        conversationId: conv._id,
        lastMessage: conv.lastMessage,
        updatedAt: conv.updatedAt
      };
    }
  });

  useEffect(() => {
    if (!selectedUser?._id) return;
    getMessages(selectedUser._id);
    subscribeToMessages();
    return () => unsubscribeFromMessages();
  }, [selectedUser?._id, getMessages, subscribeToMessages, unsubscribeFromMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleImageChange = (e) => {
    const selectedImg = e.target.files?.[0];
    e.target.value = '';
    if (!selectedImg) return;
    if (!selectedImg.type.startsWith('image/')) return setLocalError('Vui lòng chọn một tệp ảnh.');
    if (selectedImg.size > MAX_IMAGE_SIZE) return setLocalError('Ảnh quá lớn (tối đa 3MB).');
    
    setLocalError('');
    const reader = new FileReader();
    reader.onloadend = () => setImage(reader.result);
    reader.readAsDataURL(selectedImg);
  };

  const handleDocFileChange = (e) => {
    const selectedDoc = e.target.files?.[0];
    e.target.value = '';
    if (!selectedDoc) return;
    if (selectedDoc.size > MAX_FILE_SIZE) return setLocalError('File quá lớn (tối đa 5MB).');
    
    setLocalError('');
    setFile(selectedDoc);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (isSending || !selectedUser || (!text.trim() && !image && !file)) return;
    setIsSending(true);
    setLocalError('');

    let fileData = null;
    if (file) {
      const buffer = await file.arrayBuffer();
      fileData = { buffer, name: file.name, type: file.type, size: file.size };
    }

    const ok = await sendMessage({
      text: text.trim(),
      image,
      file: fileData,
      receiverId: selectedUser._id,
    });

    if (ok) {
      setText('');
      setImage(null);
      setFile(null);
      getConversations(); 
    }
    setIsSending(false);
  };

  const handleInputChange = (e) => {
    setText(e.target.value);
    if (!socket || !selectedUser) return;
    socket.emit("typing", { receiverId: selectedUser._id });
    if (typingTimeout) clearTimeout(typingTimeout);
    const timeout = setTimeout(() => {
      socket.emit("stopTyping", { receiverId: selectedUser._id });
    }, 2000);
    setTypingTimeout(timeout);
  };

  const handleDownloadFile = async (msg) => {
    setDownloadingMsgId(msg._id);
    const url = await downloadFile(msg);
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = msg.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      setLocalError("Không thể giải mã file.");
    }
    setDownloadingMsgId(null);
  };

  const isOnline = (item) => {
    if (item.isGroupChat) return false; 
    return onlineUsers.includes(item._id);
  };

  const filteredConversations = conversationList.filter((item) =>
    item.name?.toLowerCase().includes(filter.toLowerCase())
  );
  
  const filteredFriends = friends.filter((f) =>
    f.name?.toLowerCase().includes(filter.toLowerCase())
  );
  
  const errorMsg = localError || sendError;

  return (
    <div className="h-screen w-full flex bg-[#f0f2f5] font-sans overflow-hidden">
      
      {/* ===== CỘT TRÁI - SIDEBAR (Chỉ hiện trên Mobile khi CHƯA chọn User) ===== */}
      <div className={`w-full md:w-[360px] lg:w-[400px] flex-col bg-white border-r border-gray-100 shrink-0 z-10 shadow-sm ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 md:p-5 pb-3">
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">
                {activeTab === 'chats' ? 'Đoạn chat' : 'Bạn bè'}
              </h2>
              <span className="bg-indigo-50 text-[#5c40e8] text-xs font-bold px-2 py-0.5 rounded-full">
                {activeTab === 'chats' ? conversationList.length : friends.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setIsGroupModalOpen(true)} className="p-2 bg-[#eef0ff] text-[#5c40e8] hover:bg-indigo-100 rounded-full transition-colors" title="Tạo nhóm mới">
                <Plus className="w-4 h-4" />
              </button>
              <button onClick={() => navigate('/home')} className="p-2 bg-gray-50 text-gray-600 hover:bg-indigo-50 hover:text-[#5c40e8] rounded-full transition-colors" title="Trang chủ">
                <Home className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex p-1 bg-gray-100 rounded-xl mb-4">
            <button
              onClick={() => setActiveTab('chats')}
              className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'chats' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Trò chuyện
            </button>
            <button
              onClick={() => setActiveTab('friends')}
              className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'friends' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Danh bạ
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} className="block w-full pl-9 pr-3 py-2.5 bg-[#f4f5f7] rounded-xl text-sm placeholder-gray-500 outline-none focus:ring-2 focus:ring-[#5c40e8]/20 focus:bg-white transition-all" placeholder="Tìm kiếm..." />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5 custom-scrollbar">
          {activeTab === 'chats' ? (
            // RENDER DANH SÁCH ĐOẠN CHAT
            isConversationsLoading && conversations.length === 0 ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[#5c40e8]" /></div>
            ) : filteredConversations.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-10 px-6">Chưa có đoạn chat nào.</p>
            ) : (
              filteredConversations.map((item) => {
                const active = selectedUser?._id === item._id;
                return (
                  <div key={item._id} onClick={() => !active && setSelectedUser(item)} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${active ? 'bg-[#eef0ff]' : 'hover:bg-[#f4f5f7]'}`}>
                    <div className="relative">
                      <Avatar user={item} size="w-12 h-12" />
                      {isOnline(item) && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-gray-900 truncate">{item.name}</h4>
                      <p className={`text-xs md:text-[13px] truncate ${isOnline(item) ? 'text-green-600' : 'text-gray-500'}`}>
                        {item.isGroupChat ? `${item.participants.length} thành viên` : (isOnline(item) ? 'Đang hoạt động' : 'Ngoại tuyến')}
                      </p>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            // RENDER DANH SÁCH BẠN BÈ
            filteredFriends.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-10 px-6">Không có bạn bè nào.</p>
            ) : (
              filteredFriends.map((friend) => {
                const active = selectedUser?._id === friend._id;
                return (
                  <div key={friend._id} onClick={() => !active && setSelectedUser({...friend, isGroupChat: false})} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${active ? 'bg-[#eef0ff]' : 'hover:bg-[#f4f5f7]'}`}>
                    <div className="relative">
                      <Avatar user={friend} size="w-12 h-12" />
                      {isOnline(friend) && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-gray-900 truncate">{friend.name}</h4>
                      <p className={`text-xs md:text-[13px] truncate ${isOnline(friend) ? 'text-green-600' : 'text-gray-500'}`}>
                        {isOnline(friend) ? 'Đang hoạt động' : 'Ngoại tuyến'}
                      </p>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>
      </div>

      {/* ===== CỘT PHẢI - CHAT KHU VỰC (Chỉ hiện trên Mobile khi ĐÃ chọn User) ===== */}
      {!selectedUser ? (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center text-gray-400 gap-3">
          <div className="bg-white p-5 rounded-full shadow-sm"><MessageSquare className="w-10 h-10 text-[#5c40e8]" /></div>
          <p className="text-sm font-medium">Chọn một người bạn hoặc nhóm để bắt đầu</p>
        </div>
      ) : (
        <div className={`flex-1 flex-col bg-[#f0f2f5] relative min-w-0 ${selectedUser ? 'flex' : 'hidden md:flex'}`}>
          <div className="h-[68px] md:h-[76px] bg-white border-b border-gray-100 flex items-center px-3 md:px-6 shrink-0 z-10 shadow-sm">
            <div className="flex items-center gap-2 md:gap-3">
              {/* Nút Back về Sidebar trên Mobile */}
              <button 
                onClick={() => setSelectedUser(null)}
                className="md:hidden p-1.5 -ml-1 text-gray-500 hover:bg-gray-100 rounded-full"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              
              <div className="relative">
                <Avatar user={selectedUser} size="w-9 h-9 md:w-10 md:h-10" />
                {isOnline(selectedUser) && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 md:w-3 md:h-3 bg-green-500 border-2 border-white rounded-full"></div>}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm md:text-base font-bold text-gray-900 leading-tight truncate">{selectedUser.name}</h3>
                <p className="text-[11px] md:text-xs text-gray-500 font-medium flex items-center gap-1 mt-0.5 truncate">
                  {selectedUser.isGroupChat ? (
                    <span>Nhóm • {selectedUser.participants.length} TV</span>
                  ) : (
                    isOnline(selectedUser) ? <span className="text-green-600">Đang hoạt động</span> : <span>Ngoại tuyến</span>
                  )}
                  {(!selectedUser.isGroupChat && selectedUser.publicKey) || selectedUser.isGroupChat ? (
                     <span className="flex items-center gap-0.5 md:gap-1 ml-1 md:ml-2 text-[#5c40e8]"><Lock className="w-3 h-3" /> <span className="hidden sm:inline">E2EE</span></span>
                  ) : null}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-4 custom-scrollbar">
            {isMessagesLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[#5c40e8]" /></div>
            ) : messages.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-10">Chưa có tin nhắn nào. Hãy gửi lời chào đầu tiên!</p>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === authUser._id || msg.senderId?._id === authUser._id;
                let senderInfo = null;
                if (!isMe && selectedUser.isGroupChat) {
                    const senderIdStr = msg.senderId?._id || msg.senderId;
                    senderInfo = selectedUser.participants.find(p => p._id === senderIdStr);
                }

                return (
                  <div key={msg._id} className={`flex items-end gap-2 md:gap-3 max-w-[85%] md:max-w-[70%] ${isMe ? 'self-end flex-row-reverse' : 'self-start'}`}>
                    {!isMe && <div className="hidden sm:block"><Avatar user={senderInfo || selectedUser} size="w-8 h-8" /></div>}
                    
                    <div className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                      {!isMe && selectedUser.isGroupChat && senderInfo && (
                         <span className="text-[11px] md:text-xs text-gray-500 ml-1 mb-0.5">{senderInfo.name}</span>
                      )}

                      <div className={`p-3 md:p-3.5 rounded-2xl shadow-sm ${
                        isMe ? 'bg-[#5c40e8] text-white rounded-br-sm' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'
                      }`}>
                        {msg.image && (
                          <img src={msg.image} alt="đính kèm" className="rounded-xl mb-2 max-h-48 md:max-h-64 max-w-full object-cover" />
                        )}

                        {msg.text && (
                          <p className="text-[13px] md:text-[14px] leading-relaxed break-words whitespace-pre-wrap">{msg.text}</p>
                        )}

                        {msg.fileUrl && (
                          <div className={`flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-xl border ${isMe ? 'bg-white/20 border-white/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-800'}`}>
                            <div className={`p-1.5 md:p-2 rounded-lg ${isMe ? 'bg-white/20' : 'bg-indigo-100 text-[#5c40e8]'}`}>
                              <FileText className="w-5 h-5 md:w-6 md:h-6" />
                            </div>
                            <div className="flex-1 min-w-[100px] md:min-w-[120px]">
                              <p className="text-xs md:text-sm font-semibold truncate" title={msg.fileName}>{msg.fileName}</p>
                              <p className={`text-[10px] md:text-[11px] font-medium ${isMe ? 'text-indigo-200' : 'text-gray-500'}`}>
                                {(msg.fileSize / 1024).toFixed(2)} KB
                              </p>
                            </div>
                            <button
                              onClick={() => handleDownloadFile(msg)}
                              disabled={downloadingMsgId === msg._id}
                              className={`p-1.5 md:p-2 rounded-full transition-colors ${isMe ? 'bg-white/20 hover:bg-white/30' : 'bg-gray-200 hover:bg-gray-300'}`}
                            >
                              {downloadingMsgId === msg._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div className={`flex items-center gap-1 mt-1 mx-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-[9px] md:text-[10px] text-gray-400">{formatTime(msg.createdAt)}</span>
                        {isMe && !selectedUser.isGroupChat && (
                          msg.isRead ? <CheckCheck className="w-[12px] h-[12px] md:w-[14px] md:h-[14px] text-blue-500" /> : <Check className="w-[12px] h-[12px] md:w-[14px] md:h-[14px] text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {isTyping && (
              <div className="flex items-end gap-2 md:gap-3 max-w-[70%] self-start">
                <div className="hidden sm:block"><Avatar user={selectedUser} size="w-8 h-8" /></div>
                <div className="bg-white border border-gray-100 p-3 md:p-4 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1.5 h-[38px] md:h-[46px]">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="px-3 md:px-6 pb-4 md:pb-6 pt-2 bg-[#f0f2f5] shrink-0">
            {errorMsg && <p className="mb-2 text-[11px] md:text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1.5 md:px-3 md:py-2">{errorMsg}</p>}

            {image && (
              <div className="mb-2 relative inline-block">
                <img src={image} alt="xem trước" className="h-16 md:h-20 rounded-xl border border-gray-200 object-cover" />
                <button type="button" onClick={() => setImage(null)} className="absolute -top-2 -right-2 bg-gray-800 text-white rounded-full p-1 shadow-md"><X className="w-3 h-3" /></button>
              </div>
            )}

            {file && (
              <div className="mb-2 relative inline-flex items-center gap-2 md:gap-3 bg-white shadow-sm border border-gray-200 p-1.5 md:p-2 pr-8 md:pr-10 rounded-xl">
                <div className="bg-indigo-50 p-1.5 md:p-2 rounded-lg"><FileText className="w-5 h-5 md:w-6 md:h-6 text-[#5c40e8]" /></div>
                <div className="flex flex-col">
                  <span className="text-xs md:text-sm font-bold text-gray-800 truncate max-w-[120px] md:max-w-[150px]">{file.name}</span>
                  <span className="text-[10px] md:text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</span>
                </div>
                <button type="button" onClick={() => setFile(null)} className="absolute -top-2 -right-2 bg-gray-800 text-white rounded-full p-1 shadow-md"><X className="w-3 h-3" /></button>
              </div>
            )}

            <form onSubmit={handleSend} className="bg-white rounded-2xl flex items-center p-1.5 md:p-2 shadow-sm border border-gray-100 min-h-[50px] md:min-h-[60px]">
              <input type="file" accept="image/*" ref={imageRef} onChange={handleImageChange} className="hidden" />
              <input type="file" accept="*/*" ref={fileRef} onChange={handleDocFileChange} className="hidden" />
              
              <div className="flex items-center gap-0.5 md:gap-1 px-1 md:px-2">
                <button type="button" onClick={() => imageRef.current?.click()} className="p-1.5 md:p-2 text-gray-400 hover:text-[#5c40e8] hover:bg-gray-50 rounded-full transition-colors" title="Gửi ảnh">
                  <ImageIcon className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <button type="button" onClick={() => fileRef.current?.click()} className="p-1.5 md:p-2 text-gray-400 hover:text-[#5c40e8] hover:bg-gray-50 rounded-full transition-colors" title="Đính kèm tài liệu">
                  <Paperclip className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>

              <input
                type="text"
                value={text}
                onChange={handleInputChange}
                className="flex-1 bg-transparent border-none focus:ring-0 outline-none px-1 md:px-2 text-sm md:text-[15px] text-gray-800 placeholder-gray-400 min-w-0"
                placeholder="Nhập tin nhắn..."
              />

              <button
                type="submit"
                disabled={isSending || (!text.trim() && !image && !file)}
                className="bg-[#5c40e8] hover:bg-[#4a32c3] disabled:bg-[#a696eb] text-white p-2.5 md:p-3 rounded-full transition-transform active:scale-95 shadow-md shadow-indigo-200 mr-0.5 md:mr-1 shrink-0"
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5 md:w-4 md:h-4" />}
              </button>
            </form>
          </div>
        </div>
      )}

      <CreateGroupModal 
        isOpen={isGroupModalOpen} 
        onClose={() => setIsGroupModalOpen(false)} 
      />
    </div>
  );
};

export default ChatPage;