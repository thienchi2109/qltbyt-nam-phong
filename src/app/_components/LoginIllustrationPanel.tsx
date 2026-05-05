/**
 * Left-side brand and illustration panel for the sign-in page.
 * Displays the CVMEMS logo, a medical illustration, hero text,
 * and system stats on a teal gradient background.
 * Visible on desktop (lg+) only.
 */
import Image from "next/image"
import { Logo } from "@/components/icons"

export function LoginIllustrationPanel() {
    return (
        <section className="hidden lg:flex w-1/2 bg-teal-split flex-col justify-between p-12 text-white relative">
            {/* Top Branding */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center">
                    <Logo className="w-7 h-7" size={28} />
                </div>
                <span className="font-bold text-2xl tracking-tight">CVMEMS</span>
            </div>

            {/* Central Illustration */}
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12">
                <div className="w-full max-w-lg aspect-square relative group">
                    <Image
                        src="/login-illustration.png"
                        alt="Hình minh họa quản lý thiết bị y tế thông minh"
                        width={512}
                        height={512}
                        className="w-full h-full object-contain mix-blend-lighten opacity-90 transition-transform duration-500 group-hover:scale-105"
                    />

                    {/* Floating IoT Status Badge */}
                    <div className="absolute top-1/4 right-0 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/5 animate-pulse">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-400" />
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                                Device Active
                            </span>
                        </div>
                    </div>
                </div>

                {/* Hero Text */}
                <div className="space-y-4 max-w-md">
                    <h1 className="text-4xl font-bold leading-tight">
                        Quản Lý Thiết Bị Y Tế Thông Minh
                    </h1>
                    <p className="text-white/70 text-lg">
                        Nền tảng quản lý toàn diện vòng đời thiết bị y tế
                    </p>
                </div>
            </div>

            {/* Bottom Stats */}
            <div className="pt-8 border-t border-white/10 flex justify-between items-center text-xs uppercase tracking-widest text-white/50">
                <span>99.9% Uptime</span>
                <span className="w-1 h-1 bg-white/30 rounded-full" />
                <span>2.5s Response</span>
                <span className="w-1 h-1 bg-white/30 rounded-full" />
                <span>24/7 Support</span>
            </div>
        </section>
    )
}
