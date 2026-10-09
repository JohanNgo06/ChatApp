import React, { useState } from 'react';
import { 
  MessageSquare, AtSign, Lock, Eye, EyeOff, 
  ArrowRight, CheckCheck, Download, Heart 
} from 'lucide-react';

const SignInPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: Gọi hàm đăng nhập từ useAuthStore của bạn tại đây
    console.log("Submit login:", formData);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f3f4f8] p-4 font-sans">
      {/* Khung Main Card */}
      <div className="w-full max-w-[1100px] flex bg-white rounded-3xl shadow-2xl overflow-hidden min-h-[650px]">
        
        {/* ================= PHẦN TRÁI: FORM ĐĂNG NHẬP ================= */}
        <div className="w-full lg:w-1/2 p-10 lg:p-14 flex flex-col justify-center bg-white z-10 relative">
          
          {/* Logo & Tên App */}
          <div className="flex items-center gap-3 mb-10">
            <div className="bg-[#5c40e8] p-2.5 rounded-xl shadow-lg shadow-indigo-200">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-extrabold text-gray-900 tracking-tight">PulseChat</span>
            <span className="bg-blue-100 text-blue-600 text-xs font-bold px-2.5 py-1 rounded-full">v2.4</span>
          </div>

          {/* Tiêu đề */}
          <h1 className="text-4xl font-bold text-gray-900 mb-3 tracking-tight">Chào mừng trở lại! 👋</h1>
          <p className="text-gray-500 mb-10 text-[15px]">Kết nối và trò chuyện cùng bạn bè, đồng nghiệp không giới hạn.</p>

          {/* Form nhập liệu */}
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Input Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email hoặc Tên đăng nhập</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <AtSign className="h-5 w-5 text-gray-400 group-focus-within:text-[#5c40e8] transition-colors" />
                </div>
                <input
                  type="email"
                  className="block w-full pl-12 pr-4 py-3.5 bg-[#f8f9fa] border border-transparent rounded-2xl text-gray-900 placeholder-gray-400 focus:border-[#5c40e8] focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all outline-none"
                  placeholder="name@pulsechat.io"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Input Mật khẩu */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Mật khẩu</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-[#5c40e8] transition-colors" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  className="block w-full pl-12 pr-12 py-3.5 bg-[#f8f9fa] border border-transparent rounded-2xl text-gray-900 placeholder-gray-400 focus:border-[#5c40e8] focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all outline-none"
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Quên mật khẩu & Ghi nhớ */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center cursor-pointer group">
                <input type="checkbox" className="w-4 h-4 text-[#5c40e8] border-gray-300 rounded focus:ring-[#5c40e8] cursor-pointer" />
                <span className="ml-2 text-sm text-gray-600 group-hover:text-gray-800 transition-colors">Ghi nhớ đăng nhập</span>
              </label>
              <a href="#" className="text-sm text-[#5c40e8] hover:text-[#4a32c3] font-semibold hover:underline">Quên mật khẩu?</a>
            </div>

            {/* Nút Đăng nhập */}
            <button
              type="submit"
              className="w-full bg-[#5c40e8] hover:bg-[#4a32c3] active:scale-[0.98] text-white font-semibold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 mt-2 shadow-lg shadow-indigo-200"
            >
              Đăng nhập ngay
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center text-sm text-gray-600">
            Chưa có tài khoản? <a href="#" className="text-[#5c40e8] font-bold hover:underline ml-1">Đăng ký miễn phí</a>
          </div>
        </div>

        {/* ================= PHẦN PHẢI: MOCKUP CHAT UI (Ẩn trên Mobile, hiện trên PC) ================= */}
        <div className="hidden lg:flex w-1/2 bg-[#eef2ff] p-12 flex-col relative overflow-hidden justify-center">
          
          {/* Background Gradient mờ ảo */}
          <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-60"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-60"></div>

          <h2 className="text-3xl font-bold text-gray-800 mb-10 z-10 relative">Nhắn tin tức thì, chia sẻ dữ liệu an toàn.</h2>

          {/* Container giả lập Chat */}
          <div className="flex flex-col gap-6 w-full max-w-md z-10 relative">
            
            {/* Tin nhắn 1 */}
            <div className="flex items-start gap-3">
              <div className="relative">
                <img src="https://i.pravatar.cc/150?img=47" alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-gray-200 shadow-sm"/>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
              </div>
              <div className="flex flex-col">
                <div className="flex items-baseline gap-2 mb-1.5 ml-1">
                  <span className="text-xs font-bold text-gray-700">Khánh Linh</span>
                  <span className="text-[10px] text-gray-400">14:58</span>
                </div>
                <div className="bg-white px-5 py-3 rounded-2xl rounded-tl-sm shadow-sm text-[14px] text-gray-800">
                  Họp nhóm thiết kế lúc 3h nhé cả team! 🚀
                </div>
              </div>
            </div>

            {/* Tin nhắn 2 (Mình gửi) */}
            <div className="flex flex-col items-end w-full mt-2">
              <div className="bg-[#5c40e8] px-5 py-3 rounded-2xl rounded-tr-sm shadow-md text-[14px] text-white relative">
                Tệp thiết kế đã cập nhật 👍
                {/* Reaction Tim */}
                <div className="absolute -bottom-3.5 left-4 bg-white shadow-md rounded-full px-2 py-0.5 flex items-center gap-1 border border-gray-100">
                  <Heart className="w-3 h-3 text-red-500 fill-red-500" />
                  <span className="text-[11px] text-gray-700 font-bold">3</span>
                </div>
              </div>
              <div className="flex items-center gap-1 mt-1.5 mr-1">
                <span className="text-[10px] text-gray-400">14:59</span>
                <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
              </div>
            </div>

            {/* Tin nhắn 3 (File Figma) */}
            <div className="flex items-start gap-3 mt-4">
              <div className="relative">
                <img src="https://i.pravatar.cc/150?img=11" alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-gray-200 shadow-sm"/>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
              </div>
              <div className="flex flex-col w-full">
                <div className="flex items-baseline gap-2 mb-1.5 ml-1">
                  <span className="text-xs font-bold text-gray-700">Minh Quân</span>
                  <span className="text-[10px] text-gray-400">15:01</span>
                </div>
                <div className="bg-white p-3.5 rounded-2xl rounded-tl-sm shadow-sm flex items-center justify-between w-[300px]">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-2.5 rounded-xl text-purple-600">
                      <div className="w-5 h-5 font-bold flex items-center justify-center text-sm">F</div>
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-gray-800">PulseChat_Design_v2.fig</p>
                      <p className="text-[11px] text-gray-400 font-medium mt-0.5">24.8 MB • Đã tải lên</p>
                    </div>
                  </div>
                  <button className="p-2 hover:bg-gray-100 rounded-full transition-colors text-[#5c40e8]">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Tin nhắn 4 (File Zip) */}
            <div className="flex items-start gap-3 mt-1">
              <div className="w-10 h-10 opacity-0"></div> {/* Spacer giữ alignment */}
              <div className="flex flex-col w-full">
                <div className="flex items-baseline gap-2 mb-1.5 ml-1">
                  <span className="text-xs font-bold text-gray-700">Minh Quân</span>
                  <span className="text-[10px] text-gray-400">15:04</span>
                </div>
                <div className="bg-white p-3.5 rounded-2xl rounded-tl-sm shadow-sm flex items-center justify-between w-[300px]">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-50 p-2.5 rounded-xl w-10 h-10"></div>
                    <div>
                      <p className="text-[13px] font-bold text-gray-800">PulseChat_Assets_v2.zip</p>
                      <p className="text-[11px] text-gray-400 font-medium mt-0.5">18.2 MB • Đã tải lên</p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-50"></div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default SignInPage;