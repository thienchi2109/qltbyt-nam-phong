"use client"

import { useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { User, Lock } from "lucide-react"
import { Logo } from "@/components/icons"
import { useLanguage } from "@/contexts/language-context"
import { LoginIllustrationPanel } from "./_components/LoginIllustrationPanel"

export default function LoginPage() {
  const { t } = useLanguage()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Safe Base64 encode for Unicode characters
  const safeBase64Encode = (str: string): string => {
    try {
      return btoa(unescape(encodeURIComponent(str)))
    } catch (_error) {
      return btoa(str)
    }
  }

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
      // Success: NextAuth session established; no legacy bridge writes
      // Redirect to dashboard
      window.location.href = "/dashboard"
    } catch (_err) {
      setError(t("login.error") || "Tên đăng nhập hoặc mật khẩu không đúng")
      setIsLoading(false)
    }
  }



  return (
    <main className="flex min-h-screen">
      {/* Left Half — Brand & Illustration (Desktop only) */}
      <LoginIllustrationPanel />

      {/* Right Half — Sign-in Form */}
      <section className="w-full lg:w-1/2 bg-white flex flex-col justify-center items-center px-6 md:px-24 py-12 relative">
        {/* Mobile Logo */}
        <div className="lg:hidden absolute top-8 left-8 flex items-center gap-2">
          <Logo className="w-8 h-8" size={32} />
          <span className="font-bold text-xl text-primary">CVMEMS</span>
        </div>

        <div className={`w-full max-w-md space-y-10 ${mounted ? 'animate-in slide-in-from-right duration-700' : 'opacity-0'}`}>
          {/* Header Text */}
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              {t("login.title") || "Đăng nhập"}
            </h2>
            <p className="text-muted-foreground">
              {t("login.subtitle") || "Chào mừng bạn trở lại"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/20 rounded-xl p-4 animate-in slide-in-from-top duration-300">
                <p className="text-red-600 text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Username */}
            <div className="space-y-2">
              <label htmlFor="login-username" className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                {t("login.username") || "Tên đăng nhập"}
              </label>
              <div className="recessed-input bg-muted rounded-xl px-4 py-3 transition-all duration-200">
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-foreground placeholder:text-muted-foreground/50 text-sm"
                  placeholder={t("login.usernamePlaceholder") || "username@cvmems.com"}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label htmlFor="login-password" className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                {t("login.password") || "Mật khẩu"}
              </label>
              <div className="recessed-input bg-muted rounded-xl px-4 py-3 transition-all duration-200">
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-foreground placeholder:text-muted-foreground/50 text-sm"
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>



            {/* CTA Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-cta-gradient text-white py-4 px-6 rounded-xl font-bold text-base shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t("login.signingIn") || "Đang xác thực..."}
                </>
              ) : (
                <>
                  {t("login.signIn") || "Đăng nhập"}
                  <span className="text-lg">→</span>
                </>
              )}
            </button>
          </form>


        </div>

        {/* Footer */}
        <footer className="absolute bottom-8 w-full px-12 text-center space-y-4">
          <div className="flex justify-center gap-6 text-xs uppercase tracking-widest text-muted-foreground">
            <span className="hover:text-primary transition-colors cursor-pointer">
              {t("login.support") || "Hỗ trợ"}
            </span>
            <span className="hover:text-primary transition-colors cursor-pointer">
              {t("login.terms") || "Điều khoản"}
            </span>
            <span className="hover:text-primary transition-colors cursor-pointer">
              {t("login.privacy") || "Bảo mật"}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.2em]">
            © {new Date().getFullYear()} CVMEMS. All rights reserved.
          </p>
        </footer>
      </section>
    </main>
  )
}
