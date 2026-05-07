"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { signIn } from "next-auth/react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Lock, User } from "lucide-react"
import { Logo } from "@/components/icons"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/contexts/language-context"
import { LoginIllustrationPanel } from "./LoginIllustrationPanel"

function getLoginMessage(
  t: (key: string) => string | undefined,
  key: string,
  fallback: string,
): string {
  return t(key) || fallback
}

function createLoginFormSchema(t: (key: string) => string | undefined): z.ZodObject<{
  username: z.ZodString
  password: z.ZodString
}> {
  return z.object({
    username: z.string().trim().min(
      1,
      getLoginMessage(t, "login.usernameRequired", "Vui lòng nhập tên đăng nhập"),
    ),
    password: z.string().min(
      1,
      getLoginMessage(t, "login.passwordRequired", "Vui lòng nhập mật khẩu"),
    ),
  })
}

type LoginFormValues = z.infer<ReturnType<typeof createLoginFormSchema>>

function getCredentialErrorMessage(
  t: (key: string) => string | undefined,
  errorCode: string | undefined,
): string {
  switch (errorCode) {
    case "tenant_inactive":
      return getLoginMessage(
        t,
        "login.tenantInactive",
        "Đơn vị đang tạm ngưng đăng nhập",
      )
    case "rpc_error":
      return getLoginMessage(
        t,
        "login.rpcError",
        "Không thể xác thực lúc này. Vui lòng thử lại sau.",
      )
    case "invalid_credentials":
    default:
      return getLoginMessage(
        t,
        "login.error",
        "Tên đăng nhập hoặc mật khẩu không đúng",
      )
  }
}

export function LoginForm(): React.ReactElement {
  const { t } = useLanguage()
  const loginFormSchema = React.useMemo(() => createLoginFormSchema(t), [t])
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  })

  const handleLogin = async (values: LoginFormValues): Promise<void> => {
    form.clearErrors("root")
    try {
      const result = await signIn("credentials", {
        username: values.username,
        password: values.password,
        redirect: false,
      })

      if (!result || result.error) {
        form.setError("root", {
          type: "server",
          message: getCredentialErrorMessage(t, result?.error ?? undefined),
        })
        return
      }

      // Success: NextAuth session established; no legacy bridge writes.
      window.location.href = "/dashboard"
    } catch (err) {
      console.error("Unexpected login error", { error: err })
      form.setError("root", {
        type: "server",
        message: getCredentialErrorMessage(t, "rpc_error"),
      })
    }
  }

  const isSubmitting = form.formState.isSubmitting
  const rootError = form.formState.errors.root?.message

  return (
    <main className="flex min-h-screen">
      {/* Left Half — Brand & Illustration (Desktop only) */}
      <LoginIllustrationPanel />

      {/* Right Half — Sign-in Form */}
      <section className="w-full lg:w-1/2 bg-background flex flex-col justify-center items-center px-6 md:px-16 py-12 relative">
        {/* Mobile Logo */}
        <div className="lg:hidden absolute top-8 left-8 flex items-center gap-2">
          <Logo className="w-8 h-8" size={32} />
          <span className="font-bold text-xl text-primary">CVMEMS</span>
        </div>

        <div className="w-full max-w-md animate-in slide-in-from-right duration-700">
          {/* Login Card */}
          <div className="bg-white rounded-2xl shadow-lg shadow-black/5 p-8 md:p-10 space-y-8">
            {/* Logo + Brand */}
            <div className="flex items-center gap-3">
              <Logo className="w-10 h-10" size={40} />
              <span className="font-bold text-xl text-foreground tracking-tight">CVMEMS</span>
            </div>
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
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-6">
                {rootError && (
                  <div
                    role="alert"
                    aria-live="polite"
                    className="bg-red-500/10 backdrop-blur-sm border border-red-500/20 rounded-xl p-4 animate-in slide-in-from-top duration-300"
                  >
                    <p className="text-red-600 text-sm font-medium">{rootError}</p>
                  </div>
                )}

                {/* Username */}
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                        {t("login.username") || "Tên đăng nhập"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          autoComplete="username"
                          placeholder={t("login.usernamePlaceholder") || "username@cvmems.com"}
                          disabled={isSubmitting}
                          className="recessed-input h-auto rounded-xl border-none bg-muted px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Password */}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                        <Lock className="h-3.5 w-3.5" />
                        {t("login.password") || "Mật khẩu"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          placeholder="••••••••"
                          disabled={isSubmitting}
                          className="recessed-input h-auto rounded-xl border-none bg-muted px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* CTA Button */}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-cta-gradient text-white py-4 px-6 rounded-xl font-bold text-base shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isSubmitting ? (
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
                </Button>
              </form>
            </Form>
          </div>
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
          <p
            suppressHydrationWarning
            className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.2em]"
          >
            © {new Date().getFullYear()} CVMEMS. All rights reserved.
          </p>
        </footer>
      </section>
    </main>
  )
}
