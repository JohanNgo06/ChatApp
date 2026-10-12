import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Edit, Search, UserPlus, X, AtSign, Check, Loader2, LogOut, Settings, Camera, Lock, User, Users
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useFriendStore } from '../store/useFriendStore';
import toast from 'react-hot-toast';

const Avatar = ({ user, size = 'w-10 h-10' }) =>
  user?.profilePic ? (
    <img src={user.profilePic} alt={user.name} className={`${size} rounded-full object-cover shrink-0 shadow-sm`} />
  ) : (
    <div className={`${size} rounded-full bg-indigo-100 text-[#5c40e8] font-bold flex items-center justify-center shrink-0 shadow-sm`}>
      {user?.name?.[0]?.toUpperCase() || '?'}
    </div>
  );

const HomePage = () => {
  const navigate = useNavigate();
  const { authUser, signout, updateProfile, isUpdatingProfile } = useAuthStore();
  const {
    friends, requests, suggestions, searchResults,
    isLoading, isSearching, error,
    fetchAll, searchUsers, clearSearch,
    sendRequest, acceptRequest, rejectRequest,
    subscribeToFriendEvents,
    unsubscribeFromFriendEvents
  } = useFriendStore();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  
  // State mở Tab Thêm bạn bè trên Mobile
  const [isAddFriendOpenMobile, setIsAddFriendOpenMobile] = useState(false);
  
  // State Modal Cập nhật hồ sơ
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileData, setProfileData] = useState({ name: '', password: '' });
  const [previewImg, setPreviewImg] = useState(null);

  useEffect(() => {
    fetchAll();
    subscribeToFriendEvents();
    return () => unsubscribeFromFriendEvents();
  }, [fetchAll, subscribeToFriendEvents, unsubscribeFromFriendEvents]);

  useEffect(() => {
    if (isProfileModalOpen && authUser) {
      setProfileData({ name: authUser.name, password: '' });
      setPreviewImg(authUser.profilePic);
    }
  }, [isProfileModalOpen, authUser]);

  const handleSearch = (e) => {
    e.preventDefault();
    searchUsers(query);
  };

  const handleImgChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Chỉ chấp nhận file ảnh");
    if (file.size > 3 * 1024 * 1024) return toast.error("Kích thước ảnh tối đa 3MB");

    const reader = new FileReader();
    reader.onload = () => setPreviewImg(reader.result);
    reader.readAsDataURL(file);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    const payload = {};
    if (profileData.name !== authUser.name) payload.name = profileData.name;
    if (profileData.password) payload.password = profileData.password;
    if (previewImg && previewImg !== authUser.profilePic) payload.profilePic = previewImg;

    if (Object.keys(payload).length === 0) {
      toast("Không có thông tin nào thay đổi", { icon: "ℹ️" });
      return setIsProfileModalOpen(false);
    }

    const success = await updateProfile(payload);
    if (success) setIsProfileModalOpen(false);
  };

  const filteredFriends = friends.filter((f) =>
    f.name?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="h-screen w-full flex bg-white font-sans overflow-hidden">
      
      {/* ===== CỘT TRÁI: DANH SÁCH BẠN BÈ ===== */}
      <div className={`w-full md:w-[360px] lg:w-[400px] flex flex-col bg-white border-r border-gray-100 shrink-0 shadow-sm z-10 ${isAddFriendOpenMobile ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-5 pb-3">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">Danh bạ</h2>
              <span className="bg-indigo-50 text-[#5c40e8] text-xs font-bold px-2 py-0.5 rounded-full">
                {friends.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsAddFriendOpenMobile(true)}
                className="md:hidden p-2 bg-indigo-50 text-[#5c40e8] rounded-full transition-colors"
              >
                <UserPlus className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => navigate('/chatpage')}
                className="p-2 bg-gray-50 text-gray-600 hover:bg-[#eef0ff] hover:text-[#5c40e8] rounded-full transition-colors"
                title="Mở đoạn chat"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={signout}
                className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-full transition-colors"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* KHUNG PROFILE */}
          <div 
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center gap-3 p-3 mb-4 bg-gradient-to-r from-gray-50 to-white hover:from-indigo-50 hover:to-white border border-gray-100 hover:border-indigo-100 rounded-2xl cursor-pointer transition-all group"
          >
            <div className="relative">
              <Avatar user={authUser} size="w-12 h-12" />
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-gray-900 truncate group-hover:text-[#5c40e8] transition-colors">{authUser?.name}</h4>
              <p className="text-xs text-gray-500 truncate">Thiết lập tài khoản</p>
            </div>
            <div className="p-2 bg-white rounded-full text-gray-400 group-hover:text-[#5c40e8] shadow-sm transition-colors">
              <Settings className="w-4 h-4" />
            </div>
          </div>

          {/* Ô TÌM KIẾM BẠN BÈ */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-[#f4f5f7] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#5c40e8]/20 focus:bg-white transition-all"
              placeholder="Tìm kiếm bạn bè..."
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5 custom-scrollbar">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-[#5c40e8]" />
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-6">
              <div className="bg-gray-50 p-4 rounded-full mb-3">
                <Users className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">Bạn chưa có bạn bè nào.</p>
              <p className="text-xs text-gray-400 mt-1">Hãy kết nối với mọi người ở khung bên phải nhé!</p>
            </div>
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

      {/* ===== CỘT PHẢI: KHÁM PHÁ & THÊM BẠN BÈ (DASHBOARD) ===== */}
      <div className={`flex-1 md:bg-[#f8f9fa] overflow-y-auto custom-scrollbar ${isAddFriendOpenMobile ? 'block' : 'hidden md:block'}`}>
        <div className="max-w-[1000px] mx-auto p-4 md:p-8 min-h-full flex flex-col">
          
          {/* Header Mobile */}
          <div className="md:hidden flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsAddFriendOpenMobile(false)}
                className="p-1.5 -ml-2 bg-gray-50 text-gray-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-bold text-gray-900">Thêm bạn bè</h2>
            </div>
            {requests.length > 0 && (
              <span className="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                {requests.length} Lời mời
              </span>
            )}
          </div>

          {/* Banner Khám Phá (Chỉ hiện PC) */}
          <div className="hidden md:flex bg-gradient-to-r from-[#5c40e8] to-[#8f7bf0] rounded-3xl p-8 text-white items-center justify-between shadow-lg shadow-indigo-200/50 mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
            <div className="relative z-10">
              <h2 className="text-3xl font-bold mb-2">Khám phá & Kết nối</h2>
              <p className="text-indigo-100 text-sm md:text-base max-w-md">
                Tìm kiếm bạn bè, đồng nghiệp và mở rộng vòng kết nối của bạn trên WhatSoup.
              </p>
            </div>
            <div className="relative z-10 bg-white/20 p-4 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
              <UserPlus className="w-12 h-12 text-white" />
            </div>
          </div>

          {error && <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>}

          {/* Layout 2 Cột trên PC */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 items-start">
            
            {/* CỘT 1: TÌM KIẾM & GỢI Ý */}
            <div className="bg-white md:rounded-3xl md:shadow-sm md:border md:border-gray-100 md:p-6 flex flex-col h-fit">
              <h3 className="text-lg font-bold text-gray-900 mb-4 hidden md:block">Tìm kiếm người dùng</h3>
              
              <form onSubmit={handleSearch} className="flex gap-2 mb-6">
                <div className="relative flex-1">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      if (!e.target.value) clearSearch();
                    }}
                    className="w-full pl-10 pr-3 py-3 bg-[#f4f5f7] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#5c40e8]/20 focus:bg-white transition-all"
                    placeholder="Nhập Email hoặc Tên..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="bg-[#5c40e8] hover:bg-[#4a32c3] disabled:bg-[#a696eb] text-white text-sm font-semibold px-5 rounded-xl transition-colors shrink-0 flex items-center justify-center"
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tìm'}
                </button>
              </form>

              {/* Kết quả tìm kiếm */}
              {query && !isSearching && searchResults.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-400">Không tìm thấy người dùng phù hợp.</p>
                </div>
              )}
              {searchResults.length > 0 && (
                <div className="space-y-3 mb-6">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Kết quả tìm kiếm</p>
                  {searchResults.map((u) => (
                    <div key={u._id} className="flex items-center gap-3 border border-gray-100 hover:border-indigo-100 rounded-2xl p-3 bg-white transition-all shadow-sm hover:shadow-md">
                      <Avatar user={u} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{u.name}</p>
                        <p className="text-xs text-gray-500 truncate">{u.email}</p>
                      </div>
                      <button
                        onClick={() => sendRequest(u._id)}
                        className="bg-indigo-50 hover:bg-[#5c40e8] hover:text-white text-[#5c40e8] text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1 transition-colors shrink-0"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Kết bạn
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Gợi ý kết bạn */}
              {!query && suggestions.length > 0 && (
                <div className="space-y-3 mt-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Có thể bạn quen biết</p>
                  {suggestions.map((s) => (
                    <div key={s._id} className="flex items-center gap-3 border border-gray-100 hover:border-indigo-100 rounded-2xl p-3 bg-white transition-all shadow-sm hover:shadow-md">
                      <Avatar user={s} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{s.name}</p>
                        <p className="text-xs text-gray-500 truncate">{s.email}</p>
                      </div>
                      <button
                        onClick={() => sendRequest(s._id)}
                        className="bg-gray-50 hover:bg-[#5c40e8] hover:text-white text-gray-600 text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1 transition-colors shrink-0"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Kết bạn
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CỘT 2: LỜI MỜI ĐANG CHỜ */}
            <div className="bg-white md:rounded-3xl md:shadow-sm md:border md:border-gray-100 md:p-6 flex flex-col h-fit mt-6 md:mt-0">
              <div className="flex items-center justify-between mb-4 md:mb-6 border-t md:border-t-0 pt-6 md:pt-0 border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 flex items-center">
                  Lời mời kết bạn
                  {requests.length > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full hidden md:inline-block">
                      {requests.length}
                    </span>
                  )}
                </h3>
              </div>

              {requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50">
                  <div className="bg-white p-4 rounded-full mb-3 shadow-sm">
                    <Users className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">Không có lời mời nào.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {requests.map((r) => (
                    <div key={r._id} className="border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow bg-white">
                      <div className="flex items-center gap-3 mb-4">
                        <Avatar user={r.sender} size="w-12 h-12" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{r.sender.name}</p>
                          <p className="text-xs text-gray-500 truncate">{r.sender.email}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => acceptRequest(r._id)}
                          className="flex-1 bg-[#5c40e8] hover:bg-[#4a32c3] text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                        >
                          <Check className="w-4 h-4" /> Chấp nhận
                        </button>
                        <button
                          onClick={() => rejectRequest(r._id)}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-semibold px-5 rounded-xl transition-colors"
                        >
                          Từ chối
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ================= MODAL CẬP NHẬT HỒ SƠ ================= */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 md:p-5 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Chỉnh sửa hồ sơ</h2>
              <button 
                onClick={() => setIsProfileModalOpen(false)} 
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="p-4 md:p-6 overflow-y-auto custom-scrollbar">
              <div className="flex flex-col items-center mb-6">
                <div className="relative">
                  <img
                    src={previewImg || "/avatar.png"} 
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-4 border-indigo-50 shadow-sm"
                  />
                  <label
                    htmlFor="avatar-upload"
                    className={`absolute bottom-0 right-0 bg-[#5c40e8] hover:scale-105 p-2 rounded-full cursor-pointer transition-all shadow-md ${isUpdatingProfile ? "animate-pulse pointer-events-none" : ""}`}
                  >
                    <Camera className="w-4 h-4 text-white" />
                    <input
                      type="file"
                      id="avatar-upload"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImgChange}
                      disabled={isUpdatingProfile}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={authUser?.email || ""}
                      disabled
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border border-transparent rounded-xl text-sm text-gray-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tên hiển thị</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      disabled={isUpdatingProfile}
                      className="w-full pl-10 pr-4 py-2.5 bg-[#f4f5f7] focus:bg-white rounded-xl text-sm outline-none border border-transparent focus:border-[#5c40e8] transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Mật khẩu mới</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="password"
                      value={profileData.password}
                      onChange={(e) => setProfileData({ ...profileData, password: e.target.value })}
                      disabled={isUpdatingProfile}
                      className="w-full pl-10 pr-4 py-2.5 bg-[#f4f5f7] focus:bg-white rounded-xl text-sm outline-none border border-transparent focus:border-[#5c40e8] transition-all"
                      placeholder="Để trống nếu không đổi..."
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isUpdatingProfile || (!profileData.password && profileData.name === authUser.name && previewImg === authUser.profilePic)}
                className="w-full mt-6 bg-[#5c40e8] hover:bg-[#4a32c3] disabled:bg-[#a696eb] text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                {isUpdatingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : "Lưu thay đổi"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;