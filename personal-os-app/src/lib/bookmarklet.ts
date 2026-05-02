import { personalOsUrl } from "@/lib/app-config";

export function captureBookmarklet(baseUrl = personalOsUrl) {
  const cleanBaseUrl = baseUrl.replace(/\/$/, "");
  const captureUrl = JSON.stringify(`${cleanBaseUrl}/capture`);
  return `javascript:(()=>{const b=${captureUrl};const q=new URLSearchParams({content:location.href});open(b+"?"+q.toString(),"_blank","noopener,noreferrer");})();`;
}
