import React, { useState } from 'react';
import { X, Loader2, Users, Check } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { useFriendStore } from '../store/useFriendStore';

const CreateGroupModal = ({ isOpen, onClose }) => {
  const { friends } = useFriendStore();
  const { createGroup } = useChatStore();
  
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const handleToggleUser = (userId) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const handleCreate = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    setIsLoading(true);
    const newGroup = await createGroup(groupName, selectedUsers);
    setIsLoading(false);
    
    if (newGroup) {
      setGroupName('');
      setSelectedUsers([]);
      onClose(); // Đóng modal khi tạo xong
    }
  };

  const filteredFriends = friends.filter(f => f.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-100 p-2 rounded-lg text-[#5c40e8]">
              <Users className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Tạo nhóm chat</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tên nhóm</label>
            <input 
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Nhập tên nhóm..." 
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#5c40e8]/20 focus:border-[#5c40e8] outline-none transition-all"
            />
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Thành viên ({selectedUsers.length} đã chọn)
            </label>
            <input 
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm bạn bè..." 
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm mb-3 focus:bg-white focus:border-[#5c40e8] outline-none"
            />
            
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar max-h-[250px]">
              {filteredFriends.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-4">Không tìm thấy bạn bè</p>
              ) : (
                filteredFriends.map((friend) => (
                  <div 
                    key={friend._id} 
                    onClick={() => handleToggleUser(friend._id)}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-100"
                  >
                    <div className="relative w-10 h-10">
                      {friend.profilePic ? (
                        <img src={friend.profilePic} className="w-full h-full rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full rounded-full bg-indigo-100 flex items-center justify-center text-[#5c40e8] font-bold">
                          {friend.name?.[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="flex-1 text-sm font-medium text-gray-800">{friend.name}</span>
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                      selectedUsers.includes(friend._id) ? 'bg-[#5c40e8] border-[#5c40e8] text-white' : 'border-gray-300'
                    }`}>
                      {selectedUsers.includes(friend._id) && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 flex justify-end gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            Hủy
          </button>
          <button 
            onClick={handleCreate}
            disabled={!groupName.trim() || selectedUsers.length === 0 || isLoading}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-[#5c40e8] hover:bg-[#4a32c3] disabled:bg-[#a696eb] disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-2 shadow-sm"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Tạo nhóm"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupModal;