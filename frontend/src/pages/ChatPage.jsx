import React from 'react';
import { 
  Edit, LogOut, Home, Search, MoreVertical, 
  Paperclip, Image as ImageIcon, Send, CheckCheck, MoreHorizontal 
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore'; // Import store để gọi hàm đăng xuất

const ChatPage = () => {
  // Lấy hàm logout từ store
  const { logout } = useAuthStore();

  return (
    <div className="h-screen w-full flex bg-[#f0f2f5] font-sans overflow-hidden">
      
      {/* ================= CỘT TRÁI: DANH SÁCH CHAT ================= */}
      <div className="w-[360px] lg:w-[400px] flex flex-col bg-white border-r border-gray-100 shrink-0 z-10 shadow-sm">
        
        {/* --- Header Danh sách Chat --- */}
        <div className="p-5 pb-3">
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">Đoạn chat</h2>
              <span className="bg-indigo-50 text-[#5c40e8] text-xs font-bold px-2 py-0.5 rounded-full">12</span>
            </div>
            
            {/* Nhóm nút hành động: Home, Edit, LogOut */}
            <div className="flex items-center gap-1.5">
              <button 
                className="p-2 bg-gray-50 text-gray-600 hover:bg-indigo-50 hover:text-[#5c40e8] rounded-full transition-colors"
                title="Trang chủ"
              >
                <Home className="w-4 h-4" />
              </button>
              <button 
                className="p-2 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                title="Tạo tin nhắn mới"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button 
                onClick={logout}
                className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-full transition-colors"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* --- Tabs Lọc --- */}
          <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
            <button className="bg-[#5c40e8] text-white text-xs font-semibold px-4 py-1.5 rounded-full shrink-0 shadow-md shadow-indigo-200">
              Tất cả
            </button>
            <button className="bg-[#f4f5f7] text-gray-600 hover:bg-gray-200 text-xs font-semibold px-4 py-1.5 rounded-full flex items-center gap-1.5 shrink-0 transition-colors">
              Chưa đọc <span className="bg-[#5c40e8] text-white text-[10px] px-1.5 rounded-full">3</span>
            </button>
            <button className="bg-[#f4f5f7] text-gray-600 hover:bg-gray-200 text-xs font-semibold px-4 py-1.5 rounded-full shrink-0 transition-colors">Nhóm 4</button>
            <button className="bg-[#f4f5f7] text-gray-600 hover:bg-gray-200 text-xs font-semibold px-4 py-1.5 rounded-full shrink-0 transition-colors">Ghim (2)</button>
          </div>

          {/* --- Ô Tìm kiếm --- */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-9 pr-10 py-2.5 bg-[#f4f5f7] rounded-xl text-sm placeholder-gray-500 outline-none focus:ring-2 focus:ring-[#5c40e8]/20 focus:bg-white transition-all"
              placeholder="Lọc hội thoại, tệp tin..."
            />
            <button className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* --- Danh sách Chat (Scrollable) --- */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">
          
          {/* Chat Item: ĐANG CHỌN (Active) */}
          <div className="flex items-center gap-3 p-3 bg-[#f8f9fa] rounded-xl cursor-pointer relative group">
            {/* Thanh bar đánh dấu Active */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#5c40e8] rounded-r-md"></div>
            
            <div className="relative ml-2">
              <img src="https://i.pravatar.cc/150?img=47" className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" alt="avatar" />
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-0.5">
                <h4 className="text-sm font-bold text-gray-900 truncate">Khánh Linh</h4>
                <span className="text-xs text-[#5c40e8] font-bold">14:32</span>
              </div>
              <p className="text-[13px] text-[#5c40e8] font-medium truncate italic">
                <span className="inline-block w-1.5 h-1.5 bg-[#5c40e8] rounded-full mr-1.5 mb-0.5 animate-pulse"></span>
                Đang soạn tin nhắn...
              </p>
            </div>
          </div>

          {/* Chat Item 2 */}
          <div className="flex items-center gap-3 p-3 hover:bg-[#f4f5f7] rounded-xl cursor-pointer transition-colors ml-2">
            <div className="relative">
              <img src="https://i.pravatar.cc/150?img=11" className="w-12 h-12 rounded-full object-cover border-2 border-transparent" alt="avatar" />
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-0.5">
                <h4 className="text-sm font-bold text-gray-900 truncate">Minh Quân</h4>
                <span className="text-[11px] text-gray-400 font-medium">5m trước</span>
              </div>
              <p className="text-[13px] text-gray-500 truncate flex items-center gap-1">
                <span className="text-[#5c40e8] font-bold">@</span> PulseChat_Design_v2.fig
              </p>
            </div>
          </div>

          {/* Chat Item 3 (Nhóm) */}
          <div className="flex items-center gap-3 p-3 hover:bg-[#f4f5f7] rounded-xl cursor-pointer transition-colors ml-2">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-[#5c40e8] font-bold">PS</div>
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-gray-300 border-2 border-white rounded-full"></div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-0.5">
                <h4 className="text-sm font-bold text-gray-900 truncate">Product Studio</h4>
                <span className="text-[11px] text-gray-400 font-medium">11:15</span>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-[13px] text-gray-500 truncate pr-2">
                  <span className="text-gray-800 font-semibold">Tuấn:</span> Đã cập nhật roadmap Q3...
                </p>
                <div className="bg-[#5c40e8] text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shrink-0">2</div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ================= CỘT PHẢI: KHUNG CHAT ACTIVE ================= */}
      {/* ================= CỘT PHẢI: KHUNG CHAT ACTIVE ================= */}
      <div className="flex-1 flex flex-col bg-[#f0f2f5] relative">
        
        {/* --- Chat Header --- */}
        <div className="h-[76px] bg-white border-b border-gray-100 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative cursor-pointer">
              <img src="https://i.pravatar.cc/150?img=47" className="w-10 h-10 rounded-full object-cover" alt="avatar" />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 leading-tight">Khánh Linh</h3>
              <p className="text-xs text-green-600 font-medium flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                Đang hoạt động
              </p>
            </div>
          </div>
        </div>

        {/* --- Khung Tin Nhắn (Scrollable) --- */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          
          <div className="flex justify-center my-2">
            <span className="bg-gray-200/60 text-gray-600 text-xs font-semibold px-3 py-1 rounded-full">
              Hôm nay, 14:30
            </span>
          </div>

          {/* Tin nhắn ĐẾN (Trái) - Đã giới hạn max-w-[60%] */}
          <div className="flex items-start gap-3 max-w-[60%]">
            <img src="https://i.pravatar.cc/150?img=47" className="w-8 h-8 rounded-full object-cover mt-1" alt="avatar" />
            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-baseline gap-2 ml-1">
                <span className="text-xs font-bold text-gray-700">Khánh Linh</span>
                <span className="text-[10px] text-gray-400">14:30</span>
              </div>
              <div className="bg-white p-4 rounded-2xl rounded-tl-sm shadow-sm border border-gray-100">
                <p className="text-[14px] text-gray-800 leading-relaxed break-words">
                  Chào bạn! Mình đã hoàn thiện prototype cho luồng nhắn tin và chia sẻ tài liệu mới rồi nhé! Bạn xem qua bản thiết kế xem có cần tinh chỉnh gì không ✨
                </p>
              </div>
            </div>
          </div>

          {/* Tin nhắn ĐI (Phải) - Đã giới hạn max-w-[60%] */}
          <div className="flex items-start justify-end gap-3 max-w-[60%] self-end">
            <div className="flex flex-col gap-1 w-full items-end">
              <div className="flex items-baseline gap-2 mr-1">
                <span className="text-[10px] text-gray-400">14:31</span>
                <span className="text-xs font-bold text-gray-700">Bạn</span>
              </div>
              <div className="bg-[#5c40e8] p-4 rounded-2xl rounded-tr-sm shadow-md">
                <p className="text-[14px] text-white leading-relaxed break-words">
                  Tuyệt quá Linh ơi! Giao diện mới nhìn rất mượt, màu sắc Vibrant Connection rất nổi bật. Để mình kiểm tra file Figma và audio recap của bạn nhé! 👍
                </p>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] text-gray-400 font-medium">Đã xem 14:32</span>
                <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
              </div>
            </div>
          </div>
        </div>

        {/* --- Vùng Nhập Tin Nhắn & Typing Indicator (Bottom Cố định) --- */}
        <div className="px-6 pb-6 pt-2 bg-[#f0f2f5] shrink-0 flex flex-col">
          
          {/* Typing Indicator đã được di chuyển xuống đây (Sát trên thanh Input) */}
          <div className="flex items-center gap-2 text-gray-500 ml-2 mb-3">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-[#5c40e8] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-1.5 h-1.5 bg-[#5c40e8] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1.5 h-1.5 bg-[#5c40e8] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
            <span className="text-xs font-medium italic">Khánh Linh đang nhập tin nhắn...</span>
          </div>

          {/* Thanh Input */}
          <div className="bg-white rounded-2xl flex items-center p-2 shadow-sm border border-gray-100 min-h-[60px]">
            <div className="flex items-center gap-1 px-2">
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors">
                <Paperclip className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors">
                <ImageIcon className="w-5 h-5" />
              </button>
            </div>
            
            <input 
              type="text" 
              className="flex-1 bg-transparent border-none focus:ring-0 outline-none px-2 text-[15px] text-gray-800 placeholder-gray-400"
              placeholder="Nhấn Enter để gửi"
            />
            
            <button className="bg-[#5c40e8] hover:bg-[#4a32c3] text-white p-3 rounded-full transition-transform active:scale-95 shadow-md shadow-indigo-200 mr-1">
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ChatPage;