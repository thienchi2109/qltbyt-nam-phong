"use client"

import * as React from "react"

export interface Language {
  code: "en" | "vi"
  name: string
}

interface LanguageContextType {
  currentLanguage: Language
  setLanguage: (language: Language) => void
  t: (key: string) => string | undefined
}

const LanguageContext = React.createContext<LanguageContextType | undefined>(undefined)

const LANGUAGE_STORAGE_KEY = "preferred_language"

const translations = {
  en: {
    "login.subtitle": "Sign in to the system",
    "login.username": "Username",
    "login.usernamePlaceholder": "Enter your username",
    "login.password": "Password",
    "login.passwordPlaceholder": "Enter your password",
    "login.signIn": "Sign In",
    "login.signingIn": "Signing in...",
    "login.error": "Invalid username or password",
    "footer.developedBy": "Developed by Nguyen Thien Chi",
    "footer.contact": "For details contact: thienchi2109@gmail.com",
  },
  vi: {
    "login.subtitle": "Đăng nhập vào hệ thống",
    "login.username": "Tên đăng nhập",
    "login.usernamePlaceholder": "Nhập tên đăng nhập",
    "login.password": "Mật khẩu",
    "login.passwordPlaceholder": "Nhập mật khẩu",
    "login.signIn": "Đăng nhập",
    "login.signingIn": "Đang xác thực...",
    "login.error": "Tên đăng nhập hoặc mật khẩu không đúng",
    "footer.developedBy": "Phát triển bởi Nguyễn Thiên Chí",
    "footer.contact": "Mọi chi tiết xin liên hệ: thienchi2109@gmail.com",
  },
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = React.useState<Language>({
    code: "vi",
    name: "Tiếng Việt",
  })

  React.useEffect(() => {
    try {
      const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY)
      if (savedLanguage) {
        const parsed = JSON.parse(savedLanguage) as Language
        setCurrentLanguage(parsed)
      }
    } catch (error) {
      console.error("Failed to load language preference:", error)
    }
  }, [])

  const setLanguage = React.useCallback((language: Language) => {
    setCurrentLanguage(language)
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, JSON.stringify(language))
    } catch (error) {
      console.error("Failed to save language preference:", error)
    }
  }, [])

  const t = React.useCallback((key: string): string | undefined => {
    return translations[currentLanguage.code]?.[key as keyof typeof translations.en]
  }, [currentLanguage.code])

  const value = React.useMemo(
    () => ({
      currentLanguage,
      setLanguage,
      t,
    }),
    [currentLanguage, setLanguage, t],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = React.useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
