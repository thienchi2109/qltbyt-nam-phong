"use client"

import { useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import {
  User,
  Lock,
  Globe,
  BarChart3,
  Wrench,
  Calendar,
  FileText,
  QrCode,
  Settings,
  Shield,
  Zap,
  Heart,
  Activity,
  CheckCircle2,
  Stethoscope,
  Cpu,
} from "lucide-react"
import { Logo } from "@/components/icons"
import { useLanguage } from "@/contexts/language-context"

export default function LoginPageRedesign() {
  const { currentLanguage, setLanguage, t } = useLanguage()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      })
      if (!result || result.error) {
        setError(t("login.error") || "Tên đăng nhập hoặc mật khẩu không đúng")
        setIsLoading(false)
        return
      }
      window.location.href = "/dashboard"
    } catch (err) {
      setError(t("login.error") || "Tên đăng nhập hoặc mật khẩu không đúng")
      setIsLoading(false)
    }
  }

  const toggleLanguage = () => {
    const newLang = currentLanguage.code === 'en'
      ? { code: 'vi' as const, name: 'Tiếng Việt' }
      : { code: 'en' as const, name: 'English' }
    setLanguage(newLang)
  }

  // Enhanced features with medical focus
  const features = [
    {
      icon: BarChart3,
      title: "Dashboard Thông Minh",
      description: "Giám sát realtime tình trạng thiết bị y tế với báo cáo và cảnh báo tức thì",
      gradient: "from-blue-500 via-blue-600 to-cyan-500",
      iconColor: "text-blue-600"
    },
    {
      icon: Settings,
      title: "Quản Lý Toàn Diện",
      description: "Theo dõi vòng đời hoàn chỉnh của thiết bị y tế từ mua sắm đến thanh lý",
      gradient: "from-purple-500 via-purple-600 to-pink-500",
      iconColor: "text-purple-600"
    },
    {
      icon: Wrench,
      title: "Sửa Chữa Nhanh Chóng",
      description: "Quy trình phê duyệt tự động và theo dõi tiến độ sửa chữa hiệu quả",
      gradient: "from-orange-500 via-red-500 to-red-600",
      iconColor: "text-orange-600"
    },
    {
      icon: Calendar,
      title: "Bảo Trì Định Kỳ",
      description: "Lập lịch bảo trì thông minh, đảm bảo thiết bị luôn hoạt động tối ưu",
      gradient: "from-green-500 via-emerald-500 to-teal-500",
      iconColor: "text-green-600"
    },
    {
      icon: FileText,
      title: "Báo Cáo Chi Tiết",
      description: "Phân tích dữ liệu chuyên sâu với biểu đồ trực quan hỗ trợ quyết định",
      gradient: "from-indigo-500 via-blue-600 to-cyan-500",
      iconColor: "text-indigo-600"
    },
    {
      icon: QrCode,
      title: "QR Code Thông Minh",
      description: "Truy xuất nguồn gốc và lịch sử thiết bị nhanh chóng chỉ với một lần quét",
      gradient: "from-teal-500 via-cyan-500 to-blue-500",
      iconColor: "text-teal-600"
    }
  ]

  // Trust badges with medical theme
  const trustBadges = [
    {
      icon: Activity,
      value: "99.9%",
      label: "Thời gian hoạt động",
      description: "Uptime",
      color: "text-green-500",
      bgColor: "bg-green-50",
      borderColor: "border-green-200"
    },
    {
      icon: Zap,
      value: "<2.5s",
      label: "Thời gian phản hồi",
      description: "Response Time",
      color: "text-yellow-500",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200"
    },
    {
      icon: Shield,
      value: "100%",
      label: "Bảo mật dữ liệu",
      description: "Security",
      color: "text-blue-500",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200"
    },
    {
      icon: Heart,
      value: "24/7",
      label: "Hỗ trợ kỹ thuật",
      description: "Support",
      color: "text-red-500",
      bgColor: "bg-red-50",
      borderColor: "border-red-200"
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 relative overflow-hidden">
      {/* Medical Cross Pattern Background */}
      <div className="absolute inset-0 opacity-[0.015]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              repeating-linear-gradient(0deg, transparent, transparent 79px, rgba(0, 145, 234, 1) 79px, rgba(0, 145, 234, 1) 80px),
              repeating-linear-gradient(90deg, transparent, transparent 79px, rgba(0, 145, 234, 1) 79px, rgba(0, 145, 234, 1) 80px)
            `
          }}
        />
      </div>

      {/* Animated Medical Icons Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <Stethoscope className="absolute top-20 left-20 w-32 h-32 text-blue-200/10 animate-pulse" style={{ animationDuration: '4s' }} />
        <Activity className="absolute bottom-40 right-32 w-40 h-40 text-cyan-200/10 animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
        <Cpu className="absolute top-1/2 left-10 w-24 h-24 text-purple-200/10 animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 min-h-screen">
        {/* Mobile Layout */}
        <div className="lg:hidden">
          <div className="min-h-screen flex items-center justify-center p-4">
            <div className={`w-full max-w-md ${mounted ? 'animate-in slide-in-from-top duration-700' : 'opacity-0'}`}>
              {/* Floating Login Card */}
              <div className="bg-white/95 backdrop-blur-xl border border-white/50 rounded-3xl shadow-2xl overflow-hidden">
                {/* Elegant Header */}
                <div className="relative bg-gradient-to-br from-blue-600 via-cyan-600 to-teal-500 px-8 py-10 text-center overflow-hidden">
                  {/* Decorative elements */}
                  <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-20 translate-x-20" />
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-16 -translate-x-16" />

                  <div className="relative z-10">
                    <div className="flex justify-center mb-5">
                      <div className="relative">
                        <div className="absolute inset-0 bg-white/20 rounded-2xl blur-xl animate-pulse" />
                        <div className="relative bg-white p-4 rounded-2xl shadow-xl">
                          <Logo className="w-16 h-16" size={64} />
                        </div>
                      </div>
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">CVMEMS</h2>
                    <p className="text-white/90 text-sm font-medium">
                      Hệ Thống Quản Lý Thiết Bị Y Tế
                    </p>
                  </div>
                </div>

                {/* Form */}
                <div className="p-8 space-y-6">
                  <form onSubmit={handleLogin} className="space-y-5">
                    {error && (
                      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 animate-in slide-in-from-top duration-300">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                          <p className="text-red-700 text-sm font-semibold">{error}</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        <User className="h-4 w-4 inline mr-2 text-blue-600" />
                        {t("login.username") || "Tên đăng nhập"}
                      </label>
                      <div className="relative group">
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 placeholder-slate-400 font-medium text-slate-800 hover:border-slate-300"
                          placeholder={t("login.usernamePlaceholder") || "Nhập tên đăng nhập"}
                          required
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        <Lock className="h-4 w-4 inline mr-2 text-blue-600" />
                        {t("login.password") || "Mật khẩu"}
                      </label>
                      <div className="relative group">
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 placeholder-slate-400 font-medium text-slate-800 hover:border-slate-300"
                          placeholder={t("login.passwordPlaceholder") || "Nhập mật khẩu"}
                          required
                          disabled={isLoading}
                        />
                        <Shield className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 text-white py-4 px-6 rounded-2xl font-bold text-base hover:shadow-xl hover:shadow-blue-500/25 focus:ring-4 focus:ring-blue-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group"
                    >
                      {/* Button shine effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />

                      <span className="flex items-center justify-center gap-2 relative z-10">
                        {isLoading ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            {t("login.signingIn") || "Đang xác thực..."}
                          </>
                        ) : (
                          <>
                            <User className="h-5 w-5" />
                            {t("login.signIn") || "Đăng nhập"}
                          </>
                        )}
                      </span>
                    </button>
                  </form>

                  {/* Language Toggle */}
                  <div className="text-center pt-6 border-t-2 border-slate-100">
                    <button
                      onClick={toggleLanguage}
                      className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2.5 hover:bg-slate-100 hover:border-slate-300 font-semibold"
                    >
                      <Globe className="h-4 w-4" />
                      {currentLanguage.code === 'en' ? 'Tiếng Việt' : 'English'}
                    </button>
                  </div>

                  {/* Footer */}
                  <div className="text-center text-xs text-slate-500 pt-2 font-medium">
                    <p>© 2025 CVMEMS. All rights reserved.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Hero Content Below */}
          <div className={`px-4 pb-8 ${mounted ? 'animate-in slide-in-from-bottom duration-700' : 'opacity-0'}`} style={{ animationDelay: '300ms' }}>
            <div className="max-w-2xl mx-auto space-y-8">
              {/* Trust Badges */}
              <div className="grid grid-cols-2 gap-3">
                {trustBadges.map((badge, index) => (
                  <div
                    key={index}
                    className={`${badge.bgColor} ${badge.borderColor} border-2 rounded-2xl p-4 group hover:shadow-lg transition-all duration-300`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <badge.icon className={`h-5 w-5 ${badge.color}`} />
                      <span className="text-2xl font-bold text-slate-800">{badge.value}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-600 mb-1">{badge.label}</p>
                    <p className="text-xs text-slate-500">{badge.description}</p>
                  </div>
                ))}
              </div>

              {/* Features Grid */}
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-slate-800 text-center mb-4">Tính năng nổi bật</h3>
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className={`bg-white border-2 border-slate-100 rounded-2xl p-4 group hover:border-blue-200 transition-all duration-300 hover:shadow-lg ${mounted ? `animate-in slide-in-from-bottom duration-700` : 'opacity-0'}`}
                    style={{ animationDelay: `${(index + 2) * 100}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`bg-gradient-to-br ${feature.gradient} p-3 rounded-xl shadow-md group-hover:scale-110 transition-transform duration-300 shrink-0`}>
                        <feature.icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors text-sm mb-1">
                          {feature.title}
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Layout - Enhanced 2-Column */}
        <div className="hidden lg:flex min-h-screen items-center p-8 xl:p-12">
          <div className="w-full max-w-[1600px] mx-auto grid lg:grid-cols-[1.2fr,0.8fr] gap-12 xl:gap-16 items-center">

            {/* Left Column - Hero & Features */}
            <div className={`space-y-10 ${mounted ? 'animate-in slide-in-from-left duration-700' : 'opacity-0'}`}>
              {/* Hero Section */}
              <div className="space-y-8">
                {/* System Status Badge */}
                <div className="inline-flex items-center gap-3 bg-green-50 border-2 border-green-200 rounded-full px-5 py-3 text-sm font-bold text-green-700 shadow-lg shadow-green-500/10">
                  <div className="relative">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-75" />
                  </div>
                  Hệ thống hoạt động ổn định
                </div>

                {/* Hero Title */}
                <div className="space-y-6">
                  <h1 className="text-6xl xl:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-600 via-cyan-600 to-teal-500 leading-[1.1] tracking-tight">
                    Quản Lý Thiết Bị
                    <span className="block">Y Tế Thông Minh</span>
                  </h1>

                  <p className="text-xl xl:text-2xl text-slate-600 max-w-2xl leading-relaxed font-medium">
                    Nền tảng quản lý thiết bị y tế chuyên nghiệp, đảm bảo tuân thủ quy định và nâng cao hiệu suất hoạt động của các cơ sở y tế.
                  </p>
                </div>

                {/* Trust Badges Grid */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                  {trustBadges.map((badge, index) => (
                    <div
                      key={index}
                      className={`${badge.bgColor} ${badge.borderColor} border-2 rounded-2xl p-5 group hover:shadow-xl transition-all duration-300 hover:scale-105`}
                      style={{
                        animation: mounted ? `fade-in 0.7s ease-out ${index * 0.1}s both` : 'none'
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <badge.icon className={`h-6 w-6 ${badge.color}`} />
                        <span className="text-3xl font-black text-slate-800">{badge.value}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-700 mb-1">{badge.label}</p>
                      <p className="text-xs text-slate-500 font-medium">{badge.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Features Grid */}
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-1 w-12 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-full" />
                  <h2 className="text-2xl font-bold text-slate-800">Tính năng nổi bật</h2>
                </div>

                <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                  {features.map((feature, index) => (
                    <div
                      key={index}
                      className={`bg-white border-2 border-slate-100 rounded-2xl p-6 group hover:border-blue-200 hover:scale-[1.03] transition-all duration-300 hover:shadow-xl ${mounted ? `animate-in slide-in-from-bottom duration-700` : 'opacity-0'}`}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className={`bg-gradient-to-br ${feature.gradient} p-3.5 rounded-xl shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                            <feature.icon className="h-7 w-7 text-white" />
                          </div>
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors mb-2 text-base">
                            {feature.title}
                          </h3>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            {feature.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Medical Certification Badge */}
              <div className="bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 border-2 border-blue-200 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-gradient-to-br from-blue-600 to-cyan-600 p-3 rounded-xl shrink-0 shadow-lg">
                    <CheckCircle2 className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-blue-900 mb-2 text-lg">
                      🏥 Đạt chuẩn quản lý thiết bị y tế Việt Nam
                    </h4>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      Hệ thống được thiết kế tuân thủ các quy định quản lý thiết bị y tế của Bộ Y Tế,
                      đảm bảo an toàn và hiệu quả trong quản lý trang thiết bị y tế tại các cơ sở khám chữa bệnh.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Floating Login Card */}
            <div className={`flex justify-center items-center ${mounted ? 'animate-in slide-in-from-right duration-700' : 'opacity-0'}`}>
              <div className="w-full max-w-lg relative">
                {/* Glow effect behind card */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-400 via-cyan-400 to-teal-400 rounded-3xl blur-3xl opacity-20 animate-pulse" style={{ animationDuration: '3s' }} />

                {/* Floating Login Card */}
                <div className="relative bg-white/95 backdrop-blur-xl border-2 border-white/50 rounded-3xl shadow-[0_24px_48px_rgba(0,0,0,0.15)] overflow-hidden hover:shadow-[0_32px_64px_rgba(0,0,0,0.2)] transition-all duration-500 hover:scale-[1.02]">

                  {/* Elegant Header with Medical Gradient */}
                  <div className="relative bg-gradient-to-br from-blue-600 via-cyan-600 to-teal-500 px-10 py-12 text-center overflow-hidden">
                    {/* Decorative floating elements */}
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-24 translate-x-24" />
                    <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/10 rounded-full translate-y-20 -translate-x-20" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white/5 rounded-full blur-2xl" />

                    <div className="relative z-10">
                      <div className="flex justify-center mb-6">
                        <div className="relative group">
                          {/* Animated glow ring */}
                          <div className="absolute inset-0 bg-white/30 rounded-3xl blur-2xl animate-pulse group-hover:scale-110 transition-transform duration-500" />
                          <div className="relative bg-white p-5 rounded-3xl shadow-2xl group-hover:scale-105 transition-transform duration-300">
                            <Logo className="w-20 h-20" size={80} />
                          </div>
                        </div>
                      </div>
                      <h2 className="text-4xl font-black text-white mb-3 tracking-tight">CVMEMS</h2>
                      <div className="h-1 w-24 mx-auto bg-white/30 rounded-full mb-3" />
                      <p className="text-white/90 text-base font-bold">
                        Hệ Thống Quản Lý Thiết Bị Y Tế
                      </p>
                    </div>
                  </div>

                  {/* Form Container */}
                  <div className="p-10 space-y-7">
                    <form onSubmit={handleLogin} className="space-y-6">
                      {error && (
                        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 animate-in slide-in-from-top duration-300">
                          <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                            <p className="text-red-700 text-sm font-bold">{error}</p>
                          </div>
                        </div>
                      )}

                      {/* Username Input */}
                      <div className="space-y-3">
                        <label className="block text-sm font-bold text-slate-700">
                          <User className="h-4 w-4 inline mr-2 text-blue-600" />
                          {t("login.username") || "Tên đăng nhập"}
                        </label>
                        <div className="relative group">
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-300 placeholder-slate-400 font-semibold text-slate-800 hover:border-slate-300 text-base"
                            placeholder={t("login.usernamePlaceholder") || "Nhập tên đăng nhập"}
                            required
                            disabled={isLoading}
                          />
                        </div>
                      </div>

                      {/* Password Input */}
                      <div className="space-y-3">
                        <label className="block text-sm font-bold text-slate-700">
                          <Lock className="h-4 w-4 inline mr-2 text-blue-600" />
                          {t("login.password") || "Mật khẩu"}
                        </label>
                        <div className="relative group">
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-300 placeholder-slate-400 font-semibold text-slate-800 hover:border-slate-300 text-base pr-12"
                            placeholder={t("login.passwordPlaceholder") || "Nhập mật khẩu"}
                            required
                            disabled={isLoading}
                          />
                          <Shield className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                        </div>
                      </div>

                      {/* Login Button */}
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 text-white py-5 px-6 rounded-2xl font-black text-base hover:shadow-2xl hover:shadow-blue-500/30 focus:ring-4 focus:ring-blue-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group"
                      >
                        {/* Animated shine effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />

                        <span className="flex items-center justify-center gap-3 relative z-10">
                          {isLoading ? (
                            <>
                              <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                              <span className="text-lg">{t("login.signingIn") || "Đang xác thực..."}</span>
                            </>
                          ) : (
                            <>
                              <User className="h-6 w-6" />
                              <span className="text-lg">{t("login.signIn") || "Đăng nhập"}</span>
                            </>
                          )}
                        </span>
                      </button>
                    </form>

                    {/* Language Toggle */}
                    <div className="text-center pt-6 border-t-2 border-slate-100">
                      <button
                        onClick={toggleLanguage}
                        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors bg-slate-50 border-2 border-slate-200 rounded-xl px-5 py-3 hover:bg-slate-100 hover:border-slate-300 font-bold hover:scale-105 active:scale-95 transition-all duration-300"
                      >
                        <Globe className="h-5 w-5" />
                        {currentLanguage.code === 'en' ? 'Tiếng Việt' : 'English'}
                      </button>
                    </div>

                    {/* Footer */}
                    <div className="text-center text-xs text-slate-500 pt-2 font-semibold">
                      <p>© 2025 CVMEMS. All rights reserved.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
