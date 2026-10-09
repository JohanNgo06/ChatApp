import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Edit, Search, UserPlus, X, AtSign, Check, Copy, Loader2, LogOut,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useFriendStore } from '../store/useFriendStore';

const Avatar = ({ user, size = 'w-10 h-10' }) =>
  user?.profilePic ? (
    <img src={user.profilePic} alt={user.name} className={`${size} rounded-full object-cover shrink-0`} />
  ) : (
    <div className={`${size} rounded-full bg-indigo-100 text-[#5c40e8] font-bold flex items-center justify-center shrink-0`}>
      {user?.name?.[0]?.toUpperCase() || '?'}
    </div>
  );

// Lọc bạn bè


const HomePage = () => {
  const navigate = useNavigate();
  const { authUser, signout } = useAuthStore();
  const {
    friends, requests, suggestions, searchResults,
    isLoading, isSearching, error,
    fetchAll, searchUsers, clearSearch,
    sendRequest, acceptRequest, rejectRequest,
    subscribeToFriendEvents, // THÊM DÒNG NÀY
    unsubscribeFromFriendEvents
  } = useFriendStore();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchAll();
    
    // Bật lắng nghe Socket khi vào trang
    subscribeToFriendEvents();

    // Tắt lắng nghe khi rời khỏi trang để tránh rò rỉ bộ nhớ
    return () => unsubscribeFromFriendEvents();
  }, [fetchAll, subscribeToFriendEvents, unsubscribeFromFriendEvents]);

  const handleSearch = (e) => {
    e.preventDefault();
    searchUsers(query);
  };

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(authUser._id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const filteredFriends = friends.filter((f) =>
  f.name?.toLowerCase().includes(filter.toLowerCase())
);

  return (
    <div className="h-screen w-full flex bg-[#eef2ff] font-sans overflow-hidden">
      {/* ===== CỘT TRÁI: DANH SÁCH BẠN BÈ / ĐOẠN CHAT ===== */}
      <div className="w-[360px] lg:w-[400px] flex flex-col bg-white border-r border-gray-100 shrink-0">
        <div className="p-5 pb-3">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">Đoạn chat</h2>
              <span className="bg-indigo-50 text-[#5c40e8] text-xs font-bold px-2 py-0.5 rounded-full">
                {friends.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => navigate('/chatpage')}
                className="p-2 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-full"
                title="Mở khung chat"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={signout}
                className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-full"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-[#f4f5f7] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#5c40e8]/20"
              placeholder="Tìm trong danh sách bạn bè..."
            />
          </div>

          <div className="flex items-center gap-3 bg-indigo-50 p-3 rounded-xl">
            <div className="bg-[#5c40e8] p-2 rounded-lg">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">Kết nối bạn bè mới</p>
              <p className="text-xs text-gray-500">Tìm kiếm qua Email hoặc tên</p>
            </div>
            {requests.length > 0 && (
              <span className="bg-[#5c40e8] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {requests.length} chờ
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-[#5c40e8]" />
            </div>
          ) : filteredFriends.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10 px-6">
              {friends.length === 0
                ? 'Bạn chưa có bạn bè nào. Hãy tìm và kết bạn ở khung bên phải.'
                : 'Không tìm thấy bạn bè phù hợp.'}
            </p>
          ) : (
            filteredFriends.map((f) => (
              <div
                key={f._id}
                onClick={() => navigate('/chatpage', { state: { userId: f._id } })}
                className="flex items-center gap-3 p-3 hover:bg-[#f4f5f7] rounded-xl cursor-pointer transition-colors"
              >
                <Avatar user={f} size="w-12 h-12" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-gray-900 truncate">{f.name}</h4>
                  <p className="text-[13px] text-gray-500 truncate">{f.email}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ===== CỘT PHẢI: THÊM BẠN BÈ ===== */}
      <div className="flex-1 flex justify-center overflow-y-auto p-6">
        <div className="w-full max-w-[520px] bg-white rounded-3xl shadow-lg p-6 h-fit">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-100 p-2.5 rounded-xl">
                <UserPlus className="w-5 h-5 text-[#5c40e8]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Thêm bạn bè</h3>
                <p className="text-xs text-gray-500">Mở rộng kết nối trên WhatSoup</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/chatpage')}
              className="p-2 hover:bg-gray-100 rounded-full text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Tìm kiếm */}
          <p className="text-sm font-semibold text-gray-700 mb-2">Tìm kiếm trực tiếp</p>
          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (!e.target.value) clearSearch();
                }}
                className="w-full pl-9 pr-3 py-2.5 bg-[#f4f5f7] rounded-xl text-sm outline-none"
                placeholder="Nhập Email hoặc tên..."
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="bg-[#5c40e8] hover:bg-[#4a32c3] disabled:bg-[#a696eb] text-white text-sm font-semibold px-4 rounded-xl"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tìm kiếm'}
            </button>
          </form>

          {query && !isSearching && searchResults.length === 0 && (
            <p className="text-xs text-gray-400 mb-4">Chưa có kết quả. Hãy bấm "Tìm kiếm".</p>
          )}
          {searchResults.length > 0 && (
            <div className="space-y-2 mb-6">
              {searchResults.map((u) => (
                <div key={u._id} className="flex items-center gap-3 border border-gray-100 rounded-2xl p-3">
                  <Avatar user={u} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{u.name}</p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  </div>
                  <button
                    onClick={() => sendRequest(u._id)}
                    className="bg-indigo-50 hover:bg-indigo-100 text-[#5c40e8] text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Kết bạn
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Lời mời đang chờ */}
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-gray-900">
              Lời mời đang chờ
              {requests.length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {requests.length}
                </span>
              )}
            </h4>
          </div>
          {requests.length === 0 ? (
            <p className="text-sm text-gray-400 mb-6">Không có lời mời nào.</p>
          ) : (
            <div className="space-y-3 mb-6">
              {requests.map((r) => (
                <div key={r._id} className="border border-gray-100 rounded-2xl p-3 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar user={r.sender} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{r.sender.name}</p>
                      <p className="text-xs text-gray-500 truncate">{r.sender.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptRequest(r._id)}
                      className="flex-1 bg-[#5c40e8] hover:bg-[#4a32c3] text-white text-sm font-semibold py-2 rounded-lg flex items-center justify-center gap-1"
                    >
                      <Check className="w-4 h-4" /> Chấp nhận
                    </button>
                    <button
                      onClick={() => rejectRequest(r._id)}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-semibold px-4 rounded-lg"
                    >
                      Từ chối
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Gợi ý kết bạn */}
          <h4 className="text-sm font-bold text-gray-900 mb-3">Gợi ý kết bạn</h4>
          {suggestions.length === 0 ? (
            <p className="text-sm text-gray-400 mb-6">Chưa có gợi ý nào.</p>
          ) : (
            <div className="space-y-2 mb-6">
              {suggestions.map((s) => (
                <div key={s._id} className="flex items-center gap-3 border border-gray-100 rounded-2xl p-3">
                  <Avatar user={s} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{s.name}</p>
                    <p className="text-xs text-gray-500 truncate">{s.email}</p>
                  </div>
                  <button
                    onClick={() => sendRequest(s._id)}
                    className="bg-indigo-50 hover:bg-indigo-100 text-[#5c40e8] text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Kết bạn
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ID của bạn */}
          <div className="bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl p-4">
            <p className="text-sm font-bold text-gray-800 mb-1">ID của bạn</p>
            <p className="text-xs text-gray-600 mb-3 break-all">{authUser?._id}</p>
            <button
              onClick={handleCopyId}
              className="w-full bg-white text-gray-700 text-sm font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5"
            >
              <Copy className="w-4 h-4" /> {copied ? 'Đã sao chép!' : 'Sao chép ID'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;