import { User } from "lucide-react";

interface DefaultAvatarProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
}

const DefaultAvatar = ({ src, alt, className = "h-10 w-10" }: DefaultAvatarProps) => {
  if (src && src !== "/placeholder.svg") {
    return (
      <div className={`overflow-hidden rounded-full bg-muted ${className}`}>
        <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center overflow-hidden rounded-full bg-muted ${className}`}>
      <User className="h-1/2 w-1/2 text-muted-foreground" />
    </div>
  );
};

export default DefaultAvatar;
