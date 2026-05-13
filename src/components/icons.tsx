import Image from "next/image";

export const Logo = ({
  className = "size-16",
  size = 64,
}: {
  className?: string;
  size?: number;
}) => (
  <Image
    src="/Logo master.png"
    alt="Logo"
    width={size}
    height={size}
    className={`object-contain ${className}`}
  />
);
