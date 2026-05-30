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
const LANGUAGE_STORAGE_EVENT = "qltbyt-language-storage-change"
const DEFAULT_LANGUAGE: Language = {
  code: "vi",
  name: "Tiếng Việt",
}
let cachedLanguageStorageValue: string | null | undefined
let cachedLanguageSnapshot: Language = DEFAULT_LANGUAGE

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
    "login.usernameRequired": "Please enter your username",
    "login.passwordRequired": "Please enter your password",
    "login.tenantInactive": "This tenant is temporarily inactive",
    "login.rpcError": "Unable to authenticate right now. Please try again later.",
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
    "login.usernameRequired": "Vui lòng nhập tên đăng nhập",
    "login.passwordRequired": "Vui lòng nhập mật khẩu",
    "login.tenantInactive": "Đơn vị đang tạm ngưng đăng nhập",
    "login.rpcError": "Không thể xác thực lúc này. Vui lòng thử lại sau.",
    "footer.developedBy": "Phát triển bởi Nguyễn Thiên Chí",
    "footer.contact": "Mọi chi tiết xin liên hệ: thienchi2109@gmail.com",
  },
}

function parseStoredLanguage(value: string | null): Language {
  if (!value) return DEFAULT_LANGUAGE

  try {
    const parsed = JSON.parse(value) as Partial<Language>
    return parsed.code === "en" || parsed.code === "vi"
      ? {
          code: parsed.code,
          name: typeof parsed.name === "string" ? parsed.name : DEFAULT_LANGUAGE.name,
        }
      : DEFAULT_LANGUAGE
  } catch (error) {
    console.error("Failed to load language preference:", error)
    return DEFAULT_LANGUAGE
  }
}

function getLanguageSnapshot(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE

  const storageValue = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (storageValue !== cachedLanguageStorageValue) {
    cachedLanguageStorageValue = storageValue
    cachedLanguageSnapshot = parseStoredLanguage(storageValue)
  }

  return cachedLanguageSnapshot
}

function subscribeToLanguageStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange)
  window.addEventListener(LANGUAGE_STORAGE_EVENT, onStoreChange)

  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(LANGUAGE_STORAGE_EVENT, onStoreChange)
  }
}

/** Provides the persisted UI language preference to client components. */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const currentLanguage = React.useSyncExternalStore(
    subscribeToLanguageStorage,
    getLanguageSnapshot,
    () => DEFAULT_LANGUAGE,
  )

  const setLanguage = React.useCallback((language: Language) => {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, JSON.stringify(language))
      window.dispatchEvent(new Event(LANGUAGE_STORAGE_EVENT))
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

/** Reads the current language context. */
export function useLanguage() {
  // react-doctor-disable-next-line react-doctor/no-react19-deprecated-apis -- React 18.3.1 does not support React.use() for context reads.
  const context = React.useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
