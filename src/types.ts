export type VideoStatus = 'active' | 'disabled';

export interface Video {
  id: string;
  thumbnailUrl: string;
  embedUrl: string;
  websiteUrl?: string;
  title: string;
  sourceName: string;
  duration: string;
  status: VideoStatus;
  views: number;
  likes: number;
  commentsCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface Comment {
  id: string;
  name: string;
  text: string;
  createdAt: number;
}

export type AdType = 'banner_468x60' | 'social_bar' | 'in_feed';

export interface Ad {
  id: string;
  name: string;
  type: AdType;
  script: string;
  status: 'on' | 'off';
  placement: string;
  createdAt: number;
  updatedAt: number;
}

export interface Session {
  role: 'admin';
  name: string;
}
