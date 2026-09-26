import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { getAvatarUrl } from '@/lib/profiles';
import type { Profile } from '@/types';

/** Avatar for a profile; loads the private photo through a short-lived signed URL. */
export function ProfileAvatar({
  profile,
  size = 'md',
  className,
  previewUrl,
}: {
  profile: Pick<Profile, 'display_name' | 'avatar_url'>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Local object URL to show instead (e.g. a photo chosen but not yet saved). */
  previewUrl?: string | null;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    if (profile.avatar_url) {
      getAvatarUrl(profile.avatar_url).then((u) => {
        if (!cancelled) setUrl(u);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [profile.avatar_url]);

  return <Avatar src={previewUrl ?? url} name={profile.display_name || '?'} size={size} className={className} />;
}
