import Image from "next/image";

export const Logo = ({
  className = "w-16 h-16",
  size = 64,
}: {
  className?: string;
  size?: number;
}) => (
  <Image
    src="https://i.postimg.cc/26dHxmnV/89307731ad9526cb7f84-1-Photoroom.png"
    alt="Logo"
    width={size}
    height={size}
    className={`object-contain ${className}`}
  />
);
