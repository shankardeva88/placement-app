import { useEffect, useState } from "react";

type AvatarSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-xl",
};

/** Converts a Google Drive "share" link (opens Drive's HTML viewer, not raw
 * image bytes) into Drive's direct-file-content form so it actually renders
 * in an <img> — students paste whatever share link Drive hands them by
 * default (.../file/d/FILE_ID/view?usp=sharing), so without this most pasted
 * links would just show as a broken image. Any other host's URL is used
 * as-is. */
function toDirectImageUrl(url: string): string {
  const match = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  return match ? `https://drive.google.com/uc?export=view&id=${match[1]}` : url;
}

/** Falls back to a gradient initial-letter circle — same look the nav bar
 * already used everywhere — on no photoUrl, or if the image fails to load
 * (private/unshared Drive file, dead link, etc.). */
export function Avatar({ photoUrl, name, size = "md" }: { photoUrl?: string; name: string; size?: AvatarSize }) {
  const [errored, setErrored] = useState(false);
  useEffect(() => setErrored(false), [photoUrl]);

  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const sizeClass = SIZE_CLASSES[size];

  if (photoUrl && !errored) {
    return (
      <img
        src={toDirectImageUrl(photoUrl)}
        alt={name}
        onError={() => setErrored(true)}
        className={`${sizeClass} shrink-0 rounded-full object-cover shadow-sm`}
      />
    );
  }

  return (
    <div
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 font-semibold text-white shadow-sm`}
    >
      {initial}
    </div>
  );
}
