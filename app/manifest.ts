import type { MetadataRoute } from "next";
import {
  BACKGROUND_COLOR,
  ICON_192_PATH,
  ICON_512_PATH,
  ICON_MASKABLE_PATH,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_SHORT_NAME,
  THEME_COLOR,
} from "@/lib/constants/site";

/**
 * PWA manifest. Installing to the home screen is required for push
 * notifications on iOS, so this file is what makes reminders possible on an
 * iPhone.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_SHORT_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: BACKGROUND_COLOR,
    theme_color: THEME_COLOR,
    categories: ["productivity"],
    icons: [
      { src: ICON_192_PATH, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: ICON_512_PATH, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: ICON_MASKABLE_PATH, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
